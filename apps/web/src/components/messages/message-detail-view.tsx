"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  Trash2,
  Unlink,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { AttachmentPreview } from "@/components/shared/attachment-preview";
import {
  assignMessageAction,
  createSubjectFromMessageAction,
  detachMessageAction,
  ignoreMessageAction,
  reassignMessageAction,
} from "@/server/actions/messages";
import { CreateContactDialog } from "@/components/messages/create-contact-dialog";
import {
  SubjectPickerDialog,
  type SubjectPickerOption,
} from "@/components/messages/subject-picker-dialog";
import { folderVisual } from "@/lib/folders";
import type { MessageRowData } from "@/lib/message-row";
import { cn } from "@/lib/utils";

// Vue détail d'un message (page /messages/[id]) — texte complet, canal exact +
// type, objet, expéditeur cliquable. Les actions s'adaptent : message ORPHELIN →
// créer un sujet / rattacher / retirer ; message DÉJÀ CLASSÉ → lien vers son
// sujet + déplacer (réaffecter) / détacher. Un message sortant (Moi) reste en
// lecture seule (lien sujet).

const CHANNEL: Record<string, { label: string; icon: typeof Mail }> = {
  email: { label: "Email", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
};

const TAP = "active:opacity-90";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Champ labellisé compact (label réduit + valeur), brique de la grille 2 colonnes. */
function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 text-[10px] font-bold tracking-[0.3px] text-(--text-tertiary) uppercase">
        {label}
      </div>
      <div className="min-w-0 text-[13.5px]">{children}</div>
    </div>
  );
}

function contactPrefill(data: MessageRowData) {
  const raw = data.senderRaw ?? data.senderName;
  const looksEmail = data.channelType === "email" && raw.includes("@");
  return {
    name: data.senderName,
    email: looksEmail ? raw : undefined,
    phone:
      data.channelType === "whatsapp"
        ? (data.senderRaw ?? undefined)
        : undefined,
  };
}

