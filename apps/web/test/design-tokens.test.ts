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
  "--dock-deborde",
  "--disque-relvo",
  "--bar-h",
  "--tab-h",
  // la typographie
  "--font-barlow",
  "--font-barlow-condensed",
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
      ".chiffre",
      ".domaine",
      ".libelle",
      ".bande-carte",
      ".bande-ligne",
      ".cercle-actif",
      ".pressable:active",
    ]) {
      expect(css, cls).toContain(cls);
    }
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
  "src/components/auth/google-button.tsx", // les couleurs du G sont celles de Google
  "src/app/manifest.ts", // le manifeste PWA est lu hors CSS
  "src/app/(shell)/layout.tsx", // themeColor, lu hors CSS
  "src/lib/email.ts", // HTML d'e-mail sortant : aucune feuille de style de l'app n'y est chargée
  "src/app/(public)/suivi/[token]/suivi.module.css", // la page de suivi se lit HORS de l'application, avec sa propre feuille
]);
const RESTE_A_MIGRER = [
  "src/app/(shell)/(app)/memoire/[id]/page.tsx",
  "src/app/(shell)/(app)/sujets/[id]/page.tsx",
  "src/components/contacts/contacts-directory.tsx",
  "src/components/contacts/contacts-groups.tsx",
  "src/components/conversations/conversation-list.tsx",
  "src/components/conversations/decision-sheet.tsx",
  "src/components/conversations/email-html-frame.tsx",
  "src/components/conversations/email-message.tsx",
  "src/components/home/news-panel.tsx",
  "src/components/layout/header-switch.tsx",
  "src/components/layout/relvo-dock-button.tsx",
  "src/components/layout/side-menu.tsx",
  "src/components/relvo-chat/relvo-chat-shell.tsx",
  "src/components/shared/attachment-preview.tsx",
  "src/components/shared/message-bubble.tsx",
  "src/components/shared/metrics-card.tsx",
  "src/components/shared/subject-row.tsx",
  "src/components/subject/informations-pane.tsx",
  "src/components/subject/journal-pane.tsx",
  "src/components/subject/relvo-draft-block.tsx",
  "src/components/subject/resolution-banner.tsx",
  "src/components/subject/subject-conversations-list.tsx",
  "src/components/subject/task-item.tsx",
];

function* fichiersSource(dir: string): Generator<string> {
  for (const nom of readdirSync(dir)) {
    const p = join(dir, nom);
    if (statSync(p).isDirectory()) yield* fichiersSource(p);
    else if (/\.(tsx?|css)$/.test(nom) && !/\.test\.tsx?$/.test(nom)) yield p;
  }
}

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
