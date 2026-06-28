import Link from "next/link";
import { cn } from "@/lib/utils";

// MetricsCard — la « carte à cheval » (Direction B) : une surface blanche qui
// chevauche le bas du hero violet ; cellules séparées par un filet. La couleur
// est réservée au signal (tone « urgent » → rouge). Une cellule `gauge` rend un
// anneau de saturation circulaire (vert → ambre → rouge). Une cellule `value`
// peut porter un `href` → elle devient un lien (ex. KPI Accueil → Mon fil filtré).

export type Metric =
  | {
      type?: "value";
      value: number | string;
      label: string;
      tone?: "urgent";
      href?: string;
    }
  | { type: "gauge"; percent: number; label: string };

function gaugeColor(p: number) {
  if (p >= 80) return "var(--red-600)";
  if (p >= 50) return "#e8902b";
  return "var(--green-600)";
}

function GaugeCell({ percent, label }: { percent: number; label: string }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex flex-1 flex-col items-center gap-[5px] px-1">
      <div className="relative grid size-[34px] place-items-center">
        <svg width="34" height="34" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke="#efedea"
            strokeWidth="3.6"
          />
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke={gaugeColor(p)}
            strokeWidth="3.6"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${p} 100`}
            transform="rotate(-90 18 18)"
          />
        </svg>
        <span className="absolute font-numeric text-[11px] font-bold text-[#1c1a22]">
          {p}%
        </span>
      </div>
      <div className="text-center text-[12px] leading-[1.2] font-semibold text-[#9a988f]">
        {label}
      </div>
    </div>
  );
}

function ValueCell({
  value,
  label,
  tone,
  href,
}: {
  value: number | string;
  label: string;
  tone?: "urgent";
  href?: string;
}) {
  const inner = (
    <>
      <span
        className={cn(
          "flex h-[38px] items-center font-numeric text-[25px] font-bold tracking-[-1px]",
          tone === "urgent" ? "text-(--red-600)" : "text-[#1c1a22]",
        )}
      >
        {value}
      </span>
      <div className="text-center text-[12px] leading-[1.2] font-semibold text-[#9a988f]">
        {label}
      </div>
    </>
  );
  const cls = "flex flex-1 flex-col items-center gap-[5px] px-1";
  return href ? (
    <Link href={href} className={cn(cls, "rounded-xl active:opacity-60")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function MetricsCard({
  metrics,
  overlap = true,
  className,
}: {
  metrics: Metric[];
  /** true : remonte de 30px pour chevaucher le hero violet. */
  overlap?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative z-[3] mx-4 flex rounded-[22px] bg-white px-1 py-2.5",
        overlap && "-mt-[30px]",
        className,
      )}
      style={{ boxShadow: "var(--shadow-metrics)" }}
    >
      {metrics.map((m, i) => (
        <div key={i} className="contents">
          {i > 0 ? (
            <span className="my-1.5 w-px self-stretch bg-[#f1efeb]" />
          ) : null}
          {m.type === "gauge" ? (
            <GaugeCell percent={m.percent} label={m.label} />
          ) : (
            <ValueCell
              value={m.value}
              label={m.label}
              tone={m.tone}
              href={m.href}
            />
          )}
        </div>
      ))}
    </div>
  );
}
