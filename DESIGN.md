---
name: Relvo
description: Direction « Lettrage d'artisan » — un ciel violet qui fond vers le blanc, des cartes à tranche colorée, un dock noir flottant au disque violet.
colors:
  nuit: "#231b63"
  relvo: "#4a3fb5"
  relvo-clair: "#6d5df5"
  relvo-pale: "#f2f0ff"
  relvo-filet: "#e3dffb"
  ciel-bas: "#8174f6"
  actor-me: "#2b6fe0"
  actor-ext: "#8a5410"
  actor-ext-fond: "#f6ead8"
  urgent: "#e03131"
  fait: "#1f9d55"
  attente: "#f5b400"
  attente-texte: "#9a6f00"
  noir: "#111111"
  gris: "#6b7280"
  gris-clair: "#b8bcc8"
  filet: "rgb(17 17 17 / 0.07)"
  fond-enfonce: "#f7f7fa"
  fond-puce: "#f1f2f6"
  blanc: "#ffffff"
  domaine-blue: "#2b6fe0"
  domaine-blue-texte: "#1d5bd0"
  domaine-teal: "#0f9f8f"
  domaine-teal-texte: "#0b6f64"
  domaine-green: "#1f9d55"
  domaine-green-texte: "#15733d"
  domaine-lime: "#7cb518"
  domaine-lime-texte: "#4f7a05"
  domaine-amber: "#f5b400"
  domaine-amber-texte: "#8a6200"
  domaine-orange: "#ff6a13"
  domaine-orange-texte: "#c24d00"
  domaine-red: "#e03131"
  domaine-red-texte: "#b02020"
  domaine-purple: "#b0268f"
  domaine-purple-texte: "#8a1c70"
  domaine-pink: "#e0457b"
  domaine-pink-texte: "#a8305a"
  domaine-neutre: "#9ca3af"
  domaine-neutre-texte: "#6b7280"
typography:
  display:
    fontFamily: "Barlow Semi Condensed, Barlow, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "34px"
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Barlow Semi Condensed, Barlow, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "-0.02em"
    fontVariation: "tabular-nums"
  title:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: "18px"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 300
    lineHeight: "20px"
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: "14px"
    letterSpacing: "0.1em"
  domaine:
    fontFamily: "Barlow Semi Condensed, Barlow, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "14px"
    letterSpacing: "0.12em"
rounded:
  petit: "6px"
  bouton-ciel: "8px"
  option: "12px"
  sous-carte: "14px"
  carte: "18px"
  feuille: "20px"
  dock: "32px"
  pilule: "999px"
spacing:
  gouttiere: "16px"
  carte: "14px"
  ligne: "12px"
  entre-cartes: "12px"
  dock-marge: "14px"
motion:
  dur-presse: "120ms"
  dur-court: "160ms"
  dur-moyen: "240ms"
  dur-accompagnement: "480ms"
  courbe-sortie: "cubic-bezier(0.23, 1, 0.32, 1)"
  courbe-deplacement: "cubic-bezier(0.77, 0, 0.175, 1)"
  courbe-feuille: "cubic-bezier(0.32, 0.72, 0, 1)"
