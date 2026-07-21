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

## 5bis. Conversation

Couche de **transport et d'identité** : le regroupement déterministe des messages, calculé **à la réception**, sans IA (cf. `01-principes.md §3`). Une conversation est **durable** — elle ne se supprime pas et ne se termine jamais.

### Propriétés

- `id: UUID`
- `account_id: UUID`
- `channel_id: UUID` — le canal par lequel la conversation transite
- `type: enum(objet, groupe, direct)`
- `key: string` — **clé canonique unique** qui matérialise le discriminant (cf. ci-dessous). Contrainte `unique(account_id, key)`
- `title: string` — objet de l'email, nom du groupe, ou nom du contact
- `contact_id: UUID nullable` — l'interlocuteur, quand il est un contact enregistré (types `objet` et `direct` uniquement ; toujours `null` pour un groupe)
- `interlocutor_raw: string nullable` — email ou numéro brut, tant que l'interlocuteur n'est pas un contact
- `external_thread_id: string nullable` — `chat_id` WhatsApp ; sert aussi de cible d'envoi
- `normalized_subject: string nullable` — objet normalisé (type `objet` uniquement)
- `status: enum(actif, ignoré) default actif`
- `last_message_at: datetime nullable` — pilote le tri de la liste (plus récent en tête)
- `created_at: datetime`
- `updated_at: datetime`

### Les trois types et leurs clés

| Type | Canal | Discriminant | `key` canonique |
|---|---|---|---|
| **objet** | email | interlocuteur externe + objet normalisé | `email:<interlocuteur>:<objet_normalisé>` |
| **groupe** | WhatsApp | fil de groupe | `wa-group:<chat_id>` |
| **direct** | WhatsApp | interlocuteur | `wa-direct:<numéro>` |

La `key` est calculée à la réception ; on cherche la conversation correspondante, sinon on la crée. C'est **tout** l'algorithme de tri — il est déterministe et ne peut pas échouer.

L'**objet normalisé** réutilise la règle existante (retrait des préfixes `Re:` / `Fwd:` / `Tr:` répétés et multilingues, espaces écrasés, minuscules), afin qu'une réponse rejoigne bien la conversation de départ.

