"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronRight,
  Mail,
  MessageCircle,
  Unlink,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { ConversationListening, ConversationParticipant } from "@relvo/db";
import { ConversationThread } from "@/components/conversations/conversation-thread";
import {
  DecisionRecord,
  DecisionSheet,
  type SheetTask,
} from "@/components/conversations/decision-sheet";
import {
  SubjectCreateDialog,
  type FolderOption,
} from "@/components/conversations/subject-create-dialog";
import {
  SubjectPickerDialog,
  type SubjectPickerOption,
} from "@/components/messages/subject-picker-dialog";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { RecipientComposer } from "@/components/shared/recipient-composer";
import {
  clearDraftAction,
  prepareDraftAction,
} from "@/server/actions/brouillon";
import { createSubjectFromConversationAction } from "@/server/actions/conversations";
import { createSubjectFromMessageAction } from "@/server/actions/messages";
import { sendEmailReplyAction } from "@/server/actions/email";
import { sendWhatsAppReplyAction } from "@/server/actions/whatsapp";
import {
  attachConversationToSubjectAction,
  attachConversationToSubjectFromMessageAction,
  detachConversationFromSubjectAction,
  ensureSubjectAnchorsAction,
  stopListeningOnConversationAction,
} from "@/server/actions/subject-conversations";
import { folderVisual } from "@/lib/folders";
import { initialsFor } from "@/lib/display";
import { guessContactKind } from "@/lib/contact-avatar";
import { ContactAvatarIcon } from "@/components/contacts/contact-avatar-icon";
import {
  ContactCreateDialog,
  type ContactPrefill,
} from "@/components/contacts/contact-create-dialog";
import type {
  IgnoreData,
  RelvoVerdictData,
  ThreadMessageData,
} from "@/lib/conversation-row";
import { RelvoVerdictLine } from "@/components/conversations/relvo-verdict-line";
import { cn } from "@/lib/utils";

// Détail d'une conversation (header enrichi 2026-07-23, v3). TOUT le contexte vit
// dans le hero violet.
//
// AUCUN DOCK DE TRIAGE ICI (2026-09-07, retour bêta). Le bas de l'écran a porté
// successivement trois boutons (Ignorer / Lier / Nouveau), puis un bouton unique
// « Classer » — retiré à son tour, faute de fonctionner à l'essai. Le triage vit
// désormais dans les SWIPES de la liste `/conversations` : ← écarter, → classer.
// ⚠️ Conséquence assumée : une conversation orpheline ouverte par TAP n'offre
// aucune action ; on revient à la liste pour la trier.
//
// Le dock ne réapparaît que pour CHOISIR LE MESSAGE D'ANCRAGE (messagerie),
// étape que le swipe de la liste ne peut pas porter — il n'a pas de message à
// désigner. C'est tout l'objet du relais `?classer=` ci-dessous.
//
//   • email    → Nouveau sujet / Lier agissent sur TOUT le fil (le sujet EST le
//     fil) → le dialog s'ouvre d'emblée.
//   • messagerie → on fait d'abord CHOISIR le message de départ (le dock passe en
//     sélection) ; on VALIDE, puis le dialog (création) ou le sélecteur de sujet
//     (lien) s'ouvre.
//
// `?classer=create|link` — intention transmise par le swipe droite de la LISTE.
// C'est ce relais qui permet à la liste d'offrir le geste sans jamais avoir à
// deviner une ancre en messagerie : elle délègue ici, où le fil est lisible.

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email: Mail,
  whatsapp: MessageCircle,
};
const CHANNEL_LABEL: Record<string, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
};

type Intent = "create" | "link";

