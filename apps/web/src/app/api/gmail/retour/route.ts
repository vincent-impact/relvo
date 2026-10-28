import {
  completeChannelConnection,
  ensureOnboardingQuestions,
  isDomainError,
  requestChannelCatchup,
  resolveMailboxStep,
} from "@relvo/db";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { expireTenantData } from "@/server/cached";
import { type MotifDeRetour, pageDeRetour } from "@/server/courrier/retour";
import { getCurrentAccountId } from "@/server/auth-context";
import { tenantDb } from "@/lib/tenant-db";
import { lancerTranche } from "@/server/ia/pipeline/rattrapage";
import { fenetreDeRattrapage } from "@/server/ia/pipeline/rattrapage-regles";
import { reprendreEtat } from "@/server/gmail/etat";
import { poserLAbonnement } from "@/server/gmail/abonnement";
import { donneesDepuisJetons } from "@/server/gmail/jetons";
import {
  adresseDuJeton,
  echangerLeCode,
  perimetresManquants,
} from "@/server/gmail/oauth";

// Le RETOUR du consentement Google (M24.2). Google ramène le navigateur ici
// avec un `code` et le `state` du départ. Hors du proxy (`/api/*`) : la
// session se lit ici, et l'état du départ doit répondre dans le cookie de ce
// navigateur — sans l'un ou l'autre, rien n'est écrit. Puis : le code contre
// les jetons, l'adresse de la boîte, le canal finalisé par le domaine, l'étape
// « première boîte » de la prise en main fermée (05 §11.11), et la page de
// retour, qui dit le résultat.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const etat = await reprendreEtat(url.searchParams.get("state"));
  const accountId = await getCurrentAccountId();
  if (!accountId) return redirigerVers("/connexion");
  if (!etat) return retour("canaux", "perdu");

  if (url.searchParams.get("error")) {
    // `access_denied` : l'utilisateur a refusé — ou fermé. Rien n'est écrit,
    // le canal préparé se reprend depuis la page (#70).
    return retour(etat.retour, "refus");
  }
  const code = url.searchParams.get("code");
  if (!code) return retour(etat.retour, "google");

  try {
    const jetons = await echangerLeCode(code);
    if (perimetresManquants(jetons.perimetres).length > 0) {
      return retour(etat.retour, "perimetres");
    }
    const adresse = await adresseDuJeton(jetons.acces);
    if (etat.adresse && etat.adresse !== adresse) {
      return retour(etat.retour, "autre-boite");
    }
    const db = tenantDb(accountId);
    const canal = await db.channel.findFirst({
      where: { id: etat.channelId },
      select: { config: { select: { connectionData: true } } },
    });
    const existantes = canal?.config?.connectionData;
    await completeChannelConnection(db, etat.channelId, {
      externalAccountId: adresse,
      identifier: adresse,
      connectionData: donneesDepuisJetons(
        jetons,
        existantes && typeof existantes === "object"
          ? (existantes as Record<string, unknown>)
          : null,
      ),
    });
    // La boîte confiée ferme l'étape « première boîte » : c'est la connexion
    // qui vaut réponse, jamais le clic ; les étapes qui restent se posent.
    await resolveMailboxStep(db, adresse);
    await ensureOnboardingQuestions(db, accountId);
    // La boîte publie ses changements dès maintenant (M24.3). Sans sujet
    // configuré, ou si Google refuse, la connexion tient quand même : le cron
    // du matin reposera l'abonnement.
    try {
      await poserLAbonnement(adresse);
    } catch (err) {
      console.error(
        "[gmail] abonnement non posé à la connexion",
        { adresse },
        err,
      );
    }
    // La lecture des deux dernières semaines (M24.4), demandée à la
    // connexion comme chez l'agrégateur, et la première tranche part
    // aussitôt. Pas à une reconnexion : la boîte a déjà sa lecture — ou sa
    // migration (M24.9), qui décidera.
    if (!etat.adresse) {
      try {
        const catchup = await requestChannelCatchup(db, {
          channelId: etat.channelId,
          since: fenetreDeRattrapage(),
        });
        await lancerTranche(catchup.id);
      } catch (err) {
        console.error("[gmail] lecture non lancée", { adresse }, err);
      }
    }
  } catch (err) {
    if (isDomainError(err)) {
      console.warn("[gmail] connexion refusée", {
        channelId: etat.channelId,
        code: err.code,
        message: err.message,
      });
      return retour(
        etat.retour,
        err.code === "CONFLICT" ? "deja-reliee" : "google",
      );
    }
    console.error(
      "[gmail] retour en échec",
      { channelId: etat.channelId },
      err,
    );
    return retour(etat.retour, "google");
  }
  revalidatePath("/canaux");
  revalidatePath("/relvo");
  expireTenantData();
  return redirigerVers(pageDeRetour(etat.retour, { connected: true }));
}

function retour(page: "canaux" | "relvo", erreur: MotifDeRetour) {
  return redirigerVers(pageDeRetour(page, { erreur }));
}

function redirigerVers(chemin: string) {
  const base =
    process.env.AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3000";
  return NextResponse.redirect(new URL(chemin, base), 303);
}
