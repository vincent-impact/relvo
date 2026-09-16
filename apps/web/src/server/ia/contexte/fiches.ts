import { blocMessage, trierParDate, trierParReference } from "./couches";
import type {
  BriefCompte,
  ContactContexte,
  Precedent,
  SujetClos,
  SujetContexte,
} from "./types";

// Les TROIS FICHES et la fiche de CLÔTURE (`05 §10.1`). Elles servent à toutes
// les sollicitations. Tout l'effort de compacité porte ici : la fiche tronque
// selon des règles ÉCRITES (derniers messages, plafond par message), pas selon
// la chance — c'est ainsi que la couche Situation ne dérive pas quand un sujet
// accumule des messages.

/** Derniers messages poussés dans une fiche sujet (« contexte frais borné », `05 §10.1`). */
export const DERNIERS_MESSAGES = 3;
/** Plafond par message dans une fiche (plus serré que pour un fil à trier). */
export const PLAFOND_MESSAGE_FICHE = 1_500;

function ligne(cle: string, valeur: string | null | undefined): string | null {
  return valeur ? `${cle} : ${valeur}` : null;
}

export function ficheSujet(
  s: SujetContexte,
  options: { messages?: number } = {},
): string {
  const n = options.messages ?? DERNIERS_MESSAGES;
  const marqueurs = [
    s.priorite === "urgent" ? "urgent" : null,
    s.enAttente ? "en attente d'un tiers" : null,
    s.resolutionSuggeree
      ? "clôture suggérée par Relvo, pas encore tranchée"
      : null,
  ]
    .filter(Boolean)
    .join(", ");
  const tachesOuvertes = [...s.taches]
    .filter((t) => !t.terminee)
    .sort(
      (a, b) =>
        (a.date ?? "9999").localeCompare(b.date ?? "9999") ||
        a.titre.localeCompare(b.titre, "fr"),
    )
    .map(
      (t) =>
        `- ${t.titre}${t.date ? ` — pour le ${t.date}` : ""} (${t.type}, ${t.source === "relvo" ? "proposée par Relvo" : "posée par le dirigeant"})`,
    );
  const contacts = [...s.contacts]
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
    .map(
      (c) =>
        `- ${c.nom}${c.entreprise ? ` (${c.entreprise})` : ""}${c.role ? ` — ${c.role}` : ""}`,
    );
  const messages = trierParDate(s.messages);
  const derniers = messages.slice(-n);
  const omis = messages.length - derniers.length;
  return [
    `# Sujet ${s.reference} · ${s.titre}`,
    [
      ligne("Domaine", s.domaine ?? "sans domaine"),
      ligne(
        "Étiquettes",
        s.etiquettes.length ? [...s.etiquettes].sort().join(", ") : null,
      ),
      ligne("Statut", s.statut),
      ligne("Marqueurs", marqueurs || null),
      ligne("Ouvert le", s.ouvertLe.slice(0, 10)),
    ]
      .filter(Boolean)
      .join("\n"),
    ``,
    `## Situation`,
    [
      ligne("Où on en est", s.situation.ouOnEnEst),
      ligne("Prochaine étape", s.situation.prochaineEtape),
      ligne("On attend", s.situation.attente),
      ligne("Échéance qui compte", s.situation.echeance),
    ]
      .filter(Boolean)
      .join("\n") || `Pas encore de situation structurée.`,
    ...(s.resume ? [``, `## Résumé`, s.resume] : []),
    ``,
    `## Tâches ouvertes`,
    tachesOuvertes.length ? tachesOuvertes.join("\n") : `Aucune.`,
    ``,
    `## Contacts`,
    contacts.length ? contacts.join("\n") : `Aucun contact rattaché.`,
    ``,
    `## Derniers messages${omis > 0 ? ` (${omis} plus ancien${omis > 1 ? "s" : ""} non montré${omis > 1 ? "s" : ""})` : ""}`,
    derniers.length
      ? derniers
          .map((m, i) => blocMessage(m, omis + i, PLAFOND_MESSAGE_FICHE))
          .join("\n")
      : `Aucun message.`,
  ].join("\n");
}

