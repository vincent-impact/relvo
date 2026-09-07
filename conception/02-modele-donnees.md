# 2. Modèle de données

> **Fait foi sur le PERSISTÉ** : entités, champs, relations, contraintes. Quand le schéma et ce
> document divergent, **c'est le document qui a raison et le schéma qui rattrape**.
>
> Ce document décrit **ce qui est stocké et pourquoi**. Il ne décrit **pas** ce que le produit
> *fait* de ces données : les cycles de vie, les règles de rattachement et les transitions font
> foi dans [`04-design-domaine.md`](04-design-domaine.md). Il ne décrit pas non plus le rendu :
> cela vit dans [`design-system/`](design-system/).
>
> ⚠️ **Aucun décompte ici.** Ni nombre d'entités, ni nombre de contraintes, ni nombre de tests :
> un décompte est juste le jour où on l'écrit et faux à la migration suivante, et **rien
> n'échoue quand il est faux**. Ce qui doit rester vérifié l'est par un test (voir la dernière
> section).

---

## Conventions

### Le tenant

`Account` est l'entité racine. **Toute** ressource métier porte un `account_id`, et cet
identifiant est **toujours dérivé de la session**, jamais d'un paramètre client. C'est le filtre
d'isolation systématique de toutes les requêtes.

Il n'y a **aucune clé étrangère utilisateur** sur les ressources : en V1 un compte correspond à
un seul humain, et l'introduire prématurément coûterait une migration pour rien.

### Le type partagé `Actor`

```
Actor = enum(user, ai, contact, system)
```

Il désigne **qui porte la donnée** — création, exécution, complétion, action dans le journal.

| Valeur | UI | Est-ce une entité ? |
|---|---|---|
| `user` | **Moi** | non — l'humain est implicite via `account_id` |
| `ai` | **Relvo** | non — c'est un mécanisme du compte |
| `contact` | **Externe** | **oui** — l'entité `Contact` |
| `system` | — | non — événements techniques, généralement non affichés |

**Convention de nommage** : tout attribut typé `Actor` porte le suffixe `_actor`
(`source_actor`, `created_by_actor`, `completed_by_actor`, `executed_by_actor`), pour rendre le
typage évident à la lecture. Sur `EventLog`, l'entité n'en portant qu'un, on écrit `actor` sans
suffixe redondant.

Quand un événement doit pointer vers le contact concret, un champ `contact_id` **explicite** le
porte — renseigné **uniquement** quand `actor = contact`.

### Nommage

Les colonnes sont en `snake_case` en base, exposées en `camelCase` par le client. Les
identifiants sont des UUID opaques : aucun identifiant séquentiel ne fuit vers le client.

---

## Account

Entité racine et tenant : porteur de l'authentification et propriétaire des ressources.

Porte l'identité de connexion (adresse, empreinte de mot de passe **nullable** — un compte lié à
un fournisseur externe n'en a pas), l'identité affichée (prénom, nom), un rôle, un indicateur
d'activité, et les marqueurs de vérification d'adresse.

**Un compte = un humain en V1.** Le partage d'un compte entre plusieurs personnes est reporté et
impliquera une entité `User` distincte.

## Folder

Un **domaine** : conteneur métier qui regroupe les sujets d'un périmètre, les documents de
connaissance qui servent à les traiter, et les messages classés dans ce domaine à la réception.

Porte un nom, un identifiant lisible, une description, et deux clés de présentation — couleur et
icône — **nullables**, avec repli sur un mapping dérivé de l'identifiant lisible.

`is_default` marque le domaine **« Général »**, auto-créé à la création du compte.

**Invariant structurel :** aucun `Subject.folder_id` ne pointe vers le domaine « Général ».
Quand Relvo ne sait pas classer un sujet, `folder_id` reste **nul** — le sujet apparaît « sans
domaine » plutôt que d'atterrir dans Général. Cela préserve le rôle de mémoire transversale de
celui-ci au lieu d'en faire un dépotoir. Le comportement associé fait foi dans `04`.

## Contact

Une personne, **indépendamment du canal** par lequel elle communique. Le contact n'est jamais
dupliqué par canal.

Porte un prénom **nullable** (nul pour une raison sociale) et un nom — ce dernier servant de clé
de tri et de sectionnement de l'annuaire —, une entreprise, un domaine d'affinité **nullable**
qui oriente la qualification de ses messages, un statut, la source de sa création, et des notes.

