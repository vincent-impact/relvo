import { tenantDb } from "@relvo/db";
import { envoyerNotification, type BilanEnvoi } from "./envoyer";
import type { NotificationRelvo } from "./regles";

// UN SUJET VIENT DE NAÎTRE (M12.10, R11) — la notification qui fait revenir :
// « Nouveau sujet : <titre> », qui ouvre la fiche. Elle naît du tri À
// RÉCEPTION (webhook e-mail, salve WhatsApp), jamais de la lecture à la
// connexion — la fin de lecture résume celle-ci (M12.9) ; c'est `trierConversation`
// qui la déclenche, hors lot. Une salve qui ouvre PLUSIEURS sujets fait UNE
// notification : les sujets nés dans la fenêtre de la salve se comptent, la
// notification dit le compte et ouvre la liste, et le même `tag` remplace la
// précédente sur le téléphone — jamais une pile de bannières.

export type SujetANotifier = { id: string; titre: string };

/** Un seul `tag` : la dernière naissance remplace la précédente. */
export const TAG_SUJET = "sujet";

/** La fenêtre d'une salve : des sujets nés à moins de deux minutes d'écart sont une seule nouvelle. */
export const SALVE_SUJETS_MS = 2 * 60 * 1000;

/** Ce que le téléphone affiche — pur, tenu par `test/push.test.ts`. */
export function notificationNouveauSujet(
  sujet: SujetANotifier,
  /** Les sujets nés dans la même salve, celui-ci compris. */
  nesDansLaSalve = 1,
): NotificationRelvo {
  const autres = Math.max(nesDansLaSalve - 1, 0);
  if (autres === 0) {
    return {
      kind: "sujet",
      titre: "Nouveau sujet",
      corps: sujet.titre,
      url: `/sujets/${sujet.id}`,
      tag: TAG_SUJET,
    };
  }
  return {
    kind: "sujet",
    titre: `${autres + 1} nouveaux sujets`,
    corps: `${sujet.titre}, et ${autres} autre${autres > 1 ? "s" : ""}`,
    url: "/fil",
    tag: TAG_SUJET,
  };
}

export async function notifierNouveauSujet(
  accountId: string,
  sujet: SujetANotifier,
  now: Date = new Date(),
): Promise<BilanEnvoi> {
  const db = tenantDb(accountId);
  const nes = await db.subject.count({
    where: {
      createdAt: { gte: new Date(now.getTime() - SALVE_SUJETS_MS) },
      status: "open",
    },
  });
  return envoyerNotification(
    accountId,
    notificationNouveauSujet(sujet, Math.max(nes, 1)),
  );
}
