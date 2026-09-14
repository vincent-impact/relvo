# Design system — 1. Tokens

> **Domicile des valeurs : [`apps/web/src/app/globals.css`](../../apps/web/src/app/globals.css).**
> Ce fichier ne recopie pas la liste des variables — il dit **ce que chaque famille signifie** et
> **ce qu'elle interdit**. Un token créé sans intention écrite ici est un token qui sera
> réinventé ailleurs.

## Le principe : la couleur est un signal, pas une décoration

Relvo s'adresse à des dirigeants qui ouvrent l'app entre deux services, en pleine lumière, à une
main. Une interface bariolée y devient illisible. **La couleur est donc réservée à l'information
qui doit sauter aux yeux** ; tout le reste vit en neutres chauds.

Corollaire tenu partout : une surface neutre par défaut, un accent par écran au plus, et **la
rareté comme signal** — un drapeau urgent sur un ou deux sujets sur vingt-quatre vaut plus que
vingt badges colorés.

## Le triptyque d'acteurs — le seul code couleur que l'utilisateur doit apprendre

Chaque chose affichée vient de quelqu'un, et ce quelqu'un a une couleur, la même partout :
bulles, pastilles de journal, badges de source d'une tâche, avatars.

| Acteur | UI | Couleur | Token |
|---|---|---|---|
| L'utilisateur | **Moi** | bleu | `--actor-me` → `--brand` |
| L'agent | **Relvo** | violet | `--actor-relvo` → `--relvo` |
| Un tiers | **Externe** | ambre | `--actor-ext` → `--amber-600` |

⚠️ **Le violet est la voix de l'agent, et rien d'autre.** Le header, la barre d'onglets et tout
bloc émanant de Relvo sont violets ; un élément violet qui ne vient pas de Relvo casse la seule
convention que l'utilisateur a apprise sans qu'on la lui explique.

Le header violet est aussi **structurel** : c'est lui qui donne à l'œil une zone de départ et
fait lire le reste comme « le contenu ». Un chrome neutre gagne en clarté locale et perd la carte
de la page — sur téléphone, à une main, la carte prime.

Le violet est un violet **encre** (profond, peu saturé) et le logo est **vectorisé** : il prend
la couleur du token (`RelvoLogo`, `currentColor`), et les icônes PWA se régénèrent depuis lui
(`pnpm icons`).

## Les domaines (Folder) — une couleur par domaine, héritée par tout ce qui en dépend

Un domaine porte une couleur ; le sujet qui lui appartient l'hérite, et la tâche qui appartient
au sujet l'hérite à son tour. C'est ce qui rend une liste à plat lisible sans lire les titres.

La couleur se manifeste par un **rail** — un filet vertical de quelques pixels **à l'intérieur**
de la ligne, jamais au bord de l'écran, où il devient invisible. Tokens : `--folder-*`.

## Les états

`--danger` (rouge) pour ce qui écarte ou détruit · `--success` (vert) pour ce qui est fait ·
`--warning` (ambre) pour ce qui attend. Ces trois-là ne servent qu'à ça : ils ne sont jamais
empruntés pour de la mise en forme.

## Le verre — réservé au chrome

La barre d'onglets et le composer Relvo sont des surfaces **translucides** (`.glass-relvo`,
`--glass-*`, `--blur-glass`, `--sat-glass`) : le contenu défile visiblement dessous. C'est ce qui
fait que l'écran paraît plus grand qu'il n'est, sur un appareil tenu à une main.

Le verre reste **réservé au chrome** (barres, feuilles) et ne touche jamais le contenu : un texte
sur verre est le premier à devenir illisible en plein soleil, et `backdrop-filter` coûte cher au
défilement sur un téléphone d'entrée de gamme. Sans `backdrop-filter`, `.glass-relvo` se replie
sur un aplat opaque.

⚠️ Une surface de verre **exige du contenu derrière elle** pour exister. Posée sur un fond plat,
elle ne se distingue pas d'un aplat — et le lecteur perd le repère de profondeur.

## La typographie

Deux familles, chargées via `next/font` :

| Rôle | Famille | Pourquoi |
|---|---|---|
| Titres, interface et texte courant | **Geist** (`--font-sans`, `--font-heading`) | Une seule famille : le caractère d'un titre vient de sa graisse (600) et de son interlettrage serré (−0.02em), pas du dessin des lettres. Une typo « à personnalité » en titres donne un ton ludique que le produit ne veut pas |
| Chiffres et références | **Geist Mono** (`--font-numeric`) | Chiffres tabulaires pour les KPI, et les références `SUB-xxxx` qui doivent s'aligner |

Les titres ne dépassent pas la graisse 600 : le sérieux vient de la retenue.

L'échelle de corps est **mobile d'abord** : elle est calibrée pour un écran d'environ 390 px, et
le desktop en hérite sans la remonter.

## La matière : fond pierre, surfaces posées, trois niveaux

Le fond de page n'est pas blanc mais **pierre** (`--stone`, légèrement teinté) : c'est ce qui
permet au blanc d'une surface de devenir une **élévation**. Sur un fond blanc pur, rien ne peut
être posé.

Une surface posée porte trois choses, toujours ensemble (`--elev-*`, utilitaires
`shadow-surface-1/2/3`) : un **filet de lumière** de 1px en haut (ce qui rend le bord
« touchable »), une **ombre de contact** courte et nette, une **ombre ambiante** large et floue.

| Niveau | Ce que c'est | Exemples |
|---|---|---|
| 0 | le fond pierre | l'écran |
| 1 | un panneau posé | une liste, une carte de la fiche Sujet |
| 2 | un objet flottant | barre KPI, segmented, menu |
| 3 | une feuille | dialogue, sheet |

**Une liste = un panneau** (`ListPanel`) : les lignes vivent dans un panneau blanc unique, séparées
par un filet, jamais nues sur la pierre et jamais une carte par ligne. Une ligne « en retrait »
(lue, faite) s'enfonce dans le panneau (`--surface`) au lieu de changer de couleur.

**Ce qui se presse s'enfonce** (`.pressable`) : 1px de translation, l'ombre portée disparaît, une
ombre interne apparaît. C'est le retour tactile que le flat design n'a pas. Un aplat de couleur
n'est jamais le seul signal d'un état.

Le **grain** (`.grain`) casse l'effet plastique des grands aplats — le header violet le porte ;
un panneau blanc ne le porte pas.

Les **rayons sont plafonnés** : 8–10 sur un contrôle, 12–14 sur un panneau, 20 sur une feuille
ou le bas du header. Au-delà, l'objet redevient un jouet. Seul ce qui est rond par nature
(pastilles, avatars) est rond.

**Une barre ancrée en bas projette son ombre vers le haut**, jamais l'inverse.

Le mouvement est court et sort vite (`--dur-*`, `--ease-*`) : une transition qu'on remarque est
une transition trop longue sur une app qu'on ouvre trente fois par jour.

> ⚠️ **Piège Tailwind v4.** Il n'y a pas de `tailwind.config.js`. Un rayon lu depuis une variable
> s'écrit `rounded-b-(--ma-var)` — **parenthèses**. `rounded-b-[--ma-var]` ne produit rien,
> silencieusement.
