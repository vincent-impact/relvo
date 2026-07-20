# 1. Principes structurants

## 1. Le produit ne pilote pas des messages, il pilote des sujets

Le cœur de Relvo n'est pas la boîte mail ni WhatsApp.

Le cœur du produit est le **Subject**.

Un sujet est un espace de travail qui rassemble en un seul endroit :

- les **messages**
- les **pièces jointes**
- les **tâches**
- les **événements du journal de bord**

Autrement dit, un sujet représente une **situation métier en cours de traitement**.

Cette logique prolonge bien l'intention initiale du projet : transformer un flux désordonné de messages en dossiers clairs et suivis.

## 2. Le message est le point d'entrée, la conversation son point de chute

Un message entrant ou sortant est souvent l'élément déclencheur.

Quand un message arrive, il est **immédiatement rangé dans une conversation**, par une règle **déterministe** propre à son canal (cf. §3). Ce rangement a lieu **à la réception**, et il ne peut pas échouer : un message a donc toujours une place, dès la première seconde, sans qu'aucune IA n'ait à comprendre quoi que ce soit.

> **Il n'y a plus de message « Sans sujet ».** Ce qui peut rester en attente de tri, ce n'est pas un message isolé mais une **conversation orpheline** — une conversation sur laquelle aucun sujet n'est ouvert.

Le message n'est donc ni l'unité de pilotage, ni l'unité de regroupement : il **alimente** une conversation, et c'est depuis une conversation que s'ouvre un sujet.

> **Note historique.** Le modèle antérieur faisait tenter à l'IA, dès la réception, un rattachement à un sujet ; en cas d'échec (contact inconnu, intention ambiguë), le message restait « Sans sujet » dans une page Messages, avec un indice de tri (`triage_hint`). Ce statut n'a plus d'objet, et la page Messages disparaît au profit de la page **Conversations** (décision du 2026-07-20).

## 3. La conversation regroupe les messages selon le discriminant de son canal

Une **conversation** est un ensemble de messages réunis par un **discriminant stable, propre au canal**. Elle est calculée à la réception, sans IA, et elle est **durable** : une conversation ne se supprime pas et ne se termine jamais.

| Type | Canal | Discriminant (clé) | Titre |
|---|---|---|---|
| **objet** | email | interlocuteur externe + objet normalisé | l'objet de l'email |
| **groupe** | WhatsApp | identifiant du fil de groupe (`chat_id`) | le nom du groupe |
| **direct** | WhatsApp | l'interlocuteur | le nom du contact |

Nos propres messages **sortants** rejoignent la conversation de leur interlocuteur — et, pour l'email, de leur objet. Une conversation contient donc les deux sens de l'échange.

### Pourquoi le discriminant dépend du canal

L'email porte nativement une notion de fil : l'**objet**. Deux affaires distinctes menées avec la même personne se séparent d'elles-mêmes. WhatsApp n'a pas d'objet : le seul discriminant disponible est **l'interlocuteur** (ou le groupe). Un fil WhatsApp direct est donc un flux continu où les sujets **s'entrelacent** — c'est précisément le problème que Relvo existe pour résoudre.

De cette asymétrie découle la contrainte la plus structurante du modèle :

> **La granularité sémantique (le sujet) est forcément plus fine que la granularité de transport (la conversation).**

C'est pourquoi le rattachement à un sujet se décide **message par message**, et non conversation par conversation (cf. §9).

### Un fil d'email EST un sujet ; une conversation WhatsApp est un flux — décision du 2026-07-21

L'asymétrie ne s'arrête pas au discriminant : elle se lit **dans la clé elle-même**.

| Clé canonique | Ce qu'elle contient | Ce qu'est la conversation |
|---|---|---|
| `email:<interlocuteur>:<objet>` | la personne **et l'affaire** | **un sujet**, par construction |
| `wa-direct:<numéro>` | la personne **seule** | un flux, qui charrie des affaires successives |
| `wa-group:<chat_id>` | le groupe **seul** | un flux, qui charrie des affaires successives |

> ## 🔑 L'énoncé central
>
> **Un fil d'email EST un sujet.**
> **Une conversation WhatsApp est un FLUX ; la fenêtre et son ancre y FABRIQUENT l'objet que le médium ne fournit pas.**
>
> Tout ce qui suit — l'ancre, ses deux bornes, la réouverture, la pause — découle de cette seule phrase. Quand une règle paraît arbitraire, c'est ici qu'il faut revenir.

Un objet d'email **est déjà** une délimitation d'affaire, posée par l'expéditeur lui-même. Il n'y a **rien à découper**, et donc **rien à borner** : le lien entre une conversation email et son sujet est **1:1 et permanent**. Un fil WhatsApp direct n'a que la personne : il coule, indéfiniment, et mélange. C'est là — et **seulement** là — que la fenêtre doit fabriquer un objet, en posant des bornes que le médium ne donne pas.

> **Un groupe WhatsApp se comporte exactement comme un direct** (précision du 2026-07-20). La tentation est de voir dans le **nom du groupe** l'équivalent d'un objet d'email — « Chantier Narbonne », « Équipe Marne-la-Vallée ». C'est faux : un nom de groupe désigne un **collectif**, pas une **affaire**. Le groupe « Tasty Crousty Marne-la-Vallée » parlera successivement d'une livraison en retard, d'un planning de congés et d'un congélateur en panne — exactement le mélange que l'objet d'email évite. Le groupe est donc **ancré comme un direct**, sans exception ni règle particulière.

D'où le renversement de lecture :

> **L'ancre n'a jamais été un concept du modèle. C'est la PROTHÈSE d'un objet manquant.**
>
> Là où l'objet existe (email), **il n'y a AUCUNE notion de fenêtre** : le fil entier, passé et à venir, appartient au sujet, sans borne. Là où il manque (WhatsApp), la fenêtre est **indispensable** : sans elle, ouvrir un sujet embarquerait des mois de bavardage.

⚠️ **Correction du 2026-07-21.** La rédaction du 2026-07-20 parlait encore, côté email, d'une « fenêtre » dont l'ancre serait simplement nulle, et d'un sujet couvrant « tout le fil non encore couvert ». Les deux formulations sont **supprimées** : il n'y a **jamais** de second sujet sur un fil email, donc rien à « ne pas encore couvrir ». C'est **tout le fil**, littéralement, sans borne basse ni borne haute.

Et comme toute prothèse, elle est **temporaire**. Quand le pipeline IA (M7) saura découper un flux WhatsApp **par le sens**, il produira ce que l'objet d'email donne gratuitement — et l'ancre tombera, exactement comme la « fenêtre active » (cf. l'encadré ⚠️ de §9, qui la décrit déjà comme un échafaudage du mode manuel). Les deux sont le même échafaudage vu sous deux angles.

### Appartenance et statut sont deux choses distinctes — décision du 2026-07-21

