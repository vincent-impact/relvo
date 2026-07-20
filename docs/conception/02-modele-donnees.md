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
- **WhatsApp direct** → la conversation existante est **rattachée au sujet avec une nouvelle ancre**.

Même bouton côté interface, deux mécaniques sous-jacentes.

Plus profondément, la clé dit **ce qu'est** la conversation :

| Clé | Contient | Nature |
|---|---|---|
| `email:<interlocuteur>:<objet>` | la personne **et l'affaire** | ≈ un sujet, par construction |
| `wa-direct:<numéro>` / `wa-group:<chat_id>` | la personne / le groupe **seuls** | un flux d'affaires successives |

C'est de là que découle le **régime d'ancre par canal** (§6) : l'ancre n'est que la prothèse d'un objet manquant (cf. `01-principes.md §3`).

### Rendu et gestes par canal — décision du 2026-07-20

Après test en production de M6bis : forcer la même UX sur les deux canaux dessert les deux. La divergence est **limitée au rendu et aux gestes** — le domaine reste **commun** (voir la garde en fin de section).

#### Rendu des messages

| | email | WhatsApp |
|---|---|---|
| Forme | **pleine largeur**, emails enchaînés au fil du scroll (comme l'ancien `/messages/[id]`) | **bulles** conservées |
| Fond | **blanc dans les deux sens** — aucun fond coloré | teinté, comme aujourd'hui |
| Ce qui porte le sens entrant/sortant | l'**en-tête** : avatar + expéditeur + date ; le sortant se signale par un « **Moi** » et un **discret rail de couleur à gauche** | la position et la teinte de la bulle |

⚠️ **Pas de fond coloré sur l'email, et c'est le point le plus facile à défaire par inadvertance.** Sur du texte long, un fond teinté fatigue et abîme la lisibilité — or la lisibilité est exactement ce qu'on vient chercher en sortant de la bulle. Gmail, Superhuman et Outlook font tous le même choix : c'est l'**en-tête** qui porte l'information, pas la couleur du bloc. Si l'usage montre que la distinction entrant/sortant reste insuffisante, on ajoutera une **teinte très légère au sortant seulement** — jamais aux deux.

Justification de fond : un email est **long et structuré** (signature, citation, mise en forme HTML), un message WhatsApp est **court et conversationnel**. La bulle est faite pour le second ; elle étrangle le premier.

#### Gestes

| Geste | email | WhatsApp | Mécanisme appelé |
|---|---|---|---|
| **Swipe gauche** (conversation) | libellé « **Supprimer** », fond **rouge** | libellé « **Ignorer** », fond **orange** | ⚠️ **`ignoreConversation` dans les deux cas** |
| **Swipe droite** (conversation) | ouvrir un sujet | ouvrir un sujet | ouverture de sujet |
| **Tap sur un message** | **aucun** — pas de pop-up, et **on ne peut pas ouvrir un sujet depuis un message** | pop-up (détacher / ouvrir un sujet / rattacher) | — |

⚠️ **« Supprimer » ne supprime AUCUNE donnée.** Le libellé est un habillage ; le mécanisme dessous est strictement `ignoreConversation`. Quatre raisons, à ne pas réinterpréter :

1. **L'email existe toujours dans la boîte Gmail de l'utilisateur** — Relvo n'en détient qu'une **copie**. « Supprimer » ne libérerait donc rien de ce que l'utilisateur croit libérer.
2. Cela **détruirait notre historique** : sujets, tâches, pièces jointes rattachés à ces messages.
3. Le fil restant chez **Unipile**, un nouveau message sur le même objet **recréerait la conversation**, vide de son passé — pire état que celui de départ.
4. Ce que l'utilisateur veut réellement, c'est que **ça sorte de sa pile de tri**. C'est exactement `ignoré`.

Pourquoi alors deux libellés ? Parce que le mot juste n'est pas le même selon le canal : on « ignore » un groupe WhatsApp bavard (la source continue de parler), on « supprime » un email traité (le geste attendu de toute boîte mail). **Habillage différent, mécanisme identique.**

Côté email, le **tap sur message disparaît** parce qu'il n'a plus d'objet : l'objet de l'email délimite déjà l'affaire, donc le sujet s'ouvre **depuis la conversation**, jamais depuis un message. Réintroduire un tap par message y recréerait un choix que le canal a déjà tranché.

> ⚠️ **Garde — la divergence s'arrête au rendu et aux gestes.** Le domaine (ouverture de sujet, ancre, rattachement, détachement, ignorance, statuts) reste **commun**. Le jour où l'on duplique la logique métier « parce que l'email est différent », on aura **deux produits**. Cf. `01-principes.md §3`.

### Surface de tri — le KPI « Sans sujet »

Les conversations **ne sont pas un onglet de navigation** : elles vivent derrière le **KPI « Sans sujet »** de la page Sujets. Ce KPI compte les conversations **actives dont le dernier message n'est rattaché à aucun sujet** (`status = actif` ET dernier message avec `subject_id = null`) — autrement dit celles dont l'activité récente **n'est couverte par aucune fenêtre**, et qui peuvent donc solliciter l'utilisateur.

La liste expose **trois filtres** :

| Filtre | Contenu | Usage |
|---|---|---|
| **Sans sujet** *(défaut)* | conversations actives dont le dernier message n'a pas de sujet | le tri du jour |
| **Ignorées** | `status = ignoré` | se dédire, réactiver une source |
| **Toutes** | tout, y compris les conversations couvertes par un sujet | retrouver un fil, remonter un historique |

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
- `closed_at: datetime nullable` — date de fermeture ou de validation. **Borne haute de la fenêtre** : un message postérieur n'appartient plus au sujet
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

**Fenêtre de travail temporaire** ouverte sur des conversations (cf. `01-principes.md §9`).

Un sujet rassemble :

- les messages (via leur `subject_id` — cf. §7)
- les pièces jointes
- les tâches
- les événements

### Table de liaison `SubjectConversation`

Un sujet agrège **0, 1 ou n conversations**, chacune avec **le régime d'ancre de son canal** :

- `subject_id: UUID`
- `conversation_id: UUID`
- `anchor_message_id: UUID **nullable**` — le message à partir duquel la fenêtre s'ouvre sur cette conversation. **`null` = la fenêtre couvre le fil entier** (cas de l'email)
- `created_at: datetime`
- contrainte `unique(subject_id, conversation_id)`

