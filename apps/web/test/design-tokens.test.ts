import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Le design system est tenu par un TEST, pas par la vigilance
// (conception/design-system/00-brief-da.md §8, 01-tokens.md). Trois choses sont
// gardées ici :
//   1. l'INVENTAIRE : chaque famille de tokens que 01-tokens.md nomme existe
//      dans globals.css, sous le nom que la doc emploie ;
//   2. la MATIÈRE écartée ne revient pas : ni Geist, ni verre, ni grain, ni
//      pierre comme valeur vivante ;
//   3. AUCUNE couleur en dur dans un composant neuf : la liste des fichiers qui
//      en portent encore est un cliquet — elle ne peut que rétrécir.

const ROOT = resolve(import.meta.dirname, "..");
const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");

const tokensAttendus = [
  // la livrée
  "--nuit",
  "--relvo",
  "--relvo-clair",
  "--relvo-pale",
  "--relvo-filet",
  "--ciel",
  "--ciel-bas",
  "--ciel-queue",
  "--ciel-plein",
  "--etoiles",
  "--etoile-signe",
  "--degrade-relvo",
  "--degrade-disque",
  // les acteurs
  "--actor-me",
  "--actor-relvo",
  "--actor-ext",
  "--actor-ext-fond",
  // les domaines : bande + texte, pour chaque clé stockée sur un Folder
  ...[
    "blue",
    "teal",
    "green",
    "lime",
    "amber",
    "orange",
    "red",
    "purple",
    "pink",
    "neutre",
  ].flatMap((k) => [`--domaine-${k}`, `--domaine-${k}-texte`]),
  // les états
  "--urgent",
  "--fait",
  "--attente",
  "--attente-texte",
  // le noir, les gris, le blanc
  "--noir",
  "--gris",
  "--gris-clair",
  "--filet",
  "--fond-enfonce",
  "--fond-puce",
  "--blanc",
  // les rayons comptés
  "--rayon-petit",
  "--rayon-bouton-ciel",
  "--rayon-option",
  "--rayon-sous-carte",
  "--rayon-carte",
  "--rayon-feuille",
  "--rayon-dock",
  "--rayon-pilule",
  // les ombres
  "--ombre-carte",
  "--ombre-feuille",
  "--ombre-dock",
  "--ombre-disque",
  "--ombre-haut",
  "--ombre-pressed",
  // le chrome mobile
  "--dock-h",
  "--dock-marge",
  "--disque-relvo",
  "--dock-etire",
  "--bar-h",
  "--tab-h",
  // la typographie
  "--font-barlow",
  "--font-barlow-condensed",
  // le mouvement : quatre durées, trois courbes
  "--dur-presse",
  "--dur-court",
  "--dur-moyen",
  "--dur-accompagnement",
  "--courbe-sortie",
  "--courbe-deplacement",
  "--courbe-feuille",
];

