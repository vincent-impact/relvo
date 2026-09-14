import Link from "next/link";
import { RelvoLogo } from "@/components/layout/relvo-logo";
import { cn } from "@/lib/utils";

// Bouton logo Relvo — pastille de verre (blanc translucide + liseré) posée sur
// un fond violet, et le logo vectorisé dedans. Forme « bouton » réutilisable sur
// n'importe quel fond foncé (header violet, composer d'échange…). `href`
// paramétrable : c'est l'accès à Relvo, posé en HAUT À DROITE du header (cf.
// RelvoHeaderButton, page-aware).
//
// Direction « Instrument » : la pastille a un filet de lumière et une ombre de
// contact (elle est « posée »), et s'enfonce au toucher (`pressable`).

export function RelvoLogoButton({
  size = 42,
  href = "/relvo/historique",
  label = "Demander à Relvo",
  className,
}: {
  size?: number;
  href?: string;
  label?: string;
  className?: string;
}) {
  const logo = Math.round(size * 0.79);
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "pressable grid flex-none place-items-center rounded-full text-relvo",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: "rgb(255 255 255 / 0.14)",
        border: "1px solid rgb(255 255 255 / 0.28)",
        boxShadow:
          "inset 0 1px 0 rgb(255 255 255 / 0.25), 0 1px 2px rgb(0 0 0 / 0.18)",
      }}
    >
      <RelvoLogo
        size={logo}
        title=""
        className="drop-shadow-[0_2px_6px_rgb(0_0_0/0.28)]"
      />
    </Link>
  );
}
