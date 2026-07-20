"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Link2, Loader2, Plus, Unlink } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SubjectPickerDialog,
  type SubjectPickerOption,
} from "@/components/messages/subject-picker-dialog";
import {
  assignMessageAction,
  createSubjectFromMessageAction,
  detachMessageAction,
} from "@/server/actions/messages";
import { folderVisual } from "@/lib/folders";
import { cn } from "@/lib/utils";

// Pop-up « tap sur un message » — SOURCE UNIQUE (2026-07-20).
//
// Elle vivait dans `conversation-thread.tsx` et n'existait donc que sur
// /conversations ; le même geste dans le fil d'un SUJET ne proposait rien de
// comparable. Or c'est le MÊME objet (un message) et le même geste : il doit
// produire le même menu. On factorise ici plutôt que de dupliquer — dupliquer
// aurait garanti la divergence à la prochaine option ajoutée d'un seul côté.
//
// Deux visages, selon que le message est couvert par une fenêtre de sujet :
//   • rattaché   → le sujet (lien) + « Ouvrir le message » + « Détacher » ;
//   • sans sujet → « Ouvrir un sujet » (ce message en devient l'ancre) +
//                  « Rattacher à un sujet existant » + « Ouvrir le message ».
//
// Dans le fil d'un sujet, seul le premier visage se présente (tout y est
// rattaché par construction) — mais le composant reste générique : c'est le
// message qui décide, pas l'écran qui l'affiche.

/** Sujet couvrant un message, tel qu'affiché dans la pop-up. */
export type MessageSubjectRef = {
  id: string;
  reference: string;
  title: string;
  /** Logo du domaine (`{ slug, color, icon }`) → couleur de la pastille. */
  folder: {
    slug?: string | null;
    color?: string | null;
    icon?: string | null;
  } | null;
};

/** Message sélectionné. `null` = pop-up fermée. */
export type MessageSubjectTarget = {
  id: string;
  subject: MessageSubjectRef | null;
};

