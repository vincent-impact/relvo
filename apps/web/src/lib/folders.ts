import {
  Boxes,
  Building2,
  type LucideIcon,
  Folder,
  Gavel,
  Snowflake,
  Users,
} from "lucide-react";

// Présentation des dossiers (« domaines de la mémoire de Relvo ») : couleur de
// rail/icône et glyphe par domaine (Direction B, règle « colour = domain »).
// Le mapping est piloté par le slug ; un dossier inconnu retombe sur un neutre.

export type FolderVisual = {
  /** Couleur du rail + fond d'icône (variable CSS). */
  color: string;
  icon: LucideIcon;
};

const BY_SLUG: Record<string, FolderVisual> = {
  fournisseurs: { color: "var(--blue-600)", icon: Boxes },
  rh: { color: "var(--purple-600)", icon: Users },
  juridique: { color: "var(--amber-800)", icon: Gavel },
  business: { color: "var(--brand-accent)", icon: Building2 },
  production: { color: "var(--green-600)", icon: Snowflake },
  general: { color: "var(--text-tertiary)", icon: Folder },
};

const FALLBACK: FolderVisual = { color: "var(--text-tertiary)", icon: Folder };

export function folderVisual(slug?: string | null): FolderVisual {
  return (slug && BY_SLUG[slug]) || FALLBACK;
}
