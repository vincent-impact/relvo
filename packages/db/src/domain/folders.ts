import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import type { TenantDb, Tx } from "../tenant";
import { DomainError, assertFound } from "./errors";
import { avecOrigine, EVENT_TYPES, logEvent, type Origine } from "./events";
import { ensureAffected, slugify } from "./helpers";
import { updateSubject } from "./subjects";

// Domaine Folders (M3.4, M23). Invariants : un dossier a un PÈRE — « Général »
// (is_default) est la racine, seule sans père (contrainte
// `folders_parent_requis`) ; slug unique par père ; profondeur bornée
// (PROFONDEUR_MAX) ; la suppression de « Général » est interdite, et celle d'un
// autre dossier REMONTE ce qu'il contenait chez le père — jamais perdu ; jamais
// plus d'un is_default.

/** Niveaux de dossiers SOUS Général, au plus — tenu par un test, pas par la vigilance. */
export const PROFONDEUR_MAX = 3;

export const createFolderSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
  description: z.string().trim().max(500).optional().nullable(),
  slug: z.string().trim().max(80).optional(),
  /** Clés de logo (palette / jeu d'icônes curés, cf. web lib/folders.ts). */
  color: z.string().trim().max(40).optional().nullable(),
  icon: z.string().trim().max(40).optional().nullable(),
  /** Le père ; absent ou nul → sous « Général ». */
  parentId: z.uuid().optional().nullable(),
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

/** Retourne le Folder « Général » (is_default) du compte, ou null. */
export function getDefaultFolder(db: TenantDb) {
  return db.folder.findFirst({ where: { isDefault: true } });
}

// ─────────────────────────────────────────────────────────────
// L'ARBRE (M23.1) — lu d'un coup, parcouru en mémoire
// ─────────────────────────────────────────────────────────────
//
// Un compte a quelques dizaines de dossiers au plus, sur trois niveaux : une
// seule requête les ramène tous, et la chaîne, la profondeur, le sous-arbre se
// calculent en mémoire — nombre de requêtes constant (PITFALLS #3).

export type FolderNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  isDefault: boolean;
  isActive: boolean;
  color: string | null;
  icon: string | null;
};

export type FolderTree = Map<string, FolderNode>;

export async function loadFolderTree(db: TenantDb | Tx): Promise<FolderTree> {
  const rows = await db.folder.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      isDefault: true,
      isActive: true,
      color: true,
      icon: true,
    },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

/** La chaîne des dossiers, RACINE EN PREMIER, le dossier lui-même en dernier. */
export function chaineDe(tree: FolderTree, id: string): FolderNode[] {
  const chaine: FolderNode[] = [];
  let courant = tree.get(id) ?? null;
  const vus = new Set<string>();
  while (courant && !vus.has(courant.id)) {
    vus.add(courant.id);
    chaine.unshift(courant);
    courant = courant.parentId ? (tree.get(courant.parentId) ?? null) : null;
  }
  return chaine;
}

/** Niveaux sous Général : Général = 0, ses fils = 1… */
export function profondeurDe(tree: FolderTree, id: string): number {
  return Math.max(0, chaineDe(tree, id).length - 1);
}

/** Le chemin lisible, SANS Général : « Clients › Franchises › Narbonne ». */
export function cheminDe(tree: FolderTree, id: string): string {
  return chaineDe(tree, id)
    .filter((f) => !f.isDefault)
    .map((f) => f.name)
    .join(" › ");
}

/** Le premier dossier sous Général de la chaîne — celui dont le Calendrier prend la couleur. */
export function premierNiveauDe(
  tree: FolderTree,
  id: string,
): FolderNode | null {
  return chaineDe(tree, id).find((f) => !f.isDefault) ?? null;
}