export function MessageSubjectDialog({
  message,
  onClose,
  subjects = [],
  backTo,
}: {
  message: MessageSubjectTarget | null;
  onClose: () => void;
  /** Sujets candidats au rattachement (fenêtres encore ouvertes). */
  subjects?: SubjectPickerOption[];
  /** Page d'origine, transmise aux liens vers une fiche sujet (`?from=`). */
  backTo: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState(false);

  function close() {
    setPicking(false);
    onClose();
  }

  function detach() {
    if (!message) return;
    startTransition(async () => {
      const res = await detachMessageAction(message.id);
      if (res.ok) {
        toast.success("Message détaché");
        close();
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  /** « Ouvrir un sujet » : CE message devient l'ancre de la nouvelle fenêtre. */
  function openSubject() {
    if (!message) return;
    startTransition(async () => {
      const res = await createSubjectFromMessageAction(message.id);
      if (res.ok) {
        toast.success("Sujet ouvert");
        close();
        router.push(
          `/sujets/${res.data.id}?from=${encodeURIComponent(backTo)}`,
        );
      } else {
        toast.error(res.message);
      }
    });
  }

  function attach(subjectId: string) {
    if (!message) return;
    startTransition(async () => {
      const res = await assignMessageAction(message.id, subjectId);
      if (res.ok) {
        toast.success("Message rattaché au sujet");
        close();
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  const subject = message?.subject ?? null;

  return (
    <>
      <Dialog
        open={message != null && !picking}
        onOpenChange={(o) => (o ? null : close())}
      >
        <DialogContent className="gap-4 p-5">
          <DialogHeader>
            <DialogTitle>
              {subject ? "Message rattaché" : "Message sans sujet"}
            </DialogTitle>
          </DialogHeader>

          {subject ? (
            <>
              <Link
                href={`/sujets/${subject.id}?from=${encodeURIComponent(backTo)}`}
                className="flex items-center gap-3 rounded-xl border border-(--border-light) px-3.5 py-3 active:opacity-90"
              >
                <span
                  className="size-[10px] flex-none rounded-full"
                  style={{
                    background: folderVisual(subject.folder ?? undefined).color,
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">
                    {subject.title}
                  </span>
                  <span className="font-numeric text-[11.5px] text-(--text-tertiary)">
                    {subject.reference}
                  </span>
                </span>
              </Link>

              <div className="flex flex-col gap-2">
                <OpenMessageLink messageId={message!.id} />
                <button
                  type="button"
                  disabled={pending}
                  onClick={detach}
                  className="flex items-center justify-center gap-2 rounded-xl border border-(--border) py-3 text-[14px] font-bold text-(--text-secondary) disabled:opacity-60"
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                  ) : (
                    <Unlink className="size-4" strokeWidth={2.2} />
                  )}
                  Détacher
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={openSubject}
                className="flex items-center justify-center gap-2 rounded-xl bg-relvo py-3 text-[14px] font-bold text-white disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                ) : (
                  <Plus className="size-4" strokeWidth={2.4} />
                )}
                Ouvrir un sujet
              </button>
              <p className="px-1 text-[12px] leading-[1.45] text-(--text-tertiary)">
                Ce message devient l&apos;ancre du sujet : les messages qui
                suivront dans cette conversation lui reviendront
                automatiquement.
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={() => setPicking(true)}
                className="mt-1 flex items-center justify-center gap-2 rounded-xl border border-(--border) py-3 text-[14px] font-bold text-(--text-secondary) disabled:opacity-60"
              >
                <Link2 className="size-4" strokeWidth={2.2} />
                Rattacher à un sujet existant
              </button>
              {message ? <OpenMessageLink messageId={message.id} /> : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SubjectPickerDialog
        open={picking}
        onOpenChange={(o) => (o ? setPicking(true) : close())}
        subjects={subjects}
        onSelect={attach}
        pending={pending}
      />
    </>
  );
}

/**
 * « Ouvrir le message » → la fiche du message (texte complet, PJ, canal exact).
 *
 * Indispensable depuis le fil d'un sujet, où la bulle menait auparavant droit à
 * cette page : la bulle tronque à ~12 lignes, c'est la seule voie vers un long
 * e-mail. On l'ajoute donc AUX DEUX endroits plutôt que de la retirer d'un côté
 * — l'uniformité demandée se fait par le haut, sans perdre d'affordance.
 *
 * Pas de `?from=` : la fiche message calcule déjà son retour (son sujet s'il en
 * a un, la pile des orphelins sinon). On ne lui ajoute pas un second mécanisme.
 */
function OpenMessageLink({ messageId }: { messageId: string }) {
  return (
    <Link
      href={`/messages/${messageId}`}
      className="flex items-center justify-center gap-2 rounded-xl border border-(--border) py-3 text-[14px] font-bold text-(--text-secondary) active:opacity-90"
    >
      <FileText className="size-4" strokeWidth={2.2} />
      Ouvrir le message
    </Link>
  );
}

/**
 * Zone tapable autour d'une bulle de message.
 *
 * On n'enveloppe PAS la bulle dans un <button> : elle contient des liens (URLs
 * cliquables rendues par LinkifiedText), et imbriquer un <a> dans un <button>
 * est invalide — d'où `div role="button"` + la garde sur `closest("a")` : un
 * clic sur un lien ouvre le lien, tout le reste ouvre la pop-up. Ce détail est
 * la vraie raison d'être de ce composant : il ne doit pas être réinventé au
 * deuxième point d'appel.
 */
export function MessageTapArea({
  onTap,
  active = false,
  className,
  children,
}: {
  onTap: () => void;
  /** Message actuellement ouvert dans la pop-up (retour visuel). */
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) return;
        onTap();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onTap();
      }}
      className={cn("cursor-pointer", active && "opacity-80", className)}
    >
      {children}
    </div>
  );
}
