"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Mail, MessageCircle, VolumeX } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { detachConversationFromSubjectAction } from "@/server/actions/subject-conversations";
import { cn } from "@/lib/utils";

// Sélecteur de conversation de la fiche Sujet (M6ter, invariant n°11). La fiche
// n'affiche qu'UNE conversation à la fois : une LIGNE unique (icône du canal +
// nom + état d'écoute) en tête de l'onglet Conversations, TAPABLE → une FEUILLE
// listant toutes les conversations du sujet avec leur état et l'action « arrêter
// l'écoute ». C'est à la fois le SÉLECTEUR (le composer se synchronise dessus) et
// la surface de GESTION DES ÉCOUTES.

export type SubjectConversationOption = {
  conversationId: string;
  title: string;
  channelType: string;
  /** Clé de synchronisation du composer/fil : id du contact, ou « all » (groupe). */
  contactKey: string;
  state: "active" | "paused" | "ended";
};

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email: Mail,
  whatsapp: MessageCircle,
};

const STATE: Record<
  SubjectConversationOption["state"],
  { label: string; dot: string; text: string }
> = {
  active: {
    label: "Écoute active",
    dot: "bg-(--green-600)",
    text: "text-(--green-600)",
  },
  paused: {
    label: "En pause",
    dot: "bg-(--amber-600)",
    text: "text-(--amber-600)",
  },
  ended: {
    label: "Écoute terminée",
    dot: "bg-(--text-tertiary)",
    text: "text-(--text-tertiary)",
  },
};

function ChannelIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const Icon = CHANNEL_ICON[type] ?? Mail;
  return <Icon className={className} strokeWidth={2} />;
}

export function ConversationSelector({
  conversations,
  selectedKey,
  onSelect,
  subjectId,
}: {
  conversations: SubjectConversationOption[];
  selectedKey: string;
  onSelect: (contactKey: string) => void;
  subjectId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Une seule conversation → pas de sélecteur, juste l'entête (mais on garde la
  // gestion des écoutes accessible via la ligne, tapable).
  const current =
    conversations.find((c) => c.contactKey === selectedKey) ??
    conversations.find((c) => c.state === "active") ??
    conversations[0];
  if (!current) return null;

  function pick(c: SubjectConversationOption) {
    onSelect(c.contactKey);
    setOpen(false);
  }

  function stopListening(c: SubjectConversationOption) {
    startTransition(async () => {
      const res = await detachConversationFromSubjectAction({
        subjectId,
        conversationId: c.conversationId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Écoute arrêtée");
      setOpen(false);
      router.refresh();
    });
  }

  const cur = STATE[current.state];

  return (
    <>
      {/* La LIGNE unique : la conversation courante + son état, tapable. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 border-b border-(--border) bg-(--surface-2) px-[18px] py-2.5 text-left"
      >
        <ChannelIcon
          type={current.channelType}
          className="size-[17px] flex-none text-(--text-secondary)"
        />
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-(--text-primary)">
          {current.title}
        </span>
        <span
          className={cn("flex items-center gap-1.5 text-[11.5px]", cur.text)}
        >
          <span className={cn("size-2 rounded-full", cur.dot)} />
          {cur.label}
        </span>
        {conversations.length > 1 ? (
          <ChevronDown
            className="size-4 flex-none text-(--text-tertiary)"
            strokeWidth={2.2}
          />
        ) : null}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-3 p-5">
          <DialogHeader>
            <DialogTitle>Conversations du sujet</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            {conversations.map((c) => {
              const st = STATE[c.state];
              const selected = c.contactKey === current.contactKey;
              return (
                <div
                  key={c.conversationId}
                  className={cn(
                    "rounded-xl border px-3 py-2.5",
                    selected
                      ? "border-brand bg-(--blue-50)"
                      : "border-(--border)",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    className="flex w-full items-center gap-2.5 text-left"
                  >
                    <ChannelIcon
                      type={c.channelType}
                      className="size-[18px] flex-none text-(--text-secondary)"
                    />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-(--text-primary)">
                      {c.title}
                    </span>
                    <span
                      className={cn(
                        "flex flex-none items-center gap-1.5 text-[11.5px]",
                        st.text,
                      )}
                    >
                      <span className={cn("size-2 rounded-full", st.dot)} />
                      {st.label}
                    </span>
                  </button>

                  {c.state !== "ended" ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => stopListening(c)}
                      className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-accent disabled:opacity-50"
                    >
                      <VolumeX className="size-[15px]" strokeWidth={2.2} />
                      Arrêter l'écoute
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