export function ficheContact(c: ContactContexte): string {
  const antecedents = [...c.antecedentsTri]
    .sort((a, b) => b.nombre - a.nombre || a.raison.localeCompare(b.raison))
    .map((a) => `${a.raison} ×${a.nombre}`)
    .join(", ");
  return [
    `# Contact · ${c.nom}${c.entreprise ? ` (${c.entreprise})` : ""}`,
    ...(c.aCompleter
      ? [
          `Fiche AUTOMATIQUE, créée à l'ouverture depuis l'adresse d'envoi : le nom peut être une adresse. Déduis prénom, nom, entreprise et rôle de la signature ou du corps du message, et renvoie-les dans « contact ».`,
          ...(c.signature
            ? [`Signature du dernier message :`, c.signature]
            : []),
        ]
      : []),
    [
      ligne("Rôle", c.role),
      ligne("Note de Relvo", c.noteRelvo),
      ligne("Domaine habituel", c.domaineHabituel),
      ligne(
        "Délai de réponse constaté",
        c.delaiReponseJours === null
          ? null
          : `${c.delaiReponseJours} jour${c.delaiReponseJours > 1 ? "s" : ""}`,
      ),
      ligne("Antécédents de tri", antecedents || null),
    ]
      .filter(Boolean)
      .join("\n"),
    ``,
    `## Sujets ouverts avec ce contact`,
    c.sujetsOuverts.length
      ? trierParReference(c.sujetsOuverts)
          .map((s) => `- ${s.reference} · ${s.titre}`)
          .join("\n")
      : `Aucun.`,
    ``,
    `## Derniers sujets validés`,
    c.derniersValides.length
      ? trierParReference(c.derniersValides)
          .map((s) => `- ${s.reference} · ${s.titre}`)
          .join("\n")
      : `Aucun.`,
  ].join("\n");
}

/** Brief du compte — compteurs déjà en cache, pour l'échange seulement. */
export function briefCompte(b: BriefCompte): string {
  const urgents = trierParReference(b.sujetsUrgents).map(
    (s) => `- ${s.reference} · ${s.titre}`,
  );
  return [
    `# Aujourd'hui sur le compte`,
    `Sujets ouverts : ${b.sujetsOuverts} · tâches du jour : ${b.tachesDuJour} · en retard : ${b.tachesEnRetard} · conversations à trier : ${b.conversationsATrier}`,
    `## Sujets urgents`,
    urgents.length ? urgents.join("\n") : `Aucun.`,
  ].join("\n");
}

/** Fiche de clôture d'un sujet validé — fabriquée SANS appel, réutilisée comme précédent. */
export function ficheCloture(s: SujetClos): string {
  const jours = Math.max(
    0,
    Math.round((Date.parse(s.valideLe) - Date.parse(s.ouvertLe)) / 86_400_000),
  );
  const realisees = [...s.tachesRealisees]
    .sort(
      (a, b) =>
        (a.termineeLe ?? "").localeCompare(b.termineeLe ?? "") ||
        a.titre.localeCompare(b.titre, "fr"),
    )
    .map(
      (t, i) =>
        `${i + 1}. ${t.titre}${t.source === "relvo" ? "" : " (posée par le dirigeant)"}`,
    );
  const ecartees = [...s.tachesEcartees]
    .sort((a, b) => a.titre.localeCompare(b.titre, "fr"))
    .map((t) => `- ${t.titre}`);
  return [
    `# Précédent ${s.reference} · ${s.titre}`,
    [
      ligne("Domaine", s.domaine ?? "sans domaine"),
      ligne(
        "Étiquettes",
        s.etiquettes.length ? [...s.etiquettes].sort().join(", ") : null,
      ),
      `Durée : ${jours} jour${jours > 1 ? "s" : ""} (du ${s.ouvertLe.slice(0, 10)} au ${s.valideLe.slice(0, 10)})`,
      ligne("Ce que c'était", s.situationFinale.ouOnEnEst ?? s.resume),
    ]
      .filter(Boolean)
      .join("\n"),
    `## Tâches réalisées, dans l'ordre`,
    realisees.length ? realisees.join("\n") : `Aucune.`,
    ...(ecartees.length
      ? [`## Tâches proposées par Relvo et écartées`, ...ecartees]
      : []),
  ].join("\n");
}

/** Les précédents : tous les titres, seules les fiches des plus proches (`05 §10.1`). */
export function blocPrecedents(
  precedents: readonly Precedent[],
  fichesMax = 3,
): string {
  const tries = trierParReference(precedents);
  const titres = tries.map((p) => `- ${p.reference} · ${p.titre}`);
  const fiches = tries
    .filter((p) => p.fiche)
    .slice(0, fichesMax)
    .map((p) => p.fiche!);
  return [
    `# Précédents du domaine`,
    titres.length ? titres.join("\n") : `Aucun sujet validé dans ce domaine.`,
    ...(fiches.length ? [``, ...fiches] : []),
  ].join("\n");
}
