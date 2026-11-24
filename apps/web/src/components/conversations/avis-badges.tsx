import { RelvoLogo } from "@/components/layout/relvo-logo";
import {
  type Picto,
  Briefcase,
  EyeSlash,
  House,
  Megaphone,
  Question,
  Robot,
  ShieldWarning,
  ThumbsDown,
  ThumbsUp,
} from "@/components/shared/picto";
import { Badge } from "@/components/ui/badge";
import {
  CONSEIL_LABELS,
  NATURE_LABELS,
  SANS_AVIS,
  type Conseil,
  type IgnoreData,
  type NatureCle,
  type RelvoVerdictData,
} from "@/lib/conversation-row";
import { compteLong } from "@/lib/trou";
import { cn } from "@/lib/utils";

// L'AVIS DE TRI sur une conversation, en BADGES — jamais en phrase dans une
// liste. Deux informations, deux badges, le conseil d'abord :
//
//   · le CONSEIL — ce que Relvo en ferait. C'est lui qui guide d'un coup
//     d'œil, et le SEUL badge qui porte une couleur de sens : vert « À
//     traiter » (pouce levé), rouge « À ignorer » (pouce baissé). « Sans
//     avis », quand Relvo n'a pas lu la conversation, est cerclé de violet —
//     neutre. Il ne se lit que sur une conversation à trier.
//   · la NATURE — de quoi il s'agit : toujours violet plein ; c'est son
//     pictogramme qui la distingue.
//
// Dans « ignorées » : la nature seule quand Relvo a ignoré ; « Ignorée par
// vous », en bleu (le triptyque d'acteurs, design-system/01-tokens), quand
// c'est le dirigeant — suivie de la nature si Relvo en avait posé une.
// Les appelants ne l'affichent que sur une conversation sans sujet ou ignorée ;
// une conversation suivie a sa mémoire dans le sujet (05 §1.6).

const NATURE_PICTOS: Record<NatureCle, Picto> = {
  professional: Briefcase,
  personal: House,
  advertising: Megaphone,
  automatic: Robot,
  unwanted: ShieldWarning,
};

const CONSEIL_PICTOS: Record<Conseil, Picto> = {
  traiter: ThumbsUp,
  ignorer: ThumbsDown,
};

const TON = {
  /** Ce que dit Relvo : la nature. */
  relvo: "border-transparent bg-relvo-pale text-relvo",
  /** Relvo n'a rien dit : cerclé, sans fond. */
  neutre: "border-relvo-filet bg-white text-relvo",
  /** Ce que le dirigeant a fait. */
  moi: "border-transparent bg-(--blue-50) text-(--blue-600)",
  traiter: "border-transparent bg-(--green-50) text-(--green-800)",
  ignorer: "border-transparent bg-(--red-50) text-(--red-800)",
  /** Sur le ciel violet, en tête du fil. */
  ciel: "border-transparent bg-white/20 text-white",
} as const;

function Etiquette({
  icon: Icon,
  ton,
  children,
}: {
  icon: Picto;
  ton: keyof typeof TON;
  children: React.ReactNode;
}) {
  return (
    <Badge className={cn("font-medium", TON[ton])}>
      <Icon aria-hidden />
      {children}
    </Badge>
  );
}

function BadgeNature({
  nature,
  ciel = false,
}: {
  nature: NatureCle;
  ciel?: boolean;
}) {
  return (
    <Etiquette icon={NATURE_PICTOS[nature]} ton={ciel ? "ciel" : "relvo"}>
      {NATURE_LABELS[nature]}
    </Etiquette>
  );
}

function BadgeConseil({ conseil }: { conseil: Conseil }) {
  return (
    <Etiquette icon={CONSEIL_PICTOS[conseil]} ton={conseil}>
      {CONSEIL_LABELS[conseil]}
    </Etiquette>
  );
}

/**
 * Sur une ligne de la liste : le conseil puis la nature, ou « Sans avis ».
 * Dans « ignorées », par qui si c'est le dirigeant, puis la nature.
 */
export function AvisBadges({
  relvo,
  ignore,
  className,
}: {
  relvo: RelvoVerdictData | null;
  ignore: IgnoreData | null;
  className?: string;
}) {
  const rangee = cn("flex min-w-0 items-center gap-1.5", className);

  if (ignore) {
    return (
      <div className={rangee}>
        {ignore.byRelvo ? null : (
          <Etiquette icon={EyeSlash} ton="moi">
            Ignorée par vous
          </Etiquette>
        )}
        {ignore.nature ? (
          <BadgeNature nature={ignore.nature} />
        ) : ignore.byRelvo ? (
          // Ignorée par Relvo sans nature posée : le badge dit au moins par qui.
          <Etiquette icon={EyeSlash} ton="relvo">
            Ignorée par Relvo
          </Etiquette>
        ) : null}
      </div>
    );
  }

  if (!relvo) {
    return (
      <div className={rangee}>
        <Etiquette icon={Question} ton="neutre">
          {SANS_AVIS}
        </Etiquette>
      </div>
    );
  }

  return (
    <div className={rangee}>
      <BadgeConseil conseil={relvo.conseil} />
      {relvo.nature ? <BadgeNature nature={relvo.nature} /> : null}
    </div>
  );
}

/**
 * En tête du fil, sur le ciel : les mêmes badges, puis la phrase de Relvo EN
 * ENTIER — c'est ici, et seulement ici, qu'elle se lit. Le fil n'a pas
 * d'onglet pour dire l'état : une conversation ignorée le dit elle-même, et
 * par qui, avec ce qu'elle n'importe plus (M25.10).
 */
export function AvisDuFil({
  relvo,
  ignore,
}: {
  relvo: RelvoVerdictData | null;
  ignore: IgnoreData | null;
}) {
  if (!relvo && !ignore) return null;
  const phrase = ignore
    ? (ignore.note ?? (ignore.byRelvo ? (relvo?.reason ?? null) : null))
    : relvo!.reason || null;
  const deRelvo = !ignore || ignore.byRelvo;

  return (
    <div className="space-y-1.5 text-white">
      <div className="flex flex-wrap items-center gap-1.5">
        {ignore ? (
          <>
            <Etiquette icon={EyeSlash} ton="ciel">
              {ignore.byRelvo ? "Ignorée par Relvo" : "Ignorée par vous"}
            </Etiquette>
            {ignore.nature ? <BadgeNature nature={ignore.nature} ciel /> : null}
          </>
        ) : (
          <>
            <BadgeConseil conseil={relvo!.conseil} />
            {relvo!.nature ? <BadgeNature nature={relvo!.nature} ciel /> : null}
          </>
        )}
      </div>
      {phrase ? (
        <p className="flex items-start gap-1.5 text-[12.5px] leading-[1.4]">
          {deRelvo ? (
            <RelvoLogo
              size={14}
              variant="inverted"
              title=""
              className="mt-[2px] flex-none text-relvo"
            />
          ) : null}
          <span className="min-w-0">
            {phrase}
            {relvo?.time && !ignore ? (
              <span className="text-white/80"> · {relvo.time}</span>
            ) : null}
          </span>
        </p>
      ) : null}
      {ignore?.unimported ? (
        <p className="text-[12.5px] leading-[1.4] text-white/90">
          {compteLong(ignore.unimported)}
        </p>
      ) : null}
    </div>
  );
}
