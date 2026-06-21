# 3. Cas d’usage

## Principe général

Lorsqu'un message est reçu, le système suit cette logique :

1. identifier le canal source (`Channel`)
2. enregistrer le `Message` avec les informations brutes de l'expéditeur (`sender_raw`)
3. chercher un `Contact` existant correspondant à l'expéditeur (par email ou téléphone)
4. tenter de comprendre le message :
   - **s'il est incompréhensible** : le message reste "Sans sujet" (`subject_id = null`), sans contact créé, en attente de tri humain
   - **s'il est compréhensible** :
     - si aucun contact n'existe → créer un `Contact` en statut `auto` avec les informations disponibles
     - déterminer s'il appartient à un sujet existant ou s'il faut en créer un nouveau
5. si un sujet est identifié ou créé : générer éventuellement des tâches
6. produire les événements de journal (`EventLog`)
7. mettre à jour le **statut** (cycle de vie) et/ou les **marqueurs** du sujet (cf. `02-modele-donnees.md §6` — les deux axes ne se confondent pas)

**Règle fondamentale** : l'IA ne crée un sujet que si elle a suffisamment compris la situation. En cas de doute, elle ne force pas la création — le message reste "Sans sujet" et c'est l'utilisateur qui tranchera.

**Règle sur les contacts** : un contact n'est créé que lorsqu'un sujet est créé. Un message "Sans sujet" ne génère jamais de contact. Cela garantit que la base de contacts ne contient que des interlocuteurs réels et pertinents.

## Cas A — Message compris d'un nouveau contact

### Exemple

Un fournisseur inconnu envoie un email pour signaler un retard de livraison. Le message est clair et exploitable.

### Traitement

