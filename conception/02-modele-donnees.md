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

Le **rôle** distingue l'administrateur du dirigeant. Un administrateur voit tous les comptes dans
le backoffice et agit dessus ; le rôle ne change que par une méthode du domaine, journalisée sur
le compte, jamais par la base.

Il porte la **date d'ouverture de l'accès** : l'inscription est libre, mais un compte qui en
naît **attend qu'un administrateur valide la demande** — tant que la date est nulle, il ne se
connecte pas et voit une page d'attente. L'ouverture est une méthode du domaine, journalisée ;
un compte provisionné par le produit lui-même (la démonstration) naît ouvert.

Il porte une **marque « test »**, posée par un administrateur pour distinguer les comptes
d'essai des vrais dans les listes et les coûts. Elle ne change rien au comportement du produit.
Journalisée.

**Un compte = un humain en V1.** Le partage d'un compte entre plusieurs personnes est reporté et
impliquera une entité `User` distincte.

Il porte aussi ses **secteurs** d'activité — food, bâtiment, autre — en **tableau** : un même
dirigeant peut être dans la restauration et dans le bâtiment, et le produit ne le force pas à
choisir. Ils sélectionnent les socles métier chargés dans la couche Produit du contexte (cf.
`05 §10`). Il porte enfin les **préférences
observées** : un texte court, régénéré par agrégation du journal, qui dit ce que l'utilisateur
garde et ce qu'il écarte. Ce texte n'est jamais saisi ni édité par personne — il est
**recalculé**. C'est le seul endroit où l'apprentissage se matérialise sur le compte.

Il porte un **interrupteur de l'assistant**, vrai par défaut : il gouverne tout ce que Relvo
fait de lui-même sur le compte — le tri à l'arrivée (cf. `05 §1`), la structuration, la
relecture et l'échange. Un compte qui démarre a son assistant, et l'ouverture de l'accès par un
administrateur le rallume : personne n'a d'interrupteur à trouver pour que Relvo travaille.
L'utilisateur le règle dans ses préférences ; un administrateur peut le couper à tout moment,
et l'état ne change jamais que par la méthode du domaine qui le journalise.

Il porte enfin le **dernier passage** de l'utilisateur sur les onglets « Suivies » et
« Ignorées » de Conversations. Ces deux horodatages servent aux **pastilles** du sélecteur :
elles comptent ce que Relvo a rangé dans l'onglet depuis, et tombent quand l'onglet est vu.
« Sans sujet » n'a pas d'horodatage : sa pastille est un stock, le résidu de Relvo, qui ne se
vide qu'en triant. Une visite n'est pas une décision, elle n'est pas journalisée.

Il porte de même le **dernier passage sur l'accueil**, qui borne « depuis votre dernière
visite » dans les dernières nouvelles (`05 §11.12`) : le résumé compte ce que le journal a
enregistré depuis, et l'horodatage avance quand l'accueil est vu.

## Folder

Un **dossier** : conteneur métier qui regroupe les sujets d'un périmètre, les documents de
connaissance qui servent à les traiter, et les messages classés dans ce dossier à la réception.

Porte un nom, un identifiant lisible, une description, et deux clés de présentation — couleur et
icône — **nullables**, avec repli sur un mapping dérivé de l'identifiant lisible.

**Les dossiers forment un arbre.** Chaque dossier porte son **père** ; seul « Général » n'en a
pas — c'est la racine, et une contrainte de base le garantit. L'identifiant lisible est unique
**par père**, pas par compte : deux dossiers de même nom peuvent vivre sous deux pères. La
profondeur est bornée par un test du domaine, jamais par la base. La **chaîne** d'un dossier —
de la racine à lui — est ce que lit la couche Domaine du contexte (`05 §10.1`) ; son
**premier niveau** sous Général est ce que lisent le Calendrier et ses pastilles. La **portée**
d'un dossier est lui et ses fils, jamais un frère : un contact, un canal ou une question qui
cite un dossier citent aussi tout ce qu'il contient. Le père d'un dossier ne se supprime pas
en cascade : le comportement de la suppression fait foi dans `04 §10`.

`is_default` marque le dossier **« Général »**, auto-créé à la création du compte.

**Invariant structurel :** aucun `Subject.folder_id` ne pointe vers le dossier « Général ».
Quand Relvo ne sait pas classer un sujet, `folder_id` reste **nul** — le sujet apparaît « sans
dossier » plutôt que d'atterrir dans Général. Cela préserve le rôle de mémoire transversale de
celui-ci au lieu d'en faire un dépotoir. Le comportement associé fait foi dans `04`.

