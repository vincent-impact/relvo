# 1. Principes structurants

> **Fait foi sur les INVARIANTS** (§14). Le reste de ce document porte le *pourquoi* : le
> problème résolu, le public visé, la posture produit. C'est la partie qui n'a **aucun homologue
> dans le code**, donc celle qui ne peut pas mentir.
>
> Le *persisté* fait foi dans [`02-modele-donnees.md`](02-modele-donnees.md), le *comportement*
> dans [`04-design-domaine.md`](04-design-domaine.md). Cf. [`00-sources.md`](00-sources.md).

---

## 1. Le produit ne pilote pas des messages, il pilote des sujets

Le cœur de Relvo n'est ni la boîte mail ni la messagerie. C'est le **Subject**.

Un sujet rassemble en un seul endroit les messages, les pièces jointes, les tâches et les
événements liés à une **situation métier en cours de traitement**. C'est l'intention fondatrice
du projet : transformer un flux désordonné de sollicitations en dossiers clairs et suivis.

Le message, lui, n'est ni l'unité de pilotage ni l'unité de regroupement : il **alimente** une
conversation, et c'est depuis une conversation que s'ouvre un sujet. La mécanique complète — le
rangement déterministe, l'écoute, les bornes — fait foi dans `04-design-domaine.md`.

## 2. À qui s'adresse Relvo

**Des dirigeants des secteurs food et bâtiment.** Ils ne sont pas familiers des SaaS bureautiques
— Notion, Hubspot, Pipedrive leur sont étrangers — mais ils sont **à l'aise avec ChatGPT et
Claude**. Leur modèle mental natif est la **conversation**, pas la navigation par menus.

Ils vivent sur téléphone, entre deux services, souvent en pleine lumière et à une main. La
promesse doit être lisible immédiatement, et l'interface tenir dans un pouce.

Deux conséquences qui gouvernent tous les arbitrages :

- **Une interface bariolée est illisible** pour eux. La couleur est un signal, pas une
  décoration, et la rareté fait le signal.
- **Une fonctionnalité qui demande un apprentissage est une fonctionnalité qui ne sera pas
  utilisée.** Un geste, un effet, toujours le même.

## 3. La posture produit

> **L'UI sert à accéder à l'info ; Relvo sert à agir.**

L'essentiel des actions passera par l'échange avec l'agent, pas par les écrans. Cette phrase
n'est pas un slogan : c'est le **réflexe d'arbitrage** de tout le produit. Devant une
fonctionnalité, la question n'est pas « est-ce utile ? » mais « est-ce que ça renforce Relvo
comme surface d'action, ou est-ce que ça ajoute un écran de plus à apprendre ? »

C'est aussi ce qui explique une décision qui surprend : **la liste des conversations n'est pas la
surface principale du produit.** Exposer en permanence tous les fils reviendrait à réafficher une
boîte de réception que le dirigeant a déjà dans sa messagerie — on lui *ajouterait* du travail au
lieu de lui en retirer. La charge mentale doit rester sur les **sujets**, pas sur les messages.

## 4. Le triptyque d'acteurs

Chaque chose affichée vient de quelqu'un, et ce quelqu'un est l'une de trois voix :

| UI | Modèle | Couleur | Ce que c'est |
|---|---|---|---|
| **Moi** | `user` | bleu | l'utilisateur |
| **Relvo** | `ai` | violet | l'assistant |
| **Externe** | `contact` | ambre | le monde extérieur |

C'est **le seul code couleur que l'utilisateur doit apprendre**, et il est tenu partout : bulles,
pastilles du journal, badge de source d'une tâche, avatars.

> **Note de nommage.** Dans l'interface, on dit **Relvo** — « Relvo a préparé un brouillon… » —
> jamais « l'IA ». Dans la documentation technique et le modèle, on conserve « IA » et la valeur
> `ai`, pour rester neutre.

## 5. Relvo aide à décider et à exécuter

**Aide à la décision** — Relvo lit le message et propose des tâches pertinentes, dans la limite
de ce que le contenu permet de déduire.