describe("design tokens — l'inventaire de 01-tokens.md", () => {
  it("déclare chaque token que la doc nomme", () => {
    const manquants = tokensAttendus.filter(
      (t) =>
        !new RegExp(
          `(^|[\\s(,;])${t.replace(/[-]/g, "\\-")}\\s*[:)]`,
          "m",
        ).test(css),
    );
    expect(manquants).toEqual([]);
  });

  it("expose la matière en utilitaires : ciel, chiffre, domaine, bande, cercle", () => {
    for (const cls of [
      ".ciel",
      ".ciel-queue",
      ".chiffre",
      ".domaine",
      ".libelle",
      ".bande-carte",
      ".bande-ligne",
      ".cercle-actif",
      ".pressable:active",
      // le mouvement : les primitives et le mode réduit
      "@keyframes apparait",
      "@keyframes entre-ecran",
      "@keyframes arrive",
      ".apparait",
      ".apparait-liste",
      ".entre-ecran",
      ".arrive",
      ".respire",
      "@media (prefers-reduced-motion: reduce)",
    ]) {
      expect(css, cls).toContain(cls);
    }
  });

  it("fait partir les transitions de Tailwind sur les tokens", () => {
    expect(css).toMatch(/--default-transition-duration:\s*var\(--dur-court\)/);
    expect(css).toMatch(
      /--default-transition-timing-function:\s*var\(--courbe-sortie\)/,
    );
  });

  it("ne garde rien de la matière écartée comme valeur vivante", () => {
    expect(css).not.toMatch(/--font-geist/);
    expect(css).not.toMatch(/backdrop-filter/);
    expect(css).not.toMatch(/feTurbulence/);
    // la pierre n'existe plus qu'en alias du blanc
    expect(css).toMatch(/--stone:\s*var\(--blanc\)/);
    // le fond de l'écran est blanc
    expect(css).toMatch(/--background:\s*var\(--blanc\)/);
    // aucun domaine n'est violet (la clé « purple » rend autre chose que la livrée)
    const purple = /--domaine-purple:\s*([^;]+);/.exec(css)?.[1]?.trim();
    expect(purple).toBeDefined();
    expect(purple).not.toBe("#4a3fb5");
    expect(purple).not.toBe("#6d5df5");
  });

  it("charge une seule famille, en deux dessins", () => {
    const fonts = readFileSync(join(ROOT, "src/app/fonts.ts"), "utf8");
    expect(fonts).toMatch(/Barlow_Semi_Condensed/);
    expect(fonts).toMatch(/\bBarlow\b/);
    expect(fonts).not.toMatch(/Geist/);
  });
});

// Fichiers qui portent ENCORE une couleur en dur. Le cliquet : un fichier qui
// s'en débarrasse se retire d'ici ; un fichier neuf ne s'y ajoute pas. Les
// exceptions durables sont nommées avec leur raison.
const EXCEPTIONS_DURABLES = new Set([
  "src/components/layout/relvo-logo.tsx", // le logo est une marque : ses blancs sont les siens
  "src/app/(public)/site/site.module.css", // le site (M24.10), lu hors de l'application : ses tokens scopés et son mode sombre, comme le suivi client
  "src/components/auth/google-button.tsx", // les couleurs du G sont celles de Google
  "src/app/manifest.ts", // le manifeste PWA est lu hors CSS
  "src/app/(shell)/layout.tsx", // themeColor, lu hors CSS
  "src/lib/email.ts", // HTML d'e-mail sortant : aucune feuille de style de l'app n'y est chargée
  "src/components/conversations/email-html-frame.tsx", // feuille injectée dans l'iframe isolée d'un e-mail reçu : les variables de l'app n'y existent pas
  "src/app/(public)/suivi/[token]/suivi.module.css", // la page de suivi se lit HORS de l'application, avec sa propre feuille
]);
const RESTE_A_MIGRER: string[] = [];

function* fichiersSource(dir: string): Generator<string> {
  for (const nom of readdirSync(dir)) {
    const p = join(dir, nom);
    if (statSync(p).isDirectory()) yield* fichiersSource(p);
    else if (/\.(tsx?|css)$/.test(nom) && !/\.test\.tsx?$/.test(nom)) yield p;
  }
}

// Les GLYPHES que lucide a le droit de fournir : ce qui EST un trait (chevron,
// croix, plus, coche, flèches, loader). Tout pictogramme vient de
// components/shared/picto.tsx (Phosphor, graisse « fill ») — « icônes pleines »,
// socle verrouillé par le dirigeant (00-brief-da §5). Les primitives du
// registre (components/ui) gardent leurs icônes.
const GLYPHES_LUCIDE = new Set([
  "Check",
  "ChevronDown",
  "ChevronLeft",
  "ChevronRight",
  "ChevronUp",
  "Loader2",
  "Loader2Icon",
  "Menu",
  "Plus",
  "RefreshCw",
  "RotateCcw",
  "RotateCw",
  "Search",
  "X",
]);

