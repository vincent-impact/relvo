import "server-only";
import {
  compterSujetsNesDesGroupes,
  listAssistantAccounts,
  listGroupesALire,
  tenantDb,
} from "@relvo/db";
import { expireTenantData } from "@/server/cached";
import { envoyerNotification } from "@/server/push/envoyer";
import {
  notificationNouveauSujet,
  type SujetANotifier,
} from "@/server/push/sujets";
import { inferenceDisponible, LECTURE_GROUPES } from "../config";
import { lireLeGroupe } from "./groupe-lecture";
import { urlApplication } from "./rattrapage";
import { relireSujet } from "./relecture";
import { structurerSujet } from "./structuration";

// LES GROUPES DU JOUR (M29.5) — la passe que les deux crons lancent : pour
// chaque compte dont l'assistant est actif, lire les groupes qui ont parlé
// depuis leur dernière lecture (`./groupe-lecture`), puis enchaîner ce que la
// lecture a ouvert :
//
//   · un sujet OUVERT est structuré (tâches, date), comme après le tri ;
//   · un groupe RATTACHÉ fait relire le sujet qu'il rejoint ;
//   · le dirigeant reçoit UNE notification par compte et par passe, qui dit le
//     sujet né — ou leur nombre : jamais une pile de bannières à midi.
//
// UN GARDE-FOU borne les sujets nés des groupes par compte et par lecture
// (`LECTURE_GROUPES.sujetsParLecture`) : au-delà, la lecture écrit son avis
// sur le groupe sans ouvrir — compté dans `plafonnes`.
//
// Tout part au tarif différé. La passe tient sous la durée de sa fonction :
// quand le temps manque, elle s'arrête de lancer des lectures et dit ce qui
// reste ; la route en relance une autre (`lancerLectureDesGroupes`). Ce qui
// n'a pas été lu reste dû — le repère d'un groupe ne bouge qu'à sa lecture.

export type BilanLecture = {
  comptes: number;
  /** Groupes à lire au début de la passe. */
  dus: number;
  /** Groupes que le modèle a lus. */
  lus: number;
  ouverts: number;
  rattaches: number;
  ignores: number;
  /** Lectures qui auraient ouvert un sujet, retenues par le garde-fou : l'avis est écrit. */
  plafonnes: number;
  echecs: number;
  /** Groupes que le budget de temps a laissés à la passe suivante. */
  restants: number;
  coutEur: number;
};

type Chrono = { debut: number; budgetMs: number };

/** Au plus `n` tâches à la fois, dans l'ordre. */
async function deFront<T>(
  items: readonly T[],
  n: number,
  faire: (item: T) => Promise<void>,
): Promise<void> {
  let prochain = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (prochain < items.length) {
        const item = items[prochain++]!;
        await faire(item);
      }
    }),
  );
}

export async function lireLesGroupesDus(chrono: Chrono): Promise<BilanLecture> {
  const bilan: BilanLecture = {
    comptes: 0,
    dus: 0,
    lus: 0,
    ouverts: 0,
    rattaches: 0,
    ignores: 0,
    plafonnes: 0,
    echecs: 0,
    restants: 0,
    coutEur: 0,
  };
  if (!inferenceDisponible()) return bilan;
  const aLeTemps = () =>
    chrono.budgetMs - (Date.now() - chrono.debut) > LECTURE_GROUPES.margeMs;
  let ecrit = false;

  await deFront(
    await listAssistantAccounts(),
    LECTURE_GROUPES.comptesDeFront,
    async (accountId) => {
      const dus = await listGroupesALire(accountId, LECTURE_GROUPES.parCompte);
      if (dus.length === 0) return;
      bilan.comptes += 1;
      bilan.dus += dus.length;
      const nes: SujetANotifier[] = [];
      // Ce que les passes précédentes de la même lecture ont déjà ouvert compte.
      let places =
        LECTURE_GROUPES.sujetsParLecture -
        (await compterSujetsNesDesGroupes(
          tenantDb(accountId),
          new Date(Date.now() - LECTURE_GROUPES.fenetreSujetsMs),
        ));
      const prendreUnSujet = () => {
        if (places <= 0) return false;
        places -= 1;
        return true;
      };

      await deFront(dus, LECTURE_GROUPES.groupesDeFront, async (groupe) => {
        if (!aLeTemps()) {
          bilan.restants += 1;
          return;
        }
        try {
          const r = await lireLeGroupe({
            accountId,
            ...groupe,
            prendreUnSujet,
          });
          if (r.detail === "plafond-de-sujets") bilan.plafonnes += 1;
          bilan.coutEur += r.coutEur;
          if (r.lecture) bilan.lus += 1;
          if (r.issue === "echec") bilan.echecs += 1;
          if (r.issue === "ignore") bilan.ignores += 1;
          if (r.lecture) ecrit = true;
          if (!r.sujet) return;

          if (!r.sujet.ouvert) {
            bilan.rattaches += 1;
            const relecture = await relireSujet({
              accountId,
              subjectId: r.sujet.id,
              messageId: r.sujet.messageId,
              lot: true,
            });
            bilan.coutEur += relecture.coutEur;
            return;
          }
          bilan.ouverts += 1;
          const structuration = await structurerSujet({
            accountId,
            subjectId: r.sujet.id,
            messageId: r.sujet.messageId,
            lot: true,
          });
          bilan.coutEur += structuration.coutEur;
          // Le titre se relit après la structuration, qui a pu le préciser.
          const ne = await tenantDb(accountId).subject.findFirst({
            where: { id: r.sujet.id },
            select: { id: true, title: true },
          });
          if (ne) nes.push({ id: ne.id, titre: ne.title });
        } catch (e) {
          // Un groupe en erreur ne prive pas les autres de leur lecture.
          bilan.echecs += 1;
          console.error("[ia] groupe non lu", groupe.conversationId, e);
        }
      });

      if (nes.length > 0) {
        await envoyerNotification(
          accountId,
          notificationNouveauSujet(nes[0]!, nes.length),
        ).catch((e) =>
          console.error("[push] sujets des groupes non notifiés", e),
        );
      }
    },
  );

  if (ecrit) expireTenantData();
  return bilan;
}

/**
 * LANCE une passe de lecture des groupes : un appel à sa route, qui répond
 * aussitôt et travaille après sa réponse — le cron n'attend que l'accusé, et
 * son propre travail (le brief, le filet du rattrapage) n'est pas retardé.
 * Même secret que les crons. Sans secret, rien ne part : le cron suivant
 * relancera, et rien n'est perdu — le repère d'un groupe ne bouge qu'à sa lecture.
 */
export async function lancerLectureDesGroupes(passe = 1): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[ia] CRON_SECRET absent : lecture des groupes non lancée");
    return false;
  }
  try {
    const res = await fetch(`${urlApplication()}/api/groupes/lecture`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ passe }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error("[ia] lecture des groupes refusée", { status: res.status });
      return false;
    }
    return true;
  } catch (e) {
    console.error("[ia] lecture des groupes non lancée", e);
    return false;
  }
}
