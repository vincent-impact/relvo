# 2. Entités et modèles de données

## 0. Type partagé `Actor`

Le type `Actor` est un enum partagé par toutes les entités du modèle pour désigner **qui porte la donnée** (création, exécution, complétion, action dans le journal). Il remplace l'usage de FK utilisateur sur les ressources métier en V1.

```
Actor = enum(user, ai, contact, system)
```

### Mapping vers l'UI

- `user` → **« Moi »** — l'humain titulaire du compte
- `ai` → **« Relvo »** — l'assistant IA du compte
- `contact` → **« Externe »** — un interlocuteur extérieur (entité `Contact`)
- `system` → événements techniques automatiques, généralement non affichés

### Convention de nommage

Tout attribut typé `Actor` porte le suffixe `_actor` pour rendre le typage évident à la lecture. Exemples : `source_actor`, `created_by_actor`, `completed_by_actor`, `executed_by_actor`. Sur `EventLog`, l'entité ne portant qu'un seul acteur, on simplifie en `actor` (sans suffixe redondant).

### Acteurs et identifiants

Les acteurs ne sont **pas** des entités stockées :

- `user`, `ai`, `system` n'ont pas d'`id` — l'humain titulaire du compte est implicite via `account_id`, Relvo est un mécanisme du compte, le système est automatique
- `contact` est la seule valeur dont l'acteur correspond à une entité réelle (`Contact`)

Quand un événement doit pointer vers le Contact concret (typiquement dans `EventLog`), on utilise un champ explicite `contact_id: UUID nullable`, renseigné uniquement quand `actor = contact`.

## 1. Account

Entité racine et tenant. Porteur technique du compte (auth + propriété des ressources).

### Propriétés

- `id: UUID`
- `email: string` (login)
- `password_hash: string`
- `first_name: string`
- `last_name: string`
- `role: enum(admin, ceo, manager, operator, viewer)`
- `is_active: boolean`
- `created_at: datetime`
- `updated_at: datetime`

### Rôle

`Account` représente le titulaire du compte (un dirigeant, en V1). Toutes les ressources métier (sujets, contacts, tâches, documents, messages…) sont rattachées à un Account via `account_id`. C'est la clé tenant qui isole les données entre comptes et qui sert systématiquement de filtre dans les requêtes.

En V1, un Account correspond à **un seul humain**. La gestion multi-utilisateurs (plusieurs humains partageant un même Account pour de la coordination) est repoussée en V2 et impliquera l'introduction d'une entité `User` distincte.

Dans le journal de bord, les actions de l'humain titulaire sont identifiées par `actor = user` (libellé UI : **« Moi »**).

## 2. Folder

### Propriétés

- `id: UUID`
- `account_id: UUID`
- `name: string`
- `slug: string`
- `description: string nullable`
- `color: string nullable` — clé de palette du **logo** du domaine (cf. UI « Mémoire »), null → repli sur le mapping par slug
- `icon: string nullable` — clé du jeu d'icônes curé du logo, null → repli par slug
- `is_default: boolean default false` — vrai pour le Folder « Général » auto-créé à la création du compte
- `is_active: boolean`
- `created_at: datetime`
- `updated_at: datetime`

### Exemples

- Général (auto-créé)
- RH
- Juridique
- Fournisseurs
- Support
- Business
- Production

### Rôle

Un Folder est un **conteneur métier** qui regroupe :

- les `Subject` (affaires en cours dans ce périmètre)
- les `KnowledgeDocument` (PDFs et notes Markdown qui enrichissent Relvo pour ce périmètre)
- les `Message` classés dans ce domaine à la réception (via `Message.folder_id`) — c'est ce domaine qui se propage au Sujet créé depuis le message

C'est aussi l'unité de classification utilisée par Relvo pour déterminer quel contexte de Connaissances charger lorsqu'il traite un Sujet (cf. `04-ia.md §10`).

Le Folder est aussi associé aux contacts (via `default_folder_id`) pour faciliter le classement automatique des Sujets nouvellement créés.

### Folder « Général » — purement documentaire

À la création du compte, un Folder spécial nommé **« Général »** est auto-créé avec `is_default = true`. Il sert **uniquement** de bac pour les `KnowledgeDocument` transversaux (organigramme, charte rédactionnelle, ton de réponse) — c'est-à-dire ceux qui doivent être chargés dans le contexte de **tous** les Sujets, indépendamment du Folder du Sujet.

**Invariant** : aucun `Subject.folder_id` ne pointe vers le Folder Général. Si Relvo ne sait pas dans quel Folder métier classer un nouveau Sujet, le Sujet est créé avec `folder_id = null` (et apparaît dans Mon fil avec un badge discret « sans dossier » + suggestion Relvo « Range-moi dans X ? »). Cela évite de transformer le Folder Général en dépotoir et préserve son rôle de mémoire transversale claire.

### Nommage UI

Côté interface, l'entrée de navigation s'appelle **« Mémoire »** (icône **cerveau**) — et non plus « Mes dossiers ». Justification : « Dossiers » évoque la bureautique (Microsoft/Google) ; **« Mémoire » dit *agent*** — l'utilisateur comprend qu'il y stocke des documents et des instructions pour **enrichir la mémoire de son assistant**, comme si Relvo absorbait la connaissance. Chaque Folder est présenté comme **« un domaine de la mémoire de Relvo »**. Le terme « Folder » n'est utilisé que dans le modèle et la doc technique.

