import {
  IGNORE_REASON_OF_NATURE,
  applyTriageMatter,
  getTriageProjection,
  ignoreConversation,
  isAssistantEnabled,
  logAiSolicitation,
  logTriageFailure,
  noterLectureSansSuite,
  recordTriageVerdict,
  rendreLectureGroupe,
  reserverLectureGroupe,
  tenantDb,
} from "@relvo/db";
import { EchecSollicitation, extract } from "../client";
import { inferenceDisponible, LECTURE_GROUPES, NIVEAU_RETENU } from "../config";
import { contexteTri, prefixeStable } from "../contexte";
import { FIL_LECTURE } from "../contexte/couches";
import { SortieTri } from "../schemas";
import {
  NATURE_EN_BASE,
  type Nature,
  avisEnBase,
  deciderLectureGroupe,
  type DecisionTri,
} from "./decision";
import { assezDAvisPourIgnorer } from "./messagerie-regles";
import { estHistorique } from "./rattrapage-regles";
import type { ResultatTri } from "./tri";

// LA LECTURE DU JOUR D'UN GROUPE (M29.5). Un groupe WhatsApp gardé, qu'aucun
// sujet n'écoute, n'est pas trié message par message : deux fois par jour,
// Relvo lit ce qui s'y est dit depuis sa dernière lecture et en tire une des
// quatre suites —
//
//   · OUVRIR un sujet (« à traiter », confiance haute) : il écoute le groupe
//     depuis le premier message lu, et le groupe se suit dès lors en direct
//     (M29.6) jusqu'à ce que le sujet soit validé ou fermé ;
//   · RATTACHER à un sujet ouvert que ce qui se dit prolonge ;
//   · NE RIEN FAIRE : la lecture est notée au journal, et l'avis que porte
//     le groupe — celui de son jugement — NE BOUGE PAS : un « merci » ne fait
//     pas afficher « à ignorer » sur le groupe de l'équipe ;
//   · IGNORER le groupe : seulement au bout d'une SÉRIE de lectures hors du
//     champ professionnel, toutes sûres (`MESSAGERIE.verdictsAvantIgnorance`) —
//     une équipe qui parle du déjeuner un midi ne fait pas taire son groupe.
//
// Un doute (« à considérer », ou « à traiter » sous la frontière) écrit l'avis
// sur le groupe : le dirigeant le voit dans la liste à trier, avec sa raison.
//
// C'est le même appel que le tri (même consigne, même cache, même compteur),
// cadré « un groupe lu depuis la dernière fois », au tarif différé. Le repère
// de lecture est RÉSERVÉ avant l'appel et RENDU s'il échoue : deux passes
// simultanées ne lisent pas le même groupe, et un échec ne perd aucun message.
//
// Ce fichier ne dépend ni de Next ni de `server-only` : le script de
// simulation (`scripts/ia/lire-groupes.ts`) le charge tel quel. L'application
// passe par `./groupes-du-jour`, qui enchaîne la structuration, la relecture
// et la notification.

/** La nature en base, dite dans les mots du schéma de tri. */
const NATURE_DU_SCHEMA = Object.fromEntries(
  Object.entries(NATURE_EN_BASE).map(([schema, base]) => [base, schema]),
) as Record<(typeof NATURE_EN_BASE)[Nature], Nature>;

/** Ce que la lecture a conclu — lisible sans rien avoir écrit. */
export type LectureGroupe = {
  action: SortieTri["action"];
  nature: SortieTri["nature"];
  confiance: SortieTri["confiance"];
  raison: string;
  titre: string | null;
  /** Ce que la lecture fait (ou ferait) du groupe. */
  suite: DecisionTri["type"];
  /** Un « rien à faire » sûr hors du champ professionnel : un pas vers l'ignorance du groupe. */
  versIgnorance: boolean;
  /** Messages montrés au modèle. */
  messages: number;
};

export type ResultatLecture = ResultatTri & {
  lecture?: LectureGroupe;
  /** Le sujet ouvert ou rejoint : l'appelant enchaîne la structuration ou la relecture. */
  sujet?: { id: string; ouvert: boolean; messageId: string };
};

