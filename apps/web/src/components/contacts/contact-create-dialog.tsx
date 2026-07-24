"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createContactAction } from "@/server/actions/contacts";

// Pop-up de création rapide d'un contact (2026-07-24) — ouverte en tapant
// l'avatar d'un interlocuteur NON enregistré (liste /conversations, en-tête d'un
// fil). Champs PRÉ-REMPLIS depuis ce qu'on sait de lui ; à l'enregistrement,
// l'avatar redevient des initiales partout (router.refresh).

/** Découpe « Prénom Nom » : dernier mot = nom, le reste = prénom. */
function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: "", lastName: full.trim() };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1]!,
  };
}

export type ContactPrefill = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export function ContactCreateDialog({
  open,
  onOpenChange,
  prefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill: ContactPrefill;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");

  useEffect(() => {
    if (!open) return;
    const { firstName: f, lastName: l } = splitName(prefill.name ?? "");
    setFirstName(f);
    setLastName(l);
    setEmail(prefill.email ?? "");
    setPhone(prefill.phone ?? "");
    setCompany("");
  }, [open, prefill]);

  const canSave = lastName.trim().length > 0 && !pending;

  function save() {
    if (!canSave) return;
    startTransition(async () => {
      const res = await createContactAction({
        firstName: firstName.trim() || null,
        lastName: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        company: company.trim() || null,
        sourceActor: "user",
      });
      if (res.ok) {
        toast.success("Contact enregistré");
        onOpenChange(false);
        router.refresh();
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
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[12.5px] font-bold text-(--text-secondary)">
              Prénom
            </label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[14.5px] outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12.5px] font-bold text-(--text-secondary)">
              Nom
            </label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[14.5px] outline-none focus:border-brand"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[12.5px] font-bold text-(--text-secondary)">
            E-mail
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[14.5px] outline-none focus:border-brand"
          />
        </div>

        <div>
          <label className="mb-1 block text-[12.5px] font-bold text-(--text-secondary)">
            Téléphone
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[14.5px] outline-none focus:border-brand"
          />
        </div>

        <div>
          <label className="mb-1 block text-[12.5px] font-bold text-(--text-secondary)">
            Société{" "}
            <span className="font-normal text-(--text-tertiary)">
              (optionnel)
            </span>
          </label>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full rounded-xl border border-(--border) px-3 py-2.5 text-[14.5px] outline-none focus:border-brand"
          />
        </div>

        <button
          type="button"
          disabled={!canSave}
          onClick={save}
          className="mt-1 w-full rounded-full bg-brand py-3 text-[14.5px] font-bold text-white active:opacity-90 disabled:opacity-50"
        >
          Enregistrer le contact
        </button>
      </DialogContent>
    </Dialog>
  );
}