components:
  button-primary:
    backgroundColor: "{colors.relvo}"
    textColor: "{colors.blanc}"
    typography: "{typography.label}"
    rounded: "{rounded.pilule}"
    height: "36px"
    padding: "0 14px"
  button-ciel:
    backgroundColor: "rgb(255 255 255 / 0.14)"
    textColor: "{colors.blanc}"
    rounded: "{rounded.bouton-ciel}"
    size: "30px"
  button-relvo-disque:
    backgroundColor: "{colors.relvo-clair}"
    textColor: "{colors.blanc}"
    rounded: "{rounded.pilule}"
    size: "62px"
  card:
    backgroundColor: "{colors.blanc}"
    textColor: "{colors.noir}"
    rounded: "{rounded.carte}"
    padding: "12px 14px"
  card-relvo:
    backgroundColor: "{colors.relvo-pale}"
    textColor: "{colors.noir}"
    rounded: "{rounded.carte}"
    padding: "12px 14px"
  sous-carte:
    backgroundColor: "{colors.blanc}"
    textColor: "{colors.noir}"
    rounded: "{rounded.sous-carte}"
    padding: "10px 12px"
  list-row:
    backgroundColor: "{colors.blanc}"
    textColor: "{colors.noir}"
    typography: "{typography.title}"
    height: "58px"
    padding: "0 14px"
  list-row-done:
    backgroundColor: "{colors.fond-enfonce}"
    textColor: "{colors.gris}"
    height: "58px"
    padding: "0 14px"
  chip:
    backgroundColor: "{colors.blanc}"
    textColor: "{colors.noir}"
    rounded: "{rounded.pilule}"
    height: "36px"
    padding: "0 14px"
  chip-active:
    backgroundColor: "{colors.noir}"
    textColor: "{colors.blanc}"
    rounded: "{rounded.pilule}"
    height: "36px"
    padding: "0 14px"
  indicator:
    backgroundColor: "transparent"
    textColor: "{colors.noir}"
    typography: "{typography.headline}"
    rounded: "{rounded.pilule}"
    size: "50px"
  indicator-active:
    backgroundColor: "transparent"
    textColor: "{colors.relvo}"
    typography: "{typography.headline}"
    rounded: "{rounded.pilule}"
    size: "50px"
  input:
    backgroundColor: "{colors.fond-puce}"
    textColor: "{colors.noir}"
    typography: "{typography.body}"
    rounded: "{rounded.pilule}"
    height: "44px"
    padding: "4px 12px 4px 16px"
  dock:
    backgroundColor: "{colors.noir}"
    textColor: "{colors.blanc}"
    rounded: "{rounded.dock}"
    height: "54px"
  badge-non-lus:
    backgroundColor: "{colors.relvo}"
    textColor: "{colors.blanc}"
    rounded: "{rounded.pilule}"
    height: "22px"
    padding: "0 6px"
---

# Design System: Relvo

> Fichier d'outillage pour impeccable, **écrit depuis le code livré**. La vérité de la matière vit
> dans [`conception/design-system/`](conception/design-system/) — le brief
> (`00-brief-da.md`), le sens des tokens (`01-tokens.md`), les règles de composition
> (`02-composants.md`), la disposition (`03-patterns.md`) — et les **valeurs** dans
> [`apps/web/src/app/globals.css`](apps/web/src/app/globals.css), tenues par
> `apps/web/test/design-tokens.test.ts`. Le frontmatter ci-dessus recopie ces valeurs pour les
> outils ; le texte pointe et nomme les exceptions assumées. En cas de contradiction, le code et
> `conception/` ont raison, et ce fichier se régénère.

## Overview

**Creative North Star: « Lettrage d'artisan »**

Le monde du camion lettré et de la vitrine de l'artisan : l'entreprise se reconnaît à sa bande
de couleur et à ses gros chiffres. Relvo s'adresse à des dirigeants food et bâtiment qui
ouvrent l'application debout, à une main, en pleine lumière, puis la retrouvent posés au bureau.
L'écran se lit donc par ses zones, pas par son texte : un ciel violet en haut qui fond vers le
blanc, des cartes blanches nettes, un dock noir qui flotte, et au centre un disque violet qui est
la seule chose colorée de la barre. Calme, premium, rassurant, humain.