describe("design tokens — icônes pleines", () => {
  it("lucide ne fournit que des glyphes, les pictogrammes viennent de picto.tsx", () => {
    const fautifs: string[] = [];
    for (const p of fichiersSource(join(ROOT, "src"))) {
      if (p.includes("/components/ui/")) continue;
      const src = readFileSync(p, "utf8");
      for (const m of src.matchAll(
        /import (?:type )?\{([^}]*)\} from "lucide-react"/g,
      )) {
        for (const raw of m[1].split(",")) {
          const nom = raw.replace(/^\s*type\s+/, "").trim();
          if (nom && !GLYPHES_LUCIDE.has(nom))
            fautifs.push(`${relative(ROOT, p)} : ${nom}`);
        }
      }
    }
    expect(fautifs, "pictogramme lucide — passer par shared/picto.tsx").toEqual(
      [],
    );
  });

  it("chaque pictogramme est rendu en graisse pleine", () => {
    const picto = readFileSync(
      join(ROOT, "src/components/shared/picto.tsx"),
      "utf8",
    );
    expect(picto).toMatch(/weight="fill"/);
    expect(picto).toMatch(/@phosphor-icons\/react\/dist\/ssr/);
  });
});

describe("design tokens — aucune couleur en dur dans un composant", () => {
  it("le cliquet des fichiers à migrer ne s'allonge pas", () => {
    const hex = /#[0-9a-fA-F]{6}\b/;
    const porteurs = [...fichiersSource(join(ROOT, "src"))]
      .filter((p) => !p.endsWith("globals.css"))
      .filter((p) => hex.test(readFileSync(p, "utf8")))
      .map((p) => relative(ROOT, p))
      .filter((p) => !EXCEPTIONS_DURABLES.has(p))
      .sort();
    const nouveaux = porteurs.filter((p) => !RESTE_A_MIGRER.includes(p));
    expect(nouveaux, "nouveau fichier avec une couleur en dur").toEqual([]);
    const migres = RESTE_A_MIGRER.filter((p) => !porteurs.includes(p));
    expect(migres, "fichiers migrés : les retirer de RESTE_A_MIGRER").toEqual(
      [],
    );
  });
});

// Le mouvement est tenu par ses tokens (01-tokens.md, « Le mouvement ») :
// aucune durée ni courbe littérale dans un composant, jamais `transition-all`
// (on nomme ce qui bouge), jamais `ease-in` sur une interface (elle démarre
// lentement, au moment où l'œil regarde). Les primitives du registre sont
// adaptées au thème comme les autres : elles ne font pas exception.
describe("design tokens — le mouvement passe par les tokens", () => {
  it("aucune durée, courbe ou transition-all littérale dans un composant", () => {
    const fautifs: string[] = [];
    const motifs: [RegExp, string][] = [
      [/\btransition-all\b/, "transition-all : nommer les propriétés"],
      [/\bduration-\d+\b/, "duration-N : duration-(--dur-*)"],
      [/\bease-in-out\b/, "ease-in-out : ease-deplacement ou ease-feuille"],
      [/\bease-in\b/, "ease-in : ease-sortie"],
      [
        /\banimate-(bounce|ping)\b/,
        "animate-bounce/ping : .respire ou .arrive",
      ],
      [
        /(transition|animation[A-Za-z]*)\s*[:=]\s*[`"'][^`"']*\d+m?s\b/,
        "durée en millisecondes dans un style : var(--dur-*)",
      ],
    ];
    for (const p of fichiersSource(join(ROOT, "src"))) {
      if (p.endsWith("globals.css") || p.endsWith("suivi.module.css")) continue;
      const src = readFileSync(p, "utf8");
      for (const [re, raison] of motifs) {
        if (re.test(src)) fautifs.push(`${relative(ROOT, p)} : ${raison}`);
      }
    }
    expect(fautifs).toEqual([]);
  });
});