export function MessageDetailView({
  data,
  subjects,
}: {
  data: MessageRowData;
  subjects: SubjectPickerOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [contactId, setContactId] = useState(data.senderContactId);
  const [picking, setPicking] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const channel = CHANNEL[data.channelType] ?? { label: "Canal", icon: Mail };
  const ChannelIcon = channel.icon;
  const outgoing = data.direction === "outgoing";
  const classified = Boolean(data.subject);
  const registered = Boolean(contactId);
  // Pour la réaffectation, on exclut le sujet courant de la liste.
  const otherSubjects = subjects.filter((s) => s.id !== data.subject?.id);

  function run(
    action: () => Promise<{ ok: true } | { ok: false; message: string }>,
    okMsg: string,
    redirect: string,
  ) {
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        setPicking(false);
        toast.success(okMsg);
        router.push(redirect);
      } else {
        toast.error(res.message);
      }
    });
  }

  function createSubject() {
    startTransition(async () => {
      const res = await createSubjectFromMessageAction(data.id);
      if (res.ok) {
        toast.success("Sujet créé");
        router.push(`/sujets/${res.data.id}`);
      } else {
        toast.error(res.message);
      }
    });
  }

  // Sélection dans le picker : rattacher (orphelin) ou réaffecter (classé).
  function onPickSubject(subjectId: string) {
    if (classified) {
      run(
        () => reassignMessageAction(data.id, subjectId),
        "Message déplacé",
        `/sujets/${subjectId}`,
      );
    } else {
      run(
        () => assignMessageAction(data.id, subjectId),
        "Message rattaché au sujet",
        "/messages",
      );
    }
  }

  const senderCompact = (
    <>
      <span className="grid size-9 flex-none place-items-center rounded-full bg-(--amber-600) text-[12.5px] font-extrabold text-white">
        {initials(data.senderName)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-bold">
          {data.senderName}
        </span>
        <span className="block text-[11.5px] font-semibold text-relvo">
          {registered ? "Voir le contact" : "Créer un contact"}
        </span>
      </span>
      {registered ? (
        <ChevronRight className="size-5 flex-none text-(--text-tertiary)" />
      ) : (
        <UserPlus className="size-5 flex-none text-relvo" strokeWidth={2.2} />
      )}
    </>
  );

  return (
    <div className="px-4 pt-3.5">
      {/* Bandeau de métadonnées compact — labels réduits + grille 2 colonnes, pour
          que le CONTENU du message remonte au-dessus de la ligne de flottaison. */}
      <div className="rounded-2xl border border-(--border-light) bg-(--surface) p-3.5">
        {/* Expéditeur (ligne pleine, cliquable) */}
        {outgoing ? (
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 flex-none place-items-center rounded-full bg-brand text-[12px] font-extrabold text-white">
              M
            </span>
            <span className="text-[14px] font-bold">Moi</span>
          </div>
        ) : registered ? (
          <Link
            href={`/contacts/${contactId}`}
            className={cn("flex items-center gap-2.5", TAP)}
          >
            {senderCompact}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setContactOpen(true)}
            className={cn("flex w-full items-center gap-2.5 text-left", TAP)}
          >
            {senderCompact}
          </button>
        )}

        <div className="my-3 h-px bg-(--border-light)" />

        {/* Grille 2 colonnes pour les champs courts */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Meta label="Interlocuteur">
            {data.recipientContactId ? (
              <Link
                href={`/contacts/${data.recipientContactId}`}
                className="truncate font-semibold text-relvo"
              >
                {data.recipientName}
              </Link>
            ) : (
              <span className="font-semibold">{data.recipientName}</span>
            )}
          </Meta>

          <Meta label="Domaine">
            {data.folder ? (
              (() => {
                const { color, icon: Icon } = folderVisual(data.folder.slug);
                return (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Icon
                      className="size-4 flex-none"
                      strokeWidth={2}
                      style={{ color }}
                    />
                    <span className="truncate font-semibold">
                      {data.folder.name}
                    </span>
                  </span>
                );
              })()
            ) : (
              <span className="font-semibold text-(--text-tertiary)">
                Non classé
              </span>
            )}
          </Meta>

          <Meta label="Canal">
            <span className="flex min-w-0 items-center gap-1.5">
              <ChannelIcon
                className="size-4 flex-none text-(--text-tertiary)"
                strokeWidth={2}
              />
              <span className="truncate font-semibold">{channel.label}</span>
            </span>
            <span className="mt-0.5 block truncate text-[12px] text-(--text-tertiary)">
              {[data.channelName, data.channelIdentifier]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </Meta>

          <Meta label="Sujet">
            {data.subject ? (
              <Link
                href={`/sujets/${data.subject.id}`}
                className={cn("flex min-w-0 items-center gap-1", TAP)}
              >
                <span className="min-w-0 flex-1 truncate font-semibold text-relvo">
                  {data.subject.title}
                </span>
                <ChevronRight className="size-4 flex-none text-relvo" />
              </Link>
            ) : (
              <span className="font-semibold text-(--text-tertiary)">
                À classer
              </span>
            )}
          </Meta>
        </div>
      </div>

      {/* Objet (e-mails) — titre du message, juste au-dessus du contenu */}
      {data.subjectLine ? (
        <h2 className="mt-4 text-[17px] leading-snug font-bold tracking-[-0.2px]">
          {data.subjectLine}
        </h2>
      ) : null}

      {/* Texte complet — l'info prioritaire, désormais visible sans scroller */}
      <p className="mt-2.5 text-[15px] leading-[1.55] whitespace-pre-wrap text-(--text-primary)">
        {data.content?.trim() || "—"}
      </p>

      {/* Pièces jointes (photos WhatsApp, PJ email) — visibles même orphelin.
          Image → miniature + lightbox, PDF/autre → carte + navigateur. */}
      {data.attachments.length ? (
        <div className="mt-3.5 flex flex-col gap-2">
          {data.attachments.map((a) => (
            <AttachmentPreview key={a.id} attachment={a} />
          ))}
        </div>
      ) : null}

      <div className="mt-1.5 text-[11.5px] text-(--text-tertiary)">
        Reçu · {data.time}
      </div>

      {/* Actions de tri (jamais pour un message sortant) */}
      {!outgoing ? (
        <div className="mt-6 flex flex-wrap gap-2 border-t border-(--border-light) pt-5">
          {classified ? (
            <>
              <button
                type="button"
                onClick={() => setPicking(true)}
                disabled={pending}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-(--border) bg-white px-3 py-3 text-[14px] font-bold text-(--text-secondary) disabled:opacity-60"
              >
                <Link2 className="size-4" strokeWidth={2.4} />
                Déplacer
              </button>
              <button
                type="button"
                onClick={() =>
                  run(
                    () => detachMessageAction(data.id),
                    "Message détaché",
                    "/messages",
                  )
                }
                disabled={pending}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-(--red-200) px-4 py-3 text-[14px] font-bold text-(--red-600) disabled:opacity-60"
              >
                <Unlink className="size-4" strokeWidth={2.2} />
                Détacher
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={createSubject}
                disabled={pending}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-relvo px-3 py-3 text-[14px] font-bold text-white disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2.4} />
                ) : (
                  <Plus className="size-4" strokeWidth={2.6} />
                )}
                Créer un sujet
              </button>
              <button
                type="button"
                onClick={() => setPicking(true)}
                disabled={pending}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-(--border) bg-white px-4 py-3 text-[14px] font-bold text-(--text-secondary) disabled:opacity-60"
              >
                <Link2 className="size-4" strokeWidth={2.4} />
                Rattacher
              </button>
              <button
                type="button"
                onClick={() =>
                  run(
                    () => ignoreMessageAction(data.id),
                    "Message retiré",
                    "/messages",
                  )
                }
                disabled={pending}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-(--red-200) px-4 py-3 text-[14px] font-bold text-(--red-600) disabled:opacity-60"
              >
                <Trash2 className="size-4" strokeWidth={2.2} />
                Retirer
              </button>
            </>
          )}
        </div>
      ) : null}

      <SubjectPickerDialog
        open={picking}
        onOpenChange={setPicking}
        subjects={classified ? otherSubjects : subjects}
        onSelect={onPickSubject}
        pending={pending}
      />

      {!outgoing ? (
        <CreateContactDialog
          open={contactOpen}
          onOpenChange={setContactOpen}
          messageId={data.id}
          prefill={contactPrefill(data)}
          onCreated={(c) => setContactId(c.id)}
        />
      ) : null}
    </div>
  );
}
