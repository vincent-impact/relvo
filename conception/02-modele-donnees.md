# 2. Modèle de données

> **Fait foi sur le PERSISTÉ** : entités, champs, relations, contraintes. Quand le schéma et ce
> document divergent, **c'est le document qui a raison et le schéma qui rattrape**.
>
> Ce document décrit **ce qui est stocké et pourquoi**. Il ne décrit **pas** ce que le produit
> _fait_ de ces données : les cycles de vie, les règles de rattachement et les transitions font
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

| Valeur    | UI          | Est-ce une entité ?                                    |
| --------- | ----------- | ------------------------------------------------------ |
| `user`    | **Moi**     | non — l'humain est implicite via `account_id`          |
| `ai`      | **Relvo**   | non — c'est un mécanisme du compte                     |
| `contact` | **Externe** | **oui** — l'entité `Contact`                           |
| `system`  | —           | non — événements techniques, généralement non affichés |

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

Il porte aussi ses **secteurs** d'activité — food, bâtiment, autre — en **tableau** : un même
dirigeant peut être dans la restauration et dans le bâtiment, et le produit ne le force pas à
choisir. Ils sélectionnent les socles métier chargés dans la couche Produit du contexte (cf.
`05 §10`). Il porte enfin les **préférences
observées** : un texte court, régénéré par agrégation du journal, qui dit ce que l'utilisateur
garde et ce qu'il écarte. Ce texte n'est jamais saisi ni édité par personne — il est
**recalculé**. C'est le seul endroit où l'apprentissage se matérialise sur le compte.

Il porte un **interrupteur de l'assistant**, faux par défaut : il gouverne tout ce que Relvo
fait de lui-même sur le compte — le tri à l'arrivée (cf. `05 §1`), et demain la structuration,
la relecture et l'échange. Un compte nouveau ne sollicite rien tant que personne ne l'a ouvert.
L'utilisateur le règle dans ses préférences ; un administrateur peut le couper à tout moment,
et l'état ne change jamais que par la méthode du domaine qui le journalise.

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

| Statut     | Ce que ça veut dire                                                                | `source_actor` |
| ---------- | ---------------------------------------------------------------------------------- | -------------- |
| `auto`     | fiche déduite d'un message (signature, nom d'expéditeur) — partielle, non vérifiée | `ai`           |
| `complete` | l'utilisateur a vérifié et complété                                                | `user`         |

**Ce que Relvo écrit sur la fiche.** Un **rôle** — fournisseur, client, salarié, administration,
partenaire, autre — et une **note de Relvo** d'une ligne : le ton employé, les habitudes de
l'interlocuteur. Les deux sont rédigés par Relvo et corrigeables par l'utilisateur ; la
correction l'emporte toujours. Le délai de réponse constaté et les antécédents de tri d'un
expéditeur ne sont **pas stockés** : ils se dérivent des messages et des conversations.

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

|                | **E-mail**                            | **Messagerie**                         |
| -------------- | ------------------------------------- | -------------------------------------- |
| A un objet     | **oui**                               | non                                    |
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

| Sous-type / forme   | Discriminant                                    | Clé                             |
| ------------------- | ----------------------------------------------- | ------------------------------- |
| e-mail / direct     | objet normalisé + **le** destinataire           | `email:<objet>:<destinataire>`  |
| e-mail / groupe     | objet normalisé + **set trié** de destinataires | `email:<objet>:<set trié>`      |
| messagerie / direct | l'interlocuteur                                 | `wa-direct:<numéro>`            |
| messagerie / groupe | le fil de groupe                                | `wa-group:<identifiant de fil>` |

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

L'ignorance porte une **raison** — publicité, prospection, notification automatique, personnel, pas
mon rôle, déjà traité ailleurs, autre —, une note libre optionnelle, et l'**acteur** qui l'a posée :
l'utilisateur, en un appui, ou Relvo, sur un verdict « bruit » sûr (cf. `05 §9.5`), auquel cas la
catégorie du verdict est la raison et sa phrase la note. La raison est ce qui rend le geste
exploitable par Relvo (cf. `05 §9`) : sans elle, une conversation ignorée dit qu'on n'en veut pas,
jamais pourquoi. L'acteur est ce qui permet à la liste de dire « ignorée par Relvo ». Réactiver
efface la raison et l'acteur ; le verdict de tri, lui, reste.

