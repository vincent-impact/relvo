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

## 2. Le message est le point d'entrée du système

Un message entrant ou sortant est souvent l'élément déclencheur.

Quand un message est reçu, l'IA tente de le traiter :

- elle l'enregistre
- elle tente de le rattacher à un sujet existant ou de créer un nouveau sujet
- si elle y parvient, elle peut proposer des tâches en fonction du contenu

Si l'IA ne parvient pas à comprendre le message (contact inconnu, intention ambiguë, contexte insuffisant), le message reste **"Sans sujet"**. Il est visible dans la page Messages et dans le dashboard, en attente d'une intervention humaine : l'utilisateur peut alors l'affecter à un sujet existant, créer un nouveau sujet à partir de ce message, ou l'ignorer.

Le message n'est donc pas l'unité de pilotage, mais l'élément qui **alimente** le sujet.

## 3. La conversation regroupe les messages par contact

Les messages ne sont pas présentés individuellement, mais regroupés en **conversations par contact**, quel que soit le canal utilisé (email, WhatsApp, etc.).

Un même contact peut écrire par email le lundi et par WhatsApp le mardi : tous ses messages apparaissent dans un seul fil de conversation. Chaque message porte un indicateur de canal pour savoir par où il est passé.

Au sein d'une conversation, les messages peuvent traverser **plusieurs sujets**. Un échange avec un fournisseur peut passer d'un sujet de commande à un sujet de livraison, entrecoupé de messages informels sans rapport professionnel. Chaque message porte un **badge de rattachement** (le sujet auquel il est lié, ou "Sans sujet"), ce qui permet de naviguer vers le sujet correspondant.

Lors de la réponse, le canal est présélectionné sur le **dernier canal utilisé par le contact**, avec la possibilité de le changer via un sélecteur.

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

> **Message → Task → Action → LogEvent**

### Message

Révèle une situation ou un besoin.

### Task

Formalise ce qu'il faut faire.

### Action

Permet d'exécuter concrètement une partie du travail.

### LogEvent

Trace ce qui s'est passé.

## 9. Cycle de vie d'un sujet

### 1. `new`

Le sujet est fraîchement créé.

- L'utilisateur crée lui-même un nouveau sujet.
- L'IA reçoit un nouveau message, crée un sujet, mais n'identifie aucune tâche à faire. Le sujet reste en `new` en attente que l'utilisateur le consulte.

Note : si l'IA ne parvient pas à comprendre un message (sens ambigu, contact inconnu, contexte insuffisant), elle ne crée pas de sujet. Le message reste "Sans sujet" dans la page Messages, en attente d'une intervention humaine.

### 2. `to_do`

Le sujet est compris, et il existe des choses à faire.

C'est le statut central du produit.

Le sujet passe en `to_do` lorsque :

- l'IA ou l'utilisateur a identifié une ou plusieurs tâches
- le dossier est actionnable
- il reste du travail à réaliser

Exemples :

- confirmer ou non un remplacement produit
- répondre à un fournisseur
- préparer une réponse officielle à une demande RH

Le sujet reste en `to_do` tant qu'il reste des tâches utiles à mener et qu'on n'est pas dans une logique d'attente dominante.

### 3. `waiting`

Le sujet est en attente d'un retour externe ou interne important.

Ce statut s'applique quand :

- une réponse a été envoyée
- une demande a été formulée
- l'avancement dépend désormais d'un tiers

Exemple : on a répondu au fournisseur, et on attend sa confirmation.

Même s'il reste encore quelques tâches secondaires ouvertes, le sujet peut passer en `waiting` si l'état dominant est l'attente.

### 4. `unread`

Le sujet en état `waiting` reçoit un nouveau message qui n'implique aucune nouvelle action (ce sont souvent des messages de validation ou de confirmation). Pour inciter l'utilisateur à fermer le sujet manuellement, on place le sujet en `unread` si aucune nouvelle action n'est suggérée.

### 5. `resolved`

Le sujet est traité.

Cela signifie que :

- la situation a été gérée
- les principales tâches ont été faites
- il n'y a plus de travail significatif à mener
- le dossier est stabilisé

### 6. `archived`

Le sujet est clos et rangé.

C'est le statut final d'un sujet déjà résolu, que l'on conserve pour l'historique mais qui ne fait plus partie du flux actif.

### Lecture simple du cycle de vie

