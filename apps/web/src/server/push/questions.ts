import { envoyerNotification, type BilanEnvoi } from "./envoyer";
import type { NotificationRelvo } from "./regles";

// UNE QUESTION DE RELVO S'OUVRE (M12.9, ex-M18.11) — la notification qui
// ramène le dirigeant quand Relvo a eu besoin de lui HORS écran : une question
// née du tri d'un message, ou d'une étape du rattrapage. Les producteurs
// appellent `notifierQuestion` juste après `askQuestion`. La prise en main,
// posée pendant que l'échange est ouvert, ne l'appelle pas : on ne prévient pas
// quelqu'un qui regarde déjà.

export type QuestionANotifier = { id: string; text: string };

/** Un seul `tag` : une question visible à la fois, la dernière remplace la précédente. */
export const TAG_QUESTION = "question";

/** Ce que le téléphone affiche — pur, tenu par `test/push.test.ts`. */
export function notificationQuestion(q: QuestionANotifier): NotificationRelvo {
  return {
    kind: "question",
    titre: "Une question pour vous",
    corps: q.text,
    // L'échange, qui pose la question en formulaire en tête (05 §11.12).
    url: "/relvo?from=%2F",
    tag: TAG_QUESTION,
  };
}

export async function notifierQuestion(
  accountId: string,
  question: QuestionANotifier,
): Promise<BilanEnvoi> {
  return envoyerNotification(accountId, notificationQuestion(question));
}
