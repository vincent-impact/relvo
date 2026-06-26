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
        "rounded-(--hero-round) border border-(--border-light) bg-white p-6 shadow-(--shadow-card)",
        className,
      )}
    >
      <div className="mb-5">
        <h1 className="font-heading text-[22px] leading-tight font-extrabold tracking-[-0.3px] text-(--text-primary)">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-[13.5px] leading-[1.45] text-(--text-secondary)">
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
    <p className="text-center text-[13.5px] text-(--text-secondary)">
      {prefix ? <>{prefix} </> : null}
      <Link href={href} className="font-semibold text-relvo hover:underline">
        {children}
      </Link>
    </p>
  );
}
