"use client";

import { Plus, X } from "lucide-react";

// Liste de coordonnées multi-valeurs (téléphones OU e-mails) d'un contact
// (2026-07-28). Index 0 = coordonnée primaire (« Téléphone 1 » / « Email 1 »,
// stockée dans `phone`/`email`) ; les suivantes sont secondaires. Numérotées
// seulement s'il y en a plusieurs, façon fiche contact classique (iOS/WhatsApp).
// Le tableau porte toujours au moins une entrée (la primaire, éventuellement
// vide). Le « + » ajoute une entrée, la croix retire une entrée secondaire.

export function ContactIdentifierFields({
  label,
  type,
  values,
  onChange,
  placeholder,
  addLabel,
}: {
  label: string;
  type: "tel" | "email";
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel: string;
}) {
  const rows = values.length > 0 ? values : [""];

  function set(i: number, v: string) {
    const next = [...rows];
    next[i] = v;
    onChange(next);
  }
  function add() {
    onChange([...rows, ""]);
  }
  function remove(i: number) {
    const next = rows.filter((_, j) => j !== i);
    onChange(next.length > 0 ? next : [""]);
  }

  const numbered = rows.length > 1;

  return (
    <div className="space-y-2">
      {rows.map((val, i) => (
        <label key={i} className="block">
          <span className="mb-1 block text-[12.5px] font-semibold text-(--text-secondary)">
            {numbered ? `${label} ${i + 1}` : label}
          </span>
          <div className="flex items-center gap-2">
            <input
              type={type}
              inputMode={type === "tel" ? "tel" : "email"}
              value={val}
              placeholder={placeholder}
              onChange={(e) => set(i, e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-(--border) px-3 py-2.5 text-[14px] outline-none focus:border-relvo"
            />
            {i > 0 ? (
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Retirer ${label.toLowerCase()} ${i + 1}`}
                className="grid size-9 flex-none place-items-center rounded-full text-(--text-tertiary) active:bg-(--surface-2)"
              >
                <X className="size-[17px]" strokeWidth={2.2} />
              </button>
            ) : null}
          </div>
        </label>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-relvo active:opacity-70"
      >
        <Plus className="size-4" strokeWidth={2.4} />
        {addLabel}
      </button>
    </div>
  );
}

// Helpers de conversion tableau UI ↔ modèle (primaire + secondaires).

/** Coordonnées du contact → tableau UI (index 0 = primaire, ≥ 1 entrée). */
export function toIdentifierList(
  primary: string | null,
  additional: string[],
): string[] {
  const list = [primary ?? "", ...additional];
  return list.length > 0 ? list : [""];
}

/** Tableau UI → { primary, additional } : on compacte (retire les vides), la
 *  première valeur non vide devient la primaire. */
export function splitIdentifierList(values: string[]): {
  primary: string | null;
  additional: string[];
} {
  const clean = values.map((v) => v.trim()).filter(Boolean);
  return { primary: clean[0] ?? null, additional: clean.slice(1) };
}
