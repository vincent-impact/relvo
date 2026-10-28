import { after } from "next/server";
import {
  enrichSubjects,
  ensureOnboardingQuestions,
  listOpenQuestions,
} from "@relvo/db";
import { Suspense } from "react";
import { RelvoChatShell } from "@/components/relvo-chat/relvo-chat-shell";
import { ErreurDeConnexion } from "@/components/settings/erreur-de-connexion";
import { MOTIFS_DE_RETOUR, estUnMotifDeRetour } from "@/server/courrier/retour";
import {
  carteDepuisRattrapage,
  type CarteVivanteData,
} from "@/components/shared/carte-vivante";
import {
  toSubjectRowData,
  type SubjectRowData,
} from "@/components/shared/subject-row";
import { getTenantDb, requireAccountId } from "@/server/auth-context";
import { relancerLignesEnPanne } from "@/server/ia/pipeline/rattrapage";
import { estEnPanne } from "@/server/ia/pipeline/rattrapage-regles";
import { boiteEnMiseEnRoute, carteEnAttente } from "@/server/lecture-en-cours";
import { clePubliquePush } from "@/server/push/envoyer";

// Échange avec Relvo, plein écran (coquille M9). Page-aware : `from` porte la
// page d'origine pour le bouton retour, le chip de contexte et les prompts.

/** Une lecture finie reste montrée dans l'échange pendant ce délai. */
const LECTURE_FINIE_MS = 2 * 60 * 60 * 1000;
/** Sujets montrés sous la carte ; « Tous les sujets » pour le reste. */
const AFFAIRES_DU_MOMENT = 5;

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
    nouveau?: string;
    reprendre?: string;
    connected?: string;
    erreur?: string;
  }>;
}) {
  // `q` : une suggestion de l'accueil, posée comme premier tour (05 §11.12) —
  // le texte arrive dans le composer, l'utilisateur l'envoie ou le corrige.
  // `nouveau` force un nouvel échange ; `reprendre` rouvre un échange de
  // l'historique de l'appareil (M10.3, M10.4). `connected` : le retour de la
  // page du fournisseur, la boîte confiée à la dernière étape de la prise en
  // main — la lecture se suit ici.
  const { from, q, nouveau, reprendre, connected, erreur } = await searchParams;
  const backHref = from && from !== "/relvo" ? from : "/";
  const accountId = await requireAccountId();
  const db = await getTenantDb();

  // Relvo parle en premier (invariant 36, 05 §11.12) : les étapes du script
  // qui restent à poser naissent ici, puis les questions ouvertes — toutes
  // origines confondues — se posent en tête de l'échange, en formulaire. La
  // lecture du courrier en cours (rattrapage) se montre en carte vivante ; une
  // ligne dont plus aucune tranche ne s'occupe est RELANCÉE après la réponse —
  // c'est la reprise quand l'application se rouvre (M7.19).
  await ensureOnboardingQuestions(db, accountId);
  const now = new Date();
  const [questions, rattrapage] = await Promise.all([
    listOpenQuestions(db, { limit: 5 }),
    // La lecture en cours — ou, un moment encore après sa fin, la lecture
    // finie : le temps que la question de fin de lecture se pose avec ses
    // sujets sous les yeux (05 §11.11).
    db.channelCatchup.findFirst({
      where: {
        OR: [
          { status: { in: ["pending", "running"] } },
          { finishedAt: { gte: new Date(now.getTime() - LECTURE_FINIE_MS) } },
        ],
      },
      orderBy: { requestedAt: "desc" },
      include: { channel: { select: { name: true } } },
    }),
  ]);
  let lecture: CarteVivanteData | null = rattrapage
    ? carteDepuisRattrapage(rattrapage, rattrapage.channel.name)
    : null;
  if (!lecture) {
    // Une boîte connectée à l'instant, sans encore sa lecture — le webhook de
    // connexion ou la première tranche n'est pas passé — : la carte « en
    // attente » se montre déjà, et la page se rafraîchit jusqu'à la lecture.
    const boites = await db.channel.findMany({
      where: { type: "email", config: { externalAccountId: { not: null } } },
      include: {
        config: { select: { externalAccountId: true, updatedAt: true } },
        catchups: { select: { id: true }, take: 1 },
      },
    });
    const enRoute = boites.find((b) => boiteEnMiseEnRoute(b));
    if (enRoute) lecture = carteEnAttente(enRoute.name);
    else if (connected === "1" && boites.length === 0) {
      // Revenu du fournisseur avant son webhook : rien en base encore, la
      // carte dit que ça commence, le rafraîchissement fera le reste.
      lecture = carteEnAttente(null);
    }
  }
  if (rattrapage && estEnPanne(rattrapage)) {
    after(() => relancerLignesEnPanne(db));
  }
  // Les sujets du moment : nées depuis la demande de lecture, les plus
  // récentes d'abord, rendues par la ligne ordinaire du produit.
  let sujets: SubjectRowData[] = [];
  if (rattrapage) {
    const nees = await db.subject.findMany({
      where: {
        createdAt: { gte: rattrapage.requestedAt },
        status: { in: ["open", "validated"] },
      },
      orderBy: { createdAt: "desc" },
      take: AFFAIRES_DU_MOMENT,
    });
    sujets = (await enrichSubjects(db, nees)).map(toSubjectRowData);
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
        nouveau={nouveau === "1"}
        reprendre={reprendre?.trim() || null}
        questions={questions}
        lecture={lecture}
        sujets={sujets}
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