**Page d'un domaine — 3 onglets** (la page reste courte quel que soit le volume : on interroge la mémoire via le composer Relvo, on ne scrolle pas une liste infinie ; scroll infini pour parcourir) :

- **Instructions** — les `KnowledgeDocument` de `kind = note` (consignes que Relvo *applique*). « Instructions » remplace « Note » côté UI : on n'écrit pas un mémo, on **instruit son agent**. Carte = titre + aperçu (3 lignes) ; on l'ouvre pour la **lire en entier**, la **modifier** et l'**activer/désactiver**. L'activation réutilise `absorption_status` : `read` = active (injectée dans les prompts), `ignored` = désactivée (écartée du contexte).
- **Documents** — les `KnowledgeDocument` de `kind = file` (PDF/images que Relvo *lit*). « Documents » remplace « Fichiers ».
- **Sujets** — les `Subject` rattachés à ce domaine (historique d'activité, en second rang : le trésor du domaine, c'est la connaissance).

Une carte « mémoire » en tête (à la voix de Relvo : *« Ce que je sais sur ce domaine »*) matérialise le cadrage. L'ajout se fait en tête de liste (zone de dépôt pour les Documents, bouton « + Instruction »). Cf. `01-principes.md §12`.

## 3. Contact

### Propriétés

- `id: UUID`
- `account_id: UUID`
- `first_name: string nullable` — prénom (nul pour une raison sociale)
- `last_name: string` — nom de famille (ou raison sociale) ; **clé de tri/section** de l'annuaire
- `email: string nullable`
- `phone: string nullable`
- `company: string nullable`
- `job_title: string nullable`
- `default_folder_id: UUID nullable` — **pôle/dossier d'affinité** : oriente la qualification des messages reçus de ce contact (un contact « RH » → ses sujets tombent probablement dans le dossier RH)
- `status: enum(auto, complete)`
- `source_actor: Actor` — `ai` si Relvo a auto-créé la fiche, `user` si l'utilisateur l'a créée
- `notes: text nullable`
- `created_at: datetime`
- `updated_at: datetime`

### Rôle

Représente l'émetteur ou le destinataire d'un message, et souvent le contact principal d'un sujet. Dans le journal de bord, ses actions sont identifiées par l'acteur **"Externe"**.

Un contact n'est créé que lorsqu'un sujet est créé (automatiquement par l'IA ou manuellement par l'utilisateur). La réception d'un message seule ne suffit pas à créer un contact. Cela évite de polluer la base avec des spammers et des démarcheurs.

Les contacts en statut `auto` apparaissent dans la page Contacts avec un indicateur "À compléter" pour inviter l'utilisateur à enrichir la fiche.

### **Définition des statuts**

- **auto** : contact créé automatiquement par Relvo à partir d'informations extraites du message (signature email, nom d'expéditeur, etc.). Les informations sont partielles et non vérifiées. Dans ce cas `source_actor = ai`.
- **complete** : l'utilisateur a vérifié et complété la fiche contact. Dans ce cas `source_actor = user`.

### Point important — Contact et canaux

Un contact est une personne, indépendamment du canal par lequel elle communique. Un même contact peut avoir un email et un numéro WhatsApp. Les messages de tous les canaux sont regroupés dans une **seule conversation par contact** dans l'interface.

Le contact n'est pas dupliqué par canal. Les identifiants de canaux (email, téléphone) sont portés directement par les champs `email` et `phone` du contact.

## 4. Channel

Point d'entrée de communication connecté à la plateforme.

### Propriétés

- `id: UUID`
- `account_id: UUID`
- `name: string`
- `type: enum(email, whatsapp)`
- `identifier: string`
- `folder_ids: UUID[]`
- `is_active: boolean`
- `created_at: datetime`
- `updated_at: datetime`

### Exemples

- Boîte RH → `rh@tastycrousty.fr`
- Boîte Support → `support@tastycrousty.fr`
- WhatsApp perso CEO → `+336...`
- WhatsApp réservé aux fournisseurs → `+337...`

### Rôle

Le channel représente un compte de communication côté utilisateur (une boîte mail, un numéro WhatsApp). Il aide à :

- identifier la source d'entrée du message
- orienter la classification du domaine
- distinguer les différents comptes connectés

### Remarque

Le channel est distinct du contact. Un channel est un point d'entrée côté utilisateur ("ma boîte Fournisseurs"). Un contact est une personne extérieure qui peut écrire sur n'importe lequel de ces channels.

## 5. ChannelConfig

Configuration technique du channel.

### Propriétés

- `id: UUID`
- `account_id: UUID`
- `channel_id: UUID`
- `provider: string`
- `connection_data: jsonb`
- `status: enum(pending, connected, error, disabled)`
- `last_sync_at: datetime nullable`
- `created_at: datetime`
- `updated_at: datetime`

### Exemples de `connection_data`

- email : host, port, login, secret, api_key
- WhatsApp : numéro, session, token, clé API

### Remarque

Cette entité porte les informations techniques de connexion, sans alourdir `Channel`.

## 6. Subject

Entité centrale du produit.

### Propriétés

