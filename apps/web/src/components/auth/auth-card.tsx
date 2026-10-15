import Link from "next/link";
import { cn } from "@/lib/utils";

// Carte du tunnel d'authentification (Direction B) — surface blanche arrondie à
// cheval sur le hero violet de marque (cf. (auth)/layout.tsx). Remplace l'usage
// du <Card> shadcn générique pour rester cohérent avec les écrans de l'app.
export function AuthCard({
  title,
  description,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-(--rayon-carte) border border-(--filet) bg-white p-6 shadow-carte",
        className,
      )}
    >
      <div className="mb-5">
        {/* Le titre nomme la tâche, en condensé comme tout titre ; le ciel a
            déjà fait la promesse. */}
        <h1 className="font-heading text-[22px] leading-7 font-semibold tracking-[-0.01em] text-noir">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-[14px] leading-[1.45] font-light text-gris">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

// Lien secondaire du tunnel (violet de marque), centré par défaut.
export function AuthLink({
  href,
  children,
  prefix,
}: {
  href: string;
  children: React.ReactNode;
  /** Texte gris précédant le lien (ex. « Pas encore de compte ? »). */
  prefix?: React.ReactNode;
}) {
  return (
    <p className="py-1 text-center text-[14px] font-normal text-gris">
      {prefix ? <>{prefix} </> : null}
      <Link href={href} className="font-medium text-relvo">
        {children}
      </Link>
    </p>
  );
}
