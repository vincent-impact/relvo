# Design system — 1. Tokens

> **Domicile des valeurs : [`apps/web/src/app/globals.css`](../../apps/web/src/app/globals.css).**
> Ce fichier ne recopie pas la liste des variables — il dit **ce que chaque famille signifie** et
> **ce qu'elle interdit**. Un token créé sans intention écrite ici est un token qui sera
> réinventé ailleurs. La direction en place est « Lettrage d'artisan »
> ([`00-brief-da.md`](00-brief-da.md) §5) ; les tokens sont tenus par un test, pas par la
> vigilance.

## Le principe : la couleur est un signal, et la livrée est violette

Relvo s'adresse à des dirigeants qui ouvrent l'app entre deux services, en pleine lumière, à une
main, et qui la retrouvent posés au bureau. Une interface bariolée y devient illisible ; une
interface grise à un accent y devient un aplat sans repère. **La couleur a donc toujours un
rôle** : la livrée dit « vous êtes dans Relvo », les acteurs disent qui parle, les domaines
disent de quoi il s'agit, les états disent ce qui presse. Tout le reste est blanc, noir, ou gris.

Corollaire tenu partout : **la rareté comme signal** — une pastille urgente sur un ou deux sujets
sur vingt-quatre vaut plus que vingt badges colorés.

## La livrée — trois violets, un ciel

Le violet est la couleur de Relvo, produit et assistant. Il vient en trois valeurs, toujours du
plus sombre au plus clair, de haut en bas :

| Token | Rôle |
|---|---|
| `--nuit` | le haut du ciel, violet nuit profond : jamais ailleurs que dans un dégradé |
| `--relvo` | le violet de Relvo : texte signé, liens de Relvo, cercle d'un indicateur actif |
| `--relvo-clair` | le bas du ciel, le haut d'un dégradé de bouton |
| `--relvo-pale` et `--relvo-filet` | le fond et le bord du **bloc de Relvo** |

**Le ciel** (`--ciel`) est le dégradé du header : `--nuit` en haut, `--relvo` tenu sur presque
toute la hauteur, puis `--relvo-clair` et le blanc de l'écran de travail dans les derniers
pixels seulement, **ancrés au bas du header** quelle que soit sa hauteur : un texte blanc posé
dans le ciel est toujours sur le violet de Relvo, et seule la carte qui chevauche le bas voit
le ciel fondre derrière elle. Il ne s'arrête jamais net : il fond. Il
porte un **champ d'étoiles** (`--etoiles`) : une quinzaine de points fins et trois étoiles à
quatre branches, celles du signe, posés en dégradés radiaux et masqués vers le bas. C'est du
CSS ; aucune image. Sur la connexion, le ciel prend près de la moitié de l'écran.

**Les dégradés de violet sont permis** sur ce qui est de Relvo ou de la livrée — le bouton
central, l'action principale, une jauge, un interrupteur activé — et sur rien d'autre. Un
dégradé va du clair au sombre, dans le sens de la lumière.

⚠️ **Un bloc violet pâle signé des étoiles, c'est Relvo qui parle.** Comme le chrome est violet,
la teinte seule ne dit plus l'acteur ; le bloc le dit. Un bouton de l'utilisateur n'est jamais
sur `--relvo-pale`.

## Le triptyque d'acteurs — le seul code couleur que l'utilisateur doit apprendre

Chaque chose affichée vient de quelqu'un, et ce quelqu'un a une couleur, la même partout :
bulles, pastilles de journal, avatars.

| Acteur | UI | Couleur | Token |
|---|---|---|---|
| L'utilisateur | **Moi** | bleu | `--actor-me` |
| L'agent | **Relvo** | violet, en bloc pâle signé | `--actor-relvo` → `--relvo` |
| Un tiers | **Externe** | ambre, en fond pâle et texte foncé | `--actor-ext`, `--actor-ext-fond` |

Une bulle de l'utilisateur est bleue, à droite ; une bulle d'un tiers est ambre pâle, à gauche ;
Relvo n'a pas de bulle, il a un bloc.

## Les domaines — une bande, et le texte qui va avec

Un domaine porte une couleur ; le sujet qui lui appartient l'hérite, et la tâche qui appartient
au sujet l'hérite à son tour. C'est ce qui rend une liste à plat lisible sans lire les titres.

Chaque domaine a **deux tokens** : la **bande** (`--domaine-<nom>`), pleine et vive, posée sur la
tranche gauche d'une carte ou d'une ligne — à l'intérieur de la surface, jamais au bord de
l'écran — et le **texte** (`--domaine-<nom>-texte`), plus sombre, qui tient le contraste sur
blanc pour le nom du domaine en capitales condensées. On ne prend jamais la couleur de bande
pour du texte.

La palette de domaines est distincte de la livrée : aucun domaine n'est violet.

## Les états

`--urgent` (rouge) pour ce qui presse et ce qui est en retard · `--fait` (vert) pour ce qui est
fait ou connecté · `--attente` (ambre) pour ce qui attend un tiers. Ces trois-là ne servent qu'à
ça : ils ne sont jamais empruntés pour de la mise en forme.

**L'état se lit à la forme avant la couleur** : urgent est une pastille **pleine**, en attente
une pastille **cerclée**, en retard un horaire **barré**, fait une coche sur disque violet et un
titre barré. Un daltonien lit l'écran.

## La sélection — un cerclage

