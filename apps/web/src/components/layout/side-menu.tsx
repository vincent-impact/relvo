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
// que l'ouvrir, via ce contexte. Canaux, Profil, Préférences et Usage sont les
// onglets des Réglages, atteints par lien profond.
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
  { href: "/parametres?tab=canaux", label: "Canaux", icon: Plug },
  { href: "/parametres?tab=profil", label: "Profil", icon: User },
  {
    href: "/parametres?tab=preferences",
    label: "Préférences",
    icon: SlidersHorizontal,
  },
  { href: "/parametres?tab=usage", label: "Usage", icon: Gauge },
];

const ITEM =
  "flex items-center gap-3.5 px-[18px] py-3 text-[15.5px] font-medium text-(--text-primary) active:bg-(--surface)";

function Separator() {
  return <div className="mx-[18px] my-2 h-px bg-(--border-light)" />;
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
        <Icon className="size-[22px] flex-none text-relvo" strokeWidth={2} />
        {e.label}
      </Link>
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-[300px] max-w-[85vw] rounded-r-[20px] border-0 bg-white text-(--text-primary)"
        style={{
          // Sur grand écran, la feuille s'aligne sur le bord du cadre mobile
          // (max-w-120 = 30rem, centré), pas sur celui de la fenêtre.
          left: "max(0px, calc(50% - 15rem))",
          boxShadow: "0 12px 32px rgb(20 18 40 / 0.3)",
        }}
      >
        <div
          className="flex flex-none items-center gap-3 rounded-tr-[20px] bg-relvo px-[18px] pb-[18px] text-white"
          style={{ paddingTop: "max(env(safe-area-inset-top), 22px)" }}
        >
          <span className="grid size-11 flex-none place-items-center rounded-full bg-[#fafafa] text-[15px] font-semibold text-relvo">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate font-heading text-[16px] font-semibold tracking-[-0.01em] text-white">
              {user.firstName} {user.lastName}
            </SheetTitle>
            <SheetDescription className="truncate text-[12.5px] text-(--on-violet)">
              {user.email}
            </SheetDescription>
          </div>
          <SheetClose
            aria-label="Fermer le menu"
            className="grid size-[34px] flex-none place-items-center rounded-full text-white"
            style={{
              background: "rgb(255 255 255 / 0.14)",
              border: "1px solid rgb(255 255 255 / 0.28)",
            }}
          >
            <X className="size-4" strokeWidth={2.2} />
          </SheetClose>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-2.5">
          {MAIN.map((e) => item(e))}
          <Separator />
          {SETTINGS.map((e) => item(e))}
          <Separator />
          {item(
            { href: "/recherche", label: "Rechercher", icon: Search },
            "font-semibold text-relvo",
          )}
        </nav>

        <form
          action={logoutAction}
          className="flex-none px-[18px] pt-3"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 22px)" }}
        >
          <button
            type="submit"
            className="flex items-center gap-2.5 text-[14px] font-medium text-(--text-secondary) active:opacity-70"
          >
            <LogOut className="size-[18px]" strokeWidth={2} />
            Se déconnecter
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
