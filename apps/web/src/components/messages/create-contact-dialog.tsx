"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { splitContactName } from "@/lib/display";
import { createContactFromMessageSenderAction } from "@/server/actions/messages";

// Création d'un contact à partir de l'expéditeur d'un message inconnu (sender
// brut). Modale (plutôt qu'un tooltip : c'est un petit formulaire). Préremplie
// selon le canal (e-mail → email, WhatsApp → téléphone). La gestion complète des
// contacts arrive en partie 2 ; ici on matérialise juste l'émetteur.

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold tracking-[0.3px] text-(--text-tertiary) uppercase">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-(--border) px-3.5 py-2.5 text-[14.5px] outline-none focus:border-relvo"
      />
    </label>
  );
}

export function CreateContactDialog({
  open,
  onOpenChange,
  messageId,
  prefill,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  prefill: { name: string; email?: string; phone?: string };
  onCreated: (contact: { id: string }) => void;
}) {
  const [pending, startTransition] = useTransition();
  const initial = splitContactName(prefill.name);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [email, setEmail] = useState(prefill.email ?? "");
  const [phone, setPhone] = useState(prefill.phone ?? "");
  const [company, setCompany] = useState("");

  function submit() {
    const trimmedLast = lastName.trim();
    if (!trimmedLast) {
      toast.error("Un nom est requis.");
      return;
    }
    startTransition(async () => {
      const res = await createContactFromMessageSenderAction(messageId, {
        firstName: firstName.trim() || null,
        lastName: trimmedLast,
        email: email.trim() || null,
        phone: phone.trim() || null,
        company: company.trim() || null,
      });
      if (res.ok) {
        toast.success("Contact créé");
        onCreated({ id: res.data.id });
        onOpenChange(false);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 p-5">
        <DialogHeader>
          <DialogTitle>Nouveau contact</DialogTitle>
          <DialogDescription>
            Cet expéditeur n’est pas encore enregistré.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Prénom"
              value={firstName}
              onChange={setFirstName}
              placeholder="Karim"
            />
            <Field
              label="Nom"
              value={lastName}
              onChange={setLastName}
              placeholder="Benali"
            />
          </div>
          <Field
            label="E-mail"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="email@exemple.fr"
          />
          <Field
            label="Téléphone"
            type="tel"
            value={phone}
            onChange={setPhone}
            placeholder="06 12 34 56 78"
          />
          <Field
            label="Société"
            value={company}
            onChange={setCompany}
            placeholder="Optionnel"
          />
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-relvo py-3 text-[15px] font-bold text-white disabled:opacity-60"
        >
          <UserPlus className="size-[18px]" strokeWidth={2.2} />
          Créer le contact
        </button>
      </DialogContent>
    </Dialog>
  );
}
