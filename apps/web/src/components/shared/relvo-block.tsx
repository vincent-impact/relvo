import { RelvoLogo } from "@/components/layout/relvo-logo";
import { cn } from "@/lib/utils";

// RelvoBlock — LE bloc de Relvo (design-system/01-tokens, « un bloc violet pâle
// signé des étoiles, c'est Relvo qui parle ») : la seule matière qui porte ce
// que l'agent dit — les nouvelles de l'accueil, l'état vide qui guide, une
// question, la carte vivante. Un bouton ou une bulle de l'utilisateur n'y vit
// jamais : ce violet pâle est sa voix. Il est signé du signe et de son nom, et
// rien d'autre — pas d'horodatage, la phrase porte sa fenêtre.
//
// Quatre écrans le recopiaient à la main avant M19.9 ; un bloc qui diverge
// d'un écran à l'autre n'est plus une signature.

export function RelvoBlock({
  children,
  className,
  label = "Relvo",
}: {
  children: React.ReactNode;
  className?: string;
  /** Le nom de la zone pour les lecteurs d'écran, « Relvo » par défaut. */
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        "rounded-(--rayon-carte) border border-relvo-filet bg-relvo-pale px-3.5 pt-3 pb-3 text-noir shadow-carte",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <RelvoLogo
          size={22}
          variant="full"
          className="text-relvo-clair"
          title=""
        />
        <span className="libelle text-relvo!">Relvo</span>
      </div>
      {children}
    </section>
  );
}

/** La phrase de Relvo dans son bloc : 14 px, fine, à 20 px d'interligne. */
export function RelvoSentence({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("mt-1.5 text-[14px] leading-5 font-light", className)}>
      {children}
    </p>
  );
}

/** Le lien fléché d'un bloc de Relvo : la porte vers la preuve ou le geste. */
export const RELVO_LINK =
  "mt-0.5 block py-1.5 pl-[1.1em] -indent-[1.1em] text-[14px] leading-[18px] font-medium text-relvo active:opacity-80";