Les messages **sortants** rejoignent la conversation de leur interlocuteur (et de leur objet, pour l'email) : une conversation porte les deux sens de l'échange.

### Statut `ignoré`

`ignoré` signifie : **Relvo cesse d'analyser, de résumer et de trier** les messages de cette conversation. Les messages continuent d'être reçus et stockés — on ne perd rien — mais ils sortent du champ de travail de l'assistant. C'est le remède au « groupe WhatsApp bavard ». Réversible **par le seul utilisateur**.

### Asymétrie email / WhatsApp — conséquence à connaître

Parce que la clé d'une conversation `direct` ne contient **que** l'interlocuteur, il ne peut exister **qu'une seule** conversation directe par contact, pour toujours. Ouvrir « une nouvelle conversation » depuis un sujet (cf. §6) recouvre donc **deux comportements distincts** :

- **email** → une *vraie* nouvelle conversation est créée (nouvel objet = nouvelle clé) ;
- **WhatsApp direct** → la conversation existante est **écoutée par le sujet à partir d'une nouvelle ancre**.

Même bouton côté interface, deux mécaniques sous-jacentes.

Plus profondément, la clé dit **ce qu'est** la conversation :

| Clé | Contient | Nature |
|---|---|---|
| `email:<interlocuteur>:<objet>` | la personne **et l'affaire** | **un sujet**, par construction |
| `wa-direct:<numéro>` / `wa-group:<chat_id>` | la personne / le groupe **seuls** | un flux d'affaires successives |

> **Énoncé central (2026-07-21).** **Un fil d'email EST un sujet. Une conversation WhatsApp est un FLUX ; un sujet l'ÉCOUTE, à partir d'un message, jusqu'à ce qu'il cesse d'écouter.**

C'est de là que découle le **régime d'écoute par canal** (§6) : l'écoute n'est que la prothèse d'un objet manquant (cf. `01-principes.md §3`). Côté email, **il n'y a rien à écouter** — le fil *est* le sujet.

⚠️ **Le `groupe` suit le régime du `direct`, sans exception** (précision du 2026-07-20). Le **nom du groupe ne joue PAS le rôle d'un objet d'email** : il nomme un collectif, pas une affaire. Un groupe parle successivement de livraisons, de congés et de pannes — c'est un flux, il **s'écoute** comme un direct.

### Rendu et gestes par canal — décision du 2026-07-20

Après test en production de M6bis : forcer la même UX sur les deux canaux dessert les deux. La divergence est **limitée au rendu et aux gestes** — le domaine reste **commun** (voir la garde en fin de section).

#### Rendu des messages

| | email | WhatsApp |
|---|---|---|
| Forme | **pleine largeur**, emails enchaînés au fil du scroll (comme l'ancien `/messages/[id]`) | **bulles** conservées |
| Fond | **blanc dans les deux sens** — aucun fond coloré | teinté, comme aujourd'hui |
| Ce qui porte le sens entrant/sortant | l'**en-tête** : avatar + expéditeur + date ; le sortant se signale par un « **Moi** » | la position et la teinte de la bulle |
| Signal « ce fil est suivi par un sujet » | **bandeau en en-tête de conversation** (voir ci-dessous) | **le même bandeau** (2026-07-21) |

#### Le bandeau « Suivi dans » — les DEUX canaux (2026-07-21)

Toute conversation écoutée par un sujet ouvert affiche, **en en-tête de la conversation**, sur **email comme sur WhatsApp** :

> ● **Suivi dans : Retard livraison sauce blanche** · *3 sujets passés*

- une **pastille de couleur du domaine** (`Folder` du sujet) + le **titre du sujet**, **cliquables vers la fiche du sujet** ;
- un discret « **N sujets passés** » qui **déplie la liste des écoutes terminées** sur cette conversation (titre, domaine, période).

**Pourquoi le même signal partout — et un seul par conversation.** Depuis le 2026-07-21, une conversation est **soit écoutée par un sujet ouvert, soit pas** : dans la plage d'écoute **tous** les messages appartiennent au sujet, hors plage **aucun**. Il n'y a donc plus qu'**un état à dire par conversation**, et la granularité juste est la conversation — sur les deux canaux.

⚠️ **Il n'y a plus AUCUN rail ni marqueur d'appartenance par message, sur aucun canal.** Un signal identique sur chaque message de la plage n'apprendrait rien : un signal qui ne varie pas n'est pas un signal, c'est du décor.

⚠️ **Le « N sujets passés » n'est pas un ornement.** Il est la **seule** trace, côté conversation, des écoutes terminées. Sans lui, rien en lisant un fil ne dirait qu'une affaire y a été suivie puis close (cf. `01-principes.md §9`, « Deux renoncements assumés »).

⚠️ **Pas de fond coloré sur l'email, et c'est le point le plus facile à défaire par inadvertance.** Sur du texte long, un fond teinté fatigue et abîme la lisibilité — or la lisibilité est exactement ce qu'on vient chercher en sortant de la bulle. Gmail, Superhuman et Outlook font tous le même choix : c'est l'**en-tête** qui porte l'information, pas la couleur du bloc. Si l'usage montre que la distinction entrant/sortant reste insuffisante, on ajoutera une **teinte très légère au sortant seulement** — jamais aux deux.

Justification de fond : un email est **long et structuré** (signature, citation, mise en forme HTML), un message WhatsApp est **court et conversationnel**. La bulle est faite pour le second ; elle étrangle le premier.

#### Gestes

| Geste | email | WhatsApp | Mécanisme appelé |
|---|---|---|---|
| **Swipe gauche** (conversation) | libellé « **Supprimer** », fond **rouge** | libellé « **Ignorer** », fond **orange** | ⚠️ **`ignoreConversation` dans les deux cas**, après **confirmation nommant les sujets** écoutant ce fil |
| **Swipe droite** sur la **CONVERSATION** | ouvrir un **nouveau sujet**, ou **rattacher à un sujet existant** | — *(le geste porte sur le message)* | ouverture / rattachement |
| **Swipe droite** sur un **MESSAGE** | — | « ce message est important » → **commencer l'écoute ici** et ouvrir le sujet ; sur un message **plus ancien** qu'une écoute en cours, **elle remonte jusqu'à lui** | ouverture / extension d'écoute |
| **Tap sur un message** | **ouvrir une pièce jointe**, rien d'autre | **ouvrir une pièce jointe**, rien d'autre | — |

⚠️ **Le tap est réservé aux pièces jointes, sur les deux canaux** (2026-07-21). Il n'existe **plus aucune pop-up de message** — ni rattachement, ni détachement, ni choix d'ancre. Le tap est le geste le plus naturel sur un message : il doit avoir l'effet le plus prévisible et le plus inoffensif. Tout ce qui **modifie** l'appartenance passe par le **swipe**, geste délibéré.

⚠️ **Un seul geste WhatsApp qui crée ET qui étend.** Le swipe droite sur un message exprime toujours la même intention — « **l'affaire commence ici** » — qu'un sujet écoute déjà la conversation ou non. Une règle à retenir au lieu de deux, et aucun dispositif de correction dédié à construire.

⚠️ **« Supprimer » ne supprime AUCUNE donnée.** Le libellé est un habillage ; le mécanisme dessous est strictement `ignoreConversation`. Quatre raisons, à ne pas réinterpréter :

1. **L'email existe toujours dans la boîte Gmail de l'utilisateur** — Relvo n'en détient qu'une **copie**. « Supprimer » ne libérerait donc rien de ce que l'utilisateur croit libérer.
2. Cela **détruirait notre historique** : sujets, tâches, pièces jointes rattachés à ces messages.
3. Le fil restant chez **Unipile**, un nouveau message sur le même objet **recréerait la conversation**, vide de son passé — pire état que celui de départ.
4. Ce que l'utilisateur veut réellement, c'est que **ça sorte de sa pile de tri**. C'est exactement `ignoré`.

Pourquoi alors deux libellés ? Parce que le mot juste n'est pas le même selon le canal : on « ignore » un groupe WhatsApp bavard (la source continue de parler), on « supprime » un email traité (le geste attendu de toute boîte mail). **Habillage différent, mécanisme identique.**

#### La confirmation d'ignorance NOMME les sujets (2026-07-21)

Le swipe gauche sur une conversation **écoutée par un ou plusieurs sujets ouverts** ouvre d'abord une **confirmation**, qui **cite le titre de chaque sujet concerné** :

> Ignorer cette conversation ? Elle n'alimentera plus **Retard livraison sauce blanche**.

⚠️ **Jamais « un ou plusieurs sujets ».** On ne demande pas à quelqu'un de confirmer un risque sans lui dire lequel : une confirmation qui n'apporte pas l'information qu'elle réclame de valider se clique sans être lue, et cesse d'être une protection. Si la conversation n'est écoutée par aucun sujet ouvert, l'ignorance s'applique **sans confirmation** — il n'y a rien à perdre.

> ⚠️ **Garde — la divergence s'arrête au rendu et aux gestes.** Le domaine (ouverture de sujet, écoute, arrêt d'écoute, ignorance, statuts) reste **commun**. Le jour où l'on duplique la logique métier « parce que l'email est différent », on aura **deux produits**. Cf. `01-principes.md §3`.

### Surface de tri — le KPI « Sans sujet »

Les conversations **ne sont pas un onglet de navigation** : elles vivent derrière le **KPI « Sans sujet »** de la page Sujets. Ce KPI compte les conversations **actives qu'aucun sujet ouvert n'écoute** (`status = actif` ET dernier message avec `subject_id = null`) — autrement dit celles dont l'activité récente **n'est couverte par aucune écoute**, et qui peuvent donc solliciter l'utilisateur.

La liste expose **trois filtres** :

| Filtre | Contenu | Usage |
|---|---|---|
| **Sans sujet** *(défaut)* | conversations actives qu'aucun sujet ouvert n'écoute | le tri du jour |
| **Ignorées** | `status = ignoré` | se dédire, réactiver une source |
| **Toutes** | tout, y compris les conversations écoutées par un sujet | retrouver un fil, remonter un historique |

Un filtre secondaire permet de restreindre par **canal** (email / WhatsApp).

Ce placement est délibéré : exposer en permanence la liste des fils reviendrait à **réafficher une boîte de réception** que le dirigeant a déjà ailleurs. Par défaut, on ne montre que **ce qui n'est pas traité**.

### Le mot « conversation » est réservé — décision du 2026-07-20

Le mot désignait déjà **trois** choses : la surface chatbot plein écran (`/conversation`), son historique (`/conversations`), et l'onglet « Conversations » de la fiche Sujet. En introduire un quatrième sens aurait produit une ambiguïté quotidienne : « ouvre la conversation avec Karim » et « reprends ma conversation d'hier » n'auraient plus rien eu en commun.

Arbitrage : **le fil avec un interlocuteur externe garde le mot** — c'est celui du dirigeant, et celui de WhatsApp. La surface chatbot devient un **« échange avec Relvo »**, aux routes `/relvo` et `/relvo/historique`. Le chatbot n'était encore que des coquilles (M9) : le renommer coûtait dix minutes, l'inverse aurait coûté un renommage de modèle de données.

| Terme | Ce qu'il désigne | Où |
|---|---|---|
| **Conversation** | fil de messages avec un interlocuteur externe | entité `Conversation`, `/conversations` |
| **Échange** | session de dialogue avec l'assistant | `/relvo`, `/relvo/historique` |

### Remarques

Une conversation **n'est jamais découpée par thème** : cela exigerait d'inférer le sujet, donc de l'IA à la réception, ce qui ruinerait le déterminisme et rendrait son identité instable. La séparation des sujets se joue **au niveau du message** (cf. §7).

Le **non-lu se lit sur la conversation**, pas sur le sujet : c'est là que les messages arrivent, et c'est l'ouverture de la conversation qui pose `read_at` sur les messages.

Une conversation `ignoré` **sort du KPI et du filtre par défaut** : elle n'apparaît plus que via le filtre « Ignorées » ou « Toutes ». Elle continue de recevoir et de stocker ses messages — on ne perd rien.

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
- `status: enum(ouvert, validé, fermé)` — **cycle de vie** exclusif (cf. Mapping UI). Valeur par défaut à l'ouverture : `ouvert`. `validé` = travail fait ; `fermé` = sujet écarté. Il n'y a **plus** de statut `ignored` (migré sur la Conversation) ni `archived` (retiré)
- `closed_at: datetime nullable` — **simple date**, celle où l'utilisateur a considéré l'affaire close (validation ou fermeture). ⚠️ **Déclassé le 2026-07-21** : ce n'est **plus** « la borne haute de la fenêtre » et il ne gouverne **plus rien** de l'appartenance (cf. `SubjectConversation.closing_message_id` ci-dessous)
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

**Espace de travail** ouvert sur des conversations (cf. `01-principes.md §9`). Côté WhatsApp le sujet **écoute** une plage du flux ; côté email il **EST** le fil entier, sans découpe.

Un sujet rassemble :

- les messages (via leur `subject_id` — cf. §7)
- les pièces jointes
- les tâches
- les événements

### Table de liaison `SubjectConversation` — la table des ÉCOUTES

Un sujet agrège **0, 1 ou n conversations**. Chaque ligne de cette table est une **écoute** :

- `subject_id: UUID`
- `conversation_id: UUID`
- `anchor_message_id: UUID **nullable**` — **début de l'écoute** : le message à partir duquel le sujet écoute cette conversation. **`null` = pas de borne basse → tout le fil** (cas de l'email, qui n'écoute rien : il *est* le fil)
- `closing_message_id: UUID **nullable**` — **fin de l'écoute**, symétrique de la précédente : le dernier message que le sujet couvre sur cette conversation. **`null` = l'écoute est en cours**
- `created_at: datetime`
- contrainte `unique(subject_id, conversation_id)`

> ⚠️ **Le vocabulaire a changé le 2026-07-21, pas le modèle.** « Fenêtre » devient « **écoute** » (cf. `01-principes.md §3`) : `anchor_message_id` et `closing_message_id` **SONT** le début et la fin d'une écoute. Aucune colonne renommée, aucune migration.

#### Les deux bornes d'une écoute

| | début (`anchor_message_id`) | fin (`closing_message_id`) |
|---|---|---|
| **`null`** | pas de borne basse → **tout le fil** (email) | écoute **en cours** |
| **posée** | l'écoute **commence ici** (WhatsApp) | l'écoute **s'est arrêtée** ici |

**Pourquoi une borne qui désigne un message, et non une borne déduite de `closed_at`.** Deux raisons.

1. **`closed_at` est déclassé** en simple date (cf. Propriétés ci-dessus). Il dit *où en est l'affaire*, pas *ce qu'elle contient* : lui faire gouverner l'appartenance, c'était confondre **statut** et **appartenance** — l'erreur du modèle précédent (cf. `01-principes.md §3`).
2. **Une borne calculée sur un horodatage devient fausse dès que deux messages arrivent dans la même seconde** : impossible de dire lequel tombe avant la clôture. **Une borne qui désigne un message ne ment jamais.**

**Migration** : une **colonne nullable**, **aucun backfill**. Les lignes existantes valent « écoute en cours », ce qui est exactement leur état.

#### Ce que posent (et ne posent pas) les gestes d'arrêt

| Geste | Sens | `closing_message_id` |
|---|---|---|
| **Fermer le sujet** (`fermé`) | **toutes** les écoutes du sujet s'arrêtent ; la conversation ne référence plus ce sujet | **posée** sur le dernier message reçu, pour chaque conversation |
| **Valider le sujet** (`validé`) | la conversation **n'alimente plus** le sujet | **posée** sur le dernier message reçu |
| **Arrêter l'écoute** (feuille des conversations du sujet) | **cette conversation-là seulement** ; les autres continuent | **posée** sur le dernier message reçu |
| **Ignorer la conversation** (mute) | **PAUSE** — elle n'alimente plus **aucun** des sujets ouverts qui l'écoutent | ⚠️ **aucune** — réactiver la conversation fait **reprendre** l'alimentation |

Sans la dernière ligne, la réactivation d'une conversation ignorée n'aurait **aucun effet observable** : l'écoute serait déjà close.

#### Régime par canal

| | **email** (`objet`) | **WhatsApp** (`direct` / `groupe`) |
|---|---|---|
| `anchor_message_id` | **`null`** — rien à écouter, le fil *est* le sujet | le **message swipé** |
| `closing_message_id` | posé à la validation / fermeture / à l'arrêt de la liaison | posé à la validation / fermeture / à l'arrêt de l'écoute |
| Ce qui appartient au sujet | **tout le fil**, amont compris | les messages **entre les deux bornes** |
| Écoutes **successives** sur le même fil | possibles (après un statut terminal) | possibles |
| Signal d'appartenance dans la conversation | **bandeau « Suivi dans »** en en-tête | **le même bandeau** |

#### Une seule primitive de domaine — décision du 2026-07-21

Le domaine expose **une** fonction, pas deux : *ouvrir un sujet **sur une conversation**, avec une ancre **OPTIONNELLE***.

- ancre `null` → tout le fil ;
- ancre posée → l'écoute commence là.

⚠️ **La logique métier teste l'ANCRE, jamais le canal.** C'est l'application littérale de la garde de §5bis (« le canal décide du geste, jamais de la fonction appelée »). Le canal n'intervient que **dans l'UI**, pour décider **sur quoi porte le geste** et donc quelle valeur d'ancre il transmet : `null` pour un swipe sur une conversation email, le **message swipé** en WhatsApp.

⚠️ **Ouvrir un sujet depuis une conversation email doit balayer la conversation ENTIÈRE, en amont comme en aval.** C'est le piège d'implémentation le plus coûteux de cette décision : la règle en place ne balaie que les messages **postérieurs ou égaux à l'ancre** — règle héritée de WhatsApp, où elle est juste. Appliquée à l'email, elle produirait un sujet ne portant **qu'un seul message** sur un fil de six emails déjà échangés, ce qui est le contraire du besoin.

**Pourquoi cette asymétrie n'est pas un bricolage.** L'objet d'un email *est* une délimitation d'affaire, posée par l'expéditeur. Une conversation email a donc déjà un début ; une ancre n'y ajouterait rien et ne ferait que retrancher. En WhatsApp l'objet n'existe pas, et l'écoute le remplace. Autrement dit : **l'écoute est la prothèse d'un objet manquant** (cf. `01-principes.md §3` et l'encadré « échafaudage » de §9). Elle disparaîtra quand M7 saura découper un flux par le sens.

