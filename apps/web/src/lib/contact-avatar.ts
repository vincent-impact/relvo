import { Building2, User, Users, type LucideIcon } from "lucide-react";

// Avatar d'un interlocuteur (2026-07-24). Un contact ENREGISTRÉ → ses initiales
// (lettres). Un interlocuteur NON enregistré → une icône selon son type deviné :
// personne (défaut), entreprise (messages automatisés / raisons sociales) ou
// groupe. Le fond reste le même (marron) : c'est la forme qui distingue.
//
// ⚠️ Heuristique volontairement simple : « analyser le type de contact » est un
// travail que l'IA fera mieux (M7). En attendant, on repère les adresses de
// notification et les suffixes de société ; sinon on suppose une personne.

export type AvatarKind = "person" | "company" | "group";

const COMPANY_RE =
  /(no[-_. ]?reply|noreply|donotreply|do[-_. ]?not[-_. ]?reply|ne[-_. ]?pas[-_. ]?repondre|nepasrepondre|notification|newsletter|mailer|mailing|no-?reply|@(?:info|contact|hello|bonjour|support|service|sales|team|ventes)[.@]|\b(?:sarl|sas|sasu|sa|eurl|inc|ltd|llc|gmbh|corp|co|group|groupe|company|société|societe)\b)/i;

function looksLikeCompany(...values: (string | null | undefined)[]): boolean {
  return values.some((v) => (v ? COMPANY_RE.test(v) : false));
}

export function guessContactKind({
  isGroup = false,
  name,
  raw,
}: {
  isGroup?: boolean;
  name?: string | null;
  raw?: string | null;
}): AvatarKind {
  if (isGroup) return "group";
  if (looksLikeCompany(raw, name)) return "company";
  return "person";
}

export function avatarIconFor(kind: AvatarKind): LucideIcon {
  return kind === "group" ? Users : kind === "company" ? Building2 : User;
}
