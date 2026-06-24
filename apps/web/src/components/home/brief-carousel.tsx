"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

// Brief carousel (Accueil, Direction B) — 3 infos dans la zone agent violette,
// scroll-snap horizontal + pastilles + auto-défilement (~4.2 s). Cartes en verre
// blanc translucide sur le violet. Le contenu est calculé côté serveur et passé
// en props ; ce composant ne gère que le défilement.

const ICONS = { spark: Sparkles, watch: TriangleAlert, good: Check } as const;

export type BriefSlide = {
  icon: keyof typeof ICONS;
  label: string;
  body: React.ReactNode;
};

export function BriefCarousel({ slides }: { slides: BriefSlide[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || slides.length < 2) return;
    const onScroll = () => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      setIndex(i);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    const timer = setInterval(() => {
      const next =
        (Math.round(track.scrollLeft / track.clientWidth) + 1) % slides.length;
      track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
    }, 4200);
    return () => {
      track.removeEventListener("scroll", onScroll);
      clearInterval(timer);
    };
  }, [slides.length]);

  return (
    <div className="mt-4">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s, i) => {
          const Icon = ICONS[s.icon];
          return (
            <div key={i} className="w-full flex-none snap-center px-[22px]">
              <div
                className="rounded-[18px] px-4 pt-[15px] pb-4"
                style={{
                  background: "rgb(255 255 255 / 0.15)",
                  border: "1px solid rgb(255 255 255 / 0.2)",
                }}
              >
                <div className="mb-[9px] inline-flex items-center gap-1.5 text-[11.5px] font-bold tracking-[0.4px] text-white/80 uppercase">
                  <Icon className="size-3.5" strokeWidth={2.2} />
                  {s.label}
                </div>
                <p className="text-[15px] leading-[1.45] text-white/90">
                  {s.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {slides.length > 1 ? (
        <div className="mt-[13px] flex justify-center gap-1.5">
          {slides.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                i === index ? "w-[18px] bg-white" : "w-1.5 bg-white/40",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
