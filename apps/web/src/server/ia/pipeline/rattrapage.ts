import "server-only";
import {
  claimCatchupTranche,
  countCatchupCandidates,
  ensureFolderProposalQuestions,
  findCatchupForTranche,
  finishCatchup,
  ingestInboundEmail,
  isAssistantEnabled,
  listCatchupCandidates,
  listDueCatchups,
  listKnownExternalIds,
  listOpenCatchups,
  poserFinDeLecture,
  recordCatchupError,
  recordCatchupProgress,
  releaseCatchupTranche,
  resumeCatchupAtNight,
  tenantDb,
  type CatchupStopReason,
  type TenantDb,
} from "@relvo/db";
import { expireTenantData } from "@/server/cached";
import { notifierQuestion } from "@/server/push/questions";
import { inferenceDisponible, RATTRAPAGE } from "../config";
import {
  estEnPanne,
  motifDArret,
  peutClore,
  type EtatRattrapage,
} from "./rattrapage-regles";
import { stockerPiecesJointes } from "@/server/unipile/attachments";
import { getEmail, listInboxEmails } from "@/server/unipile/client";
import { apiMailToWebhook, toInboundEmail } from "@/server/unipile/map";
import { trierConversation } from "./tri";

// LE RATTRAPAGE DU COURRIER RÉCENT (M7.19) : « Relvo lit le courrier récent
// DÈS LA CONNEXION ». Demandé à la connexion d'un canal e-mail (webhook de fin
// de connexion), qui lance aussitôt la première TRANCHE ; chaque tranche
// enchaîne la suivante tant que la ligne n'est pas close ; une page qui voit
// une ligne en panne la relance ; le cron nocturne n'est qu'un FILET.
//
// Une tranche, sous le budget de temps de sa fonction :
//   1. IMPORT — les e-mails reçus dans la fenêtre, page par page depuis
//      l'agrégateur ; ceux déjà en base ne sont pas relus ; les autres passent
//      par l'ingestion ordinaire (idempotente) et leurs pièces jointes sont
//      stockées. Zéro jeton. Une passe vide ATTEND un peu et réessaie : on ne
//      sait pas en combien de temps l'agrégateur synchronise l'historique.
//   2. TRI — les conversations orphelines de la fenêtre, du plus récent au
//      plus ancien, par le MÊME pipeline qu'au fil de l'eau
//      (`trierConversation`) : la première seule (elle chauffe le cache,
//      PITFALLS #49), puis plusieurs en parallèle. En direct, au niveau de
//      service standard — le dirigeant regarde ; la nuit, en lot, à moitié prix.
//   3. CLÔTURE ou ENCHAÎNEMENT — courrier épuisé (deux passes vides, assez
//      de temps depuis la demande, plus de candidat), ou garde-fou atteint,
//      ou la tranche suivante.
//
// Ce que le rattrapage garantit, et que rien d'autre ne garantit :
//   • il s'arrête AU GARDE-FOU — en messages, en euros, en tranches — et le
//     dit : c'est le cas « import massif » que le disjoncteur redoute (05
//     §10.6), borné ici avant d'exister ; la nuit reprend ce qui dépasse ;
//   • UNE tranche à la fois par ligne (verrou en base), et une tranche morte
//     ne bloque rien : son verrou expire, la suivante la reprend ;
//   • un message d'historique arrivé par le webhook est reconnu et laissé ici
//     (`estHistorique`) : jamais trié plein tarif à la volée.
//
// Les règles pures — fenêtre, historique, arrêt, clôture, panne — vivent dans
// `./rattrapage-regles`, sans base, testées ; ce fichier orchestre.

export type BilanRattrapage = {
  catchupId: string;
  channelId: string;
  importes: number;
  tries: number;
  ouverts: number;
  ignores: number;
  coutEur: number;
  /** Ce qui a mis fin à la tranche : clôture, garde-fou, budget de temps, erreur, verrou tenu. */
  fin:
    | CatchupStopReason
    | "budget-temps"
    | "assistant-coupe"
    | "verrou-tenu"
    | "enchaine";
  clos: boolean;
};