#### Ouvrir et ÉTENDRE une écoute — un seul geste (2026-07-21)

Côté WhatsApp, le **swipe droite sur un message** fait l'une ou l'autre chose selon le contexte, sans que l'utilisateur ait à le savoir :

- **aucun sujet n'écoute la conversation** → un sujet est ouvert, `anchor_message_id` = le message swipé ;
- **un sujet écoute déjà**, et le message swipé est **antérieur** à l'ancre → l'écoute **remonte** jusqu'à lui : `anchor_message_id` est réécrit, les messages traversés reçoivent le `subject_id` du sujet.

**Il n'y a donc aucun défaut d'ancre à calculer** : l'utilisateur désigne toujours le message lui-même. Les anciennes règles de défaut (« le dernier message, toujours » ; avant elle, « le plus ancien message non couvert ») sont **supprimées** — et avec elles tout dispositif de correction dédié.

#### Références, jamais des copies — invariant de modèle

> **Les messages d'une conversation vue depuis un sujet sont des RÉFÉRENCES, pas des copies.**

C'est déjà vrai, et c'est écrit ici parce qu'un futur lecteur pourrait le défaire en croyant bien faire (« dupliquons les messages dans le sujet pour simplifier les requêtes »).

- Un `Message` porte **`conversation_id`** (transport, jamais nul) **et `subject_id`** (appartenance sémantique, nullable).
- `SubjectConversation` est une **table de liaison** : elle dit *quel sujet écoute quelle conversation, et sur quelle plage*.
- Lu depuis la conversation ou depuis la fiche du sujet, **c'est la même ligne** en base.

