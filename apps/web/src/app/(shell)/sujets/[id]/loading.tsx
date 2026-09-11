import { MobileFrame } from "@/components/layout/mobile-frame";

// Squelette de chargement de la fiche Sujet (M9.19). Affiché par Next dès le clic,
// le temps que getSubjectDetail réponde — supprime la latence perçue (cold start
// Neon). Reproduit la silhouette : hero violet (status-strip + résumé) + bulles.

export default function Loading() {
  return (
    <MobileFrame>
      <div
        className="rounded-b-(--hero-round) bg-relvo px-[22px] pb-9"
        style={{ paddingTop: "max(env(safe-area-inset-top), 14px)" }}
      >
        <div className="h-4 w-16 rounded bg-white/20" />
        <div className="mt-4 h-6 w-3/4 rounded-lg bg-white/25" />
        <div className="mt-3 h-4 w-full rounded bg-white/15" />
        <div className="mt-2 h-4 w-5/6 rounded bg-white/15" />
      </div>
      <div className="flex-1 space-y-3.5 px-[18px] pt-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-2xl bg-(--surface)"
            style={{ width: i % 2 === 0 ? "82%" : "70%" }}
          />
        ))}
      </div>
    </MobileFrame>
  );
}
