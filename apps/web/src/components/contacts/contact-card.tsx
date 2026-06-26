"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  completeContactAction,
  updateContactAction,
} from "@/server/actions/contacts";

// Fiche contact éditable (M9.11) — affichage des coordonnées + édition en place.
// Si le contact est « auto » (créé par Relvo), l'enregistrement le fait passer en
// « complete » (invariant : passage auto → complete validé par l'utilisateur).

type Contact = {
  id: string;
  firstName: string | null;
  lastName: string;
  company: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  status: string;
};

const FIELDS: { key: keyof EditState; label: string; type?: string }[] = [
  { key: "jobTitle", label: "Fonction" },
  { key: "company", label: "Entreprise" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Téléphone", type: "tel" },
];

type EditState = {
  firstName: string;
  lastName: string;
  company: string;
  jobTitle: string;
  email: string;
  phone: string;
};

export function ContactCard({ contact }: { contact: Contact }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<EditState>({
    firstName: contact.firstName ?? "",
    lastName: contact.lastName,
    company: contact.company ?? "",
    jobTitle: contact.jobTitle ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
  });
  const auto = contact.status === "auto";

  function set(key: keyof EditState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    if (!form.lastName.trim()) {
      toast.error("Le nom est requis.");
      return;
    }
    const input = {
      firstName: form.firstName.trim() || null,
      lastName: form.lastName.trim(),
      company: form.company.trim() || null,
      jobTitle: form.jobTitle.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    };
    startTransition(async () => {
      const res = auto
        ? await completeContactAction(contact.id, input)
        : await updateContactAction(contact.id, input);
      if (res.ok) {
        toast.success(auto ? "Fiche complétée" : "Fiche mise à jour");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  if (editing) {
    return (
      <div className="mx-4 mt-4 space-y-3 rounded-2xl border border-(--border-light) bg-white p-4 shadow-(--shadow-card)">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom">
            <input
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[14px] outline-none focus:border-relvo"
            />
          </Field>
          <Field label="Nom">
            <input
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[14px] outline-none focus:border-relvo"
            />
          </Field>
        </div>
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <input
              type={f.type ?? "text"}
              value={form[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[14px] outline-none focus:border-relvo"
            />
          </Field>
        ))}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="flex-1 rounded-xl bg-relvo py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
          >
            {auto ? "Enregistrer et compléter" : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-xl border border-(--border) px-4 text-[14px] font-semibold text-(--text-secondary)"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  const rows = [
    { label: "Fonction", value: contact.jobTitle },
    { label: "Entreprise", value: contact.company },
    { label: "Email", value: contact.email },
    { label: "Téléphone", value: contact.phone },
  ].filter((r) => r.value);

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-(--border-light) bg-white p-4 shadow-(--shadow-card)">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {rows.length === 0 ? (
            <p className="text-[13.5px] text-(--text-tertiary)">
              Aucune coordonnée renseignée.
            </p>
          ) : (
            <dl className="space-y-2">
              {rows.map((r) => (
                <div key={r.label} className="flex gap-2 text-[13.5px]">
                  <dt className="w-[88px] flex-none text-(--text-tertiary)">
                    {r.label}
                  </dt>
                  <dd className="min-w-0 flex-1 font-medium break-words">
                    {r.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Modifier la fiche"
          className="grid size-9 flex-none place-items-center rounded-full bg-(--surface) text-(--text-secondary)"
        >
          <Pencil className="size-[16px]" strokeWidth={2} />
        </button>
      </div>
      {auto ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-(--amber-50) px-3 py-1.5 text-[12.5px] font-bold text-(--amber-800)"
        >
          <Check className="size-3.5" strokeWidth={2.4} />
          Compléter la fiche
        </button>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-semibold text-(--text-secondary)">
        {label}
      </span>
      {children}
    </label>
  );
}
