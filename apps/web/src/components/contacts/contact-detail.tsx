"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { RelvoHeader } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  ContactIdentifierFields,
  splitIdentifierList,
  toIdentifierList,
} from "@/components/contacts/contact-identifier-fields";
import {
  completeContactAction,
  deleteContactAction,
  updateContactAction,
} from "@/server/actions/contacts";
import { contactFullName } from "@/lib/display";

// Fiche Contact (refonte 2026-07-28 v2) — représentation « classique » (carnet
// téléphone/WhatsApp). ⚠️ TOUS les champs sont VISIBLES sur la page, même vides
// (un champ vide affiche « Non renseigné ») : Entreprise · Téléphone(s) ·
// Email(s). Le Prénom/Nom vit dans le hero (titre). On édite via le bouton
// « Modifier » du DOCK violet (ou en tapant un champ) : la fiche bascule en mode
// édition (tous les champs éditables, ajout de plusieurs numéros/adresses).
// « Modifier » et « Supprimer » ont remplacé la barre d'onglets sur cette page
// (comme le détail d'une conversation) — cf. AppDock qui masque le dock ici.

type Contact = {
  id: string;
  firstName: string | null;
  lastName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  additionalEmails: string[];
  additionalPhones: string[];
  status: string;
};

type EditState = {
  firstName: string;
  lastName: string;
  company: string;
  phones: string[];
  emails: string[];
};

function initForm(contact: Contact): EditState {
  return {
    firstName: contact.firstName ?? "",
    lastName: contact.lastName,
    company: contact.company ?? "",
    phones: toIdentifierList(contact.phone, contact.additionalPhones),
    emails: toIdentifierList(contact.email, contact.additionalEmails),
  };
}

export function ContactDetail({ contact }: { contact: Contact }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<EditState>(() => initForm(contact));
  const auto = contact.status === "auto";
  const fullName = contactFullName(contact);

  function startEdit() {
    setForm(initForm(contact)); // repart des valeurs enregistrées
    setEditing(true);
  }

  function save() {
    if (!form.lastName.trim()) {
      toast.error("Le nom est requis.");
      return;
    }
    const phone = splitIdentifierList(form.phones);
    const email = splitIdentifierList(form.emails);
    const input = {
      firstName: form.firstName.trim() || null,
      lastName: form.lastName.trim(),
      company: form.company.trim() || null,
      phone: phone.primary,
      additionalPhones: phone.additional,
      email: email.primary,
      additionalEmails: email.additional,
    };
    startTransition(async () => {
      // Contact « auto » (créé par Relvo) → l'enregistrement le passe en
      // « complete » (invariant : validation utilisateur).
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

  function remove() {
    startTransition(async () => {
      const res = await deleteContactAction(contact.id);
      if (res.ok) {
        toast.success("Contact supprimé");
        router.push("/contacts");
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <>
      <Screen>
        <RelvoHeader
          back="/contacts"
          title={fullName}
          subtitle={contact.company || "Contact"}
          className="pb-9"
        />

        {editing ? (
          <div className="mx-4 mt-4 space-y-3 rounded-2xl border border-(--border-light) bg-white p-4 shadow-(--shadow-card)">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom">
                <input
                  value={form.firstName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, firstName: e.target.value }))
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Nom">
                <input
                  value={form.lastName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lastName: e.target.value }))
                  }
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Entreprise">
              <input
                value={form.company}
                onChange={(e) =>
                  setForm((f) => ({ ...f, company: e.target.value }))
                }
                className={inputCls}
              />
            </Field>
            <ContactIdentifierFields
              label="Téléphone"
              type="tel"
              values={form.phones}
              onChange={(phones) => setForm((f) => ({ ...f, phones }))}
              placeholder="06 12 34 56 78"
              addLabel="Ajouter un téléphone"
            />
            <ContactIdentifierFields
              label="Email"
              type="email"
              values={form.emails}
              onChange={(emails) => setForm((f) => ({ ...f, emails }))}
              placeholder="nom@exemple.fr"
              addLabel="Ajouter un email"
            />
          </div>
        ) : (
          <ReadCard contact={contact} auto={auto} onEdit={startEdit} />
        )}
      </Screen>

      {/* Dock violet — remplace la barre d'onglets sur cette page. */}
      <div
        className="absolute inset-x-0 bottom-0 z-30 px-4 pt-3"
        style={{
          paddingBottom: "max(calc(env(safe-area-inset-bottom) - 12px), 8px)",
          background:
            "linear-gradient(180deg, var(--glass-relvo-1), var(--glass-relvo-2))",
          backdropFilter: "blur(28px) saturate(170%)",
          WebkitBackdropFilter: "blur(28px) saturate(170%)",
          boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.22)",
        }}
      >
        {editing ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setEditing(false)}
              className={dockGhost}
            >
              <X className="size-[16px]" strokeWidth={2.2} />
              Annuler
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className={dockPrimary}
            >
              <Save className="size-[16px]" strokeWidth={2.2} />
              Enregistrer
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
              className={dockGhost}
            >
              <Trash2 className="size-[16px]" strokeWidth={2.2} />
              Supprimer
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={startEdit}
              className={dockPrimary}
            >
              <Pencil className="size-[16px]" strokeWidth={2.2} />
              Modifier
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="destructive"
        icon={Trash2}
        title={`Supprimer « ${fullName} » ?`}
        description="Le contact est retiré de l'annuaire. Ses messages sont conservés (l'expéditeur redevient brut). Action irréversible."
        confirmLabel={pending ? "Suppression…" : "Supprimer"}
        pending={pending}
        onConfirm={remove}
      />
    </>
  );
}