Le produit est **plat** : la hiérarchie vient de la couleur et de la matière, jamais d'un relief,
d'un verre ou d'un grain. Quatre matières se partagent l'écran, chacune avec sa responsabilité :
le **ciel** (identité, titre de page), le **bloc de Relvo** (tout ce que l'agent dit), la
**carte blanche** (ce qui se lit ou se manipule), le **texte nu** sur blanc (titres de zone). Ce
que la direction refuse est écrit dans `00-brief-da.md` §5 : relief nacré, verre, grain, fond
pierre, ruban décoratif, aplat d'informations.

**Key Characteristics:**
- Un ciel étoilé en dégradé de violet nuit vers le blanc, en CSS, jamais une image
- Une bande de domaine pleine sur la tranche gauche de chaque carte et ligne de sujet
- Gros chiffres condensés (Barlow Semi Condensed 600) sur un texte fin (Barlow 300)
- L'état se lit à la forme : pastille pleine, pastille cerclée, horaire barré
- La sélection est un cerclage, jamais un remplissage
- Un bloc violet pâle signé des étoiles, c'est Relvo qui parle
- Une liste est une suite de lignes dans **une** carte

## Colors

La couleur a toujours un rôle : la livrée dit « vous êtes dans Relvo », les acteurs disent qui
parle, les domaines disent de quoi il s'agit, les états disent ce qui presse. Tout le reste est
blanc, noir ou gris. Le sens de chaque famille vit dans `01-tokens.md`.

### Primary — la livrée, trois violets
- **Nuit** (`nuit`) : le haut du ciel. Jamais ailleurs que dans un dégradé.
- **Violet de Relvo** (`relvo`) : texte signé, liens de Relvo, cercle d'un indicateur actif, action
  principale, `--primary` du registre.
- **Violet clair** (`relvo-clair`) : le bas du ciel, le haut d'un dégradé de bouton.
- **Violet pâle et filet** (`relvo-pale`, `relvo-filet`) : le fond et le bord du **bloc de Relvo**.

Les dégradés de violet (`--degrade-relvo`, `--degrade-disque`, `--ciel`, `--ciel-haut` dans
`globals.css`) vont du clair au sombre dans le sens de la lumière et ne servent qu'à ce qui est
de Relvo ou de la livrée : ciel, disque du dock, bouton principal, jauge, interrupteur activé.

### Secondary — les acteurs
- **Moi** (`actor-me`) : la bulle bleue, à droite.
- **Externe** (`actor-ext` sur `actor-ext-fond`) : un tiers, nom foncé sur ambre pâle, à gauche.
- Relvo n'a pas de bulle : il a un bloc (`relvo-pale`).

### Tertiary — les domaines et les états
- **Domaines** : une **bande** vive (`domaine-<clé>`) pour la tranche, un **texte** foncé
  (`domaine-<clé>-texte`, ≥ 4.5:1 sur blanc) pour le nom en capitales. Les clés sont celles
  stockées sur le dossier (`lib/folders.ts`) ; la clé « purple » rend une prune : aucun domaine
  n'est violet.
- **États** : `urgent` (rouge, ce qui presse et ce qui est en retard), `fait` (vert), `attente`
  (ambre, pastille cerclée ; `attente-texte` pour le mot).

### Neutral
- **Noir** (`noir`) : le texte courant et le dock. Rien d'autre de grand n'est noir.
- **Gris** (`gris`) : texte secondaire. **Gris clair** (`gris-clair`) : chevrons, filets d'icône,
  indicateur à zéro — jamais du texte courant.
- **Filet** (`filet`) : entre deux lignes, autour d'une carte.
- **Fond enfoncé** (`fond-enfonce`) : une ligne lue ou faite. **Fond puce** (`fond-puce`) : puce
  neutre, champ de saisie.
- **Blanc** (`blanc`) : le fond de l'écran de travail et des cartes.

### Named Rules
**La règle de la livrée.** Le violet habille le chrome **et** marque la voix de Relvo ; comme le
chrome est violet, ce qui dit « c'est Relvo qui parle » est le **bloc violet pâle signé des
étoiles**, jamais la teinte seule. Un bouton de l'utilisateur n'est jamais sur `relvo-pale`.

**La règle de la rareté.** Une pastille urgente sur une ou deux sujets sur vingt-quatre vaut plus
que vingt badges colorés. `urgent`, `fait`, `attente` ne sont jamais empruntés pour de la mise en
forme.

**La règle de la bande.** Une bande de domaine par carte ou par ligne, sur la tranche gauche,
à l'intérieur de la surface. Deux bandes sur un objet, ou une bande sur une tâche qui a déjà
son sujet écrite, font un camion de foire. On ne prend jamais la couleur de bande pour du texte.

## Typography

**Display Font:** Barlow Semi Condensed 600 (avec Barlow, puis system-ui)
**Body Font:** Barlow 300 / 400 / 500 (avec system-ui)
**Label/Mono Font:** aucune — les références et les chiffres tabulaires passent par le condensé

**Character :** une seule famille, dérivée du lettrage routier, en deux dessins. Les chiffres et
les titres sont condensés et gras comme un numéro de téléphone sur un camion ; le texte est fin
et large, lisible en plein soleil. Chargée par `next/font` (`apps/web/src/app/fonts.ts`).

### Hierarchy
- **Display** (600, 28px, 34px) : le titre de page dans le ciel ; 26px quand il descend sous la
  flèche d'un écran poussé.
- **Headline** (600, 28px, 32px, chiffres tabulaires, `-0.02em`) : le chiffre d'un
  indicateur — les cellules d'Sujets, du Calendrier, de Conversations, de Contacts et
  l'activité de l'accueil, au même corps ; 19px pour un horaire, 16px pour un compte à droite
  d'une ligne. Jamais plus gros que le titre de page. Utilitaire `.chiffre`.
- **Title** (400, 14.5px, 18px) : le titre d'une ligne de sujet ou de tâche ; 18px condensé,
  deux lignes au plus, pour le titre d'une carte d'attente.
- **Body** (300, 14px, 20px) : la phrase de Relvo, le texte courant, un lien de suggestion
  (500), une phrase d'échéance ; 12px/15px en graisse **400** pour la ligne d'état sous un
  titre et le qualificatif d'une zone — sous 14px, jamais la graisse fine.
- **Label** (500, 11px, `0.1em`, capitales, gris) : le libellé dans une carte. Utilitaire
  `.libelle`.
- **Domaine** (600 condensé, 11px, `0.12em`, capitales, couleur texte du domaine) : le nom du
  domaine. Utilitaire `.domaine`.

### Named Rules
**La règle des deux dessins.** Un titre et un chiffre se lisent de la même voix : `font-heading`
et `font-numeric` sont le même dessin condensé. Rien au-dessus de la graisse 600, rien sous
11px — sauf, dans le dock, le libellé d'un onglet et le badge du disque Relvo, à 10px, parce
que « Conversations » ne tient pas plus gros sur un téléphone étroit et que le badge ne porte
qu'un chiffre. **Sous 14px, jamais la graisse 300** : elle s'efface en plein soleil.

## Layout

Mobile d'abord, littéralement : colonne unique calibrée pour 390px, gouttière de 16px, le
desktop en hérite sans remonter l'échelle (`03-patterns.md`). Chaque écran est encadré par la
livrée : le **ciel** en haut, qui scrolle avec le contenu et fond vers le blanc, et le **dock**
en bas, fixe, décollé du bas et des bords de 14px.

Le ciel porte **une seule rangée** sous la zone sûre : flèche retour ou rien, titre, actions de
page, burger ; un titre long replie sur deux lignes à droite de la flèche, jamais sous elle. Le
ciel ne finit pas blanc : il finit sur le violet clair (`ciel-bas`), et sa **queue**
(`.ciel-queue`, 150px, sans hauteur dans le flux) fond vers le blanc **sous** ce qui suit, la
pente des planches de la direction. La **première carte
chevauche toujours le bas du ciel** (`-mt-7.5` sur `IndicatorTabs` et `SegTabs`) : c'est elle
qui lie les deux zones. Les cartes se suivent avec
12px entre elles ; une zone est nommée par un en-tête symétrique en texte nu (titre à gauche,
qualificatif à droite, `ZoneHeading`). Une ligne de sujet fait 58px ; une carte d'attente fait
300px de large et se feuillette horizontalement avec accroche.

Cible tactile minimale 44px. Le dock réserve `--tab-h` (54 + 14px) sous chaque page ; dans une
conversation et dans l'échange, le composer ancré (`--bar-h`, 64px) prend sa place. Paliers
Tailwind par défaut (`sm` 640, `md` 768, `lg` 1024) ; le repli desktop des surfaces refondues
n'est pas dessiné, c'est un manque assumé.

## Elevation & Depth

Le produit est plat ; c'est la couleur qui fait la hiérarchie. Une seule ombre pour toutes les
cartes, et des ombres propres aux objets qui flottent. Une ombre portée a un **décalage et un
flou** : jamais un halo sans décalage, jamais une ombre dure. Ni verre, ni grain, ni relief ;
les utilitaires `.grain` et `.glass-relvo` de l'ancienne matière sont inertes.

### Shadow Vocabulary
- **Carte** (`box-shadow: 0 6px 16px rgb(17 17 17 / 0.08)`) : toute carte blanche et le bloc de
  Relvo. Une seule et même ombre pour toutes les zones.
- **Feuille** (`0 12px 32px rgb(17 17 17 / 0.14)`) : le menu latéral et les feuilles.
- **Dock** (`0 10px 24px rgb(17 17 17 / 0.28)`) : en `drop-shadow` sur la silhouette du dock,
  pour qu'elle suive la courbe autour du disque.
- **Disque** (`0 6px 14px rgb(17 17 17 / 0.35)`) : le disque de dictée du composer et l'orbe de
  l'échange vide.
- **Haut** (`0 -1px 0 filet, 0 -8px 24px rgb(17 17 17 / 0.06)`) : une barre ancrée en bas
  projette vers le haut (le composer).
- **Pressé** (`0 2px 6px rgb(17 17 17 / 0.08)`) : l'état enfoncé de `.pressable`.

### Named Rules
**La règle de la matière égale.** Deux cartes blanches de même ombre font deux zones d'égale
importance ; c'est la couleur qui hiérarchise, jamais une ombre plus forte. Une carte ne contient
jamais une autre carte avec sa propre ombre : un sujet cité dans un bloc de Relvo est une
sous-carte à filet, sans ombre.

**La règle du relief unique.** Le seul objet qui se détache du chrome est le disque Relvo, par
sa couleur et son débordement du dock — pas par un relief. Si une tuile se met à briller ou si
un second objet du dock se colore, on perd « ce qui se détache, c'est Relvo ».

## Motion

Le mouvement est court et il sort vite : il **se sent, il ne se voit pas**. Quatre durées —
`presse` 120ms (le retour d'un appui), `court` 160ms (une couleur, un badge ; la durée par défaut
de toute transition), `moyen` 240ms (une feuille, un menu, un écran poussé, une liste qui
arrive), `accompagnement` 480ms (la seule qu'on a le droit de voir : premiers pas, carte
vivante). Trois courbes — `sortie` `cubic-bezier(0.23, 1, 0.32, 1)` pour tout ce qui entre ou
sort, `deplacement` `cubic-bezier(0.77, 0, 0.175, 1)` pour ce qui se déplace à l'écran,
`feuille` `cubic-bezier(0.32, 0.72, 0, 1)` pour une feuille qui monte. Opacité et `transform`
seulement.

Cinq primitives : `.apparait` (ce que le serveur livre après coup monte de 6px ;
`.apparait-liste` échelonne de 35ms), `.entre-ecran` (un écran poussé entre de la droite, 16px),
les feuilles et menus du registre sur `moyen`/`feuille`, `.pressable` et `active:scale-[0.97]`
en transition sur `presse`, `.arrive` (un chiffre qui change) et `.respire` (Relvo travaille, la
seule boucle). `prefers-reduced-motion` ramène tout à un fondu.

Ce qui ne s'anime pas : le changement d'onglet du dock et d'un segmented, le cerclage d'un
indicateur, une liste refiltrée, les étoiles et le ciel, la saisie, un survol.

## Shapes

Les rayons sont **comptés** : 6px pour un petit contrôle, 8px pour un bouton d'icône sur le
ciel, 12px pour une option de formulaire, 14px pour une sous-carte, 18px pour une carte, 20px
pour une feuille, 32px pour le dock, et la pilule pour une puce, un bouton et un badge. Au-delà,
l'objet redevient un jouet ; seul ce qui est rond par nature est rond (pastilles, avatars, disque
Relvo, case à cocher). Le ciel n'a pas de bord : il fond.

