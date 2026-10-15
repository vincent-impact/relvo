import { ensureOnboardingQuestions, listOpenQuestions } from "@relvo/db";
import { RelvoChatShell } from "@/components/relvo-chat/relvo-chat-shell";
import type { CarteVivanteData } from "@/components/shared/carte-vivante";
import { getTenantDb, requireAccountId } from "@/server/auth-context";

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
  searchParams: Promise<{
    from?: string;
    q?: string;
    nouveau?: string;
    reprendre?: string;
  }>;
}) {
  // `q` : une suggestion de l'accueil, posée comme premier tour (05 §11.12) —
  // le texte arrive dans le composer, l'utilisateur l'envoie ou le corrige.
  // `nouveau` force un nouvel échange ; `reprendre` rouvre un échange de
  // l'historique de l'appareil (M10.3, M10.4).
  const { from, q, nouveau, reprendre } = await searchParams;
  const backHref = from && from !== "/relvo" ? from : "/";
  const accountId = await requireAccountId();
  const db = await getTenantDb();

  // Relvo parle en premier (invariant 36, 05 §11.12) : les étapes du script
  // qui restent à poser naissent ici, puis les questions ouvertes — toutes
  // origines confondues — se posent en tête de l'échange, en formulaire. La
  // lecture du courrier en cours (rattrapage) se montre en carte vivante.
  await ensureOnboardingQuestions(db, accountId);
  const [questions, rattrapage] = await Promise.all([
    listOpenQuestions(db, { limit: 5 }),
    db.channelCatchup.findFirst({
      where: { status: { in: ["pending", "running"] } },
      orderBy: { requestedAt: "desc" },
      include: { channel: { select: { name: true } } },
    }),
  ]);
  const lecture: CarteVivanteData | null = rattrapage
    ? {
        status: rattrapage.status,
        messagesImported: rattrapage.messagesImported,
        subjectsOpened: rattrapage.subjectsOpened,
        conversationsIgnored: rattrapage.conversationsIgnored,
        channelName: rattrapage.channel.name,
      }
    : null;

  let contextLabel: string | null = null;
  let prompts = PROMPTS.general;

  const sujetMatch = from?.match(/^\/sujets\/([0-9a-f-]+)/i);
  if (sujetMatch) {
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
      from={from ?? null}
      contextLabel={contextLabel}
      prompts={prompts}
      initialText={q?.trim() || ""}
      nouveau={nouveau === "1"}
      reprendre={reprendre?.trim() || null}
      questions={questions}
      lecture={lecture}
    />
  );
}