#### Régime d'ancre par canal — décision du 2026-07-20

| | **email** (`objet`) | **WhatsApp** (`direct` / `groupe`) |
|---|---|---|
| `anchor_message_id` | **`null`** | le **message de départ** |
| Ce qui appartient au sujet | **tout le fil**, y compris les messages **ANTÉRIEURS** à l'ouverture du sujet | les messages **à partir de l'ancre** |
| Glissement d'ancre au détachement | **sans objet** | s'applique |
| Ancre déplaçable par l'utilisateur | sans objet | **oui** (« le sujet commence ici ») |

**Aucune migration** : `anchor_message_id` est déjà nullable.

⚠️ **Ouvrir un sujet depuis une conversation email doit balayer la conversation ENTIÈRE, en amont comme en aval.** C'est le piège d'implémentation le plus coûteux de cette décision : la règle en place ne balaie que les messages **postérieurs ou égaux à l'ancre** — règle héritée de WhatsApp, où elle est juste. Appliquée à l'email, elle produirait un sujet ne portant **qu'un seul message** sur un fil de six emails déjà échangés, ce qui est le contraire du besoin.

**Pourquoi cette asymétrie n'est pas un bricolage.** L'objet d'un email *est* une délimitation d'affaire, posée par l'expéditeur. Une conversation email a donc déjà un début ; l'ancre n'y ajouterait rien et n'y ferait que retrancher. En WhatsApp l'objet n'existe pas, et l'ancre le remplace. Autrement dit : **l'ancre est la prothèse d'un objet manquant** (cf. `01-principes.md §3` et l'encadré « échafaudage » de §9). Elle disparaîtra quand M7 saura découper un flux par le sens.

#### Choix de l'ancre au swipe droite (WhatsApp)

Principe directeur : **un défaut réparable en un geste bat un choix imposé à chaque fois.**

Il n'y a donc **pas de sélecteur d'ancre dans le parcours du swipe** — deux raisons. D'abord, cela rendrait le swipe **redondant** avec le tap sur message (qui existe précisément pour désigner un point de départ) et lui ferait perdre sa **vitesse**, seule justification de son existence. Ensuite, cela demanderait une décision **au mauvais moment** : le geste réel de l'utilisateur est « **ça devient un sujet** » ; savoir *où ça a commencé* vient après, une fois le sujet sous les yeux.