**Coordonnées primaires et secondaires.** L'adresse et le téléphone **primaires** sont des
champs simples ; les **secondaires** sont des tableaux. L'auto-rattachement des messages entrants
consulte **les deux**.

⚠️ **Les adresses secondaires sont stockées en minuscules.** La recherche d'appartenance dans un
tableau est **exacte** — il n'existe pas d'option d'insensibilité à la casse sur les tableaux —,
donc la normalisation doit se faire à l'écriture. Des helpers dédiés portent cette comparaison ;
aucun appelant ne compare deux adresses à la main.

**Deux statuts, et ils suivent la source :**

| Statut | Ce que ça veut dire | `source_actor` |
|---|---|---|
| `auto` | fiche déduite d'un message (signature, nom d'expéditeur) — partielle, non vérifiée | `ai` |
| `complete` | l'utilisateur a vérifié et complété | `user` |

Un champ « fonction » subsiste en base mais n'est plus éditable dans l'interface. Il n'est pas
supprimé : une colonne retirée ne se récupère pas, et rien ne coûte à la garder.

## Channel et ChannelConfig

Un **`Channel`** est un point d'entrée de communication **côté utilisateur** — sa boîte mail, son
numéro. Il porte un nom, un type, l'identifiant public correspondant, et les domaines qu'il
oriente.

⚠️ **Le canal n'est pas le contact.** Un canal est « ma boîte fournisseurs » ; un contact est une
personne extérieure qui peut écrire sur n'importe lequel de ces canaux.

**`ChannelConfig`** porte la configuration technique — fournisseur, données de connexion
opaques, statut de connexion, date de dernière synchronisation, et l'identifiant du compte chez
l'agrégateur. Elle est séparée pour ne pas alourdir `Channel` de secrets et d'état de connexion.

**Un seul canal connecté par type.** Le domaine refuse un second canal du même type. Motif :
simplicité d'usage, et facturation à l'usage chez l'agrégateur.

## Conversation

Couche de **transport et d'identité** : le regroupement déterministe des messages, calculé à la
réception, sans IA. Une conversation est **durable** — elle ne se supprime pas et ne se termine
jamais.

Elle a **deux sous-types**, qui partagent la même base et divergent sur deux attributs :

| | **E-mail** | **Messagerie** |
|---|---|---|
| A un objet | **oui** | non |
| Interlocuteurs | un **set** (1 = direct, ≥ 2 = groupe) | **un seul** : un contact, ou un groupe |

Le comportement qui en découle — rattachement permanent d'un côté, écoute de l'autre — fait foi
dans `04`.

### Ce que porte l'entité

- Le **canal** par lequel elle transite.
- Le **sous-type** et la **forme** (direct / groupe), portés par deux énumérés distincts : le
  premier discrimine la nature, le second la cardinalité.
- La **clé canonique**, unique par compte, qui matérialise le discriminant.
- Un **titre** : l'objet, le nom du groupe, ou le nom du contact.
- **Le contact unique** (messagerie directe) **ou le set de contacts** (e-mail) — deux champs
  distincts, et c'est le point structurant du sous-typage.
- L'**interlocuteur brut** — adresses ou numéro — tant qu'aucun contact n'est enregistré.
- L'**identifiant de fil externe**, qui sert aussi de cible d'envoi en messagerie.
- L'**objet normalisé**, e-mail uniquement.
- Un **statut** : active, ou ignorée.
- La **date et la référence du dernier message**, qui pilotent le tri de la liste.

### Les clés

| Sous-type / forme | Discriminant | Clé |
|---|---|---|
| e-mail / direct | objet normalisé + **le** destinataire | `email:<objet>:<destinataire>` |
| e-mail / groupe | objet normalisé + **set trié** de destinataires | `email:<objet>:<set trié>` |
| messagerie / direct | l'interlocuteur | `wa-direct:<numéro>` |
| messagerie / groupe | le fil de groupe | `wa-group:<identifiant de fil>` |

La clé est calculée à la réception : on cherche la conversation correspondante, sinon on la crée.
**C'est tout l'algorithme de rangement** — déterministe, et il ne peut pas échouer.

⚠️ **La clé e-mail inclut le SET de destinataires**, trié et normalisé, pas un interlocuteur
unique. C'est ce qui fait qu'une réponse adressée à un sous-ensemble différent produit une
**nouvelle** conversation. La conséquence métier — elle est rangée automatiquement dans le même
sujet — fait foi dans `04`.

