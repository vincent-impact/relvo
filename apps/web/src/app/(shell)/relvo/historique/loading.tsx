import { MobileFrame } from "@/components/layout/mobile-frame";

// Squelette de chargement de l'historique des échanges avec Relvo (M9.19).

export default function Loading() {
  return (
    <MobileFrame>
      <div
        className="bg-relvo px-[22px] pb-5"
        style={{ paddingTop: "max(env(safe-area-inset-top), 14px)" }}
      >
        <div className="h-6 w-44 rounded-lg bg-white/25" />
      </div>
      <div className="flex-1 space-y-3 px-4 pt-5">
        <div className="h-[68px] animate-pulse rounded-2xl bg-(--surface)" />
        <div className="mt-7 h-3 w-20 rounded bg-(--surface)" />
        <div className="h-4 w-2/3 rounded bg-(--surface)" />
      </div>
    </MobileFrame>
  );
}
