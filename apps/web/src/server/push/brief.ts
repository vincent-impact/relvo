import type { MorningCounters } from "@relvo/db";
import type { NotificationRelvo } from "./regles";

// LE BRIEF DU MATIN (M12.7) — la phrase de la notification, depuis les
// compteurs du domaine. Module PUR, tenu par `test/push.test.ts`. « Deux
// réponses attendues, une urgence » (01 §11) : les zéros se taisent, et quand
// tout est à zéro, Relvo se tait — pas de notification pour dire « rien ».

function n(count: number, singulier: string, pluriel: string): string {
  return `${count} ${count > 1 ? pluriel : singulier}`;
}

/** La phrase du matin, ou null quand il n'y a rien à dire. */
export function phraseDuMatin(c: MorningCounters): string | null {
  const parts: string[] = [];
  if (c.awaitingReplies > 0)
    parts.push(n(c.awaitingReplies, "réponse attendue", "réponses attendues"));
  if (c.awaitingDecisions > 0)
    parts.push(
      n(c.awaitingDecisions, "décision à prendre", "décisions à prendre"),
    );
  if (c.urgentSubjects > 0)
    parts.push(n(c.urgentSubjects, "urgence", "urgences"));
  if (c.tasksToday > 0)
    parts.push(n(c.tasksToday, "tâche aujourd'hui", "tâches aujourd'hui"));
  if (c.overdueTasks > 0)
    parts.push(n(c.overdueTasks, "en retard", "en retard"));
  if (c.openQuestions > 0)
    parts.push(n(c.openQuestions, "question de Relvo", "questions de Relvo"));
  return parts.length ? parts.join(" · ") : null;
}

/** La notification du matin — ouvre l'accueil, un seul brief visible à la fois. */
export function notificationDuMatin(
  c: MorningCounters,
): NotificationRelvo | null {
  const corps = phraseDuMatin(c);
  if (!corps) return null;
  return {
    kind: "brief",
    titre: "Votre matinée",
    corps,
    url: "/",
    tag: "brief",
  };
}