Conséquence pratique : marquer un message comme lu, corriger son rattachement ou supprimer une pièce jointe se voit **partout à la fois**, sans synchronisation. Toute duplication réintroduirait des divergences que rien ne rattraperait.

Cette table porte la **règle de routage** (« ce sujet écoute cette conversation », donc les nouveaux messages lui reviennent). Elle ne porte **pas** l'appartenance des messages, qui vit sur `Message.subject_id` (cf. §7). C'est la seule redondance assumée du modèle : deux liens, deux rôles distincts.

**Règle V1 : au plus un sujet `ouvert` par conversation.** C'est ce qui rend l'état **binaire** — écoutée ou pas — et donc représentable par un bandeau unique. C'est une **règle métier, pas une contrainte de modèle** : la lever ne demandera aucune migration.

#### Plusieurs sujets simultanés sur une même conversation — écarté de la V1 (2026-07-21)

L'hypothèse est **mise de côté**. Elle ne coûte rien à écarter, et c'est le point important :

- `SubjectConversation` est **déjà** une table de liaison **plusieurs-à-plusieurs** — le schéma autorise n sujets sur une conversation **depuis le premier jour**. Rien à prévoir, rien à réserver.
- Ce qui l'interdit n'est **qu'une règle métier V1**, levable **sans migration**.
- ⚠️ Le jour où on la lèvera, il faudra **réinventer un signal d'appartenance plus fin** que le bandeau : celui-ci suppose qu'une conversation n'est écoutée que par un sujet à la fois. C'est le prix, assumé, de la simplification du 2026-07-21.

