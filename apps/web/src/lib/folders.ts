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
  /** Couleur du rail + fond d'icône (CSS). */
  color: string;
  icon: LucideIcon;
};

// ── Palette curée (8 teintes) — clés stockées en base ────────────────────────
export const FOLDER_COLORS: { key: string; value: string }[] = [
  { key: "violet", value: "#6b5bd6" },
  { key: "blue", value: "#2b6fe0" },
  { key: "teal", value: "#0d9488" },
  { key: "green", value: "#16a34a" },
  { key: "amber", value: "#d97706" },
  { key: "red", value: "#e63150" },
  { key: "purple", value: "#7c3aed" },
  { key: "pink", value: "#db2777" },
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

// Repli par slug (domaines du seed sans logo explicite).
const BY_SLUG: Record<string, FolderVisual> = {
  fournisseurs: { color: COLOR_BY_KEY.blue, icon: Boxes },
  rh: { color: COLOR_BY_KEY.purple, icon: Users },
  juridique: { color: COLOR_BY_KEY.amber, icon: Gavel },
  business: { color: "var(--brand-accent)", icon: Building2 },
  production: { color: COLOR_BY_KEY.teal, icon: Snowflake },
  communication: { color: COLOR_BY_KEY.pink, icon: Megaphone },
  general: { color: "var(--text-tertiary)", icon: Folder },
};

const FALLBACK: FolderVisual = { color: "var(--text-tertiary)", icon: Folder };

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
  return { color, icon };
}
