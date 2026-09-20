import "server-only";
import {
  countCatchupCandidates,
  finishCatchup,
  ingestInboundEmail,
  isAssistantEnabled,
  listCatchupCandidates,
  listDueCatchups,
  listKnownExternalIds,
  recordCatchupError,
  recordCatchupProgress,
  startCatchupRun,
  tenantDb,
  type CatchupStopReason,
} from "@relvo/db";
import { expireTenantData } from "@/server/cached";
import { inferenceDisponible, RATTRAPAGE } from "../config";
import { motifDArret, type EtatRattrapage } from "./rattrapage-regles";
import { stockerPiecesJointes } from "@/server/unipile/attachments";
import { getEmail, listInboxEmails } from "@/server/unipile/client";
import { apiMailToWebhook, toInboundEmail } from "@/server/unipile/map";
import { trierConversationEmail } from "./tri";

// LE RATTRAPAGE DU COURRIER RÉCENT (M7, tranche 9 — M7.19) : « Relvo lit le
// courrier récent la nuit de la connexion ». Demandé à la connexion d'un
// canal e-mail (webhook de fin de connexion), exécuté par le cron nocturne,
// repris la nuit suivante tant que la ligne n'est pas close.
//
// Deux phases, dans cet ordre, sous un budget de temps et deux plafonds :
//   1. IMPORT — les e-mails reçus dans la fenêtre, page par page depuis
//      l'agrégateur ; ceux déjà en base ne sont pas relus ; les autres passent
//      par l'ingestion ordinaire (idempotente) et leurs pièces jointes sont
//      stockées. Zéro jeton.
//   2. TRI — les conversations orphelines de la fenêtre, par salves, par le
//      MÊME pipeline qu'au fil de l'eau (`trierConversationEmail`) mais EN LOT :
//      niveau de service « flex », moitié prix, latence libre. Le tri enchaîne
//      structuration ou relecture comme d'habitude ; le coût de chaque
//      conversation s'additionne au rattrapage.
//
// Ce que le rattrapage garantit, et que rien d'autre ne garantit :
//   • il s'arrête AU PLAFOND — en messages ou en euros — et le dit (statut
//     « arrêté au plafond ») : c'est le cas « import massif » que le
//     disjoncteur redoute (05 §10.6), borné ici avant d'exister ;
//   • il s'arrête au BUDGET DE TEMPS de la fonction et reprend la nuit
//     suivante, jusqu'à `nuitsMax` ; ce qui reste alors est laissé au tri à la
//     main ou au fil de l'eau — jamais un rattrapage qui tourne sans fin ;
//   • un message d'historique arrivé par le webhook est reconnu et laissé ici
//     (`estHistorique`) : jamais trié plein tarif à la volée.
//
// Les règles pures — fenêtre, historique, motif d'arrêt — vivent dans
// `./rattrapage-regles`, sans base, testées ; ce fichier orchestre.

export type BilanRattrapage = {
  catchupId: string;
  channelId: string;
  importes: number;
  tries: number;
  ouverts: number;
  ignores: number;
  coutEur: number;
  /** Ce qui a mis fin à la nuit : plafond, courrier épuisé, budget de temps, erreur. */
  fin: CatchupStopReason | "budget-temps" | "assistant-coupe";
  clos: boolean;
};

type Chrono = { debut: number; budgetMs: number };
const tempsRestant = (c: Chrono) => c.budgetMs - (Date.now() - c.debut);

/**
 * Une NUIT de rattrapage sur un canal : import puis tri, sous le budget de
 * temps ; clôt la ligne quand le courrier est épuisé ou qu'un plafond est
 * atteint, la laisse ouverte sinon.
 */
