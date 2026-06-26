"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createContactAction } from "@/server/actions/contacts";

// Formulaire de création d'un contact (M9.22). Création manuelle par
// l'utilisateur → `sourceActor: user` côté domaine, donc statut `complete`
// d'emblée (l'invariant « contact créé seulement avec un sujet » vise la
// création AUTOMATIQUE par l'IA, pas la saisie manuelle). À l'enregistrement,
// on redirige vers la fiche du nouveau contact.

type FormState = {
  name: string;
  jobTitle: string;
  company: string;
  email: string;
  phone: string;
};

const FIELDS: { key: keyof FormState; label: string; type?: string }[] = [
  { key: "jobTitle", label: "Fonction" },
  { key: "company", label: "Entreprise" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Téléphone", type: "tel" },
];

export function NewContactForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>({
    name: "",
    jobTitle: "",
    company: "",
    email: "",
    phone: "",
  });

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Le nom est requis.");
      return;
    }
    startTransition(async () => {
      const res = await createContactAction({
        name,
        jobTitle: form.jobTitle.trim() || null,
        company: form.company.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        sourceActor: "user",
      });
      if (res.ok) {
        toast.success("Contact créé");
        router.replace(`/contacts/${res.data.id}`);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="mx-4 mt-4 space-y-3 rounded-2xl border border-(--border-light) bg-white p-4 shadow-(--shadow-card)">
      <Field label="Nom">
        <input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          autoFocus
          placeholder="Prénom Nom"
          className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[14px] outline-none focus:border-relvo"
        />
      </Field>
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
          Créer le contact
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-(--border) px-4 text-[14px] font-semibold text-(--text-secondary)"
        >
          Annuler
        </button>
      </div>
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
