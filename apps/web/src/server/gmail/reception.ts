import { type Boite, recevoirCourrier } from "@/server/courrier";
import { jetonDAcces } from "./acces";
import { poserLAbonnement } from "./abonnement";
import { doitRenouveler } from "./abonnement-regles";
import { historiqueDepuis, lireMessage } from "./api";
import { courrierDepuisGmail } from "./courrier";
import { donneesDeLaBoite, ecrireDonnees } from "./donnees";
import { fournisseurGmail } from "./fournisseur";

// LA RÉCEPTION, incrémentale par `historyId` (M24.3). La notification ne porte
// que l'adresse et un numéro ; on relit l'historique depuis le DERNIER numéro
// retenu — pas depuis celui de la notification —, puis chaque message ajouté,
// et chacun suit le même chemin que chez l'agrégateur (`recevoirCourrier`).
// Une notification perdue ne perd rien : la suivante reprend au dernier
// numéro. Deux notifications à la fois relisent le même bout d'historique ;
// l'ingestion est idempotente, rien n'entre deux fois.

export type BilanNotification = {
  ignore: string | null;
  messages: number;
  entres: number;
  abonnementRenouvele: boolean;
};

export async function recevoirNotification(notification: {
  emailAddress: string;
  historyId: string | number;
}): Promise<BilanNotification> {
  const adresse = notification.emailAddress.trim().toLowerCase();
  const bilan: BilanNotification = {
    ignore: null,
    messages: 0,
    entres: 0,
    abonnementRenouvele: false,
  };
  const b = await donneesDeLaBoite(adresse);
  if (!b) return { ...bilan, ignore: "boite-inconnue" };
  if (b.status === "disabled") return { ...bilan, ignore: "desactivee" };
  const depuis = b.donnees.historyId;
  if (!depuis) {
    // Jamais abonnée par nous : on part d'ici, la suite se lira.
    await ecrireDonnees(b.channelId, {
      historyId: String(notification.historyId),
    });
    return { ...bilan, ignore: "sans-historique" };
  }

  const acces = await jetonDAcces(adresse, b);
  const ajoutes = new Map<string, string[]>();
  let dernier: string | null = null;
  let pageToken: string | undefined;
  do {
    const page = await historiqueDepuis(acces, {
      startHistoryId: depuis,
      pageToken,
    });
    if (!page) {
      // Trop ancien : Google n'a plus l'historique. On repart du numéro de la
      // notification ; ce qui s'est passé entre les deux relève d'une lecture
      // de la boîte (M24.4), pas de l'historique.
      console.warn("[gmail] historique perdu", { adresse, depuis });
      await ecrireDonnees(b.channelId, {
        historyId: String(notification.historyId),
      });
      return { ...bilan, ignore: "historique-perdu" };
    }
    for (const a of page.ajoutes) {
      // Un brouillon enregistré n'entre jamais, et souvent n'existe déjà plus.
      if (a.labelIds.some((l) => l.toUpperCase() === "DRAFT")) continue;
      ajoutes.set(a.id, a.labelIds);
    }
    dernier = page.historyId ?? dernier;
    pageToken = page.nextPageToken ?? undefined;
  } while (pageToken);

  const boite: Boite = {
    accountId: b.accountId,
    channelId: b.channelId,
    externalAccountId: adresse,
    nosAdresses: b.nosAdresses,
  };
  for (const id of ajoutes.keys()) {
    const message = await lireMessage(acces, id);
    if (!message) continue;
    bilan.messages += 1;
    const courrier = courrierDepuisGmail(message, boite);
    const r = await recevoirCourrier(boite, courrier, fournisseurGmail);
    if (r.created) bilan.entres += 1;
  }
  if (dernier) await ecrireDonnees(b.channelId, { historyId: dernier });

  if (doitRenouveler(b.donnees.watchExpireA)) {
    try {
      bilan.abonnementRenouvele = (await poserLAbonnement(adresse)) != null;
    } catch (err) {
      console.error(
        "[gmail] abonnement non renouvelé au passage",
        { adresse },
        err,
      );
    }
  }
  return bilan;
}
