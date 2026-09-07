# 0. Hiérarchie des sources

> **Ce fichier dit qui a raison quand deux documents se contredisent.** Il se lit avant
> d'écrire dans `conception/`, et avant tout arbitrage de périmètre ou de modèle.

## La règle fondatrice

**Un fait, un domicile. Partout ailleurs, un lien.**

Une copie n'est pas une redondance utile : c'est une deuxième vérité en attente. Cette règle
vaut pour tous les documents du dépôt, `CLAUDE.md` compris — il renvoie, il ne recopie pas.

---

## Les rangs

| Rang | Source | Fait foi sur |
|---|---|---|
| **1** | [`01-principes.md`](01-principes.md) §Invariants produit | Les **invariants** |
| **1** | [`02-modele-donnees.md`](02-modele-donnees.md) | Le **persisté** : entités, champs, relations, contraintes |
| **1** | [`04-design-domaine.md`](04-design-domaine.md) + [`uml.mermaid`](uml.mermaid) | Le **comportement** : agrégats, cycles de vie, règles métier, périmètre |
| 2 | Les **fichiers du client** — [`sources/`](sources/) | Les **données réelles** : volumes, champs, cas pratiqués |
| 3 | Le **brief de direction artistique** — [`design-system/00-brief-da.md`](design-system/00-brief-da.md) | L'intention visuelle et le registre de langue |
| 4 | La **maquette** — [`mockup/`](mockup/) | Le rendu, les libellés, la densité — **jamais ses données** |

### Le rang 1 ne se départage pas

Les trois entrées de rang 1 se partagent **par périmètre**, jamais par préséance. Un désaccord
entre elles est un bug à corriger, pas un rang à trancher. Aucun de ces fichiers n'écrit
« ce document fait foi » : la répartition vit ici, et ici seulement.

Corollaire : **aucun document technique ne se déclare source de vérité de l'architecture.**
Les choix de stack et les frontières de déploiement vivent dans `CLAUDE.md` ; le raisonnement
qui a conduit à chacun vit dans [`../backlog/ecarts-et-propositions.md`](../backlog/ecarts-et-propositions.md).

### Le bord de la répartition — tranché

Invariants / persisté / comportement ne couvrent pas tout. Ce qui dépasse s'écrit deux fois si
personne ne lui donne d'adresse. Voici les adresses, pour Relvo :

| Ce qui n'entre dans aucune des trois | Domicile | Pourquoi lui |
|---|---|---|
| Le **problème résolu**, le public visé (dirigeants food et bâtiment), la **posture produit** (« l'UI sert à accéder à l'info, Relvo sert à agir ») | `01-principes.md` | C'est le *pourquoi*. Il n'a aucun homologue dans le code, donc il ne peut pas mentir. |
| Le **périmètre V1** — ce qui est outillé, ce qui reste manuel, ce qui est reporté | `04-design-domaine.md` | Un périmètre dit **quels cycles de vie existent** : c'est du comportement. |
| L'**entité centrale** (`Subject`) et ce qu'elle agrège | `04-design-domaine.md` | Une hiérarchie d'entités avec leurs fins de cycle est du comportement. `01` en garde la **phrase de principe**, pas la table. |
| Le **vécu** des flux — ce que l'utilisateur ouvre, ce qu'il fait à la main, ce qui le surprendrait | `03-cas-usage.md` | Il raconte et ne tranche pas. Un désaccord avec `04` se règle **toujours** en faveur de `04`. |
| Ce que l'**IA** fait et ne fait pas — prompts, seuils, stratégie de contexte | `05-ia.md` | C'est un comportement, mais **probabiliste** : il se décrit en intentions et en garde-fous, pas en machine à états. `04` porte le déterministe, `05` le reste. |
| Les **tokens**, l'inventaire des surfaces, les règles de responsive | `design-system/` | Ce sont des décisions de rendu, vérifiables contre `globals.css`. |
| Le **pourquoi on a changé d'avis** | `../backlog/ecarts-et-propositions.md` | C'est de l'histoire. Elle a de la valeur, mais pas dans un document qui décrit l'état actuel. |

---

## Ce que chaque source apporte, et ce qu'elle ne dit pas

### Rang 2 — les fichiers du client

**`sources/` est vide aujourd'hui, et c'est un manque, pas un état neutre.**

Relvo remplace un système en place : la boîte mail et le WhatsApp d'un dirigeant. La source la
plus fiable sur les données réelles — combien de messages par jour, quelle proportion mérite un
sujet, combien d'interlocuteurs distincts, quelle longueur de fil — est **le compte réel du
premier utilisateur**, et personne ne l'a encore mesurée.

Tant qu'elle manque, tout dimensionnement s'appuie sur le jeu de démonstration, qui n'a jamais
été calibré sur autre chose que la lisibilité d'une maquette.

> ⚠️ **Reprendre des données réelles fait entrer des données personnelles** dans la base, dans
> l'historique git si un fichier source y est commité, et dans toute branche de preview.
> L'historique git étant immuable, un effacement RGPD y devient impossible. Trancher où vit un
> fichier client **avant** de le committer, pas après.

### Rang 4 — la maquette, et le piège de ses données

`mockup/` fait foi sur le **rendu** : libellés, densité, hiérarchie visuelle, gestes.

**Elle ne fait foi sur aucune donnée.** Le jeu « Tasty Crousty » qu'elle affiche — et que le
seed de démonstration reproduit — est **fictif mais réaliste**, construit pour peupler des
écrans, pas pour décrire une charge. Les noms (Karim Benali, Sophie Blanchard, ClimaPro…) et
les références `SUB-xxxx` existent pour rester cohérents d'un écran à l'autre ; ils ne
mesurent rien.

> ⚠️ **Ne jamais dimensionner sur la maquette ni sur le seed.** Six sujets et huit messages sont
> une quantité choisie pour qu'une liste tienne dans un écran.

### Ce que la maquette ne couvre pas

La maquette précède plusieurs refontes du modèle de conversation. Là où elle montre un écran
qui n'existe plus, c'est `04-design-domaine.md` qui a raison — la maquette a raison sur le
**style**, jamais sur la **structure du domaine**.

---

## Où vit l'historique

Nulle part dans `conception/`. Ces fichiers décrivent **l'état actuel du projet, jamais son
histoire** :

- **Une erreur se corrige, elle ne se surcharge pas.** On récrit la phrase juste et on supprime
  l'ancienne — jamais un « ⚠️ corrigé le… » trois lignes plus bas.
- **Aucun concept mort.** Une piste écartée, un état supprimé, une proposition refusée n'ont
  plus rien à faire là. Le lecteur doit pouvoir tout croire sans vérifier les dates.
- **Aucune date, aucune signature, aucun « décision du… ».** Dès qu'un document demande à être
  daté pour être compris, plus personne ne lui fait confiance.
- **Classer par sujet, jamais par provenance.** Une section « ce que telle source apporte »
  finit toujours par créer un doublon de la section thématique correspondante.
- **De l'intention, pas de l'inventaire.** Un fichier de conception porte le *pourquoi* et
  **pointe** vers l'inventaire. Aucun chiffre : un décompte est juste le jour où on l'écrit et
  faux à la migration suivante. Quand un inventaire doit rester écrit, il est tenu par un
  **test**, jamais par la vigilance.

La trace des décisions vit dans [`../backlog/ecarts-et-propositions.md`](../backlog/ecarts-et-propositions.md),
avec son statut : tranché, proposé, ou bloqué.