**Aide à l'exécution** — Relvo prépare des actions concrètes, au premier rang desquelles une
**réponse préremplie** : destinataire, canal et contenu déjà posés. Le brouillon est présenté
dans la zone de rédaction, clairement identifié comme une suggestion, et l'utilisateur l'édite,
le régénère ou l'efface.

**Ce que Relvo ne peut pas faire, et pourquoi c'est structurant.** Relvo ne propose que ce qui
est **déductible du contenu disponible**. « Confirmer ou refuser le remplacement » se déduit d'un
message ; « Appeler le shop de Montpellier » ou « Vérifier les stocks de Béziers » relève du
savoir de terrain. Relvo ne sait pas, à la lecture d'un message seul, quels magasins sont
impactés ni comment l'organisation est structurée.

C'est précisément ce que la mémoire du compte (§8) sert à combler.

### L'acquittement implicite

Le produit fait un choix de **légèreté maximale** : aucune validation explicite à donner aux
suggestions. **Ouvrir la fiche d'un sujet vaut acquittement** de tout ce qui s'y trouve — tâches
proposées, brouillon, suggestion de validation. L'utilisateur agit ensuite naturellement, à son
rythme.

**Pourquoi.** Un bouton « valider les suggestions » ajoute un geste à chaque sujet pour un
bénéfice nul : l'utilisateur qui lit la suggestion l'a déjà acquittée dans sa tête. Le produit ne
lui demande pas de le prouver.

## 6. Tâche et action ne sont pas la même chose

**La tâche** dit ce qu'il faut faire. **L'action** est l'opération concrète exécutée dans l'outil
— en V1, essentiellement : envoyer un message.

« Répondre au fournisseur » est une tâche ; l'ouverture du composer et l'envoi effectif sont une
action. L'action est le **mécanisme d'exécution** de certaines tâches, pas la tâche elle-même.

## 7. Tout ce qui se passe alimente un journal de bord

Des messages arrivent, des tâches se créent et se cochent, des actions s'exécutent, un sujet
change d'état. Chaque événement est identifié par **son type** et **son acteur**, et le triptyque
Moi / Relvo / Externe structure la lecture de l'activité dans toute la plateforme.

Le journal n'est pas un mécanisme technique de traçabilité : c'est ce qui permet à l'utilisateur
de **comprendre d'un coup d'œil qui agit dans son système**, et de garder une trace des décisions
prises sur une affaire.

## 8. Les Dossiers sont la mémoire de Relvo

Relvo ne lit pas que les messages entrants. Il s'appuie sur une **base de connaissances propre au
compte**, alimentée par l'utilisateur — c'est ce qui transforme un assistant générique en un
assistant **qui connaît le métier**.

Cette base **n'a pas sa propre page**. Elle vit à l'intérieur des Dossiers, aux côtés des sujets
du même périmètre. Le modèle mental est celui d'un **classeur physique** : on ouvre son dossier
« Fournisseurs » et on y trouve à la fois les affaires en cours et les documents de référence qui
servent à les traiter. C'est l'unité de classement la plus intuitive pour un public non rompu aux
SaaS — un dossier, c'est concret.

**Nommage : « Domaines », pas « Dossiers ».** « Dossiers » évoque la bureautique ; chaque domaine
est présenté comme **un domaine de la mémoire de Relvo**. L'utilisateur comprend qu'il
**enrichit la mémoire de son assistant**.

### Deux natures de documents, et pourquoi la distinction compte

- **Documents** — fichiers de référence figés : organigrammes, contrats, chartes tarifaires. Non
  modifiables dans l'app. Ce sont des **références auxquelles on se fie**.
- **Instructions** — texte rédigé dans l'app, que l'utilisateur fait évoluer : règles internes,
  ton de réponse, particularités d'un fournisseur, leçons apprises. C'est une **mémoire qu'on
  façonne**.

**La sensation de contrôle vient des instructions.** Ce sont elles qui donnent à l'utilisateur la
maîtrise de ce que Relvo « sait ». Sans elles, la base de connaissances est une boîte noire.

### Les citations rendent Relvo auditable

