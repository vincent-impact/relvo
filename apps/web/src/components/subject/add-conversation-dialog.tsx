"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Envelope, Users, WhatsappLogo } from "@/components/shared/picto";
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
  | {
      kind: "email";
      contactId: string;
      subjectLine: string;
      channelId: string | null;
    }
  | { kind: "whatsapp-contact"; contactId: string }
  | { kind: "whatsapp-group"; conversationId: string };

type Channel = "email" | "whatsapp";

/** Une boîte e-mail connectée du compte, parmi lesquelles on choisit celle qui écrit (M24.8). */
export type AddConvBoite = { id: string; name: string; identifier: string };

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
  forceChannel,
  contacts,
  groups,
  boites = [],
  boiteParContact = {},
  pending = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectTitle: string;
  /** Canaux CONNECTÉS du compte (email et/ou whatsapp). */
  availableChannels: Channel[];
  /** VERROUILLE le canal (onglet E-mail ou Messagerie de la fiche, M6quater) :
   *  le sélecteur de canal disparaît, le dialog ne propose QUE ce canal. */
  forceChannel?: Channel;
  contacts: AddConvContact[];
  groups: AddConvGroup[];
  /** Les boîtes e-mail connectées ; le choix ne se montre qu'à partir de deux. */
  boites?: AddConvBoite[];
  /** La boîte par laquelle chaque contact nous joint — la proposée par défaut. */
  boiteParContact?: Record<string, string>;
  pending?: boolean;
  onSubmit: (input: AddConversationSubmit) => void;
}) {
  const [channel, setChannel] = useState<Channel>(
    forceChannel ?? availableChannels[0] ?? "email",
  );
  // Sous-mode WhatsApp : direct (contact) ou groupe.
  const [waMode, setWaMode] = useState<"contact" | "group">("contact");
  const [contactId, setContactId] = useState<string | null>(null);
  // La boîte qui écrit : choisie à la main, sinon celle par laquelle le
  // contact nous joint, sinon la première (la plus ancienne) du compte.
  const [boiteChoisie, setBoiteChoisie] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [subjectLine, setSubjectLine] = useState(subjectTitle);
  const [query, setQuery] = useState("");

  // Réinitialiser UNIQUEMENT à l'ouverture (faux → vrai). ⚠️ Ne PAS dépendre de
  // l'identité des props (`availableChannels`, `subjectTitle`) : le PollRefresh
  // (récupération périodique des messages Unipile) re-render la page et passe de
  // nouvelles instances de tableau à chaque tour ; un effet qui en dépend
  // remettrait le canal sur « email » toutes les quelques secondes. Le garde
  // `wasOpen` neutralise ces re-runs tout en gardant l'effet exhaustif.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setChannel(forceChannel ?? availableChannels[0] ?? "email");
      setWaMode("contact");
      setContactId(null);
      setBoiteChoisie(null);
      setGroupId(null);
      setSubjectLine(subjectTitle);
      setQuery("");
    }
    wasOpen.current = open;
  }, [open, subjectTitle, availableChannels, forceChannel]);

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

  // La boîte par laquelle le contact nous joint, si elle est connectée —
  // sinon la première (la plus ancienne) : jamais une boîte hors de la liste.
  const prioritaire = contactId ? boiteParContact[contactId] : undefined;
  const boiteParDefaut =
    (prioritaire && boites.some((b) => b.id === prioritaire)
      ? prioritaire
      : boites[0]?.id) ?? null;
  const boiteId =
    boiteChoisie && boites.some((b) => b.id === boiteChoisie)
      ? boiteChoisie
      : boiteParDefaut;

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
          ? {
              kind: "email",
              contactId,
              subjectLine: subjectLine.trim(),
              channelId: boiteId,
            }
          : { kind: "whatsapp-contact", contactId },
      );
    }
  }

  // Sélecteur de canal masqué si un seul canal connecté OU si le canal est
  // verrouillé par l'onglet appelant (E-mail / Messagerie de la fiche).
  const showChannelSwitch = availableChannels.length > 1 && !forceChannel;
  const title = forceChannel
    ? forceChannel === "email"
      ? "Écrire un e-mail"
      : "Écouter une conversation"
    : "Ajouter une conversation";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 p-5">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Canal — segmented (masqué si un seul canal connecté ou verrouillé). */}
        {showChannelSwitch ? (
          <div className="flex gap-1.5 rounded-full bg-(--surface-2) p-1">
            {(["email", "whatsapp"] as const)
              .filter((c) => availableChannels.includes(c))
              .map((c) => {
                const active = channel === c;
                const Icon = c === "email" ? Envelope : WhatsappLogo;
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
                    <Icon className="size-4" />
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
                      <Users className="size-[17px]" />
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

        {/* La boîte qui écrit (M24.8) — seulement quand il y en a plusieurs :
            celle par laquelle le contact nous joint est proposée d'office. */}
        {isEmail && boites.length > 1 ? (
          <div>
            <label className="mb-1 block text-[12.5px] font-bold text-(--text-secondary)">
              Depuis
            </label>
            <div className="overflow-hidden rounded-xl border border-(--border)">
              {boites.map((b) => {
                const active = boiteId === b.id;
                const joint =
                  contactId != null && boiteParContact[contactId] === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBoiteChoisie(b.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 border-b border-(--border-light) px-3 py-2.5 text-left last:border-b-0",
                      active ? "bg-(--blue-50)" : "active:bg-(--surface-2)",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">
                        {b.identifier}
                      </span>
                      {joint ? (
                        <span className="block text-[12px] text-(--text-tertiary)">
                          Il vous joint par cette boîte
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

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