| Situation | Ancre par défaut | Pourquoi |
|---|---|---|
| La conversation a **déjà porté** un sujet | le **plus ancien message non encore couvert** par un sujet, borné par la fenêtre précédente | ce sont exactement les messages **non triés** — c'est pour eux que la conversation apparaît dans « Sans sujet » |
| La conversation **n'a JAMAIS porté** de sujet | le **dernier** message | ⚠️ **exception** : le défaut ci-dessus remonterait à des **mois** d'historique. On ne devine pas — à l'utilisateur de remonter l'ancre |

L'ancre est ensuite **visible et déplaçable depuis le sujet** (« le sujet commence ici ») : la **remonter** fait entrer les messages antérieurs, la **descendre** les fait sortir. Et le **tap sur message reste disponible** pour l'utilisateur qui sait déjà où l'affaire commence — il court-circuite le défaut.

Cette table porte la **règle de routage** (« ce sujet est la fenêtre active sur cette conversation », donc les nouveaux messages lui reviennent). Elle ne porte **pas** l'appartenance des messages, qui vit sur `Message.subject_id` (cf. §7). C'est la seule redondance assumée du modèle : deux liens, deux rôles distincts.

**Règle V1 : au plus un sujet `ouvert` par conversation.** Elle rend la destination d'un nouveau message non ambiguë tant qu'aucune IA ne sait séparer des sujets entrelacés. C'est une **règle métier, pas une contrainte de modèle** : la lever ne demandera aucune migration.

### Remarques

`reference` est un identifiant lisible métier. Exemples : `SUB-00124`, `RH-0042`.