type Chrono = { debut: number; budgetMs: number };
const tempsRestant = (c: Chrono) => c.budgetMs - (Date.now() - c.debut);
const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Ligne = Awaited<ReturnType<typeof listDueCatchups>>[number];

/**
 * UNE TRANCHE sur une ligne : prend le verrou, importe, trie, puis clôt la
 * ligne ou enchaîne la tranche suivante. `nuit` : le filet — le tri passe en
 * lot, et le garde-fou compte à partir de zéro pour la nuit.
 */
export async function executerTranche(
  due: Ligne,
  chrono: Chrono,
  opts: { nuit?: boolean; enchainer?: boolean } = {},
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

  // Une ligne arrêtée au garde-fou ne se reprend que la nuit, en lot.
  if (due.status === "capped") {
    if (!opts.nuit) {
      bilan.fin = "verrou-tenu";
      return bilan;
    }
    await resumeCatchupAtNight(db, due.id);
  }
  const catchup = await claimCatchupTranche(db, due.id, {
    trancheMaxMs: RATTRAPAGE.trancheMaxMs,
  });
  if (!catchup) {
    bilan.fin = "verrou-tenu";
    return bilan;
  }
  const lot = catchup.serviceLevel === "flex";

  // L'assistant coupé sur le compte : rien n'est trié — on n'importe pas non
  // plus, le courrier reviendra par la reprise si l'assistant est rallumé.
  if (
    !inferenceDisponible() ||
    !(await isAssistantEnabled(db, due.accountId))
  ) {
    await releaseCatchupTranche(db, due.id);
    bilan.fin = "assistant-coupe";
    return bilan;
  }

  let enchainer = false;
  try {
    // ── 1. Import ─────────────────────────────────────────────────────────
    let importDone = catchup.importDone;
    let emptyRounds = catchup.emptyRounds;
    if (!importDone && unipileAccountId) {
      // Des passes tant que le budget le permet : une passe qui importe
      // continue aussitôt, une passe vide attend un peu avant la suivante.
      for (;;) {
        if (tempsRestant(chrono) < 30_000) break;
        const passe = await importerUnePasse(db, due, unipileAccountId, chrono);
        bilan.importes += passe.importes;
        if (passe.importes > 0) {
          emptyRounds = 0;
          await recordCatchupProgress(db, due.id, {
            messagesImported: passe.importes,
            emptyRounds: "reset",
          });
          expireTenantData();
        }
        if (!passe.epuise) continue; // le budget a coupé la passe : on reprend
        if (passe.importes === 0) {
          emptyRounds += 1;
          await recordCatchupProgress(db, due.id, { emptyRounds: "increment" });
        }
        const restants = await countCatchupCandidates(db, {
          channelId: due.channelId,
          since: due.since,
        });
        // L'import se ferme quand les passes vides se suivent et que la
        // demande est assez ancienne — qu'il reste ou non des candidats.
        if (
          peutClore({ emptyRounds, requestedAt: due.requestedAt, restants: 0 })
        ) {
          importDone = true;
          await recordCatchupProgress(db, due.id, {
            importDone: true,
            candidatesTotal: restants + catchup.messagesTriaged,
          });
          break;
        }
        if (restants > 0) break; // on trie ce qui est là, on réimportera à la tranche suivante
        if (tempsRestant(chrono) < RATTRAPAGE.attenteImportMs + 30_000) break;
        await dormir(RATTRAPAGE.attenteImportMs);
      }
    } else if (!unipileAccountId && !importDone) {
      // Sans compte chez l'agrégateur, rien à importer ni à attendre : on trie
      // ce qui est là, et la ligne se clôt dès qu'il n'y a plus de candidat.
      importDone = true;
      emptyRounds = RATTRAPAGE.passesVidesPourClore;
      const restants = await countCatchupCandidates(db, {
        channelId: due.channelId,
        since: due.since,
      });
      await recordCatchupProgress(db, due.id, {
        importDone: true,
        candidatesTotal: restants + catchup.messagesTriaged,
      });
    }

    // ── 2. Tri ────────────────────────────────────────────────────────────
    // La nuit, le garde-fou compte à partir de zéro : le filet lit ce que le
    // direct a laissé, sous le même plafond, jusqu'à `nuitsMax` nuits.
    const etat: EtatRattrapage = opts.nuit
      ? { messagesTriaged: 0, costEur: 0, runs: 0 }
      : {
          messagesTriaged: catchup.messagesTriaged,
          costEur: catchup.costEur,
          runs: catchup.runs,
        };
    let arret = motifDArret(etat);
    // Une conversation vue cette tranche ne revient pas : un tri qui échoue
    // sans poser de verdict resterait candidate et tournerait jusqu'au budget.
    const vues: string[] = [];
    let premiere = true;
    while (!arret) {
      if (tempsRestant(chrono) < 30_000) break;
      const candidats = await listCatchupCandidates(db, {
        channelId: due.channelId,
        since: due.since,
        limit: premiere ? 1 : RATTRAPAGE.salveTri,
        exclude: vues,
      });
      if (candidats.length === 0) break;
      const salve = { tries: 0, ouverts: 0, ignores: 0, cout: 0 };
      const trier = async (c: (typeof candidats)[number]) => {
        vues.push(c.conversationId);
        const r = await trierConversation({
          accountId: due.accountId,
          conversationId: c.conversationId,
          messageId: c.messageId,
          lot,
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
      };
      // La première seule chauffe le cache ; ensuite, par groupes parallèles.
      const largeur = premiere ? 1 : RATTRAPAGE.parallele;
      for (let i = 0; i < candidats.length; i += largeur) {
        if (tempsRestant(chrono) < 30_000) break;
        await Promise.all(candidats.slice(i, i + largeur).map(trier));
        etat.messagesTriaged =
          (opts.nuit ? 0 : catchup.messagesTriaged) + bilan.tries + salve.tries;
        etat.costEur =
          (opts.nuit ? 0 : catchup.costEur) + bilan.coutEur + salve.cout;
        arret = motifDArret(etat);
        if (arret) break;
      }
      premiere = false;
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
      // Les domaines que le courrier propose (M17.10) : dès que deux affaires
      // partagent un nom, la question se pose dans l'échange — sans appel.
      if (salve.ouverts > 0) {
        await ensureFolderProposalQuestions(db).catch((e) =>
          console.error("[ia] propositions de domaine", e),
        );
      }
      expireTenantData();
    }

    // ── 3. Clôture ou enchaînement ───────────────────────────────────────
    // Une ligne qui se clôt POUR DE BON (le courrier est lu, ou plus rien ne
    // la reprendra) pose la question de fin de lecture, qui rappelle le
    // dirigeant (badge, notification — 05 §11.11, invariant 36).
    const finDeLecture = async (ligne: {
      subjectsOpened: number;
      conversationsIgnored: number;
    }) => {
      const q = await poserFinDeLecture(db, { id: due.id, ...ligne });
      if (q) {
        await notifierQuestion(due.accountId, { id: q.id, text: q.text }).catch(
          (e) => console.error("[push] fin de lecture non notifiée", e),
        );
      }
    };
    if (arret) {
      const fini = await finishCatchup(db, due.id, {
        status: "capped",
        reason: arret,
      });
      if (arret === "tranches-epuisees") await finDeLecture(fini);
      bilan.fin = arret;
      bilan.clos = true;
    } else {
      const restants = await countCatchupCandidates(db, {
        channelId: due.channelId,
        since: due.since,
      });
      const cloturable = unipileAccountId
        ? peutClore({ emptyRounds, requestedAt: due.requestedAt, restants })
        : restants === 0;
      if (importDone && cloturable) {
        const fini = await finishCatchup(db, due.id, {
          status: "done",
          reason: "courrier-epuise",
        });
        await finDeLecture(fini);
        bilan.fin = "courrier-epuise";
        bilan.clos = true;
      } else if (opts.nuit && catchup.nightRuns >= RATTRAPAGE.nuitsMax) {
        // Dernière nuit permise : ce qui reste est laissé à la main.
        const fini = await finishCatchup(db, due.id, {
          status: "capped",
          reason: "nuits-epuisees",
        });
        await finDeLecture(fini);
        bilan.fin = "nuits-epuisees";
        bilan.clos = true;
      } else {
        await releaseCatchupTranche(db, due.id);
        enchainer = opts.enchainer ?? true;
        bilan.fin = enchainer ? "enchaine" : "budget-temps";
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ia] tranche interrompue", { catchupId: due.id }, message);
    await recordCatchupError(db, due.id, message).catch(() => undefined);
    await releaseCatchupTranche(db, due.id, { error: message }).catch(
      () => undefined,
    );
    bilan.fin = "erreur";
    // Une erreur n'arrête pas la ligne : la tranche suivante réessaie, et
    // le garde-fou en tranches borne la boucle.
    enchainer = opts.enchainer ?? true;
  }
  expireTenantData();
  if (enchainer) {
    await lancerTranche(due.id).catch((e) =>
      console.error("[ia] tranche suivante non lancée", { id: due.id }, e),
    );
  }
  return bilan;
}

/** Une passe d'import : les pages de l'agrégateur jusqu'à épuisement ou budget. */
async function importerUnePasse(
  db: TenantDb,
  due: Ligne,
  unipileAccountId: string,
  chrono: Chrono,
): Promise<{ importes: number; epuise: boolean }> {
  let importes = 0;
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
      if (tempsRestant(chrono) < 15_000) return { importes, epuise: false };
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
      importes += 1;
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
  return { importes, epuise };
}

/** L'URL de l'application, pour qu'une tranche appelle la suivante. */
function urlApplication(): string {
  return (
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3000"
  );
}

/**
 * LANCE une tranche sur une ligne : un appel à la route de tranche, qui
 * répond aussitôt et travaille après sa réponse — l'appelant n'attend que
 * l'accusé. Même secret que le cron. Sans secret, rien ne part : le filet
 * reprendra la ligne.
 */
export async function lancerTranche(catchupId: string): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[ia] CRON_SECRET absent : tranche non lancée", { catchupId });
    return false;
  }
  const res = await fetch(`${urlApplication()}/api/rattrapage/tranche`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ catchupId }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.error("[ia] tranche refusée", { catchupId, status: res.status });
    return false;
  }
  return true;
}

