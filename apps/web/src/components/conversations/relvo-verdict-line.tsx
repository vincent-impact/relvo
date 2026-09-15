import { RelvoLogo } from "@/components/layout/relvo-logo";
import type { IgnoreData, RelvoVerdictData } from "@/lib/conversation-row";
import { cn } from "@/lib/utils";

// La ligne « ce que Relvo en pense » (M7.20, première forme) — sous la ligne
// méta d'une conversation, et en tête du fil. Une seule ligne, la raison en
// clair : c'est ce qui permet à l'utilisateur de confirmer ou contredire d'un
// geste (05 §1.1), et de voir, au début, si Relvo fait bien le travail.
//
//   • fil ignoré PAR RELVO → « Ignorée par Relvo · publicité — raison »
//   • fil ignoré par l'utilisateur → « Ignorée · pas mon rôle » (sa raison, s'il en a une)
//   • avis seul → « Relvo · À traiter · professionnel — raison »,
//     « Relvo · Rien à faire · automatique — raison », « Relvo · À considérer · … »
//   • rien → null : Relvo n'a pas lu ce fil (rien n'est affiché en liste).
// Ce n'est PAS un résumé de la conversation : c'est un verdict daté, rendu sur
// le fil à son arrivée. Les appelants ne l'affichent que sur un fil sans sujet
// ou ignoré ; un fil suivi a sa mémoire dans le sujet (05 §1.6).
// Les mots sont ceux de l'utilisateur (`lib/conversation-row`), jamais ceux du
// modèle : « bruit » ou « autre » ne s'affichent nulle part.

export function RelvoVerdictLine({
  relvo,
  ignore,
  className,
  clamp = true,
}: {
  relvo: RelvoVerdictData | null;
  ignore: IgnoreData | null;
  className?: string;
  /** Une ligne (liste) ou le texte entier (fil). */
  clamp?: boolean;
}) {
  if (!relvo && !ignore) return null;

  let head: string;
  let reason: string | null;
  if (ignore) {
    head = ignore.byRelvo
      ? `Ignorée par Relvo${ignore.reasonLabel ? ` · ${ignore.reasonLabel}` : ""}`
      : `Ignorée${ignore.reasonLabel ? ` · ${ignore.reasonLabel}` : ""}`;
    reason = ignore.note ?? (ignore.byRelvo ? (relvo?.reason ?? null) : null);
  } else {
    head = `Relvo · ${relvo!.label}`;
    reason = relvo!.reason || null;
  }
  const byRelvo = !ignore || ignore.byRelvo;

  return (
    <p
      className={cn(
        "flex min-w-0 items-start gap-1.5 text-[12.5px] leading-[1.4]",
        byRelvo ? "text-relvo" : "text-(--text-tertiary)",
        className,
      )}
    >
      {byRelvo ? (
        <RelvoLogo
          size={14}
          variant="full"
          title=""
          className="mt-[2px] flex-none"
        />
      ) : null}
      <span className={cn("min-w-0", clamp && "line-clamp-1")}>
        <span className="font-semibold">{head}</span>
        {reason ? (
          <span className={cn(byRelvo ? "text-(--text-secondary)" : "")}>
            {" — "}
            {reason}
          </span>
        ) : null}
        {relvo?.time && !ignore ? (
          <span className="text-(--text-tertiary)"> · {relvo.time}</span>
        ) : null}
      </span>
    </p>
  );
}
