import { MobileFrame } from "@/components/layout/mobile-frame";

// Squelette de chargement « Nouveau sujet » (M9.19) — hero violet + champs de
// formulaire. Affiché le temps que folders + contacts chargent.

export default function Loading() {
  return (
    <MobileFrame>
      <div
        className="rounded-b-(--hero-round) bg-relvo px-[22px] pb-9"
        style={{ paddingTop: "max(env(safe-area-inset-top), 14px)" }}
      >
        <div className="h-4 w-16 rounded bg-white/20" />
        <div className="mt-4 h-7 w-2/3 rounded-lg bg-white/25" />
      </div>
      <div className="flex-1 space-y-5 px-[22px] pt-7">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3.5 w-24 rounded bg-(--surface)" />
            <div className="h-11 animate-pulse rounded-xl bg-(--surface)" />
          </div>
        ))}
      </div>
    </MobileFrame>
  );
}
