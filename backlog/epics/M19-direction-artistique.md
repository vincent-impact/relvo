---
id: M19
public: true
ordre_public: 12
titre_client: Nouvelle apparence et premiers pas guidés
resume_client: >
  Une interface plus légère et plus lisible, choisie parmi plusieurs directions visuelles
  comparées sur de vrais écrans. Et des premiers pas accompagnés : Relvo vous guide à travers
  l'application au lieu de vous laisser devant des écrans vides.
statut: en-cours
debut: 2026-10-12
fin: 2026-10-31
---

# M19 — Direction artistique, allègement et prise en main

**Objectif** — donner à Relvo l'apparence d'un **bijou qu'on prend en main** : une direction
artistique choisie parmi **quatre** comparées sur de vrais écrans, des écrans **allégés** jusqu'à
ne porter que ce qui sert, et un **langage de mouvement** qui accompagne les premiers pas. La
disposition générale ne bouge pas : ce chantier habille et allège, il ne redessine pas les flux.

**Dépendances** : M18 (la disposition sur laquelle on habille ; une seule épique publique peut
être « en cours » à la fois, cf. `suivi-client.md`). **Débloque** M10 (la surface de l'échange
se construit dans la direction retenue) et M13.2 (la prise en main consomme le langage de
mouvement et les composants de premiers pas livrés ici).

> **Pourquoi maintenant, avant M10 et avant la tranche 10 de M7.** Même raisonnement que M18 :
> l'échange est la surface la plus importante du produit, et la prise en main s'y joue. La
> construire dans une direction artistique qu'on sait vouloir changer, c'est la réécrire. M9 a
> livré sept écrans dont trois ont été repris en profondeur ; on habille **avant** de construire
> la surface qui compte.

## Ce que l'épique ne touche pas

- **La disposition générale** — dock à cinq places, Relvo au centre, menu latéral, accueil en
  brief, Calendrier page des tâches — est **tranchée** (`ecarts`, « La disposition générale »,
  invariants 34–38). Une direction peut la contester, mais alors **explicitement**, par une
  entrée du registre des écarts, jamais par une planche qui la contourne.
- **Les rôles sémantiques de couleur** — Moi / Relvo / Externe, le violet voix de l'agent, le
  relief réservé au bouton Relvo, la rareté de l'urgent — sont des **décisions**, pas des
  réglages. Les quatre directions les mappent ; une direction qui les abandonne le dit et le
  justifie.
- **Le domaine et le modèle** : aucune migration, aucune nouvelle entité. Un composant habillé
  rend la même donnée qu'avant.
- **La maquette** reste figée et n'est pas rebuildée. Après ce chantier, elle ne fait plus foi
  sur le rendu — seulement sur les flux et les libellés — et `00-sources.md` le dit (M19.12).

## Les trois outils et ce qu'on leur demande