export async function rattraperCanal(
  due: Awaited<ReturnType<typeof listDueCatchups>>[number],
  chrono: Chrono,
): Promise<BilanRattrapage> {
  const db = tenantDb(due.accountId);
  const bilan: BilanRattrapage = {
    catchupId: due.id,
    channelId: due.channelId,
    importes: 0,
    tries: 0,
    ouverts: 0,
    ignores: 0,
    coutEur: 0,
    fin: "budget-temps",
    clos: false,
  };
  const unipileAccountId = due.channel.config?.externalAccountId ?? null;
  const catchup = await startCatchupRun(db, due.id);

  // L'assistant coupé sur le compte : rien n'est trié — on n'importe pas non
  // plus, le courrier reviendra par la reprise si l'assistant est rallumé.
  if (
    !inferenceDisponible() ||
    !(await isAssistantEnabled(db, due.accountId))
  ) {
    bilan.fin = "assistant-coupe";
    return bilan;
  }

  try {
    // ── 1. Import ─────────────────────────────────────────────────────────
    if (!catchup.importDone && unipileAccountId) {
      let cursor: string | null = null;
      let epuise = false;
      do {
        if (tempsRestant(chrono) < 20_000) break;
        const page = await listInboxEmails({
          accountId: unipileAccountId,
          after: due.since,
          cursor,
          limit: RATTRAPAGE.pageImport,
        });
        cursor = page.cursor;
        const connus = await listKnownExternalIds(db, {
          channelId: due.channelId,
          externalIds: page.items.map((m) => m.id),
        });
        for (const item of page.items) {
          if (connus.has(item.id)) continue;
          if (tempsRestant(chrono) < 15_000) break;
          // La liste ne porte pas toujours le corps : on relit l'e-mail entier.
          const complet =
            item.kind === "2_full" || (item.body ?? item.body_plain)
              ? item
              : await getEmail(item.id);
          if (!complet) continue;
          const mail = apiMailToWebhook({
            ...complet,
            account_id: complet.account_id || unipileAccountId,
          });
          const { message, created } = await ingestInboundEmail(
            db,
            toInboundEmail(mail, due.channelId),
          );
          if (!created) continue;
          bilan.importes += 1;
          if (mail.attachments?.length) {
            await stockerPiecesJointes(db, {
              accountId: due.accountId,
              unipileAccountId,
              emailId: mail.email_id,
              messageId: message.id,
              subjectId: message.subjectId,
              attachments: mail.attachments,
            });
          }
        }
        if (page.items.length < RATTRAPAGE.pageImport || !cursor) epuise = true;
      } while (!epuise);
      if (bilan.importes) {
        await recordCatchupProgress(db, due.id, {
          messagesImported: bilan.importes,
        });
        expireTenantData();
      }
      if (epuise) {
        await recordCatchupProgress(db, due.id, { importDone: true });
      }
    } else if (!unipileAccountId) {
      // Sans compte chez l'agrégateur, rien à importer : on trie ce qui est là.
      await recordCatchupProgress(db, due.id, { importDone: true });
    }

    // ── 2. Tri, en lot ────────────────────────────────────────────────────
    const etat: EtatRattrapage = {
      messagesTriaged: catchup.messagesTriaged,
      costEur: catchup.costEur,
      runs: catchup.runs,
    };
    let arret = motifDArret(etat);
    // Une conversation vue cette nuit ne revient pas : un tri qui échoue sans
    // poser de verdict resterait candidate et tournerait jusqu'au budget.
    const vues: string[] = [];
    while (!arret) {
      if (tempsRestant(chrono) < 30_000) break;
      const candidats = await listCatchupCandidates(db, {
        channelId: due.channelId,
        since: due.since,
        limit: RATTRAPAGE.salveTri,
        exclude: vues,
      });
      if (candidats.length === 0) break;
      const salve = { tries: 0, ouverts: 0, ignores: 0, cout: 0 };
      for (const c of candidats) {
        if (tempsRestant(chrono) < 30_000) break;
        vues.push(c.conversationId);
        const r = await trierConversationEmail({
          accountId: due.accountId,
          conversationId: c.conversationId,
          messageId: c.messageId,
          lot: true,
        });
        salve.tries += 1;
        salve.cout += r.coutEur;
        if (r.issue === "ouvert") salve.ouverts += 1;
        if (
          r.issue === "ignore" ||
          r.issue === "bruit-deterministe" ||
          r.issue === "source-ecartee"
        ) {
          salve.ignores += 1;
        }
        etat.messagesTriaged += 1;
        etat.costEur += r.coutEur;
        arret = motifDArret(etat);
        if (arret) break;
      }
      bilan.tries += salve.tries;
      bilan.ouverts += salve.ouverts;
      bilan.ignores += salve.ignores;
      bilan.coutEur += salve.cout;
      await recordCatchupProgress(db, due.id, {
        messagesTriaged: salve.tries,
        subjectsOpened: salve.ouverts,
        conversationsIgnored: salve.ignores,
        costEur: salve.cout,
      });
    }

    // ── 3. Clôture ────────────────────────────────────────────────────────
    if (arret) {
      await finishCatchup(db, due.id, { status: "capped", reason: arret });
      bilan.fin = arret;
      bilan.clos = true;
    } else {
      const restants = await countCatchupCandidates(db, {
        channelId: due.channelId,
        since: due.since,
      });
      const importFini =
        catchup.importDone ||
        !unipileAccountId ||
        (await db.channelCatchup
          .findFirst({ where: { id: due.id }, select: { importDone: true } })
          .then((x) => x?.importDone ?? false));
      if (restants === 0 && importFini) {
        await finishCatchup(db, due.id, {
          status: "done",
          reason: "courrier-epuise",
        });
        bilan.fin = "courrier-epuise";
        bilan.clos = true;
      } else if (etat.runs >= RATTRAPAGE.nuitsMax) {
        // Dernière nuit permise : ce qui reste est laissé à la main.
        await finishCatchup(db, due.id, {
          status: "capped",
          reason: "nuits-epuisees",
        });
        bilan.fin = "nuits-epuisees";
        bilan.clos = true;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ia] rattrapage interrompu", { catchupId: due.id }, message);
    await recordCatchupError(db, due.id, message).catch(() => undefined);
    bilan.fin = "erreur";
  }
  expireTenantData();
  return bilan;
}

/**
 * La nuit : tous les rattrapages dus, l'un après l'autre, sous un budget de
 * temps global — ce qui n'a pas eu son tour cette nuit l'aura la suivante.
 */
export async function rattraperLesCanauxDus(
  budgetMs: number,
): Promise<BilanRattrapage[]> {
  const debut = Date.now();
  const dus = await listDueCatchups();
  const bilans: BilanRattrapage[] = [];
  for (const due of dus) {
    const restant = budgetMs - (Date.now() - debut);
    if (restant < 45_000) break;
    bilans.push(
      await rattraperCanal(due, { debut: Date.now(), budgetMs: restant }),
    );
  }
  return bilans;
}
