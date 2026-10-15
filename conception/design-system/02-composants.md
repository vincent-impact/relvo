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

**Une entité de liste est une LIGNE dans UNE carte, pas une carte par ligne.** Une affaire, une
tâche, une conversation, un contact se rendent en ligne, séparées par un filet, dans une carte
blanche unique (`ListPanel`) posée sur le fond blanc de l'écran. Des cartes empilées avec leurs
marges et leurs ombres divisent par deux le nombre d'éléments visibles à l'écran — sur un produit
dont le travail est de *trier*, c'est le mauvais arbitrage. Une ligne pose `data-list-row` sur
sa racine : c'est ce qui retire le filet de la dernière. **Une seule exception, voulue** : « En
attente de vous », sur l'accueil, est une suite de cartes à feuilleter horizontalement, une par
affaire, parce que chacune porte le contact, l'enjeu, depuis quand, et le geste — ce qu'une ligne
ne peut pas porter.

**La MATIÈRE dit l'importance, et il y a quatre matières.** Le **ciel** (le header en livrée,
qui fond vers le blanc) porte l'identité et le titre de la page ; le **bloc de Relvo** (violet
pâle, signé des étoiles) porte tout ce que l'agent dit ; la **carte blanche** porte ce qui se
lit ou se manipule, chiffres, lignes, formulaires ; le **texte nu** sur le fond blanc porte les
titres de zone et leurs qualificatifs. Deux cartes blanches de même matière font deux zones
d'égale importance — donc aucune ; c'est la couleur qui hiérarchise, jamais une ombre plus
forte. Corollaire : un texte n'a pas besoin d'une carte, et une carte ne contient jamais une
autre carte avec sa propre ombre — une affaire citée dans un bloc de Relvo est une sous-carte à
filet, sans ombre.

**Mais toute zone est NOMMÉE, et les en-têtes sont symétriques.** Sans libellé, un écran encore
vide n'est qu'une suite d'éléments flottants dont le lecteur ne sait pas à quoi ils servent —
c'est le même patchwork, en plus plat. Chaque zone porte donc le même en-tête : le titre à
gauche, et à droite ce qui la qualifie (le compte, la progression, la période). À l'intérieur
d'une carte, le libellé est en petites capitales interlettrées. La hiérarchie vient de la
matière, la lisibilité vient du libellé ; les deux ne s'opposent pas. Un libellé ne disparaît
jamais parce que sa zone est vide : c'est là qu'il sert le plus, au-dessus de l'invite qui
amorce le remplissage.

**Le domaine se lit à sa bande, une par carte ou par ligne.** Une carte d'affaire, une ligne
d'affaire, une affaire citée par Relvo, le bandeau « Suivi dans » d'une conversation portent sur leur
tranche gauche la bande pleine de leur domaine et son nom en capitales condensées de la même
couleur. Une seule bande par surface, sur la tranche : deux bandes sur un même objet, ou une
bande sur une tâche qui a déjà son affaire écrite, font un camion de foire. Les icônes du dock, les
pastilles d'état et les avatars ne portent jamais la couleur d'un domaine.

**Les chiffres sont gros et condensés, le texte est fin.** Un indicateur, un horaire, un délai,
un compte à droite d'une ligne sont en condensé gras ; un titre de ligne est en graisse normale,
une explication en graisse fine. C'est ce qui permet de lire un écran debout : l'œil attrape
les chiffres d'abord. Un même chiffre n'est jamais rendu deux fois sur un écran.

**L'état se lit à la forme avant la couleur.** Urgent est une pastille pleine, en attente une
pastille cerclée, en retard un horaire barré, fait une coche sur disque et un titre barré. La
couleur confirme, la forme suffit. **La sélection est un cerclage** : l'indicateur actif d'une
page est un chiffre cerclé, à distance de son libellé ; une puce de filtre active est pleine et
noire ; l'onglet actif du dock se lit au blanc plein et à la graisse, jamais à un cerclage.

