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
6. si la conversation porte un **sujet `ouvert`** (via `SubjectConversation`), rattacher le message à ce sujet (`subject_id`) — c'est la **règle d'ancrage** ; sinon `subject_id = null`
7. produire les événements de journal (`EventLog`)

**Règle fondamentale** : le rangement en conversation **ne peut pas échouer**. Tout message a une place dès la première seconde, sans qu'aucune IA n'ait à comprendre quoi que ce soit. **Il n'y a plus de message « Sans sujet »** — il y a des **conversations dont le dernier message n'est couvert par aucun sujet**, et ce sont elles qui sollicitent l'utilisateur (KPI « Sans sujet »).

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

## Cas B — Ouvrir un sujet : deux parcours, un seul domaine

> **Décision du 2026-07-20.** Le parcours d'ouverture **diverge par canal**, parce que l'ancre n'est que la **prothèse d'un objet manquant** (cf. `01-principes.md §3`). La logique métier appelée reste **la même** — seul le point d'entrée et le périmètre balayé changent.

| | **B1 — WhatsApp** | **B2 — email** |
|---|---|---|
| Point d'entrée | **tap sur un message** (ou swipe droite sur la conversation) | **swipe droite sur la conversation** — pas de tap message |
| Ancre | le message choisi | **`null`** |
| Périmètre balayé | messages **≥ ancre** | **tout le fil, amont ET aval** |

### B1 — WhatsApp : ouvrir depuis un message d'ancrage

**Exemple.** Dans le groupe « Tasty Crousty Marne‑la‑Vallée », l'utilisateur repère le message qui lance vraiment l'affaire : « La livraison de sauce blanche a 3 jours de retard ». C'est de **là** que le sujet doit partir.

#### Traitement

1. l'utilisateur ouvre la conversation, tape sur ce message → **pop-up**
2. le message n'est rattaché à aucun sujet → la pop-up propose **« Ouvrir un sujet »** ou **« Rattacher à un sujet existant »**
3. il choisit « Ouvrir un sujet » :
   - création du `Subject` en `status = ouvert`, titre pré-rempli (nom du groupe ou du contact), domaine hérité de `Message.folder_id`
   - création de `SubjectConversation(subject_id, conversation_id, anchor_message_id = ce message)`
   - **tous les messages ≥ ancre** reçoivent `subject_id`
   - **création automatique du contact** si la conversation est de type **direct** ; **aucun contact** si elle est de type **groupe**
4. `EventLog` : sujet ouvert, contact créé le cas échéant

#### Résultat

Les messages **antérieurs** à l'ancre restent dans la conversation sans appartenir au sujet. Le **cordon de couleur** apparaît dans la conversation à partir de l'ancre. La conversation sort du KPI « Sans sujet ». L'ancre reste **visible et déplaçable** depuis le sujet (cf. Cas T).

#### Variante — swipe droite sans désigner de message

L'utilisateur qui swipe la conversation vers la droite ne choisit **pas** d'ancre : **un défaut réparable en un geste bat un choix imposé à chaque fois**. Le défaut est calculé :

| Situation | Ancre posée | Pourquoi |
|---|---|---|
| La conversation a **déjà porté** un sujet | le **plus ancien message non couvert** par un sujet, borné par la fenêtre précédente | ce sont exactement les messages **non triés** — c'est pour eux que la conversation apparaît dans « Sans sujet » |
| La conversation **n'a JAMAIS porté** de sujet | le **dernier** message | ⚠️ sinon le défaut remonterait à des **mois** d'historique. On ne devine pas |

Pas de sélecteur dans le parcours du swipe : il deviendrait redondant avec le tap message et perdrait sa vitesse, et il exigerait une décision au mauvais moment — le geste réel est « **ça devient un sujet** », le « où ça commence » vient après.

### B2 — Email : ouvrir depuis la conversation, ancre nulle

**Exemple.** Six emails ont déjà été échangés avec SoGood Distribution sous l'objet « Retard livraison sauce blanche ». L'utilisateur décide d'en faire un sujet.

#### Traitement

