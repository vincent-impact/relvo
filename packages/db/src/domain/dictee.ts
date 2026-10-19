import { ContactStatus, SubjectStatus } from "../generated/prisma/enums";
import type { TenantDb } from "../tenant";

// LE VOCABULAIRE D'UNE DICTÉE (M22.4) — ce qu'un modèle de transcription a
// besoin de connaître du compte pour écrire JUSTE les noms propres : les
// contacts (prénom, nom, entreprise), les affaires ouvertes (titres), le
// dirigeant et ses secteurs. Une projection EXPLICITE, champ par champ
// (PITFALLS #41), jamais les lignes entières ; rien de nouveau à stocker.
//
// Les plafonds bornent ce qui part dans le prompt : le fournisseur n'en lit
// qu'un court préfixe, et un compte à mille contacts ne doit pas pousser
// mille lignes. Les contacts complets passent avant les contacts
// automatiques (un nom tiré d'une adresse n'aide pas à transcrire) ; les
// affaires les plus actives passent d'abord.

export const DICTATION_VOCABULARY_LIMITS = {
  contacts: 40,
  subjects: 30,
} as const;

export type DictationVocabulary = {
  dirigeant: string;
  secteurs: string[];
  contacts: { prenom: string | null; nom: string; entreprise: string | null }[];
  affaires: string[];
};

export async function getDictationVocabulary(
  db: TenantDb,
  accountId: string,
): Promise<DictationVocabulary> {
  const [account, contacts, subjects] = await Promise.all([
    db.account.findUnique({
      where: { id: accountId },
      select: { firstName: true, lastName: true, sectors: true },
    }),
    db.contact.findMany({
      orderBy: [{ status: "desc" }, { updatedAt: "desc" }],
      take: DICTATION_VOCABULARY_LIMITS.contacts,
      select: {
        firstName: true,
        lastName: true,
        company: true,
        status: true,
      },
    }),
    db.subject.findMany({
      where: { status: SubjectStatus.open },
      orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
      take: DICTATION_VOCABULARY_LIMITS.subjects,
      select: { title: true },
    }),
  ]);
  return {
    dirigeant: account ? `${account.firstName} ${account.lastName}`.trim() : "",
    secteurs: account?.sectors ?? [],
    // `status: desc` met « complete » avant « auto » (ordre de l'énuméré) ;
    // on le revérifie ici plutôt que de dépendre de l'ordre déclaré.
    contacts: [...contacts]
      .sort((a, b) =>
        a.status === b.status
          ? 0
          : a.status === ContactStatus.complete
            ? -1
            : 1,
      )
      .map((c) => ({
        prenom: c.firstName?.trim() || null,
        nom: c.lastName.trim(),
        entreprise: c.company?.trim() || null,
      }))
      .filter((c) => c.nom.length > 0),
    affaires: subjects.map((s) => s.title.trim()).filter((t) => t.length > 0),
  };
}