Et le cas jugé **plus probable** — des écoutes **successives** sur un même fil, sans chevauchement — **fonctionne déjà** : ce sont des plages disjointes, exprimées par la paire `anchor_message_id` / `closing_message_id`.

### Remarques

`reference` est un identifiant lisible métier. Exemples : `SUB-00124`, `RH-0042`.

Un sujet est ouvert par l'utilisateur — et plus tard par Relvo, via exactement la même mécanique. Ce qui varie d'un canal à l'autre est **ce sur quoi porte le geste** (la conversation en email, le message en WhatsApp) et donc la **valeur d'ancre transmise** (2026-07-21). En WhatsApp, les messages **antérieurs** à l'ancre restent dans la conversation sans appartenir au sujet ; en email, **il n'y a pas d'antérieurs exclus** — le fil entier appartient au sujet.

⚠️ **L'appartenance ne se corrige plus message par message dans l'UI** (2026-07-21). Une conversation est écoutée sur une **plage** : dans la plage, tous les messages appartiennent au sujet ; hors plage, aucun. Le seul ajustement offert est de **remonter le début de l'écoute** (swipe droite sur un message plus ancien). Détacher ou déplacer un message isolé n'existe plus côté interface — `Message.subject_id` reste dans le modèle, pour M7 (cf. `01-principes.md §9`, « Deux renoncements assumés »).

