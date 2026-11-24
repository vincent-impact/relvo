import type { TenantDb } from "../tenant";

// L'ANNUAIRE DES IDENTIFIANTS DE MESSAGERIE (M29.1) — et les mentions (M29.2).
//
// Dans un groupe WhatsApp, « @ » est suivi d'un identifiant interne du réseau :
// une suite de chiffres qui n'est ni un nom ni, le plus souvent, un numéro.
// L'annuaire dit à qui chacun appartient. Trois règles :
//
//   · le TEXTE STOCKÉ ne change jamais : la mention se résout à la LECTURE
//     (`ecrireMentions`). Un message reçu avant que l'annuaire connaisse son
//     auteur s'affiche donc juste dès qu'il le connaît, sans reprise ;
//   · on ne DÉSAPPREND rien : un nom ou un numéro connus ne sont pas effacés
//     par une source qui ne les porte pas, et « c'est le dirigeant » reste vrai ;
//   · un identifiant cherché et introuvable est noté SANS NOM : on ne le
//     recherche pas chez le fournisseur à chaque message.

/** « @ » suivi d'au moins sept chiffres — un identifiant interne ou un numéro. */
const MENTION = /@(\d{7,20})(?!\d)/g;

/** Ce qui s'écrit à la place de l'identifiant du dirigeant. */
export const MENTION_VOUS = "@vous";

/** Les identifiants mentionnés dans un texte, sans doublon. */
export function idsDesMentions(texte: string | null | undefined): string[] {
  if (!texte) return [];
  return [...new Set([...texte.matchAll(MENTION)].map((m) => m[1] ?? ""))];
}

/**
 * La clé d'un identifiant ou d'un numéro : ses chiffres seuls. « 2653…@lid »,
 * « 33612…@s.whatsapp.net » et « +33 6 12… » se comparent ainsi à ce que porte
 * le texte d'une mention. Null si ce n'en est pas un.
 */
export function cleIdentite(raw: string | null | undefined): string | null {
  const chiffres = ((raw ?? "").split("@")[0] ?? "").replace(/\D/g, "");
  return chiffres.length >= 7 ? chiffres : null;
}

export type IdentiteNotee = {
  /** Identifiant interne, brut ou en chiffres. */
  internalId: string | null | undefined;
  phone?: string | null;
  name?: string | null;
  isSelf?: boolean;
};

/**
 * Note ce qu'on vient d'apprendre sur des identifiants d'un canal. Une entrée
 * sans identifiant lisible est laissée ; rien de connu n'est effacé.
 */
export async function noterIdentites(
  db: TenantDb,
  channelId: string,
  identites: readonly IdentiteNotee[],
): Promise<void> {
  const apprises = new Map<
    string,
    { phone: string | null; name: string | null; isSelf: boolean }
  >();
  for (const i of identites) {
    const cle = cleIdentite(i.internalId);
    if (!cle) continue;
    const deja = apprises.get(cle);
    apprises.set(cle, {
      phone: cleIdentite(i.phone) ?? deja?.phone ?? null,
      name: i.name?.trim() || deja?.name || null,
      isSelf: Boolean(i.isSelf) || Boolean(deja?.isSelf),
    });
  }
  if (apprises.size === 0) return;

  const connues = await db.messagingIdentity.findMany({
    where: { channelId, internalId: { in: [...apprises.keys()] } },
  });
  const parCle = new Map(connues.map((c) => [c.internalId, c]));

  const nouvelles = [...apprises]
    .filter(([cle]) => !parCle.has(cle))
    .map(([internalId, v]) => ({ channelId, internalId, ...v }));
  if (nouvelles.length > 0) {
    // `skipDuplicates` : deux messages du même auteur arrivent parfois ensemble.
    await db.messagingIdentity.createMany({
      data: nouvelles as never,
      skipDuplicates: true,
    });
  }
  for (const [cle, v] of apprises) {
    const c = parCle.get(cle);
    if (!c) continue;
    const suite = {
      phone: v.phone ?? c.phone,
      name: v.name ?? c.name,
      isSelf: c.isSelf || v.isSelf,
    };
    if (
      suite.phone === c.phone &&
      suite.name === c.name &&
      suite.isSelf === c.isSelf
    )
      continue;
    await db.messagingIdentity.updateMany({
      where: { id: c.id },
      data: suite,
    });
  }
}

