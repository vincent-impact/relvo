import { ConversationShell } from "@/components/conversation/conversation-shell";
import { getTenantDb } from "@/server/auth-context";

// Nouvelle conversation plein écran (coquille M9). Page-aware : `from` porte la
// page d'origine pour le bouton retour, le chip de contexte et les prompts.

const PROMPTS = {
  general: [
    "Qu'est-ce qui est urgent aujourd'hui ?",
    "Quelles sont mes tâches cette semaine ?",
    "Résume-moi le sujet du congélateur de Narbonne",
    "Prépare une réponse à Karim sur la sauce blanche",
  ],
  fil: [
    "Qu'est-ce qui est urgent aujourd'hui ?",
    "Quels sujets attendent une réponse ?",
    "Range mes sujets ouverts par priorité",
  ],
  subject: [
    "Résume-moi ce sujet",
    "Prépare une réponse",
    "Quelles tâches restent à faire ?",
    "Qui sont les contacts impliqués ?",
  ],
};

export default async function ConversationPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const backHref = from && from !== "/conversation" ? from : "/";

  let contextLabel: string | null = null;
  let prompts = PROMPTS.general;

  const sujetMatch = from?.match(/^\/sujets\/([0-9a-f-]+)/i);
  if (sujetMatch) {
    const db = await getTenantDb();
    const subject = await db.subject.findFirst({
      where: { id: sujetMatch[1] },
      select: { reference: true, title: true },
    });
    if (subject) {
      contextLabel = `${subject.reference} — ${subject.title}`;
      prompts = PROMPTS.subject;
    }
  } else if (from?.startsWith("/fil")) {
    contextLabel = "Mon fil";
    prompts = PROMPTS.fil;
  }

  return (
    <ConversationShell
      backHref={backHref}
      contextLabel={contextLabel}
      prompts={prompts}
    />
  );
}
