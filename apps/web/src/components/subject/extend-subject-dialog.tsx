"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { extendSubjectToConversationAction } from "@/server/actions/subject-conversations";
import { cn } from "@/lib/utils";

// M6bis.12 — « Écrire à quelqu'un d'autre » depuis la fiche Sujet (cas S).
//
// ⚠️ UN SEUL GESTE CÔTÉ UTILISATEUR. Il choisit une personne, puis par quoi la
// joindre — et c'est tout. Dessous, deux mécaniques opposées : un email CRÉE une
// conversation (nouvel objet = nouvelle clé), un WhatsApp direct RATTACHE celle
// qui existe déjà (une seule par contact, pour toujours). Rien ici ne doit
// laisser transparaître cette différence : ni deux boutons, ni deux libellés, ni
// deux messages de succès. C'est le domaine qui l'absorbe.
//
// Le choix du canal n'est PAS un réglage technique de plus : c'est la question
// « je lui écris par mail ou sur WhatsApp ? », que le dirigeant se pose de toute
// façon. Les canaux dont on n'a pas l'identifiant sont simplement absents.

export type ExtendCandidate = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
};

export function ExtendSubjectDialog({
  subjectId,
  candidates,
  open,
  onOpenChange,
}: {
  subjectId: string;
  /** Contacts pas encore interlocuteurs du sujet et joignables (email ou tél). */
  candidates: ExtendCandidate[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ExtendCandidate | null>(null);

  function close() {
    onOpenChange(false);
    // Réinitialisation différée : évite de voir la liste se vider pendant que la
    // modale se referme.
    setTimeout(() => {
      setPicked(null);
      setQuery("");
    }, 200);
  }

  function extend(contact: ExtendCandidate, channelType: "email" | "whatsapp") {
    startTransition(async () => {
      const res = await extendSubjectToConversationAction({
        subjectId,
        contactId: contact.id,
        channelType,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(`${contact.name} ajouté au sujet`);
      close();
      router.refresh();
    });
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? candidates.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.company ?? "").toLowerCase().includes(q),
      )
    : candidates;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="gap-4 p-5">
        <DialogHeader>
          <DialogTitle>
            {picked ? `Écrire à ${picked.name}` : "Écrire à quelqu'un d'autre"}
          </DialogTitle>
          <DialogDescription>
            {picked
              ? "Par quel canal le joindre à propos de ce sujet ?"
              : "La conversation sera rattachée à ce sujet : les réponses y reviendront."}
          </DialogDescription>
        </DialogHeader>

        {picked ? (
          <div className="space-y-2">
            <button
              type="button"
              disabled={!picked.email || pending}
              onClick={() => extend(picked, "email")}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border border-(--border) px-3 py-3 text-left",
                !picked.email && "opacity-40",
              )}
            >
              <Mail
                className="size-[18px] flex-none text-relvo"
                strokeWidth={2}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-bold">Email</span>
                <span className="block truncate text-[12.5px] text-(--text-tertiary)">
                  {picked.email ?? "Aucune adresse connue"}
                </span>
              </span>
            </button>

            <button
              type="button"
              disabled={!picked.phone || pending}
              onClick={() => extend(picked, "whatsapp")}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border border-(--border) px-3 py-3 text-left",
                !picked.phone && "opacity-40",
              )}
            >
              <MessageCircle
                className="size-[18px] flex-none text-(--green-600)"
                strokeWidth={2}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-bold">WhatsApp</span>
                <span className="block truncate text-[12.5px] text-(--text-tertiary)">
                  {picked.phone ?? "Aucun numéro connu"}
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPicked(null)}
              className="inline-flex items-center gap-1.5 pt-1 text-[13px] font-bold text-(--text-secondary)"
            >
              <ArrowLeft className="size-4" strokeWidth={2.4} />
              Choisir une autre personne
            </button>
          </div>
        ) : candidates.length === 0 ? (
          <p className="text-[13.5px] text-(--text-tertiary)">
            Tous vos contacts joignables sont déjà interlocuteurs de ce sujet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-(--border-light)">
            <div className="flex items-center gap-2 border-b border-(--border-light) px-3 py-2.5">
              <Search
                className="size-4 flex-none text-(--text-tertiary)"
                strokeWidth={2}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un contact"
                autoFocus
                className="min-w-0 flex-1 border-none bg-transparent text-[14px] outline-none"
              />
            </div>
            <div className="max-h-[240px] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-[13px] text-(--text-tertiary)">
                  Aucun contact.
                </p>
              ) : (
                filtered.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setPicked(c)}
                    className="block w-full border-b border-(--border-light) px-3 py-2.5 text-left last:border-b-0"
                  >
                    <span className="block text-[14px] font-semibold">
                      {c.name}
                    </span>
                    {c.company ? (
                      <span className="block text-[12px] text-(--text-tertiary)">
                        {c.company}
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