Un indicateur actif (Sujets, Calendrier, Conversations, Contacts) est un chiffre **cerclé** d'un
trait `--relvo`, à distance de son libellé ; jamais un remplissage, qui effacerait la couleur.
Dans le dock, l'onglet actif se lit au blanc plein et à la graisse du libellé ; il n'est jamais
cerclé. Une puce de filtre active est noire sur blanc.

## Le noir — le dock et le texte

`--noir` est le texte courant et le **dock** : une pilule noire flottante, décollée du bas et
des bords, à cinq places, dont les icônes pleines sont blanches. Le noir ne sert à rien d'autre
de grand : pas de header noir, pas de carte noire.

## La typographie

Une seule famille en deux dessins, chargée via `next/font` :

| Rôle | Famille | Pourquoi |
|---|---|---|
| Texte courant, libellés, interface | **Barlow** 300 / 400 / 500 (`--font-sans`) | Dérivée du lettrage routier : fine, large, lisible en plein soleil. La graisse 300 est le texte, 400 le titre d'une ligne, 500 un libellé qui porte |
| Chiffres, horaires, délais, titres | **Barlow Semi Condensed** 600 (`--font-condensed`) | Les gros chiffres du camion : un indicateur, un horaire, un titre de sujet sont condensés et gras, le reste fin. Chiffres tabulaires |

Les titres ne dépassent pas la graisse 600 ; le nom d'un domaine est en 600 condensé, 11 px,
interlettré. Aucun texte fonctionnel sous 11 px, hors libellé du dock.

L'échelle de corps est **mobile d'abord** : calibrée pour un écran d'environ 390 px, le desktop
en hérite sans la remonter.

## Les icônes — des pictogrammes pleins, des glyphes en trait

Un **pictogramme** (un cerveau, une enveloppe, une prise, un dossier) est **plein** : c'est le socle
que le dirigeant a verrouillé, et un trait de deux pixels au milieu d'icônes pleines se voit.
Tous viennent de `components/shared/picto.tsx`, qui pose la graisse une fois pour toutes ; les
quatre icônes du dock sont dessinées à part, telles qu'elles ont été validées. Un **glyphe**
(chevron, croix, plus, coche, flèche de rotation, loader) n'a pas de version pleine parce qu'il
*est* un trait : lucide les fournit, et rien d'autre. Un état ne se dit jamais par le
remplissage d'une icône (plein = actif, vide = inactif) : c'est la couleur et la forme de la
puce qui le portent. La ligne de partage est tenue par le test des tokens.

## La matière : blanc, cartes, une ombre portée

Le fond de l'écran de travail est **blanc** ; le ciel fond dedans. Une zone est une **carte**
(`--surface`) : blanche, coins de `--rayon-carte` (18 px), un filet à peine visible, et une
**ombre portée douce** (`--ombre-carte`) avec un décalage et un flou — jamais un halo sans
décalage, jamais une ombre dure. Une sous-carte dans un bloc de Relvo (un sujet cité) prend un
rayon plus petit (`--rayon-sous-carte`, 14 px) et un filet, pas d'ombre : **pas de carte dans
une carte** avec deux ombres.

**Une liste = une carte** : les lignes vivent dans une carte unique, séparées par un filet
(`--filet`), jamais nues sur le fond et jamais une carte par ligne. Exception voulue : « En
attente de vous » est une suite de cartes à feuilleter, une par sujet.

Le **bloc de Relvo** est une carte sur `--relvo-pale` bordée de `--relvo-filet`, avec le signe
et un libellé en capitales `--relvo`.

Le **dock** porte `--rayon-dock` (32 px, pilule) et une ombre portée vers le bas, puisqu'il
flotte ; le **composer** d'une conversation, lui, est ancré et projette son ombre vers le haut.
Le **bouton Relvo** est un disque `--rayon-rond` en dégradé de violet, plus haut que le dock,
qui en déborde en haut et en bas dans son axe ; la pilule **se soulève autour de lui**
(`--dock-etire`) en courbe douce, comme un tissu tendu, et son ombre suit cette silhouette : le
disque est dans la barre, pas posé dessus. Le badge rouge est repoussé hors du bord.

Il n'y a **ni verre, ni grain, ni relief** : le produit est plat, et c'est la couleur qui fait
la hiérarchie. Les **rayons sont comptés** : pilule (`--rayon-pilule`) pour une puce, un bouton
et le dock ; 18 pour une carte ; 14 pour une sous-carte ; 12 pour une option de formulaire ;
8 pour un petit bouton d'icône sur le ciel. Au-delà, l'objet redevient un jouet. Seul ce qui est
rond par nature (pastilles, avatars, disque Relvo, case à cocher) est rond.

**Ce qui se presse s'enfonce** (`.pressable`) : 1 px de translation et l'ombre portée qui se
raccourcit. Un aplat de couleur n'est jamais le seul signal d'un état.

Le mouvement est court et sort vite (`--dur-*`, `--ease-*`) : une transition qu'on remarque est
une transition trop longue sur une app qu'on ouvre trente fois par jour. Les étoiles ne
scintillent pas.

> ⚠️ **Piège Tailwind v4.** Il n'y a pas de `tailwind.config.js`. Un rayon lu depuis une variable
> s'écrit `rounded-b-(--ma-var)` — **parenthèses**. `rounded-b-[--ma-var]` ne produit rien,
> silencieusement.
