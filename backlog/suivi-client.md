# Le suivi de projet — spécification

> **Une page, hors de l'application, qui dit au client où en est son projet et ce qui a changé
> dans son application.** Elle est alimentée par les fichiers de ce dossier et par les commits.
> Aucune base de données, aucun outil tiers.
>
> Maquette de référence : [`../conception/mockup/suivi/index.html`](../conception/mockup/suivi/index.html).

---

## Ce que la page répond

Le client pose deux questions, et elles n'ont pas le même rythme :

| Question | Onglet | Rythme |
|---|---|---|
| *Où en est mon projet ?* | **Avancement** — une frise des chantiers, à l'échelle du temps | change quand un chantier s'ouvre ou se ferme |
| *Qu'est-ce qui a changé dans mon application ?* | **Journal des versions** | change à chaque mise en ligne |

Les deux vivent sur la même page, dans deux onglets. Les mélanger produit une page que personne
ne sait lire.

---

## Les sources — une liste blanche de trois

| Source | Ce qu'elle donne | Ce qui est lu |
|---|---|---|
| `epics/*.md` | la frise : titre client, objectif, statut, dates | **le frontmatter seul** |
| `CHANGELOG.md` (racine, généré) | le journal des versions | tout le fichier |
| `../package.json` | rien de publiable — sert à dater la génération | — |

### ⚠️ La garantie est mécanique, pas disciplinaire

**Le script de génération n'ouvre jamais le corps d'un fichier.** Il lit du frontmatter et un
CHANGELOG, un point. Une phrase écrite dans le corps d'une épique ne peut donc **pas** fuir vers
le client, même en la voulant.

C'est une **liste blanche par champ structuré**, et c'est délibéré. Une liste noire — des
marqueurs `<!-- public -->` à poser autour des passages publiables — échouerait le jour où
quelqu'un oublie une balise, et ce jour arrive toujours.

### Ce qui n'est JAMAIS une source

`../conception/**` · `ecarts-et-propositions.md` · `../PITFALLS.md` · `../CLAUDE.md` ·
`sprints/**` · le **corps** d'une épique.

Ces fichiers contiennent ce qu'il faut pour travailler — risques assumés, décisions renversées,
pièges payés, périodes d'arrêt, coûts de fournisseurs. C'est leur valeur, et c'est exactement ce
qui n'a rien à faire devant un client.

---

## Le frontmatter d'une épique

```yaml
---
id: M7                      # clé de jointure avec le dépôt — jamais affichée
public: true                # false = la ligne n'existe pas sur la page
ordre_public: 10            # ordre d'affichage dans la frise
titre_client: Tri automatique des messages
resume_client: >
  Le cœur de Relvo. Il lit les messages qui arrivent, comprend de quoi ils parlent,
  ouvre le sujet correspondant, propose les tâches à faire et prépare un brouillon
  de réponse. C'est la fin du tri à la main.
statut: en-cours            # a-faire | en-cours | termine | partiel
debut: 2026-09-15
fin: 2026-10-05
---
```

**`titre_client` et `resume_client` sont en langage métier, jamais technique.** Le client n'a pas
à savoir ce qu'est un pipeline ni une migration : il veut savoir ce que le chantier lui apporte.

**`id` n'est jamais affiché.** Il sert à retrouver l'épique dans le dépôt — pour toi, pas pour
lui.

### Les épiques non publiques

Une épique sans valeur client porte `public: false` et **n'apparaît pas**. C'est normal qu'une
frise client ait moins de lignes que le backlog : « Mécanismes transverses » et « Qualité et
exploitation » n'apprennent rien à un dirigeant.

---

## Les règles de la frise

**Trois états, trois traitements visuels** : terminé (plein, vert), en cours (plein, violet),
prévu (contour pointillé). Plus un **jalon de livraison**, rendu en losange — c'est la seule
chose que le client vient chercher, elle a droit à une forme à elle.

⚠️ **Les barres sont à l'échelle du temps réel.** Un chantier de trois jours produit une barre de
trois jours. C'est ce qui rend la frise honnête, et c'est ce qui la rend lisible : on voit
immédiatement ce qui a coûté cher.

⚠️ **Aucune date au jour sur un chantier non commencé.** Le futur est positionné au mois. Une
frise datée devient un engagement dans la tête du client, et elle se paie au premier décalage.
La page le dit explicitement plutôt que de laisser deviner.

⚠️ **Aucun pourcentage d'avancement, jamais.** Un « 60 % » est toujours faux et toujours retenu.

**Les périodes creuses restent visibles.** Si un mois n'a produit aucun chantier, la frise le
montre. On ne triche pas : le client l'a vécu, et une frise flatteuse ne trompe personne
longtemps.

---

## Les règles du journal

Il est **généré depuis les commits**, jamais écrit à la main.

| Type de commit | Devient une entrée ? |
|---|---|
| `feat` | **oui** — étiquette « Nouveau » |
| `fix` | **oui** — étiquette « Corrigé » |
| tout le reste | **non** |

Le filtre est la convention de commits elle-même : `docs`, `chore`, `refactor`, `perf`, `style`,
`test`, `ci` ne franchissent jamais la frontière.

### Le pied de message `Client:`

Un sujet de commit est écrit pour l'équipe. Environ un tiers seulement se lit tel quel par un
client. D'où un pied de message **optionnel** :

```
feat(contacts): fiche contact en « carte de visite » plein écran

Client: La fiche d'un contact s'ouvre en plein écran, avec tous ses
numéros et adresses visibles d'un coup.
```

| Pied de message | Effet |
|---|---|
| `Client: <phrase>` | c'est cette phrase qui est publiée |
| absent | le sujet du commit est publié tel quel |
| `Client: -` | l'entrée n'est **pas** publiée |

**La phrase est écrite à la première personne du client** — « vous pouvez », « vos messages » —
et décrit un **effet observable**, pas une implémentation.

⚠️ **C'est la seule ligne de tout ce dispositif qui demande une discipline, et elle est
déléguée** : c'est Claude Code qui rédige les commits. Elle est inscrite dans la
[Definition of Done](definition-of-done.md).

---

## Où vit la page

Route statique `/suivi/<token>`, dans l'application. Le token est un slug aléatoire long, porté
par une variable d'environnement, et la page **n'existe qu'à ce chemin** — tout autre valeur
tombe en 404 sans rien révéler.

⚠️ **L'URL obscure n'est pas la protection.** C'est de la discrétion. **Ce qui protège, c'est la
liste blanche** : même divulguée, la page ne contient rien qui gêne. Traiter l'URL comme un
secret serait se tromper de garde-fou.

La page porte un `noindex`, et la route est publique — donc **ajoutée à la liste des routes
publiques de l'authentification**.

---

## Ce qui empêche la page de mentir

La cohérence n'est pas tenue par la vigilance : **le script de génération valide, et le build
échoue** si l'une de ces règles casse.

- au plus **une** épique **publique** en `statut: en-cours` ;
- toute épique `public: true` a un `titre_client` **et** un `resume_client` ;
- une épique `en-cours`, `partiel` ou `termine` a une date de début ;
- quand `fin` existe, `fin >= debut` ;
- deux épiques n'ont pas le même `ordre_public`.

C'est le même principe que le test qui tient la liste des contraintes du modèle de données :
*tenu par un test, jamais par la vigilance*. Une page de suivi fausse est pire qu'une page de
suivi absente — elle est lue, et elle est crue.