**Le bloc de Relvo est un composant, pas une recette.** `RelvoBlock` est la seule façon de
rendre la voix de l'agent — les nouvelles de l'accueil, un état vide qui guide, une question,
l'avancement d'une lecture. Trois formes y vivent, qui se consomment telles quelles dans un
écran comme dans l'échange : la **phrase** (`RelvoSentence`) et son lien fléché ; l'**étape-
formulaire** (`EtapeFormulaire`) — une question courte, deux à quatre réponses complètes en
options blanches à filet, une réponse secondaire en texte (« Plus tard », « Autre… »), jamais
un choix dans le texte ; la **carte vivante** (`CarteVivante`) — une phrase qui dit où Relvo en
est et trois compteurs qui se posent quand ils changent. Un écran qui recopie le bloc à la
main diverge en une semaine.

**Un état vide guide, dans la voix de Relvo, quand c'est Relvo qui remplit.** Les affaires
ouvertes, l'annuaire, les conversations, les boîtes, les nouvelles : vides, ils sont un bloc de
Relvo qui dit ce qu'il fera et par où commencer — relier la première boîte quand rien n'est
arrivé, ou ce que le « + » permet sinon. Un onglet que l'utilisateur remplit par un geste
(validés, fermés) garde un texte nu qui enseigne le geste.

**Chaque phrase de Relvo pointe sa preuve.** Un bloc de Relvo qui parle d'une affaire, d'une tâche
ou d'un message porte sous la phrase le lien vers cet objet, ou l'objet lui-même en sous-carte ;
une affirmation de l'agent sans porte vers ce qu'elle décrit est une affirmation que le
dirigeant ne peut pas vérifier.

**Un badge à zéro ne s'affiche pas.** Une pastille ou une puce « 0 » n'informe de rien et
encombre la barre qui la porte. Le compteur d'un onglet à icône est un badge **posé sur
l'icône**, dans son coin haut droit, comme sur un téléphone ; à côté d'elle, il élargit l'onglet
et sort de la carte à deux chiffres. Le point du non-lu tient l'autre coin. Un **indicateur**, lui, est une cellule fixe : à zéro, il écrit
« 0 », en gris clair — un tiret ou un vide y laisserait croire à une donnée manquante.

**Une présentation unique par entité, partout.** Une tâche se rend de la même façon dans la
liste d'une affaire et dans une liste à plat ; seul le contexte affiché varie (le titre de l'affaire
apparaît dans la liste à plat, la date disparaît quand le semainier la porte déjà). Deux rendus
d'une même entité divergent en une semaine.

**Le geste dépend de la surface, jamais du canal.** C'est la contrepartie de la règle
précédente : ce qui change d'un canal à l'autre est le **rendu** et le **geste**, jamais le
domaine. Les gestes et ce qu'ils déclenchent font foi dans
[`../04-design-domaine.md`](../04-design-domaine.md) — ils ne se redécrivent pas ici.

**Le tap est réservé à l'ouverture d'une pièce jointe.** Aucune pop-up de message, sur aucun
canal. Un tap qui ouvre une modale sur une liste qu'on parcourt au pouce transforme chaque
défilement en champ de mines.

**Une confirmation nomme ce qu'elle met en jeu.** Jamais « une ou plusieurs affaires » : une
confirmation sans information se clique sans être lue, ce qui la rend pire qu'absente.

**Ce qui est destructeur est irréversible ; le reste ne l'est jamais.** Aucun geste courant du
produit ne détruit de données — c'est un principe de domaine, et le vocabulaire de l'UI doit le
refléter : « Fermer », « Remettre », « Ignorer », jamais « Supprimer » ni « Corbeille » quand
rien n'est détruit.

## Rendu et fond

**Un fond teinté sur du texte long l'étrangle.** Un e-mail se rend pleine largeur, dans une
carte blanche, dans les deux sens : c'est l'**en-tête** (expéditeur, destinataire, date) qui
porte l'information de provenance. Les bulles restent réservées aux messages courts de
messagerie, aux couleurs des acteurs : la mienne bleue à droite, celle d'un tiers ambre pâle à
gauche. Relvo n'a pas de bulle, il a un bloc.

**Un composant rendu par Relvo est le même que celui de l'écran.** Une carte d'affaire affichée
dans un échange avec l'agent est identique à celle de la liste — c'est ce qui rend l'agent
crédible comme surface d'action, et ce qui garantit qu'un seul correctif suffit.
