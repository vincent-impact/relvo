"use client";

import { createContext, useContext, useState } from "react";
import Link from "next/link";
import {
  Brain,
  ChartColumn,
  Gauge,
  LogOut,
  Menu,
  Plug,
  Search,
  SlidersHorizontal,
  User,
  Users,
  X,
} from "lucide-react";
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

type Entry = { href: string; label: string; icon: typeof Users };

const MAIN: Entry[] = [
  { href: "/bilan", label: "Bilan", icon: ChartColumn },
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

function Separator() {
  return <div className="my-2 h-px bg-(--filet)" />;
}

export function SideMenu({
  user,
}: {
  user: { firstName: string; lastName: string; email: string };
}) {
  const ctx = useContext(SideMenuCtx);
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
        className={cn(ITEM, className)}
      >
        <Icon
          className="size-[22px] flex-none text-relvo"
          strokeWidth={2.2}
          fill="currentColor"
          fillOpacity={0.14}
        />
        {e.label}
      </Link>
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-[320px] max-w-[85vw] rounded-r-(--rayon-feuille) border-0 bg-white text-noir shadow-(--ombre-feuille)"
        style={{
          // Sur grand écran, la feuille s'aligne sur le bord du cadre mobile
          // (max-w-120 = 30rem, centré), pas sur celui de la fenêtre.
          left: "max(0px, calc(50% - 15rem))",
        }}
      >
        <div
          className="flex flex-none items-center gap-3 border-b border-(--filet) px-5 pb-4"
          style={{ paddingTop: "max(env(safe-area-inset-top), 20px)" }}
        >
          <span
            className="chiffre grid size-11 flex-none place-items-center rounded-full text-[15px] text-white"
            style={{ background: "var(--degrade-disque)" }}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate font-heading text-[20px] leading-6 font-semibold tracking-[-0.01em] text-noir">
              {user.firstName} {user.lastName}
            </SheetTitle>
            <SheetDescription className="truncate text-[13px] font-light text-gris">
              {user.email}
            </SheetDescription>
          </div>
          <SheetClose
            aria-label="Fermer le menu"
            className="pressable grid size-[34px] flex-none place-items-center rounded-(--rayon-bouton-ciel) bg-(--fond-puce) text-noir"
          >
            <X className="size-4" strokeWidth={2.2} />
          </SheetClose>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-2">
          {MAIN.map((e) => item(e))}
          <Separator />
          {SETTINGS.map((e) => item(e))}
          <Separator />
          {item({ href: "/recherche", label: "Rechercher", icon: Search })}
        </nav>

        <form
          action={logoutAction}
          className="flex-none px-5 pt-3"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 22px)" }}
        >
          <button
            type="submit"
            className="flex items-center gap-3.5 text-[16px] font-light text-gris active:opacity-70"
          >
            <LogOut className="size-[22px]" strokeWidth={2} />
            Se déconnecter
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