C'est l'erreur qu'il ne faut pas refaire, et elle a été commise une fois : `closed_at` était décrit comme « la borne haute de la fenêtre », ce qui faisait **gouverner l'appartenance par le statut**.

| | Question posée | Ce qui y répond |
|---|---|---|
| **Appartenance** | *quels messages sont dans ce sujet ?* | les **ancres** (`anchor_message_id`, `closing_message_id`) — jamais le statut |
| **Statut** | *où en est cette affaire ?* | `Subject.status` (`ouvert` / `validé` / `fermé`) |

Les confondre produisait des effets absurdes : valider un sujet amputait silencieusement son périmètre, et un sujet ne pouvait plus être rouvert sans réécrire son appartenance. Les deux axes sont désormais **indépendants** (détail en §9 et `02-modele-donnees.md §6`).

### Ce qu'une conversation n'est pas

Elle **n'est jamais découpée par thème**. Découper un fil WhatsApp par sujet supposerait d'**inférer** le sujet — donc de faire intervenir l'IA à la réception. On y perdrait deux choses : le déterminisme (un message n'aurait plus de place garantie) et la stabilité de l'identité (une erreur d'inférence rangerait durablement un message au mauvais endroit, et le corriger reviendrait à déplacer des messages un à un — c'est-à-dire à faire, en plus compliqué, ce que le modèle fait déjà).

La conversation est la couche **transport et identité** ; le sujet est la couche **sémantique**.

### Où l'on diverge par canal — et où l'on NE diverge PAS

Forcer une UX unique sur l'email et sur WhatsApp est contre-productif : la **taille et la forme** des messages n'ont rien de commun, et le **système d'objet** n'existe pas dans WhatsApp. Le produit assume donc une divergence — mais **bornée**, et la borne est un principe, pas une préférence :

| | Commun aux deux canaux | Divergent par canal |
|---|---|---|
| Quoi | le **domaine** : ouverture de sujet, ancre, rattachement, détachement, ignorance, statuts | le **rendu** (bulles vs pleine largeur), les **gestes** (libellés, couleurs, tap) et la **granularité du signal d'appartenance** (cf. ci-dessous) |

### Où se pose le signal « ce fil est suivi par un sujet » — décision du 2026-07-20

Le **cordon** (un point de couleur par message, relié en trait continu) est le signal d'appartenance côté **WhatsApp**. Il n'a **pas d'équivalent par message côté email**, et ce n'est pas une perte : c'est une **conséquence directe du modèle**.

> Côté email, l'ancre est nulle et **tout le fil** appartient au sujet. Un signal posé sur chaque message serait donc **identique partout** — donc porteur d'**aucune information**. Un signal qui ne varie jamais n'est pas un signal, c'est du décor.

Le cordon garde tout son sens en WhatsApp précisément parce que l'appartenance y **varie d'un message à l'autre** : le cordon se brise, les couleurs alternent, et cette rupture *est* l'information.

La bonne granularité pour l'email est donc l'**en-tête de conversation** — un **bandeau « Suivi dans : *titre du sujet* »**, accompagné d'une **pastille de couleur du domaine** (`Folder`) et **cliquable vers la fiche du sujet**. Une conversation, un état, un signal.

> ⚠️ **Garde explicite.** Le jour où l'on duplique la **logique métier** « parce que l'email est différent », on aura **deux produits** à maintenir, et Relvo perdra ce qui fait sa valeur : réunifier des canaux dans une même fenêtre de travail. Un swipe peut changer de libellé et de couleur ; il ne doit **jamais** changer de fonction appelée. Le détail est en `02-modele-donnees.md §5bis` (décision du 2026-07-20).

### Le statut « ignoré »

Une conversation peut être **ignorée** : Relvo cesse alors d'analyser, de résumer et de trier ses messages. C'est le remède au « groupe WhatsApp bavard ». L'ignorance est **réversible, mais par le seul utilisateur** : c'est à lui de rouvrir la conversation s'il veut que Relvo la traite à nouveau.

> **Note historique.** Le modèle antérieur regroupait les messages **par contact, tous canaux confondus** : un même contact écrivant par email le lundi et par WhatsApp le mardi alimentait un fil unique. Ce regroupement était trop grossier — il ne séparait pas deux affaires distinctes menées avec la même personne. Un contact qui écrit par email puis par WhatsApp génère désormais **deux conversations**. La réunification entre canaux ne disparaît pas : elle **remonte d'un cran**, au niveau du sujet, qui peut agréger plusieurs conversations (décision du 2026-07-20).

## 4. La tâche est l'unité de travail du sujet

La logique du produit repose sur une idée simple :

> Un sujet avance parce que des tâches sont identifiées puis réalisées.

**La tâche est rattachée au sujet, pas à un utilisateur.** Elle matérialise une action nécessaire pour faire avancer le dossier, indépendamment de la personne qui finira par l'exécuter. En V1, un compte = un humain : c'est implicitement le titulaire du compte qui agit, ce qui rend la notion d'affectation inutile à ce stade. La coordination multi-utilisateurs (assigner une tâche à un membre de l'équipe spécifique) est repoussée en V2.

Une tâche peut être :

- proposée par Relvo, à partir du contenu disponible (message, et plus tard documents de connaissance)
- créée manuellement par l'utilisateur, à partir de son savoir métier

Cette distinction est importante : Relvo ne peut proposer que des actions déductibles du contenu disponible (par exemple "Confirmer ou refuser le remplacement", déductible du message reçu). Les tâches qui relèvent de la connaissance du terrain (par exemple "Appeler le shop de Montpellier" ou "Vérifier les stocks de Béziers") sont créées par l'utilisateur — Relvo ne sait pas, à la lecture d'un message seul, quels magasins sont impactés ni comment l'organisation interne est structurée.

Une tâche sert à matérialiser :

- ce qu'il reste à faire pour faire avancer le sujet
- ce qui a déjà été fait
- l'avancement réel du sujet

Dans l'interface, l'utilisateur manipule des **tâches**, qu'il peut conserver, supprimer, modifier ou cocher. La source de chaque tâche (Relvo ou utilisateur), portée par le champ `source_actor`, est toujours visible via une pastille `✦ Relvo` ou `Moi`. Cette information reste lisible jusqu'à l'archivage du sujet — c'est un attribut historique permanent.

## 5. Relvo aide à la décision et à l'exécution

> **Note de nommage.** « Relvo » est le nom donné à l'assistant IA intégré au produit. Dans l'interface, on l'appelle **Relvo** (« Relvo a préparé un brouillon… »), pas « l'IA ». Dans la documentation technique (notamment `04-ia.md`) et le modèle de données, on conserve « IA » et la valeur d'enum `Actor = ai` pour rester neutre. Le triptyque d'acteurs s'écrit donc **Moi / Relvo / Externe** côté UI, et `user / ai / contact` côté modèle.

### Aide à la décision

Relvo lit le message et propose des tâches pertinentes, dans la limite de ce que le contenu du message permet de déduire.

