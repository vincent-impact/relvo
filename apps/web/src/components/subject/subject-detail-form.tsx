"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { Priority, SubjectStatus } from "@relvo/db";
import {
  createSubjectAction,
  deleteSubjectAction,
  setSubjectPriorityAction,
  setSubjectStatusAction,
  updateSubjectAction,
} from "@/server/actions/subjects";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";
import { folderVisual } from "@/lib/folders";

// Onglet « Détail » de la fiche Sujet (Direction B) — paramétrage des propriétés
// du sujet : nom, urgence, état, destinataires, dossier. En mode `edit` chaque
// champ s'enregistre immédiatement (action dédiée + refresh). En mode `create`
// le même formulaire sert de set-up à la création manuelle (un seul « Créer »).

export type FolderOption = { id: string; name: string; slug: string | null };
export type ContactOption = {
  id: string;
  name: string;
  company: string | null;
};

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
];

const STATUSES: { value: SubjectStatus; label: string }[] = [
  { value: "new", label: "Nouveau" },
  { value: "acknowledged", label: "En cours" },
  { value: "resolved", label: "Terminé" },
  { value: "ignored", label: "Ignoré" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[12px] font-bold tracking-[0.4px] text-(--text-tertiary) uppercase">
      {children}
    </div>
  );
}

