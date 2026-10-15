import { RelvoChatShell } from "@/components/relvo-chat/relvo-chat-shell";
import { getTenantDb } from "@/server/auth-context";

// Échange avec Relvo, plein écran (coquille M9). Page-aware : `from` porte la
// page d'origine pour le bouton retour, le chip de contexte et les prompts.

const PROMPTS = {
  general: [
    "Qu'est-ce qui est urgent aujourd'hui ?",
    "Quelles sont mes tâches cette semaine ?",
    "Quelles affaires attendent une réponse ?",
  ],
  fil: [
    "Qu'est-ce qui est urgent aujourd'hui ?",
    "Quelles affaires attendent une réponse ?",
    "Range mes affaires ouvertes par priorité",
  ],
  subject: [
    "Résume-moi cette affaire",
    "Prépare une réponse",
    "Quelles tâches restent à faire ?",
    "Qui sont les contacts impliqués ?",
  ],
};

export default async function ConversationPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; q?: string }>;
}) {
  // `q` : une suggestion de l'accueil, posée comme premier tour (05 §11.12) —
  // le texte arrive dans le composer, l'utilisateur l'envoie ou le corrige.
  const { from, q } = await searchParams;
  const backHref = from && from !== "/relvo" ? from : "/";

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
      // Le titre seul : personne ne reconnaît un sujet à son code.
      contextLabel = subject.title;
      prompts = PROMPTS.subject;
    }
  } else if (from?.startsWith("/fil")) {
    contextLabel = "Affaires";
    prompts = PROMPTS.fil;
  }
  // Depuis l'accueil, pas de puce « Contexte » : elle ne changeait rien aux
  // invites, et une puce qui ne change rien est une rangée en trop.

  return (
    <RelvoChatShell
      backHref={backHref}
      contextLabel={contextLabel}
      prompts={prompts}
      initialText={q?.trim() || ""}
    />
  );
}
