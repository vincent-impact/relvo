# 3. Cas d’usage

## Principe général

Lorsqu'un message est reçu, le système suit cette logique — **entièrement déterministe, sans IA** :

1. identifier le canal source (`Channel`)
2. enregistrer le `Message` avec les informations brutes de l'expéditeur (`sender_raw`, `sender_name`)
3. **calculer la clé de conversation** selon le canal (cf. `02-modele-donnees.md §5bis`) :
   - email → `email:<interlocuteur>:<objet normalisé>`
   - WhatsApp groupe → `wa-group:<chat_id>`
   - WhatsApp direct → `wa-direct:<numéro>`
4. **rattacher le message à la `Conversation`** correspondante — ou la créer si elle n'existe pas
5. **classer le message dans un domaine (`Folder`)** — ce domaine donnera son domaine au sujet ouvert depuis ce message
6. rattacher le message au sujet, **selon une règle qui dépend du canal** (cf. ci-dessous)
7. produire les événements de journal (`EventLog`)

### La règle de rattachement est CANAL-DÉPENDANTE — décision du 2026-07-21

Ce point a été « unifié » un temps, par déduction erronée, puis **rétabli le 2026-07-21**. Les deux canaux ne se comportent pas pareil parce qu'ils ne sont pas la même chose (cf. `01-principes.md §3`) :

| | **email** | **WhatsApp** |
|---|---|---|
| Ce qu'est la conversation | **le sujet lui-même** | un **flux** qu'un sujet **écoute** |
| Le message rejoint le sujet… | **TOUJOURS**, quel que soit le statut du sujet | **seulement si l'écoute est active** : sujet `ouvert`, conversation non ignorée, message dans la plage d'écoute |
| Si le sujet était `validé` / `fermé` | il **repasse en `ouvert`** | rien ne se passe — le message reste sans sujet |
| Faire taire le fil | **ignorer la conversation**, et rien d'autre | ignorer la conversation, ou arrêter l'écoute |

**Pourquoi l'email rouvre.** Un sujet email **n'écoute rien** : il **EST** le fil. Un nouvel email de même objet et de même interlocuteur *est*, par construction, la suite de cette affaire — la ranger ailleurs reviendrait à nier l'énoncé central. Et l'enjeu est concret : un fournisseur relance sur une affaire validée il y a trois jours. Soit son message **rouvre le sujet et remonte dans le fil**, soit il s'y range **en silence** — et l'utilisateur rate exactement le message qu'il ne fallait pas rater. De l'activité sur une affaire signifie qu'elle est **vivante**.

**Pourquoi WhatsApp ne rouvre pas.** Là, la conversation n'est pas l'affaire : c'est un flux qui charrie des affaires successives. Un message qui arrive après l'arrêt d'une écoute ne parle pas forcément de la même chose — le rattacher serait un pari, et rouvrir un sujet sur ce pari serait un pari sur un pari.

⚠️ **Le seul geste qui fait taire un fil email est d'IGNORER LA CONVERSATION** (cf. Cas N). C'est pour cela que Relvo l'enchaîne automatiquement à la validation et à la fermeture d'un sujet (cf. Cas K et Cas Q) : c'est là, et seulement là, que l'utilisateur dit « je ne veux plus rien entendre de ce fil ».

**Règle fondamentale** : le rangement en conversation **ne peut pas échouer**. Tout message a une place dès la première seconde, sans qu'aucune IA n'ait à comprendre quoi que ce soit. **Il n'y a plus de message « Sans sujet »** — il y a des **conversations qu'aucun sujet ouvert n'écoute**, et ce sont elles qui sollicitent l'utilisateur (KPI « Sans sujet »).

**Règle sur les contacts** : un contact n'est créé automatiquement qu'à l'**ouverture d'un sujet**, et uniquement depuis une conversation de type **objet** ou **direct**. Une conversation de **groupe** ne crée **jamais** de contact : son interlocuteur est le groupe lui-même. Cela garantit que l'annuaire ne se remplit pas de participants qu'on n'a jamais choisis.

**Règle d'ignorance** : une conversation `ignoré` continue de recevoir ses messages, mais Relvo cesse de les analyser, résumer et trier. Seul l'utilisateur peut la réactiver.

> **Note historique.** Le flux antérieur faisait *tenter* à l'IA, dès la réception, la compréhension du message puis le rattachement à un sujet ; en cas d'échec, le message restait « Sans sujet » avec un `triage_hint`. Le tri est désormais **déterministe et infaillible**, et la compréhension (ouvrir un sujet, le titrer, en déduire des tâches) est **repoussée à une étape ultérieure**, déclenchée par l'utilisateur en V1 et par Relvo en M7 (décision du 2026-07-20).

## Cas A — Réception d'un message : le rangement déterministe

### Exemple

Un fournisseur inconnu envoie un email « Retard livraison sauce blanche ». Ou bien un message tombe dans le groupe WhatsApp « Tasty Crousty Marne‑la‑Vallée ».

### Traitement

1. identifier le `Channel`, créer le `Message` avec `sender_raw` / `sender_name`
2. calculer la clé de conversation et **trouver ou créer** la `Conversation`
   - email → conversation de type **objet**, titrée par l'objet du mail
   - groupe → conversation de type **groupe**, titrée par le **nom du groupe**
   - WhatsApp 1:1 → conversation de type **direct**, titrée par le nom du contact
3. **aucun contact n'est créé** à ce stade, quel que soit le canal
4. la conversation ne porte pas de sujet ouvert → `subject_id = null`
5. `EventLog` : message reçu, conversation créée le cas échéant

### Résultat

Le message est visible **dans sa conversation**. La conversation remonte en tête de la liste, en **non-lu** (fond distinct, gras, pastille compteur), et elle est comptée dans le **KPI « Sans sujet »** puisque son dernier message n'est rattaché à rien.

## Cas B — Ouvrir un sujet : un seul geste par canal

> **Décision du 2026-07-21.** **Un fil d'email EST un sujet ; une conversation WhatsApp est un flux** qu'un sujet **écoute**, à partir d'un message (cf. `01-principes.md §3`).
>
> Le domaine expose **une seule primitive** — *ouvrir un sujet sur une conversation, avec une ancre **optionnelle***. Ancre nulle → tout le fil ; ancre posée → l'écoute commence là. ⚠️ **La logique métier teste l'ancre, jamais le canal.** Ce qui diffère, c'est **sur quoi porte le geste**.

| | **B1 — WhatsApp** | **B2 — email** |
|---|---|---|
| Le geste porte sur… | **le MESSAGE** (swipe droite dans le fil) | **la CONVERSATION** (swipe droite dans la liste) |
| Ce qu'il propose | « ce message est important » → commencer l'écoute ici | ouvrir un **nouveau sujet** ou **rattacher à un sujet existant** |
| Ancre transmise | le **message swipé** | **`null`** |
| Périmètre couvert | messages **≥ ancre**, jusqu'à l'éventuelle borne de fin | **tout le fil, amont ET aval** |