Quand Relvo propose une tâche ou un brouillon en s'appuyant sur un document, il indique la
**source**. Cette traçabilité n'est pas un ornement : sans elle, l'utilisateur ne peut ni
vérifier ni corriger ce sur quoi Relvo s'appuie — et un assistant qu'on ne peut pas vérifier
n'est pas un assistant qu'on garde.

## 9. Le calendrier matérialise la dimension temporelle du travail

Une tâche n'est pas seulement « ce qu'il reste à faire » : c'est aussi quelque chose qui se
positionne dans le temps. Relvo l'expose sur **deux surfaces complémentaires** — une **semaine**
sur la page des actions, un **mois** sur une page dédiée — avec un code couleur par domaine et la
replanification par glissement.

**Pourquoi deux surfaces et pas une.** La semaine répond à « qu'est-ce qui m'attend ? » ; le mois
répond à « quand est-ce que je peux caser ça ? ». Ce sont deux questions différentes, posées à
des moments différents. Une seule surface obligerait l'une des deux à être mal servie.

Le retard se gère **dans le semainier** — on remonte les jours passés pour traiter ou replanifier
— plutôt que dans une liste dédiée : une pile de tâches en retard qu'on ne peut que regarder
décourage, un jour qu'on peut faire glisser se traite.

## 10. Relvo aide aussi à prendre du recul

Relvo n'est pas qu'un outil de gestion de l'urgence. Il sert aussi à **rendre visible la valeur
qu'il apporte** — pour l'utilisateur, qui doit pouvoir constater que sa charge mentale baisse ;
pour le produit, parce que **sans cette visibilité, on perd vite confiance en un assistant**.

Le KPI structurant est le **pourcentage de tâches issues d'une suggestion de Relvo**. C'est le
plus parlant, parce qu'il ne mesure pas l'activité de l'outil mais le travail qu'il a réellement
retiré à l'utilisateur — sans pour autant invalider les tâches métier que seul l'utilisateur peut
créer (§5).

La vue d'ensemble complète — courbe d'évolution, charge face à la capacité estimée, fil
chronologique — est reportée. En V1, seuls les indicateurs essentiels sont portés sur la page des
actions, et les questions transversales passent par l'échange avec Relvo.

## 11. Mobile-first, agent au centre

Deux invariants gouvernent l'interface :

1. **Mobile-first.** Chaque écran est conçu d'abord pour un téléphone tenu à une main. Le desktop
   est un **enrichissement progressif**, jamais le point de départ. Une vue n'est finie que si
   elle marche en colonne unique, au pouce.
2. **L'agent est central.** L'échange avec Relvo est **le lieu par défaut**, pas un ajout.

**Pourquoi cette inversion.** Le public cible vit sur téléphone et ne connaît pas les codes des
SaaS de bureau — une barre latérale leur est étrangère. En revanche, ils dialoguent
quotidiennement avec un assistant. On n'a donc rien à leur apprendre : l'app **est** une
conversation, augmentée de vues structurées quand on veut creuser.

### L'accueil est un brief, pas un chat

La page d'atterrissage répond à « qu'est-ce qui m'attend ? » en trente secondes : des
indicateurs, l'agenda de la semaine, les tâches du jour. C'est le **premier tour de parole de
Relvo**, rendu en cartes — pas une page muette, et pas non plus un chat vide qui attendrait une
question.

L'échange proprement dit est une **surface plein écran**, atteinte depuis un bouton présent au
même endroit sur toutes les pages, et qui transmet le contexte de la page d'origine.

### Relvo rend les mêmes composants que l'interface

Les réponses de Relvo ne sont pas que du texte : il **rend les composants structurés du produit
directement dans le fil**. Demander « montre-moi mes sujets urgents » fait apparaître de vraies
cartes cliquables, pas une liste à puces.

Une seule bibliothèque, deux surfaces — c'est ce qui rend l'agent crédible comme surface
d'action, et ce qui garantit qu'un correctif suffit.

### Les limites de l'action-capable, assumées

Toute action de Relvo est **visible** dans le fil sous forme de bloc structuré et **annulable**.
Et le brouillon ne s'envoie **jamais** tout seul : il atterrit dans le composer pour validation.