1. l'utilisateur **swipe la conversation vers la droite** (ou utilise l'action « Ouvrir un sujet » de la conversation) — il n'y a **pas** d'ouverture depuis un message
2. création du `Subject` en `status = ouvert`, titre pré-rempli avec l'**objet de l'email**, domaine hérité de `Message.folder_id`
3. création de `SubjectConversation(subject_id, conversation_id, anchor_message_id = **null**)`
4. ⚠️ **balayage de la conversation ENTIÈRE** : **tous** les messages du fil reçoivent `subject_id`, **y compris ceux antérieurs** à l'ouverture du sujet
5. **création automatique du contact** (conversation de type `objet`)
6. `EventLog` : sujet ouvert, contact créé le cas échéant

#### Résultat

Le sujet porte les **six** emails, pas le dernier. Le cordon de couleur couvre **tout** le fil.

⚠️ **Piège d'implémentation.** La règle en place ne balaie que les messages **postérieurs ou égaux à l'ancre** — héritage WhatsApp, où elle est juste. Appliquée telle quelle à l'email, elle produirait un sujet à **un seul message** sur un fil de six. C'est le point le plus coûteux à rater de cette décision.

**Pourquoi aucune ancre côté email ?** Parce que l'**objet** *est* déjà la délimitation de l'affaire, posée par l'expéditeur lui-même. Une ancre n'y ajouterait rien : elle ne pourrait que retrancher le début du fil.

## Cas C — Un nouveau message arrive pendant qu'un sujet est ouvert

### Exemple

Le fournisseur répond dans le même fil : « Livraison reprogrammée jeudi ».

### Traitement

