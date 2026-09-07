# Design system — 2. Composants

> **Domicile de l'inventaire : [`apps/web/src/components/`](../../apps/web/src/components/).**
> Ce fichier porte les **règles de composition** — ce qui décide de la forme d'un composant
> avant qu'on l'écrive. La liste des composants existants se lit dans le code ; recopiée ici,
> elle serait fausse au troisième écran.

## Avant d'écrire un composant : le registre

**Interroger le MCP shadcn est la première action, toujours.** Écrire à la main une primitive
que le registre fournit est une **erreur de process**, pas un choix esthétique.

1. **Chercher** dans le registre.
2. **Trouvé** → l'installer, puis l'adapter aux tokens. Ne pas le réécrire.
3. **Partiellement couvert** → **composer** à partir des primitives existantes.
4. **Absent** (dernier recours) → sur mesure, avec `cn()`, `cva` et la structure de `components/ui`.

> ⚠️ Les primitives générées enveloppent **Base UI**, pas Radix : `asChild` n'existe pas, l'API
> de composition est `render`, et un bouton qui rend un lien exige en plus `nativeButton={false}`.
> Cf. `PITFALLS.md` #40 — la seconde moitié du piège compile, passe le lint, passe les tests et
> rend un HTTP 200.

## Trois familles, trois responsabilités

| Famille | Ce qu'elle contient | Règle |
|---|---|---|
| `ui/` | Les primitives du registre, adaptées au thème | Ne portent **aucune** connaissance métier |
| `layout/` | La coquille : header, barre d'onglets, cadre mobile, gardes de viewport | Un seul exemplaire de chaque, jamais dupliqué par écran |
| `shared/` et les dossiers métier | Les composants **métier** récurrents | Naissent le jour où un deuxième écran recopie le premier — pas avant |

## Les règles de composition qui ne se devinent pas

**Une entité de liste est une LIGNE, pas une carte flottante.** Un sujet, une tâche, une
conversation se rendent en ligne pleine largeur, séparées par un filet. Des cartes empilées avec
leurs marges et leurs ombres divisent par deux le nombre d'éléments visibles à l'écran — sur un
produit dont le travail est de *trier*, c'est le mauvais arbitrage.

**Une présentation unique par entité, partout.** Une tâche se rend de la même façon dans la
liste d'un sujet et dans une liste à plat ; seul le contexte affiché varie (le titre du sujet
apparaît dans la liste à plat, la date disparaît quand le semainier la porte déjà). Deux rendus
d'une même entité divergent en une semaine.

**Le geste dépend de la surface, jamais du canal.** C'est la contrepartie de la règle
précédente : ce qui change d'un canal à l'autre est le **rendu** et le **geste**, jamais le
domaine. Les gestes et ce qu'ils déclenchent font foi dans
[`../04-design-domaine.md`](../04-design-domaine.md) — ils ne se redécrivent pas ici.

**Le tap est réservé à l'ouverture d'une pièce jointe.** Aucune pop-up de message, sur aucun
canal. Un tap qui ouvre une modale sur une liste qu'on parcourt au pouce transforme chaque
défilement en champ de mines.

**Une confirmation nomme ce qu'elle met en jeu.** Jamais « un ou plusieurs sujets » : une
confirmation sans information se clique sans être lue, ce qui la rend pire qu'absente.

**Ce qui est destructeur est irréversible ; le reste ne l'est jamais.** Aucun geste courant du
produit ne détruit de données — c'est un principe de domaine, et le vocabulaire de l'UI doit le
refléter : « Fermer », « Remettre », « Ignorer », jamais « Supprimer » ni « Corbeille » quand
rien n'est détruit.

## Rendu et fond

**Un fond teinté sur du texte long l'étrangle.** Un e-mail se rend pleine largeur, sur fond
blanc dans les deux sens : c'est l'**en-tête** (avatar, expéditeur, date) qui porte
l'information de provenance. Les bulles restent réservées aux messages courts de messagerie.

**Un composant rendu par Relvo est le même que celui de l'écran.** Une carte de sujet affichée
dans un échange avec l'agent est identique à celle de la liste — c'est ce qui rend l'agent
crédible comme surface d'action, et ce qui garantit qu'un seul correctif suffit.