La silhouette signature est celle du **dock** : une pilule noire qui se **soulève autour du
disque** central en courbe douce, comme un tissu tendu, de 10px en haut et en bas
(`--dock-etire`, `DockFabric` dans `bottom-tab-bar.tsx`). La **bande de domaine** est un
rectangle plein de 10px sur toute la hauteur d'une carte (`.bande-carte`), ou de 6px × 36px
arrondi à 3px dans une ligne (`.bande-ligne`), rogné par la surface qui la porte.

## Components

L'inventaire vit dans `apps/web/src/components/` ; les règles de composition dans
`02-composants.md`. Les primitives viennent du registre shadcn sur **Base UI** (`ui/`), adaptées
aux tokens ; un composant métier naît le jour où un deuxième écran recopie le premier.

### Buttons
- **Shape :** pilule (`rounded-4xl` sur la primitive, soit 20px pour 36px de haut ; `rayon-pilule`
  sur les composants signature).
- **Primary :** violet de Relvo en aplat sur la primitive, dégradé de violet (`--degrade-relvo`)
  sur un bouton signature (« Répondre » du bloc des nouvelles, 30px de haut, 14px de marge) ;
  texte blanc, graisse 500.
- **Pressed :** `.pressable` — 1px de translation et l'ombre qui se raccourcit. Pas de survol
  qui compte : le produit est tactile.
