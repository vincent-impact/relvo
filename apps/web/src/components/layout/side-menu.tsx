"use client";

import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import {
  type Picto,
  Brain,
  ChartBar,
  Gauge,
  MagnifyingGlass,
  Plug,
  ShieldCheck,
  SignOut,
  SlidersHorizontal,
  User,
  Users,
} from "@/components/shared/picto";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { logoutAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils";

// Le menu latéral — ce qu'on ouvre moins d'une fois par jour (01 §11,
// invariant 35) : Bilan · Mémoire · Contacts, puis Canaux · Profil ·
// Préférences · Usage, et Rechercher en dernier, comme une action ; la
// déconnexion en pied. Un écran de configuration n'a pas sa place dans une
// barre qu'on regarde trente fois par jour.
//
// Une feuille (`sheet` du registre) ouverte depuis la GAUCHE du header, rendue
// UNE fois par le layout de l'application ; le bouton burger du header ne fait
// que l'ouvrir, via ce contexte. Chaque entrée est une page à part entière ;
// il n'y a plus de page « Réglages » à onglets.
//
// Thème (PITFALLS #51) : la feuille est peinte avec NOS jetons (blanc, pierre,
// violet encre), jamais d'après le thème de l'appareil — l'app est claire
// seulement.

type Ctx = { open: boolean; setOpen: (open: boolean) => void } | null;
const SideMenuCtx = createContext<Ctx>(null);

export function SideMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <SideMenuCtx.Provider value={{ open, setOpen }}>
      {children}
    </SideMenuCtx.Provider>
  );
}

/** Le bouton burger du header. Ne rend rien hors du chrome de l'application. */
export function MenuButton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const ctx = useContext(SideMenuCtx);
  if (!ctx) return null;
  return (
    <button
      type="button"
      aria-label="Menu"
      aria-haspopup="dialog"
      aria-expanded={ctx.open}
      onClick={() => ctx.setOpen(true)}
      className={className}
      style={style}
    >
      <Menu className="size-5" strokeWidth={2.2} />
    </button>
  );
}

type Entry = { href: string; label: string; icon: Picto };

const MAIN: Entry[] = [
  { href: "/bilan", label: "Bilan", icon: ChartBar },
  { href: "/memoire", label: "Mémoire", icon: Brain },
  { href: "/contacts", label: "Contacts", icon: Users },
];

const SETTINGS: Entry[] = [
  { href: "/canaux", label: "Canaux", icon: Plug },
  { href: "/profil", label: "Profil", icon: User },
  { href: "/preferences", label: "Préférences", icon: SlidersHorizontal },
  { href: "/usage", label: "Usage", icon: Gauge },
];

const ITEM =
  "flex h-13 items-center gap-3.5 px-5 text-[17px] font-normal text-noir active:bg-(--fond-enfonce)";
// La page courante : fond enfoncé et graisse — jamais un cerclage ni du violet.
const ITEM_ACTIVE = "bg-(--fond-enfonce) font-medium";

function Separator() {
  return <div className="my-2 h-px bg-(--filet)" />;
}

export function SideMenu({
  user,
  isAdmin = false,
}: {
  user: { firstName: string; lastName: string; email: string };
  /** Le compte est administrateur : le menu ouvre aussi le backoffice (M21.1). */
  isAdmin?: boolean;
}) {
  const ctx = useContext(SideMenuCtx);
  const pathname = usePathname();
  if (!ctx) return null;
  const { open, setOpen } = ctx;
  const close = () => setOpen(false);
  const initials =
    `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  const item = (e: Entry, className?: string) => {
    const Icon = e.icon;
    return (
      <Link
        key={e.href}
        href={e.href}
        onClick={close}
        aria-current={pathname.startsWith(e.href) ? "page" : undefined}
        className={cn(
          ITEM,
          pathname.startsWith(e.href) && ITEM_ACTIVE,
          className,
        )}
      >
        <Icon className="size-[22px] flex-none text-relvo" />
        {e.label}
      </Link>
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-[320px] max-w-[85vw] rounded-r-(--rayon-feuille) border-0 bg-white text-noir shadow-(--ombre-feuille) data-[side=left]:w-[320px]"
        style={{
          // Sur grand écran, la feuille s'aligne sur le bord du cadre mobile
          // (max-w-120 = 30rem, centré), pas sur celui de la fenêtre.
          left: "max(0px, calc(50% - 15rem))",
        }}
      >
        {/* L'en-tête nomme le compte et ouvre le Profil ; l'avatar est celui de
            MOI, bleu (le triptyque) — jamais le dégradé du disque de Relvo. */}
        <div
          className="flex flex-none items-center gap-3 border-b border-(--filet) px-5 pb-4"
          style={{ paddingTop: "max(env(safe-area-inset-top), 20px)" }}
        >
          <Link
            href="/profil"
            onClick={close}
            className="flex min-w-0 flex-1 items-center gap-3 active:opacity-80"
          >
            <span className="chiffre grid size-11 flex-none place-items-center rounded-full bg-actor-me text-[15px] text-white">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <SheetTitle className="truncate font-heading text-[20px] leading-6 font-semibold tracking-[-0.01em] text-noir">
                {user.firstName} {user.lastName}
              </SheetTitle>
              <SheetDescription className="truncate text-[13px] font-normal text-gris">
                {user.email}
              </SheetDescription>
            </span>
          </Link>
          <SheetClose
            aria-label="Fermer le menu"
            className="pressable relative grid size-[34px] flex-none place-items-center rounded-(--rayon-bouton-ciel) bg-(--fond-puce) text-noir before:absolute before:-inset-[5px] before:content-['']"
          >
            <X className="size-4" strokeWidth={2.2} />
          </SheetClose>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-2">
          {MAIN.map((e) => item(e))}
          <Separator />
          {SETTINGS.map((e) => item(e))}
          <Separator />
          {item({
            href: "/recherche",
            label: "Rechercher",
            icon: MagnifyingGlass,
          })}
          {/* Le backoffice, pour les seuls administrateurs : une entrée après
              un filet, hors de la zone (app) — on bascule d'un mode à l'autre,
              et la zone propose le retour. */}
          {isAdmin ? (
            <>
              <Separator />
              {item({
                href: "/admin",
                label: "Backoffice",
                icon: ShieldCheck,
              })}
            </>
          ) : null}
        </nav>

        {/* Se déconnecter : une ligne comme les autres, grise, à 52 px — son
            seul exemplaire (Profil ne la répète plus). */}
        <form
          action={logoutAction}
          className="flex-none"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 14px)" }}
        >
          <button type="submit" className={cn(ITEM, "w-full text-gris")}>
            <SignOut className="size-[22px] flex-none" />
            Se déconnecter
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
