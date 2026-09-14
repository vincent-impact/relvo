import { cn } from "@/lib/utils";

// Logo Relvo — VECTORISÉ (Direction « Instrument », 2026-09). Un disque + trois
// étoiles à quatre branches. Le disque est en `currentColor` : posé dans un
// élément `text-relvo`, le logo suit le token — et suivra un mode sombre — sans
// nouveau fichier. Les PNG de la PWA (`public/relvo-icon-*.png`, apple-touch)
// se GÉNÈRENT depuis ce même tracé : `pnpm icons` (scripts/generate-icons.mjs).
// ⚠️ Modifier le tracé ici ET dans le script, ou mieux : le script lit ce fichier.

export const RELVO_LOGO_PATHS = {
  disc: { cx: 256, cy: 256, r: 200 },
  stars: [
    "M250 130 C258 214 274 240 372 254 C274 268 258 294 250 378 C242 294 226 268 128 254 C226 240 242 214 250 130 Z",
    "M326 116 C329 140 336 148 360 152 C336 156 329 164 326 188 C323 164 316 156 292 152 C316 148 323 140 326 116 Z",
    "M380 176 C382 190 386 194 400 196 C386 198 382 202 380 216 C378 202 374 198 360 196 C374 194 378 190 380 176 Z",
  ],
} as const;

export function RelvoLogo({
  size = 32,
  className,
  title = "Relvo",
}: {
  size?: number;
  className?: string;
  /** Libellé accessible ; `""` pour un logo purement décoratif. */
  title?: string;
}) {
  const { disc, stars } = RELVO_LOGO_PATHS;
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
    >
      <circle cx={disc.cx} cy={disc.cy} r={disc.r} fill="currentColor" />
      <g fill="#fafafa">
        {stars.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
