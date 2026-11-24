import { RelvoLogo } from "@/components/layout/relvo-logo";
import {
  type Picto,
  Briefcase,
  CheckCircle,
  DotsThreeCircle,
  EyeSlash,
  Handshake,
  House,
  Megaphone,
  Question,
  Robot,
  ThumbsDown,
  ThumbsUp,
  User,
  UserSwitch,
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
import { compteCourt, compteLong } from "@/lib/trou";
import { cn } from "@/lib/utils";

// L'AVIS DE TRI sur une conversation, en BADGES — jamais en phrase dans une
// liste. Deux informations, deux badges, chacun son pictogramme :
//
//   · la NATURE — de quoi il s'agit : un badge PLEIN, pâle. Sa teinte dit qui
//     parle, d'après le triptyque d'acteurs (design-system/01-tokens) : violet
//     quand c'est Relvo, bleu quand c'est vous qui avez ignoré.
//   · le CONSEIL — ce que Relvo en ferait : un badge CERCLÉ, le pouce levé
//     (« À considérer ») ou baissé (« À ignorer »). Il ne se lit que sur une
//     conversation à trier ; une conversation que Relvo n'a pas lue porte
//     « Sans avis », en gris — l'absence ne doit pas ressembler à une panne.
//
// La forme sépare les deux familles, pas la couleur : trois teintes en tout
// (violet, bleu, gris), et le bleu est l'exception.
// Les appelants ne l'affichent que sur une conversation sans sujet ou ignorée ;
// une conversation suivie a sa mémoire dans le sujet (05 §1.6).

const NATURE_PICTOS: Record<NatureCle, Picto> = {
  professional: Briefcase,
  personal: House,
  advertising: Megaphone,
  prospecting: Handshake,
  automatic: Robot,
  not_my_role: UserSwitch,
  handled_elsewhere: CheckCircle,
  other: DotsThreeCircle,
};

const CONSEIL_PICTOS: Record<Conseil, Picto> = {
  considerer: ThumbsUp,
  ignorer: ThumbsDown,
};

type Ton = "relvo" | "moi" | "neutre" | "ciel";

const PLEIN: Record<Ton, string> = {
  relvo: "bg-relvo-pale text-relvo",
  moi: "bg-(--blue-50) text-(--blue-600)",
  neutre: "bg-(--fond-puce) text-gris",
  ciel: "bg-white/20 text-white",
};

const CERCLE: Record<Ton, string> = {
  relvo: "border-relvo-filet bg-white text-relvo",
  moi: "border-(--blue-100) bg-white text-(--blue-600)",
  neutre: "border-(--filet) bg-white text-gris",
  ciel: "border-white/40 bg-transparent text-white",
};

function Etiquette({
  icon: Icon,
  ton,
  cercle = false,
  children,
}: {
  icon: Picto;
  ton: Ton;
  /** Cerclé : un conseil. Plein : une nature. */
  cercle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Badge
      className={cn(
        "font-medium",
        cercle ? CERCLE[ton] : cn("border-transparent", PLEIN[ton]),
      )}
    >
      <Icon aria-hidden />
      {children}
    </Badge>
  );
}

/** La nature d'une conversation ignorée, ou à défaut qui l'a ignorée. */
function NatureIgnoree({ ignore, ton }: { ignore: IgnoreData; ton: Ton }) {
  if (ignore.nature) {
    return (
      <Etiquette icon={NATURE_PICTOS[ignore.nature]} ton={ton}>
        {NATURE_LABELS[ignore.nature]}
      </Etiquette>
    );
  }
  return null;
}

/**
 * Sur une ligne de la liste : la nature et le conseil, ou « Sans avis ».
 * Dans « ignorées », la nature seule, à la teinte de qui a ignoré.
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
  if (ignore) {
    const ton: Ton = ignore.byRelvo ? "relvo" : "moi";
    return (
      <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
        {ignore.nature ? (
          <NatureIgnoree ignore={ignore} ton={ton} />
        ) : (
          // Ignorée sans raison dite : le badge dit au moins par qui.
          <Etiquette icon={ignore.byRelvo ? EyeSlash : User} ton={ton}>
            {ignore.byRelvo ? "Par Relvo" : "Par vous"}
          </Etiquette>
        )}
        {ignore.unimported ? (
          <span className="chiffre truncate text-[12px] text-gris">
            {compteCourt(ignore.unimported)}
          </span>
        ) : null}
      </div>
    );
  }

  if (!relvo) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <Etiquette icon={Question} ton="neutre" cercle>
          {SANS_AVIS}
        </Etiquette>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
      {relvo.nature ? (
        <Etiquette icon={NATURE_PICTOS[relvo.nature]} ton="relvo">
          {NATURE_LABELS[relvo.nature]}
        </Etiquette>
      ) : null}
      <Etiquette icon={CONSEIL_PICTOS[relvo.conseil]} ton="relvo" cercle>
        {CONSEIL_LABELS[relvo.conseil]}
      </Etiquette>
    </div>
  );
}

/**
 * En tête du fil, sur le ciel : les mêmes badges, en blanc, puis la phrase de
 * Relvo EN ENTIER — c'est ici, et seulement ici, qu'elle se lit. Le fil n'a pas
 * d'onglet pour dire l'état : une conversation ignorée le dit elle-même, et
 * par qui.
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
            <NatureIgnoree ignore={ignore} ton="ciel" />
          </>
        ) : (
          <>
            {relvo!.nature ? (
              <Etiquette icon={NATURE_PICTOS[relvo!.nature]} ton="ciel">
                {NATURE_LABELS[relvo!.nature]}
              </Etiquette>
            ) : null}
            <Etiquette icon={CONSEIL_PICTOS[relvo!.conseil]} ton="ciel" cercle>
              {CONSEIL_LABELS[relvo!.conseil]}
            </Etiquette>
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
      {/* Ce que la conversation n'importe plus, en clair (M25.10). */}
      {ignore?.unimported ? (
        <p className="text-[12.5px] leading-[1.4] text-white/90">
          {compteLong(ignore.unimported)}
        </p>
      ) : null}
    </div>
  );
}