**Pourquoi cette limite ne bougera pas.** Un assistant qui envoie un message à la place de son
utilisateur commet, un jour, une erreur qu'aucune annulation ne rattrape. Le coût d'un envoi à
tort est asymétrique — il engage la parole de l'utilisateur auprès d'un tiers.

---

## 12. Ce que Relvo ne fait pas

Trois refus délibérés, écrits ici parce qu'ils reviendront sur la table :

- **Relvo ne pilote pas le cycle de vie d'un sujet.** Il peut *suggérer* qu'une affaire semble
  terminée ; c'est l'utilisateur qui valide et qui ferme.
- **Relvo ne crée pas de contact dans le vide.** Un expéditeur inconnu reste une chaîne brute
  jusqu'à ce qu'un sujet existe.
- **Relvo n'envoie jamais de message automatiquement.**

## 13. Le vocabulaire

Le produit tient un vocabulaire, et il le tient partout. Ce n'est pas de la cosmétique : chaque
mot dit ce que le geste fait vraiment.

| On dit | On ne dit pas | Parce que |
|---|---|---|
| **ouvrir** / **fermer** un sujet | créer / supprimer | Un sujet est un espace de travail, pas un enregistrement |
| **Fermer** / **Fermés** / **Remettre** | Supprimer / Corbeille / Restaurer | Rien n'est détruit — autant que le mot le dise |
| **écouter** une conversation | « fenêtre », « plage » | L'initiative appartient au sujet, qui se branche et se débranche |
| **Interlocuteur** | Destinataire | Un fil a deux sens |
| **échange** avec Relvo | conversation | « Conversation » désigne une entité du modèle : le fil avec un tiers |
| **Domaines** | Dossiers | On enrichit la mémoire d'un agent, pas une arborescence de fichiers |

---

## 14. Invariants produit

> **C'est la section qu'on relit à chaque session, et le domicile UNIQUE de ces règles.** Elles
> ne sont recopiées nulle part ailleurs — ni dans `CLAUDE.md`, ni dans le backlog. **Les lire
> avant tout arbitrage de périmètre ou de modèle. Aucun code ne doit les contredire.**
>
> ⚠️ **Un numéro n'est JAMAIS réattribué**, même si un invariant devient faux — on le marque
> périmé, on ne recycle pas son numéro. Ces numéros sont cités dans le code source en une
> vingtaine d'endroits : les renuméroter rendrait ces citations fausses.

**Modèle et acteurs**

1. `Account` est le tenant. Toutes les ressources portent `account_id`, **toujours dérivé de la
   session**, jamais d'un paramètre client. Pas de clé étrangère utilisateur sur les ressources.
2. Type partagé `Actor`. UI : **Moi / Relvo / Externe**, badges `M` (bleu) / `R` (violet) /
   `E` (ambre).
3. « **Relvo** » dans l'UI, « IA » dans la documentation technique. L'enum reste `ai`.

**Sujets, conversations, tâches, contacts**

4. Le **Subject** est l'entité centrale, pas le message. Chaîne :
   **Message → Conversation → Subject → Task → Action → LogEvent**.
5. Le rangement en conversation est **déterministe et infaillible à la réception** : il n'existe
   pas de message orphelin. Ce qui reste à trier est une **conversation** qu'aucun sujet ouvert
   n'écoute. *(`triage_hint` n'est plus alimenté ; le champ est conservé pour l'historique.)*
6. Une **tâche est rattachée au sujet, pas à un utilisateur**. Sa source (Relvo / Moi) est
   visible et permanente. L'affectation à une personne est reportée.
7. **Statut = cycle de vie à 3 valeurs exclusives** (`ouvert` / `validé` / `fermé`). « Fermer »
   est une **suppression douce**, jamais une destruction, et un sujet fermé n'est **jamais
   purgé**. → détail : `04 §9`.
8. **Priorité à 2 valeurs**, drapeau urgent **rare** — la rareté est le signal. Le geste de swipe
   dépend de la **surface**, jamais du canal. → détail : `04 §4` et `04 §7`.