- `id: UUID`
- `account_id: UUID`
- `reference: string`
- `title: string`
- `summary: text nullable`
- `folder_id: UUID nullable` — null si Relvo n'a pas su classer (le Sujet apparaît avec un badge « sans dossier » dans Mon fil et invite l'utilisateur à le ranger) ; jamais égal à l'ID du Folder Général (cf. §2 — invariant documentaire)
- `contact_ids: UUID[] default []`
- `status: enum(acknowledged, resolved, archived, ignored)` — **cycle de vie** exclusif (cf. Mapping UI). Valeur par défaut à la création : `acknowledged`. `ignored` = sujet écarté, hors des ouverts et **hors mémoire de Relvo**
- `priority: enum(normal, urgent)`
- `waiting_for_reply: boolean default false` — marqueur **« En attente »** posé par Relvo (cf. Mapping UI)
- `source_channel_id: UUID nullable`
- `opened_at: datetime`
- `resolved_at: datetime nullable`
- `last_activity_at: datetime nullable`
- `last_opened_at: datetime nullable`
- `resolution_suggested_at: datetime nullable`
- `created_by_actor: Actor` — `ai` si Relvo a créé le sujet à la réception d'un message, `user` si l'utilisateur l'a créé manuellement
- `created_at: datetime`
- `updated_at: datetime`

### Rôle

Conteneur métier principal.

Un sujet rassemble :

- les messages
- les pièces jointes
- les tâches
- les événements

### Remarques

`reference` est un identifiant lisible métier. Exemples : `SUB-00124`, `RH-0042`.

Si l'IA ne comprend pas un message (sens ambigu, contact inconnu, contexte insuffisant), elle ne crée pas de sujet. Le message reste "Sans sujet" (`subject_id = null` sur le Message) en attente d'une intervention humaine dans la page Messages.

Un sujet n'est créé que si l'IA a suffisamment compris la situation pour l'identifier. Il démarre alors en `acknowledged` (état actif par défaut) avec `last_opened_at = null` — c'est ce champ (et non le statut) qui porte « jamais ouvert » et allume le marqueur dérivé **« Nouveau »**. Les tâches éventuellement identifiées **ne changent pas le statut** : elles allument le marqueur dérivé **« À faire »** (cf. Mapping UI). L'ouverture de la fiche par l'utilisateur **pose `last_opened_at`** (acquittement implicite) et éteint le marqueur « Nouveau » ; le statut, lui, **reste `acknowledged`**.

Un sujet peut impliquer un ou plusieurs contacts. Le tableau `contact_ids` porte cette relation directement, sans table de liaison.

- Sujet mono-contact (cas courant) : `contact_ids = [UUID de Karim]`
- Sujet multi-contacts : `contact_ids = [UUID de Julien, UUID de Karim, UUID de Youssef]`
- Sujet sans contact (créé par l'utilisateur, pas encore de destinataire) : `contact_ids = []`

### Mapping UI

Un Sujet est, par nature, **un fil de conversation entre deux ou plusieurs personnes autour d'un objet précis**. Son affichage repose sur **deux axes orthogonaux** qu'il ne faut pas confondre — c'est la correction majeure du modèle de statut (l'ancien enum à 6 valeurs mélangeait les deux et se contredisait : un sujet pouvait être à la fois `to_do` *et* `unread`).

**Axe 1 — Cycle de vie (`status`, exclusif).** Quatre valeurs, jamais cumulables :

| `status` | Libellé UI | Visible ? |
|---|---|---|
| `acknowledged` | *(actif)* | **non** — état actif par défaut, aucun badge |
| `resolved` | **Terminé** | oui (onglet Terminés + coche) |
| `archived` | *(Archivé)* | **non** — état **système** (auto après inactivité prolongée), masqué |
| `ignored` | **Ignoré** | oui, mais hors des ouverts (onglet Ignorés, récupérable) — sujet **écarté** |

Transitions : `acknowledged →(action « Terminer »)→ resolved →(inactivité, système)→ archived`. Le sujet **naît `acknowledged`** ; ouvrir la fiche **ne change pas le statut** (il pose seulement `last_opened_at`, ce qui éteint le marqueur « Nouveau »). Le swipe « Ignorer » pose `ignored` depuis n'importe quel état ouvert. **Réouverture** : un message entrant sur un sujet `resolved` le ramène à `acknowledged` (il avait déjà été lu) et fait réapparaître ses marqueurs (pastille non-lus, éventuel drapeau si Relvo le re-priorise). En revanche **l'ignorance est collante** : un message entrant sur un sujet `ignored` ne le ressort **jamais** des ouverts (sinon frustration « groupe WhatsApp bavard ») — seule une récupération manuelle via l'onglet Ignorés le réactive. Un sujet `ignored` est en outre **hors de la mémoire de Relvo** (exclu du contexte) et **purgeable après 15 j d'inactivité**. Le principe directeur : **l'état actif est invisible** — un badge porté par 90 % des sujets actifs n'informe pas ; on lit le statut par soustraction (absence de badge = sujet actif).

**Axe 2 — Marqueurs d'état (cumulables, dérivés ou flags).** Orthogonaux au cycle de vie, plusieurs peuvent coexister sur une même carte :

| Marqueur | Source | Rendu |
|---|---|---|
| **Nouveau** | dérivé : `last_opened_at == null` sur un sujet ouvert | badge bleu — disparaît dès l'ouverture de la fiche (statut inchangé) |
| **Urgent** | `priority = urgent` | drapeau 🔴 (icône seule, pas de texte) |
| **À faire** | dérivé : ≥ 1 `Task` non terminée | badge ambre + icône tâche |
| **En attente** | `waiting_for_reply = true`, **posé par Relvo** | badge gris + icône sablier |
| **Non-lus** | compteur de messages non lus | pastille bleue ronde façon WhatsApp, en coin de carte |