Un sujet démarre en `ouvert` avec `last_opened_at = null` — c'est ce champ (et non le statut) qui porte « jamais ouvert » et allume le marqueur dérivé **« Nouveau »**. Les tâches identifiées **ne changent pas le statut** : elles allument le marqueur dérivé **« À faire »**. L'ouverture de la fiche **pose `last_opened_at`** (acquittement implicite) et éteint « Nouveau » ; le statut **reste `ouvert`**.

À la validation ou à la fermeture, `closed_at` est posé — **c'est une date, rien d'autre**. Ce qui arrive aux **écoutes**, en revanche, est le même sur les deux canaux (2026-07-21) : `closing_message_id` est posé sur le dernier message reçu de **chaque** conversation, l'alimentation cesse, et la conversation **redevient orpheline** (elle réapparaîtra dans le KPI « Sans sujet » à son prochain message).

Relvo propose alors « **Souhaitez-vous aussi ignorer la conversation ?** » — c'est le geste qui empêche un fil bavard de solliciter de nouveau l'utilisateur au message suivant.

### La fiche du sujet — une seule conversation affichée à la fois

L'onglet **Conversations** de la fiche n'affiche **qu'une conversation à la fois** (décision du 2026-07-21 ; solutions écartées et raisons en `01-principes.md §9`).

- En tête de l'onglet, **une seule LIGNE** nomme la conversation affichée : **icône du canal + nom + état d'écoute** (« écoutée depuis le 14 juillet », « écoute arrêtée »).
- Cette ligne est **tapable** : elle ouvre une **feuille** listant **toutes** les conversations du sujet, chacune avec son état, et l'action « **arrêter l'écoute** ».
- Elle est donc à la fois le **sélecteur** de conversation et la **surface de gestion des écoutes** — cohérent, puisqu'on arrête une écoute là où l'on voit ce qu'elle alimente.
- Le **sélecteur du composer** est synchronisé avec elle : il désigne une **conversation**, plus un contact (cf. `CLAUDE.md` invariant n°11).

Coût : **une ligne de hauteur**, aucune ressemblance avec un système d'onglets, et le dispositif **monte à N conversations sans rien changer**.

Un sujet peut impliquer un ou plusieurs contacts. Le tableau `contact_ids` porte cette relation directement, sans table de liaison.

- Sujet mono-contact (cas courant) : `contact_ids = [UUID de Karim]`
- Sujet multi-contacts : `contact_ids = [UUID de Julien, UUID de Karim, UUID de Youssef]`
- Sujet sans contact (créé par l'utilisateur, pas encore de destinataire) : `contact_ids = []`

### Mapping UI

Un Sujet est un **espace de travail** ouvert sur des conversations — une **écoute** sur un flux côté WhatsApp, **le fil entier** côté email (cf. §5bis). Son affichage repose sur **deux axes orthogonaux** qu'il ne faut pas confondre — c'est la correction majeure du modèle de statut (l'ancien enum à 6 valeurs mélangeait les deux et se contredisait : un sujet pouvait être à la fois `to_do` *et* `unread`).

**Axe 1 — Cycle de vie (`status`, exclusif).** Trois valeurs, jamais cumulables :

| Statut | Sens | Alimenté ? | Récupérable ? | Libellé / visibilité UI |
|---|---|---|---|---|
| `ouvert` | l'affaire est **en cours** | oui | — | *(aucun badge — état par défaut)* |
| `validé` | le travail est **fait** | non | **oui** (onglet **Validés**) | **Validé** + coche |
| `fermé` | l'affaire est **écartée** — jamais traitée, abandonnée | non | **oui** (onglet **Fermés** → **Remettre**) | hors du flux des ouverts |

**La distinction entre les deux terminaux compte à la relecture.** `validé` = « c'est fait » ; `fermé` = « on ne l'a pas fait, et on ne le fera pas ». Les confondre rendrait impossible de répondre à « qu'ai-je réellement traité ce mois-ci ? ».

Transitions : `ouvert →(« Valider »)→ validé` ou `ouvert →(« Fermer »)→ fermé`. Le sujet **naît `ouvert`** ; ouvrir la fiche **ne change pas le statut** (il pose seulement `last_opened_at`, ce qui éteint le marqueur « Nouveau »). Les deux transitions terminales posent `closed_at` — **une date, pas une borne d'appartenance** — et **arrêtent les écoutes** du sujet (`closing_message_id` posé sur chaque conversation).

**« Fermer » est une SUPPRESSION DOUCE — décision du 2026-07-21.** L'utilisateur assimile spontanément « fermer » et « supprimer ». La décision est tranchée : **c'est un statut, jamais une destruction**. Le sujet sort de la vue, ses écoutes cessent, et il reste **récupérable** via l'onglet **« Fermés »** et son bouton **« Remettre »** (qui le repasse en `ouvert` ; les écoutes ne redémarrent **pas** d'elles-mêmes — l'utilisateur relance celle qu'il veut).

⚠️ **Vocabulaire imposé : « Fermer » / « Fermés » / « Remettre ».** Jamais « Supprimer » / « Corbeille ». Deux raisons :

1. **C'est honnête** — rien n'est détruit, autant que le mot le dise. Un vocabulaire de destruction pour une opération réversible produit soit l'hésitation (on n'ose plus fermer, la pile enfle), soit la fausse confiance (on croit avoir fait le ménage).
2. **Un sujet est le seul endroit où vivent les tâches et le journal des décisions.** Un message supprimé par erreur existe encore dans Gmail ; une **tâche** supprimée par erreur n'existe **nulle part ailleurs**. Le coût d'une fausse manœuvre est asymétrique — le mot doit le refléter.