L'**objet normalisé** retire les préfixes de réponse et de transfert répétés et multilingues,
écrase les espaces et passe en minuscules, afin qu'une réponse rejoigne la conversation de
départ.

⚠️ **Les clés ne fusionnent jamais.** Ce qui réunit deux conversations est le **sujet**, jamais
la clé.

### Le statut `ignoré`

`ignoré` signifie que Relvo **cesse d'analyser, de résumer et de trier** les messages de cette
conversation. Les messages continuent d'être **reçus et stockés** — on ne perd rien —, ils
sortent seulement du champ de travail de l'assistant. Réversible par le seul utilisateur.

## SubjectConversation

Table de liaison entre un sujet et une conversation. **Chaque ligne est une écoute.**

Elle porte les deux **bornes**, toutes deux **nullables** et pointant vers des **messages** :

| Borne | Nulle veut dire |
|---|---|
| `anchor_message_id` — le début | pas de borne basse → **tout le fil** (cas de l'e-mail) |
| `closing_message_id` — la fin | **l'écoute est en cours** |

Contrainte d'unicité sur le couple (sujet, conversation).

> ⚠️ **Aucune contrainte d'unicité sur `subject_id` seul.** La poser interdirait d'un coup le
> rattachement d'un second fil, le changement d'objet et le changement d'adresse d'un
> interlocuteur. La règle « au plus un sujet ouvert par conversation » est une **règle métier**,
> pas une contrainte de schéma — cf. `04 §13`.

> ⚠️ **Les bornes désignent des messages, jamais des dates.** Une borne calculée sur un
> horodatage devient fausse dès que deux messages arrivent dans la même seconde.

## Subject

Entité centrale du produit.

Porte une **référence** lisible générée automatiquement, un **titre**, un **résumé** et une
**description**, un **domaine** nullable, un **set de contacts**, un **statut** de cycle de vie à
trois valeurs, une **priorité** à deux valeurs, un marqueur d'attente de réponse, le canal
d'origine, et l'acteur qui l'a créé.

Il porte enfin une série d'horodatages, chacun répondant à une question distincte :

| Champ | Question à laquelle il répond |
|---|---|
| `opened_at` | quand l'affaire a-t-elle commencé ? |
| `last_activity_at` | quand s'est-il passé quelque chose ? — pilote le tri |
| `last_opened_at` | l'utilisateur a-t-il déjà regardé ? — **nul ⇒ marqueur « Nouveau »** |
| `resolution_suggested_at` | Relvo a-t-il suggéré que c'était fini ? |
| `resolved_at` | quand a-t-il été validé ? |
| `closed_at` | quand a-t-il été clos ? |

⚠️ **`closed_at` est une simple date de clôture. Il ne borne rien.** L'appartenance est portée
**exclusivement** par les bornes d'écoute. Les confondre ampute silencieusement le périmètre d'un
sujet quand on le valide — cf. `04 §5`.

⚠️ **Les marqueurs ne sont pas stockés.** « Nouveau », « À faire », « En retard » sont **dérivés**
au calcul. Seuls `priority` et `waiting_for_reply` sont des champs.

## Message

Événement brut, reçu ou envoyé. **Immuable une fois reçu.**

- **`conversation_id` — non nullable.** Tout message appartient à une conversation, déterminée à
  la réception. C'est ce qui fait qu'il **n'existe pas de message orphelin**.
- **`subject_id` — nullable.** C'est l'**appartenance sémantique**, décidée **message par
  message**. Nul signifie « hors de toute plage d'écoute », et non « Relvo n'a pas su traiter ».
  C'est la granularité fine du modèle : elle permettra de séparer des affaires **entrelacées**
  dans un même fil. L'interface ne l'expose pas — cf. `04 §13`.
- **`folder_id` — nullable.** Le domaine assigné au message à la réception ; c'est lui qui donne
  ensuite son domaine au sujet ouvert depuis ce message.

Le message porte aussi : l'expéditeur (contact **nullable**, plus l'adresse brute et le nom
affiché conservés quand aucun contact n'existe encore), le destinataire, le **sens**, les
identifiants externes de message et de fil, un indicateur de groupe, la ligne d'objet, le
contenu **en texte et en HTML**, les horodatages de réception et d'envoi, un statut, et
`read_at`.

⚠️ **`read_at` se pose à l'ouverture de la CONVERSATION**, pas du sujet. C'est là que les
messages arrivent.

⚠️ **`triage_hint` n'est plus alimenté.** Il expliquait pourquoi Relvo n'avait pas su rattacher
un message. Le rangement étant devenu déterministe et infaillible, il n'y a plus d'échec à
justifier. Le champ et ses valeurs sont **conservés pour l'historique** — supprimer une colonne
qui porte des données passées ne se récupère pas.

## Attachment

Pièce jointe rattachée à un message, et au sujet quand il y en a un. Porte un nom, un type MIME,
une taille, et la **clé d'objet** dans le stockage.

⚠️ **`storage_key` est une clé d'objet, pas une URL.** Le bucket est privé ; l'URL de lecture est
signée à la demande et expire. Stocker une URL reviendrait à stocker quelque chose qui devient
faux.

**Trois niveaux d'analyse, chacun avec son horodatage** — et l'horodatage **est** le drapeau de
cache : s'il est renseigné, l'analyse a déjà été faite, et le modèle n'est jamais sollicité deux
fois pour le même document au même niveau.

| Niveau | Quand | Ce que c'est |
|---|---|---|
| Étiquette | à la réception, automatique | une catégorie courte, utile quand le nom du fichier n'est pas explicite |
| Résumé | au premier accès de l'utilisateur | quelques lignes |
| Analyse | à la demande explicite | extraction détaillée |

## Task

Unité de travail **du sujet**, pas de l'utilisateur.

- **`subject_id` — nullable.** Une tâche peut exister sans sujet : créée à la volée, ou détachée.
  La clé étrangère reste en cascade — supprimer un sujet supprime ses tâches rattachées.
- **`source_actor`** — qui a créé ou proposé la tâche. C'est un **attribut historique permanent**.
- **`kind`** — conservé pour deux usages **techniques** : l'auto-complétion d'une tâche de
  réponse à l'envoi d'un message, et le filtrage. Il n'est **pas affiché** : les libellés sont
  trop spécifiques pour apporter une lecture rapide, et le titre suffit.
- **`completion_mode`** — comment la tâche a été terminée : manuellement, par correspondance avec
  un message, ou avec une action.
- **`completed_by_actor`** — qui l'a cochée.

⚠️ **La valeur `deleted` du statut subsiste dans l'énuméré mais n'est plus posée** : la
suppression est un vrai effacement. Les références depuis le journal et les actions sont en
`SET NULL` — la ligne disparaît sans casser l'historique.

### Sémantique des quatre champs de date

Elle est **simple et asymétrique**, et c'est cette asymétrie qu'il faut retenir :

- **Les champs de début portent la deadline.** C'est le moment où la tâche **doit** être
  effectuée. Si l'utilisateur ne renseigne qu'un champ, c'est celui-là.
- **Les champs de fin n'ajoutent jamais de deadline.** Ils expriment une **durée** : un
  déplacement de plusieurs jours, un créneau horaire.

| Configuration | Sens |
|---|---|
| tous nuls | tâche sans deadline |
| date de début seule | deadline au jour près |
| début + heure | deadline horodatée |
| début + date de fin | deadline au jour près, étalée sur plusieurs jours |
| début + heures de début et de fin, même jour | créneau dans la journée |
| les quatre | plage multi-jours avec horaires |

⚠️ **« Date de fin seule » n'est pas une configuration valide.** La deadline vit dans le début.

⚠️ **La taxonomie des tâches — rendez-vous, tâche datée, flottante — est DÉRIVÉE de ces champs.**
Aucune colonne ne la porte, et c'est délibéré : elle a été introduite sans aucune migration.

## Action

Exécution concrète déclenchée depuis l'interface — en V1, essentiellement l'envoi d'un message.

Rattachée au sujet, optionnellement à une tâche et à un message. Porte un type, un titre, un
**payload** opaque, un statut, et qui l'a exécutée, quand.

**Le brouillon de Relvo vit dans le payload** — destinataire, canal, contenu. Il est présenté
dans la zone de rédaction, clairement identifié comme une suggestion modifiable. **Ce n'est pas
un message tant qu'il n'a pas été envoyé.**

## EventLog

Journal de bord. **Immuable**, écrit dans la **transaction** de chaque mutation — via un helper
explicite, et non une extension générique : c'est ce qui rend le journal lisible plutôt
qu'exhaustif.

Porte les références de l'entité concernée, un type d'entité, un type d'événement, un titre, une
description, l'**acteur**, le contact concret quand l'acteur est externe, et des métadonnées
libres.

Les métadonnées portent notamment la **provenance** d'une opération, ce qui permet de distinguer
une tâche créée depuis l'échange avec Relvo d'une tâche créée par suggestion automatique ou par
un clic.

## KnowledgeDocument

Document de référence chargé par l'utilisateur pour enrichir le contexte de Relvo.

**Toujours rattaché à un domaine** — à défaut, au domaine « Général ». C'est ce domaine qui
détermine sa portée : les documents de « Général » sont chargés pour **tous** les sujets, ceux
d'un domaine métier seulement pour les sujets de ce domaine.

Deux natures, portées par un énuméré :

| | Document | Instruction |
|---|---|---|
| Source | fichier déposé | texte rédigé dans l'app |
| Modifiable | non (suppression seule) | oui |
| Stockage | **stockage objet** (source de vérité) + copie d'inférence | contenu en ligne |
| Nature | une **référence** à laquelle on se fie | une **mémoire** qu'on façonne |

⚠️ **La copie d'inférence n'est pas un stockage.** Un fichier déposé chez le fournisseur
d'inférence est en **écriture seule** et n'est jamais relisible. L'affichage à l'utilisateur
passe **toujours** par la clé d'objet. Si l'identifiant d'inférence est perdu, on ré-uploade
depuis le stockage objet ; l'inverse est **impossible**.

L'**état d'absorption** — lu ou écarté — décide de l'inclusion dans les prompts. Il est décidé
par Relvo et modifiable par l'utilisateur. Il sert aussi, sur une instruction, d'interrupteur
d'activation.

**La portée « sujet » n'existe pas.** Un document spécifique à une affaire ponctuelle reste une
pièce jointe du message qui l'a apporté.

## VerificationToken

Jeton à usage unique pour la vérification d'adresse et la réinitialisation de mot de passe. Porte
l'identifiant visé, le jeton (unique), un type et une expiration.

**Émettre un jeton invalide le précédent du même type pour la même adresse.** Sans cette règle,
deux liens de réinitialisation coexistent et le plus ancien reste exploitable.

## PendingFileDeletion

**Outbox de suppression de fichiers.** Porte une clé d'objet en attente d'effacement dans le
stockage.

⚠️ **Elle est alimentée par un TRIGGER, jamais par du code applicatif.** Le domaine ignore le
stockage : le trigger pousse la clé **dans la transaction** qui supprime la ligne, et un
processus périodique draine la file **hors transaction**.

**C'est le seul mécanisme qui capte les cascades**, dont l'ORM est aveugle par conception : une
suppression en cascade exécutée par la base ne passe par aucun code applicatif.

⚠️ **Toute nouvelle table portant une clé d'objet reçoit son trigger dans la MÊME migration.**

---

## Les contraintes que l'ORM ne sait pas exprimer

Certaines règles n'ont aucune traduction dans le schéma déclaratif et **s'écrivent à la main dans
la migration** : contraintes de vérification, unicité partielle, exclusions, triggers.

**Pourquoi elles descendent en base plutôt que de rester dans le code.** Une règle qui ne vit que
dans une fonction applicative est contournée par le premier script d'import venu — et un import
est exactement le moment où l'on est le moins vigilant.

⚠️ **Une clé étrangère composite écrite à la main DÉRIVE ; un trigger, non.** L'ORM ignore les
contraintes de vérification et les triggers — il les laisse tranquilles. Mais il **modélise** les
clés étrangères et les index : une clé composite ajoutée à la main lui apparaît comme une
**dérive**, et la migration suivante proposera de la **supprimer**. Le garde-fou disparaît alors
dans un changement qui semble sans rapport. Pour une règle qui croise deux tables, l'outil est
donc un **trigger de contrainte**, jamais une clé composite.

### Comment cette liste reste vraie

Elle ne reste pas vraie par la vigilance : **elle est tenue par un test.**

Un test d'intégration confronte ce document au catalogue de la base, **dans les deux sens** :

- toute contrainte **citée** ici existe en base ;
- toute contrainte **posée** en base est citée ici.

Le second sens est le plus utile — c'est celui qu'aucune relecture n'attrape. Sans ce test,
oublier de mettre à jour ce document **ne coûte rien** et se découvre trois semaines plus tard,
quand quelqu'un code contre une contrainte fantôme. Avec lui, ça coûte trente secondes et ça se
découvre avant le commit.

⚠️ **Ne pas aller plus loin.** Un test qui traquerait les décomptes écrits en toutes lettres dans
un texte français produit des faux positifs à chaque phrase. Un décompte se **retire** du
document ; il ne se surveille pas.