9. Le **brouillon de Relvo vit dans le composer**, jamais affiché comme un message du fil, et
   **jamais envoyé automatiquement**.
10. **Acquittement implicite** : ouvrir un sujet vaut acquittement de ses suggestions. Pas de
    bouton « valider ».
11. La `Conversation` est une entité à **deux sous-types** (e-mail / messagerie). La fiche d'un
    sujet en affiche une **liste** ; l'écran de conversation est la **seule** surface d'affichage
    **et** de réponse. → détail : `04 §3`.
12. **Relvo ne crée un contact qu'à la création d'un sujet**, jamais dans le vide. La création
    manuelle par l'utilisateur reste permise. L'auto-rattachement des entrants consulte les
    coordonnées **primaires et secondaires**.
13. Les sujets sont **multi-contacts**. Une conversation e-mail porte un **set** de contacts ;
    une conversation de messagerie en porte **un seul** (ou un groupe).

    **13bis.** On diverge par canal sur le **rendu** et les **gestes**, **jamais sur le
    domaine**. → détail et garde : `04 §14`.

**Dates et planning**

14. Une tâche porte **quatre champs de date optionnels**. La deadline vit dans les champs de
    début ; les champs de fin expriment une durée.
15. **Deux surfaces calendaires** : la semaine sur la page des actions, le mois sur une page
    dédiée. Couleur par domaine, replanification par glissement.

**Domaines et connaissances**

16. Un `Folder` est un **domaine de la mémoire de Relvo**, présenté en trois onglets :
    Instructions / Documents / Sujets.
17. Le domaine **« Général »** est auto-créé, **purement documentaire**, **non supprimable**, et
    ne contient **jamais** de sujet.
18. Un `KnowledgeDocument` est soit un **Document** (référence figée, non modifiable, avec un
    état d'absorption décidé par Relvo), soit une **Instruction** (texte éditable).
19. **Deux stockages, jamais un seul.** Le stockage objet est la **source de vérité et la seule
    voie d'affichage** ; la copie d'inférence est en **écriture seule**. L'envoi se fait du
    navigateur vers le stockage, en direct.
20. En V1, **seul l'utilisateur édite les Instructions**. Relvo les consulte sans les modifier.

**Échange avec Relvo**

21. **Deux modes** : l'accueil est un **brief structuré**, pas un chat ; l'**échange** est une
    surface plein écran accessible partout.
22. L'échange est **plein écran**, ouvert depuis un bouton présent au même endroit sur toutes les
    pages, et **conscient de la page d'origine**.
23. Les échanges sont **éphémères, côté client**. Ce qui persiste, ce sont les **actions et leurs
    résultats**, pas le dialogue.
24. **Sessions implicites** : reprise de l'échange en cours en deçà d'un court délai, sinon
    nouvel échange.
25. **Action-capable dès le premier jour** : chaque opération de l'interface a un outil
    correspondant qui appelle **la même fonction métier**. Les actions sont rendues en blocs
    visuels **annulables**.
26. **Conscient de la page** : l'URL et le contexte sont transmis à chaque tour.
27. Outillage : SDK IA + passerelle, appels d'outils natifs (**pas de MCP en V1**), mise en cache
    de prompt, API de fichiers, citations.
28. **État vide** : quelques exemples de questions contextuels à la page, jamais de fausses
    bulles.
29. **Pas de recherche vectorielle** : contexte long et mise en cache pour les connaissances,
    appels d'outils pour les données dynamiques.

**Actions et tâches**

30. La page d'accueil (« **Actions** ») est la page des **tâches**, pas des sujets. La barre
    d'indicateurs est **contextuelle par page** — jamais deux lentilles sur un écran.
31. **Présentation unique des tâches partout** : même rendu dans la liste d'un sujet et dans une
    liste à plat, seul le contexte affiché varie. Cocher termine, décocher remet à faire ; le tap
    ouvre la fiche ; le rail de couleur porte le domaine.
32. **Une tâche peut n'avoir aucun sujet** — créée à la volée, ou détachée.
