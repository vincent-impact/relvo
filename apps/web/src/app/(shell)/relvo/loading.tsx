import { MobileFrame } from "@/components/layout/mobile-frame";

// Squelette de chargement de l'échange plein écran avec Relvo (M9.19) — hero violet +
// orb central. Affiché le temps de résoudre le contexte page-aware.

export default function Loading() {
  return (
    <MobileFrame>
      <div
        className="bg-relvo px-[22px] pb-5"
        style={{ paddingTop: "max(env(safe-area-inset-top), 14px)" }}
      >
        <div className="h-6 w-28 rounded-lg bg-white/25" />
        <div className="mt-2 h-3.5 w-36 rounded bg-white/15" />
      </div>
      <div className="grid flex-1 place-items-center">
        <div className="size-16 animate-pulse rounded-full bg-(--surface)" />
      </div>
    </MobileFrame>
  );
}