// ── Vue lecture : TOUS les champs, même vides (« Non renseigné ») ────────────

function ReadCard({
  contact,
  auto,
  onEdit,
}: {
  contact: Contact;
  auto: boolean;
  onEdit: () => void;
}) {
  const phones = [contact.phone, ...contact.additionalPhones].filter(
    (v): v is string => Boolean(v),
  );
  const emails = [contact.email, ...contact.additionalEmails].filter(
    (v): v is string => Boolean(v),
  );

  const rows: { label: string; value: string | null }[] = [
    { label: "Entreprise", value: contact.company },
    ...(phones.length > 0
      ? phones.map((v, i) => ({
          label: phones.length > 1 ? `Téléphone ${i + 1}` : "Téléphone",
          value: v,
        }))
      : [{ label: "Téléphone", value: null }]),
    ...(emails.length > 0
      ? emails.map((v, i) => ({
          label: emails.length > 1 ? `Email ${i + 1}` : "Email",
          value: v,
        }))
      : [{ label: "Email", value: null }]),
  ];

  return (
    <div className="mx-4 mt-4 overflow-hidden rounded-2xl border border-(--border-light) bg-white shadow-(--shadow-card)">
      {auto ? (
        <p className="border-b border-(--border-light) bg-(--amber-50) px-4 py-2 text-[12px] font-semibold text-(--amber-800)">
          Fiche créée par Relvo — vérifiez et complétez les coordonnées.
        </p>
      ) : null}
      {rows.map((r, i) => (
        <button
          key={`${r.label}-${i}`}
          type="button"
          onClick={onEdit}
          className={`flex w-full items-center gap-3 px-4 py-3 text-left active:bg-(--surface-2) ${
            i > 0 ? "border-t border-(--border-light)" : ""
          }`}
        >
          <span className="w-[92px] flex-none text-[13px] text-(--text-tertiary)">
            {r.label}
          </span>
          {r.value ? (
            <span className="min-w-0 flex-1 text-[14.5px] font-medium break-words text-(--text-primary)">
              {r.value}
            </span>
          ) : (
            <span className="min-w-0 flex-1 text-[14px] text-(--text-tertiary) italic">
              Non renseigné
            </span>
          )}
          <Pencil
            className="size-4 flex-none text-(--text-tertiary)"
            strokeWidth={2}
          />
        </button>
      ))}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-(--border) px-3 py-2.5 text-[14px] outline-none focus:border-relvo";

const dockGhost =
  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/35 py-2.5 text-[13.5px] font-bold text-white active:bg-white/10 disabled:opacity-50";

const dockPrimary =
  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white py-2.5 text-[13.5px] font-bold text-relvo active:opacity-90 disabled:opacity-50";

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