## Contact

Une personne, **indépendamment du canal** par lequel elle communique. Le contact n'est jamais
dupliqué par canal.

Porte un prénom **nullable** (nul pour une raison sociale) et un nom — ce dernier servant de clé
de tri et de sectionnement de l'annuaire —, une entreprise, un dossier d'affinité **nullable**
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
numéro. Il porte un nom, un type, l'identifiant public correspondant, et les dossiers qu'il
oriente.

⚠️ **Le canal n'est pas le contact.** Un canal est « ma boîte fournisseurs » ; un contact est une
personne extérieure qui peut écrire sur n'importe lequel de ces canaux.

**`ChannelConfig`** porte la configuration technique — le **fournisseur** derrière le canal,
données de connexion opaques, statut de connexion, date de dernière synchronisation, et
l'identifiant du compte chez le fournisseur. Elle est séparée pour ne pas alourdir `Channel` de
secrets et d'état de connexion.

**Le fournisseur** est l'un de deux : l'**agrégateur** (`unipile`) — WhatsApp, et les boîtes
e-mail reliées avant le relais — ou le **relais Gmail** de Relvo (`gmail`), qui lit et envoie par
l'API Google ; **toute nouvelle boîte e-mail est une boîte Gmail**, reliée par le relais. Le
domaine ne connaît que ce nom ; l'application tient un seul contrat de courrier entrant et un
seul contrat d'envoi, avec une implémentation par fournisseur. L'identifiant du compte chez le
fournisseur est **unique**, tous comptes confondus : c'est lui qui résout le compte d'un
webhook — l'identifiant opaque de l'agrégateur, l'adresse de la boîte pour Gmail. Pour une boîte
Gmail, les données de connexion portent les **jetons OAuth chiffrés** (AES-256-GCM, la clé hors
de la base), l'échéance du jeton d'accès et les périmètres accordés — jamais un jeton en clair,
jamais dans le journal —, puis ce que la réception par notification retient : le **dernier numéro
d'historique** relu et l'**échéance de l'abonnement** aux changements. Ces deux-là sont de
l'infrastructure, écrits au passage sans journal ; une reconnexion les garde. Une boîte se **connecte** en deux temps : le canal est préparé « en
attente » avant la page du fournisseur, puis **finalisé** quand le fournisseur a dit oui — le
retour du consentement pour le relais, le webhook pour l'agrégateur — avec son adresse pour nom
et pour identifiant ; une boîte déjà reliée, à ce compte ou à un autre, est un conflit, et
reconnecter un canal exige la même boîte.

**Dix boîtes e-mail par compte, un seul WhatsApp.** Le domaine refuse la onzième boîte et le
second WhatsApp. Motif : l'exigence des testeurs pour l'e-mail — toutes leurs boîtes, sans qu'une
seule coûte un abonnement chez l'agrégateur —, la simplicité pour la messagerie.

**`ChannelCatchup`** porte le **rattrapage du courrier récent** d'un canal (cf. `05-ia.md`
§9.6) : la fenêtre lue, l'état — demandé, en cours, terminé, arrêté au garde-fou, en échec —,
l'avancement de l'import et du tri, ce que Relvo en a fait (messages lus, sujets ouverts,
conversations mises en sourdine), le coût en euros, la raison de l'arrêt, et ce que la lecture par
tranches exige : le **verrou** de la tranche en cours (une seule à la fois, pris par une mise à
jour conditionnelle, expiré quand une tranche meurt), la fin de la dernière tranche, le compte
des passes d'import vides, le total des candidats quand l'import se ferme (l'avancement en
fraction), le niveau de service du tri — standard en direct, en lot la nuit — et le nombre de
reprises nocturnes. Une ligne par rattrapage demandé ; la demande naît à la connexion d'un canal,
l'exécution commence aussitôt, par tranches, et reprend tant que la ligne n'est pas close. C'est
ce que le premier échange avec Relvo raconte pendant qu'il lit, et ce que l'écran des canaux
montre ensuite.

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
**nouvelle** conversation. La conséquence métier — elle est rangée automatiquement dans la même
sujet — fait foi dans `04`.

L'**objet normalisé** retire les préfixes de réponse et de transfert répétés et multilingues,
écrase les espaces et passe en minuscules, afin qu'une réponse rejoigne la conversation de
départ.