export function ConversationDetail({
  conversationId,
  title,
  channelType,
  channelId,
  isGroup,
  participants,
  participantsRaw,
  externalThreadId,
  listenings,
  messages,
  backTo,
  folders,
  subjects,
  relvo,
  ignore,
  draftTaskId = null,
  decisionTasks = [],
}: {
  conversationId: string;
  title: string;
  channelType: string;
  /** Canal d'émission — cible d'envoi du composer. */
  channelId: string;
  isGroup: boolean;
  /** Tous les interlocuteurs du fil (≥1 pour un groupe actif). */
  participants: ConversationParticipant[];
  /** SET de destinataires externes (e-mail) — reply-all du composer. */
  participantsRaw: string[];
  /** Fil WhatsApp (chat_id) — cible d'envoi en messagerie. */
  externalThreadId: string | null;
  listenings: ConversationListening[];
  messages: ThreadMessageData[];
  backTo: string;
  /** Domaines pour le dialog de création. */
  folders: FolderOption[];
  /** Sujets ouverts candidats au « Lier à un sujet existant ». */
  subjects: SubjectPickerOption[];
  /** Le dernier verdict de Relvo sur ce fil, ou null s'il ne l'a pas lu (M7.20). */
  relvo: RelvoVerdictData | null;
  /** Raison et auteur de l'ignorance, si le fil est en sourdine. */
  ignore: IgnoreData | null;
  /** « Répondre » depuis une tâche (M7.7) : Relvo rédige le brouillon pour cette tâche à l'ouverture. */
  draftTaskId?: string | null;
  /** Les tâches du fil qui portent des décisions (05 §3.1) : le formulaire sous le message qui les pose, ce qui a été décidé ensuite. */
  decisionTasks?: (SheetTask & { messageId: string | null })[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  // Intention transmise par le swipe droite de la LISTE (`?classer=create|link`).
  // Elle est lue À L'INITIALISATION des états ci-dessous plutôt que rejouée dans
  // un effet : l'écran s'ouvre directement dans le bon flux, en un seul rendu.
  const rawIntent = searchParams.get("classer");
  const initialIntent: Intent | null =
    rawIntent === "create" || rawIntent === "link" ? rawIntent : null;
  const startsEmail = channelType === "email";

  // Sélection WhatsApp : intent (create/link) + message de départ choisi.
  // Messagerie + intention héritée → on entre d'emblée en choix du message
  // d'ancrage (invariant n°13bis : jamais d'ancre par défaut).
  const [selecting, setSelecting] = useState<Intent | null>(
    !startsEmail ? initialIntent : null,
  );
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  // E-mail → le dialog s'ouvre tout de suite (le sujet EST le fil, rien à ancrer).
  const [showCreate, setShowCreate] = useState(
    startsEmail && initialIntent === "create",
  );
  const [showPicker, setShowPicker] = useState(
    startsEmail && initialIntent === "link" && subjects.length > 0,
  );
  const [contactPrefill, setContactPrefill] = useState<ContactPrefill | null>(
    null,
  );

  const isEmail = channelType === "email";
  const ChannelIcon = CHANNEL_ICON[channelType] ?? Mail;
  const channelLabel = CHANNEL_LABEL[channelType] ?? "Canal";

  // Écoute ACTIVE = ce fil alimente en ce moment un sujet ouvert. On arrive alors
  // le plus souvent depuis la fiche de ce sujet : le dock devient un COMPOSER de
  // réponse (répondre est le geste par défaut), et le triage (Ignorer/Lier/
  // Nouveau) s'efface. Détacher/arrêter l'écoute vit dans « Suivi dans ».
  const activeListening = listenings.find((l) => l.active) ?? null;
  const attached = activeListening != null;

  // Brouillon de Relvo (M7.7) — rédigé à l'ouverture quand on arrive d'une
  // tâche, réutilisé s'il existe déjà, régénérable, effaçable. Jamais envoyé
  // seul : il se pose dans le composer, l'envoi reste le geste de l'utilisateur.
  // Une tâche qui porte une décision sans réponse ne se rédige pas à
  // l'ouverture : le FORMULAIRE la pose d'abord (05 §3.1), et c'est lui — et
  // lui seul — qui demande le brouillon, sur « Rédiger la réponse ». Ce qui
  // compte est l'état À L'ARRIVÉE sur la page : figé dans un état initialisé
  // une seule fois, sinon la dernière réponse cochée (qui rafraîchit la page et
  // ferme les décisions) déclencherait la rédaction avant l'appui du dirigeant.
  const [redigerALArrivee] = useState(
    () =>
      Boolean(draftTaskId && attached) &&
      !decisionTasks.some(
        (t) =>
          t.id === draftTaskId &&
          t.status === "open" &&
          t.decisions.some((d) => d.reponse === null),
      ),
  );
  const [draft, setDraft] = useState<{
    loading: boolean;
    text: string | null;
    actionId: string | null;
  }>({ loading: redigerALArrivee, text: null, actionId: null });
  // La tâche dont le brouillon est dans le composer — celle de l'URL, ou celle
  // du formulaire qui vient de rédiger.
  const [draftFor, setDraftFor] = useState<string | null>(draftTaskId);
  const draftRequested = useRef(false);
  useEffect(() => {
    if (!draftTaskId || !redigerALArrivee || draftRequested.current) return;
    draftRequested.current = true;
    void prepareDraftAction(draftTaskId).then((res) => {
      if (res.ok) {
        setDraft({
          loading: false,
          text: res.data.contenu,
          actionId: res.data.actionId,
        });
      } else {
        setDraft({ loading: false, text: null, actionId: null });
        toast.error(res.message);
      }
    });
  }, [draftTaskId, redigerALArrivee]);
  function regenerateDraft() {
    if (!draftFor) return;
    setDraft((d) => ({ ...d, loading: true }));
    void prepareDraftAction(draftFor, { regenerer: true }).then((res) => {
      if (res.ok) {
        setDraft({
          loading: false,
          text: res.data.contenu,
          actionId: res.data.actionId,
        });
      } else {
        setDraft((d) => ({ ...d, loading: false }));
        toast.error(res.message);
      }
    });
  }
  function clearDraft() {
    const id = draft.actionId;
    setDraft({ loading: false, text: null, actionId: null });
    if (id) void clearDraftAction(id);
  }
  const composerPlaceholder = isGroup
    ? "Répondre au groupe…"
    : participants[0]?.name
      ? `Répondre à ${participants[0].name}…`
      : "Répondre…";

  // Ouvre la pop-up de création de contact, pré-remplie depuis l'interlocuteur.
  function openCreateForParticipant(p: ConversationParticipant) {
    const raw = p.raw?.trim() ?? null;
    setContactPrefill({
      name: p.name,
      email: isEmail ? raw : null,
      phone: isEmail ? null : (raw?.split("@")[0] ?? null),
    });
  }

  // Tap sur un interlocuteur : sa fiche s'il est connu, sinon la pop-up de
  // création pré-remplie (même comportement que la liste /conversations).
  function tapParticipant(p: ConversationParticipant) {
    if (p.contactId) {
      // Retour depuis la fiche → cette conversation.
      const from = encodeURIComponent(`/conversations/${conversationId}`);
      router.push(`/contacts/${p.contactId}?from=${from}`);
      return;
    }
    openCreateForParticipant(p);
  }

  // Retirer CETTE conversation d'un sujet (icône chaîne brisée, « Suivi dans ») —
  // SELON LE CANAL : e-mail = détacher le fil (rattrapage d'erreur, le sujet EST le
  // fil) ; messagerie = arrêter l'écoute (borne de fin, le passé reste rattaché).
  function unlink(subjectId: string) {
    startTransition(async () => {
      const res = isEmail
        ? await detachConversationFromSubjectAction({
            subjectId,
            conversationId,
          })
        : await stopListeningOnConversationAction({
            subjectId,
            conversationId,
          });
      if (res.ok) {
        toast.success(isEmail ? "Fil détaché du sujet" : "Écoute arrêtée");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  // Réponse depuis la conversation (fil rattaché) — e-mail : reply-all sur le SET ;
  // messagerie : dans le fil (chat_id). L'envoi s'inscrit dans le sujet écouté.
  async function handleSend(text: string) {
    if (!activeListening) return false;
    if (isEmail) {
      const set =
        participantsRaw.length > 0
          ? participantsRaw
          : participants.map((p) => p.raw).filter((r): r is string => !!r);
      if (set.length === 0) {
        toast.error("Aucun destinataire pour répondre.");
        return false;
      }
      // L'objet de la réponse vient du FIL (« Re: <objet> »), jamais du titre
      // du sujet : la clé de conversation contient l'objet (PITFALLS.md #50).
      const res = await sendEmailReplyAction({
        subjectId: activeListening.subjectId,
        channelId,
        conversationId,
        to: set.map((identifier) => ({ identifier })),
        body: text,
      });
      if (!res.ok) {
        toast.error(res.message);
        return false;
      }
      toast.success(isGroup ? "E-mail envoyé au groupe" : "E-mail envoyé");
    } else {
      if (!externalThreadId) {
        toast.error("Fil de messagerie introuvable.");
        return false;
      }
      const res = await sendWhatsAppReplyAction({
        subjectId: activeListening.subjectId,
        channelId,
        chatId: externalThreadId,
        body: text,
      });
      if (!res.ok) {
        toast.error(res.message);
        return false;
      }
      toast.success(isGroup ? "Message envoyé au groupe" : "Message envoyé");
    }
    await ensureSubjectAnchorsAction(activeListening.subjectId);
    router.refresh();
    return true;
  }

  function resetSelection() {
    setSelecting(null);
    setSelectedMessageId(null);
  }

  // ⚠️ Plus de `startCreate` / `startLink` / `ignore` ici : le triage a quitté cet
  // écran. L'intention arrive déjà résolue de la liste (`?classer=`), lue à
  // l'INITIALISATION des états ci-dessus — e-mail : le dialog s'ouvre d'emblée ;
  // messagerie : on entre directement en choix du message d'ancrage. « Ignorer »
  // est le swipe gauche de la liste.

  // Nettoyage de l'URL une fois l'intention consommée (elle l'a été à l'INIT des
  // états ci-dessus, pas ici : rejouer le flux depuis un effet déclencherait une
  // cascade de rendus). L'effet ne fait donc que parler à des systèmes externes —
  // l'historique, et un toast si « Lier » n'a nulle part où aller.
  // Sans ce nettoyage, un rafraîchissement rouvrirait un dialog déjà fermé.
  const claimed = useRef(false);
  useEffect(() => {
    if (claimed.current || !initialIntent) return;
    claimed.current = true;
    router.replace(`/conversations/${conversationId}`, { scroll: false });
    if (initialIntent === "link" && subjects.length === 0) {
      toast.info("Aucun sujet ouvert où rattacher cette conversation.");
    }
  }, [initialIntent, conversationId, router, subjects.length]);

  // Valider le message choisi (WhatsApp) → ouvre le dialog correspondant à l'intent.
  function validateSelection() {
    if (!selectedMessageId || !selecting) return;
    const intent = selecting;
    setSelecting(null);
    if (intent === "create") setShowCreate(true);
    else setShowPicker(true);
  }

  function goToSubject(id: string) {
    router.push(`/sujets/${id}?from=/conversations`);
  }

  // Création confirmée (dialog) : email = tout le fil ; WhatsApp = depuis l'ancre.
  function create(input: {
    title: string;
    description: string | null;
    folderId: string | null;
  }) {
    startTransition(async () => {
      const res =
        !isEmail && selectedMessageId
          ? await createSubjectFromMessageAction(selectedMessageId, input)
          : await createSubjectFromConversationAction(conversationId, input);
      if (res.ok) {
        setShowCreate(false);
        toast.success("Sujet créé");
        goToSubject(res.data.id);
      } else {
        toast.error(res.message);
      }
    });
  }

  // Lien confirmé (sélecteur de sujet).
  function link(subjectId: string) {
    startTransition(async () => {
      const res =
        !isEmail && selectedMessageId
          ? await attachConversationToSubjectFromMessageAction({
              subjectId,
              messageId: selectedMessageId,
            })
          : await attachConversationToSubjectAction({
              subjectId,
              conversationId,
            });
      if (res.ok) {
        setShowPicker(false);
        toast.success("Rattaché au sujet");
        goToSubject(res.data.subjectId);
      } else {
        toast.error(res.message);
      }
    });
  }

  const inSelection = selecting != null;

  // Le composer est ancré PAR-DESSUS le fil et grandit avec le brouillon (barre,
  // puces, texte long) : on mesure sa hauteur et le fil se réserve la place, pour
  // que les messages précédents restent lisibles derrière — c'est le contexte
  // dont on a besoin pour répondre (retour du second essai réel, 2026-09-16).
  const composerRef = useRef<HTMLDivElement>(null);
  const [composerHeight, setComposerHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = composerRef.current;
    if (!el) {
      setComposerHeight(null);
      return;
    }
    const ro = new ResizeObserver(([entry]) => {
      setComposerHeight(Math.ceil(entry.contentRect.height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [attached]);

  // Les membres d'un groupe se REPLIENT (retour du 2026-09-18) : un groupe de
  // huit personnes faisait un hero de deux écrans. Deux visibles, le reste sur
  // un appui discret.
  const [membersOpen, setMembersOpen] = useState(false);
  const MEMBRES_VISIBLES = 2;
  const membresRepliables = isGroup && participants.length > MEMBRES_VISIBLES;
  const participantsVisibles =
    membresRepliables && !membersOpen
      ? participants.slice(0, MEMBRES_VISIBLES)
      : participants;

  // Le fil s'ouvre EN BAS, sur le dernier message (retour du 2026-09-18) : c'est
  // ce qu'on vient lire. Une fois, quand la place du composer est connue.
  const finDuFil = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current) return;
    if (attached && composerHeight === null) return;
    scrolled.current = true;
    // Jusqu'au BOUT du conteneur (marge du composer comprise), pas jusqu'au
    // repère : le repère se calerait sous le composer.
    const scroller = finDuFil.current?.closest("main");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [attached, composerHeight]);

  // Ce que Relvo pose DANS le fil, sous le message qui l'a fait naître : le
  // formulaire d'une tâche ouverte, ce qui a été décidé pour une tâche close.
  // Sans message d'ancrage dans ce fil : en fin de fil.
  const messageIds = new Set(messages.map((m) => m.id));
  const relvoAfter: Record<string, React.ReactNode[]> = {};
  const relvoTrailing: React.ReactNode[] = [];
  // Alignés sur les messages : dans un fil e-mail, le conteneur porte déjà la
  // marge et l'espacement ; dans une messagerie, les bulles ont la leur.
  const relvoInset = isEmail ? "" : "mx-[18px] my-1";
  if (attached) {
    for (const t of decisionTasks) {
      const node =
        t.status === "done" ? (
          <DecisionRecord key={t.id} task={t} className={relvoInset} />
        ) : (
          <DecisionSheet
            key={t.id}
            task={t}
            className={relvoInset}
            onDraft={({ actionId, contenu }) => {
              setDraftFor(t.id);
              setDraft({ loading: false, text: contenu, actionId });
            }}
          />
        );
      if (t.messageId && messageIds.has(t.messageId)) {
        (relvoAfter[t.messageId] ??= []).push(node);
      } else {
        relvoTrailing.push(node);
      }
    }
  }

  return (
    <>
      {/* Le hero reste VISIBLE : hors du défilement (retour du 2026-09-18), le
          retour et les sujets suivis sont toujours à portée. */}
      <div className="relative z-20 flex-none">
        <RelvoHeader
          back={backTo}
          relvo={false}
          titleFull
          title={title}
          className="pb-3.5"
        >
          {/* Le hero d'une conversation tient sur PEU (retour du 2026-09-18 :
              fixé, il couvrait un tiers de l'écran). Plus de libellés de
              section : le canal et les interlocuteurs en puces sur une ligne,
              les sujets suivis en lignes fines dessous. */}
          <div className="space-y-2 px-[18px] pt-2">
            {/* L'avis de tri de Relvo (M7.20) — action, nature, raison, heure ;
                ou « Relvo n'a pas encore lu ce fil ». Sur le violet, en blanc.
                SEULEMENT tant que le fil n'est pas suivi : c'est là qu'il sert
                (confirmer ou contredire, réactiver). Un fil suivi par un sujet
                a sa mémoire dans le sujet ; l'avis reste dans le journal. */}
            {!activeListening ? (
              <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 [&_.text-\(--text-secondary\)]:text-white/85 [&_.text-\(--text-tertiary\)]:text-white/70 [&_.text-relvo]:text-white">
                {relvo || ignore ? (
                  <RelvoVerdictLine
                    relvo={relvo}
                    ignore={ignore}
                    clamp={false}
                  />
                ) : (
                  <p className="text-[12.5px] text-white/70">
                    Relvo n’a pas encore lu ce fil.
                  </p>
                )}
              </div>
            ) : null}

            {/* Le canal, puis les interlocuteurs — en puces, sur une ligne
                qui replie. Tap = fiche (enregistré) ou pop-up de création. */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex h-7 flex-none items-center gap-1 rounded-full bg-white/12 px-2 text-[12px] font-semibold text-(--on-violet)">
                {isGroup ? (
                  <Users className="size-[13px]" strokeWidth={2.4} />
                ) : (
                  <ChannelIcon className="size-[13px]" strokeWidth={2.2} />
                )}
                {isGroup
                  ? `${channelLabel} · ${participants.length} membre${participants.length > 1 ? "s" : ""}`
                  : channelLabel}
              </span>
              {participants.length === 0 ? (
                <span className="text-[12.5px] text-white/70 italic">
                  Aucun interlocuteur identifié.
                </span>
              ) : (
                participantsVisibles.map((p, i) => {
                  const pKind = guessContactKind({ name: p.name, raw: p.raw });
                  return (
                    <span
                      key={`${p.contactId ?? p.raw ?? p.name}-${i}`}
                      className="flex max-w-full min-w-0 items-center gap-1"
                    >
                      <button
                        type="button"
                        onClick={() => tapParticipant(p)}
                        aria-label={
                          p.contactId
                            ? "Voir le contact"
                            : "Voir l’interlocuteur"
                        }
                        className="inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full bg-white/12 pr-2 pl-1 text-[12.5px] font-semibold text-white active:bg-white/20"
                      >
                        <span className="grid size-5 flex-none place-items-center rounded-full bg-white/25 text-[9.5px] font-extrabold">
                          {p.contactId ? (
                            (initialsFor(p.name) ?? "?")
                          ) : (
                            <ContactAvatarIcon
                              kind={pKind}
                              className="size-[12px]"
                              strokeWidth={2.2}
                            />
                          )}
                        </span>
                        <span className="truncate">{p.name}</span>
                        {p.contactId ? (
                          <ChevronRight
                            className="size-3.5 flex-none text-white/55"
                            strokeWidth={2.2}
                            aria-hidden
                          />
                        ) : null}
                      </button>
                      {/* Interlocuteur non rattaché : « Enregistrer », à côté. */}
                      {p.contactId ? null : (
                        <button
                          type="button"
                          onClick={() => openCreateForParticipant(p)}
                          className="h-7 flex-none rounded-full border border-white/35 px-2 text-[11.5px] font-bold whitespace-nowrap text-white active:bg-white/10"
                        >
                          Enregistrer
                        </button>
                      )}
                    </span>
                  );
                })
              )}
              {membresRepliables ? (
                <button
                  type="button"
                  onClick={() => setMembersOpen((o) => !o)}
                  aria-expanded={membersOpen}
                  className="h-7 flex-none rounded-full border border-white/30 px-2.5 text-[12px] font-semibold text-white/85 active:bg-white/10"
                >
                  {membersOpen
                    ? "Réduire"
                    : `+${participants.length - MEMBRES_VISIBLES}`}
                </button>
              ) : null}
            </div>

            {/* Sujets suivis — une ligne fine par sujet ; chaîne brisée = détacher. */}
            {listenings.length > 0 ? (
              <div className="space-y-1">
                {listenings.map((l) => {
                  const color = folderVisual(l.folder ?? undefined).color;
                  return (
                    <div
                      key={l.subjectId}
                      className="flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/10 pr-1 pl-3"
                    >
                      <span
                        className="size-2 flex-none rounded-full"
                        style={{ background: color }}
                      />
                      <Link
                        href={`/sujets/${l.subjectId}?from=${encodeURIComponent(backTo)}`}
                        className="min-w-0 flex-1 active:opacity-80"
                      >
                        <span
                          className={cn(
                            "block truncate text-[13px] font-semibold text-white",
                            !l.active && "line-through decoration-white/40",
                          )}
                        >
                          {l.title}
                        </span>
                      </Link>
                      {l.active ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => unlink(l.subjectId)}
                          aria-label={
                            isEmail
                              ? "Détacher ce fil du sujet"
                              : "Arrêter l'écoute"
                          }
                          className="grid size-7 flex-none place-items-center rounded-full text-white active:bg-white/15 disabled:opacity-50"
                        >
                          <Unlink className="size-[15px]" strokeWidth={2.2} />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </RelvoHeader>
      </div>

      <Screen bottomInset={attached ? composerHeight : null}>
        <ConversationThread
          messages={messages}
          channelType={channelType}
          selecting={inSelection}
          selectedMessageId={selectedMessageId}
          onSelect={setSelectedMessageId}
          after={relvoAfter}
          trailing={relvoTrailing}
        />
        <div ref={finDuFil} aria-hidden />
      </Screen>

      {/* Rattachée → COMPOSER (répondre = geste par défaut). Sinon → RIEN, sauf
          pendant le choix du message d'ancrage (messagerie), où le dock devient
          la barre de sélection. Le détachement / l'arrêt d'écoute vivent, eux,
          dans « Suivi dans » (hero). */}
      {attached ? (
        <div ref={composerRef} className="absolute inset-x-0 bottom-0 z-30">
          <RecipientComposer
            placeholder={composerPlaceholder}
            onSend={handleSend}
            draft={
              draftFor
                ? {
                    loading: draft.loading,
                    text: draft.text,
                    onRegenerate: regenerateDraft,
                    onClear: clearDraft,
                  }
                : null
            }
          />
        </div>
      ) : inSelection ? (
        <div
          className="absolute inset-x-0 bottom-0 z-30 px-4 pt-3"
          style={{
            paddingBottom: "max(calc(env(safe-area-inset-bottom) - 12px), 8px)",
            background:
              "linear-gradient(180deg, var(--glass-relvo-1), var(--glass-relvo-2))",
            backdropFilter: "blur(28px) saturate(170%)",
            WebkitBackdropFilter: "blur(28px) saturate(170%)",
            boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.22)",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="flex-1 text-[13px] font-semibold text-white">
              {selectedMessageId
                ? "Toute la suite sera écoutée."
                : "Choisissez le message de départ"}
            </span>
            <button
              type="button"
              onClick={resetSelection}
              className="inline-flex items-center gap-1 rounded-full border border-white/35 px-3 py-2 text-[12.5px] font-bold text-white active:bg-white/10"
            >
              <X className="size-4" strokeWidth={2.4} />
              Annuler
            </button>
            <button
              type="button"
              disabled={!selectedMessageId || pending}
              onClick={validateSelection}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-relvo active:opacity-90 disabled:opacity-40"
            >
              <Check className="size-[17px]" strokeWidth={2.6} />
              Valider
            </button>
          </div>
        </div>
      ) : null}

      <SubjectCreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        defaultTitle={title}
        folders={folders}
        pending={pending}
        onCreate={create}
      />

      <SubjectPickerDialog
        open={showPicker}
        onOpenChange={setShowPicker}
        subjects={subjects}
        pending={pending}
        onSelect={link}
      />

      <ContactCreateDialog
        open={contactPrefill != null}
        onOpenChange={(o) => {
          if (!o) setContactPrefill(null);
        }}
        prefill={contactPrefill ?? {}}
      />
    </>
  );
}
