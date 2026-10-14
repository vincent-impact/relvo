import {
  Banknote,
  Boxes,
  Building2,
  CalendarDays,
  type LucideIcon,
  Folder,
  Gavel,
  Megaphone,
  Scale,
  Snowflake,
  Truck,
  Users,
  Utensils,
  Wrench,
} from "lucide-react";

// Présentation des domaines (« domaines de la mémoire de Relvo ») : couleur de
// rail/icône et glyphe (Direction B, règle « colour = domain »).
//
// Source de vérité : les clés `color` / `icon` stockées sur le Folder (logo
// choisi par l'utilisateur, cf. palette + icônes curées ci-dessous). À défaut,
// repli sur le mapping par slug (domaines du seed), puis sur un neutre.

export type FolderVisual = {
  /** La BANDE du domaine (CSS, vive) : sur la tranche d'une carte ou d'une ligne. */
  color: string;
  /** Le TEXTE du domaine (CSS, foncé, ≥ 4.5:1 sur blanc) : son nom en capitales condensées. */
  text: string;
  icon: LucideIcon;
};

// ── Palette curée (8 teintes) — clés stockées en base ────────────────────────
// Les VALEURS vivent dans globals.css (`--domaine-<clé>`, et `--domaine-<clé>-texte`
// pour le nom du domaine sur blanc) : ici, seules les clés stockées en base.
// Aucun domaine n'est violet — la livrée est violette, la clé « purple » rend
// une prune — pour ne pas confondre un domaine avec Relvo.
export const FOLDER_COLORS: { key: string; value: string }[] = [
  { key: "blue", value: "var(--domaine-blue)" },
  { key: "teal", value: "var(--domaine-teal)" },
  { key: "green", value: "var(--domaine-green)" },
  { key: "lime", value: "var(--domaine-lime)" },
  { key: "amber", value: "var(--domaine-amber)" },
  { key: "red", value: "var(--domaine-red)" },
  { key: "purple", value: "var(--domaine-purple)" },
  { key: "pink", value: "var(--domaine-pink)" },
];
const COLOR_BY_KEY: Record<string, string> = Object.fromEntries(
  FOLDER_COLORS.map((c) => [c.key, c.value]),
);

// ── Jeu d'icônes curé (12) — clés stockées en base ───────────────────────────
export const FOLDER_ICONS: { key: string; icon: LucideIcon }[] = [
  { key: "boxes", icon: Boxes },
  { key: "users", icon: Users },
  { key: "scale", icon: Scale },
  { key: "gavel", icon: Gavel },
  { key: "snowflake", icon: Snowflake },
  { key: "building", icon: Building2 },
  { key: "megaphone", icon: Megaphone },
  { key: "truck", icon: Truck },
  { key: "utensils", icon: Utensils },
  { key: "banknote", icon: Banknote },
  { key: "wrench", icon: Wrench },
  { key: "calendar", icon: CalendarDays },
];
const ICON_BY_KEY: Record<string, LucideIcon> = Object.fromEntries(
  FOLDER_ICONS.map((i) => [i.key, i.icon]),
);

// Repli par slug (domaines du seed sans logo explicite) — les couleurs de la
// direction : Fournisseurs orange, Équipe vert, Administration bleu, Clients
// rouge, Production sarcelle, Communication rose.
const BY_SLUG: Record<string, { color: string; icon: LucideIcon }> = {
  fournisseurs: { color: "var(--domaine-orange)", icon: Boxes },
  rh: { color: COLOR_BY_KEY.green, icon: Users },
  juridique: { color: COLOR_BY_KEY.blue, icon: Gavel },
  business: { color: COLOR_BY_KEY.red, icon: Building2 },
  production: { color: COLOR_BY_KEY.teal, icon: Snowflake },
  communication: { color: COLOR_BY_KEY.pink, icon: Megaphone },
  general: { color: "var(--domaine-neutre)", icon: Folder },
};

const FALLBACK = { color: "var(--domaine-neutre)", icon: Folder };

/** La variante TEXTE d'une couleur de bande : `var(--domaine-x)` → `var(--domaine-x-texte)`. */
export function folderTextColor(color: string): string {
  return color.replace(/^var\((--domaine-[a-z]+)\)$/, "var($1-texte)");
}

/** Couleur résolue depuis une clé de palette (ou null si inconnue/absente). */
export function folderColorFromKey(key?: string | null): string | null {
  return key ? (COLOR_BY_KEY[key] ?? null) : null;
}

type FolderLike = {
  slug?: string | null;
  color?: string | null;
  icon?: string | null;
};

/**
 * Visuel d'un domaine. Accepte soit un slug (rétrocompat), soit un objet
 * `{ slug, color, icon }` portant les clés stockées (logo personnalisé).
 */
export function folderVisual(arg?: string | null | FolderLike): FolderVisual {
  const f: FolderLike =
    typeof arg === "string" || arg == null ? { slug: arg } : arg;
  const color =
    folderColorFromKey(f.color) ??
    (f.slug ? BY_SLUG[f.slug]?.color : undefined) ??
    FALLBACK.color;
  const icon =
    (f.icon ? ICON_BY_KEY[f.icon] : undefined) ??
    (f.slug ? BY_SLUG[f.slug]?.icon : undefined) ??
    FALLBACK.icon;
  return { color, text: folderTextColor(color), icon };
}
