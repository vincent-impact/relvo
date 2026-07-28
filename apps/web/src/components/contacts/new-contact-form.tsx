"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ContactIdentifierFields,
  splitIdentifierList,
} from "@/components/contacts/contact-identifier-fields";
import { createContactAction } from "@/server/actions/contacts";

// Formulaire de création d'un contact (refonte 2026-07-28) — mêmes champs
// « classiques » que la fiche : Prénom · Nom · Entreprise · Téléphone(s) ·
// Email(s), avec ajout de plusieurs numéros/adresses. Création manuelle →
// `sourceActor: user` (statut `complete` d'emblée). À l'enregistrement, on
// redirige vers la fiche du nouveau contact.

type Initial = {
  firstName?: string;
  lastName?: string;
  company?: string;
  email?: string;
  phone?: string;
};

export function NewContactForm({ initial }: { initial?: Initial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [phones, setPhones] = useState<string[]>([initial?.phone ?? ""]);
  const [emails, setEmails] = useState<string[]>([initial?.email ?? ""]);

  function save() {
    const name = lastName.trim();
    if (!name) {
      toast.error("Le nom est requis.");
      return;
    }
    const phone = splitIdentifierList(phones);
    const email = splitIdentifierList(emails);
    startTransition(async () => {
      const res = await createContactAction({
        firstName: firstName.trim() || null,
        lastName: name,
        company: company.trim() || null,
        phone: phone.primary,
        additionalPhones: phone.additional,
        email: email.primary,
        additionalEmails: email.additional,
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoFocus
            placeholder="Karim"
            className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[14px] outline-none focus:border-relvo"
          />
        </Field>
        <Field label="Nom">
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Benali"
            className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[14px] outline-none focus:border-relvo"
          />
        </Field>
      </div>
      <Field label="Entreprise">
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="SoGood Distribution"
          className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[14px] outline-none focus:border-relvo"
        />
      </Field>
      <ContactIdentifierFields
        label="Téléphone"
        type="tel"
        values={phones}
        onChange={setPhones}
        placeholder="06 12 34 56 78"
        addLabel="Ajouter un téléphone"
      />
      <ContactIdentifierFields
        label="Email"
        type="email"
        values={emails}
        onChange={setEmails}
        placeholder="nom@exemple.fr"
        addLabel="Ajouter un email"
      />
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
