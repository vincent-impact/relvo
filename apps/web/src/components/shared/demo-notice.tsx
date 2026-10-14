import { Flask } from "@/components/shared/picto";

// DemoNotice — dit à l'utilisateur qu'un écran montre des chiffres de
// démonstration, pas encore reliés à ses données. Une page qui pourrait mentir
// le dit en tête, pas en note de bas de page.

export function DemoNotice({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="note"
      className="mx-4 flex items-start gap-2.5 rounded-[12px] border border-(--amber-800)/20 bg-(--amber-50) px-3.5 py-2.5 text-[12.5px] leading-[1.4] text-(--amber-800)"
    >
      <Flask className="mt-px size-4 flex-none" />
      <span>{children}</span>
    </div>
  );
}