/** La ligne d'un rattrapage, dans la forme que la tranche attend ; null si elle n'est plus ouverte. */
export function trouverLigne(catchupId: string): Promise<Ligne | null> {
  return findCatchupForTranche(catchupId);
}

/**
 * La REPRISE depuis une page : une ligne ouverte du compte dont aucune tranche
 * ne s'occupe plus est relancée. Appelée après la réponse (`after()`), jamais
 * dans le rendu. Rend les lignes relancées.
 */
export async function relancerLignesEnPanne(
  db: TenantDb,
  maintenant: Date = new Date(),
): Promise<string[]> {
  const lignes = await listOpenCatchups(db);
  const relancees: string[] = [];
  for (const l of lignes) {
    if (!estEnPanne(l, maintenant)) continue;
    if (await lancerTranche(l.id)) relancees.push(l.id);
  }
  return relancees;
}

/**
 * LE FILET, la nuit : les lignes restées ouvertes (une tranche est morte sans
 * relancer la suivante) et celles arrêtées au garde-fou, l'une après l'autre,
 * en lot, sous un budget de temps global — ce qui n'a pas eu son tour cette
 * nuit l'aura la suivante. Aucun enchaînement : la nuit a son propre rythme.
 */
export async function rattraperLesCanauxDus(
  budgetMs: number,
): Promise<BilanRattrapage[]> {
  const debut = Date.now();
  const dus = await listDueCatchups({ nuitsMax: RATTRAPAGE.nuitsMax });
  const bilans: BilanRattrapage[] = [];
  for (const due of dus) {
    const restant = budgetMs - (Date.now() - debut);
    if (restant < 45_000) break;
    bilans.push(
      await executerTranche(
        due,
        { debut: Date.now(), budgetMs: restant },
        { nuit: true, enchainer: false },
      ),
    );
  }
  return bilans;
}
