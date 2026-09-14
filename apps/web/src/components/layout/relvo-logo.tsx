import { cn } from "@/lib/utils";

// Logo Relvo — VECTORISÉ. Un disque + trois étoiles à quatre branches, en trois
// variantes selon le fond (règle de charte : un logo a une version inversée pour
// les fonds de sa propre couleur) :
//   • `full`     — disque en `currentColor`, étoiles blanches. Fonds CLAIRS.
//   • `inverted` — disque blanc, étoiles en `currentColor`. Fonds VIOLETS où le
//                  logo est un OBJET (le bouton d'accès à Relvo).
//   • `mark`     — les étoiles seules, en `currentColor`. Fonds violets où le
//                  logo est une MARQUE (hero de connexion) : pas de tuile, pas de
//                  disque — un disque violet sur violet ne laisse qu'un halo.
// Posé dans un élément `text-relvo` / `text-white`, le logo suit le token — et
// suivra un mode sombre — sans nouveau fichier. Les PNG de la PWA
// (`public/relvo-icon-*.png`, apple-touch) se GÉNÈRENT depuis ce même tracé :
// `pnpm icons` (scripts/generate-icons.mjs lit ce fichier).

export const RELVO_LOGO_PATHS = {
  disc: { cx: 256, cy: 256, r: 200 },
  stars: [
    "M250 130 C258 214 274 240 372 254 C274 268 258 294 250 378 C242 294 226 268 128 254 C226 240 242 214 250 130 Z",
    "M326 116 C329 140 336 148 360 152 C336 156 329 164 326 188 C323 164 316 156 292 152 C316 148 323 140 326 116 Z",
    "M380 176 C382 190 386 194 400 196 C386 198 382 202 380 216 C378 202 374 198 360 196 C374 194 378 190 380 176 Z",
  ],
} as const;

export type RelvoLogoVariant = "full" | "inverted" | "mark";

export function RelvoLogo({
  size = 32,
  variant = "full",
  className,
  title = "Relvo",
}: {
  size?: number;
  variant?: RelvoLogoVariant;
  className?: string;
  /** Libellé accessible ; `""` pour un logo purement décoratif. */
  title?: string;
}) {
  const { disc, stars } = RELVO_LOGO_PATHS;
  const discFill =
    variant === "full"
      ? "currentColor"
      : variant === "inverted"
        ? "#fafafa"
        : null;
  const starFill = variant === "full" ? "#fafafa" : "currentColor";
  // Les étoiles s'inscrivent dans le carré 116..412 : en `mark`, la viewBox se
  // resserre dessus pour que `size` soit la taille RÉELLE de la marque.
  const viewBox = variant === "mark" ? "116 104 296 296" : "0 0 512 512";
  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
    >
      {discFill ? (
        <circle cx={disc.cx} cy={disc.cy} r={disc.r} fill={discFill} />
      ) : null}
      <g fill={starFill}>
        {stars.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