⚠️ **Les clés ne fusionnent jamais.** Ce qui réunit deux conversations est l'**sujet**, jamais
la clé.

### Le statut `ignoré`

`ignoré` signifie que Relvo **cesse d'analyser, de résumer et de trier** les messages de cette
conversation. Les messages continuent d'être **reçus et stockés** — on ne perd rien —, ils
sortent seulement du champ de travail de l'assistant. Réversible par le seul utilisateur.

L'ignorance porte une **raison** — publicité, prospection, notification automatique, personnel, pas
mon rôle, déjà traité ailleurs, autre —, une note libre optionnelle, et l'**acteur** qui l'a posée :
l'utilisateur, en un appui, ou Relvo, sur un avis « rien à faire » sûr (cf. `05 §9.5`), auquel cas
la nature de l'avis donne la raison et sa phrase la note. La raison est ce qui rend le geste
exploitable par Relvo (cf. `05 §9`) : sans elle, une conversation ignorée dit qu'on n'en veut pas,
jamais pourquoi. L'acteur est ce qui permet à la liste de dire « ignorée par Relvo ». Réactiver
efface la raison et l'acteur ; le verdict de tri, lui, reste.

### L'avis de tri

Sur une conversation orpheline, Relvo dépose son **avis de tri** en deux parts — l'**action** :
à traiter, à considérer, rien à faire ; la **nature**, toujours posée : professionnel, publicité,
automatique, personnel —, une **confiance** à trois niveaux — haute, moyenne, basse —, une
**raison** en une phrase, et l'horodatage (cf. `05 §1.1`). Ces champs portent le **dernier** avis
et sont visibles dans la liste à trier comme en tête du fil, dans les mots de l'utilisateur :
il confirme ou contredit d'un geste, et l'accord comme le désaccord sont journalisés.

⚠️ **L'avis ne conditionne rien.** La conversation est rangée et lisible quel qu'il soit ; il
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

## Sujet (`Subject`)

Entité centrale du produit.

Porte une **référence** lisible générée automatiquement, un **titre**, un **résumé** et une
**description**, un **dossier** nullable, un **set de contacts**, un **statut** de cycle de vie à
trois valeurs, une **priorité** à deux valeurs, un marqueur d'attente de réponse, le canal
d'origine, et l'acteur qui l'a créée.

Elle porte aussi une **situation structurée** en quatre champs courts — où on en est, la prochaine
étape, de qui on attend quoi, l'échéance qui compte — maintenue par Relvo à chaque relecture, avec
l'horodatage de sa dernière mise à jour. La situation structurée est ce que Relvo **relit**, et
ce qui rend les sujets comparables entre elles.

**Le résumé et la description sont deux colonnes pour un seul champ à l'écran.** La description
est ce que l'utilisateur écrit ; le résumé, ce que Relvo rédige — une phrase, deux au plus, qui
dit de quoi il s'agit et jamais ce qu'il y a à faire. La fiche montre la description si elle
existe, sinon le résumé de Relvo signalé comme tel ; l'utilisateur qui corrige écrit dans la
description, et sa version l'emporte sur toutes les relectures suivantes.

Les **étiquettes** sont un tableau de clés du registre du compte (cf. `Label`), attribuées par
Relvo seul. Le **dossier proposé** est un nom libre, renseigné quand aucun dossier existant ne
convient : c'est de l'accumulation de ces propositions que naît un dossier nouveau (cf. `04 §10`).

Elle porte enfin une série d'horodatages, chacun répondant à une question distincte :

| Champ                     | Question à laquelle il répond                                        |
| ------------------------- | -------------------------------------------------------------------- |
| `opened_at`               | quand le sujet a-t-elle commencé ?                                  |
| `last_activity_at`        | quand s'est-il passé quelque chose ? — pilote le tri                 |
| `last_opened_at`          | l'utilisateur a-t-il déjà regardé ? — **nul ⇒ marqueur « Nouveau »** |
| `resolution_suggested_at` | Relvo a-t-il suggéré que c'était fini ?                              |
| `resolved_at`             | quand a-t-elle été validée ?                                         |
| `closed_at`               | quand a-t-elle été close ?                                           |

⚠️ **`closed_at` est une simple date de clôture. Il ne borne rien.** L'appartenance est portée
**exclusivement** par les bornes d'écoute. Les confondre ampute silencieusement le périmètre d'une
sujet quand on la valide — cf. `04 §5`.