- **Bouton de ciel :** 30px, blanc translucide à 14 %, rayon 8px, icône blanche — le burger, la
  flèche retour, les actions de page.
- **Disque Relvo :** 62px, dégradé radial de violet (`--degrade-disque`), étoiles blanches, badge
  rouge cerclé de noir repoussé hors du bord quand une question attend.
- **Secondary / Ghost :** puce `fond-puce` ou blanc à filet ; un bouton de l'utilisateur n'est
  jamais sur `relvo-pale`. **Destructive :** rouge en texte sur rouge à 10 %, rarement — rien de
  courant ne détruit.

### Chips
- **Style :** pilule blanche à filet, texte noir, une pastille de couleur de domaine devant le
  nom (filtres par domaine d'Sujets, chips de canal).
- **State :** la puce active est **noire sur blanc**, jamais violette : le violet est la livrée,
  pas un état.

### Cards / Containers
- **Corner Style :** 18px (`rayon-carte`) ; 14px pour une sous-carte.
- **Background :** blanc ; `relvo-pale` bordé de `relvo-filet` pour le bloc de Relvo, signé par
  le logo et un libellé en capitales violettes.
- **Shadow Strategy :** l'ombre carte, une seule ; sous-carte sans ombre.
- **Border :** le filet (`filet`), à peine visible.
- **Internal Padding :** 14px horizontal, 12px vertical.
- **Carte d'attente :** 300px, bande de domaine sur la tranche, nom du domaine et état à la forme
  (pastille pleine « Urgent », cerclée « Réponse »), titre condensé 18px, contact · entreprise,
  échéance, geste en puce et « depuis N j » — la seule exception à « une liste, une carte ».

### Lists
- **ListPanel :** la carte unique qui porte une liste, lignes séparées par le filet, la
  dernière sans filet (`data-list-row`), `overflow: hidden` pour rogner les fonds de swipe et
  les bandes.
- **SubjectRow** (le composant le plus important du produit) : bande de domaine 6px, nom du
  domaine en capitales condensées, titre 14.5px précédé de « Urgent · » rouge quand la priorité
  l'est, ligne d'état fine en gris, et à droite un chiffre condensé (non-lus en pastille
  violette, ou « fait/total ») avec ce qu'on attend dessous (« à vous », « attend », « ✦ à
  valider » en violet). 58px de haut ; une ligne faite s'enfonce (`fond-enfonce`, titre barré).
