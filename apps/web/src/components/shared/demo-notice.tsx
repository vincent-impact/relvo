import { Flask } from "@/components/shared/picto";

// DemoNotice — dit à l'utilisateur qu'un écran montre des chiffres de
// démonstration, pas encore reliés à ses données. Une page qui pourrait mentir
// le dit en tête, pas en note de bas de page.

export function DemoNotice({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="note"
      // Gris, pas ambre : « démonstration » n'est ni un tiers ni une attente,
      // et ces couleurs ne s'empruntent pas.
      className="mx-4 flex items-start gap-2.5 rounded-(--rayon-option) bg-(--fond-enfonce) px-3.5 py-2.5 text-[12px] leading-4 font-normal text-gris"
    >
      <Flask className="mt-px size-4 flex-none" />
      <span>{children}</span>
    </div>
  );
}