Un sujet est ouvert par l'utilisateur — et plus tard par Relvo, via exactement la même mécanique. **Le point d'entrée dépend du canal** (cf. régime d'ancre ci-dessus) : depuis un **message d'ancrage** en WhatsApp, depuis la **conversation** en email (où il n'existe pas d'ouverture par message). En WhatsApp, les messages **antérieurs** à l'ancre restent dans la conversation sans appartenir au sujet ; en email, **il n'y a pas d'antérieurs exclus** — le fil entier appartient au sujet.

Cas limites de l'ancre :

- si le message d'ancrage est **détaché**, l'ancre **glisse** au message suivant du sujet — *WhatsApp uniquement, sans objet quand `anchor_message_id = null`* ;
- rattacher un message **isolé** à un autre sujet **ne déplace pas** la fenêtre active — seule l'ouverture d'un sujet pose une ancre ;
- déplacer l'ancre depuis le sujet (« le sujet commence ici ») **recompose** l'appartenance : la remonter fait entrer les messages antérieurs, la descendre les fait sortir.

Un sujet démarre en `ouvert` avec `last_opened_at = null` — c'est ce champ (et non le statut) qui porte « jamais ouvert » et allume le marqueur dérivé **« Nouveau »**. Les tâches identifiées **ne changent pas le statut** : elles allument le marqueur dérivé **« À faire »**. L'ouverture de la fiche **pose `last_opened_at`** (acquittement implicite) et éteint « Nouveau » ; le statut **reste `ouvert`**.

À la validation ou à la fermeture, `closed_at` est posé : la fenêtre se **fige**, et les conversations qu'elle portait **redeviennent orphelines** (plus aucun sujet actif ne les couvre). Relvo propose alors « **Souhaitez-vous aussi ignorer la conversation ?** ».

Un sujet peut impliquer un ou plusieurs contacts. Le tableau `contact_ids` porte cette relation directement, sans table de liaison.

- Sujet mono-contact (cas courant) : `contact_ids = [UUID de Karim]`
- Sujet multi-contacts : `contact_ids = [UUID de Julien, UUID de Karim, UUID de Youssef]`
- Sujet sans contact (créé par l'utilisateur, pas encore de destinataire) : `contact_ids = []`

### Mapping UI

Un Sujet est une **fenêtre de travail temporaire** ouverte sur des conversations. Son affichage repose sur **deux axes orthogonaux** qu'il ne faut pas confondre — c'est la correction majeure du modèle de statut (l'ancien enum à 6 valeurs mélangeait les deux et se contredisait : un sujet pouvait être à la fois `to_do` *et* `unread`).

**Axe 1 — Cycle de vie (`status`, exclusif).** Trois valeurs, jamais cumulables :

| `status` | Libellé UI | Visible ? |
|---|---|---|
| `ouvert` | *(ouvert)* | **non** — état par défaut, aucun badge |
| `validé` | **Validé** | oui (onglet Validés + coche) |
| `fermé` | *(fermé)* | **non** — hors du flux, la fenêtre est close |

Transitions : `ouvert →(« Valider »)→ validé` ou `ouvert →(« Fermer »)→ fermé`. Le sujet **naît `ouvert`** ; ouvrir la fiche **ne change pas le statut** (il pose seulement `last_opened_at`, ce qui éteint le marqueur « Nouveau »). Les deux transitions terminales posent `closed_at` : la fenêtre se **fige** et les conversations portées **redeviennent orphelines**.

**Il n'y a pas de « réouverture » d'un sujet clos.** Un nouveau message sur une conversation dont le sujet a été fermé ou validé n'y revient pas : la conversation est redevenue orpheline, et c'est un **nouveau** sujet qui sera ouvert (depuis une nouvelle ancre) si l'utilisateur le souhaite. C'est précisément pour éviter qu'un fil bavard reproposeindéfiniment de nouveaux sujets que Relvo suggère, à la fermeture, d'**ignorer la conversation**.

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

- **Fermer** (swipe gauche, rouge) — passe le `status` à **`fermé`** et pose `closed_at`. Le sujet quitte les ouverts ; ses conversations redeviennent orphelines. Relvo enchaîne avec la proposition « **Souhaitez-vous aussi ignorer la conversation ?** ».
- **Valider** (swipe droite, vert, icône coche) — passe le `status` à **`validé`** et pose `closed_at`. C'est la clôture « travail fait ».

**On n'archive pas et on ne supprime pas un sujet : on le ferme.** Le vocabulaire est celui d'une fenêtre — *ouvrir / fermer* — et non celui d'un fichier — *créer / supprimer*.

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
- `subject_id` reste **nullable**, mais son sens a changé : ce n'est plus « message que Relvo n'a pas su traiter », c'est « message **non couvert par une fenêtre de sujet** ». Il n'y a **plus de message orphelin** — le message est toujours rangé dans une conversation. C'est la **granularité fine** du modèle : elle permet de séparer des sujets **entrelacés** dans un même fil (Karim parle de la sauce blanche et de la facture emballages en alternance), ce qu'aucune fenêtre purement temporelle ne saurait faire.
- **Comment `subject_id` se remplit.** À la réception, si la conversation du message porte un sujet `ouvert` (via `SubjectConversation`, cf. §6), le message lui est rattaché **automatiquement** — c'est la règle d'ancrage. L'utilisateur (et plus tard Relvo) peut ensuite **détacher** ou **déplacer** un message à la marge. L'ancrage est donc un **défaut**, pas une définition.
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

⚠️ **Le rendu diffère par canal** (2026-07-20, cf. §5bis) : **bulles** en WhatsApp, **pleine largeur sans fond coloré** en email (en-tête avatar + expéditeur + date, « Moi » et rail de couleur discret pour le sortant). De même pour les gestes : swipe gauche « Ignorer » (orange) en WhatsApp, « Supprimer » (rouge) en email — **même appel `ignoreConversation`, aucune donnée supprimée**.

**Le cordon de sujet.** Dans une conversation, chaque message porte à sa gauche un **point de couleur** — la couleur du **domaine** (`Folder`) de son sujet. Les points de messages **consécutifs appartenant au même sujet** sont reliés par un trait, formant un **cordon**. Un message sans sujet porte un point creux, non relié. Quand plusieurs sujets s'entrelacent, le cordon **se brise** et les couleurs alternent : cette rupture visuelle *est* l'information — elle montre que le fil mélange plusieurs affaires. Un seul rail, quel que soit le nombre de sujets (des rails parallèles seraient illisibles sur mobile).

**Le tap sur un message est WhatsApp uniquement** (2026-07-20). Il ouvre une **pop-up** : si le message est rattaché, elle affiche son sujet et permet de l'en **détacher** ; s'il ne l'est pas, elle propose d'**ouvrir un sujet** à partir de ce message (il en devient l'ancre) ou de le **rattacher à un sujet existant**. **Côté email, il n'y a plus de tap**, et **on ne peut pas ouvrir un sujet depuis un message** — l'objet délimite déjà l'affaire, le sujet s'ouvre depuis la **conversation**.

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
