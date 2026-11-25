import { cn } from "@/lib/utils";

// Une ligne « libellé — valeur » du backoffice, dans un ListPanel : le libellé
// en gris à gauche, la valeur en chiffres à droite, et un ton quand elle
// appelle un regard.

export function Ligne({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone?: "urgent" | "attente";
}) {
  return (
    <div
      data-list-row
      className="flex items-baseline justify-between gap-3 border-b border-(--filet) px-4 py-2.5 text-[14px]"
    >
      <span className="font-light text-gris">{label}</span>
      <span
        className={cn(
          "chiffre text-right font-normal text-noir",
          tone === "urgent" && "text-urgent",
          tone === "attente" && "text-(--attente)",
        )}
      >
        {children}
      </span>
    </div>
  );
}
