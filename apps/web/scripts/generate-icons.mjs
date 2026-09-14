// Génère les icônes PWA de Relvo depuis le logo VECTORISÉ
// (`src/components/layout/relvo-logo.tsx`) — une seule source de vérité pour la
// forme ET la couleur : le disque prend `--relvo` lu dans `globals.css`.
//
//   pnpm icons            → public/relvo-icon.png (256, transparent — bouton)
//                           public/relvo-icon-{48,96,192,512}.png (transparents)
//                           public/apple-touch-icon.png (180, fond pierre opaque :
//                           iOS refuse la transparence et noircit le fond)
//
// `sharp` n'est pas une dépendance du projet mais de Next (optionnelle) : on la
// prend là où pnpm la range (le store `.pnpm` à la racine du monorepo).
import { createRequire } from "node:module";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const require = createRequire(import.meta.url);
function loadSharp() {
  try {
    return require("sharp");
  } catch {
    const store = join(root, "..", "..", "node_modules", ".pnpm");
    const dir = readdirSync(store).find((d) => d.startsWith("sharp@"));
    if (!dir)
      throw new Error("sharp introuvable — `pnpm add -D sharp` dans apps/web");
    return require(join(store, dir, "node_modules", "sharp"));
  }
}
const sharp = loadSharp();

// --- couleur : le token --relvo de globals.css
const css = readFileSync(join(root, "src/app/globals.css"), "utf8");
const relvo = css.match(/--relvo:\s*(#[0-9a-fA-F]{6})/)?.[1];
const stone = css.match(/--stone:\s*(#[0-9a-fA-F]{6})/)?.[1] ?? "#f4f3f0";
if (!relvo) throw new Error("--relvo introuvable dans globals.css");

// --- forme : les tracés du composant (on lit le source, pas de build TS)
const tsx = readFileSync(
  join(root, "src/components/layout/relvo-logo.tsx"),
  "utf8",
);
const stars = [...tsx.matchAll(/"(M[^"]+Z)"/g)].map((m) => m[1]);
const disc = tsx.match(/disc:\s*\{\s*cx:\s*(\d+),\s*cy:\s*(\d+),\s*r:\s*(\d+)/);
if (stars.length !== 3 || !disc)
  throw new Error("Tracés du logo introuvables dans relvo-logo.tsx");

const svg = (
  bg,
) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${bg ? `<rect width="512" height="512" fill="${bg}"/>` : ""}
  <circle cx="${disc[1]}" cy="${disc[2]}" r="${disc[3]}" fill="${relvo}"/>
  <g fill="#fafafa">${stars.map((d) => `<path d="${d}"/>`).join("")}</g>
</svg>`;

const out = (name) => join(root, "public", name);
const targets = [
  ["relvo-icon.png", 256, null],
  ["relvo-icon-48.png", 48, null],
  ["relvo-icon-96.png", 96, null],
  ["relvo-icon-192.png", 192, null],
  ["relvo-icon-512.png", 512, null],
  ["apple-touch-icon.png", 180, stone],
];
for (const [name, size, bg] of targets) {
  const png = await sharp(Buffer.from(svg(bg)), { density: 384 })
    .resize(size, size)
    .png()
    .toBuffer();
  writeFileSync(out(name), png);
  console.log(`${name.padEnd(22)} ${size}×${size}${bg ? ` fond ${bg}` : ""}`);
}
writeFileSync(out("relvo-logo.svg"), svg(null));
console.log(`relvo-logo.svg         vectoriel (${relvo})`);