- **new** → un nouveau sujet naît
- **to_do** → il y a des tâches à faire
- **waiting** → on attend un retour (qu'il s'agisse d'une réponse, d'une livraison, d'une décision tierce…)
- **unread** → un message est arrivé, pas d'action requise
- **resolved** → c'est traité
- **archived** → c'est rangé

> **Note historique**. Un statut `blocked` figurait dans une version antérieure du modèle pour signaler les sujets « impossibles à avancer ». Il a été retiré : il n'incite pas à l'action, et tous les cas d'usage qu'il couvrait (pas de pièces, pas de réponse, pas de solution) se réduisent en réalité à une attente externe — donc à `waiting`. Cf. CLAUDE.md §7.

Et en amont du cycle : un message que Relvo n'a pas su traiter reste **"Sans sujet"** dans la page Messages, en attente de tri par l'utilisateur. Un indice de tri (`triage_hint` — cf. `04-ia.md §1.1bis`) explique pourquoi : trop court, intention floue, prospection, expéditeur inconnu, sans action, autre.

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

### Pourquoi un Dossier unifié

Le mental modèle est celui d'un **classeur physique** : tu ouvres ton dossier « Fournisseurs », tu y trouves les affaires en cours (ces Sujets ouverts avec Karim, avec PackPlus…) et les documents de référence (le contrat-type, la procédure de validation des devis, ta note sur les marottes de chacun). C'est l'unité de classement métier la plus intuitive pour des utilisateurs non rompus aux SaaS — un Dossier, c'est concret.

Côté modèle, c'est l'entité `Folder` qui porte ce regroupement. `Subject.folder_id` et `KnowledgeDocument.folder_id` pointent tous deux vers un Folder.

### Le Folder « Général » — uniquement documentaire

Un Folder spécial nommé **« Général »** est auto-créé à la création du compte. À la différence des Dossiers métier, il est **purement documentaire** — il ne contient jamais de Sujets, uniquement des `KnowledgeDocument`. Sa raison d'être : accueillir les **Connaissances transversales** (organigramme, charte rédactionnelle, ton de réponse) — les documents qui doivent être chargés dans le contexte de tous les Sujets, peu importe leur Folder. C'est la « mémoire générale » de Relvo.

Côté UI, sa fiche affiche un en-tête explicite (« Connaissances transversales — ce que Relvo sait de toi en général ») et masque la section Sujets pour ne pas créer de confusion. Si Relvo ne sait pas dans quel Dossier métier classer un nouveau Sujet, le Sujet reste en mode « sans dossier » dans Mon fil (avec un badge discret et une suggestion Relvo « Range-moi dans X ? »), il n'atterrit **pas** dans Général.

### Deux natures de documents

Les `KnowledgeDocument` se déclinent en deux formes complémentaires, identifiées par le champ `kind` :

- **Fichiers (`kind = file`)** — PDFs, images, documents uploadés. Sources de référence figées : organigrammes, factures-types, devis-types, contrats fournisseurs, charte tarifaire. **Non modifiables** dans l'application (suppression seule). En V1, l'utilisateur peut **glisser-déposer** un PDF directement dans la fiche d'un Dossier pour l'ajouter.
- **Notes (`kind = note`)** — texte Markdown rédigé directement dans l'app. **Mémoire vivante** que l'utilisateur écrit et fait évoluer dans le temps : règles internes, ton de réponse, liste des magasins, particularités d'un fournisseur, lessons learned. Exactement le pattern d'un fichier `.md` qu'on ajoute à Claude Code pour enrichir le contexte.

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

## 13. Relvo s'exprime de deux manières : un brief sur l'Accueil, une conversation dans le drawer

Pour des utilisateurs non rompus aux SaaS bureautiques, l'omniprésence de Relvo doit se traduire par deux modes d'interaction distincts et complémentaires :

### Mode brief — l'Accueil (orientation matinale)

L'**Accueil** n'est pas une boîte de dialogue, ni un workspace. C'est **un guide de 30 secondes** que Relvo prépare pour son utilisateur — l'équivalent d'un brief du matin qui répond à la question « qu'est-ce qui m'attend dans ma journée et les 2-3 jours à venir ? ». On y trouve :

- Un **bandeau KPIs** (Sujets ouverts, Messages à trier, Tâches du jour, % d'aide Relvo)
- Le **calendrier de la semaine** en pleine largeur (widget compact, lien « Vue mois complète → » vers `planning.html`)
- Les **3 sujets prioritaires** présentés en 3 colonnes côte à côte — un aperçu, pas un workspace. Lien « Voir tous les sujets → » vers `feed.html` pour le traitement
- (Optionnel) Une intro courte signée Relvo (« Bonjour Mamadou, voici ton brief : 3 sujets urgents, 1 message à trier »)

L'entrée « Accueil » dans la navigation porte une icône **maison** classique. C'est la page d'atterrissage par défaut à la connexion.

L'Accueil n'a pas de champ de saisie chat ni d'actions de traitement (✕/✓ absent des cartes). Pour dialoguer, l'utilisateur ouvre le drawer. Pour traiter ses sujets, il bascule sur Mon fil.

### Mode workspace — Mon fil (traitement)

**Mon fil** (`feed.html`) est l'espace de travail dédié au traitement des sujets. C'est ici que l'utilisateur passe l'essentiel de son temps de session — l'équivalent d'une boîte de réception email, mais structurée par sujets plutôt que par messages.

On y trouve :

- Le **feed plein écran** : toutes les cartes-sujets enrichies (référence SUB-XXXX, drapeau urgent, badge statut, badge `✦ N tâches suggérées`, titre, résumé, méta complet, indicateur d'attachements, dernière activité, barre de progression des tâches)
- Les **filtres** Priorité (défaut, `priority IN (critical, high)`) / Chronologique (du plus récent au plus ancien) / Résolus
- Le **bandeau Relvo** « ✦ Aujourd'hui : N messages reçus, j'en ai remonté X » + lien « Voir tous les messages bruts → » vers `messages.html`
- Sur chaque carte : les **boutons d'action contextuels violets** (suggérés par Relvo) et la **paire ✕/✓ systématique** (Ignorer + Marquer résolu)
- Le **drawer chatbot** accessible via le bouton flottant 🤖

L'icône de Mon fil est une **enveloppe** — métaphore email assumée (cf. la posture « Relvo donne un objet à WhatsApp » : un sujet = un objet d'email auto-extrait).

**Pourquoi séparer Accueil et Mon fil** : ce sont deux modes mentaux distincts. Tenter de les mélanger sur une même page revient à demander à l'utilisateur d'alterner orientation et traitement à chaque visite — et le calendrier semaine, qui mérite la pleine largeur sur l'Accueil, écrase le feed s'il vit au-dessus. La séparation respecte aussi le rituel matinal observé chez les clients food/bâtiment : « calendrier d'abord, sujets ensuite ».

### Mode conversation — le drawer

Le **drawer** est la surface conversationnelle, accessible depuis **toutes les pages** (Accueil compris) via un bouton flottant 🤖 en bas-droite. Il s'ouvre latéralement (~40 % de la largeur) par-dessus la page courante.

C'est là que l'utilisateur **dialogue** avec Relvo, **demande des actions**, **creuse** un sujet ou un détail. C'est aussi par là que passent toutes les opérations action-capable.

### Caractéristiques structurantes du drawer

- **Page-aware** — le drawer sait toujours sur quelle page l'utilisateur se trouve (URL transmise + données contextuelles pertinentes). Un chip explicite en haut du drawer (« Contexte : SUB-0142 — Sauce blanche ») permet de basculer en discussion générale d'un clic sur ×.
- **Sessions implicites** — à l'ouverture, nouvelle conversation par défaut, ou reprise de la conversation en cours si la dernière activité date de moins de 5 minutes. Bouton « + Nouvelle conversation » toujours accessible.
- **Éphémère** — les conversations sont stockées **côté client dans IndexedDB**, pas sur le serveur. Aucune entité `ChatConversation` côté base de données en V1. Ce qui persiste, ce sont les actions effectuées et leurs résultats (`Task`, `Action`, `EventLog`…), pas le dialogue qui les a déclenchées.
- **Action-capable day-one** — tout ce que l'utilisateur peut faire dans l'UI, il peut le demander au chat : créer une tâche, modifier un sujet, préparer un brouillon, éditer une note de Connaissances, consulter ses KPIs, retrouver un message. L'architecture est symétrique — chaque clic UI a un tool API correspondant qui appelle la même fonction métier. Détail technique dans `04-ia.md §11`.

### Boundaries de l'action-capable en V1

Toutes les actions de Relvo sont **visibles** dans le fil du drawer sous forme de blocs structurés (« ✦ J'ai créé la tâche *Appeler le shop de Montpellier* dans SUB-0142 ») et **annulables** d'un clic dans une fenêtre de quelques minutes après leur exécution.

Le brouillon de message ne s'envoie **jamais** automatiquement — il atterrit dans le composer du Sujet pour validation utilisateur, conformément au principe « Relvo n'envoie jamais de message automatiquement » (cf. `04-ia.md §7.4`).

La traçabilité des actions chat-driven est assurée via `EventLog` : la métadonnée `metadata.source = "chat"` permet de distinguer une tâche créée depuis le chat d'une tâche créée par suggestion automatique ou clic UI.

### Pourquoi cette dualité

Le brief sur l'Accueil sert l'**immédiateté** — l'utilisateur ouvre l'app, il voit l'essentiel sans poser de question. Le drawer sert l'**approfondissement** et l'**action** — l'utilisateur creuse, demande, fait faire. Les deux sont accessibles partout dans l'app (l'Accueil par la nav, le drawer par le bouton flottant), et ils se complètent sans se concurrencer.

Cette dualité tient compte du profil utilisateur cible (food, bâtiment — peu rompu aux outils SaaS, mais habitué à dialoguer avec ChatGPT/Claude). Ne pas avoir à apprendre comment parler à Relvo : la page d'accueil le présente, le bouton flottant le rend toujours accessible.
