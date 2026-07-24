"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, MessageCircle, Search, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Dialog « Ajouter une conversation » à un sujet (2026-07-24, item 4). La
// création part TOUJOURS d'un sujet (décision produit) : on ajoute un
// interlocuteur/fil à ce sujet, jamais une conversation flottante.
//
//   • E-mail   → une VRAIE nouvelle conversation est créée (objet = celui saisi,
//     défaut = titre du sujet) et rattachée au sujet.
//   • WhatsApp → on n'OUVRE qu'un fil DÉJÀ existant (direct avec un contact, ou
//     un groupe) et on le rattache : démarrer un nouveau fil WhatsApp est reporté.

export type AddConvContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};
export type AddConvGroup = { id: string; title: string };

export type AddConversationSubmit =
  | { kind: "email"; contactId: string; subjectLine: string }
  | { kind: "whatsapp-contact"; contactId: string }
  | { kind: "whatsapp-group"; conversationId: string };

type Channel = "email" | "whatsapp";

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function AddConversationDialog({
  open,
  onOpenChange,
  subjectTitle,
  availableChannels,
  contacts,
  groups,
  pending = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectTitle: string;
  /** Canaux CONNECTÉS du compte (email et/ou whatsapp). */
  availableChannels: Channel[];
  contacts: AddConvContact[];
  groups: AddConvGroup[];
  pending?: boolean;
  onSubmit: (input: AddConversationSubmit) => void;
}) {
  const [channel, setChannel] = useState<Channel>(
    availableChannels[0] ?? "email",
  );
  // Sous-mode WhatsApp : direct (contact) ou groupe.
  const [waMode, setWaMode] = useState<"contact" | "group">("contact");
  const [contactId, setContactId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [subjectLine, setSubjectLine] = useState(subjectTitle);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setChannel(availableChannels[0] ?? "email");
      setWaMode("contact");
      setContactId(null);
      setGroupId(null);
      setSubjectLine(subjectTitle);
      setQuery("");
    }
  }, [open, subjectTitle, availableChannels]);

  // Garde-fou : rester sur WhatsApp sans agir 7 s ramène le canal sur E-mail
  // (demande produit 2026-07-24). Toute interaction réarme le délai — c'est
  // une inactivité, pas un compte à rebours dur.
  useEffect(() => {
    if (!open || channel !== "whatsapp") return;
    const t = setTimeout(() => {
      setChannel("email");
      setWaMode("contact");
      setContactId(null);
      setGroupId(null);
      setQuery("");
    }, 7000);
    return () => clearTimeout(t);
  }, [open, channel, waMode, contactId, groupId, query]);

  const isEmail = channel === "email";
  const wantGroup = channel === "whatsapp" && waMode === "group";

  // Contacts éligibles : ceux qui portent l'identifiant du canal choisi.
  const eligibleContacts = useMemo(() => {
    const q = fold(query.trim());
    const withId = contacts.filter((c) => (isEmail ? c.email : c.phone));
    return q ? withId.filter((c) => fold(c.name).includes(q)) : withId;
  }, [contacts, isEmail, query]);

  const eligibleGroups = useMemo(() => {
    const q = fold(query.trim());
    return q ? groups.filter((g) => fold(g.title).includes(q)) : groups;
  }, [groups, query]);

  const canSubmit =
    !pending &&
    (wantGroup
      ? groupId != null
      : contactId != null && (!isEmail || subjectLine.trim().length > 0));

  function submit() {
    if (!canSubmit) return;
    if (wantGroup && groupId) {
      onSubmit({ kind: "whatsapp-group", conversationId: groupId });
    } else if (contactId) {
      onSubmit(
        isEmail
          ? { kind: "email", contactId, subjectLine: subjectLine.trim() }
          : { kind: "whatsapp-contact", contactId },
      );
    }
  }

  const bothChannels = availableChannels.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 p-5">
        <DialogHeader>
          <DialogTitle>Ajouter une conversation</DialogTitle>
        </DialogHeader>

        {/* Canal — segmented (masqué si un seul canal connecté). */}
        {bothChannels ? (
          <div className="flex gap-1.5 rounded-full bg-(--surface-2) p-1">
            {(["email", "whatsapp"] as const)
              .filter((c) => availableChannels.includes(c))
              .map((c) => {
                const active = channel === c;
                const Icon = c === "email" ? Mail : MessageCircle;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setChannel(c);
                      setContactId(null);
                      setGroupId(null);
                      setQuery("");
                    }}
                    className={cn(
                      "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-bold transition-colors",
                      active
                        ? "bg-relvo text-white"
                        : "text-(--text-secondary)",
                    )}
                  >
                    <Icon className="size-4" strokeWidth={2.2} />
                    {c === "email" ? "E-mail" : "WhatsApp"}
                  </button>
                );
              })}
          </div>
        ) : null}

        {/* WhatsApp : direct vs groupe. */}
        {channel === "whatsapp" ? (
          <div className="flex gap-2">
            {(["contact", "group"] as const).map((m) => {
              const active = waMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setWaMode(m);
                    setContactId(null);
                    setGroupId(null);
                    setQuery("");
                  }}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-[12.5px] font-semibold transition-colors",
                    active
                      ? "border-transparent bg-(--text-primary) text-white"
                      : "border-(--border) bg-white text-(--text-secondary)",
                  )}
                >
                  {m === "contact" ? "Contact direct" : "Groupe"}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Recherche + liste des destinataires. */}
        <div>
          <label className="mb-1 block text-[12.5px] font-bold text-(--text-secondary)">
            {wantGroup ? "Groupe" : "Destinataire"}
          </label>
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-(--border) px-3">
            <Search
              className="size-4 flex-none text-(--text-tertiary)"
              strokeWidth={2}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="w-full py-2.5 text-[14px] outline-none"
            />
          </div>

          <div className="max-h-52 overflow-y-auto rounded-xl border border-(--border)">
            {wantGroup ? (
              eligibleGroups.length === 0 ? (
                <p className="px-3 py-4 text-center text-[13px] text-(--text-tertiary)">
                  Aucun groupe WhatsApp.
                </p>
              ) : (
                eligibleGroups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGroupId(g.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 border-b border-(--border-light) px-3 py-2.5 text-left last:border-b-0",
                      groupId === g.id
                        ? "bg-(--blue-50)"
                        : "active:bg-(--surface-2)",
                    )}
                  >
                    <span className="grid size-8 flex-none place-items-center rounded-full bg-(--green-600) text-white">
                      <Users className="size-[17px]" strokeWidth={2.2} />
                    </span>
                    <span className="truncate text-[14px] font-semibold">
                      {g.title}
                    </span>
                  </button>
                ))
              )
            ) : eligibleContacts.length === 0 ? (
              <p className="px-3 py-4 text-center text-[13px] text-(--text-tertiary)">
                {isEmail
                  ? "Aucun contact avec une adresse e-mail."
                  : "Aucun contact avec un numéro."}
              </p>
            ) : (
              eligibleContacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setContactId(c.id)}
                  className={cn(
                    "flex w-full flex-col border-b border-(--border-light) px-3 py-2.5 text-left last:border-b-0",
                    contactId === c.id
                      ? "bg-(--blue-50)"
                      : "active:bg-(--surface-2)",
                  )}
                >
                  <span className="truncate text-[14px] font-semibold">
                    {c.name}
                  </span>
                  <span className="truncate text-[12px] text-(--text-tertiary)">
                    {isEmail ? c.email : c.phone}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Objet (email uniquement) — porte la clé de la conversation. */}
        {isEmail ? (
          <div>
            <label className="mb-1 block text-[12.5px] font-bold text-(--text-secondary)">
              Objet
            </label>
            <input
              value={subjectLine}
              onChange={(e) => setSubjectLine(e.target.value)}
              placeholder="Objet de l'e-mail"
              className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[14.5px] outline-none focus:border-brand"
            />
          </div>
        ) : null}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="mt-1 w-full rounded-full bg-brand py-3 text-[14.5px] font-bold text-white active:opacity-90 disabled:opacity-50"
        >
          {isEmail ? "Créer la conversation" : "Ouvrir la conversation"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