/** Le dossier et tous ses descendants — la PORTÉE d'un dossier (M23.4). */
export function sousArbreDe(tree: FolderTree, id: string): FolderNode[] {
  const racine = tree.get(id);
  if (!racine) return [];
  const resultat: FolderNode[] = [racine];
  const file = [id];
  while (file.length) {
    const courant = file.shift()!;
    for (const f of tree.values()) {
      if (f.parentId === courant) {
        resultat.push(f);
        file.push(f.id);
      }
    }
  }
  return resultat;
}

/** La hauteur d'un sous-arbre : 0 pour une feuille, 1 pour un dossier qui a des fils sans petits-fils… */
function hauteurDe(tree: FolderTree, id: string): number {
  let max = 0;
  for (const f of sousArbreDe(tree, id)) {
    max = Math.max(max, profondeurDe(tree, f.id) - profondeurDe(tree, id));
  }
  return max;
}

/**
 * La PRÉSENTATION d'un dossier, la même sur toute ligne du produit (M23.4) :
 * son nom, son chemin lisible, et les clés de logo — slug, couleur, icône —
 * du PREMIER NIVEAU sous Général, celui dont le Calendrier et les bandes
 * prennent la couleur. Un dossier de premier niveau se présente lui-même.
 */
export type DossierPresentation = {
  id: string;
  name: string;
  /** « Clients › Franchises › Narbonne », sans Général. */
  path: string;
  /** Le premier dossier sous Général de la chaîne. */
  topId: string;
  slug: string;
  color: string | null;
  icon: string | null;
  /** Les identifiants de la chaîne, Général exclu, du premier niveau au dossier. */
  chainIds: string[];
};

export function presentationDe(
  tree: FolderTree,
  id: string | null | undefined,
): DossierPresentation | null {
  if (!id) return null;
  const chaine = chaineDe(tree, id).filter((f) => !f.isDefault);
  const dossier = chaine[chaine.length - 1];
  const top = chaine[0];
  if (!dossier || !top) return null;
  return {
    id: dossier.id,
    name: dossier.name,
    path: chaine.map((f) => f.name).join(" › "),
    topId: top.id,
    slug: top.slug,
    color: top.color,
    icon: top.icon,
    chainIds: chaine.map((f) => f.id),
  };
}

/** Un dossier tel que les listes de choix le proposent : sa présentation, son père et sa profondeur. */
export type DossierOption = DossierPresentation & {
  parentId: string | null;
  /** Niveaux sous Général : 1 pour un fils de Général. */
  depth: number;
};

/**
 * L'arbre en ORDRE DE LECTURE — profondeur d'abord, les frères par nom —,
 * Général exclu : c'est l'ordre des listes de choix et de la Mémoire.
 */