⚠️ **Les marqueurs ne sont pas stockés.** « Nouveau », « À faire », « En retard » sont **dérivés**
au calcul. Seuls `priority` et `waiting_for_reply` sont des champs.

## Message

Événement brut, reçu ou envoyé. **Immuable une fois reçu.**

- **`conversation_id` — non nullable.** Tout message appartient à une conversation, déterminée à
  la réception. C'est ce qui fait qu'il **n'existe pas de message orphelin**.
- **`subject_id` — nullable.** C'est l'**appartenance sémantique**, décidée **message par
  message**. Nul signifie « hors de toute plage d'écoute », et non « Relvo n'a pas su traiter ».
  C'est la granularité fine du modèle : elle permettra de séparer des sujets **entrelacées**
  dans un même fil. L'interface ne l'expose pas — cf. `04 §13`.
- **`folder_id` — nullable.** Le dossier assigné au message à la réception ; c'est lui qui donne
  ensuite son dossier à le sujet ouvert depuis ce message.

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

Pièce jointe rattachée à un message, et à le sujet quand il y en a une. Porte un nom, un type MIME,
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
  C'est aussi ce qui autorise Relvo à **retirer** une tâche devenue sans objet (statut `deleted`,
  journalisé — cf. `05-ia.md` §4.2) : seulement une tâche qu'il avait lui-même proposée.
- **`kind`** — conservé pour deux usages **techniques** : l'auto-complétion d'une tâche de
  réponse à l'envoi d'un message, et le filtrage. Il n'est **pas affiché** : les libellés sont
  trop spécifiques pour apporter une lecture rapide, et le titre suffit.
- **`completion_mode`** — comment la tâche a été terminée : manuellement, par correspondance avec
  un message, ou avec une action.
- **`completed_by_actor`** — qui l'a cochée.
- **`metadata`** — porte la **provenance d'une déduction** — la référence du sujet précédent ou
  du document de connaissance sur lequel Relvo s'est appuyé —, la **raison** en une phrase, et,
  sur une tâche qui se répond, les **décisions** que le message demande (question, précision,
  options, réponse du dirigeant et son horodatage — cf. `05-ia.md` §3.1).
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

⚠️ **Ces quatre champs portent une heure de CALENDRIER, pas un instant.** Ils disent ce que le
dirigeant écrirait sur son agenda — « le 21 à 20:00 » — et sont stockés **nus**, sans fuseau.
Cette heure nue est, par convention, **l'heure française** : c'est celle que le dirigeant lit,
celle qu'il dicte, et celle que Relvo reçoit et rend. Un instant, lui — un message reçu, une
tâche terminée — est un point sur la ligne du temps, stocké en UTC, et ne se lit qu'à travers
le fuseau du produit.

⚠️ **« Date de fin seule » n'est pas une configuration valide.** La deadline vit dans le début.

⚠️ **La taxonomie des tâches — rendez-vous, tâche datée, flottante — est DÉRIVÉE de ces champs.**
Aucune colonne ne la porte, et c'est délibéré : elle a été introduite sans aucune migration.

## Action

Exécution concrète déclenchée depuis l'interface — en V1, essentiellement l'envoi d'un message.

Rattachée à le sujet, optionnellement à une tâche et à un message. Porte un type, un titre, un
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
  supprimée ou modifiée, un dossier reclassé, un verdict de tri confirmé ou contredit, un
  brouillon envoyé après retouche : l'entrée porte ce que Relvo avait proposé **et** ce que
  l'utilisateur en a fait. La suppression d'une tâche étant un vrai effacement, c'est **ici, et
  nulle part ailleurs**, que l'original survit.
- **Chaque sollicitation du modèle est une entrée** : la sollicitation, le tier, le niveau de
  raisonnement, les jetons d'entrée, de sortie, de cache et de raisonnement, et le coût converti
  en euros par une table de tarifs versionnée (cf. `05 §10`). C'est ce compteur qui alimente le
  disjoncteur, pas la facture. **Un appel qui échoue** avant ou pendant sa réponse est une entrée
  à part — sollicitation, motif, détail — ; sa mesure, quand il a coûté, reste une sollicitation.

Le backoffice lit ces entrées **par compte**, avec les mêmes fonctions que les rapports : il n'a
aucun compteur à lui.

## KnowledgeDocument

Document de référence chargé par l'utilisateur pour enrichir le contexte de Relvo.

**Toujours rattaché à un dossier** — à défaut, au dossier « Général ». C'est ce dossier qui
détermine sa portée : les documents de « Général » sont chargés pour **toutes** les sujets, ceux
d'un dossier métier pour les sujets de ce dossier et de ses fils.

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

