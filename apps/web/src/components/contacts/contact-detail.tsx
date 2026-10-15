"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  Envelope,
  FloppyDisk,
  PencilSimple,
  Phone,
  Trash,
} from "@/components/shared/picto";
import { toast } from "sonner";
import { RelvoHeader, SKY_BTN } from "@/components/layout/relvo-header";
import { Screen } from "@/components/layout/screen";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ListPanel } from "@/components/shared/list-panel";
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
import { cn } from "@/lib/utils";

// La fiche d'un contact — le CIEL porte le nom en titre et « À compléter »
// quand Relvo l'a créée seul (invariant 12). La carte dessous est la fiche
// entière, tous les champs nommés ; un numéro appelle, une adresse écrit —
// « le numéro de téléphone sur le camion ». Modifier est le crayon du ciel, comme sur toute fiche ; en
// édition, une barre ancrée prend la place du dock, comme un composer. Le dock
// reste : Relvo est à sa place sur toutes les pages (invariant 22).

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

export function ContactDetail({
  contact,
  backHref = "/contacts",
}: {
  contact: Contact;
  /** Où revenir au « Retour » — l'origine (conversation/liste) si on vient de là,
   *  sinon l'annuaire. */
  backHref?: string;
}) {
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
          back={backHref}
          wrapTitle
          title={fullName}
          eyebrow={
            auto ? (
              <span className="inline-flex flex-none items-center gap-1 rounded-(--rayon-pilule) bg-white/14 px-2 py-px text-[11px] font-medium tracking-[0.06em] text-white">
                <i
                  aria-hidden
                  className="size-2 rounded-full border-2 border-(--attente)"
                />
                À compléter
              </span>
            ) : undefined
          }
          action={
            editing ? null : (
              <button
                type="button"
                onClick={startEdit}
                aria-label="Modifier le contact"
                className={SKY_BTN}
              >
                <PencilSimple className="size-[15px]" />
              </button>
            )
          }
          className="pb-9"
        />

        {editing ? (
          <div className="relative z-3 mx-4 -mt-5 space-y-3 rounded-(--rayon-carte) border border-(--filet) bg-white p-4 shadow-carte">
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
            {/* Supprimer est rare et irréversible : un lien à l'écart, en
                édition seulement, et une confirmation qui nomme le contact. */}
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
              className="mx-auto flex items-center gap-1.5 py-1 text-[13px] font-medium text-urgent disabled:opacity-50"
            >
              <Trash className="size-[15px]" />
              Supprimer ce contact
            </button>
          </div>
        ) : (
          <Fiche contact={contact} />
        )}
      </Screen>

      {/* En édition, la barre prend la place du dock, comme un composer : plus
          haute que lui et son disque, zone sûre comprise. */}
      {editing ? (
        <div
          className="absolute inset-x-0 bottom-0 z-30 flex gap-2 bg-white px-4 pt-3.5 shadow-haut"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
        >
          <button
            type="button"
            disabled={pending}
            onClick={() => setEditing(false)}
            className={barGhost}
          >
            <X className="size-[16px]" strokeWidth={2.2} />
            Annuler
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className={barPrimary}
          >
            <FloppyDisk className="size-[16px]" />
            Enregistrer
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="destructive"
        icon={Trash}
        title={`Supprimer « ${fullName} » ?`}
        description="Le contact est retiré de l'annuaire. Ses messages sont conservés (l'expéditeur redevient brut). Action irréversible."
        confirmLabel={pending ? "Suppression…" : "Supprimer"}
        pending={pending}
        onConfirm={remove}
      />
    </>
  );
}

// ── Lecture : la fiche, TOUS les champs ───────────────────────────────────
// Comme un carnet de téléphone : Prénom, Nom, Entreprise, Téléphone(s),
// Email(s), chacun sur sa ligne, « Non renseigné » quand il manque — une
// fiche qui n'affichait que le numéro semblait vide (retour du dirigeant,
// 2026-10-15). Un numéro appelle et une adresse écrit, par le disque au bout
// de la ligne.

function Fiche({ contact }: { contact: Contact }) {
  const phones = [contact.phone, ...contact.additionalPhones].filter(
    (v): v is string => Boolean(v),
  );
  const emails = [contact.email, ...contact.additionalEmails].filter(
    (v): v is string => Boolean(v),
  );

  const rows: {
    label: string;
    value: string | null;
    href?: string;
    icon?: typeof Phone;
  }[] = [
    { label: "Prénom", value: contact.firstName },
    { label: "Nom", value: contact.lastName },
    { label: "Entreprise", value: contact.company },
    ...(phones.length > 0
      ? phones.map((v, i) => ({
          label: phones.length > 1 ? `Téléphone ${i + 1}` : "Téléphone",
          value: v,
          href: `tel:${v.replace(/[^\d+]/g, "")}`,
          icon: Phone,
        }))
      : [{ label: "Téléphone", value: null }]),
    ...(emails.length > 0
      ? emails.map((v, i) => ({
          label: emails.length > 1 ? `Email ${i + 1}` : "Email",
          value: v,
          href: `mailto:${v}`,
          icon: Envelope,
        }))
      : [{ label: "Email", value: null }]),
  ];

  return (
    <div className="relative z-3 -mt-5">
      <ListPanel>
        {rows.map((r, i) => {
          const Icon = r.icon;
          return (
            <div
              key={`${r.label}-${i}`}
              data-list-row
              className="flex min-h-[52px] items-center gap-3 border-b border-(--filet) px-3.5 py-2"
            >
              <span className="libelle w-[84px] flex-none">{r.label}</span>
              {r.value ? (
                <span
                  className={cn(
                    "min-w-0 flex-1 break-words text-noir",
                    Icon === Phone
                      ? "chiffre text-[17px]"
                      : "text-[14.5px] font-normal",
                  )}
                >
                  {r.value}
                </span>
              ) : (
                <span className="min-w-0 flex-1 text-[14px] font-light text-gris">
                  Non renseigné
                </span>
              )}
              {r.href && Icon ? (
                <a
                  href={r.href}
                  aria-label={
                    Icon === Phone
                      ? `Appeler ${r.value}`
                      : `Écrire à ${r.value}`
                  }
                  className="pressable relative grid size-9 flex-none place-items-center rounded-full bg-relvo-pale text-relvo before:absolute before:-inset-1 before:content-['']"
                >
                  <Icon className="size-[17px]" />
                </a>
              ) : null}
            </div>
          );
        })}
      </ListPanel>
    </div>
  );
}

const inputCls =
  "w-full rounded-(--rayon-option) border border-(--filet) bg-(--fond-puce) px-3 py-2.5 text-[14px] font-light text-noir outline-none focus:border-relvo focus:bg-white";

const barGhost =
  "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-(--rayon-pilule) border border-(--filet) text-[14px] font-medium text-noir active:bg-(--fond-puce) disabled:opacity-50";

const barPrimary =
  "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-(--rayon-pilule) bg-relvo text-[14px] font-medium text-white active:opacity-90 disabled:opacity-50";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="libelle mb-1 block">{label}</span>
      {children}
    </label>
  );
}