- **TaskItem :** case ronde à cocher à gauche (22px, cerclée gris clair, pleine violette quand
  c'est fait), titre, sujet · interlocuteur en fin, et à droite l'horaire condensé 19px ; en
  retard, un point rouge devant le titre et l'horaire **barré** en rouge. Pas de bande : la tâche
  n'a pas deux fois la couleur de son sujet.

### Inputs / Fields
- **Style :** pilule sur `fond-puce` (le composer : 44px minimum, texte 14.5px fin, rayon 22px,
  disque de dictée violet à droite) ; la primitive du registre est un champ 44px à filet, texte
  16px pour ne pas déclencher le zoom d'iOS.
- **Focus :** bord et anneau violets (`--ring` = `relvo`), 3px à 50 %.
- **Error / Disabled :** bord rouge et anneau rouge à 20 % ; désactivé à 50 % d'opacité.

### Navigation
- **Dock :** pilule noire de 54px, 14px du bas et des bords, cinq places, icônes pleines blanches
  (`dock-icons.tsx`), libellé 10px ; l'onglet actif se lit au **blanc plein et à la graisse**
  (inactif à 60 %), jamais à un cerclage. Le disque Relvo au centre, la pilule soulevée autour.
  Le dock cède la place au composer dans une conversation et dans l'échange.
- **Indicateurs** (`IndicatorTabs`) : une carte blanche de cellules fixes qui chevauche le ciel ;
  chaque cellule porte un chiffre condensé 28px dans un disque de 50px et son libellé 12px.
  L'actif est **cerclé** (`.cercle-actif` : trait violet 2px à 4px de distance, chiffre et libellé
  violets) ; un zéro s'écrit « 0 » en gris clair ; un retard est rouge, actif ou non.
