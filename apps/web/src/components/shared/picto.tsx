import type { ComponentType, CSSProperties } from "react";
import type { Icon } from "@phosphor-icons/react";
import * as P from "@phosphor-icons/react/dist/ssr";

// Les PICTOGRAMMES de l'application — « icônes pleines », socle verrouillé par
// le dirigeant (design-system/00-brief-da §5). Tout pictogramme vient d'ici,
// en graisse « fill » de Phosphor, jamais de lucide : un cerveau, une jauge,
// une prise ne se dessinent pas à la main, et un trait de 2 px au milieu
// d'icônes pleines se voit. Les quatre icônes du dock restent dessinées dans
// `layout/dock-icons.tsx`, telles que validées.
//
// lucide ne sert plus qu'aux GLYPHES — chevron, croix, plus, coche, flèches de
// rotation, loader — qui n'ont pas de version pleine parce qu'ils SONT un trait.
// La ligne de partage est tenue par `test/design-tokens.test.ts`.
//
// Entrée `dist/ssr` : des composants sans contexte React, rendus à l'identique
// par un Server Component et par un Client Component. La graisse est posée ICI,
// une fois : un appelant ne la choisit pas, il ne peut donc pas l'oublier.

export type PictoProps = {
  className?: string;
  /** Taille en px quand aucune classe ne la fixe ; `size-*` de Tailwind prime. */
  size?: number;
  style?: CSSProperties;
  title?: string;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-label"?: string;
};

/** Le type d'une prop `icon` : un pictogramme d'ici ou un glyphe lucide. */
export type Picto = ComponentType<PictoProps>;

function plein(Forme: Icon, name: string): Picto {
  function Pictogramme(props: PictoProps) {
    return <Forme weight="fill" {...props} />;
  }
  Pictogramme.displayName = `Picto(${name})`;
  return Pictogramme;
}

// Le chrome et le menu
export const Brain = plein(P.Brain, "Brain");
export const ChartBar = plein(P.ChartBar, "ChartBar");
export const Users = plein(P.Users, "Users");
export const User = plein(P.User, "User");
export const Plug = plein(P.Plug, "Plug");
export const SlidersHorizontal = plein(
  P.SlidersHorizontal,
  "SlidersHorizontal",
);
export const Gauge = plein(P.Gauge, "Gauge");
export const MagnifyingGlass = plein(P.MagnifyingGlass, "MagnifyingGlass");
export const SignOut = plein(P.SignOut, "SignOut");
export const DeviceMobile = plein(P.DeviceMobile, "DeviceMobile");
export const Flask = plein(P.Flask, "Flask");
/** Le backoffice (M21) : l'entrée du menu pour les administrateurs, et le retour à l'application. */
export const ShieldCheck = plein(P.ShieldCheck, "ShieldCheck");
export const House = plein(P.House, "House");

// Les canaux et les contacts
export const Envelope = plein(P.Envelope, "Envelope");
export const Phone = plein(P.Phone, "Phone");
export const WhatsappLogo = plein(P.WhatsappLogo, "WhatsappLogo");
export const Buildings = plein(P.Buildings, "Buildings");
export const LinkSimple = plein(P.LinkSimple, "LinkSimple");
export const LinkBreak = plein(P.LinkBreak, "LinkBreak");

// La fiche, les tâches, les marqueurs
export const ListChecks = plein(P.ListChecks, "ListChecks");
export const ChatsCircle = plein(P.ChatsCircle, "ChatsCircle");
export const FileText = plein(P.FileText, "FileText");
export const ClockCounterClockwise = plein(
  P.ClockCounterClockwise,
  "ClockCounterClockwise",
);
export const Hourglass = plein(P.Hourglass, "Hourglass");
export const Flag = plein(P.Flag, "Flag");
export const Sparkle = plein(P.Sparkle, "Sparkle");
export const CheckSquare = plein(P.CheckSquare, "CheckSquare");
export const CalendarBlank = plein(P.CalendarBlank, "CalendarBlank");
export const CalendarDots = plein(P.CalendarDots, "CalendarDots");
export const Clock = plein(P.Clock, "Clock");
export const PencilSimple = plein(P.PencilSimple, "PencilSimple");
export const FloppyDisk = plein(P.FloppyDisk, "FloppyDisk");
export const Trash = plein(P.Trash, "Trash");
export const EyeSlash = plein(P.EyeSlash, "EyeSlash");
export const FolderOpen = plein(P.FolderOpen, "FolderOpen");
export const ArrowBendUpLeft = plein(P.ArrowBendUpLeft, "ArrowBendUpLeft");

// Les composers
export const Paperclip = plein(P.Paperclip, "Paperclip");
export const Microphone = plein(P.Microphone, "Microphone");
export const PaperPlaneRight = plein(P.PaperPlaneRight, "PaperPlaneRight");

// Les domaines (clés stockées sur le Folder, lib/folders.ts)
export const Package = plein(P.Package, "Package");
export const Scales = plein(P.Scales, "Scales");
export const Gavel = plein(P.Gavel, "Gavel");
export const Snowflake = plein(P.Snowflake, "Snowflake");
export const Megaphone = plein(P.Megaphone, "Megaphone");
export const Truck = plein(P.Truck, "Truck");
export const ForkKnife = plein(P.ForkKnife, "ForkKnife");
export const Money = plein(P.Money, "Money");
export const Wrench = plein(P.Wrench, "Wrench");
export const Folder = plein(P.Folder, "Folder");