1. réception normale (cas A) → le message rejoint sa conversation
2. la conversation porte un sujet `ouvert` → le message reçoit **automatiquement** son `subject_id` (règle d'ancrage)
3. `last_activity_at` du sujet est remonté
4. Relvo peut lever `waiting_for_reply`, proposer des tâches, suggérer la validation

### Résultat

Le message apparaît **à la fois** dans la conversation (cordon continu) et dans la fiche du sujet. Le statut du sujet reste **`ouvert`** — seuls les **marqueurs** bougent (« À faire », « En attente », pastille de non-lus sur la conversation).

## Cas D — Deux sujets entrelacés dans une conversation directe

### Exemple

Karim, en WhatsApp direct, alterne : sauce blanche, facture emballages, sauce blanche. Un seul fil, deux affaires. C'est le cas que le modèle existe pour traiter.

### Traitement

1. un sujet « Retard sauce blanche » est ouvert sur la conversation → les nouveaux messages lui sont rattachés **par défaut**
2. le message sur la facture arrive et se retrouve donc, à tort, dans ce sujet
3. l'utilisateur tape ce message → la pop-up affiche le sujet rattaché → il le **détache**, puis le **rattache à un sujet existant** (ou en ouvre un autre)
4. `EventLog` pour chaque déplacement

### Résultat

Dans la conversation, le **cordon se brise** : les points alternent entre la couleur du domaine « Fournisseurs » et celle de « Comptabilité ». Cette rupture visuelle *est* l'information — elle dit que le fil mélange deux affaires.

Deux règles s'appliquent :

- rattacher un message **isolé** au second sujet **ne déplace pas la fenêtre active** : les messages suivants continuent d'aller au sujet ancré ;
- si le message **d'ancrage** est détaché, l'**ancre glisse** au message suivant du sujet.

> En V1, seul l'utilisateur fait ces corrections. En M7, c'est Relvo qui les proposera — **par la même mécanique**, sans changement de modèle.

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

- si c'est un nouveau sujet : `Subject.status = acknowledged` (jamais ouvert → marqueur dérivé **« Nouveau »**)
- si c'est un sujet existant : le **statut reste inchangé** (`acknowledged`) ; le nouveau message allume la **pastille de non-lus**, et s'il répond à une attente, Relvo lève `waiting_for_reply`

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

- `Subject.status` inchangé (`acknowledged` ; marqueur **« Nouveau »** si le sujet vient d'être créé) **+ marqueur « À faire »**

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

- `Subject.waiting_for_reply = true` (marqueur), `status` **inchangé** (`acknowledged`)

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
   - sujet réglé → Relvo **suggère « Terminer »** (`resolution_suggested_at`) ; la clôture reste humaine
   - message informatif sans action → **pastille de non-lus** seule
   - toujours en attente d'un autre tiers → Relvo repose **`waiting_for_reply = true`**
5. produire les `EventLog`

## Cas K — Validation du sujet (fermeture de la fenêtre)

### Conditions possibles

Le sujet peut être validé si :

- les tâches principales sont terminées
- la situation est stabilisée
- aucun nouvel échange critique n'est attendu
- aucun blocage ne subsiste

### Traitement

1. constater que le travail utile est terminé
2. l'utilisateur déclenche l'action **« Valider »** (bouton sur la fiche, ou swipe droite sur la carte) → `status = validé`, `closed_at` posé. L'IA peut l'avoir **suggérée** mais ne l'applique jamais elle-même.
3. **la fenêtre se fige** : les conversations portées par ce sujet **redeviennent orphelines** (leurs futurs messages ne lui seront plus rattachés)
4. Relvo propose : « **Souhaitez-vous aussi ignorer la conversation ?** » (cf. Cas N)
5. produire un `EventLog`

### Résultat

- `Subject.status = validé` (libellé UI : **« Validé »**), `closed_at` renseigné
- les conversations concernées **réapparaissent dans le KPI « Sans sujet »** dès qu'un nouveau message y arrive sans rattachement

### Remarque

L'IA peut suggérer la validation ("Résolution suggérée") mais ne clôt jamais un sujet d'elle-même. C'est toujours l'utilisateur qui confirme.

**Il n'y a pas de réouverture d'un sujet clos.** Un nouveau message sur la conversation n'y revient pas : c'est un **nouveau** sujet qui sera ouvert, depuis une nouvelle ancre, si l'utilisateur le souhaite.

> **Note historique.** « Terminer » / `resolved` devient « **Valider** » / `validé` (2026-07-20). La réouverture automatique d'un sujet `resolved` recevant un nouveau message est **supprimée** : elle contredisait la métaphore de la fenêtre.

## Cas L — ⚠️ CADUC — Archivage du sujet (système)

> **Caduc depuis le 2026-07-20.** Le statut `archived` est **retiré** du modèle : il n'exprimait rien qu'une fermeture n'exprime déjà. Un sujet finit désormais **validé** (travail fait) ou **fermé** (écarté) — cf. Cas K et Cas Q. Il n'y a plus d'archivage automatique.

## La page Conversations — le tri, pas une boîte mail

> Préambule aux cas M, N, O. Relvo **n'est pas un client de messagerie** : la surface de travail reste le **Sujet** (invariant n°4). La page `/conversations` est un **outil de tri**, volontairement **hors navigation** : on l'atteint par le **KPI « Sans sujet »** de la page Sujets, et par défaut elle ne montre que **ce qui n'est pas traité**.

Caractéristiques de la liste :

- une ligne par **conversation** (et non par message) : titre, interlocuteur (contact **ou** groupe), icône de canal, type
- **tri par activité** : la conversation dont le dernier message est le plus récent remonte en tête
- **non-lu** = fond distinct, police grasse, **pastille compteur** ; `read_at` se pose à l'ouverture de la **conversation**
- **trois filtres** : **Sans sujet** (défaut — dernier message non rattaché), **Ignorées**, **Toutes** ; plus un filtre par **canal**
- **swipe gauche = écarter la conversation** (cf. Cas N) — libellé et couleur **par canal**, mécanisme unique
- **swipe droite = ouvrir un sujet** (cf. Cas B), sur les deux canaux
- ouvrir une conversation affiche ses messages en **timeline**, avec le **cordon de sujet** (cf. `02-modele-donnees.md §7`)

### Rendu par canal — décision du 2026-07-20

Après test en production de M6bis : forcer la même UX sur l'email et sur WhatsApp dessert les deux, pour deux raisons — la **taille et la forme** des messages email, et le **système d'objet**, inexistant en WhatsApp (sauf partiellement via le groupe).

| | email | WhatsApp |
|---|---|---|
| Rendu d'un message | **pleine largeur**, enchaînés au fil du scroll | **bulles** |
| Fond | **blanc dans les deux sens**, jamais teinté | teinté |
| Entrant / sortant | l'**en-tête** porte l'info (avatar + expéditeur + date) ; le sortant se signale par « **Moi** » + un **rail de couleur discret** à gauche | position et teinte de la bulle |
| Tap sur un message | **aucun** | pop-up (cf. Cas M, D, O) |
| Ouvrir un sujet | **depuis la conversation uniquement** | depuis la conversation **ou** un message |
| Swipe gauche | « **Supprimer** », **rouge** | « **Ignorer** », **orange** |

⚠️ **Pas de fond coloré sur l'email.** Sur du texte long, un fond teinté fatigue et abîme la lisibilité — or c'est exactement ce qu'on vient chercher en sortant de la bulle. Gmail, Superhuman et Outlook font le même choix. Si la distinction s'avère insuffisante à l'usage, on ajoutera une teinte **très légère au sortant seulement**, jamais aux deux.

> ⚠️ **La divergence s'arrête au rendu et aux gestes.** Ouverture de sujet, ancre, rattachement, détachement, ignorance, statuts : **tout le domaine reste commun**. Le jour où l'on duplique la logique métier « parce que l'email est différent », on aura deux produits.

> **Note historique.** La page `/messages` affichait une **pile de messages orphelins** (`subject_id = null`), avec rétention 15 jours et une page de détail par message (`/messages/[id]`). Les deux disparaissent : il n'y a plus de message orphelin, et le détail se lit dans la conversation.

## Cas M — Rattacher un message à un sujet existant

### Contexte

Un message n'est rattaché à aucun sujet (ou l'est au mauvais), et l'utilisateur sait à quel sujet **déjà ouvert** il appartient. C'est le pendant du Cas B (*ouvrir* un sujet) : ici on **rejoint** un sujet existant.

> ⚠️ **WhatsApp uniquement** (2026-07-20). Le tap sur message n'existe plus côté email : une conversation email est déjà délimitée par son objet, et son fil entier appartient au sujet — il n'y a pas de message isolé à rattacher.

### Traitement

1. dans la conversation, l'utilisateur tape le message → **pop-up**
2. il choisit **« Rattacher à un sujet existant »** et sélectionne le sujet
3. le `Message` reçoit son `subject_id` (`status = linked`)
4. produire un `EventLog` (message rattaché, actor: user)

### Résultat

- le message rejoint le fil du sujet et son point prend la **couleur du domaine** de ce sujet dans le cordon
- ⚠️ **la fenêtre active ne bouge pas** : rattacher un message isolé **ne pose pas d'ancre**. Les messages suivants continuent d'aller au sujet ancré sur cette conversation (cf. Cas D)

## Cas N — Écarter une conversation (« Ignorer » / « Supprimer »)

### Contexte

L'utilisateur identifie une **source** qui ne l'intéresse pas : groupe bavard, démarchage récurrent, fil personnel sans enjeu professionnel, ou simplement un échange email traité dont il veut se débarrasser. Ce n'est pas un message qu'il veut faire taire, c'est le **fil entier**.

### Traitement

1. **swipe gauche** sur la conversation dans la liste (ou proposition de Relvo à la fermeture d'un sujet — cf. Cas Q). **L'habillage dépend du canal** (2026-07-20) :

   | Canal | Libellé | Couleur |
   |---|---|---|
   | WhatsApp | « **Ignorer** » | **orange** |
   | email | « **Supprimer** » | **rouge** |

2. ⚠️ **dans les deux cas, le même appel : `ignoreConversation`.** La `Conversation` passe en **`status = ignoré`**. **Aucune donnée n'est supprimée.**
3. produire un `EventLog` (conversation ignorée, actor: user)

### ⚠️ Pourquoi « Supprimer » ne supprime rien

Le libellé colle au vocabulaire attendu d'une boîte mail ; le mécanisme, lui, reste l'ignorance. Quatre raisons :

1. **L'email existe toujours dans la boîte Gmail de l'utilisateur** — Relvo n'en a qu'une **copie**. Supprimer la nôtre ne libère rien de ce que l'utilisateur croit libérer.
2. Cela **détruirait notre historique** : sujets, tâches, pièces jointes rattachés à ces messages.
3. Le fil restant chez **Unipile**, un nouveau message sur le même objet **recréerait la conversation**, vide de son passé — un état pire que celui de départ.
4. Ce que l'utilisateur veut réellement, c'est que **ça sorte de sa pile de tri**. C'est exactement ce que fait `ignoré`.

**Habillage différent, mécanisme identique** — et c'est un cas d'école de la garde énoncée plus haut : on diverge sur le mot et la couleur, jamais sur la fonction appelée.

### Résultat

- **Relvo cesse d'analyser, de résumer et de trier** les messages de cette conversation
- elle sort du KPI « Sans sujet » et du filtre par défaut ; on la retrouve via le filtre **« Ignorées »**
- **les messages continuent d'arriver et d'être stockés** — on ne perd rien, on cesse seulement de s'en occuper
- seule une action **explicite de l'utilisateur** la réactive (cf. Cas R)

> **Note historique.** L'ancien Cas N retirait un **message** isolé (`Message.status = ignored`). On ignore désormais la **source**, pas l'événement : écarter les messages un à un ne réglait jamais le problème du groupe bavard.

## Cas O — Changement de rattachement d'un message

### Contexte

Un message est rattaché au mauvais sujet — typiquement parce que la **règle d'ancrage** l'a versé par défaut dans le sujet ouvert, alors qu'il relève d'une autre affaire (cas des sujets **entrelacés**, cf. Cas D).

> ⚠️ **WhatsApp uniquement** (2026-07-20) : le tap sur message n'existe plus côté email. L'entrelacement est d'ailleurs un problème de **flux**, donc de WhatsApp — en email, l'objet sépare déjà les affaires.

### Traitement

1. dans la conversation, l'utilisateur tape le message → la pop-up affiche **le sujet rattaché**
2. il peut :
   - **détacher** le message (`subject_id = null`) — il reste dans sa conversation, son point devient **creux** dans le cordon
   - **déplacer** le message vers un autre sujet (`subject_id` modifié)
3. produire les `EventLog` (message détaché ou déplacé, actor: user)

### Résultat

- le **cordon se recompose** : les couleurs alternent là où les sujets s'entrelacent
- si le message détaché était l'**ancre**, l'**ancre glisse** au message suivant du sujet — *sans objet sur une conversation email, dont l'ancre est `null`*
- le journal de bord trace le changement

> En V1 ces corrections sont manuelles. En M7, Relvo les proposera — **par la même mécanique**.

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

## Cas Q — Fermer un sujet (« Fermer »)

### Contexte

L'utilisateur juge qu'un sujet ne le concerne pas : échange sans suite, fausse alerte, sujet ouvert à tort. Il le **ferme** plutôt que de le valider — le travail n'a pas été fait, il n'avait simplement pas lieu d'être.

### Traitement

1. l'utilisateur déclenche **« Fermer »** — geste **swipe gauche** (rouge) sur la carte, **symétrique** de « Valider » (swipe droite, vert — cf. Cas K)
2. le `Subject` passe en **`status = fermé`**, `closed_at` posé. La **fenêtre se fige** ; les conversations portées **redeviennent orphelines**
3. Relvo enchaîne avec la proposition : « **Souhaitez-vous aussi ignorer la conversation ?** »
   - **oui** → la `Conversation` passe en `ignoré` (cf. Cas N) : le fil cesse d'être analysé et ne repropose plus rien
   - **non** → la conversation reste active ; un nouveau message la fera réapparaître dans le KPI « Sans sujet »
4. produire les `EventLog` (sujet fermé ; conversation ignorée le cas échéant)

### Résultat

- `Subject.status = fermé` — le sujet quitte le fil des ouverts

### Règle — l'ignorance vit sur la source, pas sur le sujet

C'est le cœur du dispositif anti-« groupe WhatsApp bavard ». Fermer un sujet ne suffit pas : sans ignorance, la conversation redevient orpheline et sollicitera de nouveau l'utilisateur au message suivant. **C'est la conversation qu'on fait taire, pas le sujet** — et c'est pourquoi la proposition d'ignorance est enchaînée automatiquement à la fermeture.

> **Note historique.** « Ignorer un sujet » (`Subject.status = ignored`, ignorance collante, purge à 15 j, onglet « Ignorés ») est **supprimé**. Le geste swipe gauche garde son sens (« écarter ») mais change de cible selon la surface : **Fermer** sur un sujet, **Ignorer** sur une conversation (2026-07-20).

## Cas R — Réactiver une conversation ignorée

### Contexte

L'utilisateur a ignoré une conversation par erreur, ou la situation a changé : ce fournisseur redevient pertinent.

### Traitement

1. depuis la page Conversations, filtre **« Ignorées »**, il déclenche **« Réactiver »**
2. la `Conversation` repasse en **`status = actif`** : Relvo recommence à analyser, résumer et trier ses messages
3. produire un `EventLog` (conversation réactivée, actor: user)

### Résultat

- `Conversation.status = actif` — elle réintègre le filtre par défaut et, si son dernier message n'est rattaché à aucun sujet, le **KPI « Sans sujet »**
- **aucun sujet n'est rouvert** : les sujets clos le restent. C'est à l'utilisateur d'en ouvrir un nouveau depuis une ancre s'il le souhaite

## Cas S — Étendre un sujet à une seconde conversation

### Contexte

Le sujet « Retard livraison sauce blanche », parti du groupe WhatsApp, doit se poursuivre **par email** : l'utilisateur veut prévenir son fournisseur lui-même. Le sujet va porter **deux conversations**.

### Traitement

1. depuis la fiche du sujet, l'utilisateur choisit d'écrire à un interlocuteur qui n'est pas encore dans le sujet
2. le comportement dépend du canal — c'est l'**asymétrie** structurante (cf. `02-modele-donnees.md §5bis`) :
   - **email** → une **nouvelle conversation** de type `objet` est créée, clé `email:<fournisseur>:<objet>`, l'objet étant **pré-rempli avec le titre du sujet**. Son **ancre est `null`** : la conversation naissant avec le sujet, elle lui appartient **entière**, et le restera. Les réponses du fournisseur rejoindront automatiquement cette conversation, donc ce sujet.
   - **WhatsApp direct** → il ne peut exister **qu'une seule** conversation directe par contact : la conversation **existante est rattachée** au sujet, avec une **nouvelle ancre** posée sur le premier message envoyé. L'ancre est ici indispensable — sans elle, tout l'historique du fil basculerait dans le sujet.
3. création de la ligne `SubjectConversation(subject_id, conversation_id, anchor_message_id)` — `null` en email, le message de départ en WhatsApp
4. **création du contact** si nécessaire (conversation `objet` ou `direct`)
5. produire les `EventLog`

### Résultat

- le sujet porte **deux conversations**, chacune avec le **régime d'ancre de son canal**
- c'est **à ce niveau** que se fait la réunification entre canaux : le fil WhatsApp et le fil email coexistent dans une même fenêtre de travail
- ⚠️ Même bouton côté interface, **deux mécaniques distinctes** : *créer* (email) ou *rattacher avec une nouvelle ancre* (WhatsApp direct)

## Cas T — Déplacer l'ancre d'un sujet (WhatsApp)

> Nouveau cas, décision du 2026-07-20. Corollaire direct du principe « **un défaut réparable en un geste bat un choix imposé à chaque fois** » : puisqu'on ne demande pas l'ancre au moment du swipe, il faut pouvoir la corriger après.

### Contexte

Un sujet a été ouvert par swipe droite sur une conversation WhatsApp. L'ancre par défaut est trop basse (l'affaire avait commencé trois messages plus haut) ou trop haute (elle embarque du bavardage sans rapport).

### Traitement

1. depuis la fiche du sujet, l'utilisateur voit **où le sujet commence** — l'ancre est matérialisée par un repère « **le sujet commence ici** »
2. il la **déplace** sur un autre message de la conversation
3. `SubjectConversation.anchor_message_id` est mis à jour et l'appartenance **recomposée** :
   - **remonter** l'ancre → les messages antérieurs **entrent** dans le sujet
   - **descendre** l'ancre → les messages traversés **sortent** du sujet (`subject_id = null`)
4. produire les `EventLog`

### Résultat

- le **cordon** s'allonge ou se raccourcit dans la conversation
- ⚠️ **sans objet côté email** : `anchor_message_id = null`, le fil entier appartient au sujet, il n'y a pas de repère à déplacer
- les messages **explicitement rattachés à un autre sujet** ne sont pas repris par un déplacement d'ancre : la décision manuelle prime sur le défaut (cf. Cas D et M)