export function arbreOrdonne(tree: FolderTree): DossierOption[] {
  const resultat: DossierOption[] = [];
  const filsDe = (parentId: string | null) =>
    [...tree.values()]
      .filter((f) => !f.isDefault && f.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const racine = [...tree.values()].find((f) => f.isDefault) ?? null;
  const parcourir = (parentId: string | null, depth: number) => {
    for (const f of filsDe(parentId)) {
      const p = presentationDe(tree, f.id);
      if (p) resultat.push({ ...p, parentId: f.parentId, depth });
      parcourir(f.id, depth + 1);
    }
  };
  parcourir(racine?.id ?? null, 1);
  return resultat;
}

/** Les dossiers d'un compte, en ordre de lecture, Général exclu. */
export async function listFolderOptions(
  db: TenantDb,
): Promise<DossierOption[]> {
  return arbreOrdonne(await loadFolderTree(db));
}

/**
 * RÉSOUT un dossier d'après ce qu'on en dit (M23.5, M23.7) : un chemin
 * (« Clients › Narbonne », « clients/narbonne »), ou un nom seul quand il ne
 * désigne qu'un dossier. La casse et les accents ne comptent pas. Plusieurs
 * dossiers du même nom ne sont jamais tranchés en silence : ils reviennent en
 * candidats, et c'est à qui demande de préciser (PITFALLS #68).
 */
export function resoudreDossier(
  tree: FolderTree,
  texte: string | null | undefined,
): { dossier: FolderNode | null; candidats: FolderNode[] } {
  const segments = (texte ?? "")
    .split(/\s*(?:›|>|\/|»)\s*/)
    .map((s) => slugify(s))
    .filter(Boolean);
  if (segments.length === 0) return { dossier: null, candidats: [] };
  // Un dossier inactif ne se range plus.
  const dossiers = [...tree.values()].filter((f) => !f.isDefault && f.isActive);
  const cheminSlugs = (f: FolderNode) =>
    chaineDe(tree, f.id)
      .filter((x) => !x.isDefault)
      .map((x) => slugify(x.name));
  // Le chemin exact, Général omis ou non.
  const parChemin = dossiers.filter((f) => {
    const c = cheminSlugs(f);
    return (
      c.join("/") === segments.join("/") ||
      (segments[0] === "general" && c.join("/") === segments.slice(1).join("/"))
    );
  });
  if (parChemin.length === 1) return { dossier: parChemin[0]!, candidats: [] };
  // Un nom seul : unique → trouvé ; plusieurs → candidats.
  if (segments.length === 1) {
    const parNom = dossiers.filter(
      (f) => slugify(f.name) === segments[0] || f.slug === segments[0],
    );
    if (parNom.length === 1) return { dossier: parNom[0]!, candidats: [] };
    if (parNom.length > 1) return { dossier: null, candidats: parNom };
    // Un bout du nom, s'il ne désigne qu'un dossier.
    const parBout = dossiers.filter((f) =>
      slugify(f.name).includes(segments[0]!),
    );
    if (parBout.length === 1) return { dossier: parBout[0]!, candidats: [] };
    return { dossier: null, candidats: parBout };
  }
  // Un chemin partiel : la fin du chemin suffit (« Franchises › Narbonne »).
  const parFin = dossiers.filter((f) => {
    const c = cheminSlugs(f);
    return (
      c.length >= segments.length &&
      c.slice(-segments.length).join("/") === segments.join("/")
    );
  });
  if (parFin.length === 1) return { dossier: parFin[0]!, candidats: [] };
  return { dossier: null, candidats: parFin };
}

/** Les identifiants d'un dossier et de ses fils — pour filtrer « ce dossier et ce qu'il contient ». */
export async function folderSubtreeIds(
  db: TenantDb,
  id: string,
): Promise<string[]> {
  return sousArbreDe(await loadFolderTree(db), id).map((f) => f.id);
}

/** La chaîne d'un dossier, racine en premier — pour l'héritage de la couche Domaine (M23.2). */
export async function folderChain(
  db: TenantDb,
  id: string,
): Promise<FolderNode[]> {
  return chaineDe(await loadFolderTree(db), id);
}

const TROP_PROFOND = `Trois niveaux de dossiers sous Général, pas plus.`;

function assertProfondeur(niveau: number) {
  if (niveau > PROFONDEUR_MAX) {
    throw new DomainError("VALIDATION", TROP_PROFOND);
  }
}

/** Le père demandé — ou « Général » — vérifié dans l'arbre. */
function resoudrePere(tree: FolderTree, parentId: string | null | undefined) {
  const pere = parentId
    ? tree.get(parentId)
    : [...tree.values()].find((f) => f.isDefault);
  if (!pere) {
    throw new DomainError("NOT_FOUND", "Dossier parent introuvable.");
  }
  return pere;
}

function assertSlugLibre(tree: FolderTree, parentId: string, slug: string) {
  for (const f of tree.values()) {
    if (f.parentId === parentId && f.slug === slug) {
      throw new DomainError(
        "CONFLICT",
        `Un dossier « ${f.name} » existe déjà à cet endroit.`,
      );
    }
  }
}

export async function createFolder(db: TenantDb, input: CreateFolderInput) {
  const data = createFolderSchema.parse(input);
  const slug = data.slug ? slugify(data.slug) : slugify(data.name);
  if (!slug) {
    throw new DomainError("VALIDATION", "Slug de dossier invalide.");
  }

  const tree = await loadFolderTree(db);
  const pere = resoudrePere(tree, data.parentId);
  assertProfondeur(profondeurDe(tree, pere.id) + 1);
  assertSlugLibre(tree, pere.id, slug);

  return db.$transaction(async (tx) => {
    const folder = await tx.folder.create({
      data: {
        name: data.name,
        slug,
        description: data.description ?? null,
        color: data.color ?? null,
        icon: data.icon ?? null,
        parentId: pere.id,
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
      metadata: { parentId: pere.id, chemin: cheminDe(tree, pere.id) || null },
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

/**
 * DÉPLACE un dossier — avec tout ce qu'il contient, fils compris — sous un
 * autre père (M23.3). Refusé : la racine, un déplacement dans soi-même ou dans
 * un de ses fils, une profondeur qui dépasserait la borne, un frère de même
 * slug.
 */
export async function moveFolder(
  db: TenantDb,
  id: string,
  parentId: string | null,
  origine?: Origine,
) {
  const tree = await loadFolderTree(db);
  const dossier = tree.get(id);
  if (!dossier) throw new DomainError("NOT_FOUND", "Dossier introuvable.");
  if (dossier.isDefault) {
    throw new DomainError(
      "FORBIDDEN_GENERAL_FOLDER",
      "Le dossier « Général » est la racine : il ne se déplace pas.",
    );
  }
  const pere = resoudrePere(tree, parentId);
  if (sousArbreDe(tree, id).some((f) => f.id === pere.id)) {
    throw new DomainError(
      "VALIDATION",
      "Un dossier ne se range pas dans lui-même ni dans un de ses dossiers.",
    );
  }
  if (pere.id === dossier.parentId) return getFolder(db, id);
  assertProfondeur(profondeurDe(tree, pere.id) + 1 + hauteurDe(tree, id));
  assertSlugLibre(tree, pere.id, dossier.slug);

  return db.$transaction(async (tx) => {
    const { count } = await tx.folder.updateMany({
      where: { id },
      data: { parentId: pere.id },
    });
    ensureAffected(count, "Dossier");
    await logEvent(tx as Tx, {
      entityType: "system",
      entityId: id,
      eventType: EVENT_TYPES.folderMoved,
      title: `Dossier « ${dossier.name} » déplacé`,
      actor: "user",
      metadata: avecOrigine(
        {
          from: dossier.parentId,
          to: pere.id,
          chemin: cheminDe(tree, pere.id) || null,
        },
        origine,
      ),
    });
    return assertFound(await tx.folder.findFirst({ where: { id } }), "Dossier");
  });
}

/** Un slug libre sous `parentId`, en suffixant si un frère le porte déjà. */
function slugLibreSous(
  tree: FolderTree,
  parentId: string,
  slug: string,
  exclure: Set<string>,
): string {
  const pris = new Set(
    [...tree.values()]
      .filter((f) => f.parentId === parentId && !exclure.has(f.id))
      .map((f) => f.slug),
  );
  if (!pris.has(slug)) return slug;
  for (let n = 2; ; n++) {
    const candidat = `${slug}-${n}`;
    if (!pris.has(candidat)) return candidat;
  }
}

/**
 * SUPPRIME un dossier en REMONTANT ce qu'il contenait chez le père (M23.3) :
 * ses dossiers, ses instructions et ses documents ; ses sujets, ses messages
 * classés et les contacts qui l'avaient pour dossier habituel — sauf quand le
 * père est « Général », qui ne contient jamais de sujet (invariant 17) : ils
 * redeviennent « sans dossier ». Les canaux qui le citaient citent le père.
 * Les questions de Relvo sur ce dossier tombent avec lui.
 */
export async function deleteFolder(db: TenantDb, id: string) {
  const tree = await loadFolderTree(db);
  const folder = tree.get(id);
  if (!folder) throw new DomainError("NOT_FOUND", "Dossier introuvable.");
  if (folder.isDefault) {
    throw new DomainError(
      "FORBIDDEN_GENERAL_FOLDER",
      "Le dossier « Général » ne peut pas être supprimé.",
    );
  }
  const pere = assertFound(
    folder.parentId ? tree.get(folder.parentId) : null,
    "Dossier parent",
  );
  // Un sujet, un message, un contact ne pointent jamais Général.
  const cibleAffaires = pere.isDefault ? null : pere.id;
  const fils = [...tree.values()].filter((f) => f.parentId === id);

  return db.$transaction(async (tx) => {
    const exclure = new Set(fils.map((f) => f.id).concat(id));
    const nouveauxSlugs = new Map<string, string>();
    for (const f of fils) {
      const slug = slugLibreSous(tree, pere.id, f.slug, exclure);
      nouveauxSlugs.set(f.id, slug);
      await tx.folder.updateMany({
        where: { id: f.id },
        data: { parentId: pere.id, slug },
      });
      // Le slug attribué compte pour le fils suivant.
      tree.set(f.id, { ...f, parentId: pere.id, slug });
      exclure.delete(f.id);
    }
    const [connaissances, sujets, messages, contacts] = await Promise.all([
      tx.knowledgeDocument.updateMany({
        where: { folderId: id },
        data: { folderId: pere.id },
      }),
      tx.subject.updateMany({
        where: { folderId: id },
        data: { folderId: cibleAffaires },
      }),
      tx.message.updateMany({
        where: { folderId: id },
        data: { folderId: cibleAffaires },
      }),
      tx.contact.updateMany({
        where: { defaultFolderId: id },
        data: { defaultFolderId: cibleAffaires },
      }),
    ]);
    const canaux = await tx.channel.findMany({
      where: { folderIds: { has: id } },
      select: { id: true, folderIds: true },
    });
    for (const c of canaux) {
      const restants = c.folderIds.filter((f) => f !== id);
      if (cibleAffaires && !restants.includes(cibleAffaires)) {
        restants.push(cibleAffaires);
      }
      await tx.channel.updateMany({
        where: { id: c.id },
        data: { folderIds: restants },
      });
    }
    const { count } = await tx.folder.deleteMany({ where: { id } });
    ensureAffected(count, "Dossier");
    await logEvent(tx as Tx, {
      entityType: "system",
      entityId: id,
      eventType: EVENT_TYPES.folderDeleted,
      title: `Dossier « ${folder.name} » supprimé`,
      actor: "user",
      metadata: {
        parentId: pere.id,
        remontes: {
          dossiers: fils.length,
          connaissances: connaissances.count,
          sujets: sujets.count,
          messages: messages.count,
          contacts: contacts.count,
          canaux: canaux.length,
        },
      },
    });
    return { id };
  });
}

// ─────────────────────────────────────────────────────────────
// Les domaines PROPOSÉS PAR LE COURRIER (M17.10, 05 §9.6, 04 §10)
// ─────────────────────────────────────────────────────────────
//
// Relvo ne crée jamais un domaine : quand aucun ne convient, la structuration
// pose un `proposedFolder` sur le sujet. Dès que plusieurs sujets partagent
// la même proposition, Relvo suggère de créer le domaine et d'y ranger ces
// sujets — un geste, par la même fonction que la Mémoire. La proposition
// RESTE sur le sujet : supprimer le domaine la fait réapparaître.

/** Deux sujets au moins pour qu'une proposition vaille une question. */
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
 * Les propositions de domaine que plusieurs sujets partagent — sujets
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
 * slug — et y range tous les sujets sans domaine qui partagent la
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
  const sujets = await db.subject.findMany({
    where: {
      folderId: null,
      proposedFolder: { not: null },
      status: { in: ["open", "validated"] },
    },
    select: { id: true, proposedFolder: true },
  });
  let reclassees = 0;
  for (const a of sujets) {
    if (slugify(a.proposedFolder!.trim()) !== slug) continue;
    await updateSubject(db, a.id, { folderId: folder.id }, origine);
    reclassees += 1;
  }
  return { folderId: folder.id, name: folder.name, reclassees };
}
