import Link from "next/link";

// Carte Agenda (Accueil + Planning). Jours empilés ; chaque jour liste ses
// tâches datées avec une pastille de couleur par Dossier (cf. .agenda du mockup).

export type AgendaDay = {
  key: string;
  weekday: string;
  day: number;
  isToday: boolean;
  items: {
    id: string;
    title: string;
    time: string | null;
    color: string;
    href: string;
  }[];
};

export function AgendaCard({ days }: { days: AgendaDay[] }) {
  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-(--border-light) bg-white p-4 text-center text-[13.5px] text-(--text-tertiary) shadow-(--shadow-card)">
        Rien de prévu dans les prochains jours.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-(--border-light) bg-white shadow-(--shadow-card)">
      {days.map((d) => (
        <div
          key={d.key}
          className="flex gap-3 border-b border-(--border-light) px-3.5 py-3 last:border-b-0"
        >
          <div className="w-[42px] flex-none text-center">
            <div
              className={
                d.isToday
                  ? "text-[18px] leading-none font-bold text-brand"
                  : "text-[18px] leading-none font-bold"
              }
            >
              {d.day}
            </div>
            <div className="text-[10.5px] tracking-[0.5px] text-(--text-tertiary) uppercase">
              {d.weekday}
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            {d.items.length === 0 ? (
              <span className="text-[13.5px] text-(--text-tertiary)">—</span>
            ) : (
              d.items.map((it) => (
                <Link
                  key={it.id}
                  href={it.href}
                  className="flex items-center gap-2 text-[13.5px]"
                >
                  <span
                    className="size-2 flex-none rounded-full"
                    style={{ background: it.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{it.title}</span>
                  <span className="ml-auto flex-none text-[12px] text-(--text-tertiary)">
                    {it.time ?? "—"}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
