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

// La fiche d'un contact — le CIEL est la carte de visite : le nom en titre,
// l'entreprise en ligne du dessous, « À compléter » quand Relvo l'a créée
// seul (invariant 12). La carte ne porte que les COORDONNÉES, et chacune est
// un geste : le numéro appelle, l'adresse écrit — « le numéro de téléphone sur
// le camion ». Modifier est le crayon du ciel, comme sur toute fiche ; en
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
            contact.company || auto ? (
              <span className="inline-flex items-center gap-2.5">
                {contact.company ? (
                  <span className="truncate">{contact.company}</span>
                ) : null}
                {auto ? (
                  <span className="inline-flex flex-none items-center gap-1 rounded-(--rayon-pilule) bg-white/14 px-2 py-px text-[11px] font-medium tracking-[0.06em] text-white">
                    <i
                      aria-hidden
                      className="size-2 rounded-full border-2 border-(--attente)"
                    />
                    À compléter
                  </span>
                ) : null}
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
          <Coordonnees contact={contact} />
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

// ── Lecture : les coordonnées, chacune un geste ───────────────────────────

function Coordonnees({ contact }: { contact: Contact }) {
  const phones = [contact.phone, ...contact.additionalPhones].filter(
    (v): v is string => Boolean(v),
  );
  const emails = [contact.email, ...contact.additionalEmails].filter(
    (v): v is string => Boolean(v),
  );

  if (phones.length === 0 && emails.length === 0) {
    return (
      <p className="px-[22px] py-10 text-center text-[14px] font-light text-gris">
        Aucune coordonnée. Le crayon, en haut, pour en ajouter.
      </p>
    );
  }

  return (
    <div className="relative z-3 -mt-5">
      <ListPanel>
        {phones.map((v) => (
          <a
            key={`tel-${v}`}
            href={`tel:${v.replace(/[^\d+]/g, "")}`}
            data-list-row
            className="flex h-[58px] items-center gap-3 border-b border-(--filet) px-3.5 active:bg-(--fond-enfonce)"
          >
            <span className="chiffre min-w-0 flex-1 truncate text-[19px] text-noir">
              {v}
            </span>
            <span className="grid size-9 flex-none place-items-center rounded-full bg-relvo-pale text-relvo">
              <Phone className="size-[17px]" />
            </span>
          </a>
        ))}
        {emails.map((v) => (
          <a
            key={`mail-${v}`}
            href={`mailto:${v}`}
            data-list-row
            className="flex h-[58px] items-center gap-3 border-b border-(--filet) px-3.5 active:bg-(--fond-enfonce)"
          >
            <span className="min-w-0 flex-1 truncate text-[14.5px] font-normal text-noir">
              {v}
            </span>
            <span className="grid size-9 flex-none place-items-center rounded-full bg-relvo-pale text-relvo">
              <Envelope className="size-[17px]" />
            </span>
          </a>
        ))}
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