function PillSelect<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full border px-3.5 py-2 text-[13.5px] font-semibold transition-colors",
              active
                ? "border-relvo bg-relvo text-white"
                : "border-(--border) bg-white text-(--text-secondary)",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SubjectDetailForm({
  mode,
  subjectId,
  folders,
  contacts,
  initial,
}: {
  mode: "edit" | "create";
  subjectId?: string;
  folders: FolderOption[];
  contacts: ContactOption[];
  initial: {
    title: string;
    status: SubjectStatus;
    priority: Priority;
    folderId: string | null;
    contactIds: string[];
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(initial);
  const [addingContact, setAddingContact] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const titleRef = useRef(initial.title);
  const isEdit = mode === "edit";

  // En mode édition : enregistre immédiatement via l'action passée puis refresh.
  function persist(
    run: () => Promise<{ ok: true } | { ok: false; message: string }>,
    okMsg?: string,
  ) {
    if (!isEdit) return;
    startTransition(async () => {
      const res = await run();
      if (res.ok) {
        if (okMsg) toast.success(okMsg);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function setPriority(priority: Priority) {
    setForm((f) => ({ ...f, priority }));
    if (isEdit && subjectId)
      persist(() => setSubjectPriorityAction(subjectId, priority));
  }

  function setStatus(status: SubjectStatus) {
    setForm((f) => ({ ...f, status }));
    if (isEdit && subjectId)
      persist(
        () => setSubjectStatusAction(subjectId, status),
        "État mis à jour",
      );
  }

  function setFolder(folderId: string) {
    const next = form.folderId === folderId ? null : folderId;
    setForm((f) => ({ ...f, folderId: next }));
    if (isEdit && subjectId)
      persist(() => updateSubjectAction(subjectId, { folderId: next }));
  }

  function setContacts(contactIds: string[]) {
    setForm((f) => ({ ...f, contactIds }));
    if (isEdit && subjectId)
      persist(() => updateSubjectAction(subjectId, { contactIds }));
  }

  function saveTitle() {
    const title = form.title.trim();
    if (!isEdit || !subjectId || !title || title === titleRef.current) return;
    titleRef.current = title;
    persist(() => updateSubjectAction(subjectId, { title }), "Nom mis à jour");
  }

  function create() {
    const title = form.title.trim();
    if (!title) {
      toast.error("Un nom est requis.");
      return;
    }
    startTransition(async () => {
      const res = await createSubjectAction({
        title,
        priority: form.priority,
        folderId: form.folderId,
        contactIds: form.contactIds,
      });
      if (res.ok) {
        toast.success("Sujet créé");
        router.push(`/sujets/${res.data.id}`);
      } else {
        toast.error(res.message);
      }
    });
  }

  const selectedContacts = form.contactIds
    .map((id) => contacts.find((c) => c.id === id))
    .filter((c): c is ContactOption => Boolean(c));
  const availableContacts = contacts.filter(
    (c) => !form.contactIds.includes(c.id),
  );

  return (
    <div className="space-y-6 px-4 pt-5">
      <div>
        <FieldLabel>Nom du sujet</FieldLabel>
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          onBlur={saveTitle}
          placeholder="Intitulé du sujet…"
          className="w-full rounded-xl border border-(--border) px-3.5 py-3 text-[15px] font-semibold outline-none focus:border-relvo"
        />
      </div>

      <div>
        <FieldLabel>Niveau d’urgence</FieldLabel>
        <PillSelect
          options={PRIORITIES}
          value={form.priority}
          onChange={setPriority}
        />
      </div>

      {isEdit ? (
        <div>
          <FieldLabel>État</FieldLabel>
          <PillSelect
            options={STATUSES}
            value={form.status}
            onChange={setStatus}
          />
        </div>
      ) : null}

      <div>
        <FieldLabel>Domaine</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {folders.map((fo) => {
            const active = fo.id === form.folderId;
            const { color, icon: Icon } = folderVisual(fo.slug);
            return (
              <button
                key={fo.id}
                type="button"
                onClick={() => setFolder(fo.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border py-2 pr-3.5 pl-2.5 text-[13.5px] font-semibold transition-colors",
                  active
                    ? "border-relvo bg-relvo text-white"
                    : "border-(--border) bg-white text-(--text-secondary)",
                )}
              >
                <Icon
                  className="size-[17px] flex-none"
                  strokeWidth={2}
                  style={{ color: active ? "#fff" : color }}
                />
                {fo.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <FieldLabel>Destinataires</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {selectedContacts.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-(--amber-50) py-1.5 pr-1.5 pl-3 text-[13px] font-semibold text-(--amber-800)"
            >
              {c.name}
              <button
                type="button"
                aria-label={`Retirer ${c.name}`}
                onClick={() =>
                  setContacts(form.contactIds.filter((id) => id !== c.id))
                }
                className="grid size-[18px] place-items-center rounded-full bg-(--amber-600)/15"
              >
                <X className="size-3" strokeWidth={2.6} />
              </button>
            </span>
          ))}
          {availableContacts.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setAddingContact((v) => !v);
                setContactQuery("");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-(--border) px-3 py-1.5 text-[13px] font-semibold text-(--text-tertiary)"
            >
              <Plus className="size-3.5" strokeWidth={2.4} />
              Ajouter
            </button>
          ) : null}
        </div>
        {addingContact && availableContacts.length > 0 ? (
          <div className="mt-2 overflow-hidden rounded-xl border border-(--border-light) bg-white shadow-(--shadow-card)">
            <div className="flex items-center gap-2 border-b border-(--border-light) px-3.5 py-2.5">
              <Search
                className="size-[16px] flex-none text-(--text-tertiary)"
                strokeWidth={2}
              />
              <input
                autoFocus
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                placeholder="Rechercher un contact…"
                className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] outline-none"
              />
            </div>
            <div className="max-h-[220px] overflow-y-auto">
              {(() => {
                const q = contactQuery.trim().toLowerCase();
                const filtered = (
                  q
                    ? availableContacts.filter(
                        (c) =>
                          c.name.toLowerCase().includes(q) ||
                          c.company?.toLowerCase().includes(q),
                      )
                    : availableContacts
                ).slice(0, 50);
                if (filtered.length === 0) {
                  return (
                    <p className="px-3.5 py-3 text-[13px] text-(--text-tertiary)">
                      Aucun contact trouvé.
                    </p>
                  );
                }
                return filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setContacts([...form.contactIds, c.id]);
                      setAddingContact(false);
                      setContactQuery("");
                    }}
                    className="flex w-full items-center gap-2 border-b border-(--border-light) px-3.5 py-2.5 text-left text-[13.5px] last:border-b-0"
                  >
                    <span className="font-semibold">{c.name}</span>
                    {c.company ? (
                      <span className="truncate text-(--text-tertiary)">
                        · {c.company}
                      </span>
                    ) : null}
                  </button>
                ));
              })()}
            </div>
          </div>
        ) : null}
      </div>

      {!isEdit ? (
        <button
          type="button"
          onClick={create}
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-relvo py-3.5 text-[15px] font-bold text-white disabled:opacity-60"
        >
          <Check className="size-5" strokeWidth={2.4} />
          Créer le sujet
        </button>
      ) : null}
    </div>
  );
}

// Zone de suppression — placée en toute fin de l'onglet Détails (après PJ/Journal).
// La confirmation passe par une modale centrale réutilisable (ConfirmDialog).
// La suppression cascade tâches + journal (schéma DB).
export function SubjectDangerZone({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function remove() {
    startTransition(async () => {
      const res = await deleteSubjectAction(subjectId);
      if (res.ok) {
        toast.success("Sujet supprimé");
        router.push("/fil");
      } else {
        toast.error(res.message);
        setOpen(false);
      }
    });
  }

  return (
    <div className="mx-4 mt-6 border-t border-(--border-light) pt-5">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-(--red-200) py-3 text-[14px] font-semibold text-(--red-600)"
      >
        <Trash2 className="size-[18px]" strokeWidth={2} />
        Supprimer le sujet
      </button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="destructive"
        icon={Trash2}
        title="Supprimer ce sujet ?"
        description="Ses tâches et tout son journal seront définitivement effacés. Cette action est irréversible."
        confirmLabel="Supprimer"
        pending={pending}
        onConfirm={remove}
      />
    </div>
  );
}
