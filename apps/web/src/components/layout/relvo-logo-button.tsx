import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Bouton logo Relvo — accès à l'historique des conversations (/conversations).
// Look « bouton » : pastille translucide blanche + liseré interne + logo Relvo.
// Vit DÉSORMAIS en bas à gauche du composer persistant (tout ce qui touche à la
// conversation Relvo est en bas). Réutilisable sur n'importe quel fond foncé.

export function RelvoLogoButton({
  size = 42,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const logo = Math.round(size * 0.79);
  return (
    <Link
      href="/conversations"
      aria-label="Mes conversations Relvo"
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