`to_do`, `waiting`, `unread` et **`new`** ne sont **plus des statuts stockés** — ils deviennent ces marqueurs (dérivé `last_opened_at == null` pour Nouveau, dérivé tâches pour À faire, flag Relvo pour En attente, compteur pour les non-lus). Budget visuel mobile : plafond ~3 marqueurs par carte, ordre `[🔴] [pastille] · titre · [À faire] [En attente]`.

**Priorité UI — un seul drapeau (rareté = signal).** Le modèle porte `priority` à **2 valeurs** : `normal` (par défaut) et `urgent`. Un **seul drapeau « Urgent » rouge** est exposé, levé **uniquement** quand `priority = urgent` ; `normal` n'a aucun drapeau. Justification : si l'urgence est partout, elle devient du bruit ; rare (1-2 sujets sur 24 ouverts), elle attire l'œil.

### Feed des ouverts et actions de swipe

L'onglet **« Ouverts »** de Mon fil (et le widget de l'Accueil) liste tous les sujets ouverts (`status NOT IN (resolved, archived, ignored)`, soit tous les `acknowledged`), **urgents en tête** (`priority = urgent`). C'est `getOpenFeed`. Pas de feed « Priorité » distinct : la rareté du drapeau urgent suffit à hiérarchiser.

Deux actions structurent le tri, exposées **en gestes de swipe** sur mobile (et en boutons sur la fiche / les cartes urgentes) :

- **Ignorer** (swipe gauche, rouge, icône œil fermé) — passe le `status` à **`ignored`**. Le sujet quitte les ouverts, sort de la mémoire de Relvo et bascule dans l'onglet **Ignorés** (récupérable). L'ignorance est **collante** : un nouveau message ne le ressort jamais des ouverts (seule une récupération manuelle le réactive). Purgeable après 15 j d'inactivité. Disponible sur tout sujet ouvert. **Ignorer est un statut, pas une priorité.**
- **Terminer** (swipe droite, vert, icône coche) — passe le `status` à `resolved`. Disponible sur tous les sujets. C'est l'action de clôture ; **« Terminer » remplace « Résoudre »** (vocabulaire trop éloigné des utilisateurs food/bâtiment), libellé de l'état résolu = **« Terminé »**.

**Pas de bouton « Archiver »** côté utilisateur : `archived` est un état **système** (auto après inactivité prolongée d'un sujet `resolved`). Les manières de sortir un sujet du flux sont ramenées à deux gestes clairs : **Ignorer** (écarter, `status = ignored`) et **Terminer** (clore, `status = resolved`).

### Distinction `last_activity_at` / `last_opened_at`

Ces deux timestamps portent des informations différentes et ne doivent pas être confondus.

- `last_activity_at` : horodatage du dernier événement sur le sujet, quel qu'il soit (message reçu/envoyé, tâche créée/cochée, statut modifié, brouillon IA généré, etc.). C'est ce qui est affiché comme **"Dernière activité"** dans l'interface.
- `last_opened_at` : horodatage de la dernière fois où **l'utilisateur a ouvert la fiche du sujet**. Sert à distinguer les éléments IA déjà consultés des éléments à examiner.

### `resolution_suggested_at`

Renseigné par l'IA quand elle estime que le sujet est candidat à la résolution (cf. doc 04-ia §5.5). Si `resolution_suggested_at > last_opened_at`, l'interface affiche le badge **"Résolution suggérée"** dans les listes. Une fois le sujet ouvert, le badge disparaît des listes mais la suggestion reste visible dans la fiche jusqu'à ce que l'utilisateur **termine** le sujet ou que l'IA la révoque suite à une nouvelle activité.

### Cycle de vie des suggestions IA — vue modèle

Une **suggestion Relvo** est tout élément créé par Relvo qui appelle une décision de l'utilisateur :

- une `Task` avec `source_actor = ai`
- un brouillon de réponse — `Action` de type `send_message` avec `status = open` et `payload` renseigné
- une suggestion de résolution — portée par `Subject.resolution_suggested_at`

Une suggestion est dite **"à examiner"** tant que sa date de création (ou de mise à jour pour la résolution suggérée) est postérieure au `Subject.last_opened_at`. Dès que l'utilisateur ouvre la fiche du sujet, `last_opened_at` est mis à jour, et toutes les suggestions présentes deviennent **"examinées"** (sans intervention explicite de l'utilisateur).

Les badges agrégés sur les listes (Dashboard, Sujets) ne comptent que les suggestions **"à examiner"** :

- `✦ N tâches suggérées` — `count(Task WHERE source_actor='ai' AND status='open' AND created_at > Subject.last_opened_at)`
- `✦ Réponse suggérée` — il existe une `Action` send_message avec `status='open'`, `payload IS NOT NULL` et `created_at > Subject.last_opened_at`
- `✦ Résolution suggérée` — `resolution_suggested_at > last_opened_at`

Cf. doc 04-ia §8 pour le détail UX et les règles d'invalidation.

## 7. Message

Événement brut reçu ou envoyé.

### Propriétés

