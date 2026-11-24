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
import { notificationDuMatin } from "@/server/push/brief";
import { envoyerNotification } from "@/server/push/envoyer";
import { notifierQuestion } from "@/server/push/questions";
import { expireTenantData } from "@/server/cached";

// Le cron DU MATIN — `0 6 * * *` UTC (7 h en hiver, 8 h en été, heure de
// Paris), déclenché par Vercel Cron (cf. vercel.json). Deux crons au plus sur le
// plan : celui-ci regroupe ce qui se fait le matin.
//
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
//
// Appelable à la main avec le même secret :
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/matin

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  const drainage = await drainFileDeletions(getStorage());
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

  return NextResponse.json({
    drainage: { ...drainage, remaining },
    briefs,
    abonnements,
    releves,
  });
}