1. identifier le `Channel`
2. créer le `Message` avec `sender_raw` (email ou téléphone de l'expéditeur)
3. aucun `Contact` existant trouvé
4. l'IA comprend le contenu → créer un `Contact` en statut `auto` avec les informations extraites du message (nom depuis la signature, entreprise si détectable)
5. créer un nouveau `Subject`, rattacher le contact comme `primary_contact_id`
6. identifier le `Folder` (ex: Fournisseurs)
7. générer les `Task` déductibles du message, s'il y en a
8. créer les `EventLog` : message reçu, contact créé, sujet créé, tâches créées si applicable

### Résultat possible

- **Cas A1** — Compris, sans tâche identifiable : `Subject.status = new`, aucun marqueur.
- **Cas A2** — Compris, avec tâches : `Subject.status = new` **+ marqueur « À faire »** (≥ 1 tâche ouverte). Les tâches ne changent pas le statut — « À faire » est un marqueur dérivé.

## Cas B — Message compris d'un contact connu, sans sujet ouvert pertinent

### Exemple

Un fournisseur connu écrit sur un nouveau problème, distinct de ses échanges précédents.

### Traitement

1. retrouver le `Contact`
2. créer le `Message`
3. chercher un `Subject` ouvert pertinent parmi les sujets du contact
4. aucun sujet suffisamment proche → créer un nouveau `Subject`
5. utiliser pour le cadrage : le `Channel`, le Folder habituel du contact (`default_folder_id`), le contenu du message
6. générer les `Task` déductibles du message, s'il y en a
7. créer les `EventLog`

### Résultat possible

- `new`, sans marqueur (compris sans tâche)
- `new` **+ marqueur « À faire »** (compris avec tâches)

## Cas C — Message compris d'un contact connu, rattaché à un sujet existant

### Exemple

Le fournisseur répond dans une conversation déjà engagée sur un sujet ouvert.

### Traitement

1. retrouver les sujets ouverts du contact
2. comparer le nouveau message avec les sujets existants en utilisant :
   - `external_thread_id` (continuité technique email)
   - `Channel`
   - Folder
   - similarité sémantique du contenu
   - proximité temporelle
3. si le score est suffisant → rattacher le message au sujet existant
4. sinon → créer un nouveau sujet (retour au Cas B)
5. une fois le sujet choisi :
   - relire le contenu du message
   - créer de nouvelles `Task` si nécessaire
   - ou mettre à jour le statut du sujet
6. créer les `EventLog`

### Résultat possible

Le `status` (cycle de vie) d'un sujet déjà ouvert reste **`acknowledged`** ; c'est l'affaire des **marqueurs** :

- **Cas C1** — Le message ouvre de nouvelles tâches : marqueur **« À faire »** activé + **pastille de non-lus**. Statut inchangé.
- **Cas C2** — Le message apporte la réponse attendue : Relvo **lève `waiting_for_reply`** (le badge « En attente » disparaît) + pastille de non-lus ; le sujet peut devenir candidat à « Terminer » (résolution suggérée).
- **Cas C3** — Le message est purement informatif, sans action requise : **pastille de non-lus** uniquement, aucun changement de statut ni de tâche.

## Cas D — Message que l'IA ne parvient pas à traiter

### Conditions

Le message :

- est trop court ou trop vague
- vient d'un contact inconnu sans contexte
- est contradictoire
- ressemble à de la prospection sans certitude
- ne permet pas d'identifier clairement une situation métier

### Traitement

1. créer le `Message` avec `sender_raw`
2. aucun `Contact` existant trouvé
3. l'IA ne comprend pas suffisamment le message
4. **ne pas créer de contact** — l'expéditeur reste identifié uniquement par `sender_raw`
5. **ne pas créer de sujet** — le message reste avec `subject_id = null`
6. produire un `EventLog` (message reçu, sans affectation, sans contact)

### Résultat

Le message apparaît comme "Sans sujet" dans l'interface. L'expéditeur est affiché via `sender_raw` (par exemple "[j.morel@email.com](mailto:j.morel@email.com)" ou "+336 12 34 56 78") puisqu'aucun contact n'existe encore.

### Exemples concrets

- "Suite à notre échange de la semaine dernière, je me permets de revenir vers vous concernant notre offre." — contact inconnu, intention floue
- "Ok merci" — trop court, pas de contexte
- "Pouvez-vous me rappeler ?" — sans identification claire du sujet

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

- si c'est un nouveau sujet : `Subject.status = new`
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

- `Subject.status` inchangé (`new` si le sujet vient d'être créé) **+ marqueur « À faire »**

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

## Cas K — Résolution du sujet

### Conditions possibles

Le sujet peut être considéré comme résolu si :

- les tâches principales sont terminées
- la situation est stabilisée
- aucun nouvel échange critique n'est attendu
- aucun blocage ne subsiste

### Traitement

1. constater que le travail utile est terminé
2. l'utilisateur déclenche l'action **« Terminer »** (bouton sur la fiche, ou swipe droite sur la carte) → `status = resolved`. L'IA peut l'avoir **suggérée** mais ne l'applique jamais elle-même.
3. produire un `EventLog`

### Résultat

- `Subject.status = resolved` (libellé UI : **« Terminé »**)

### Remarque

L'IA peut suggérer la résolution (visible comme "Résolution suggérée" dans l'interface) mais ne peut pas résoudre un sujet d'elle-même. C'est toujours l'utilisateur qui confirme.

## Cas L — Archivage du sujet (système)

### Traitement

1. un sujet déjà **terminé** (`resolved`) reste sans activité pendant une durée prolongée
2. le **système** le passe en `archived` automatiquement (il n'y a **pas de bouton « Archiver »** côté utilisateur)
3. un `EventLog` est produit (`actor = system`)

### Résultat

- `Subject.status = archived` (masqué du flux actif, conservé pour l'historique)

## Cas M — Tri d'un message "Sans sujet" par l'utilisateur

### Contexte

L'utilisateur consulte le dashboard ou la page Messages et voit des messages "Sans sujet" en attente de tri.

### Traitement — Affectation à un sujet

1. l'utilisateur clique sur le badge "Sans sujet" du message
2. un popover s'ouvre avec les options d'affectation
3. **si aucun contact n'existe pour cet expéditeur** : le système propose de créer un contact
   - les champs sont préremplis avec les informations disponibles (`sender_raw`, nom extrait si possible)
   - l'utilisateur peut compléter (nom, entreprise, Dossier par défaut)
   - le contact est créé en statut `complete` (car vérifié par l'utilisateur) avec `source_actor = user`
4. **si un contact existe déjà** : le message lui est directement associé
5. l'utilisateur choisit un sujet existant ou en crée un nouveau
6. le `Message` est mis à jour : `subject_id` et `sender_contact_id` renseignés
7. produire les `EventLog` (contact créé si applicable, message rattaché)

### Résultat

- le message disparaît de la liste "Sans sujet"
- le sujet est enrichi du nouveau message

## Cas N — Message "Sans sujet" ignoré par l'utilisateur

### Contexte

L'utilisateur identifie un message comme non pertinent (spam, prospection, message personnel sans intérêt professionnel).

### Traitement

1. l'utilisateur choisit d'ignorer le message
2. le `Message` est mis à jour : `status = ignored`
3. le message disparaît de la liste "Sans sujet"
4. aucun sujet n'est créé
5. produire un `EventLog` (message ignoré, actor: user)

### Résultat

- le message reste en base (traçabilité) mais n'apparaît plus dans le flux actif
- `subject_id` reste `null`

## Cas O — Changement de rattachement d'un message

### Contexte

L'utilisateur constate qu'un message a été rattaché au mauvais sujet par l'IA.

### Traitement

1. l'utilisateur clique sur le badge du sujet affiché sous le message
2. le même popover que le Cas M s'ouvre, avec le sujet actuel présélectionné
3. l'utilisateur peut :
   - réaffecter le message à un autre sujet existant
   - créer un nouveau sujet
   - détacher le message (retour à "Sans sujet")
4. le `Message` est mis à jour : `subject_id` modifié
5. produire les `EventLog` (message réaffecté, actor: user)

### Résultat

- le message apparaît dans le nouveau sujet
- le journal de bord trace le changement

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