- `id: UUID`
- `account_id: UUID`
- `subject_id: UUID nullable`
- `folder_id: UUID nullable` — **domaine assigné au message à la réception** (classification auto par Relvo). C'est ce domaine qui **donne ensuite son domaine au Sujet** créé depuis le message. Null = non classé.
- `channel_id: UUID`
- `sender_contact_id: UUID nullable`
- `sender_raw: string nullable`
- `recipient_contact_id: UUID nullable`
- `direction: enum(incoming, outgoing)`
- `external_id: string nullable`
- `external_thread_id: string nullable`
- `subject_line: string nullable`
- `content: text nullable`
- `received_at: datetime nullable`
- `sent_at: datetime nullable`
- `read_at: datetime nullable` — lu/non-lu d'un message entrant. Marqué lu à l'ouverture du sujet auquel il est rattaché **ou** de la page Messages. Null = non-lu. Sert le tri des orphelins et la pastille de non-lus.
- `status: enum(received, linked, sent, failed, ignored)`
- `triage_hint: enum(too_short, ambiguous, prospection, unknown_sender, informative_only, other) nullable`
- `created_at: datetime`
- `updated_at: datetime`

### Remarques

- `subject_line` est surtout utile pour l'email.
- `external_thread_id` aide au rattachement d'un email à un fil existant.
- `subject_id` reste **nullable** : c'est le mécanisme qui porte les messages "Sans sujet". Un message avec `subject_id = null` est un message que Relvo n'a pas su traiter. Ces orphelins forment une **pile d'événements reçus** (pas une messagerie ni une conversation) dans la page Messages, conservés **15 j** s'ils ne sont associés à aucun sujet (purge ensuite). Actions possibles sur un orphelin : **créer un sujet**, **rattacher à un sujet existant**, ou **créer un contact** depuis l'expéditeur.
- `folder_id` porte le **domaine** que Relvo assigne au message dès la réception. Lorsqu'un Sujet est ensuite créé à partir du message, il **hérite de ce domaine**. Relation `Folder?` (`onDelete: SetNull`) : le modèle `Folder` porte donc aussi `messages`.
- Un message avec `status = ignored` est un message que l'utilisateur a volontairement écarté (spam, non pertinent) sans lui affecter de sujet.
- `sender_contact_id` est **nullable**. Un message peut exister sans contact associé : c'est le cas quand l'expéditeur est inconnu et qu'aucun sujet n'a encore été créé. L'information brute de l'expéditeur (adresse email ou numéro de téléphone) est conservée dans `sender_raw` pour permettre la création ultérieure du contact si l'utilisateur décide de traiter le message.
- `triage_hint` est renseigné **uniquement** quand `subject_id = null`, c'est-à-dire pour les messages que Relvo n'a pas su rattacher à un sujet. Il porte la raison synthétique de cette décision et aide l'utilisateur à trier rapidement (afficher dans la liste des messages "Sans sujet", choisir d'ignorer ou d'affecter). Il n'est pas affiché pour les messages rattachés à un sujet. Valeurs :
  - `too_short` — message trop court pour être exploitable ("Ok merci", "Bien reçu")
  - `ambiguous` — intention floue, sens non identifiable
  - `prospection` — démarchage commercial probable
  - `unknown_sender` — expéditeur inconnu sans contexte suffisant
  - `informative_only` — message compris mais purement informatif, sans accroche pour ouvrir un sujet
  - `other` — autre cas non couvert par les valeurs ci-dessus

### Affichage par conversation

Au sein d'un **sujet**, les messages sont regroupés par `sender_contact_id` / `recipient_contact_id` pour former une **conversation par contact**, tous canaux confondus. Ce regroupement est un concept d'affichage, pas une entité de données distincte. La page **Messages** autonome, en revanche, ne regroupe pas : elle liste les seuls messages **« Sans sujet »** (`subject_id = null`) comme une **pile d'orphelins** (lu/non-lu via `read_at`, rétention 15 j), à rattacher à un sujet.

## 8. Attachment

Pièce jointe liée à un message.

### Propriétés

- `id: UUID`
- `account_id: UUID`
- `message_id: UUID`
- `subject_id: UUID nullable`
- `name: string`
- `mime_type: string nullable`
- `storage_key: string` — clé de l'objet dans le stockage (R2), **pas une URL** : le bucket est privé et les URLs pré-signées expirent (7 j max). L'URL de lecture est signée à la demande
- `file_size: integer nullable`
- `ai_label: string nullable`
- `ai_summary: text nullable`
- `ai_analysis: text nullable`
- `ai_label_at: datetime nullable`
- `ai_summary_at: datetime nullable`
- `ai_analysis_at: datetime nullable`
- `created_at: datetime`
- `updated_at: datetime`

### Rôle

Permet de retrouver les documents :

- depuis le message
- depuis le sujet
- même après clôture
- `ai_label` — Étiquette courte attribuée automatiquement à la réception (facture, bon de livraison, contrat, planning, photo, justificatif, autre). Générée par Haiku à coût quasi nul. Affichée comme **badge discret** à côté du nom du fichier dans la fiche du sujet : utile quand le nom du document est peu explicite (ex: `scan_001.pdf` ou nom généré aléatoirement). Sert aussi de critère de filtrage et recherche.
- `ai_summary` — Résumé court du document, généré par Sonnet **une seule fois** au premier accès par l'utilisateur, puis caché. Exemples : "Facture SoGood Distribution — 1 240€ TTC — échéance 15 mai", "Contrat de maintenance — renouvellement tacite au 30 avril". Affiché dans le panneau pièces jointes du sujet.
- `ai_analysis` — Analyse approfondie du document, générée par Sonnet **uniquement à la demande explicite** de l'utilisateur (bouton "Analyser avec l'IA"). Contient l'extraction détaillée du contenu : clauses d'un contrat, lignes d'une facture, écarts identifiés, etc.
- `ai_label_at`, `ai_summary_at`, `ai_analysis_at` — Horodatages de chaque niveau d'analyse. Servent de flag de cache : si le champ datetime est renseigné, l'analyse a déjà été faite et le résultat est en cache. L'IA n'est jamais sollicitée deux fois pour le même document au même niveau.