### Le verdict de tri

Sur une conversation orpheline, Relvo dépose son **verdict de tri** — bruit, affaire, incertain —,
la **catégorie** du bruit le cas échéant — dans le vocabulaire des raisons d'ignorance ci-dessus,
pour qu'une confirmation d'un geste devienne la raison —, une **confiance** à trois niveaux —
haute, moyenne, basse —, une **raison** en une phrase, et l'horodatage. Ces champs portent le **dernier** verdict et sont visibles dans la liste à trier :
l'utilisateur confirme ou contredit d'un geste, et l'accord comme le désaccord sont journalisés.

⚠️ **Le verdict ne conditionne rien.** La conversation est rangée et lisible quel qu'il soit ; il
dit seulement ce que Relvo en pense, et pourquoi.

## SubjectConversation

Table de liaison entre un sujet et une conversation. **Chaque ligne est une écoute.**

Elle porte les deux **bornes**, toutes deux **nullables** et pointant vers des **messages** :

| Borne                          | Nulle veut dire                                        |
| ------------------------------ | ------------------------------------------------------ |
| `anchor_message_id` — le début | pas de borne basse → **tout le fil** (cas de l'e-mail) |
| `closing_message_id` — la fin  | **l'écoute est en cours**                              |

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

Il porte aussi une **situation structurée** en quatre champs courts — où on en est, la prochaine
étape, de qui on attend quoi, l'échéance qui compte — maintenue par Relvo à chaque relecture, avec
l'horodatage de sa dernière mise à jour. Le résumé libre reste pour l'humain ; la situation
structurée est ce que Relvo **relit**, et ce qui rend les sujets comparables entre eux.

Les **étiquettes** sont un tableau de clés du registre du compte (cf. `Label`), attribuées par
Relvo seul. Le **domaine proposé** est un nom libre, renseigné quand aucun domaine existant ne
convient : c'est de l'accumulation de ces propositions que naît un domaine nouveau (cf. `04 §10`).

Il porte enfin une série d'horodatages, chacun répondant à une question distincte :

| Champ                     | Question à laquelle il répond                                        |
| ------------------------- | -------------------------------------------------------------------- |
| `opened_at`               | quand l'affaire a-t-elle commencé ?                                  |
| `last_activity_at`        | quand s'est-il passé quelque chose ? — pilote le tri                 |
| `last_opened_at`          | l'utilisateur a-t-il déjà regardé ? — **nul ⇒ marqueur « Nouveau »** |
| `resolution_suggested_at` | Relvo a-t-il suggéré que c'était fini ?                              |
| `resolved_at`             | quand a-t-il été validé ?                                            |
| `closed_at`               | quand a-t-il été clos ?                                              |

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
contenu **en texte et en HTML**, l'**origine du contenu** — saisi, ou transcrit d'un message
vocal —, les horodatages de réception et d'envoi, un statut, et `read_at`.

**Un message vocal est un message.** Sa transcription est son contenu ; l'audio reste une pièce
jointe. Le rangement n'attend pas la transcription, et un message dont la transcription a échoué
est un message au contenu vide et à l'audio lisible.

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

| Niveau    | Quand                             | Ce que c'est                                                            |
| --------- | --------------------------------- | ----------------------------------------------------------------------- |
| Étiquette | à la réception, automatique       | une catégorie courte, utile quand le nom du fichier n'est pas explicite |
| Résumé    | au premier accès de l'utilisateur | quelques lignes                                                         |
| Analyse   | à la demande explicite            | extraction détaillée                                                    |

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
- **`metadata`** — porte la **provenance d'une déduction** — la référence du sujet précédent ou
  du document de connaissance sur lequel Relvo s'est appuyé — et la **raison** en une phrase.
  C'est ce qui rend la tâche auditable : « d'après _Ouverture magasin Béziers_ », « le
  fournisseur demande un retour avant jeudi ».

⚠️ **La valeur `deleted` du statut subsiste dans l'énuméré mais n'est plus posée** : la
suppression est un vrai effacement. Les références depuis le journal et les actions sont en
`SET NULL` — la ligne disparaît sans casser l'historique.

### Sémantique des quatre champs de date

Elle est **simple et asymétrique**, et c'est cette asymétrie qu'il faut retenir :

- **Les champs de début portent la deadline.** C'est le moment où la tâche **doit** être
  effectuée. Si l'utilisateur ne renseigne qu'un champ, c'est celui-là.
- **Les champs de fin n'ajoutent jamais de deadline.** Ils expriment une **durée** : un
  déplacement de plusieurs jours, un créneau horaire.

| Configuration                                | Sens                                              |
| -------------------------------------------- | ------------------------------------------------- |
| tous nuls                                    | tâche sans deadline                               |
| date de début seule                          | deadline au jour près                             |
| début + heure                                | deadline horodatée                                |
| début + date de fin                          | deadline au jour près, étalée sur plusieurs jours |
| début + heures de début et de fin, même jour | créneau dans la journée                           |
| les quatre                                   | plage multi-jours avec horaires                   |

⚠️ **« Date de fin seule » n'est pas une configuration valide.** La deadline vit dans le début.

⚠️ **La taxonomie des tâches — rendez-vous, tâche datée, flottante — est DÉRIVÉE de ces champs.**
Aucune colonne ne la porte, et c'est délibéré : elle a été introduite sans aucune migration.

## Action

Exécution concrète déclenchée depuis l'interface — en V1, essentiellement l'envoi d'un message.

Rattachée au sujet, optionnellement à une tâche et à un message. Porte un type, un titre, un
**payload** opaque, un statut, et qui l'a exécutée, quand.

**Le brouillon de Relvo vit dans le payload** — destinataire, canal, contenu, et la raison et la
provenance, comme une tâche. Il est présenté dans la zone de rédaction, clairement identifié
comme une suggestion modifiable. **Ce n'est pas un message tant qu'il n'a pas été envoyé.**

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

Deux familles d'entrées portent la **boucle d'apprentissage** et la **maîtrise du coût** :

- **Tout geste sur un objet proposé par Relvo conserve la proposition d'origine.** Une tâche
  supprimée ou modifiée, un domaine reclassé, un verdict de tri confirmé ou contredit, un
  brouillon envoyé après retouche : l'entrée porte ce que Relvo avait proposé **et** ce que
  l'utilisateur en a fait. La suppression d'une tâche étant un vrai effacement, c'est **ici, et
  nulle part ailleurs**, que l'original survit.
- **Chaque sollicitation du modèle est une entrée** : la sollicitation, le tier, le niveau de
  raisonnement, les jetons d'entrée, de sortie, de cache et de raisonnement, et le coût converti
  en euros par une table de tarifs versionnée (cf. `05 §10`). C'est ce compteur qui alimente le
  disjoncteur, pas la facture.

## KnowledgeDocument

Document de référence chargé par l'utilisateur pour enrichir le contexte de Relvo.

**Toujours rattaché à un domaine** — à défaut, au domaine « Général ». C'est ce domaine qui
détermine sa portée : les documents de « Général » sont chargés pour **tous** les sujets, ceux
d'un domaine métier seulement pour les sujets de ce domaine.

Deux natures, portées par un énuméré :

|            | Document                                                  | Instruction                   |
| ---------- | --------------------------------------------------------- | ----------------------------- |
| Source     | fichier déposé                                            | texte rédigé dans l'app       |
| Modifiable | non (suppression seule)                                   | oui                           |
| Stockage   | **stockage objet** (source de vérité) + copie d'inférence | contenu en ligne              |
| Nature     | une **référence** à laquelle on se fie                    | une **mémoire** qu'on façonne |

⚠️ **La copie d'inférence n'est pas un stockage.** Un fichier déposé chez le fournisseur
d'inférence est en **écriture seule** et n'est jamais relisible. L'affichage à l'utilisateur
passe **toujours** par la clé d'objet. Si l'identifiant d'inférence est perdu, on ré-uploade
depuis le stockage objet ; l'inverse est **impossible**.

L'**état d'absorption** — lu ou écarté — décide de l'inclusion dans les prompts. Il est décidé
par Relvo et modifiable par l'utilisateur. Il sert aussi, sur une instruction, d'interrupteur
d'activation.

**La portée « sujet » n'existe pas.** Un document spécifique à une affaire ponctuelle reste une
pièce jointe du message qui l'a apporté.

Une instruction peut naître d'une **correction** : quand l'utilisateur reclasse un sujet ou
écarte une tâche et dit pourquoi, son explication devient une instruction du domaine. Elle garde
alors la référence du **sujet qui l'a provoquée** — nullable, la plupart des instructions étant
écrites directement.

## Label

Une **étiquette** : un marqueur thématique attribué au sujet par Relvo, qui **traverse les
domaines**. Le domaine est le périmètre de mémoire que l'utilisateur contrôle ; l'étiquette est
une facette que Relvo tient pour lui-même — pour retrouver un précédent hors du domaine, filtrer,
et poser des analogies que ni le contact ni la date ne suggèrent.

Le registre est **par compte**. Une étiquette porte une clé normalisée — unique par compte —, un
libellé, une **origine** — amorcée par un socle de secteur, ou proposée par Relvo — et un
**statut** : candidate tant qu'un seul sujet la porte, active dès qu'un second la reprend.

⚠️ **L'utilisateur n'écrit jamais une étiquette.** Il peut filtrer dessus, jamais en saisir : un
vocabulaire à deux mains diverge en quelques semaines, et une étiquette portée par un seul sujet
ne relie rien. Le comportement — attribution, promotion, choix dans le registre — fait foi dans
`04 §10` et `05 §9`.

## RelvoQuestion

Une **question de Relvo** : ce qu'il aurait besoin de savoir pour mieux faire, formulé à la
structuration d'un sujet — « Narbonne est-il une franchise ? ».

Elle porte une **portée** — un contact, un domaine ou un sujet —, un texte, un statut — ouverte,
répondue, écartée —, la réponse, le sujet qui l'a fait naître, et les horodatages de question et
de réponse.

⚠️ **Une question n'est jamais une tâche.** Elle vit sur la fiche où on y répond, pas dans
l'agenda : une question dans l'agenda serait exactement la tâche artificielle que le produit
refuse. La réponse devient un champ de la fiche ou une instruction du domaine ; la question
elle-même n'est jamais injectée dans les prompts.

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

**Ce qui est posé en base, hors ORM.** La première colonne est le nom exact de l'objet, celui
que le test lit.

| Objet | Table | Ce qu'il garantit |
| --- | --- | --- |
| `attachments_enqueue_file_deletion` | `attachments` | trigger : toute suppression, cascade comprise, enfile la clé d'objet dans l'outbox de suppression de fichiers |
| `knowledge_documents_enqueue_file_deletion` | `knowledge_documents` | trigger : même garantie pour les documents de connaissance |
| `subjects_search_vector` | `subjects` | trigger : le vecteur plein texte (titre pondéré A, situation structurée pondérée B, dictionnaire français) est tenu à chaque écriture — le code ne l'écrit jamais |
| `conversations_triage_noise_reason_check` | `conversations` | vérification : la catégorie d'un verdict n'est posée que si le verdict est « bruit », et jamais avec une raison que seul l'utilisateur connaît (pas mon rôle, déjà traité ailleurs) |
| `relvo_questions_scope_target_check` | `relvo_questions` | vérification : une question a exactement une cible, celle de sa portée |

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
