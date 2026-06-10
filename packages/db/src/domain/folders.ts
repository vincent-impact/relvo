import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import type { TenantDb, Tx } from "../tenant";
import { DomainError, assertFound } from "./errors";
import { EVENT_TYPES, logEvent } from "./events";
import { ensureAffected, slugify } from "./helpers";

// Domaine Folders (M3.4). Invariants : slug unique par compte, suppression du
// Folder « Général » (is_default) interdite, jamais plus d'un is_default.

export const createFolderSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
  description: z.string().trim().max(500).optional().nullable(),
  slug: z.string().trim().max(80).optional(),
});

export const updateFolderSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).optional().nullable(),
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
