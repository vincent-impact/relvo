import Link from "next/link";
import { RelvoLogo } from "@/components/layout/relvo-logo";
import { APP_URL, SITE_URL } from "@/lib/hotes";
import s from "@/app/(public)/site/site.module.css";

// Le CHROME des pages du site (M24.10) : le ciel en tête, avec la marque et un
// lien vers l'application, puis le pied avec l'éditeur et les pages légales.
// Les pages du site sont lues hors de l'application — par un visiteur, par un
// testeur avant d'entrer, par Google pour vérifier l'application — et ne
// montrent rien du compte : pas de session, pas de donnée.

export const CONTACT_EMAIL = "vincent@vccimpact.fr";

export function Ciel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={s.ciel}>
      <div className={`${s.cielInner}${className ? ` ${className}` : ""}`}>
        <nav className={s.nav} aria-label="Site">
          <Link href={SITE_URL} className={s.marque}>
            <RelvoLogo
              size={28}
              variant="mark"
              className="text-white"
              title=""
            />
            <strong>Relvo</strong>
          </Link>
          <a href={`${APP_URL}/connexion`}>Se connecter</a>
        </nav>
        {children}
      </div>
    </header>
  );
}

export function Pied() {
  return (
    <footer className={s.pied}>
      <span>VCC Impact</span>
      <Link href={`${SITE_URL}/confidentialite`}>Confidentialité</Link>
      <Link href={`${SITE_URL}/conditions`}>Conditions d’utilisation</Link>
      <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
    </footer>
  );
}

export function PagePublique({ children }: { children: React.ReactNode }) {
  return <div className={s.page}>{children}</div>;
}
