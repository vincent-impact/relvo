import { NextResponse } from "next/server";
import {
  cleDeLaQuestion,
  countPendingFileDeletions,
  debutDuJourParis,
  drainFileDeletions,
  getMorningCounters,
  listAssistantAccounts,
  listPushAccounts,
  poserReleveIgnorees,
  tenantDb,
  wasPushSentSince,
} from "@relvo/db";
import { getStorage } from "@relvo/storage";
import { renouvelerLesAbonnements } from "@/server/gmail/abonnement";
import { passerLaDeduplication } from "@/server/deduplication";
import { lancerLectureDesGroupes } from "@/server/ia/pipeline/groupes-du-jour";
import { completerLesPiecesPortees } from "@/server/medias";
import { passerLeNettoyage } from "@/server/nettoyage";
import { notificationDuMatin } from "@/server/push/brief";
import { envoyerNotification } from "@/server/push/envoyer";
import { notifierQuestion } from "@/server/push/questions";
import { expireTenantData } from "@/server/cached";

// Le cron DU MATIN — `0 6 * * *` UTC (7 h en hiver, 8 h en été, heure de
// Paris), déclenché par Vercel Cron (cf. vercel.json). Deux crons au plus sur le
// plan : celui-ci regroupe ce qui se fait le matin.
//
//   0. Le nettoyage (`server/nettoyage`) : les sujets fermés depuis trente
//      jours s'effacent, ce qu'aucun sujet ne porte depuis trente jours expire.
//      EN PREMIER : les fichiers qu'il lâche partent au drainage qui suit.
//      Puis le FILET de la déduplication (M25.8, `server/deduplication`) : un
//      fichier est dédoublonné à l'entrée, ce passage rapproche ce qui s'est
//      croisé — deux exemplaires arrivés au même instant. Il ne lit que la
//      base, et ses fichiers partent au même drainage.
//   1. Le drainage de l'outbox de suppression de fichiers (M4.6) — la route
//      `/api/cron/drain-file-deletions` reste appelable à la main.
//   2. Le brief du matin (M12.7) : pour chaque compte qui a un appareil abonné,
//      les compteurs du jour en une phrase, poussés vers l'accueil. Un calcul,
//      aucune génération ; une fois par jour, le journal fait foi ; rien quand
//      tout est à zéro.
//   3. Les abonnements Gmail (M24.3) : `users.watch` expire en sept jours ; toute
//      boîte du relais dont l'abonnement manque ou expire sous deux jours le
//      repose ici — le webhook le fait aussi au passage, pas de troisième cron.
//   4. Le relevé de ce que Relvo a ignoré (M25.11), LE LUNDI : pour chaque
//      compte dont l'assistant est actif, ce qu'il a mis de côté dans la
//      semaine, par raison, posé dans un échange de Relvo et poussé. Rien
//      quand il n'a rien ignoré ; jamais deux relevés dans la même semaine
//      (le domaine le garantit, le jour n'est qu'un rythme).
//   5. La lecture des groupes (M29.5) — la première des deux du jour, l'autre
//      part du cron de la mi-journée : ce cron ne fait que la LANCER, elle
//      tourne dans sa propre fonction (`/api/groupes/lecture`).
//   6. Le FILET des pièces qu'un sujet porte (M25.5) : celles qui sont encore
//      des références se complètent chez l'agrégateur. Le tri et les gestes
//      de rattachement le font au fil de l'eau ; ce passage rattrape le reste
//      (un rattachement depuis l'échange, une lecture interrompue).
//
// Appelable à la main avec le même secret :
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/matin

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Le relevé se pose le lundi, au jour civil français. */
function estLundiAParis(at: Date): boolean {
  return (
    new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      timeZone: "Europe/Paris",
    }).format(at) === "Mon"
  );
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET non configuré." },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  // Le nettoyage d'abord, sous son budget : un compte non atteint attend
  // demain. Une erreur ici ne prive personne de son brief.
  const nettoyage = await passerLeNettoyage({ budgetMs: 90_000 }).catch((e) => {
    console.error("[cron] matin — nettoyage interrompu", e);
    return null;
  });
  console.info("[cron] matin — nettoyage", nettoyage);

  // Le filet de la déduplication, avant le drainage qui emporte ce qu'il lâche.
  const deduplication = await passerLaDeduplication().catch((e) => {
    console.error("[cron] matin — déduplication interrompue", e);
    return null;
  });
  console.info("[cron] matin — déduplication", deduplication);

  // Une minute de drainage, pas un lot : le nettoyage met des milliers de clés
  // en file d'un coup (PITFALLS #80). Le reste est au brief.
  const drainage = await drainFileDeletions(getStorage(), {
    budgetMs: 60_000,
  });
  const remaining = await countPendingFileDeletions();
  console.info("[cron] matin — drainage", { ...drainage, remaining });

  const now = new Date();
  const depuis = debutDuJourParis(now);
  const briefs = { comptes: 0, envoyes: 0, dejaPartis: 0, silencieux: 0 };
  for (const accountId of await listPushAccounts()) {
    briefs.comptes += 1;
    const db = tenantDb(accountId);
    if (await wasPushSentSince(db, "brief", depuis)) {
      briefs.dejaPartis += 1;
      continue;
    }
    const notification = notificationDuMatin(await getMorningCounters(db, now));
    if (!notification) {
      briefs.silencieux += 1;
      continue;
    }
    const bilan = await envoyerNotification(accountId, notification);
    if (bilan.envoyes > 0) briefs.envoyes += 1;
  }
  console.info("[cron] matin — briefs", briefs);

  const abonnements = await renouvelerLesAbonnements();
  console.info("[cron] matin — abonnements Gmail", abonnements);

  const releves = { comptes: 0, poses: 0, echecs: 0 };
  if (estLundiAParis(now)) {
    for (const accountId of await listAssistantAccounts()) {
      releves.comptes += 1;
      try {
        const q = await poserReleveIgnorees(tenantDb(accountId), now);
        if (!q) continue;
        releves.poses += 1;
        await notifierQuestion(accountId, {
          id: q.id,
          text: q.text,
          echange: cleDeLaQuestion(q),
        }).catch((e) => console.error("[push] relevé non notifié", e));
      } catch (e) {
        // Un compte en erreur ne prive pas les autres de leur relevé.
        releves.echecs += 1;
        console.error("[cron] matin — relevé non posé", { accountId }, e);
      }
    }
    if (releves.poses > 0) expireTenantData();
  }
  console.info("[cron] matin — relevés des ignorées", releves);

  const groupes = await lancerLectureDesGroupes();
  console.info("[cron] matin — lecture des groupes lancée", groupes);

  const pieces = await completerLesPiecesPortees({ budgetMs: 45_000 });
  console.info("[cron] matin — pièces complétées", pieces);

  return NextResponse.json({
    nettoyage,
    deduplication,
    drainage: { ...drainage, remaining },
    briefs,
    abonnements,
    releves,
    groupes,
    pieces,
  });
}