export async function lireLeGroupe(args: {
  accountId: string;
  conversationId: string;
  /** Les messages créés après cette date sont ceux à lire. */
  depuis: Date;
  /** Le repère en base au moment où le groupe a été listé (null avant la première lecture). */
  luJusqua: Date | null;
  /** Tarif différé — le défaut : cette lecture n'attend personne. */
  lot?: boolean;
  /** SIMULATION : le modèle lit, RIEN n'est écrit ni réservé. */
  simuler?: boolean;
  /**
   * Le garde-fou des sujets (`LECTURE_GROUPES.sujetsParLecture`) : appelé au
   * moment d'OUVRIR, il prend une place et dit s'il en restait une. Sans lui,
   * la lecture ouvre toujours.
   */
  prendreUnSujet?: () => boolean;
}): Promise<ResultatLecture> {
  const { accountId, conversationId } = args;
  const db = tenantDb(accountId);

  if (!inferenceDisponible())
    return { issue: "inference-indisponible", coutEur: 0 };
  if (!(await isAssistantEnabled(db, accountId)))
    return { issue: "desactive", coutEur: 0 };

  const projection = await getTriageProjection(db, conversationId, {
    apres: args.depuis,
    plafond: FIL_LECTURE.derniers,
  });
  if (projection.type !== "whatsapp_group")
    return { issue: "canal-non-couvert", coutEur: 0 };
  // Ignoré entre-temps, ou un sujet l'écoute désormais : ce n'est plus à lire ici.
  if (!projection.orpheline) return { issue: "non-orpheline", coutEur: 0 };
  const connecteLe = projection.connecteLe;
  if (!connecteLe) return { issue: "historique", coutEur: 0 };
  const jusqua = projection.fenetre?.jusqua ?? null;
  if (!jusqua) return { issue: "sans-message-entrant", coutEur: 0 };

  // L'historique que l'agrégateur rejoue à une reconnexion n'est pas du
  // courrier vivant : il n'est ni montré ni compté.
  const montres = projection.conversation.messages.filter(
    (m) => !estHistorique(m.recuLe, connecteLe),
  );
  const vivants = montres.filter((m) => m.sens === "entrant" && m.orphelin);
  const reservation = { conversationId, de: args.luJusqua, a: jusqua };

  if (vivants.length === 0) {
    // Rien de vivant dans la fenêtre : elle est passée, sans appel.
    if (!args.simuler) await reserverLectureGroupe(db, reservation);
    return { issue: "sans-message-entrant", coutEur: 0 };
  }
  if (!args.simuler && !(await reserverLectureGroupe(db, reservation))) {
    return { issue: "deja-traite", coutEur: 0 };
  }

  // Le dernier message vivant porte l'entrée de journal ; le plus ancien
  // message sans sujet que Relvo a lu est celui où l'écoute commencerait.
  const messageId = vivants.at(-1)!.id;
  const ancre =
    [...montres]
      .filter((m) => m.orphelin)
      .sort(
        (a, b) =>
          Date.parse(a.recuLe) - Date.parse(b.recuLe) ||
          a.id.localeCompare(b.id),
      )[0]?.id ?? messageId;

  try {
    const contexte = contexteTri({
      compte: projection.compte,
      conversation: {
        canal: "whatsapp",
        groupe: true,
        lecture: {
          titre: projection.titre,
          omis: projection.fenetre?.omis ?? 0,
          nature: projection.natureConnue
            ? NATURE_DU_SCHEMA[projection.natureConnue]
            : null,
        },
        messages: montres,
      },
      instant: { maintenant: new Date().toISOString() },
    });
    const { sortie, mesure } = await extract({
      sollicitation: "tri",
      schema: SortieTri,
      nomSchema: "verdict_de_tri",
      system: contexte.system,
      prompt: contexte.prompt,
      reasoning: NIVEAU_RETENU.extraction,
      cacheCle: accountId,
      prefixeStable: prefixeStable(contexte),
      lot: args.lot ?? true,
      abortSignal: AbortSignal.timeout(LECTURE_GROUPES.appelMaxMs),
    });
    const coutEur = mesure.cout.eur;
    const { decision, sansSuite } = deciderLectureGroupe(sortie);
    const avis = avisEnBase(sortie);
    const lecture: LectureGroupe = {
      action: sortie.action,
      nature: sortie.nature,
      confiance: sortie.confiance,
      raison: avis.reason,
      titre: decision.type === "ouvrir" ? decision.titre : null,
      suite: decision.type === "ignorer" ? "avis-seul" : decision.type,
      versIgnorance: decision.type === "ignorer",
      messages: montres.length,
    };
    if (args.simuler)
      return { issue: "avis-seul", detail: "simule", coutEur, lecture };

    await logAiSolicitation(db, { ...mesure, messageId, conversationId });
    if (sansSuite) {
      await noterLectureSansSuite(db, {
        conversationId,
        messageId,
        ...avis,
        proposal: sortie,
      });
      return { issue: "avis-seul", detail: "sans-suite", coutEur, lecture };
    }
    const { noiseStreak } = await recordTriageVerdict(db, {
      conversationId,
      messageId,
      ...avis,
      source: "model",
      proposal: sortie,
    });

    if (decision.type === "avis-seul") {
      return { issue: "avis-seul", detail: decision.motif, coutEur, lecture };
    }
    if (decision.type === "ignorer") {
      if (!assezDAvisPourIgnorer({ canal: "whatsapp", serie: noiseStreak })) {
        return {
          issue: "avis-seul",
          detail: "serie-trop-courte",
          coutEur,
          lecture,
        };
      }
      await ignoreConversation(db, conversationId, {
        reason: IGNORE_REASON_OF_NATURE[NATURE_EN_BASE[decision.nature]],
        note: decision.raison,
        actor: "ai",
      });
      return {
        issue: "ignore",
        detail: decision.nature,
        coutEur,
        lecture: { ...lecture, suite: "ignorer" },
      };
    }

    if (decision.type === "ouvrir" && args.prendreUnSujet?.() === false) {
      // Assez de sujets pour cette lecture : l'avis « à traiter » est écrit
      // sur le groupe, le dirigeant ouvrira lui-même ce qu'il veut suivre.
      return {
        issue: "avis-seul",
        detail: "plafond-de-sujets",
        coutEur,
        lecture: { ...lecture, suite: "avis-seul" },
      };
    }

    const applied = await applyTriageMatter(db, {
      conversationId,
      messageId,
      title: decision.type === "ouvrir" ? decision.titre : null,
      folderName: decision.domaine,
      proposedFolder: decision.domainePropose,
      existingSubjectReference:
        decision.type === "rattacher" ? decision.sujetExistant : null,
      priority: decision.priorite,
      anchorMessageId: ancre,
    });
    const ouvert = applied.action === "opened";
    return {
      issue: ouvert ? "ouvert" : "rattache",
      detail: applied.reference,
      coutEur,
      lecture: { ...lecture, suite: ouvert ? "ouvrir" : "rattacher" },
      sujet: { id: applied.subjectId, ouvert, messageId },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[ia] lecture du groupe interrompue",
      conversationId,
      message,
    );
    const echec = err instanceof EchecSollicitation ? err : null;
    if (!args.simuler) {
      try {
        // Les messages restent à lire : la prochaine lecture les reprendra.
        await rendreLectureGroupe(db, reservation);
        if (echec?.mesure) {
          await logAiSolicitation(db, {
            ...echec.mesure,
            messageId,
            conversationId,
          });
        }
        await logTriageFailure(db, {
          conversationId,
          messageId,
          error: message,
          cause: echec?.motif ?? null,
        });
      } catch (e) {
        console.error("[ia] échec non journalisé", e);
      }
    }
    return {
      issue: "echec",
      detail: message,
      coutEur: echec?.mesure?.cout.eur ?? 0,
    };
  }
}
