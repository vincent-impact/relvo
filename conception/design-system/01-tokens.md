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

## Les domaines (Folder) — une couleur par domaine, héritée par tout ce qui en dépend

Un domaine porte une couleur ; le sujet qui lui appartient l'hérite, et la tâche qui appartient
au sujet l'hérite à son tour. C'est ce qui rend une liste à plat lisible sans lire les titres.

La couleur se manifeste par un **rail** — un filet vertical de quelques pixels **à l'intérieur**
de la ligne, jamais au bord de l'écran, où il devient invisible. Tokens : `--folder-*`.

## Les états

`--danger` (rouge) pour ce qui écarte ou détruit · `--success` (vert) pour ce qui est fait ·
`--warning` (ambre) pour ce qui attend. Ces trois-là ne servent qu'à ça : ils ne sont jamais
empruntés pour de la mise en forme.

## Les surfaces « Liquid Glass »

La barre d'onglets et le header sont des surfaces **translucides** (`--glass-*`, `--blur-glass`,
`--sat-glass`) : le contenu défile visiblement dessous. C'est ce qui fait que l'écran paraît
plus grand qu'il n'est, sur un appareil tenu à une main.

⚠️ Une surface de verre **exige du contenu derrière elle** pour exister. Posée sur un fond plat,
elle ne se distingue pas d'un aplat — et le lecteur perd le repère de profondeur.

## La typographie

Trois familles, trois rôles, chargées via `next/font` :

| Rôle | Famille | Pourquoi |
|---|---|---|
| Titres | **Bricolage Grotesque** (`--font-heading`) | Grotesque contemporaine chaleureuse, sûre d'elle en grand corps — le produit assume de gros titres et peu d'éléments par écran |
| Interface et texte courant | **Geist** (`--font-sans`) | Neutre, très lisible en pleine lumière |
| Chiffres et références | **Geist Mono** (`--font-numeric`) | Chiffres tabulaires pour les KPI, et les références `SUB-xxxx` qui doivent s'aligner |

L'échelle de corps est **mobile d'abord** : elle est calibrée pour un écran d'environ 390 px, et
le desktop en hérite sans la remonter.

## Les rayons, l'élévation, le mouvement

Un rayon dit à quel point un objet est « posé » : discret sur un contrôle, marqué sur une carte,
maximal sur ce qui est rond par nature (pastilles, avatars). L'ombre dit la même chose en
profondeur — et **une barre ancrée en bas projette son ombre vers le haut**, jamais l'inverse.

Le mouvement est court et sort vite (`--dur-*`, `--ease-*`) : une transition qu'on remarque est
une transition trop longue sur une app qu'on ouvre trente fois par jour.

> ⚠️ **Piège Tailwind v4.** Il n'y a pas de `tailwind.config.js`. Un rayon lu depuis une variable
> s'écrit `rounded-b-(--ma-var)` — **parenthèses**. `rounded-b-[--ma-var]` ne produit rien,
> silencieusement.