**Réouverture.** Elle est **manuelle**, sur les deux canaux : c'est « **Remettre** » (onglet Fermés) ou la réouverture d'un sujet validé. Un nouveau message sur une conversation dont l'écoute est arrêtée **ne rouvre rien** : la conversation redevient **orpheline** et réapparaît dans le KPI « Sans sujet », où l'utilisateur décide.

> ⚠️ **Mécanisme supprimé le 2026-07-21 : la réouverture automatique d'un sujet email à la réception.** Écrite la veille, elle est incompatible avec la règle « un sujet `validé` n'est plus alimenté ». Un seul comportement d'arrêt, identique sur les deux canaux, vaut mieux qu'une exception par canal — c'est précisément le genre de divergence que la garde du §5bis interdit.

Le principe directeur reste : **l'état par défaut est invisible** — un badge porté par 90 % des sujets n'informe pas ; on lit le statut par soustraction.

> **Note historique.** `acknowledged` devient `ouvert`, `resolved` devient `validé`. **`archived`** est **retiré** : il n'exprimait rien qu'une fermeture n'exprime déjà. **`ignored`** est **retiré du sujet et migré sur la Conversation** (§5bis) : ce n'est pas un sujet qu'on veut faire taire, c'est une source. L'« ignorance collante » et la purge à 15 jours disparaissent avec lui (décision du 2026-07-20).

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

L'onglet **« Ouverts »** de la page Sujets (et le widget de l'Accueil) liste tous les sujets `status = ouvert`, **urgents en tête** (`priority = urgent`). C'est `getOpenFeed`. Pas de feed « Priorité » distinct : la rareté du drapeau urgent suffit à hiérarchiser.

Deux actions structurent le tri, exposées **en gestes de swipe** sur mobile (et en boutons sur la fiche / les cartes urgentes) :

- **Fermer** (swipe gauche, rouge) — passe le `status` à **`fermé`** et pose `closed_at`. Le sujet quitte les ouverts et rejoint l'onglet **Fermés**, d'où « **Remettre** » le ramène. Relvo enchaîne avec la proposition « **Souhaitez-vous aussi ignorer la conversation ?** ».
- **Valider** (swipe droite, vert, icône coche) — passe le `status` à **`validé`** et pose `closed_at`. C'est la clôture « travail fait ».

Dans les deux cas, **sur les deux canaux**, `closing_message_id` est posé sur chaque conversation écoutée : l'alimentation cesse et la conversation **redevient orpheline** (2026-07-21).

**On n'archive pas et on ne supprime pas un sujet : on le ferme, et on peut le remettre.** Le vocabulaire est celui d'un dossier qu'on met de côté — *ouvrir / fermer / remettre* — et non celui d'un fichier — *créer / supprimer*.

> **Note historique.** Le geste « Ignorer » (swipe gauche) **change de cible** sans changer de sens : il continue de vouloir dire « écarter », mais il s'applique désormais à une **conversation** (page Conversations), tandis que le swipe gauche sur un **sujet** signifie **Fermer**. « Terminer » devient « **Valider** » (décision du 2026-07-20).

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
- `conversation_id: UUID` — **non nullable** : tout message appartient à une conversation, déterminée à la réception (cf. §5bis). C'est ce qui fait qu'il n'existe plus de message orphelin.
- `subject_id: UUID nullable` — **appartenance sémantique**, décidée message par message. Null = ce message n'est couvert par aucun sujet.
- `folder_id: UUID nullable` — **domaine assigné au message à la réception** (classification auto par Relvo). C'est ce domaine qui **donne ensuite son domaine au Sujet** ouvert depuis le message. Null = non classé.
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
- `read_at: datetime nullable` — lu/non-lu d'un message entrant. Marqué lu à l'ouverture de la **conversation** (et non plus du sujet — cf. §5bis). Null = non-lu. Alimente la pastille de non-lus et la remontée en tête de la liste Conversations.
- `status: enum(received, linked, sent, failed, ignored)`
- `triage_hint: enum(too_short, ambiguous, prospection, unknown_sender, informative_only, other) nullable`
- `created_at: datetime`
- `updated_at: datetime`

### Remarques