export type Annuaire = ReadonlyMap<
  string,
  { name: string | null; phone: string | null; isSelf: boolean }
>;

/**
 * Qui sont ces identifiants mentionnés ? La clé de l'annuaire rendu est celle
 * que porte le texte — l'identifiant interne, ou le numéro quand la mention
 * est écrite ainsi. Sans `channelId`, tous les canaux du compte : pour
 * l'AFFICHAGE, un nom vaut d'où qu'il vienne. Avec, ce canal seul : pour
 * décider si un message mentionne le dirigeant, « c'est moi » se juge sur le
 * canal où le message arrive.
 */
export async function annuaireDesMentions(
  db: TenantDb,
  ids: readonly string[],
  opts: { channelId?: string } = {},
): Promise<Annuaire> {
  const annuaire = new Map<
    string,
    { name: string | null; phone: string | null; isSelf: boolean }
  >();
  if (ids.length === 0) return annuaire;
  const cles = [...new Set(ids)];
  const rows = await db.messagingIdentity.findMany({
    where: {
      ...(opts.channelId ? { channelId: opts.channelId } : {}),
      OR: [{ internalId: { in: cles } }, { phone: { in: cles } }],
    },
    orderBy: { updatedAt: "asc" },
  });
  const voulues = new Set(cles);
  for (const r of rows) {
    for (const cle of [r.internalId, r.phone]) {
      if (!cle || !voulues.has(cle)) continue;
      const deja = annuaire.get(cle);
      annuaire.set(cle, {
        name: r.name ?? deja?.name ?? null,
        phone: r.phone ?? deja?.phone ?? null,
        isSelf: r.isSelf || Boolean(deja?.isSelf),
      });
    }
  }
  return annuaire;
}

/** Ce texte mentionne-t-il le dirigeant, d'après cet annuaire ? */
export function mentionneLeDirigeant(
  texte: string | null | undefined,
  annuaire: Annuaire,
): boolean {
  return idsDesMentions(texte).some((id) => annuaire.get(id)?.isSelf);
}

/**
 * Le texte tel qu'il se LIT : « @Dahmani Eya » à la place des chiffres,
 * « @vous » pour le dirigeant, le numéro quand on n'a que lui. Une mention que
 * l'annuaire ne connaît pas reste telle quelle.
 */
export function ecrireMentions(texte: string, annuaire: Annuaire): string {
  if (annuaire.size === 0) return texte;
  return texte.replace(MENTION, (brut, id: string) => {
    const qui = annuaire.get(id);
    if (!qui) return brut;
    if (qui.isSelf) return MENTION_VOUS;
    if (qui.name) return `@${qui.name}`;
    return qui.phone ? `@+${qui.phone}` : brut;
  });
}

/**
 * Les mêmes textes, mentions résolues — une requête pour tout le lot. Rend
 * aussi les identifiants que l'annuaire ne connaît PAS du tout : l'appelant
 * peut alors aller les chercher chez le fournisseur.
 */
export async function resoudreMentions(
  db: TenantDb,
  textes: readonly (string | null)[],
): Promise<{ textes: (string | null)[]; inconnus: string[] }> {
  const ids = [...new Set(textes.flatMap((t) => idsDesMentions(t)))];
  if (ids.length === 0) return { textes: [...textes], inconnus: [] };
  const annuaire = await annuaireDesMentions(db, ids);
  return {
    textes: textes.map((t) => (t ? ecrireMentions(t, annuaire) : t)),
    inconnus: ids.filter((id) => !annuaire.has(id)),
  };
}