L'**état d'absorption** — à lire, lu ou écarté — décide de l'inclusion dans les prompts : seul
« lu » y entre. Une connaissance déposée par le dirigeant naît **à lire** ; lu ou écarté est
décidé par Relvo et modifiable par l'utilisateur. Il sert aussi, sur une instruction, d'interrupteur
d'activation.

**La portée « sujet » n'existe pas.** Un document spécifique à un sujet ponctuelle reste une
pièce jointe du message qui l'a apporté.

Une instruction peut naître d'une **correction** : quand l'utilisateur reclasse un sujet ou
écarte une tâche et dit pourquoi, son explication devient une instruction du dossier. Elle garde
alors la référence de l'**sujet qui l'a provoquée** — nullable, la plupart des instructions étant
écrites directement.

## Label

Une **étiquette** : un marqueur thématique attribué à le sujet par Relvo, qui **traverse les
dossiers**. Le dossier est le périmètre de mémoire que l'utilisateur contrôle ; l'étiquette est
une facette que Relvo tient pour lui-même — pour retrouver un précédent hors du dossier, filtrer,
et poser des analogies que ni le contact ni la date ne suggèrent.

Le registre est **par compte**. Une étiquette porte une clé normalisée — unique par compte —, un
libellé, une **origine** — amorcée par un socle de secteur, ou proposée par Relvo — et un
**statut** : candidate tant qu'un seul sujet la porte, active dès qu'une seconde la reprend.

⚠️ **L'utilisateur n'écrit jamais une étiquette.** Il peut filtrer dessus, jamais en saisir : un
vocabulaire à deux mains diverge en quelques semaines, et une étiquette portée par un seul sujet
ne relie rien. Le comportement — attribution, promotion, choix dans le registre — fait foi dans
`04 §10` et `05 §9`.

## RelvoQuestion

Une **question de Relvo** : ce qu'il aurait besoin de savoir pour mieux faire, formulé à la
structuration d'un sujet — « Narbonne est-il une franchise ? » —, ou posé par une étape de la
prise en main et du rattrapage (`05 §11.11`). C'est l'objet par lequel **Relvo parle en
premier** (`05 §11.12`).

Elle porte une **portée** — un contact, un dossier, un sujet ou le compte —, un texte, les
**réponses proposées** quand elle se pose en formulaire, un statut — ouverte, répondue,
écartée —, la réponse, ce qui l'a fait naître — un sujet, ou l'étape d'un script —, et les
horodatages de question et de réponse.

⚠️ **Une question n'est jamais une tâche.** Elle vit sur la fiche où on y répond et dans
l'échange, où Relvo la pose en formulaire ; jamais dans l'agenda, où elle serait exactement la
tâche artificielle que le produit refuse. Tant qu'une question est ouverte, elle porte le badge
du bouton Relvo et la ligne de l'accueil. La réponse devient un champ de la fiche, un objet du
compte ou une instruction ; la question elle-même n'est jamais injectée dans les prompts.

## PushSubscription

Un **abonnement push** : un appareil qui a accepté de recevoir les notifications de Relvo — le
brief du matin et une question qui s'ouvre, rien d'autre (`05 §11.12`, invariant 36). Il porte le
compte, l'adresse donnée par le service de push du navigateur (unique : elle désigne un appareil,
jamais un compte), les deux clés de chiffrement, l'agent utilisateur, et la date du dernier envoi.

**L'abonnement est le réglage.** L'enregistrer, c'est activer les notifications sur cet appareil ;
le retirer, c'est les couper. Il n'y a pas d'interrupteur par nature de notification. Il tombe
avec le compte, quand l'utilisateur coupe, ou quand le service de push répond que l'appareil
n'existe plus. Un appareil qui change d'utilisateur change de propriétaire : l'ancienne ligne
tombe. Les envois sont journalisés avec leur nature ; c'est le journal qui tient « un brief par
jour », pas une colonne.

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
| `relvo_questions_scope_target_check` | `relvo_questions` | vérification : une question a exactement une cible, celle de sa portée |
| `folders_parent_requis` | `folders` | vérification : seul le dossier « Général » n'a pas de père — tout autre dossier est rangé dans l'arbre |
| `channel_configs_provider_check` | `channel_configs` | vérification : le fournisseur derrière un canal est l'agrégateur ou le relais Gmail — rien d'autre ne sait lire une boîte |

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