- `subject_line` est surtout utile pour l'email.
- `external_thread_id` aide au rattachement d'un email à un fil existant.
- `subject_id` reste **nullable**, mais son sens a changé : ce n'est plus « message que Relvo n'a pas su traiter », c'est « message **hors de toute plage d'écoute** ». Il n'y a **plus de message orphelin** — le message est toujours rangé dans une conversation. C'est la **granularité fine** du modèle : elle permettrait de séparer des sujets **entrelacés** dans un même fil (Karim parle de la sauce blanche et de la facture emballages en alternance). ⚠️ **Cette finesse n'est plus exposée dans l'interface** depuis le 2026-07-21 — elle reste dans le modèle, à destination de M7 (cf. `01-principes.md §9`).
- **Comment `subject_id` se remplit.** À la réception, le message est rattaché **automatiquement** au sujet qui **écoute** sa conversation (via `SubjectConversation`, cf. §6) — à condition que l'écoute soit **en cours** (`closing_message_id = null`) et que la conversation ne soit pas `ignoré`. Une écoute arrêtée ne reprend rien : le message reste sans sujet et la conversation réapparaît dans le KPI « Sans sujet ». **Même règle sur les deux canaux.**
- `folder_id` porte le **domaine** que Relvo assigne au message dès la réception. Lorsqu'un Sujet est ensuite créé à partir du message, il **hérite de ce domaine**. Relation `Folder?` (`onDelete: SetNull`) : le modèle `Folder` porte donc aussi `messages`.
- Un message avec `status = ignored` est un message que l'utilisateur a volontairement écarté (spam, non pertinent) sans lui affecter de sujet.
- `sender_contact_id` est **nullable**. Un message peut exister sans contact associé : c'est le cas quand l'expéditeur est inconnu et qu'aucun sujet n'a encore été créé. L'information brute de l'expéditeur (adresse email ou numéro de téléphone) est conservée dans `sender_raw` pour permettre la création ultérieure du contact si l'utilisateur décide de traiter le message.
- ⚠️ **`triage_hint` est caduc** (2026-07-20). Il expliquait *pourquoi* Relvo n'avait pas su rattacher un message et alimentait la pile « Sans sujet ». Le rangement en conversation étant désormais **déterministe et infaillible**, il n'y a plus d'échec à justifier. Le champ est conservé pour l'historique mais n'est plus alimenté ni affiché. Valeurs (historiques) :
  - `too_short` — message trop court pour être exploitable ("Ok merci", "Bien reçu")
  - `ambiguous` — intention floue, sens non identifiable
  - `prospection` — démarchage commercial probable
  - `unknown_sender` — expéditeur inconnu sans contexte suffisant
  - `informative_only` — message compris mais purement informatif, sans accroche pour ouvrir un sujet
  - `other` — autre cas non couvert par les valeurs ci-dessus

### Affichage par conversation

La conversation **n'est plus un concept d'affichage** : c'est une **entité à part entière** (§5bis), calculée à la réception. La page **Conversations** — hors navigation, atteinte par le KPI « Sans sujet » — liste ces entités, **non-lus en tête**, avec les trois filtres décrits en §5bis. Ouvrir une conversation affiche ses messages dans l'ordre chronologique.

⚠️ **Le rendu diffère par canal** (2026-07-20, cf. §5bis) : **bulles** en WhatsApp, **pleine largeur sans fond coloré** en email (en-tête avatar + expéditeur + date, « Moi » pour le sortant). De même pour les gestes : swipe gauche « Ignorer » (orange) en WhatsApp, « Supprimer » (rouge) en email — **même appel `ignoreConversation`, aucune donnée supprimée**.

**Le signal d'appartenance est un BANDEAU EN EN-TÊTE, sur les deux canaux** (2026-07-21) : « **Suivi dans : *titre du sujet*** » + pastille de couleur du **domaine** (`Folder`), cliquable vers la fiche, avec un « **N sujets passés** » qui déplie les écoutes terminées (cf. §5bis).

⚠️ **Il n'existe plus AUCUN marqueur d'appartenance par message** — plus de point de couleur, plus de rail, plus de trait reliant les messages. Une conversation est **écoutée par un sujet ouvert, ou pas** : dans la plage d'écoute tous les messages appartiennent au sujet, hors plage aucun. Un marqueur répété sur chaque message de la plage n'apprendrait donc rien.

**Le tap sur un message ne sert qu'à ouvrir une pièce jointe**, sur les deux canaux. Il n'y a **plus de pop-up de message** — ni détachement, ni rattachement, ni choix d'ancre. Ce qui **modifie** l'appartenance passe par le **swipe droite** (sur la conversation en email, sur le message en WhatsApp).

> **Note historique.** Le modèle antérieur regroupait, au sein d'un sujet, les messages **par contact tous canaux confondus**, et la page **Messages** listait à part une **pile d'orphelins** (`subject_id = null`, rétention 15 j). Les deux disparaissent : le regroupement devient une entité déterministe, et la page Messages cède la place à **Conversations** (décision du 2026-07-20).

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