| Outil | Rôle dans l'épique | Ce qu'il est vraiment | Friction connue |
|---|---|---|---|
| **ui-ux-pro-max** | **Écarté pour M19.3** après deux séries de planches : un dictionnaire ne produit pas de direction. Reste un contrepoint ponctuel (palettes, règles UX) | Un moteur de recherche (BM25) sur des catalogues de styles, palettes, couples typographiques et règles UX. Il rend **un** système de design par requête : quatre directions = quatre requêtes dirigées, pas un bouton « 4 variantes » | Il écrit `design-system/<slug>/MASTER.md` à la racine du projet : ce dossier n'est **pas** un domicile de conception, il est ignoré par git. Il a besoin de Python 3 (présent). Ses recettes « landing page » ne concernent pas Relvo |
| **impeccable** (`/impeccable …`) | **A produit la direction** (M19.3) : sept mondes, tirage, challengers de catalogue illustrés, page de décision, contrat de direction. Puis **alléger** écran par écran : `critique` → `distill` → `polish` → `audit` (M19.6) ; `onboard` pour les premiers pas ; `typeset`, `layout`, `colorize` au besoin | 24 sous-commandes et 59 détecteurs déterministes contre les tics d'interface générée (cartes imbriquées, gris sur couleur, dégradés violet-bleu). Son credo rejoint le design system actuel : une ligne dans un panneau, pas une carte par ligne | Il attend `PRODUCT.md` et `DESIGN.md` à la racine : ce sont des **pointeurs courts** vers `conception/`, jamais un second domicile (M19.11). Son hook s'installe dans `.claude/settings.local.json`, non partagé. Ses détecteurs signaleront le violet : il est **sémantique**, et `DESIGN.md` le dit |
| **emilkowalski/skills** | Le **langage de mouvement** (M19.8) et les **premiers pas** (M19.9) : `emil-design-eng`, `animate`, `find-animation-opportunities`, `review-animations`, `animation-performance`, `break-ui`, `ask-sonner` (le produit utilise Sonner) | Les règles d'un ingénieur-designer : courbe, durée, propriétés composées, ce qui ne s'anime pas | ⚠️ `mobile-native` recouvre un terrain **déjà payé** : `--app-height`, la garde anti-rebond, la barre Android (`PITFALLS.md` #54). Il sert de **relecteur**, jamais de correcteur : il ne touche ni au viewport ni au `100vh` |

Les skills s'installent au **niveau utilisateur** (`~/.claude/skills`), pas dans le dépôt : le
dépôt ne porte que ce qui décrit le produit.

```bash
npx ui-ux-pro-max-cli init --ai claude --global
npx impeccable install            # choisir la portée globale
npx skills@latest add emilkowalski/skills
```

## Items

| #      | Item |
|--------|------|
| M19.1  | **Le brief de DA mis au présent** : `00-brief-da.md` décrit cinq places dans le dock, le bouton central, l'accueil en brief, et ne nomme plus de destinataire. C'est l'**entrée unique** des quatre directions : ce qui n'y est pas écrit sera réinventé |
| M19.2  | **Le point zéro** : captures des écrans actuels au format téléphone, en mode sombre émulé (`PITFALLS.md` #51), avec les données de démonstration ; relevé de ce que chaque écran porte (zones, contrôles, compteurs). C'est contre ce point zéro que l'allègement se mesure |
| M19.3  | **Quatre directions visuelles**, chacune avec un parti-pris nommé, une palette mappée sur les rôles sémantiques, un couple typographique, une matière (fond, surfaces, profondeur), un langage de mouvement et ce qu'elle refuse. Rendues en **planches** au format téléphone sur trois écrans héros — **Accueil**, **Sujets**, **Échange** — dans un artefact non buildé, comme les planches de M18. Au moins une direction est la DA actuelle **poussée au bout** (le témoin) ; au moins une **conteste** un choix verrouillé, en le disant |
| M19.4  | **Le choix** : décision dans `ecarts-et-propositions.md` (ce qui a été retenu, contre quoi) ; `00-brief-da.md` et `01-tokens.md` **récrits en place** dans la direction retenue. Les trois autres directions ne survivent que dans l'artefact — `conception/` ne porte aucun concept mort |
| M19.5  | **Les tokens** : `globals.css` porte la direction retenue — couleurs, typographie, rayons, élévations, durées et courbes. **Aucune valeur en dur dans un composant** : un test échoue sur une couleur hexadécimale ou une durée littérale hors de `globals.css` (l'inventaire est tenu par un test, pas par la vigilance) |
| M19.6  | **L'allègement, écran par écran** : Accueil, Sujets, Conversations (liste et détail), fiche Sujet, Calendrier, Échange, Mémoire, Contacts, les quatre pages du menu, le tunnel d'authentification. Pour chacun, dans cet ordre : `critique`, `distill`, `polish`, `audit` ; une capture avant/après ; un commit par écran, avec son pied `Client:`. Un élément retiré est un élément dont on sait dire **pourquoi il ne manque pas** |
| M19.7  | **Les composants signature habillés**, par le registre d'abord : ligne de sujet, tâche, tuile KPI, pastille d'acteur, badges et marqueurs, bouton Relvo du dock, header et panneau des nouvelles, panneau de liste, feuille du menu, composer. **Un composant rendu par Relvo reste celui de l'écran** |
| M19.8  | **Le langage de mouvement** : tokens de durée et de courbe, primitives (apparition d'une liste, ouverture d'une feuille, transition entre écrans, état pressé, arrivée d'une nouvelle), et la liste de **ce qui ne s'anime pas**. Relu par `review-animations`, mesuré par `animation-performance` sur un téléphone d'entrée de gamme. Le mouvement courant reste court et sort vite ; seul l'accompagnement a le droit d'être vu |
| M19.9  | **Les premiers pas, sur les surfaces qui existent** : de l'authentification au premier accueil vide, la connexion d'un canal, l'ouverture du premier sujet, la présentation du bouton Relvo, des états vides qui **guident** au lieu de constater. Les composants que M13.2 consommera — la carte vivante d'avancement, l'étape-formulaire — reçoivent ici leur rendu et leur mouvement ; leur logique reste dans M10.16 |
| M19.10 | **La robustesse** : `break-ui` sur de longs noms, des listes vides, des compteurs à trois chiffres, des volumes réels et non ceux de la maquette ; vérification sur l'iPhone du dirigeant en mode sombre et en pleine lumière, sur Android (#54) ; le repli desktop ne régresse pas |
| M19.11 | **L'outillage** : skills installés au niveau utilisateur ; `PRODUCT.md` à la racine, un résumé qui **pointe** vers `conception/01-principes.md` ; `DESIGN.md` à la racine, **écrit depuis le code livré** (le frontmatter recopie `globals.css` pour les outils, le texte pointe vers `conception/design-system/` et nomme les exceptions assumées aux détecteurs d'impeccable : la bande de domaine, le violet sémantique, le débordement du disque Relvo) et son sidecar `apps/web/.impeccable/design.json` ; le contrat de direction du brief de surface tenu au présent ; `/design-system/` (sortie de ui-ux-pro-max, à la racine) ignoré par git ; la revue de finition d'impeccable rendue sur les écrans capturés |
| M19.12 | **La clôture** : `02-composants.md` et `03-patterns.md` relus contre le code ; `00-sources.md` dit que la maquette ne fait plus foi sur le rendu ; les pièges rencontrés remontent à `PITFALLS.md` dans la même session |

## Découpage proposé, en tranches verticales

1. **« Voir »** — M19.1, M19.2, M19.3, M19.4. **Aucun code produit.** La tranche se termine par
   une décision écrite, pas par une planche de plus.
2. **« Habiller »** — M19.11, M19.5, M19.7. Toute l'application change d'apparence d'un coup,
   et rien ne change de place. C'est la tranche qui se vérifie sur l'iPhone.
3. **« Alléger »** — M19.6, M19.10. Écran par écran, un commit par écran.
4. **« Guider »** — M19.8, M19.9. Le mouvement arrive en dernier : on n'anime pas ce qu'on va
   encore retirer.
5. **« Clore »** — M19.12.

## Tranché à l'ouverture

- **M18 est fermée en `partiel`** : sa tranche 5 (M18.9, M18.11) se livre avec M10, qui en est
  le consommateur. Une seule épique publique est « en cours » à la fois, et le build de la page
  de suivi le vérifie.
- **La disposition ne rouvre pas** ; les trois outils interviennent chacun sur une tranche, dans
  l'ordre des tranches ; le mouvement arrive en dernier ; les fichiers des outils ne deviennent
  pas un domicile de conception.

## Reste à trancher en cours de sprint

- **La bibliothèque de mouvement.** CSS et View Transitions d'abord ; `motion` n'entre que si
  une tranche le réclame (la carte vivante, un geste), et alors pour tout le produit, jamais
  deux moteurs.
- **Le témoin.** Si la direction retenue est la DA actuelle poussée au bout, l'épique ne
  rétrécit pas : les tranches 3 et 4 sont indépendantes du choix.

⚠️ **« Entièrement » porte sur l'apparence, pas sur les flux.** Rouvrir la disposition un mois
après l'avoir tranchée sur planches, c'est reproduire ce qui a coûté trois réécritures à M9. Si
une planche donne envie de changer un flux, l'envie se note dans le registre des écarts et se
tranche à part.

⚠️ **Une direction se juge sur de vraies données.** Les planches portent les données de
démonstration ; la direction retenue se vérifie sur le compte du dirigeant, avec ses volumes,
avant la tranche 3.

⚠️ **Le relief ne s'étend pas, le violet ne se dilue pas.** Quelle que soit la direction : si
une tuile brille, on perd « ce qui brille, c'est Relvo » ; si un bouton de l'utilisateur est
violet, on perd la seule convention que le dirigeant a apprise sans qu'on la lui explique.
