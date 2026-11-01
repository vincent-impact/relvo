import { redirect } from "next/navigation";
import { ensureOnboardingQuestions } from "@relvo/db";
import { Suspense } from "react";
import { RelvoChatShell } from "@/components/relvo-chat/relvo-chat-shell";
import { ErreurDeConnexion } from "@/components/settings/erreur-de-connexion";
import { MOTIFS_DE_RETOUR, estUnMotifDeRetour } from "@/server/courrier/retour";
import { getTenantDb, requireAccountId } from "@/server/auth-context";
import { echangesDeRelvo } from "@/server/echanges-relvo";
import { urlEchangeRelvo } from "@/lib/echanges-regles";
import { clePubliquePush } from "@/server/push/envoyer";

// Échange avec Relvo, plein écran (coquille M9). Page-aware : `from` porte la
// page d'origine pour le bouton retour, le chip de contexte et les prompts.

const PROMPTS = {
  general: [
    "Qu'est-ce qui est urgent aujourd'hui ?",
    "Quelles sont mes tâches cette semaine ?",
    "Quelles sujets attendent une réponse ?",
  ],
  fil: [
    "Qu'est-ce qui est urgent aujourd'hui ?",
    "Quelles sujets attendent une réponse ?",
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
  searchParams: Promise<{
    from?: string;
    q?: string;
    dicte?: string;
    nouveau?: string;
    reprendre?: string;
    connected?: string;
    erreur?: string;
  }>;
}) {
  // `q` : une suggestion de l'accueil, posée comme premier tour (05 §11.12) —
  // le texte arrive dans le composer, l'utilisateur l'envoie ou le corrige.
  // `dicte` : une dictée depuis le disque du dock (M22.8), envoyée d'elle-même
  // en premier tour d'un nouvel échange.
  // `nouveau` force un nouvel échange ; `reprendre` rouvre un échange de
  // l'historique de l'appareil (M10.3, M10.4). `connected` : le retour de la
  // page du fournisseur, la boîte confiée à la dernière étape de la prise en
  // main — la lecture se suit dans SON échange.
  const { from, q, dicte, nouveau, reprendre, connected, erreur } =
    await searchParams;
  const backHref = from && from !== "/relvo" ? from : "/";
  const accountId = await requireAccountId();
  const db = await getTenantDb();

  // Relvo parle en premier (invariant 36, 05 §11.12) : les étapes du script
  // qui restent à poser naissent ici. Mais il ne mélange pas ce qu'il a à
  // dire avec la discussion : chaque chose est un ÉCHANGE À PART, et l'échange
  // vide n'en montre que la ligne.
  await ensureOnboardingQuestions(db, accountId);
  const tout = await echangesDeRelvo(db, { connected: connected === "1" });
  const pending = tout.echanges.filter((e) => e.ouvertes.length > 0).length;

  // Revenu du fournisseur : la lecture de la boîte se suit dans son échange.
  if (connected === "1") {
    const lecture = tout.echanges.find((e) => e.nature === "lecture");
    if (lecture) redirect(urlEchangeRelvo(lecture.cle, "/relvo"));
  }

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
    contextLabel = "Sujets";
    prompts = PROMPTS.fil;
  }
  // Depuis l'accueil, pas de puce « Contexte » : elle ne changeait rien aux
  // invites, et une puce qui ne change rien est une rangée en trop.

  return (
    <>
      <RelvoChatShell
        backHref={backHref}
        from={from ?? null}
        contextLabel={contextLabel}
        prompts={prompts}
        initialText={q?.trim() || ""}
        dicte={dicte?.trim() || null}
        nouveau={nouveau === "1" || Boolean(dicte?.trim())}
        reprendre={reprendre?.trim() || null}
        attend={tout.echanges}
        pending={pending}
        clePublique={clePubliquePush()}
      />
      <Suspense fallback={null}>
        <ErreurDeConnexion
          message={estUnMotifDeRetour(erreur) ? MOTIFS_DE_RETOUR[erreur] : null}
        />
      </Suspense>
    </>
  );
}