- **Onglets d'une fiche** (`SegTabs`) : même carte, l'icône et son mot à 11px dessous, l'actif
  **souligné** d'un trait violet ; un
  compteur à zéro ne s'affiche pas.
- **Menu latéral :** feuille blanche depuis la gauche, lignes de 52px en texte 17px, séparées par
  le filet, Rechercher en dernier, déconnexion en pied. Icônes pleines en violet de Relvo.
- **Icônes :** tout pictogramme est **plein** (Phosphor en graisse « fill », via
  `shared/picto.tsx`, qui pose la graisse une fois) ; lucide ne fournit que les glyphes qui *sont*
  un trait (chevron, croix, plus, coche, flèches, loader). Le remplissage ne dit jamais un état.

### Le ciel (signature)
`.ciel` sur le header : `--ciel` (nuit en haut, violet de Relvo dès 40 % et tenu jusqu'à 44px
du bas, violet clair à 18px du bas, blanc au bord — le fondu est ancré au bas du header pour
qu'un texte blanc reste sur le violet de Relvo et que la première carte chevauche le fondu quelle
que soit la hauteur), un champ d'une quinzaine d'étoiles en dégradés radiaux masqué vers le bas, et trois
étoiles à quatre branches — celles du signe — qui évitent le coin haut droit où vivent les
boutons. Sur la connexion, `--ciel-haut` prend près de la moitié de l'écran. Les étoiles ne
scintillent pas.

### Le bloc de Relvo (signature)
Une carte sur `relvo-pale` bordée de `relvo-filet`, le logo en violet clair et « RELVO · à
l'instant » en libellé violet, la phrase en 14px fin, et sous elle **ses preuves** : un lien
fléché violet par suggestion, une question avec son bouton « Répondre » en dégradé. Un sujet
citée est une sous-carte à filet. C'est le même composant dans l'échange et sur l'accueil.

## Do's and Don'ts