⚠️ **Le tap ne sert plus qu'à ouvrir une pièce jointe**, sur les deux canaux. Il n'y a plus aucune pop-up de message.

### B1 — WhatsApp : swipe droite sur le message qui lance l'affaire

**Exemple.** Dans le groupe « Tasty Crousty Marne‑la‑Vallée », l'utilisateur repère le message qui lance vraiment l'affaire : « La livraison de sauce blanche a 3 jours de retard ». C'est de **là** que le sujet doit partir.

#### Traitement

1. l'utilisateur ouvre la conversation et **swipe ce message vers la droite** — un seul geste, qui **choisit l'ancre ET crée le sujet** :
   - création du `Subject` en `status = ouvert`, titre pré-rempli (nom du groupe ou du contact), domaine hérité de `Message.folder_id`
   - création de `SubjectConversation(subject_id, conversation_id, anchor_message_id = ce message, closing_message_id = null)`
   - **tous les messages ≥ ancre** reçoivent `subject_id`
   - **création automatique du contact** si la conversation est de type **direct** ; **aucun contact** si elle est de type **groupe**
2. `EventLog` : sujet ouvert, contact créé le cas échéant

**Pourquoi un seul geste.** L'intention réelle de l'utilisateur est indivisible : « **ça, c'est important, et l'affaire commence là** ». La découper en deux étapes (choisir l'ancre, puis ouvrir) demanderait deux décisions là où il n'y en a qu'une. C'est aussi ce qui **supprime tout défaut d'ancre à calculer** : il n'y a plus de règle à anticiper, puisque l'utilisateur désigne toujours le message lui-même.

#### Résultat

Les messages **antérieurs** à l'ancre restent dans la conversation sans appartenir au sujet. La conversation affiche en en-tête le **bandeau « Suivi dans : … »** et sort du KPI « Sans sujet ». L'écoute peut ensuite être **remontée** d'un même geste sur un message plus ancien (cf. Cas T).

> **Directs et groupes, même régime** (précision du 2026-07-20). Un groupe WhatsApp s'écoute **exactement** comme une conversation directe. Le **nom du groupe ne fait pas office d'objet d'email** : « Tasty Crousty Marne-la-Vallée » nomme un collectif, pas une affaire — le fil y mélangera livraisons, congés et pannes. Seule différence, déjà actée : **aucun contact n'est créé** pour un groupe.

### B2 — Email : ouvrir depuis la conversation, sans aucune ancre

**Exemple.** Six emails ont déjà été échangés avec SoGood Distribution sous l'objet « Retard livraison sauce blanche ». L'utilisateur décide d'en faire un sujet.

#### Traitement

1. l'utilisateur **swipe la conversation vers la droite** → deux choix : **« Ouvrir un sujet »** ou **« Rattacher à un sujet existant »** (cf. Cas M). Il n'y a **pas** d'ouverture depuis un message.
2. création du `Subject` en `status = ouvert`, titre pré-rempli avec l'**objet de l'email**, domaine hérité de `Message.folder_id`
3. création de `SubjectConversation(subject_id, conversation_id, anchor_message_id = **null**, closing_message_id = **null**)` — **aucune borne, ni basse ni haute**
4. ⚠️ **balayage de la conversation ENTIÈRE** : **tous** les messages du fil reçoivent `subject_id`, **y compris ceux antérieurs** à l'ouverture du sujet
5. **création automatique du contact** (conversation de type `objet`)
6. `EventLog` : sujet ouvert, contact créé le cas échéant

> **Ce que le swipe droite signifie ici** (2026-07-21). Il ne *crée* pas la correspondance fil ↔ sujet — l'objet de l'email l'a déjà posée. Il **déclare que ce fil mérite d'être suivi** : tous les fils email ne sont pas des affaires (newsletters, accusés de réception, démarchage). C'est M7 qui prendra cette décision à la place de l'utilisateur, plus tard.

#### Résultat

Le sujet porte les **six** emails, pas le dernier — **et tous ceux à venir** tant qu'il reste `ouvert`. Il n'y a rien qui reste « non couvert » sur un fil email : c'est **tout le fil**, littéralement.

La conversation affiche désormais, **en en-tête**, un bandeau **« Suivi dans : *Retard livraison sauce blanche* »** avec la **pastille de couleur du domaine**, **cliquable vers la fiche du sujet**. **Aucun marqueur par message** — sur aucun canal (2026-07-21) : tous les messages de la plage appartiennent au sujet, un signal répété sur chacun serait rigoureusement identique, donc muet.

⚠️ **Piège d'implémentation.** La règle en place ne balaie que les messages **postérieurs ou égaux à l'ancre** — héritage WhatsApp, où elle est juste. Appliquée telle quelle à l'email, elle produirait un sujet à **un seul message** sur un fil de six. C'est le point le plus coûteux à rater de cette décision.

**Pourquoi aucune ancre côté email ?** Parce que l'**objet** *est* déjà la délimitation de l'affaire, posée par l'expéditeur lui-même. Une ancre n'y ajouterait rien : elle ne pourrait que retrancher le début du fil.

## Cas C — Un nouveau message arrive pendant qu'un sujet est ouvert

### Exemple

Le fournisseur répond dans le même fil : « Livraison reprogrammée jeudi ».

### Traitement

1. réception normale (cas A) → le message rejoint sa conversation
2. **un sujet ouvert écoute cette conversation** (`closing_message_id = null`) → le message reçoit **automatiquement** son `subject_id`
3. `last_activity_at` du sujet est remonté
4. Relvo peut lever `waiting_for_reply`, proposer des tâches, suggérer la validation

### Résultat

Le message apparaît **à la fois** dans la conversation et dans la fiche du sujet — **c'est la même ligne en base**, pas une copie (cf. `02-modele-donnees.md §6`). Le statut du sujet reste **`ouvert`** — seuls les **marqueurs** bougent (« À faire », « En attente », pastille de non-lus sur la conversation).

## Cas D — Deux affaires entrelacées dans une conversation directe — RENONCEMENT ASSUMÉ

### Exemple

Karim, en WhatsApp direct, alterne : sauce blanche, facture emballages, sauce blanche. Un seul fil, deux affaires.

### Ce qui se passe en V1

Un sujet « Retard sauce blanche » **écoute** la conversation. Les messages sur la facture, arrivant dans la plage d'écoute, **entrent dans ce sujet** — et **l'utilisateur ne peut pas les en sortir**.

> ⚠️ **L'entrelacement n'est plus exprimable dans l'interface** (décision du 2026-07-21). Il n'y a plus de rattachement ni de détachement message par message : dans la plage d'écoute, **tous** les messages appartiennent au sujet ; hors plage, **aucun**.

### Pourquoi ce renoncement

C'était pourtant l'argument fondateur du modèle. Trois raisons de l'assumer :

1. **Le modèle, lui, le permet toujours** — `Message.subject_id` est décidé message par message. On ne perd aucune capacité, on retire une **commande d'interface**.
2. **Séparer des affaires entrelacées est exactement le travail de M7.** Construire une mécanique manuelle sophistiquée pour six mois, en sachant qu'une machine la remplacera, c'est de la dette payée deux fois.
3. **Un peu de bruit dans un sujet vaut mieux qu'une UI incompréhensible.** Le dispositif qui exprimait l'entrelacement (rail coloré par message, ruptures, poignée glissante) demandait à un dirigeant de raisonner sur des plages et des appartenances — pour un gain que M7 apportera sans lui rien demander.

### Ce qui reste possible

- **remonter le début de l'écoute** (Cas T) pour faire entrer des messages antérieurs ;
- **arrêter l'écoute** (Cas U) quand le fil part sur autre chose, puis **rouvrir un sujet** plus loin — des écoutes **successives**, qui sont le cas normal.

## Cas E — Message compréhensible mais sans tâche immédiate

### Exemple

Le message informe simplement d'un état, sans demander d'action.

> "Le virement a bien été effectué."

> "Le devis signé est en pièce jointe."

### Traitement

1. créer le `Message`
2. créer ou rattacher le `Subject`
3. comprendre le contenu
4. constater qu'aucune tâche n'est nécessaire à ce stade
5. ne créer aucune `Task`
6. produire les `EventLog`

### Résultat

- si c'est un nouveau sujet : `Subject.status = ouvert` (jamais consulté → marqueur dérivé **« Nouveau »**)
- si c'est un sujet existant : le **statut reste inchangé** (`ouvert`) ; le nouveau message allume la **pastille de non-lus**, et s'il répond à une attente, Relvo lève `waiting_for_reply`

### Règle

Un message ne crée pas forcément une tâche. Certains messages appellent une action, d'autres sont simplement informatifs. L'IA doit savoir ne rien proposer quand il n'y a rien à faire.

## Cas F — Message compréhensible avec tâches à créer

### Exemple

Le fournisseur dit :

> "Je ne pourrai pas livrer la sauce blanche demain. Je peux mettre de la sauce algérienne à la place, c'est ok ?"

### Traitement

1. créer le `Message`
2. créer ou rattacher le `Subject`
3. comprendre le contenu
4. identifier les actions **déductibles du contenu du message** pour faire avancer le sujet :
   - confirmer ou non le remplacement _(source_actor: ai)_
5. créer les `Task` avec `source_actor = ai`
6. tenter d'extraire une date pour chaque tâche (`start_date`, et le cas échéant `start_time`, `end_date`, `end_time` — cf. `04-ia.md §2.5`). Si rien n'est extractible, les champs date restent null.
7. préparer éventuellement un brouillon de réponse dans le composer
8. produire les `EventLog`
9. les tâches créées allument le marqueur **« À faire »** (le statut ne change pas)

### Résultat

- `Subject.status` inchangé (`ouvert` ; marqueur **« Nouveau »** si le sujet vient d'être créé) **+ marqueur « À faire »**

### Point important

Une tâche est rattachée au sujet, pas à un utilisateur (cf. `01-principes.md §4`). Relvo propose toutes les actions nécessaires pour faire avancer le sujet, dans la limite de ce que le contenu disponible permet de déduire. Les tâches issues du savoir métier de l'utilisateur (par exemple "Appeler le shop de Montpellier" ou "Vérifier les stocks de Béziers") sont créées manuellement par l'utilisateur avec `source_actor = user`, et tracées dans le journal de bord.

## Cas G — Préparation d'une réponse par l'IA

### Exemple

Une `Task` ouverte est : "Répondre au fournisseur". L'IA prépare un brouillon.

### Traitement

1. l'IA identifie qu'une tâche de type `reply` est ouverte
2. elle prépare un brouillon de réponse : destinataire, canal, contenu
3. le brouillon est stocké dans le `payload` d'une `Action` de type `send_message`
4. le brouillon est présenté **directement dans la zone de rédaction (composer)**, clairement identifié comme "Suggestion IA — modifiez librement avant d'envoyer"
5. le canal est présélectionné sur le dernier canal utilisé par le contact, avec possibilité de le changer
6. un `EventLog` est produit (brouillon préparé, actor: ai)

### Résultat

- `Action` créée avec `status = open`
- le brouillon est visible dans le composer, éditable par l'utilisateur

### Ce qui se passe ensuite

- si l'utilisateur envoie tel quel ou après modification → voir Cas H
- si l'utilisateur efface le brouillon et écrit de zéro → voir Cas H
- si l'utilisateur régénère la suggestion → l'IA produit un nouveau brouillon

## Cas H — Envoi d'un message par l'utilisateur

### Exemple

L'utilisateur envoie un message, qu'il ait utilisé le brouillon IA ou non.

### Traitement

1. l'utilisateur envoie un message sortant depuis le sujet ou depuis la page Messages
2. le système crée le `Message` (direction: outgoing, canal sélectionné)
3. le système cherche s'il existe une `Task` ouverte compatible :
   - type `reply`
   - même sujet
   - même contact
4. si une tâche correspond → la tâche est cochée automatiquement (`completion_mode = message_match`)
5. si une `Action` de brouillon existait → elle passe en `done`
6. produire les `EventLog` (message envoyé, tâche cochée si applicable)

### Résultat

- `Message` sortant créé
- `Task` éventuellement marquée `done`
- mise à jour possible du statut du sujet

## Cas I — Pose du marqueur « En attente » (`waiting_for_reply`)

### Exemple

Une réponse a été envoyée au fournisseur, et on attend son retour.

### Traitement

1. un `Message` sortant a été envoyé
2. la `Task` de réponse est cochée
3. Relvo constate que l'état dominant du sujet est désormais l'attente (plus de tâche critique ouverte, l'avancement dépend d'un tiers)
4. Relvo pose **`waiting_for_reply = true`** → badge **« En attente »**
5. produire les `EventLog`

### Résultat

- `Subject.waiting_for_reply = true` (marqueur), `status` **inchangé** (`ouvert`)

### Remarque

« En attente » est un **marqueur**, pas un statut : il peut coexister avec « À faire » s'il reste des tâches secondaires ouvertes. Relvo lève le flag dès qu'un message entrant arrive (cf. Cas J).

## Cas J — Retour d'un tiers sur un sujet en attente

### Exemple

Le fournisseur répond à la suite d'une demande.

### Traitement

1. créer le `Message` (allume la **pastille de non-lus**)
2. rattacher au `Subject` existant (marqueur « En attente » actif)
3. Relvo **lève `waiting_for_reply`** (un retour est arrivé) et relit la situation globale
4. selon le contenu :
   - de nouvelles `Task` → marqueur **« À faire »**
   - sujet réglé → Relvo **suggère « Valider »** (`resolution_suggested_at`) ; la clôture reste humaine
   - message informatif sans action → **pastille de non-lus** seule
   - toujours en attente d'un autre tiers → Relvo repose **`waiting_for_reply = true`**
5. produire les `EventLog`

## Cas K — Validation du sujet (arrêt des écoutes)

### Conditions possibles

Le sujet peut être validé si :

- les tâches principales sont terminées
- la situation est stabilisée
- aucun nouvel échange critique n'est attendu
- aucun blocage ne subsiste

### Traitement

1. constater que le travail utile est terminé
2. l'utilisateur déclenche l'action **« Valider »** (bouton sur la fiche, ou swipe droite sur la carte) → `status = validé`, `closed_at` posé — **une date, rien d'autre**. L'IA peut l'avoir **suggérée** mais ne l'applique jamais elle-même.
3. **valider arrête les ÉCOUTES du sujet — donc WhatsApp seulement** (2026-07-21) : `closing_message_id` est posé sur le dernier message reçu de chaque conversation **WhatsApp** écoutée, qui **redevient orpheline**. ⚠️ **Les conversations EMAIL restent rattachées** : le fil *est* le sujet, il n'y a pas d'écoute à arrêter. Un nouvel email **rejoint le sujet et le rouvre** (cf. Cas W).
4. Relvo propose : « **Souhaitez-vous aussi ignorer la conversation ?** » (cf. Cas N) — c'est le geste qui empêche le fil de solliciter de nouveau l'utilisateur au message suivant. **Côté email, c'est le SEUL moyen de le faire taire.**
5. produire un `EventLog`

### Résultat

- `Subject.status = validé` (libellé UI : **« Validé »**), `closed_at` renseigné
- **WhatsApp** — la conversation **réapparaît dans le KPI « Sans sujet »** dès qu'un nouveau message y arrive
- **email** — la conversation **reste rattachée** ; un nouveau message **rouvre** le sujet, qui remonte dans le fil des ouverts
- le sujet reste **récupérable** — il vit dans l'onglet **Validés**

### Remarque

L'IA peut suggérer la validation ("Résolution suggérée") mais ne clôt jamais un sujet d'elle-même. C'est toujours l'utilisateur qui confirme.

> **Note historique.** « Terminer » / `resolved` devient « **Valider** » / `validé` (2026-07-20). ⚠️ La **réouverture automatique d'un sujet email** a été retirée un matin de 2026-07-21, sur une lecture erronée de « quand le sujet est validé, la conversation n'alimente plus le sujet » — phrase écrite dans une section « **arrêt des écoutes** », donc portant **exclusivement sur les écoutes**, c'est-à-dire sur WhatsApp. Un sujet email n'écoute rien. La règle est **rétablie le même jour** (cf. Cas W).

## Cas L — ⚠️ CADUC — Archivage du sujet (système)

> **Caduc depuis le 2026-07-20.** Le statut `archived` est **retiré** du modèle : il n'exprimait rien qu'une fermeture n'exprime déjà. Un sujet finit désormais **validé** (travail fait) ou **fermé** (écarté) — cf. Cas K et Cas Q. Il n'y a plus d'archivage automatique.

## La page Conversations — le tri, pas une boîte mail

> Préambule aux cas M, N, O. Relvo **n'est pas un client de messagerie** : la surface de travail reste le **Sujet** (invariant n°4). La page `/conversations` est un **outil de tri**, volontairement **hors navigation** : on l'atteint par le **KPI « Sans sujet »** de la page Sujets, et par défaut elle ne montre que **ce qui n'est pas traité**.

Caractéristiques de la liste :

- une ligne par **conversation** (et non par message) : titre, interlocuteur (contact **ou** groupe), icône de canal, type
- **tri par activité** : la conversation dont le dernier message est le plus récent remonte en tête
- **non-lu** = fond distinct, police grasse, **pastille compteur** ; `read_at` se pose à l'ouverture de la **conversation**
- **trois filtres** : **Sans sujet** (défaut — aucun sujet ouvert ne l'écoute), **Ignorées**, **Toutes** ; plus un filtre par **canal**
- **swipe gauche = écarter la conversation** (cf. Cas N) — libellé et couleur **par canal**, mécanisme unique, **confirmation nommant les sujets** si elle est écoutée
- **swipe droite sur la ligne de conversation = ouvrir un sujet** (cf. Cas B2) — ⚠️ **email uniquement**. **Une ligne de conversation WhatsApp ne porte AUCUN swipe droite** : le geste d'ouverture y porte sur le **message**, dans le fil. Swiper une ligne de groupe reviendrait à dire « ce groupe est une affaire », ce qu'il n'est précisément jamais.
- ouvrir une conversation affiche ses messages en **timeline**, avec le **bandeau « Suivi dans »** en en-tête — **sur les deux canaux** (cf. `02-modele-donnees.md §5bis`)

### Rendu par canal — décision du 2026-07-20

Après test en production de M6bis : forcer la même UX sur l'email et sur WhatsApp dessert les deux, pour deux raisons — la **taille et la forme** des messages email, et le **système d'objet**, inexistant en WhatsApp (sauf partiellement via le groupe).

| | email | WhatsApp |
|---|---|---|
| Rendu d'un message | **pleine largeur**, enchaînés au fil du scroll | **bulles** |
| Fond | **blanc dans les deux sens**, jamais teinté | teinté |
| Entrant / sortant | l'**en-tête** porte l'info (avatar + expéditeur + date) ; le sortant se signale par « **Moi** » | position et teinte de la bulle |
| Signal « suivi par un sujet » | **bandeau en en-tête de conversation** : « Suivi dans : *titre* » + pastille du domaine + « N sujets passés », cliquable vers la fiche | **le même bandeau** (2026-07-21) |
| Tap sur un message | **ouvrir une pièce jointe**, rien d'autre | **ouvrir une pièce jointe**, rien d'autre |
| Ouvrir un sujet | **swipe droite sur la CONVERSATION**, sans ancre | **swipe droite sur le MESSAGE** qui lance l'affaire |
| Swipe gauche (conversation) | « **Supprimer** », **rouge** | « **Ignorer** », **orange** |

⚠️ **Pas de fond coloré sur l'email.** Sur du texte long, un fond teinté fatigue et abîme la lisibilité — or c'est exactement ce qu'on vient chercher en sortant de la bulle. Gmail, Superhuman et Outlook font le même choix. Si la distinction s'avère insuffisante à l'usage, on ajoutera une teinte **très légère au sortant seulement**, jamais aux deux.

⚠️ **Aucun marqueur d'appartenance par message, sur aucun canal** (décision du 2026-07-21). Une conversation est **écoutée par un sujet ouvert, ou pas** : dans la plage d'écoute tous les messages appartiennent au sujet, hors plage aucun. Il n'y a donc qu'**un état à dire par conversation** — le bandeau suffit, et un signal répété message par message ne serait que du décor.

> ⚠️ **La divergence s'arrête au rendu et aux gestes.** Ouverture de sujet, écoute, arrêt d'écoute, ignorance, statuts : **tout le domaine reste commun**. Le jour où l'on duplique la logique métier « parce que l'email est différent », on aura deux produits.

> **Note historique.** La page `/messages` affichait une **pile de messages orphelins** (`subject_id = null`), avec rétention 15 jours et une page de détail par message (`/messages/[id]`). Les deux disparaissent : il n'y a plus de message orphelin, et le détail se lit dans la conversation.

## Cas M — Rattacher une CONVERSATION EMAIL à un sujet existant

### Contexte

Un fil d'email arrive sur une affaire **déjà suivie** : le fournisseur ouvre un nouvel objet (« RE: palette bloquée ») pour une histoire qui relève du sujet « Retard livraison sauce blanche ». On ne veut pas d'un second sujet, on veut **rejoindre** celui qui existe.

> ⚠️ **Email uniquement** (2026-07-21). Le rattachement porte sur une **conversation entière**, jamais sur un message isolé — il n'y a plus de geste par message côté email, et le rattachement message par message a disparu de l'interface sur les deux canaux (cf. Cas D).
>
> Côté WhatsApp, l'équivalent est le **swipe droite sur un message** : soit il ouvre un sujet, soit il **remonte l'écoute** d'un sujet existant (Cas T).

### Traitement

1. l'utilisateur **swipe la conversation vers la droite** → il choisit **« Rattacher à un sujet existant »** et sélectionne le sujet
2. création de `SubjectConversation(subject_id, conversation_id, anchor_message_id = null, closing_message_id = null)` — le sujet couvre **le fil entier**
3. **tous** les messages du fil reçoivent le `subject_id` (`status = linked`)
4. produire un `EventLog` (conversation rattachée, actor: user)

### Résultat

- le sujet porte désormais **deux conversations** ; sa fiche n'en affiche **qu'une à la fois** (ligne sélecteur en tête de l'onglet Conversations — cf. Cas U)
- la conversation affiche le bandeau **« Suivi dans : … »** et sort du KPI « Sans sujet »

## Cas N — Écarter une conversation (« Ignorer » / « Supprimer »)

### Contexte

L'utilisateur identifie une **source** qui ne l'intéresse pas : groupe bavard, démarchage récurrent, fil personnel sans enjeu professionnel, ou simplement un échange email traité dont il veut se débarrasser. Ce n'est pas un message qu'il veut faire taire, c'est le **fil entier**.

### Traitement

1. **swipe gauche** sur la conversation dans la liste (ou proposition de Relvo à la fermeture d'un sujet — cf. Cas Q). **L'habillage dépend du canal** (2026-07-20) :

   | Canal | Libellé | Couleur |
   |---|---|---|
   | WhatsApp | « **Ignorer** » | **orange** |
   | email | « **Supprimer** » | **rouge** |

2. ⚠️ **si la conversation est écoutée par un ou plusieurs sujets ouverts, une CONFIRMATION s'ouvre d'abord — et elle NOMME ces sujets** :

   > Ignorer cette conversation ? Elle n'alimentera plus **Retard livraison sauce blanche**.

   **Jamais « un ou plusieurs sujets ».** On ne demande pas de confirmer un risque sans dire lequel : une confirmation qui n'apporte pas l'information qu'elle réclame de valider se clique sans être lue et cesse d'être une protection. Si aucun sujet ouvert n'écoute le fil, **pas de confirmation** — il n'y a rien à perdre.

3. ⚠️ **dans les deux cas, le même appel : `ignoreConversation`.** La `Conversation` passe en **`status = ignoré`**. **Aucune donnée n'est supprimée.**
4. ⚠️ **AUCUNE borne de fin n'est posée** : `closing_message_id` reste `null` (2026-07-21)
5. produire un `EventLog` (conversation ignorée, actor: user)

### ⚠️ Ignorer est une PAUSE, pas une FIN

C'est la distinction structurante, et elle est facile à écraser par inadvertance :

| Geste | Nature | Borne de fin | Le sujet… |
|---|---|---|---|
| **Ignorer la conversation** | **PAUSE** | **aucune** | ne disparaît pas ; il **cesse d'être alimenté** par cette conversation |
| **Valider / fermer le sujet** | **FIN** | **posée** | l'écoute **s'arrête** sur le dernier message reçu |
| **Arrêter l'écoute** (depuis la fiche) | **FIN**, ciblée | **posée** | il cesse d'écouter **cette** conversation, garde les autres |

**Pourquoi c'est indispensable.** Ignorer est réversible (Cas R). Si l'ignorance posait une borne de fin, **réactiver la conversation ne servirait à rien** : l'écoute serait déjà close et la réactivation n'aurait aucun effet observable. Parce qu'aucune borne n'est posée, réactiver fait **reprendre** l'alimentation, exactement là où elle s'était arrêtée.

⚠️ **L'ignorance s'applique à TOUS les sujets ouverts qui écoutent le fil**, pas seulement à celui qu'on avait en tête. C'est bien pour cela que la confirmation les nomme.

### ⚠️ Pourquoi « Supprimer » ne supprime rien

Le libellé colle au vocabulaire attendu d'une boîte mail ; le mécanisme, lui, reste l'ignorance. Quatre raisons :

1. **L'email existe toujours dans la boîte Gmail de l'utilisateur** — Relvo n'en a qu'une **copie**. Supprimer la nôtre ne libère rien de ce que l'utilisateur croit libérer.
2. Cela **détruirait notre historique** : sujets, tâches, pièces jointes rattachés à ces messages.
3. Le fil restant chez **Unipile**, un nouveau message sur le même objet **recréerait la conversation**, vide de son passé — un état pire que celui de départ.
4. Ce que l'utilisateur veut réellement, c'est que **ça sorte de sa pile de tri**. C'est exactement ce que fait `ignoré`.

**Habillage différent, mécanisme identique** — et c'est un cas d'école de la garde énoncée plus haut : on diverge sur le mot et la couleur, jamais sur la fonction appelée.

### Résultat

- **Relvo cesse d'analyser, de résumer et de trier** les messages de cette conversation
- **les sujets qu'elle alimentait cessent de l'être** — mais ils **restent ouverts** et gardent tout ce qu'ils portaient déjà
- elle sort du KPI « Sans sujet » et du filtre par défaut ; on la retrouve via le filtre **« Ignorées »**
- **les messages continuent d'arriver et d'être stockés** — on ne perd rien, on cesse seulement de s'en occuper
- seule une action **explicite de l'utilisateur** la réactive, et l'alimentation **reprend** (cf. Cas R)

> **Note historique.** L'ancien Cas N retirait un **message** isolé (`Message.status = ignored`). On ignore désormais la **source**, pas l'événement : écarter les messages un à un ne réglait jamais le problème du groupe bavard.

## Cas O — ⚠️ SUPPRIMÉ — Changement de rattachement d'un message

> **Supprimé le 2026-07-21.** Le rattachement et le détachement **message par message** n'existent plus dans l'interface : le tap sur un message est réservé aux **pièces jointes**, et l'appartenance se règle désormais par **plage d'écoute**. `Message.subject_id` reste dans le modèle, à destination de M7. Le raisonnement complet est en **Cas D** (« renoncement assumé ») ; les gestes qui subsistent sont **Cas T** (remonter une écoute) et **Cas U** (arrêter une écoute).

## Cas P — Complétion d'une fiche contact

### Contexte

L'utilisateur consulte la page Contacts et voit des fiches en statut `auto` marquées "À compléter".

### Exemple

L'IA a créé un contact "Karim Benali" à partir d'une signature email, mais il manque l'entreprise, le numéro de téléphone et le Dossier par défaut.

### Traitement

1. l'utilisateur ouvre la fiche contact
2. il complète ou corrige les informations : nom, entreprise, téléphone, email, Dossier par défaut, notes
3. le contact passe en statut `complete`
4. produire un `EventLog` (contact complété, actor: user)

### Résultat

- `Contact.status = complete`
- le contact disparaît du filtre "À compléter"
- le `default_folder_id` sera utilisé pour faciliter le classement des prochains messages de ce contact

## Cas Q — Fermer un sujet : une SUPPRESSION DOUCE

### Contexte

L'utilisateur juge qu'un sujet ne le concerne pas : échange sans suite, fausse alerte, sujet ouvert à tort. Il le **ferme** plutôt que de le valider — le travail n'a pas été fait, il n'avait simplement pas lieu d'être.

> **Décision du 2026-07-21.** L'utilisateur voyait « fermer » et « supprimer » comme la même action. **C'est un statut, jamais une destruction.**

### Traitement

1. l'utilisateur déclenche **« Fermer »** — geste **swipe gauche** (rouge) sur la carte, **symétrique** de « Valider » (swipe droite, vert — cf. Cas K)
2. le `Subject` passe en **`status = fermé`**, `closed_at` posé — **une date, rien d'autre**. **Toutes ses écoutes s'arrêtent** : `closing_message_id` est posé sur le dernier message reçu de chaque conversation **WhatsApp**, qui redevient orpheline. ⚠️ **Les conversations EMAIL restent rattachées** — il n'y a pas d'écoute à arrêter sur un fil qui *est* le sujet.
3. Relvo enchaîne avec la proposition : « **Souhaitez-vous aussi ignorer la conversation ?** »
   - **oui** → la `Conversation` passe en `ignoré` (cf. Cas N) : le fil cesse d'être analysé et ne repropose plus rien
   - **non** → **WhatsApp** : la conversation reste active, un nouveau message la fera réapparaître dans le KPI « Sans sujet » ; **email** : un nouveau message **rouvrira le sujet** (cf. Cas W)

⚠️ **C'est pour l'email que cette proposition compte le plus.** Fermer un sujet email sans ignorer son fil ne le fait pas taire : le prochain message le rouvrira. Le geste qui met fin à une affaire email est donc **la paire** « Fermer + Ignorer », et c'est exactement pour cela que Relvo les enchaîne.
4. produire les `EventLog` (sujet fermé ; conversation ignorée le cas échéant)

### Résultat

- `Subject.status = fermé` — le sujet quitte le fil des ouverts et rejoint l'onglet **« Fermés »**
- il reste **entièrement récupérable** : bouton **« Remettre »** (cf. Cas V)
- ⚠️ **un sujet fermé n'est JAMAIS purgé** — ni après 15 jours, ni après un an, ni jamais

### ⚠️ Aucune purge des sujets fermés

Il n'existe **aucune rétention, aucune expiration, aucun ménage automatique** sur les sujets fermés. La raison est celle-là même qui impose le vocabulaire « Fermer / Remettre » : **un sujet est le seul endroit où vivent les tâches et le journal des décisions.** Un message purgé par erreur existe encore dans Gmail ; une **tâche** et une **décision datée** purgées n'existent **nulle part ailleurs** — elles ne sont récupérables d'aucune source externe.

Une purge automatique transformerait donc une opération présentée comme réversible en destruction différée, ce qui est la pire des deux options : le vocabulaire promet la réversibilité, le système la retire en silence quelques semaines plus tard.

> **Note historique.** La purge à 15 jours a existé — elle était attachée à l'ancien statut `ignored` du sujet, retiré le 2026-07-20. Elle **ne doit pas être réintroduite** sur `fermé` : l'ignorance portait sur du bruit entrant, la fermeture porte sur un espace de travail.

### Vocabulaire : « Fermer » / « Fermés » / « Remettre » — jamais « Supprimer » / « Corbeille »

Deux raisons, à ne pas réinterpréter :

1. **C'est honnête.** Rien n'est détruit — autant que le mot le dise. Un vocabulaire de destruction pour une opération réversible produit soit l'hésitation (on n'ose plus fermer, la pile enfle), soit la fausse confiance (on croit avoir fait le ménage).
2. **Un sujet est le SEUL endroit où vivent les tâches et le journal des décisions.** Un message supprimé par erreur existe encore dans Gmail ; une **tâche** supprimée par erreur n'existe **nulle part ailleurs**. Le coût d'une fausse manœuvre n'est pas symétrique — le vocabulaire doit refléter cette asymétrie.

### Règle — l'ignorance vit sur la source, pas sur le sujet

C'est le cœur du dispositif anti-« groupe WhatsApp bavard ». Fermer un sujet ne suffit pas : sans ignorance, la conversation redevient orpheline et sollicitera de nouveau l'utilisateur au message suivant. **C'est la conversation qu'on fait taire, pas le sujet** — et c'est pourquoi la proposition d'ignorance est enchaînée automatiquement à la fermeture.

> **Note historique.** « Ignorer un sujet » (`Subject.status = ignored`, ignorance collante, purge à 15 j, onglet « Ignorés ») est **supprimé**. Le geste swipe gauche garde son sens (« écarter ») mais change de cible selon la surface : **Fermer** sur un sujet, **Ignorer** sur une conversation (2026-07-20).

## Cas R — Réactiver une conversation ignorée

### Contexte

L'utilisateur a ignoré une conversation par erreur, ou la situation a changé : ce fournisseur redevient pertinent.

### Traitement

1. depuis la page Conversations, filtre **« Ignorées »**, il déclenche **« Réactiver »**
2. la `Conversation` repasse en **`status = actif`** : Relvo recommence à analyser, résumer et trier ses messages
3. ⚠️ **l'alimentation des sujets REPREND** : puisque l'ignorance n'avait posé **aucune borne de fin** (`closing_message_id = null`, cf. Cas N), les sujets ouverts qui écoutaient cette conversation recommencent à recevoir ses nouveaux messages
4. produire un `EventLog` (conversation réactivée, actor: user)

### Résultat

- `Conversation.status = actif` — elle réintègre le filtre par défaut et, si aucun sujet ouvert ne l'écoute, le **KPI « Sans sujet »**
- **les écoutes mises en pause reprennent** — c'est tout l'intérêt de la distinction pause / fin. Sans elle, « réactiver » serait un bouton sans effet.
- ⚠️ **selon le canal**, la réactivation n'a pas la même portée sur un sujet terminé :
  - **WhatsApp** — un sujet **validé ou fermé** ne se rouvre pas : ses écoutes portent une **borne de fin**. Il faut le **Remettre** (Cas V), ou ouvrir un nouveau sujet.
  - **email** — le fil est resté rattaché ; réactiver la conversation fait donc **reprendre l'alimentation du sujet, et le prochain message le rouvrira** (cf. Cas W). C'est cohérent : réactiver un fil email, c'est dire « je veux de nouveau entendre cette affaire ».

## Cas S — Étendre un sujet à une seconde conversation

### Contexte

Le sujet « Retard livraison sauce blanche », parti du groupe WhatsApp, doit se poursuivre **par email** : l'utilisateur veut prévenir son fournisseur lui-même. Le sujet va porter **deux conversations**.

### Traitement

1. depuis la fiche du sujet, l'utilisateur choisit d'écrire à un interlocuteur qui n'est pas encore dans le sujet
2. le comportement dépend du canal — c'est l'**asymétrie** structurante (cf. `02-modele-donnees.md §5bis`) :
   - **email** → une **nouvelle conversation** de type `objet` est créée, clé `email:<fournisseur>:<objet>`, l'objet étant **pré-rempli avec le titre du sujet**. Ses **deux bornes sont `null`** : la conversation naissant avec le sujet, elle lui appartient **entière** tant que le sujet reste ouvert. Les réponses du fournisseur rejoindront automatiquement cette conversation, donc ce sujet.
   - **WhatsApp direct** → il ne peut exister **qu'une seule** conversation directe par contact : le sujet **commence à écouter** la conversation existante, à partir du premier message envoyé. L'ancre est ici indispensable — sans elle, tout l'historique du fil basculerait dans le sujet.
3. création de la ligne `SubjectConversation(subject_id, conversation_id, anchor_message_id)` — `null` en email, le message de départ en WhatsApp
4. **création du contact** si nécessaire (conversation `objet` ou `direct`)
5. produire les `EventLog`

### Résultat

- le sujet porte **deux conversations**, chacune avec le régime de son canal
- c'est **à ce niveau** que se fait la réunification entre canaux : le fil WhatsApp et le fil email coexistent dans un même espace de travail
- ⚠️ la fiche du sujet n'en affiche **qu'une à la fois** : la **ligne sélecteur** en tête de l'onglet Conversations permet de basculer, et le **composer** suit (cf. Cas U)
- ⚠️ Même bouton côté interface, **deux mécaniques distinctes** : *créer une conversation* (email) ou *commencer à en écouter une* (WhatsApp direct)

## Cas T — Remonter une écoute (WhatsApp) — le MÊME geste que l'ouverture

> **Décision du 2026-07-21.** Ce cas remplace « faire glisser la poignée d'ancre » (2026-07-20), **supprimé** avec le cordon et le drag-and-drop d'ancre.

### Contexte

Un sujet écoute la conversation depuis le message « La palette est bloquée en douane ». En relisant le fil, l'utilisateur voit que l'affaire avait en réalité commencé **trois messages plus haut**.

### Traitement

1. l'utilisateur **swipe vers la droite** le message plus ancien — **exactement le même geste** que pour ouvrir un sujet
2. le système constate qu'un sujet **écoute déjà** cette conversation, et que le message est **antérieur** à l'ancre → l'**écoute remonte** :
   - `SubjectConversation.anchor_message_id` est réécrit sur ce message
   - les messages traversés reçoivent le `subject_id` du sujet
3. produire les `EventLog`

### Pourquoi le même geste, et pas un dispositif dédié

L'utilisateur n'a **qu'une intention** à exprimer — « **l'affaire commence ici** » — et elle ne change pas selon qu'un sujet existe déjà ou non. Un seul geste qui **crée ou étend** selon le contexte, c'est **une règle à retenir au lieu de deux**.

C'est aussi ce qui rend inutile toute mécanique de correction : il n'y a plus de **défaut d'ancre** à réparer, puisqu'il n'y a plus de défaut du tout — l'ancre est **toujours désignée** par l'utilisateur.

> **Ce qui a été supprimé avec ce cas** : le cordon épaissi, la poignée saisissable, le drag-and-drop d'ancre (dnd-kit), et l'aperçu en direct pendant le drag. Un geste de drag précis sur mobile, dans un fil qui défile, pour un réglage que le swipe exprime en une fois : le coût de construction et d'usage était sans rapport avec le gain.

### Résultat

- la plage d'écoute s'étend vers le haut ; le bandeau « Suivi dans » reste inchangé (l'état, lui, ne change pas : la conversation était déjà écoutée)
- ⚠️ **sans objet côté email** : le sujet couvre déjà le fil entier, il n'y a rien à remonter

### Ce que ce geste ne fait PAS

- il ne **réduit** pas une écoute — swiper un message **postérieur** à l'ancre n'ampute pas le sujet. Pour arrêter, on **arrête l'écoute** (Cas U) ;
- il ne déplace pas la **borne de fin** (`closing_message_id`), posée par la validation, la fermeture ou l'arrêt d'écoute. Si l'usage montre le besoin de la déplacer, ce sera **le même geste sur un message**, sans migration.

## Cas U — Changer de conversation, et arrêter une écoute depuis le sujet

### Contexte

Le sujet « Retard livraison sauce blanche » porte **deux conversations** : le groupe WhatsApp d'où il est parti, et le fil email ouvert avec le fournisseur (cf. Cas S). Le groupe s'est remis à parler d'autre chose : l'utilisateur veut que le sujet **cesse de l'écouter**, sans toucher au fil email.

### Traitement

1. dans la fiche du sujet, onglet **Conversations**, une **ligne unique** en tête nomme la conversation affichée : **icône du canal + nom + état d'écoute** (« écoutée depuis le 14 juillet »)
2. l'utilisateur **tape cette ligne** → une **feuille** s'ouvre, listant **toutes** les conversations du sujet, chacune avec son état
3. il peut :
   - **sélectionner** une autre conversation → elle devient la conversation affichée, et le **sélecteur du composer suit**
   - déclencher « **arrêter l'écoute** » sur l'une d'elles → `closing_message_id` est posé sur son dernier message reçu
4. produire les `EventLog`

### Pourquoi une ligne, et pas des onglets ni un carrousel

| Écartée | Raison |
|---|---|
| **Flux chronologique fusionné** | l'email s'affiche **pleine largeur**, WhatsApp en **bulles** : les entremêler produirait exactement le chaos visuel que la divergence par canal cherche à éviter |
| **Carrousel horizontal** | le **swipe est déjà pris** par le geste sur les messages — les deux entreraient en collision |
| **Onglets** | l'onglet Conversations vit déjà dans une barre à 3 onglets (Tâches / Conversations / Détails) : **on ne met pas des onglets dans des onglets** |

La ligne est à la fois le **sélecteur** et la **surface de gestion des écoutes** — cohérent, puisqu'on arrête une écoute là où l'on voit ce qu'elle alimente. Elle coûte **une ligne de hauteur** et **monte à N conversations sans rien changer**.

### Résultat

- la conversation dont l'écoute est arrêtée **redevient orpheline** : elle réapparaîtra dans le KPI « Sans sujet » à son prochain message
- les **autres écoutes du sujet continuent** — c'est toute la différence avec « Valider » ou « Fermer », qui les arrêtent **toutes**
- côté conversation, l'écoute passée reste consultable via le « **N sujets passés** » du bandeau d'en-tête

## Cas V — Remettre un sujet fermé

### Contexte

Un sujet a été **fermé** — à tort, ou parce que la situation a changé. Il porte des **tâches** et un **journal de décisions** qui n'existent nulle part ailleurs.

### Traitement

1. page Sujets, onglet **« Fermés »**, l'utilisateur ouvre le sujet et déclenche **« Remettre »**
2. le `Subject` repasse en **`status = ouvert`**, `closed_at` effacé
3. ⚠️ **« Remettre » ne redémarre PAS les écoutes** : leurs bornes de fin restent posées. L'utilisateur relance celle qu'il veut, par **swipe droite sur un message** (WhatsApp). Côté **email**, il n'y a **rien à redémarrer** : le fil n'a jamais été détaché, il est le sujet — et il l'alimente de nouveau puisque le sujet est redevenu `ouvert`.
4. produire un `EventLog` (sujet remis, actor: user)

### Pourquoi « Remettre » et pas « Restaurer » ni « Annuler la suppression »

**Parce que rien n'a été supprimé.** « Fermer » range le sujet, « Remettre » le ressort : deux mots du même registre, qui décrivent exactement l'opération effectuée. Un vocabulaire de restauration laisserait entendre qu'il y a eu destruction — et ferait craindre, à chaque fermeture, de perdre quelque chose.

### Pourquoi « Remettre » ne redémarre pas les écoutes

Un sujet WhatsApp fermé il y a trois semaines, dont l'écoute reprendrait d'un coup, **avalerait d'un bloc tout ce que la conversation a charrié entre-temps** — trois semaines de bavardage de groupe versées dans une affaire qu'on vient à peine de reprendre. **Remettre un sujet dit « je reprends cette affaire », pas « rattrape tout ce que j'ai manqué ».** Relancer une écoute est un geste séparé, et c'est le même que d'habitude (swipe droite sur le message où l'on veut repartir).

Le raisonnement ne s'applique pas à l'email, et c'est logique : un fil email ne charrie **que** cette affaire, il n'y a donc rien à « avaler ».

### Résultat

- le sujet réapparaît dans le feed des ouverts, avec ses tâches et son journal intacts
- ses conversations **WhatsApp** restent orphelines tant qu'une écoute n'a pas été relancée
- ses conversations **email** l'alimentent de nouveau immédiatement

## Cas W — Un email arrive sur un sujet terminé : le fil ROUVRE le sujet

> **Rétabli le 2026-07-21.** Cette règle avait été retirée le matin même, par généralisation abusive d'une phrase qui ne visait que les **écoutes** (donc WhatsApp). Un sujet email n'écoute rien : il **EST** le fil.

### Contexte

Le sujet « Retard livraison sauce blanche » a été **validé** il y a trois jours : la livraison était reprogrammée, l'affaire semblait close. Karim Benali répond dans le même fil : « Finalement je ne pourrai pas livrer jeudi non plus. »

### Traitement

1. réception normale (cas A) → le message rejoint sa conversation `email:karim@sogood.fr:retard livraison sauce blanche`
2. cette conversation est **rattachée** au sujet — elle l'est restée à la validation, puisqu'il n'y avait aucune écoute à arrêter
3. le message reçoit **le `subject_id` du sujet**, quel que soit le statut de celui-ci
4. ⚠️ **le sujet repasse en `status = ouvert`**, `closed_at` est effacé ; `last_activity_at` remonte
5. `EventLog` : sujet rouvert par activité entrante (actor: `system`)

### Résultat

- le sujet **remonte dans le fil des ouverts**, avec ses tâches et son journal intacts
- le message est **lisible là où l'utilisateur le cherchera** : dans l'affaire, pas dans une pile de tri
- Relvo relit la situation : il peut proposer de nouvelles tâches, lever `waiting_for_reply`, ou re-suggérer la validation

### Pourquoi c'est la bonne règle — l'enjeu, concrètement

Un fournisseur relance sur une affaire validée il y a trois jours. Deux issues possibles :

- **son message rouvre le sujet** et remonte dans le fil → l'utilisateur le voit ;
- **son message s'y range en silence** → l'utilisateur rate **exactement le message qu'il ne fallait pas rater**.

**De l'activité sur une affaire signifie qu'elle est vivante.** Un fil qui repart n'est pas un fil clos, quoi qu'en dise un statut posé trois jours plus tôt : le statut décrit ce que l'utilisateur *croyait* au moment où il l'a posé, le message entrant décrit ce qui *est*. Quand les deux se contredisent, c'est le message qui a raison.

### Le seul geste qui fait taire un fil email : ignorer la conversation

Si l'utilisateur ne veut vraiment plus rien entendre de ce fil, il **ignore la conversation** (Cas N). C'est délibéré, nommé, réversible — et c'est le geste que Relvo lui propose déjà à chaque validation et à chaque fermeture (Cas K, Cas Q). **Un statut de sujet ne fait pas taire une source ; seule l'ignorance de la source le fait.** C'est le même principe qui fait vivre l'ignorance sur la conversation et non sur le sujet (cf. Cas Q, « l'ignorance vit sur la source »).

### Ce que ce cas n'est PAS

- ⚠️ **Ce n'est pas la règle WhatsApp.** Un message qui arrive après l'arrêt d'une écoute **ne rouvre rien** : la conversation redevient orpheline et sollicite l'utilisateur via le KPI « Sans sujet ». Là, la conversation n'est pas l'affaire — rouvrir sur ce message serait un pari sur son contenu.
- **Ce n'est pas « Remettre ».** « Remettre » (Cas V) est un geste **utilisateur** sur un sujet **fermé**, qui ne redémarre aucune écoute. La réouverture décrite ici est **automatique**, déclenchée par une **arrivée de message**, et propre à l'email.