### Aide à l'exécution

Relvo peut préparer certaines actions concrètes, en particulier :

- une réponse préremplie (brouillon)
- avec destinataire, canal et contenu déjà préparés

Le brouillon est présenté directement dans la zone de rédaction du message, clairement identifié comme **« Suggestion de Relvo — modifiez librement avant d'envoyer »**. L'utilisateur peut l'éditer librement avant envoi, le régénérer, ou l'effacer pour écrire de zéro.

Relvo ne remplace pas l'utilisateur, il :

- structure le travail
- prépare des exécutions
- réduit la charge mentale

### Acquittement implicite des suggestions

Le produit fait un choix de **légèreté maximale** : aucune validation explicite à donner aux suggestions de Relvo. Le simple fait d'ouvrir la fiche d'un sujet vaut acquittement de toutes les suggestions présentes — tâches proposées, brouillon de réponse, suggestion de résolution. L'utilisateur agit ensuite naturellement (cocher, modifier, supprimer) à son rythme. Sur les listes (Dashboard, Sujets), le badge « ✦ N tâches suggérées » disparaît dès que l'utilisateur a ouvert le sujet. Cf. `04-ia.md §8` pour le détail.

## 6. L'action est une exécution concrète dans l'interface

Il faut bien distinguer :

### Task

Ce qu'il faut faire.

### Action

L'opération concrète exécutée dans l'outil.

En V1, l'action principale est surtout : **envoyer un message**.

Une tâche comme "Répondre au fournisseur" peut donner lieu à une action :

- ouverture du composer
- envoi effectif du message

L'action n'est pas la tâche. Elle est le **mécanisme d'exécution** de certaines tâches.

## 7. Tout ce qui se passe alimente un journal de bord

Le produit est vivant :

- des messages arrivent
- des tâches sont créées
- des tâches sont cochées
- des actions sont exécutées
- le sujet change d'état

Tout cela produit des **LogEvents**.

Chaque événement est identifié selon deux dimensions :

