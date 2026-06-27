import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Bouton logo Relvo — pastille translucide blanche + liseré interne + logo Relvo.
// Forme « bouton » réutilisable sur n'importe quel fond foncé (header violet,
// composer de conversation…). `href` paramétrable : c'est l'accès à Relvo, posé
// désormais en HAUT À DROITE du header (cf. RelvoHeaderButton, page-aware).

export function RelvoLogoButton({
  size = 42,
  href = "/conversations",
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
        "grid flex-none place-items-center rounded-full active:scale-95",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: "rgb(255 255 255 / 0.15)",
        boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.3)",
      }}
    >
      <Image
        src="/relvo-icon.png"
        alt="Relvo"
        width={logo}
        height={logo}
        priority
        style={{ filter: "drop-shadow(0 2px 6px rgb(0 0 0 / 0.28))" }}
      />
    </Link>
  );
}
