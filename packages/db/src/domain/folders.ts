import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import type { TenantDb, Tx } from "../tenant";
import { DomainError, assertFound } from "./errors";
import { EVENT_TYPES, logEvent, type Origine } from "./events";
import { ensureAffected, slugify } from "./helpers";
import { updateSubject } from "./subjects";

// Domaine Folders (M3.4). Invariants : slug unique par compte, suppression du
// Folder « Général » (is_default) interdite, jamais plus d'un is_default.

export const createFolderSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
  description: z.string().trim().max(500).optional().nullable(),
  slug: z.string().trim().max(80).optional(),
  /** Clés de logo (palette / jeu d'icônes curés, cf. web lib/folders.ts). */
  color: z.string().trim().max(40).optional().nullable(),
  icon: z.string().trim().max(40).optional().nullable(),
});

export const updateFolderSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  color: z.string().trim().max(40).optional().nullable(),
  icon: z.string().trim().max(40).optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;

export function listFolders(db: TenantDb) {
  return db.folder.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export async function getFolder(db: TenantDb, id: string) {
  return assertFound(await db.folder.findFirst({ where: { id } }), "Dossier");
}

export async function createFolder(db: TenantDb, input: CreateFolderInput) {
  const data = createFolderSchema.parse(input);
  const slug = data.slug ? slugify(data.slug) : slugify(data.name);
  if (!slug) {
    throw new DomainError("VALIDATION", "Slug de dossier invalide.");
  }

  const existing = await db.folder.findFirst({ where: { slug } });
  if (existing) {
    throw new DomainError("CONFLICT", `Un dossier « ${slug} » existe déjà.`);
  }

  return db.$transaction(async (tx) => {
    const folder = await tx.folder.create({
      data: {
        name: data.name,
        slug,
        description: data.description ?? null,
        color: data.color ?? null,
        icon: data.icon ?? null,
        // is_default reste false : le Folder « Général » est créé à l'ouverture
        // du compte (createAccount), jamais via cette fonction.
      } as Prisma.FolderUncheckedCreateInput,
    });
    await logEvent(tx as Tx, {
      entityType: "system",
      entityId: folder.id,
      eventType: EVENT_TYPES.folderCreated,
      title: `Dossier « ${folder.name} » créé`,
      actor: "user",
    });
    return folder;
  });
}

export async function updateFolder(
  db: TenantDb,
  id: string,
  input: UpdateFolderInput,
) {
  const data = updateFolderSchema.parse(input);
  return db.$transaction(async (tx) => {
    const { count } = await tx.folder.updateMany({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.icon !== undefined ? { icon: data.icon } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    ensureAffected(count, "Dossier");
    const folder = assertFound(
      await tx.folder.findFirst({ where: { id } }),
      "Dossier",
    );
    await logEvent(tx as Tx, {
      entityType: "system",
      entityId: folder.id,
      eventType: EVENT_TYPES.folderUpdated,
      title: `Dossier « ${folder.name} » modifié`,
      actor: "user",
    });
    return folder;
  });
}

export async function deleteFolder(db: TenantDb, id: string) {
  const folder = assertFound(
    await db.folder.findFirst({ where: { id } }),
    "Dossier",
  );
  if (folder.isDefault) {
    throw new DomainError(
      "FORBIDDEN_GENERAL_FOLDER",
      "Le dossier « Général » ne peut pas être supprimé.",
    );
  }
  return db.$transaction(async (tx) => {
    const { count } = await tx.folder.deleteMany({ where: { id } });
    ensureAffected(count, "Dossier");
    await logEvent(tx as Tx, {
      entityType: "system",
      entityId: id,
      eventType: EVENT_TYPES.folderDeleted,
      title: `Dossier « ${folder.name} » supprimé`,
      actor: "user",
    });
    return { id };
  });
}

/** Retourne le Folder « Général » (is_default) du compte, ou null. */
export function getDefaultFolder(db: TenantDb) {
  return db.folder.findFirst({ where: { isDefault: true } });
}

// ─────────────────────────────────────────────────────────────
// Les domaines PROPOSÉS PAR LE COURRIER (M17.10, 05 §9.6, 04 §10)
// ─────────────────────────────────────────────────────────────
//
// Relvo ne crée jamais un domaine : quand aucun ne convient, la structuration
// pose un `proposedFolder` sur l'affaire. Dès que plusieurs affaires partagent
// la même proposition, Relvo suggère de créer le domaine et d'y ranger ces
// affaires — un geste, par la même fonction que la Mémoire. La proposition
// RESTE sur l'affaire : supprimer le domaine la fait réapparaître.

/** Deux affaires au moins pour qu'une proposition vaille une question. */
export const PROPOSITION_MIN_AFFAIRES = 2;

/** L'étape d'origine d'une question de domaine proposé : le préfixe, puis le slug. */
export const ETAPE_DOMAINE_PROPOSE = "domaine-propose";

export type FolderProposal = {
  /** Le nom le plus fréquent parmi les graphies rencontrées. */
  name: string;
  slug: string;
  count: number;
  subjectIds: string[];
};

/**
 * Les propositions de domaine que plusieurs affaires partagent — affaires
 * ouvertes ou validées, sans domaine —, groupées par slug (la casse et les
 * accents ne séparent pas deux propositions), les plus portées d'abord. Une
 * proposition déjà tranchée — question répondue ou écartée — n'est jamais
 * reproposée.
 */
export async function listFolderProposals(
  db: TenantDb,
): Promise<FolderProposal[]> {
  const [rows, tranchees] = await Promise.all([
    db.subject.findMany({
      where: {
        folderId: null,
        proposedFolder: { not: null },
        status: { in: ["open", "validated"] },
      },
      select: { id: true, proposedFolder: true },
      orderBy: { createdAt: "asc" },
    }),
    db.relvoQuestion.findMany({
      where: {
        originStep: { startsWith: `${ETAPE_DOMAINE_PROPOSE}/` },
        status: { not: "open" },
      },
      select: { originStep: true },
    }),
  ]);
  const exclus = new Set(
    tranchees.map((t) => t.originStep!.slice(ETAPE_DOMAINE_PROPOSE.length + 1)),
  );
  const groupes = new Map<
    string,
    { graphies: Map<string, number>; subjectIds: string[] }
  >();
  for (const r of rows) {
    const nom = r.proposedFolder!.trim();
    const slug = slugify(nom);
    if (!slug || exclus.has(slug)) continue;
    const g = groupes.get(slug) ?? {
      graphies: new Map<string, number>(),
      subjectIds: [] as string[],
    };
    g.graphies.set(nom, (g.graphies.get(nom) ?? 0) + 1);
    g.subjectIds.push(r.id);
    groupes.set(slug, g);
  }
  return [...groupes.entries()]
    .filter(([, g]) => g.subjectIds.length >= PROPOSITION_MIN_AFFAIRES)
    .map(([slug, g]) => ({
      slug,
      name: [...g.graphies.entries()].sort((a, b) => b[1] - a[1])[0]![0],
      count: g.subjectIds.length,
      subjectIds: g.subjectIds,
    }))
    .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
}

/**
 * CRÉE le domaine d'une proposition — ou reprend celui qui porte déjà ce
 * slug — et y range toutes les affaires sans domaine qui partagent la
 * proposition, par `updateSubject` (la fonction de la fiche), journalisé.
 */
export async function createFolderFromProposal(
  db: TenantDb,
  input: { name: string },
  origine?: Origine,
): Promise<{ folderId: string; name: string; reclassees: number }> {
  const name = input.name.trim();
  const slug = slugify(name);
  if (!slug) throw new DomainError("VALIDATION", "Nom de domaine invalide.");
  const existant = await db.folder.findFirst({ where: { slug } });
  const folder = existant ?? (await createFolder(db, { name }));
  const affaires = await db.subject.findMany({
    where: {
      folderId: null,
      proposedFolder: { not: null },
      status: { in: ["open", "validated"] },
    },
    select: { id: true, proposedFolder: true },
  });
  let reclassees = 0;
  for (const a of affaires) {
    if (slugify(a.proposedFolder!.trim()) !== slug) continue;
    await updateSubject(db, a.id, { folderId: folder.id }, origine);
    reclassees += 1;
  }
  return { folderId: folder.id, name: folder.name, reclassees };
}
