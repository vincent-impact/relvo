import { MobileFrame } from "@/components/layout/mobile-frame";

// Squelette de chargement de l'échange plein écran avec Relvo (M9.19) : la
// silhouette du rendu — le ciel, puis la place du bloc de Relvo.

export default function Loading() {
  return (
    <MobileFrame>
      <div
        className="ciel px-4 pb-4"
        style={{
          paddingTop: "calc(max(env(safe-area-inset-top), 12px) + 14px)",
        }}
      >
        <div className="flex h-[34px] items-center gap-2">
          <div className="size-[30px] rounded-(--rayon-bouton-ciel) bg-white/14" />
          <div className="h-[30px] w-24 rounded-lg bg-white/30" />
        </div>
      </div>
      <div className="mx-4 mt-4 h-[150px] animate-pulse rounded-(--rayon-carte) border border-relvo-filet bg-relvo-pale" />
    </MobileFrame>
  );
}