- **Le type d'événement** : message, tâche, action, changement de statut
- **L'acteur** : **Moi** (l'utilisateur), **Relvo** (l'assistant IA), ou **Externe** (le monde extérieur — contacts, fournisseurs, etc.)

Ce triptyque **Moi / Relvo / Externe** structure la lecture de l'activité dans toute la plateforme. Il permet de comprendre d'un coup d'œil qui agit dans le système et de filtrer l'activité par voix.

> Côté modèle de données, ces trois acteurs correspondent aux valeurs du type partagé `Actor = user | ai | contact | system` (cf. `02-modele-donnees.md §0`). « Relvo » est le nom de produit pour `ai`.

Le journal de bord permet :

- d'alimenter la timeline du sujet
- d'alimenter la page Activité dédiée
- de garder une trace claire de l'historique

## 8. La chaîne centrale du produit

L'épine dorsale du projet est la suivante :

> **Message → Conversation → Subject → Task → Action → LogEvent**

### Message

Révèle une situation ou un besoin.

### Conversation

Range le message dès sa réception, selon un discriminant déterministe propre au canal. Durable : elle ne se termine pas.

### Subject

Donne un sens métier à un ensemble de messages : **tout** un fil d'email, ou une **fenêtre** découpée dans un flux WhatsApp (cf. §3).

### Task

Formalise ce qu'il faut faire.

### Action

Permet d'exécuter concrètement une partie du travail.

### LogEvent

Trace ce qui s'est passé.

> **Note historique.** La chaîne s'écrivait `Message → Task → Action → LogEvent` : le message se rattachait directement au sujet, et le regroupement était refait à chaque création de sujet. L'insertion de **Conversation** (rangement déterministe à la réception) et de **Subject** (fenêtre de travail) rend explicite ce qui se jouait implicitement entre les deux (décision du 2026-07-20).

## 9. Cycle de vie d'un sujet — une fenêtre de travail

Un Sujet est un **espace de travail ouvert sur des conversations**. On l'**ouvre**, on l'utilise, on le **ferme**. La conversation, elle, existe avant, pendant et après.

La métaphore de la **fenêtre** — un début, une fin, un périmètre découpé dans un flux — vaut **côté WhatsApp** (cf. §3). **Côté email elle ne s'applique pas** : le fil *est* le sujet, entier et pour toujours, il n'y a rien à cadrer. On dira donc « fenêtre » quand on parle d'une conversation WhatsApp, et simplement « sujet » quand on parle d'un fil email (précision du 2026-07-21).

Le vocabulaire est délibéré : on ne « crée » ni ne « supprime » un sujet, on l'**ouvre** et on le **ferme**.

### Ouvrir un sujet : UNE seule primitive, à ancre optionnelle

> **Décision du 2026-07-21 — une primitive, pas deux.** Le domaine expose **une seule** fonction : *ouvrir un sujet **sur une conversation**, avec une ancre **OPTIONNELLE***.
>
> - **ancre nulle** → le sujet couvre **tout le fil** ;
> - **ancre posée** → le sujet part **de cette ancre**.
>
> ⚠️ **La logique métier teste l'ANCRE, jamais le canal.** C'est exactement la garde déjà écrite plus haut : *le canal décide du geste, jamais de la fonction appelée*. Un `if (channel === 'email')` dans le domaine est le premier pas vers deux produits.

**Le point d'entrée est TOUJOURS la conversation, jamais le message** (décision du 2026-07-21). On ouvre un sujet **depuis une conversation**. Côté WhatsApp, le tap sur un message reste disponible pour **désigner l'ancre** — il ne crée pas un autre chemin d'ouverture, il renseigne un paramètre. Côté email, il n'y a **pas de tap sur un message**.

Ce que le canal détermine, c'est donc uniquement **quelle valeur d'ancre le geste transmet** :

| | **email** (conversation `objet`) | **WhatsApp** (`direct` / `groupe`) |
|---|---|---|
| Ancre transmise | **aucune** (`null`) | le **message de départ** (défaut : le dernier message reçu) |
| Ce qui appartient au sujet | **tout le fil**, passé **et à venir**, sans borne | les messages **à partir de l'ancre**, jusqu'à l'éventuelle borne de fin |
| Lien conversation ↔ sujet | **1:1 et permanent** | fenêtre, ajustable et refermable |
| Ouvrir un sujet depuis un **message** | **impossible** | le tap **désigne l'ancre**, il n'ouvre pas un second chemin |

⚠️ **Ouvrir un sujet sur une conversation email balaie le fil ENTIER, en amont comme en aval.** Un échange de six emails déjà reçus doit produire un sujet portant les **six** messages, pas le dernier. L'objet a déjà délimité l'affaire ; il n'y a aucune raison d'en amputer le début.

**Le swipe droite ne *crée* pas le lien : il DÉCLARE que ce fil mérite d'être suivi.** Tous les fils email ne sont pas des affaires — une newsletter, un accusé de réception, un démarchage n'ont pas à devenir des sujets. Le geste de l'utilisateur ne fabrique donc pas une correspondance qui n'existerait pas, il **reconnaît** celle que l'objet a déjà posée. C'est M7 qui prendra cette décision à sa place, plus tard.

Côté WhatsApp — **directs et groupes indifféremment** (cf. §3) — le message d'ancrage marque le début du sujet : les messages **antérieurs** restent dans la conversation sans lui appartenir.

### Deux bornes, et deux gestes d'extinction qu'il ne faut pas confondre (2026-07-21)

Une fenêtre WhatsApp a **un début** (l'ancre) et peut recevoir **une fin** (`closing_message_id`, cf. `02-modele-donnees.md §6`). L'un et l'autre désignent **un message**, jamais une date.

| Geste | Effet sur l'alimentation | Ancre de fin |
|---|---|---|
| **Ignorer la conversation** | **PAUSE** — le sujet cesse d'être alimenté par cette conversation | **aucune** ancre de fin n'est posée |
| **Valider** ou **fermer le sujet** | **FIN** — le cordon se referme sur le dernier message reçu | **posée** |

**Pourquoi cette distinction est indispensable.** Ignorer une conversation est **réversible** (cf. §3) : la réactiver doit faire **reprendre** l'alimentation du sujet. Si l'ignorance posait une ancre de fin, réactiver ne servirait à rien — la fenêtre serait déjà refermée et la réactivation n'aurait aucun effet observable. On distingue donc « **je n'écoute plus cette source pour l'instant** » de « **cette affaire est terminée** ».

### Un sujet email se ROUVRE à la réception d'un nouveau message (2026-07-21)

Un nouvel email de même objet et de même interlocuteur rejoint **toujours** son sujet — et le fait **repasser en `ouvert`** s'il était `validé` ou `fermé`.

**Pourquoi.** De l'activité sur une affaire signifie que l'affaire est **vivante** : la déclarer close pendant que l'interlocuteur continue d'écrire ne décrit plus la réalité. Et l'appartenance ne dépend pas du statut (cf. §3) : le message serait de toute façon dans le sujet — autant que le statut le dise.

> **Un seul mécanisme d'extinction, pas deux qui se ressemblent.** Le **seul** geste qui fait durablement taire un fil est **d'ignorer la conversation**. Si la validation faisait *aussi* taire le fil, l'utilisateur aurait deux gestes voisins aux effets subtilement différents, et ne saurait jamais lequel employer.

**Le défaut, quand l'utilisateur ne désigne pas d'ancre (swipe droite), est le DERNIER message. Toujours.** Pas de calcul, pas d'exception, pas de borne temporelle.

> **Pourquoi un défaut aussi bête.** On avait d'abord écrit une règle savante (« le plus ancien message non couvert, borné par la fenêtre précédente », plus une exception pour les conversations vierges). Elle était **juste plus souvent** — et **prévisible jamais**. Or l'utilisateur ne compare pas le défaut à l'idéal : il compare **ce qu'il attendait** à ce qu'il obtient. Un défaut qu'on ne peut pas anticiper produit une surprise à chaque swipe, même quand il tombe juste ; un défaut trivial (« ça part d'ici, du dernier message ») s'anticipe sans y penser et se corrige d'un geste (cf. la poignée d'ancre ci-dessous).
>
> **Un défaut simple et prévisible, corrigé à la main quand il se trompe, vaut mieux qu'une règle savante que personne ne peut anticiper.** C'est aussi la seule règle qui ne casse pas sur un fil vieux de deux ans.

L'ancre est ensuite **visible et saisissable** depuis le sujet : le **nœud de départ du cordon est une poignée** que l'on **attrape et fait glisser** vers le haut ou vers le bas — la remonter fait entrer les messages antérieurs, la descendre les fait sortir. C'est le mécanisme de correction du défaut (détail en `03-cas-usage.md`, cas T).

Dans les deux cas, tant que le sujet reste ouvert, les **nouveaux messages de la conversation lui sont rattachés automatiquement**. L'ancrage est donc une **règle d'affectation par défaut, pas une définition** : l'appartenance réelle se décide **message par message**, et l'utilisateur — plus tard Relvo — peut détacher ou déplacer un message à la marge. C'est ce qui permet de traiter des sujets **entrelacés** dans un même fil, cas impossible à représenter avec une simple fenêtre temporelle (cf. §3).

Règles associées :

- **Au plus un sujet ouvert par conversation** — règle métier V1. Sans IA capable de trancher, une conversation n'a qu'une fenêtre ouverte à la fois, ce qui rend la destination d'un nouveau message non ambiguë. **Le modèle, lui, en supporte plusieurs** (cf. encadré ci-dessous).
- Si le message d'ancrage est **détaché**, l'ancre **glisse** au message suivant du sujet *(WhatsApp uniquement — une conversation email n'a pas d'ancre à faire glisser)*.
- Rattacher un message **isolé** à un autre sujet **ne déplace pas** la fenêtre active : seule l'ouverture d'un sujet pose une ancre.

> **Plusieurs sujets SIMULTANÉS sur une même conversation — écarté de la V1 (2026-07-21).**
>
> L'hypothèse est **mise de côté**, et cela ne coûte rien : `SubjectConversation` est **déjà** une table de liaison plusieurs-à-plusieurs, donc le schéma l'autorise depuis le premier jour. Ce qui l'interdit n'est qu'une **règle métier**, levable **sans migration**.
>
> Le jour où on la lève, il n'y a que du **rendu** à faire — aligner plusieurs cordons horizontalement dans la conversation — et **aucune donnée à reprendre**.
>
> Le cas jugé le plus probable, lui, **fonctionne déjà** : des sujets **successifs** sur un même fil, sans chevauchement, sont simplement des **fenêtres disjointes** sur le même flux, exprimées par la paire début/fin (`anchor_message_id` / `closing_message_id`).

> ⚠️ **La « fenêtre active » est un échafaudage du mode manuel, pas une règle métier durable.**
>
> Elle n'existe que pour une raison : tant qu'aucune IA ne sait à quel sujet appartient un message, il faut bien une règle mécanique pour que les messages successifs d'une conversation atterrissent au même endroit. Quand le pipeline IA (M7) arrivera, **c'est lui qui décidera**, message par message — et cette règle sera **remplacée**, pas complétée.
>
> C'est écrit ici parce que ce genre de règle se fossilise : sans cette note, quelqu'un lira « au plus un sujet actif par conversation » comme une contrainte du domaine et cherchera à la préserver, alors que tout le modèle a été conçu pour qu'elle puisse **disparaître sans migration**. L'appartenance vit sur le message (`subject_id`), jamais sur la conversation — c'est précisément ce qui rend l'échafaudage démontable.
>
> **L'ancre est le même échafaudage** (ajout du 2026-07-20). Elle n'est pas un concept du domaine : c'est la **prothèse d'un objet manquant** (cf. §3). La preuve tient en une observation — là où l'objet existe (email), l'ancre est **nulle** et personne ne s'en aperçoit ; là où il manque (WhatsApp), elle est indispensable. Le jour où M7 saura découper un flux par le sens, il fera ce que l'objet d'email fait gratuitement, et l'ancre **tombera** — sans migration, `anchor_message_id` étant déjà nullable.

### Un sujet agrège 0, 1 ou n conversations

- **0** — un sujet sans échange, purement personnel : une liste de tâches (« Préparer l'inventaire »).
- **1** — le cas courant : une fenêtre ouverte sur un fil de groupe ou sur un objet d'email.
- **n** — le sujet s'étend : parti d'un fil WhatsApp (« Retard livraison sauce blanche »), l'utilisateur écrit **par email** à son fournisseur pour la même affaire. Le sujet porte alors deux conversations, **chacune avec le régime d'ancre de son canal** — ancre posée côté WhatsApp, ancre nulle côté email (le fil email entier appartient au sujet).

C'est à ce niveau — et non plus au niveau de la conversation — que se fait la **réunification entre canaux**.

### Les statuts : 3 états exclusifs

- **`ouvert`** — état par défaut, posé à l'ouverture. **Invisible** (aucun badge) : un état porté par la quasi-totalité des sujets n'informe pas. On lit « ouvert » par l'**absence** de badge.
- **`validé`** — le travail est fait. Clos via **« Valider »** (swipe droite, vert).
- **`fermé`** — le sujet n'avait pas lieu d'être, ou n'intéresse pas l'utilisateur. Clos via **« Fermer »** (swipe gauche, rouge).

**Ce que « valider » ou « fermer » fait à l'appartenance dépend du canal — et de lui seul** (précision du 2026-07-21) :

- **WhatsApp** — une **ancre de fin** est posée sur le dernier message reçu : le cordon se **referme**, les messages suivants n'appartiennent plus au sujet, et la conversation **redevient orpheline**. Les fenêtres successives sur un même flux sont donc **séquentielles et sans chevauchement**.
- **Email** — **rien ne change à l'appartenance** : le lien est 1:1 et permanent, le fil reste entièrement dans son sujet, et un nouveau message **rouvre** le sujet (cf. ci-dessus). Le statut dit seulement où en est l'affaire.

> ⚠️ **Formulation retirée le 2026-07-21 : « les deux transitions terminales figent la fenêtre ».** Elle était vraie pour WhatsApp et fausse pour l'email, où il n'y a pas de fenêtre à figer. Elle reposait sur `closed_at` comme borne d'appartenance — c'est précisément ce qui vient d'être supprimé (cf. §3, « appartenance ≠ statut »).

À la fermeture, Relvo propose : « **Souhaitez-vous aussi ignorer la conversation ?** » — c'est le geste qui empêche un fil bavard de reproposer indéfiniment de nouveaux sujets. L'ignorance vit désormais sur la **conversation** (cf. §3), pas sur le sujet : ce n'est pas un sujet qu'on veut faire taire, c'est une **source**.

> **Note historique.** Le cycle comptait 4 états : `acknowledged`, `resolved`, `archived`, `ignored`. **`archived`** (automatique après inactivité) est retiré : il n'exprimait rien qu'une fermeture n'exprime déjà. **`ignored`** est retiré du sujet et **migre sur la conversation**. Le vocabulaire « créer / supprimer / terminer / ignorer » devient « **ouvrir / fermer / valider** » (décision du 2026-07-20).

### Les marqueurs d'état : cumulables, indépendants du statut

Ce que l'ancien modèle appelait `to_do`, `waiting`, `unread` n'étaient pas des étapes de vie mais des **états instantanés** qui peuvent coexister. Ils deviennent des **marqueurs**, plusieurs à la fois sur une même carte :

- **Nouveau** — sujet **jamais ouvert** (dérivé : `last_opened_at == null` sur un sujet ouvert). Ouvrir la fiche pose `last_opened_at` → le marqueur s'éteint (le statut, lui, reste `ouvert`).
- **Urgent** — drapeau rouge, levé uniquement si `priority = urgent` (la rareté est le signal : 1-2 sujets sur 24).
- **À faire** — il reste au moins une tâche ouverte (dérivé des `Task`).
- **En attente** — on attend un retour d'un tiers ; flag `waiting_for_reply` posé par Relvo.

Exemple qui prouve la séparation : un sujet **ouvert** (statut) peut afficher en même temps 🔴 Urgent + « À faire » — impossible à représenter dans un enum exclusif.

**Le non-lu a quitté le sujet pour la conversation.** La pastille compteur (façon WhatsApp) se lit sur la **conversation**, pas sur le sujet : c'est là que les messages arrivent, et c'est l'ouverture de la **conversation** — non celle du sujet — qui marque un message comme lu. Un sujet peut être ouvert depuis longtemps pendant que sa conversation accumule des non-lus.

> **Note historique**. Les statuts `blocked` (« impossible à avancer »), puis `to_do` / `waiting` / `unread`, et enfin **`new`** (décision du 2026-06-27), ont été retirés du cycle de vie : le premier se réduisait à une attente externe, les autres sont en réalité des marqueurs cumulables, pas des étapes exclusives. « Nouveau » est désormais un marqueur dérivé (`last_opened_at == null`). Le marqueur **Non-lus** a migré du sujet vers la conversation le 2026-07-20. Cf. CLAUDE.md §7.

## 10. Relvo aide aussi à prendre du recul

> **Note de scope V1**. Ce principe décrit la vision complète. En V1 la **page Activité standalone est reportée en V2**. Seule une partie de la vue d'ensemble (KPIs essentiels) est portée sur le bandeau de l'**Accueil**. La courbe d'évolution sur 8 semaines, la « charge actuelle vs capacité », et le fil chronologique des `EventLog` arrivent en V2. Les questions analytiques transversales (« comment se passe ma semaine ? ») restent accessibles dans le chatbot via les tools `get_kpis` et équivalents (cf. `04-ia.md §11`).

Relvo n'est pas qu'un outil de gestion de l'urgence. Il sert aussi à **mesurer l'efficacité dans la durée** et à rendre visible la valeur que l'assistant apporte. C'est important pour deux raisons :

- pour l'utilisateur, c'est l'occasion de constater concrètement si la charge mentale baisse et si l'organisation s'améliore avec le temps ;
- pour le produit, c'est la preuve continue que Relvo apporte de la valeur — sans cette visibilité, on perd vite confiance en un assistant.

### Page Activité — vue d'ensemble (V2)

La page Activité contient deux registres distincts, empilés :

1. **Vue d'ensemble** (en haut) — le recul long terme :
   - **KPIs avec variations** vs période précédente : sujets résolus, délai moyen de résolution, charge actuelle (vs capacité estimée), **% des tâches issues d'une suggestion de Relvo**.
   - **Courbe d'évolution** sur 8 semaines (paramétrable jusqu'à 12 mois) : sujets ouverts vs sujets résolus. Permet de repérer les pics, et de constater si le pipeline se résorbe ou s'accumule.
   - **Bénéfices Relvo · 7 derniers jours** : tâches suggérées (avec taux d'adoption), brouillons préparés, pièces jointes étiquetées, temps estimé économisé.

2. **Activité récente** (en bas) — le fil chronologique des `EventLog` avec triptyque, déjà décrit au principe 7. C'est la lecture temps réel.

### Le KPI structurant : le « % d'aide Relvo »

Le pourcentage de tâches issues d'une suggestion de Relvo (vs créées manuellement) est le KPI le plus parlant pour matérialiser la valeur ajoutée. Il est mis en évidence visuellement (card violette) sur la Vue d'ensemble. Plus ce ratio est élevé, plus Relvo a réellement allégé le travail de l'utilisateur — sans pour autant invalider les tâches métier que seul l'utilisateur peut créer (cf. principe 4).

### Capacité estimée et charge actuelle

Pour aider l'utilisateur à se situer, Relvo affiche sa **charge actuelle** (nombre de sujets ouverts) face à sa **capacité estimée** (par défaut une cible définie ensemble, ex. ~30 sujets simultanés). Une mini-barre de progression dans la KPI card matérialise le ratio : en-dessous de 70 % c'est confortable, entre 70 et 90 % c'est tendu, au-dessus c'est de la surcharge. La capacité est ajustable dans les paramètres et apprend des données dans le temps (V2).

## 11. Le calendrier matérialise la dimension temporelle des tâches

Une tâche n'est pas seulement « ce qu'il faut faire pour faire avancer un sujet » (principe 4), c'est aussi quelque chose qui se positionne dans le temps. Relvo expose cette dimension à travers un modèle de date riche et deux surfaces calendaires complémentaires.

### Modèle de date d'une tâche

Une tâche peut avoir une **deadline** (date à laquelle elle doit être faite, optionnellement horodatée) et, indépendamment, une **durée** (plage de plusieurs jours ou créneau horaire). La deadline vit dans `start_date` / `start_time` ; la durée s'exprime via `end_date` / `end_time`. La sémantique précise est documentée dans `02-modele-donnees.md §9`.

Quatre cas couvrent l'essentiel des situations :

- **Aucune date** — pile « Aucune date », tâche en attente de planification
- **Deadline jour** — tâche à faire ce jour-là
- **Deadline horodatée** — rendez-vous, créneau ponctuel
- **Plage** — salon, déplacement, créneau de réunion

### Deux surfaces calendaires

1. **Vue semaine sur l'Accueil** — widget compact intégré au brief de l'Accueil, lun → dim de la semaine en cours. Affiche les tâches groupées par jour avec un code couleur par **Dossier**. Permet de comprendre en un coup d'œil ce qui se joue dans la semaine. Une pile « Aucune date » est accessible en marge.

2. **Page Planning dédiée — vue mois** — page **hors-nav**, accessible via le lien « Vue mois complète → » du widget calendrier semaine de l'Accueil. Grille mensuelle classique avec navigation mois précédent / suivant / « Aujourd'hui ». Les tâches multi-jours sont rendues comme des barres qui s'étalent. Click sur une tâche → ouvre la fiche du sujet correspondant.

### Drag-and-drop pour replanifier

Sur les deux surfaces, l'utilisateur peut faire glisser une tâche pour la replanifier sur un autre jour. C'est l'interaction principale pour ajuster son planning au fil de l'eau. Le drag-and-drop modifie `start_date` (et `end_date` proportionnellement si la tâche s'étalait).

### Rôle de Relvo

À la création d'une tâche, Relvo tente d'extraire ou de proposer une date à partir du contenu disponible (cf. `04-ia.md §2.5`). Si rien n'est extractible, la tâche est créée sans date — l'utilisateur la planifiera lui-même depuis la pile « Aucune date » ou directement depuis la fiche du sujet.

## 12. Les Dossiers regroupent affaires en cours et connaissances métier

Relvo ne lit pas que les messages entrants. Il s'appuie aussi sur une **base de connaissances** propre au compte, alimentée par l'utilisateur, qui lui permet de proposer des tâches plus contextualisées, des brouillons plus justes, et des réponses plus précises dans le chatbot. C'est ce qui transforme Relvo d'un assistant générique en un **assistant qui connaît votre métier**.

Côté UI, cette base de connaissances **n'a pas sa propre page**. Elle vit à l'intérieur des **Dossiers** (entité technique `Folder`, cf. `02-modele-donnees.md §2`), aux côtés des Sujets du même périmètre. Un Dossier (Fournisseurs, RH, Juridique…) contient ainsi à la fois les affaires en cours et la connaissance qui sert à les traiter.

**Nommage UI — « Mémoire » (icône cerveau).** L'entrée de navigation ne s'appelle plus « Mes dossiers » mais **« Mémoire »** : « Dossiers » évoque la bureautique Microsoft/Google, alors que « Mémoire » dit *agent*. L'utilisateur comprend qu'il **enrichit la mémoire de son assistant** — comme si Relvo absorbait la connaissance. Chaque Dossier est présenté comme **« un domaine de la mémoire de Relvo »**, structuré en **3 onglets** : **Instructions** (les notes — consignes que Relvo applique), **Documents** (les fichiers — PDF/images que Relvo lit), **Sujets** (l'historique d'activité). La page reste courte quel que soit le volume : on **interroge** la mémoire via le composer Relvo plutôt que de scroller une liste infinie (scroll infini pour parcourir).

### Pourquoi un Dossier unifié

Le mental modèle est celui d'un **classeur physique** : tu ouvres ton dossier « Fournisseurs », tu y trouves les affaires en cours (ces Sujets ouverts avec Karim, avec PackPlus…) et les documents de référence (le contrat-type, la procédure de validation des devis, ta note sur les marottes de chacun). C'est l'unité de classement métier la plus intuitive pour des utilisateurs non rompus aux SaaS — un Dossier, c'est concret.

Côté modèle, c'est l'entité `Folder` qui porte ce regroupement. `Subject.folder_id` et `KnowledgeDocument.folder_id` pointent tous deux vers un Folder.

### Le Folder « Général » — uniquement documentaire

Un Folder spécial nommé **« Général »** est auto-créé à la création du compte. À la différence des Dossiers métier, il est **purement documentaire** — il ne contient jamais de Sujets, uniquement des `KnowledgeDocument`. Sa raison d'être : accueillir les **Connaissances transversales** (organigramme, charte rédactionnelle, ton de réponse) — les documents qui doivent être chargés dans le contexte de tous les Sujets, peu importe leur Folder. C'est la « mémoire générale » de Relvo.

Côté UI, sa fiche affiche un en-tête explicite (« Connaissances transversales — ce que Relvo sait de toi en général ») et masque la section Sujets pour ne pas créer de confusion. Si Relvo ne sait pas dans quel Dossier métier classer un nouveau Sujet, le Sujet reste en mode « sans dossier » dans Mon fil (avec un badge discret et une suggestion Relvo « Range-moi dans X ? »), il n'atterrit **pas** dans Général.

### Deux natures de documents

Les `KnowledgeDocument` se déclinent en deux formes complémentaires, identifiées par le champ `kind` :

- **Documents (`kind = file`)** — PDFs, images, documents uploadés (libellé UI : **« Documents »**). Sources de référence figées : organigrammes, factures-types, devis-types, contrats fournisseurs, charte tarifaire. **Non modifiables** dans l'application (suppression seule). En V1, l'utilisateur peut **glisser-déposer** un PDF directement dans la fiche d'un Dossier. Relvo décide de chaque fichier s'il l'**absorbe** (badge « ✦ lu ») ou l'**écarte** (« ignoré » — un transactionnel sans valeur de référence).
- **Instructions (`kind = note`)** — texte Markdown rédigé directement dans l'app (libellé UI : **« Instructions »** — on n'écrit pas un mémo, on *instruit son agent*). **Mémoire vivante** que l'utilisateur écrit et fait évoluer dans le temps : règles internes, ton de réponse, liste des magasins, particularités d'un fournisseur, lessons learned. Exactement le pattern d'un fichier `.md` qu'on ajoute à Claude Code pour enrichir le contexte.

La distinction des deux formes est importante : les fichiers sont des **références** auxquelles on se fie, les notes sont une **mémoire** qu'on façonne. La sensation de contrôle vient des notes — elles donnent à l'utilisateur la maîtrise de ce que Relvo « sait ».

### Édition des notes — V1 et V2

- **V1** — seul l'utilisateur édite les notes. Relvo les **consulte** mais ne les modifie pas.
- **V2** — Relvo peut **proposer** des modifications à une note (« J'ai remarqué que tu ajoutes souvent des tâches sur Montpellier — veux-tu que j'ajoute ce magasin à ton organigramme ? »), à valider par l'utilisateur, selon le même mécanisme d'acquittement que les suggestions de tâches (cf. principe 5).

### Citations — pour rendre Relvo auditable

Quand Relvo propose une tâche ou un brouillon en s'appuyant sur un document de la base, il peut indiquer la **source** : « Suggéré à partir de *Procédure fournisseurs v3* ». Cette traçabilité est essentielle pour la confiance — sans elle, la base de connaissances devient une boîte noire.

En V1 le mécanisme est activé techniquement (l'API d'Anthropic supporte les citations nativement) et l'affichage UI reste minimal (un petit lien « Source » discret). L'enrichissement de l'expérience citations (panneau latéral, surlignage dans le document source) est V2.

### Points d'entrée pour ajouter un document

1. **Depuis la fiche d'un Dossier** — bouton « + Ajouter un fichier » / « + Créer une note », ou glisser-déposer un PDF directement dans la fiche.
2. **Depuis le chatbot (drawer)** — l'utilisateur peut demander à Relvo de créer une note avec un contenu dicté (`create_knowledge_note` côté tools, cf. `04-ia.md §11.6`).

## 13. Relvo est central : la conversation est le lieu par défaut (mobile-first)

> **Réécriture — virage produit du 2026-06-16.** La version antérieure de ce principe décrivait une app **desktop-first** où Relvo vivait dans un **drawer latéral secondaire** (~40 % de largeur, bouton flottant) posé par-dessus des écrans de consultation, avec une navigation par **sidebar 4 entrées**. Ce modèle est **abandonné**. Deux constats l'ont fait tomber : (1) le profil cible (dirigeants food/bâtiment) vit sur **téléphone** et ne connaît pas les codes des SaaS bureautiques — une sidebar de bureau leur est étrangère ; (2) ces mêmes utilisateurs sont **à l'aise avec ChatGPT/Claude** — leur mental model natif est la **conversation**. On inverse donc la hiérarchie : **Relvo (la conversation) devient la surface par défaut**, et les écrans structurés deviennent ce que l'agent *fait apparaître* ou ce vers quoi on *navigue*. Conséquences techniques (drawer → surface plein écran, sidebar → barre d'onglets, responsive mobile-first) détaillées dans `../spec/ux-mobile-first.md`.

### Posture : mobile-first, agent au centre

Deux invariants gouvernent désormais toute l'UI :

1. **Mobile-first.** Chaque écran est conçu d'abord pour un **téléphone tenu à une main** : colonne unique, cibles tactiles, navigation au pouce. Le desktop est un **enrichissement progressif** (la colonne unique s'élargit, des panneaux latéraux optionnels apparaissent) — jamais le point de départ.
2. **L'agent est central.** « L'UI sert à accéder à l'info, **Relvo sert à agir** » : la conversation n'est plus un add-on, c'est **le lieu par défaut**. L'utilisateur ouvre l'app et il est, de fait, déjà en train de parler à Relvo.

### Le modèle hybride : un Accueil qui est à la fois brief et conversation

L'**Accueil** fusionne deux rôles autrefois séparés (le *brief* matinal et la *conversation*). C'est la page d'atterrissage à la connexion, et elle contient :

- En haut, le **brief** que Relvo prépare — un guide de 30 secondes qui répond à « qu'est-ce qui m'attend ? ». Rendu sous forme de **cartes** empilées en colonne unique : un **bandeau KPIs** (Sujets ouverts, Messages à trier, Tâches du jour, % d'aide Relvo), un **aperçu d'agenda** (les tâches des prochains jours, lien vers Planning), et les **2-3 sujets prioritaires** (`SubjectCard`, lien « Voir tout » vers Mon fil).
- L'accès à Relvo se fait par un **bouton Relvo en haut à droite du header** (cf. note 2026-06-27 ci-dessous). On lit le brief **et** on ouvre la conversation depuis la même page, sans changer d'écran.

> **⚠️ MISE À JOUR 2026-06-27 — accès Relvo : du bas vers le header.** Le **composer chat persistant** du bas (« Demander à Relvo… ») est **abandonné** (encombrement, hidden-menu d'auto-masquage, confusion avec le composer destinataire d'un Sujet). Désormais l'entrée vers la conversation est un **bouton Relvo en haut à droite du header violet** (même forme que l'ancien ✦), présent sur toutes les vues, page-aware. La **barre d'onglets basse devient fixe, sur fond violet**. Les mentions « composer en pied de page » de ce §13 sont caduques sur ce point.

Le brief n'est donc plus une page muette : c'est **le premier tour de parole de Relvo**, et l'utilisateur peut enchaîner par une question ou une demande d'action immédiatement.

### La conversation : surface plein écran, accessible partout

Quand l'utilisateur engage le dialogue, la conversation occupe **tout l'écran** (sur mobile) — plus un drawer 40 %. C'est là qu'il **dialogue**, **demande des actions**, **creuse** un sujet. Toutes les opérations action-capable y passent.

La conversation est **accessible depuis n'importe quelle vue** : chaque écran porte une entrée vers Relvo — le **bouton Relvo en haut à droite du header** (cf. note 2026-06-27) — qui transmet le **contexte de la page courante** (`?from=`). Plus de bouton flottant 🤖 ni de composer persistant en pied de page : l'accès à Relvo est intégré au header de chaque page, pas posé par-dessus.

### Generative UI : Relvo rend les mêmes composants que l'UI

Puisque l'agent est central, ses réponses ne sont pas que du texte : Relvo **rend les composants structurés du produit directement dans le fil** — `SubjectCard`, `TaskCard`, mini-calendrier, badge de statut. Demander « montre-moi mes sujets urgents » fait apparaître de vraies cartes cliquables, pas une liste à puces. C'est le « bloc visuel » de l'action-capable (cf. plus bas) élevé au rang de **langage de rendu principal**. Les mêmes composants servent dans les vues plein écran et dans la conversation — une seule bibliothèque, deux surfaces.

### Les vues structurées : des destinations en colonne unique

Les écrans de consultation/traitement (**Mon fil**, **Sujet**, **Mémoire**, **Planning**, **Messages**, **Contacts**) existent toujours — pour la lecture profonde et le travail soutenu — mais deviennent des **destinations**, atteintes via une carte du chat ou via la **navigation par onglets**. Tous sont repensés **mobile-first**, en colonne unique (fini les split-views 2 colonnes, tables 7 colonnes et panneaux droits 340px fixes).

- **Sujets** reste l'espace de **traitement** : feed de cartes-sujets enrichies, organisé en **2 onglets de statut** — **Ouverts** (urgents en tête) et **Validés**. Sur chaque carte, deux gestes de **swipe** : **Fermer** (gauche, rouge → `status = fermé`) et **Valider** (droite, vert → `status = validé`). C'est l'« inbox structurée par sujets ».
- **Conversations** est l'espace de **tri**, et il reste **hors navigation** : on y accède par le **KPI « Sans sujet »** de la page Sujets. Non-lus en tête, swipe gauche = **Ignorer la conversation**. C'est **depuis une conversation** — jamais depuis un message — qu'on **ouvre un sujet** (cf. principe 9, décision du 2026-07-21).
- La **navigation** se fait par une **barre d'onglets basse**, pas une sidebar : **4 entrées** — **Actions** ✅ (les tâches du jour), **Sujets** 📥, **Mémoire 🧠** (cf. principe 12), **Réglages** ⚙️. Planning, Contacts et **Conversations** sont **hors-nav**, atteints depuis ces écrans.

> **⚠️ MISE À JOUR 2026-07-20 — la page Messages devient Conversations.** La pile de messages orphelins **disparaît** au profit de la liste des **conversations**, atteinte par le même point d'entrée qu'avant : le **KPI « Sans sujet »**. Ce KPI ne compte plus des messages mais des **conversations dont le dernier message n'est rattaché à aucun sujet** — c'est-à-dire celles qui **peuvent solliciter l'utilisateur**. L'onglet **Ignorés** de Sujets disparaît (l'ignorance vit désormais sur la conversation, filtrable depuis Conversations). Le dock, lui, **ne change pas**.
>
> **Pourquoi Conversations n'est pas un onglet.** Tant que Relvo ne trie pas lui-même, exposer en permanence la liste des fils **réafficherait une boîte de réception** que le dirigeant a déjà dans WhatsApp et Gmail : on lui *ajouterait* du travail au lieu de lui en retirer. En la plaçant derrière le KPI « Sans sujet », on n'expose par défaut que **ce qui n'est pas encore traité**, et la charge mentale reste sur les **sujets**, pas sur les messages. C'est la traduction directe de la posture produit : *l'UI sert à accéder à l'info, Relvo sert à agir*.
- **Distribution en PWA.** En V1, Relvo est une **application web progressive** (Next.js + manifest `display: standalone`, installable sur l'écran d'accueil du téléphone) — pas une app native de store. C'est ce qui permet de livrer l'expérience mobile-first sans cycle de soumission App Store. Le détail (manifest, safe-areas iOS, installabilité) est dans `../spec/ux-mobile-first.md`.

### Caractéristiques structurantes de la conversation

- **Page-aware** — Relvo sait toujours d'où on lui parle (URL + données contextuelles). Un **chip de contexte** (« Contexte : SUB-0142 — Sauce blanche ») permet de basculer en discussion générale d'un clic sur ×.
- **Sessions implicites** — à l'ouverture, nouvelle conversation par défaut, ou reprise de la conversation en cours si la dernière activité date de moins de 5 minutes. Bouton « + Nouvelle conversation » toujours accessible.
- **Éphémère** — les conversations sont stockées **côté client dans IndexedDB**, pas sur le serveur. Aucune entité `ChatConversation` côté base de données en V1. Ce qui persiste, ce sont les actions effectuées et leurs résultats (`Task`, `Action`, `EventLog`…), pas le dialogue qui les a déclenchées.
- **Action-capable day-one** — tout ce que l'utilisateur peut faire dans l'UI, il peut le demander au chat : créer une tâche, modifier un sujet, préparer un brouillon, éditer une note de Connaissances, consulter ses KPIs, retrouver un message. L'architecture est symétrique — chaque clic UI a un tool API correspondant qui appelle la même fonction métier. Détail technique dans `04-ia.md §11`.

### Boundaries de l'action-capable en V1

Toutes les actions de Relvo sont **visibles** dans le fil sous forme de blocs structurés (« ✦ J'ai créé la tâche *Appeler le shop de Montpellier* dans SUB-0142 ») et **annulables** d'un clic dans une fenêtre de quelques minutes après leur exécution.

Le brouillon de message ne s'envoie **jamais** automatiquement — il atterrit dans le composer du Sujet pour validation utilisateur, conformément au principe « Relvo n'envoie jamais de message automatiquement » (cf. `04-ia.md §7.4`).

La traçabilité des actions chat-driven est assurée via `EventLog` : la métadonnée `metadata.source = "chat"` permet de distinguer une tâche créée depuis le chat d'une tâche créée par suggestion automatique ou clic UI.

### Pourquoi ce modèle

Le brief sert l'**immédiateté** — l'utilisateur ouvre l'app, il voit l'essentiel sans poser de question. La conversation, désormais à portée immédiate dans le même écran, sert l'**approfondissement** et l'**action**. En les réunissant sur l'Accueil plutôt qu'en les séparant derrière un bouton flottant, on supprime la friction « où est le chat ? » et on rend tangible la promesse « Relvo sert à agir ».

Ce modèle épouse le profil cible (food, bâtiment — peu rompu aux SaaS, mais habitué à dialoguer avec ChatGPT/Claude) : pas d'apprentissage d'une navigation bureautique, pas de question sur *comment parler à Relvo* — l'app **est** une conversation, augmentée de vues structurées quand on veut creuser.
