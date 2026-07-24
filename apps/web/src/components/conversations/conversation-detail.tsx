"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  EyeOff,
  Link2,
  Mail,
  MessageCircle,
  Plus,
  Unlink,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { ConversationListening, ConversationParticipant } from "@relvo/db";
import { ConversationThread } from "@/components/conversations/conversation-thread";
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
import {
  createSubjectFromConversationAction,
  ignoreConversationAction,
} from "@/server/actions/conversations";
import { createSubjectFromMessageAction } from "@/server/actions/messages";
import {
  attachConversationToSubjectAction,
  attachConversationToSubjectFromMessageAction,
  detachConversationFromSubjectAction,
} from "@/server/actions/subject-conversations";
import { folderVisual } from "@/lib/folders";
import { initialsFor } from "@/lib/display";
import { avatarIconFor, guessContactKind } from "@/lib/contact-avatar";
import {
  ContactCreateDialog,
  type ContactPrefill,
} from "@/components/contacts/contact-create-dialog";
import type { ThreadMessageData } from "@/lib/conversation-row";
import { cn } from "@/lib/utils";

// Détail d'une conversation (header enrichi 2026-07-23, v3). TOUT le contexte vit
// dans le hero violet ; le dock d'action propose TROIS gestes : « Ignorer »,
// « Lier » (à un sujet existant) et « Nouveau sujet ». La décision se prend ICI,
// en lisant les messages — plus de swipe droite depuis la liste.
//
//   • email    → Nouveau sujet / Lier agissent sur TOUT le fil (le sujet EST le
//     fil) → dialog immédiat.
//   • WhatsApp → on demande d'abord de CHOISIR le message de départ (le dock passe
//     en sélection) ; un cordon violet montre la portée ; on VALIDE, puis le
//     dialog (création) ou le sélecteur de sujet (lien) s'ouvre.

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
  isGroup,
  participants,
  listenings,
  messages,
  backTo,
  folders,
  subjects,
}: {
  conversationId: string;
  title: string;
  channelType: string;
  isGroup: boolean;
  /** Tous les interlocuteurs du fil (≥1 pour un groupe actif). */
  participants: ConversationParticipant[];
  listenings: ConversationListening[];
  messages: ThreadMessageData[];
  backTo: string;
  /** Domaines pour le dialog de création. */
  folders: FolderOption[];
  /** Sujets ouverts candidats au « Lier à un sujet existant ». */
  subjects: SubjectPickerOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Sélection WhatsApp : intent (create/link) + message de départ choisi.
  const [selecting, setSelecting] = useState<Intent | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [showCreate, setShowCreate] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [contactPrefill, setContactPrefill] = useState<ContactPrefill | null>(
    null,
  );

  const isEmail = channelType === "email";
  const ChannelIcon = CHANNEL_ICON[channelType] ?? Mail;
  const channelLabel = CHANNEL_LABEL[channelType] ?? "Canal";

  // Tap sur un interlocuteur : sa fiche s'il est connu, sinon la pop-up de
  // création pré-remplie (même comportement que la liste /conversations).
  function tapParticipant(p: ConversationParticipant) {
    if (p.contactId) {
      router.push(`/contacts/${p.contactId}`);
      return;
    }
    const raw = p.raw?.trim() ?? null;
    setContactPrefill({
      name: p.name,
      email: isEmail ? raw : null,
      phone: isEmail ? null : (raw?.split("@")[0] ?? null),
    });
  }

  // Détacher CETTE conversation d'un sujet (icône chaîne brisée, item 3e).
  function detach(subjectId: string) {
    startTransition(async () => {
      const res = await detachConversationFromSubjectAction({
        subjectId,
        conversationId,
      });
      if (res.ok) {
        toast.success("Conversation détachée du sujet");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function resetSelection() {
    setSelecting(null);
    setSelectedMessageId(null);
  }

  function ignore() {
    startTransition(async () => {
      const res = await ignoreConversationAction(conversationId);
      if (res.ok) {
        toast.success("Conversation ignorée");
        router.push(backTo);
      } else {
        toast.error(res.message);
      }
    });
  }

  // « Nouveau sujet » : email → dialog direct ; WhatsApp → sélection du message.
  function startCreate() {
    if (isEmail) {
      setShowCreate(true);
      return;
    }
    setSelectedMessageId(null);
    setSelecting("create");
  }

  // « Lier » : email → sélecteur de sujet direct ; WhatsApp → sélection du message.
  function startLink() {
    if (subjects.length === 0) {
      toast.info("Aucun sujet ouvert où rattacher cette conversation.");
      return;
    }
    if (isEmail) {
      setShowPicker(true);
      return;
    }
    setSelectedMessageId(null);
    setSelecting("link");
  }

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

  return (
    <>
      <Screen>
        <RelvoHeader
          back={backTo}
          relvo={false}
          titleFull
          title={title}
          className="pb-6"
        >
          <div className="space-y-4 px-[22px] pt-3">
            {/* Canal, sous le titre (icône + nom). */}
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-(--on-violet)">
              <ChannelIcon className="size-[14px] flex-none" strokeWidth={2} />
              {channelLabel}
            </div>

            {/* Interlocuteurs — TOUS les contacts du fil, en colonne compacte.
                Tap = fiche (enregistré) ou pop-up de création (non enregistré) ;
                pas de sous-libellé, avatar réduit. */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.3px] text-(--on-violet) uppercase">
                {isGroup ? (
                  <>
                    <Users className="size-3.5" strokeWidth={2.4} />
                    Groupe · {participants.length} membre
                    {participants.length > 1 ? "s" : ""}
                  </>
                ) : (
                  `Interlocuteur${participants.length > 1 ? "s" : ""}`
                )}
              </div>
              {participants.length === 0 ? (
                <p className="text-[13px] text-white/70 italic">
                  Aucun interlocuteur identifié.
                </p>
              ) : (
                participants.map((p, i) => {
                  const PIcon = avatarIconFor(
                    guessContactKind({ name: p.name, raw: p.raw }),
                  );
                  return (
                    <button
                      key={`${p.contactId ?? p.raw ?? p.name}-${i}`}
                      type="button"
                      onClick={() => tapParticipant(p)}
                      aria-label={
                        p.contactId
                          ? "Voir le contact"
                          : "Enregistrer le contact"
                      }
                      className="flex w-full items-center gap-2 active:opacity-80"
                    >
                      <span className="grid size-8 flex-none place-items-center rounded-full bg-white/20 text-[12px] font-extrabold text-white">
                        {p.contactId ? (
                          (initialsFor(p.name) ?? "?")
                        ) : (
                          <PIcon className="size-[17px]" strokeWidth={2.1} />
                        )}
                      </span>
                      <span className="truncate text-[14px] font-semibold text-white">
                        {p.name}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Sujets suivis — liste verticale ; chaîne brisée = détacher (3e). */}
            {listenings.length > 0 ? (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold tracking-[0.3px] text-(--on-violet) uppercase">
                  Suivi dans
                </div>
                {listenings.map((l) => {
                  const color = folderVisual(l.folder ?? undefined).color;
                  return (
                    <div
                      key={l.subjectId}
                      className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 py-1.5 pr-1.5 pl-2.5"
                    >
                      <span
                        className="size-2.5 flex-none rounded-full"
                        style={{ background: color }}
                      />
                      <Link
                        href={`/sujets/${l.subjectId}?from=${encodeURIComponent(backTo)}`}
                        className="min-w-0 flex-1 active:opacity-80"
                      >
                        <span
                          className={cn(
                            "block truncate text-[13.5px] font-semibold text-white",
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
                          onClick={() => detach(l.subjectId)}
                          aria-label="Détacher de ce sujet"
                          className="grid size-8 flex-none place-items-center rounded-full text-white active:bg-white/15 disabled:opacity-50"
                        >
                          <Unlink className="size-[16px]" strokeWidth={2.2} />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </RelvoHeader>

        <ConversationThread
          messages={messages}
          channelType={channelType}
          selecting={inSelection}
          selectedMessageId={selectedMessageId}
          onSelect={setSelectedMessageId}
        />
      </Screen>

      {/* Dock d'action ANCRÉ — chrome violet (verre Relvo). */}
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
        {inSelection ? (
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
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={ignore}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/35 py-2.5 text-[13.5px] font-bold text-white active:bg-white/10 disabled:opacity-50"
            >
              <EyeOff className="size-[16px]" strokeWidth={2} />
              Ignorer
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={startLink}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/35 py-2.5 text-[13.5px] font-bold text-white active:bg-white/10 disabled:opacity-50"
            >
              <Link2 className="size-[16px]" strokeWidth={2.2} />
              Lier
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={startCreate}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-white py-2.5 text-[13.5px] font-bold text-relvo active:opacity-90 disabled:opacity-50"
            >
              <Plus className="size-[18px]" strokeWidth={2.6} />
              Nouveau
            </button>
          </div>
        )}
      </div>

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
