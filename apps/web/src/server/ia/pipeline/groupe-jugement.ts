import {
  IGNORE_REASON_OF_NATURE,
  getTriageProjection,
  ignoreConversation,
  isAssistantEnabled,
  logAiSolicitation,
  logTriageFailure,
  noterIdentites,
  recordTriageVerdict,
  tenantDb,
} from "@relvo/db";
import { listChatAttendees } from "../../unipile/client";
import { identiteDuParticipant } from "../../unipile/map";
import { EchecSollicitation, extract } from "../client";
import { inferenceDisponible, NIVEAU_RETENU } from "../config";
import { contexteTri, prefixeStable } from "../contexte";
import { SortieTri } from "../schemas";
import { NATURE_EN_BASE, avisEnBase, deciderGroupe } from "./decision";
import type { ResultatTri } from "./tri";

// LE GROUPE SE JUGE, UNE FOIS (M29.3). Un groupe WhatsApp n'est pas trié au
// fil de l'eau ; mais le laisser « sans avis » parmi des centaines, c'est
// laisser le dirigeant trier à la main le foot du jeudi et la famille. Relvo
// dit donc de quoi le groupe relève — sur son TITRE d'abord, qui se lit comme
// l'objet d'un e-mail, puis sa taille et ses derniers messages :
//
//   · hors du champ professionnel, et sans aucun doute → le groupe est IGNORÉ,
//     avec sa raison (et ignorer, c'est ne plus importer — M25.9) ;
//   · professionnel, ou le moindre doute → il RESTE, avec l'avis de Relvo.
//
// Une seule fois : un groupe qui porte déjà un avis n'est pas rejugé. C'est le
// même appel que le tri (même consigne, même cache, même compteur), avec un
// cadrage qui dit qu'on juge un groupe et non un message.
//
// Ce fichier ne dépend ni de Next ni de `server-only` : le script du stock
// (`scripts/ia/juger-groupes.ts`) le charge tel quel. L'application passe par
// `./groupe`, qui périme en plus les données en cache.

/** Ce que le jugement d'un groupe a conclu — lisible sans rien avoir écrit. */
export type JugementGroupe = {
  nature: SortieTri["nature"];
  confiance: SortieTri["confiance"];
  ignore: boolean;
  raison: string;
};

export async function jugerLeGroupe(args: {
  accountId: string;
  conversationId: string;
  /** En LOT (le stock des groupes déjà connus) : tarif différé, latence libre. */
  lot?: boolean;
  /** SIMULATION : le modèle juge, RIEN n'est écrit ni demandé à l'agrégateur. */
  simuler?: boolean;
}): Promise<ResultatTri & { groupe?: JugementGroupe }> {
  const { accountId, conversationId } = args;
  const db = tenantDb(accountId);

  if (!inferenceDisponible())
    return { issue: "inference-indisponible", coutEur: 0 };
  if (!(await isAssistantEnabled(db, accountId)))
    return { issue: "desactive", coutEur: 0 };

  const projection = await getTriageProjection(db, conversationId);
  if (projection.type !== "whatsapp_group")
    return { issue: "canal-non-couvert", coutEur: 0 };
  if (projection.dejaJuge) return { issue: "deja-traite", coutEur: 0 };
  // Ignoré, ou suivi par un sujet : il n'y a plus rien à juger.
  if (!projection.orpheline) return { issue: "non-orpheline", coutEur: 0 };
  const entrant = projection.dernierEntrant;
  if (!entrant) return { issue: "sans-message-entrant", coutEur: 0 };
  const messageId = entrant.id;

  try {
    const membres = args.simuler ? null : await membresDuGroupe(args);
    const contexte = contexteTri({
      compte: projection.compte,
      conversation: {
        canal: "whatsapp",
        groupe: true,
        decouverte: { titre: projection.titre, membres },
        messages: projection.conversation.messages,
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
      lot: args.lot ?? false,
    });
    const decision = deciderGroupe(sortie);
    const groupe: JugementGroupe = {
      nature: sortie.nature,
      confiance: sortie.confiance,
      ignore: decision.type === "ignorer",
      raison: decision.avis.raison,
    };
    const coutEur = mesure.cout.eur;
    if (args.simuler)
      return { issue: "avis-seul", detail: "simule", coutEur, groupe };

    await logAiSolicitation(db, { ...mesure, messageId, conversationId });
    await recordTriageVerdict(db, {
      conversationId,
      messageId,
      ...avisEnBase(decision.avis),
      source: "model",
      proposal: sortie,
    });
    if (decision.type === "ignorer") {
      await ignoreConversation(db, conversationId, {
        reason: IGNORE_REASON_OF_NATURE[NATURE_EN_BASE[sortie.nature]],
        note: decision.avis.raison,
        actor: "ai",
      });
    }
    return decision.type === "ignorer"
      ? { issue: "ignore", detail: sortie.nature, coutEur, groupe }
      : { issue: "avis-seul", detail: "groupe-garde", coutEur, groupe };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[ia] jugement du groupe interrompu",
      conversationId,
      message,
    );
    if (!args.simuler) {
      try {
        const echec = err instanceof EchecSollicitation ? err : null;
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
    return { issue: "echec", detail: message, coutEur: 0 };
  }
}

/**
 * Combien sont-ils dans ce groupe ? La liste des participants le dit — et
 * nourrit au passage l'annuaire des identifiants (M29.1) : c'est là que Relvo
 * apprend lequel est le dirigeant, avant la première mention. Null si le
 * fournisseur ne répond pas : le groupe se juge sans.
 */
async function membresDuGroupe(args: {
  accountId: string;
  conversationId: string;
}): Promise<number | null> {
  const db = tenantDb(args.accountId);
  const fil = await db.conversation.findFirst({
    where: { id: args.conversationId },
    select: { channelId: true, externalThreadId: true },
  });
  if (!fil?.externalThreadId) return null;
  try {
    const participants = await listChatAttendees(fil.externalThreadId);
    await noterIdentites(
      db,
      fil.channelId,
      participants.map(identiteDuParticipant),
    );
    return participants.length || null;
  } catch (err) {
    console.warn("[ia] participants du groupe illisibles", err);
    return null;
  }
}