## 9. Task

Unité de travail **du sujet** (pas de l'utilisateur).

### Propriétés

- `id: UUID`
- `account_id: UUID`
- `subject_id: UUID`
- `message_id: UUID nullable`
- `title: string`
- `description: text nullable`
- `source_actor: Actor` — qui a créé / proposé la tâche (`ai` = Relvo, `user` = utilisateur, `system` = workflow auto)
- `kind: enum(decision, reply, check, call, inform, follow_up, other)`
- `status: enum(open, done, deleted)` — la valeur `deleted` subsiste dans l'enum mais **n'est plus posée** : la suppression d'une tâche est désormais un **hard delete** (vrai `DELETE` en base via `deleteTask`). Les FK `EventLog.task_id` et `Action.task_id` sont en `onDelete: SetNull`, la ligne disparaît sans casser le journal ni les actions.
- `completion_mode: enum(manual, message_match, action_match)`
- `start_date: date nullable` — date à laquelle la tâche doit être effectuée (deadline au jour près)
- `start_time: time nullable` — heure précise si la deadline est horodatée
- `end_date: date nullable` — pour les tâches qui s'étalent dans le temps (durée multi-jours), date de fin de l'étalement
- `end_time: time nullable` — heure de fin pour un créneau horodaté (réunion, événement)
- `completed_at: datetime nullable`
- `completed_by_actor: Actor nullable` — qui a coché la tâche (`user` manuellement, `ai` automatiquement via Relvo, `system` cas particuliers)
- `created_at: datetime`
- `updated_at: datetime`

### Rôle

Représente une chose à faire **pour faire avancer le sujet**, indépendamment de qui finira par l'exécuter. La tâche est rattachée au sujet (`subject_id`), pas à un utilisateur. En V1 (un compte = un humain), c'est implicitement le titulaire du compte qui agit. La notion d'affectation à un utilisateur spécifique (coordination multi-utilisateurs) est repoussée en V2 et impliquera l'introduction d'une entité `User` et d'un champ `assignee_user_id`.

### Exemples

- Confirmer ou refuser le remplacement sauce algérienne _(source_actor: ai — déduit du message)_
- Appeler le shop de Montpellier _(source_actor: user — savoir métier)_
- Vérifier les stocks de Béziers _(source_actor: user — savoir métier)_
- Répondre au fournisseur _(source_actor: ai — déduit du message)_

### Point important — Source des tâches

Le champ `source_actor` est systématiquement affiché dans l'interface via une pastille (« ✦ Relvo » ou « Moi »). Il permet de distinguer :

- **ai** : tâche proposée par Relvo, déductible du contenu disponible (message reçu, et plus tard documents de connaissance — cf. roadmap V2).
- **user** : tâche créée manuellement par l'utilisateur, typiquement issue de son savoir métier ou de sa connaissance du terrain — informations auxquelles Relvo n'a pas accès en V1.
- **system** : tâche créée automatiquement par un workflow (cas rares).

### Point important — Le champ `kind` n'est pas affiché par défaut

Le champ `kind` (`decision`, `reply`, `check`, `call`, `inform`, `follow_up`, `other`) est conservé dans le modèle pour deux usages techniques :

- **Automatisation `completion_mode = message_match`** : une tâche `kind = reply` peut être cochée automatiquement lorsqu'un message sortant est envoyé au même contact dans le même sujet. Dans ce cas `completed_by_actor = ai`.
- **Filtrage et statistiques** futures (ex : "voir mes tâches d'appel cette semaine").

En revanche, `kind` **n'est pas affiché** dans les cartes de tâches de l'interface principale. Les libellés (« décision », « réponse », « vérif »…) sont trop spécifiques pour apporter une lecture rapide et utile à l'utilisateur — la formulation du titre de la tâche suffit. Ce qui est affiché systématiquement, c'est :

- l'**actor-pill** (`✦ Relvo` ou `Moi`) qui matérialise `source_actor`
- une **action suggérée** contextuelle quand pertinent (« Aller au brouillon » pour les tâches de réponse, « Voir le message » pour les tâches qui pointent vers un message déclencheur, etc.)

### Sémantique des dates

Les quatre champs `start_date`, `start_time`, `end_date`, `end_time` portent une sémantique simple et asymétrique :

- **`start_date` (+ `start_time`) est la deadline**. C'est le moment où la tâche **doit** être effectuée. Si l'utilisateur ne renseigne qu'un seul champ, c'est `start_date` — la tâche s'ancre sur cette date dans le calendrier.
- **`end_date` (+ `end_time`) n'ajoute jamais de deadline supplémentaire**. Ces champs servent uniquement à indiquer une **durée** quand la tâche s'étale dans le temps (salon de plusieurs jours, créneau horaire d'une réunion).

Configurations possibles :

| Configuration | Sens |
|---|---|
| Tous null | Tâche sans deadline (pile « Aucune date ») |
| `start_date` seul | Deadline au jour près |
| `start_date` + `start_time` | Deadline horodatée |
| `start_date` + `end_date` | Deadline au jour près + tâche étalée sur plusieurs jours |
| `start_date` + `start_time` + `end_time` (même date) | Créneau horodaté dans la journée (réunion 10h-11h) |
| 4 champs renseignés | Plage multi-jours avec horaires |

La combinaison « `end_date` seul » (sans `start_date`) **n'est pas une configuration valide** — la deadline vit dans `start_date`.

Sur le calendrier (Dashboard semaine, Planning mois), la tâche s'ancre toujours sur `start_date`. Les tâches multi-jours sont rendues comme une barre qui s'étend de `start_date` à `end_date`.

## 10. Action

Exécution concrète déclenchée depuis l'interface.

### Propriétés

- `id: UUID`
- `account_id: UUID`
- `subject_id: UUID`
- `task_id: UUID nullable`
- `message_id: UUID nullable`
- `type: enum(send_message, other)`
- `title: string`
- `payload: jsonb nullable`
- `status: enum(open, in_progress, done, cancelled, failed)`
- `executed_by_actor: Actor nullable` — qui a exécuté l'action (`user` envoi manuel, `ai` cas auto, `system` cas rares)
- `executed_at: datetime nullable`
- `created_at: datetime`
- `updated_at: datetime`

### Rôle

Trace une opération exécutée dans l'interface.

### Exemple

Task : "Répondre au fournisseur"
Action : "Envoyer le message de réponse"

### Remarque — Brouillon Relvo

Lorsque Relvo prépare un brouillon de réponse, celui-ci est stocké dans le `payload` de l'action (destinataire, canal, contenu). Le brouillon est présenté directement dans la zone de rédaction (composer) de l'interface, clairement identifié comme une suggestion modifiable. Il ne constitue pas un message tant qu'il n'a pas été envoyé.

## 11. EventLog

Journal de bord du système.

### Propriétés

- `id: UUID`
- `account_id: UUID`
- `subject_id: UUID nullable`
- `message_id: UUID nullable`
- `task_id: UUID nullable`
- `action_id: UUID nullable`
- `entity_type: enum(subject, message, task, action, attachment, system)`
- `entity_id: UUID nullable`
- `event_type: string`
- `title: string`
- `description: text nullable`
- `actor: Actor` — qui a agi
- `contact_id: UUID nullable` — renseigné uniquement quand `actor = contact`, pointe vers le `Contact` concret
- `metadata: jsonb nullable`
- `created_at: datetime`

### Rôle

Historise tout ce qui doit apparaître dans la timeline du sujet ou dans la page Activité.

### Le triptyque d'acteurs

Le champ `actor` porte l'information "qui a agi". Il est structurant pour toute la plateforme :

- **user** → affiché **"Moi"** dans l'UI — actions de l'utilisateur (tâche créée, tâche cochée, message envoyé, statut modifié). Pas de FK : en V1, l'humain est implicite via `account_id`.
- **ai** → affiché **"Relvo"** dans l'UI — actions de l'assistant IA (tâche proposée, sujet créé, brouillon préparé, domaine suggéré). Pas de FK : Relvo est un mécanisme du compte, pas une entité stockée.
- **contact** → affiché **"Externe"** dans l'UI — actions du monde extérieur (message reçu, pièce jointe reçue). `contact_id` est renseigné pour identifier la Contact concrète.
- **system** → événements techniques automatiques (changement de statut automatique, archivage) — généralement non affiché à l'utilisateur.

Ce triptyque **Moi / Relvo / Externe** est utilisé dans l'interface pour filtrer l'activité et pour identifier visuellement l'acteur de chaque événement (badges colorés `M`, `R`, `E`).

> **Convention de nommage**. Le modèle conserve `ai` comme valeur d'enum et la doc `04-ia.md` continue de parler de « l'IA » pour les aspects techniques (modèles, prompts, coûts). Mais dans l'**UI** et la **communication produit**, on utilise toujours **« Relvo »** (le nom de l'assistant) plutôt que « l'IA » (catégorie technique). Cf. principe 5 dans `01-principes.md`.

### Exemples d'event_type

- `message_incoming_received` (actor: contact)
- `message_outgoing_sent` (actor: user)
- `subject_created` (actor: ai)
- `subject_status_changed` (actor: ai ou user)
- `task_created_by_ai` (actor: ai)
- `task_created_by_user` (actor: user)
- `task_completed` (actor: user)
- `action_draft_prepared` (actor: ai)
- `action_send_message_done` (actor: user)
- `knowledge_document_created` (actor: user)
- `knowledge_document_updated` (actor: user)
- `knowledge_document_deleted` (actor: user)

## 12. KnowledgeDocument

Document de référence chargé par l'utilisateur pour enrichir le contexte de Relvo (« base de connaissances »). Sert au retrieval : à chaque appel à Claude, on injecte dans le system prompt les documents pertinents pour le Folder considéré, mis en cache pour amortir le coût.

### Propriétés

- `id: UUID`
- `account_id: UUID`
- `folder_id: UUID` — le Folder dans lequel vit ce document (toujours renseigné — un doc vit toujours dans un Folder, à défaut dans le Folder « Général » auto-créé)
- `kind: enum(file, note)` — nature du document. **Libellés UI** : `note` → **« Instructions »**, `file` → **« Documents »** (cf. §2 — Nommage UI)
- `name: string` — titre éditorial pour une note, nom de fichier pour un file
- `description: text nullable` — courte description saisie par l'utilisateur (optionnelle)

**Champs spécifiques `kind = file`** (PDF, image, document uploadé — non modifiable sauf suppression) :

- `mime_type: string nullable`
- `storage_key: string nullable` — clé de l'objet dans le stockage (R2), **pas une URL** — cf. `Attachment.storage_key`
- `file_size: integer nullable`
- `anthropic_file_id: string nullable` — identifiant retourné par la Files API d'Anthropic, utilisé pour référencer le fichier dans les prompts sans le re-uploader. **Pointeur vers une copie d'inférence, pas vers la source de vérité** : un fichier uploadé chez Anthropic n'est **jamais téléchargeable** (`downloadable: false`, `GET /content` → 400). L'affichage utilisateur passe donc **toujours** par `storage_key` (R2). Si l'`anthropic_file_id` est perdu, on ré-uploade depuis R2 ; l'inverse est impossible
- `ai_label: string nullable` — étiquette automatique (organigramme, facture, devis, contrat-type, procédure, autre) générée à la réception (Haiku)
- `ai_summary: text nullable` — résumé court généré au premier accès (Sonnet), mis en cache
- `absorption_status: enum(read, ignored) default read` — état d'absorption dans la mémoire de Relvo. `read` : le document est intégré au contexte (badge UI **« ✦ lu »**). `ignored` : Relvo l'écarte des connaissances de référence (typiquement un transactionnel — bon de livraison, accusé) et **ne l'injecte pas** dans les prompts (badge UI **« ignoré »**). Décidé par Relvo, modifiable par l'utilisateur.

**Champs spécifiques `kind = note`** (note Markdown rédigée par l'utilisateur — modifiable, mémoire vivante) :

- `content: text nullable` — Markdown brut, source de vérité

**Traçabilité** :

- `created_by_actor: Actor` — qui a créé (en V1, toujours `user`)
- `updated_by_actor: Actor nullable` — qui a fait la dernière modification (utile pour les notes ; en V1 toujours `user`, en V2 `ai` quand Relvo propose des modifications validées)
- `created_at: datetime`
- `updated_at: datetime`

### Rôle

Un `KnowledgeDocument` est une **information de référence**, distincte des `Attachment` (qui sont des pièces jointes aux messages) et des `Subject` (qui sont des affaires métier en cours). Sa raison d'être est d'**enrichir le contexte** de Relvo de façon persistante.

Chaque document **vit dans un Folder**. C'est ce Folder qui détermine la portée du document : les documents du Folder « Général » sont chargés dans le contexte de **tous** les Sujets, les documents d'un Folder métier (Fournisseurs, RH…) ne sont chargés que pour les Sujets de ce même Folder.

Exemples typiques :

- **kind=file** : organigramme PDF, modèle de facture, devis-type, contrat fournisseur, charte tarifaire scannée
- **kind=note** : « Nos magasins » (liste des shops et leurs particularités), « Procédure validation devis » (rédigée par l'utilisateur), « Ton et style des réponses » (charte rédactionnelle), « Personnes clés et rôles »

### Distinction `file` vs `note`

| | `kind = file` | `kind = note` |
|---|---|---|
| Source | Upload PDF, image, doc | Markdown rédigé dans l'app |
| Modifiable | Non (suppression seule) | Oui (par l'utilisateur en V1) |
| Stockage | **R2** (`storage_key`, source de vérité) + Anthropic Files API (`anthropic_file_id`, copie d'inférence en écriture seule) | Texte inline (`content`) |
| Évolution | Statique | Mémoire vivante |
| Usage type | Référence visuelle, modèle, contrat | Règles, contexte métier, ton, organisation |

### Organisation par Folder — V1

En V1, la seule dimension de classement d'un `KnowledgeDocument` est son **Folder**. Pas de `scope` global / domain — le concept est unifié dans l'entité Folder qui regroupe à la fois les Sujets et les Connaissances d'un périmètre.

- Les documents transversaux (organigramme, charte rédactionnelle, ton) vivent dans le **Folder « Général »** (auto-créé)
- Les documents spécifiques à un périmètre métier vivent dans le Folder correspondant (Fournisseurs, RH, Juridique…)

Le scope `subject` n'existe pas en V1 — un document spécifique à un sujet ponctuel reste un `Attachment` du message qui l'a apporté.

### Retrieval — quels documents sont inclus dans un appel à Claude

- Travail **sur un sujet** (création de tâche, brouillon, statut) → documents du `folder_id` du Sujet + documents du Folder « Général » (`is_default = true`)
- Travail **transversal** (chatbot, brief de l'Accueil) → documents du Folder « Général » uniquement, plus ce qui colle si Relvo identifie un Folder à partir du contexte ou de la question

Dans tous les cas, seuls les documents `absorption_status = read` sont injectés — les `ignored` sont exclus du retrieval. Les documents retenus sont assemblés dans le system prompt et mis en **prompt cache** (cf. `04-ia.md §10` pour la stratégie complète).

### Citations

L'API d'Anthropic supporte nativement les citations : quand Claude génère une tâche ou un brouillon à partir d'un `KnowledgeDocument`, il peut renvoyer la portion exacte du document qui a fondé sa réponse. En V1 on **active le flag** côté API et on stocke les `citation_ids` retournés dans la `metadata` des `Task`, `Action` ou messages chatbot concernés. L'affichage UI des citations reste minimal en V1 (un petit lien « Source » discret) et s'enrichira en V2.