Les règles ci-dessous sont celles du code livré et des décisions du dirigeant
(`backlog/ecarts-et-propositions.md`, « Une direction artistique : “Lettrage d'artisan” »). Les
quatre premières sont des **exceptions assumées aux détecteurs d'impeccable** : ce qu'ils lisent
comme un tic d'interface générée est ici une décision de direction.

### Do:
- **Do** laisser le ciel haut de la connexion fondre vers le blanc comme tout ciel, et y poser
  le mot-marque « Relvo » à 40px : le seul corps au-dessus du titre de page, assumé là et
  nulle part ailleurs.
- **Do** poser au-dessus du titre de page, dans le ciel, sa **ligne du dessus** en petites
  capitales (`eyebrow` de `RelvoHeader`) : la date sur l'accueil, le domaine sur une fiche. Le
  détecteur « kicker-above-heading » la lit comme un surtitre décoratif ; c'est le seul endroit
  de l'écran qui porte cette donnée, tranché par le dirigeant (`03-patterns.md`, « Le cadre »).
- **Do** poser la **bande de domaine** sur la tranche gauche de chaque carte et ligne de sujet
  (`.bande-carte` 10px, `.bande-ligne` 6px), comme un fond plein à l'intérieur de la surface. Ce
  n'est pas un `border-left` décoratif (détecteur « side-tab ») : c'est le geste signature du
  monde, une bande par surface, la couleur du domaine stockée sur le dossier.
- **Do** utiliser le **violet et ses dégradés** sur le ciel, le disque Relvo, l'action principale,
  les jauges et les interrupteurs : le violet est **sémantique** (livrée et voix de Relvo), pas un
  dégradé violet-bleu d'ornement. Un détecteur qui le signale a tort ici, et seulement ici.
- **Do** laisser le **disque Relvo déborder** du dock, la pilule soulevée autour de lui : c'est le
  relief unique du produit, désigné par la couleur et le débordement, sans ombre propre.
- **Do** rendre une entité de liste en **ligne dans une carte unique** (`ListPanel`), séparée par
  le filet.
- **Do** dire l'état **à la forme** d'abord : pastille pleine (urgent), cerclée (en attente),
  horaire barré (en retard), coche sur disque et titre barré (fait).
- **Do** cercler l'indicateur actif et souligner l'onglet actif d'une fiche ; rendre la puce
  active noire.
- **Do** rendre un formulaire en **champs et boutons de 44px** (`Input` et `Button` du registre,
  adaptés), et un interrupteur de 48px activé en dégradé de Relvo.
- **Do** écrire « 0 » en gris clair dans une cellule d'indicateur, et **ne rien afficher** pour un
  badge ou un compteur à zéro.
- **Do** faire pointer chaque phrase de Relvo vers sa preuve (lien ou sous-carte).
- **Do** prendre toute valeur dans `globals.css` : le test des tokens refuse une couleur
  hexadécimale dans un composant, hors les exceptions qu'il nomme (logo, bouton Google,
  manifeste, e-mail sortant, page publique de suivi).
- **Do** interroger le registre shadcn avant d'écrire une primitive, et composer sur Base UI
  (`render`, jamais `asChild`).
- **Do** prendre tout pictogramme dans `shared/picto.tsx` (plein) et ne demander à lucide qu'un
  glyphe ; le test des tokens refuse un pictogramme lucide.

### Don't:
- **Don't** réintroduire la matière écartée : verre, grain, fond pierre, relief nacré, ruban
  oblique, trois niveaux d'élévation. `.grain` et `.glass-relvo` sont inertes et ne se posent plus.
- **Don't** cercler l'onglet actif du dock, ni colorer un second objet du dock.
- **Don't** mettre un bouton ou une bulle de l'utilisateur sur `relvo-pale` : ce bloc est la voix
  de Relvo.
- **Don't** emprunter `urgent`, `fait` ou `attente` pour de la mise en forme, ni la couleur de
  bande d'un domaine pour du texte.
- **Don't** poser deux bandes sur un objet, ni une bande sur une tâche.
- **Don't** empiler une carte par ligne, ni une carte dans une carte avec deux ombres.
- **Don't** rendre une ombre sans décalage (halo), ni une ombre dure, ni une ombre plus forte pour
  hiérarchiser.
- **Don't** dépasser les rayons comptés (20px hors pilule et dock), ni la graisse 600, ni
  descendre sous 11px hors du dock (libellé d'onglet, badge du disque).
- **Don't** arrêter le ciel net : il fond, et la première carte le chevauche.
- **Don't** faire scintiller les étoiles ni allonger une transition : le mouvement est court et
  sort vite. Aucune durée ni courbe littérale dans un composant (`--dur-*`, `--courbe-*`), jamais
  `transition-all`, jamais une courbe qui démarre lentement, rien au-delà de 300ms hors
  accompagnement, pas d'animation sur un onglet du dock ni sur un survol.
- **Don't** rendre une suggestion ou une puce en pointillé : le pointillé est réservé à « vide / à
  compléter » (une puce Urgent inactive, un domaine sans logo, un canal à connecter).
- **Don't** afficher un thème sombre : l'application est claire seulement ; le bloc `.dark`
  n'existe que pour les primitives du registre qui le citent.
