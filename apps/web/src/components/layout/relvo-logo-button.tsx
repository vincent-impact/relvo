import Link from "next/link";
import { RelvoLogo } from "@/components/layout/relvo-logo";
import { cn } from "@/lib/utils";

// Bouton logo Relvo — le logo INVERSÉ (disque blanc plein, étoiles violet encre)
// posé sur un fond violet. Forme « bouton » réutilisable sur n'importe quel fond
// foncé (header violet, composer d'échange…). `href` paramétrable : c'est
// l'accès à Relvo, posé en HAUT À DROITE du header (cf. RelvoHeaderButton,
// page-aware).
//
// Pourquoi un disque BLANC : le logo « plein » est un disque violet — sur le
// header violet il disparaissait et ne laissait qu'un halo de verre. Inversé, le
// bouton est l'objet le plus net du header (relief : filet de lumière, ombre de
// contact + portée), distinct du « + » en verre à côté, et de la même famille
// que le bouton micro blanc du composer. Il s'enfonce au toucher (`pressable`).

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
  // La marque (étoiles seules, viewBox resserrée) occupe ~55 % du disque, comme
  // dans le logo plein.
  const mark = Math.round(size * 0.55);
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
        // Volume : dégradé blanc → violet-gris (la lumière vient du haut),
        // liseré violet sombre qui découpe le bord, filet de lumière en haut,
        // ombre de contact + ombre portée TEINTÉES violet (visibles sur l'encre).
        background: "linear-gradient(180deg, #ffffff 0%, #ecebf7 100%)",
        border: "1px solid rgb(40 32 130 / 0.6)",
        boxShadow:
          "inset 0 1px 0 #ffffff, inset 0 -2px 0 rgb(74 63 181 / 0.16), 0 2px 3px rgb(18 12 70 / 0.4), 0 8px 18px rgb(18 12 70 / 0.35)",
      }}
    >
      <RelvoLogo size={mark} variant="mark" title="" />
    </Link>
  );
}
