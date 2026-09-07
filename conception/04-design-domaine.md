# 4. Design du domaine

> **Fait foi sur le COMPORTEMENT** : agrégats, cycles de vie, règles métier, périmètre. Avec
> [`uml.mermaid`](uml.mermaid), qui en est la vue de structure — les deux se corrigent dans le
> même commit.
>
> Le *persisté* fait foi dans [`02-modele-donnees.md`](02-modele-donnees.md), les *invariants*
> dans [`01-principes.md`](01-principes.md). Un désaccord entre ces trois documents est un bug à
> corriger, pas un rang à départager — cf. [`00-sources.md`](00-sources.md).

---

## 1. L'entité centrale

**Le `Subject` est l'entité centrale du produit, pas le message.**

Un sujet est un **espace de travail** ouvert sur une situation métier en cours. Il agrège, en un
seul endroit : les conversations qui l'alimentent, les tâches qui le font avancer, les pièces
jointes qui s'y rapportent, et le journal des décisions qui s'y sont prises.

C'est le seul agrégat du produit qui possède un cycle de vie complet. Tout le reste — messages,
conversations, contacts — existe avant lui, à côté de lui, et après lui.

### La chaîne

> **Message → Conversation → Subject → Task → Action → LogEvent**

| Maillon | Rôle | Cycle de vie |
|---|---|---|
| `Message` | Révèle une situation | Immuable une fois reçu |
| `Conversation` | **Range** le message à la réception, par une règle déterministe propre au canal | **Durable** : ne se crée pas à la main, ne se termine jamais, ne se supprime pas |
| `Subject` | Donne un **sens métier** à un ensemble de messages | S'**ouvre**, s'utilise, se **ferme** — jamais « se crée » ni « se supprime » |
| `Task` | Formalise ce qu'il faut faire | Ouverte → faite, réversible |
| `Action` | Exécute concrètement (en V1 : envoyer un message) | Ouverte → faite / annulée / échouée |
| `LogEvent` | Trace ce qui s'est passé | Immuable, écrit dans la transaction de chaque mutation |

**La granularité sémantique est plus fine que la granularité de transport.** Un sujet est plus
fin qu'une conversation. C'est pourquoi le rattachement se décide, **dans le modèle**, message
par message (`Message.subject_id`) et non conversation par conversation — même quand l'interface
ne l'expose pas.

---

## 2. Le rangement déterministe

Un message entrant ou sortant est **immédiatement rangé dans une conversation**, à la réception,
par une règle propre à son canal. Ce rangement **ne peut pas échouer** : un message a une place
dès la première seconde, sans qu'aucune IA n'ait à comprendre quoi que ce soit.

| Sous-type | Discriminant (clé) | Titre |
|---|---|---|
| E-mail | objet normalisé + **set** de destinataires | l'objet |
| Messagerie directe | l'interlocuteur | le nom du contact |
| Messagerie de groupe | le fil de groupe | le nom du groupe |

Nos propres messages **sortants** rejoignent la conversation de leur set de destinataires — et,
pour l'e-mail, de leur objet. Une conversation contient donc les deux sens de l'échange.

**Il n'existe pas de message orphelin.** Ce qui peut rester en attente de tri, c'est une
**conversation orpheline** : une conversation qu'aucun sujet ouvert n'écoute.

### Ce qu'une conversation n'est jamais

**Elle n'est pas découpée par thème.** Découper un fil par sujet exigerait d'**inférer** à la
réception. On y perdrait deux choses :

- le **déterminisme** — un message n'aurait plus de place garantie ;
- la **stabilité de l'identité** — une erreur d'inférence rangerait durablement un message au
  mauvais endroit, et le corriger reviendrait à déplacer des messages un à un.

La conversation est la couche **transport et identité**. Le sujet est la couche **sémantique**.

---

## 3. L'asymétrie fondatrice

C'est la règle dont tout le reste découle. Quand une décision paraît arbitraire, c'est ici qu'il
faut revenir.

> ## 🔑 L'énoncé central
>
> **Un fil d'e-mail appartient à un sujet, un seul, à vie.**
>
> **Une conversation de messagerie est un FLUX ; un sujet l'ÉCOUTE — à partir d'un message,
> jusqu'à ce qu'il cesse d'écouter.**

**Pourquoi.** L'e-mail porte nativement une notion de fil : l'**objet**. Deux affaires menées
avec la même personne s'y séparent d'elles-mêmes — l'objet **est déjà** une délimitation
d'affaire, posée par l'expéditeur. Il n'y a rien à découper, donc rien à borner.

La messagerie n'a pas d'objet. Le seul discriminant disponible est l'interlocuteur (ou le
groupe) : un fil est un flux continu où les affaires **s'entrelacent**. C'est là — et seulement
là — qu'un sujet doit se **brancher** sur le flux pour en extraire une affaire.

> **Un groupe de messagerie se comporte exactement comme un direct.** La tentation est de voir
> dans le **nom du groupe** l'équivalent d'un objet — « Chantier Narbonne », « Équipe
> Marne-la-Vallée ». C'est faux : un nom de groupe désigne un **collectif**, pas une **affaire**.
> Il parlera successivement d'une livraison en retard, d'un planning de congés et d'un
> congélateur en panne — exactement le mélange que l'objet d'e-mail évite.

### ⚠️ L'énoncé est DIRECTIONNEL

C'est la lecture la plus facile à rater du modèle, et la rater **bloque l'implémentation**.

| Sens de lecture | Cardinalité | Énoncé |
|---|---|---|
| **conversation → sujet** | **1:1** | une conversation e-mail a **UN** sujet, un seul, pour toute sa vie |
| **sujet → conversations** | **1:N** | un sujet porte **0, 1 ou n** conversations, e-mail et/ou messagerie |

**Ce qui est unique, c'est le sujet d'une conversation, pas la conversation d'un sujet.** Un
sujet **agrège** — c'est sa raison d'être, puisque c'est à son niveau que se fait la
réunification entre canaux.

> ⚠️ **Aucune contrainte d'unicité sur `subject_id` dans la table de liaison.** La poser
> interdirait d'un coup le changement d'objet, l'extension à un second canal et le changement
> d'adresse d'un interlocuteur.

### Un sujet agrège 0, 1 ou n conversations

- **0** — un sujet sans échange, purement personnel : une liste de tâches.
- **1** — le cas courant : un fil d'e-mail, ou une écoute sur un fil de messagerie.
- **n** — le sujet s'étend : parti d'un fil de messagerie, l'utilisateur écrit **par e-mail** au
  même interlocuteur pour la même affaire. Le sujet porte alors une **écoute** d'un côté et un
  **fil entier** de l'autre.

---

## 4. Ouvrir un sujet : une seule primitive

Le domaine expose **une seule** fonction : *ouvrir un sujet **sur une conversation**, avec une
ancre **optionnelle***.

- **ancre nulle** → le sujet couvre **tout le fil** ;
- **ancre posée** → l'écoute **commence à ce message**.

> ⚠️ **La logique métier teste l'ANCRE, jamais le canal.** Un `if (channel === 'email')` dans le
> domaine est le premier pas vers deux produits.

Ce que le canal détermine, c'est **sur quoi porte le geste**, et donc quelle ancre il transmet :

| | **E-mail** | **Messagerie** |
|---|---|---|
| Le geste porte sur… | la **conversation** | le **message** |
| Ce qu'il propose | ouvrir un **nouveau sujet**, ou **rattacher à un sujet existant** | « ce message est important » → commencer l'écoute ici et ouvrir le sujet |
| Ancre transmise | **aucune** | le **message désigné** |
| Ce qui appartient au sujet | **tout le fil**, amont compris | les messages **à partir de l'ancre**, jusqu'à l'éventuelle borne de fin |

⚠️ **Ouvrir un sujet sur une conversation e-mail balaie le fil ENTIER, amont compris.** Un
échange de six e-mails déjà reçus produit un sujet portant les **six** messages, pas le dernier.
La règle « messages ≥ ancre » est un héritage de la messagerie ; appliquée à l'e-mail, elle
n'en rattacherait qu'un sur six.

**Côté e-mail, le geste ne crée pas le lien : il DÉCLARE que ce fil mérite d'être suivi.** Tous
les fils ne sont pas des affaires — une newsletter, un accusé de réception, un démarchage n'ont
pas à devenir des sujets. Le geste ne fabrique pas une correspondance, il **reconnaît** celle
que l'objet a déjà posée.

⚠️ **Corollaire : une ligne de conversation de messagerie ne porte aucun geste d'ouverture.**
L'offrir reviendrait à proposer « faire de ce groupe une affaire » — or un groupe n'est jamais
une affaire. Le geste d'écartement, lui, existe sur les deux canaux.

### Étendre une écoute : le même geste, sur un message plus ancien

Si un sujet écoute déjà la conversation et que l'utilisateur désigne un message **antérieur à
l'ancre**, l'écoute **remonte jusqu'à lui** — les messages traversés entrent dans le sujet.

**Pourquoi le même geste.** L'utilisateur n'a qu'une intention à exprimer, « l'affaire commence
ici », et elle ne change pas selon qu'un sujet existe déjà ou non. Un seul geste qui **crée** ou
qui **étend** selon le contexte, c'est une règle à retenir au lieu de deux — et cela rend
inutile tout dispositif de correction dédié.

---

## 5. L'écoute et ses deux bornes

Une écoute a **un début** (`anchor_message_id`) et peut recevoir **une fin**
(`closing_message_id`). L'un et l'autre désignent **un message**, jamais une date.

> ⚠️ **Une borne qui désigne un message ne ment jamais ; une borne déduite d'un horodatage
> devient fausse dès que deux messages arrivent dans la même seconde.**

Tant que le sujet reste ouvert et qu'aucune borne de fin n'est posée, les nouveaux messages de
la conversation lui sont rattachés automatiquement.

**L'écoute est un concept exclusivement de la messagerie.** Côté e-mail, un sujet n'écoute rien :
il **EST** le fil.

### Appartenance et statut sont deux axes indépendants

C'est l'erreur qu'il ne faut pas refaire, et elle a été commise une fois.

| | Question posée | Ce qui y répond |
|---|---|---|
| **Appartenance** | *quels messages sont dans ce sujet ?* | les **bornes** — jamais le statut |
| **Statut** | *où en est cette affaire ?* | `Subject.status` |

Les confondre produit des effets absurdes : valider un sujet ampute silencieusement son
périmètre, et un sujet ne peut plus être rouvert sans réécrire son appartenance.

`Subject.closed_at` est donc **une simple date de clôture**, pas une borne d'appartenance.

### Le modèle porte des RÉFÉRENCES, jamais des copies

Un `Message` porte son `conversation_id` **et** son `subject_id` ; la table de liaison
`SubjectConversation` porte les bornes. Lu depuis la conversation ou depuis le sujet, **c'est la
même ligne**.

⚠️ Ne jamais « optimiser » en dupliquant les messages dans le sujet.

---

## 6. La règle de réception est canal-dépendante

C'est la règle la plus facile à casser en la lisant trop vite : les règles d'**arrêt d'écoute**
ne concernent **que la messagerie**, puisqu'un sujet e-mail n'écoute rien.

| | **E-mail** | **Messagerie** |
|---|---|---|
| Un message entrant rejoint le sujet… | **toujours**, quel que soit son statut | **seulement** si l'écoute est active |
| Sujet `validé` ou `fermé` | le message le **ROUVRE** (`→ ouvert`, `closed_at` effacé) | rien : le message reste sans sujet, la conversation redevient orpheline |
| Comment faire taire le fil | **ignorer la conversation**, et rien d'autre | ignorer la conversation, ou arrêter l'écoute |

**Pourquoi l'e-mail rouvre.** De l'activité sur une affaire signifie qu'elle est **vivante**. Un
fournisseur relance sur une affaire validée il y a trois jours : soit son message rouvre le
sujet et remonte dans le fil, soit il s'y range **en silence** — et l'utilisateur rate exactement
le message qu'il ne fallait pas rater. Le statut dit ce que l'utilisateur *croyait* en le
posant ; le message entrant dit ce qui *est*. Quand les deux se contredisent, c'est le message
qui a raison.

**Pourquoi la messagerie ne rouvre pas.** La conversation n'y est pas l'affaire mais un flux qui
charrie des affaires successives : un message arrivé après l'arrêt d'une écoute ne parle pas
forcément de la même chose. Le rattacher serait un pari ; rouvrir un sujet dessus serait un pari
sur un pari.

---

## 7. Arrêter, détacher, ignorer — trois gestes distincts

| Geste | Ce qui s'arrête | Borne de fin | Canal |
|---|---|---|---|
| **Fermer le sujet** | **toutes** ses écoutes ; la conversation ne référence plus ce sujet | posée | messagerie |
| **Valider le sujet** | la conversation n'alimente plus le sujet | posée | messagerie |
| **Arrêter l'écoute** (depuis le sujet) | cette conversation-là seulement | posée | messagerie |
| **Détacher un fil e-mail** | la liaison est supprimée, `subject_id` retiré des messages du fil | **aucune** | e-mail |
| **Ignorer la conversation** | elle n'alimente plus **aucun** sujet ouvert qui l'écoute | **aucune** | les deux |

**Détacher un fil e-mail est un rattrapage d'erreur, pas un arrêt.** Sur un fil e-mail il n'y a
pas d'écoute à arrêter : le détachement corrige un **rangement erroné**, il ne défait pas un
envoi. C'est la seule façon de défaire un rattachement e-mail, et la marche arrière des trois
cas de rattachement manuel — sans lui, une erreur serait irréversible.

**Ignorer est une PAUSE, pas une FIN.** L'ignorance est réversible : la réactiver doit faire
**reprendre** l'alimentation. Si elle posait une borne de fin, « Réactiver » serait un bouton
sans effet observable.

⚠️ **Écarter une conversation écoutée exige une confirmation qui NOMME les sujets concernés.**
Jamais « un ou plusieurs sujets » : le nom. On ne demande pas à quelqu'un de confirmer un risque
sans lui dire lequel — une confirmation sans information se clique sans être lue.

---

## 8. Rattachement automatique : la frontière IN-SET / HORS-SET

Deux situations voisines, traitées à l'opposé, selon un test **exact** : l'expéditeur est-il
**déjà dans le set de destinataires** du sujet ?

| | **IN-SET** — automatique | **HORS-SET** — manuel |
|---|---|---|
| Situation | un destinataire connu répond, à un sous-ensemble différent | un interlocuteur écrit depuis une adresse **jamais vue** |
| Effet sur la clé | le set change → **nouvelle conversation** | la clé change → **conversation orpheline** |
| Ce que fait Relvo | la **range automatiquement** dans le même sujet | rien : l'utilisateur rattache à la main |

**Le rattachement in-set n'est pas de l'inférence.** Objet normalisé = fonction pure ;
appartenance au set = test exact. Le déterminisme tient.

**Pourquoi hors-set reste manuel.** Rapprocher « même objet, adresse **inconnue** » exigerait
d'inférer à la réception. On y perdrait le déterminisme (une clé qui se devine peut se tromper)
et la stabilité de l'identité (une fusion à tort ne se défait qu'en déplaçant des messages un à
un).

---

## 9. Le cycle de vie d'un sujet

Le vocabulaire est délibéré : on ne « crée » ni ne « supprime » un sujet — on l'**ouvre** et on
le **ferme**.

### Trois états exclusifs

| Statut | Sens | Alimenté ? | Récupérable ? | Visible ? |
|---|---|---|---|---|
| `ouvert` | l'affaire est **en cours** | oui | — | **aucun badge** |
| `validé` | le travail est **fait** | non | oui | badge |
| `fermé` | l'affaire est **écartée** — jamais traitée, abandonnée | non | oui | badge |

`ouvert` est l'état par défaut et il est **invisible** : un état porté par la quasi-totalité des
sujets n'informe pas. On lit « ouvert » par l'**absence** de badge.

**La distinction entre les deux états terminaux compte.** `validé` dit « c'est fait » ; `fermé`
dit « on ne l'a pas fait, et on ne le fera pas ». Les confondre reviendrait à ne plus pouvoir
répondre à « qu'est-ce que j'ai réellement traité ce mois-ci ? ».

### « Fermer » est une suppression douce

**C'est un statut, jamais une destruction.** Le sujet sort de la vue, ses écoutes cessent, et il
reste récupérable. Le vocabulaire retenu est **« Fermer » / « Fermés » / « Remettre »** — jamais
« Supprimer » ni « Corbeille ». Deux raisons :

1. **C'est honnête.** Rien n'est détruit, autant que le mot le dise. Un vocabulaire de
   destruction pour une opération réversible entraîne soit l'hésitation, soit la fausse
   confiance.
2. **Un sujet est le SEUL endroit où vivent les tâches et le journal des décisions.** Un message
   supprimé par erreur existe encore dans Gmail ; une **tâche** supprimée par erreur n'existe
   **nulle part ailleurs**. Le coût d'une fausse manœuvre n'est pas symétrique.

⚠️ **« Remettre » ne redémarre pas les écoutes.** Les bornes de fin restent posées ; l'utilisateur
relance l'écoute qu'il veut, là où il veut repartir. Sans cela, un sujet de messagerie remis
après trois semaines **avalerait d'un bloc** tout ce que le fil a charrié entre-temps. Remettre
dit « je reprends cette affaire », pas « rattrape tout ce que j'ai manqué ». Côté e-mail il n'y
a rien à redémarrer : le fil n'a jamais été détaché.

⚠️ **Un sujet fermé n'est JAMAIS purgé.** Aucune rétention, aucune expiration — pour la raison
exacte qui impose le vocabulaire « Remettre ». Une purge automatique ferait d'une opération
annoncée comme réversible une **destruction différée** : le pire des deux mondes.

À la fermeture, Relvo propose d'**ignorer aussi la conversation** — c'est le geste qui empêche un
fil bavard de reproposer indéfiniment de nouveaux sujets, et le seul qui fasse taire un fil
e-mail. L'ignorance vit sur la **conversation** : ce n'est pas un sujet qu'on veut faire taire,
c'est une **source**.

### Les marqueurs : cumulables, indépendants du statut

Ce ne sont pas des étapes de vie mais des **états instantanés**, qui coexistent. Aucun n'est
stocké comme statut ; tous sont **dérivés** :

| Marqueur | Dérivé de |
|---|---|
| **Nouveau** | `last_opened_at == null` sur un sujet ouvert — ouvrir la fiche l'éteint |
| **Urgent** | `priority = urgent` |
| **À faire** | il reste au moins une tâche ouverte |
| **En attente** | `waiting_for_reply`, posé par Relvo |

Un sujet **ouvert** peut afficher en même temps Urgent et « À faire » — impossible à représenter
dans un énuméré exclusif. C'est la preuve que les deux axes devaient être séparés.

**Le non-lu appartient à la conversation, pas au sujet.** C'est là que les messages arrivent, et
c'est l'ouverture de la **conversation** — non celle du sujet — qui marque un message comme lu.

---

## 10. Les autres cycles de vie

### Task

Une tâche est rattachée **au sujet, pas à un utilisateur** : elle matérialise une action
nécessaire, indépendamment de qui l'exécutera. En V1, un compte = un humain.

Une tâche peut n'avoir **aucun sujet** : créée à la volée, ou détachée. La suppression d'un sujet
supprime en cascade les tâches qui lui sont rattachées.

**Taxonomie dérivée de la date**, sans champ dédié : **rendez-vous** (date + heure), **tâche
datée** (date sans heure), **flottante** (sans date). Le marqueur **En retard** est dérivé —
tâche ouverte à échéance passée, à la granularité du jour ; une flottante n'est jamais en retard.

La **source** (`Relvo` ou `Moi`) est un attribut historique permanent : elle reste lisible pour
toute la vie de la tâche.

### Contact

Un contact naît **complet** quand l'utilisateur le crée, **automatique** quand Relvo le déduit.
⚠️ **Relvo ne crée jamais un contact « dans le vide »** : uniquement à la création d'un sujet. Un
expéditeur inconnu reste une chaîne brute jusqu'à ce qu'un sujet existe.

Un contact porte une adresse et un téléphone **primaires**, plus des **secondaires**.
L'auto-rattachement des messages entrants consulte **les deux**.

### Folder

Un `Folder` est un **domaine de la mémoire de Relvo** : il regroupe les sujets d'un périmètre
**et** les connaissances qui servent à les traiter.

Le folder **« Général »** est auto-créé, **purement documentaire**, et **non supprimable** : il
ne contient jamais de sujet. Il accueille les connaissances transversales, chargées dans le
contexte de tous les sujets. Un sujet que Relvo ne sait pas classer reste **sans domaine** — il
n'atterrit **pas** dans Général.

### KnowledgeDocument

Deux natures, et la distinction n'est pas cosmétique : les **documents** (`file`) sont des
**références** auxquelles on se fie, non modifiables dans l'app ; les **instructions** (`note`)
sont une **mémoire** que l'utilisateur façonne. La sensation de contrôle vient des instructions.

Un document porte un état d'absorption décidé par Relvo : **lu** (injecté dans les prompts) ou
**écarté**.

⚠️ **Deux stockages, jamais un seul.** Le fichier vit dans le stockage objet — **source de
vérité et seule voie d'affichage**. Une copie part vers la Files API pour l'inférence : elle est
en **écriture seule** et n'est jamais relisible. Si l'identifiant d'inférence est perdu, on
ré-uploade depuis la source ; l'inverse est impossible.

---

## 11. Les règles de conservation

**Aucun geste courant du produit ne détruit de données.** C'est un principe de domaine, et le
vocabulaire de l'interface doit le refléter.

| Geste | Ce qu'il fait vraiment |
|---|---|
| « Fermer » un sujet | pose un statut, réversible |
| « Supprimer » / « Ignorer » une conversation | met la **source** en pause, réversible, sur les deux canaux |
| « Détacher » un fil e-mail | supprime une **liaison**, pas des messages |
| Cocher une tâche | pose un état, réversible |

⚠️ **La suppression d'un fichier ne passe JAMAIS par la fonction qui supprime la ligne.** Le
domaine ignore le stockage : un **trigger** pousse la clé d'objet dans une outbox **dans la
transaction**, un cron la draine **hors transaction**. C'est le seul mécanisme qui capte les
**cascades**, dont l'ORM est aveugle par conception. Supprimer en synchrone rouvrirait des
pertes de données. **Toute nouvelle table portant une clé d'objet reçoit son trigger dans la
même migration.**

---

## 12. Le périmètre V1

### Ce qui est outillé

Multi-tenant par compte · triptyque d'acteurs · rangement déterministe en conversations ·
ouverture de sujet manuelle sur les deux canaux · écoutes et leurs bornes · tâches avec modèle de
date riche, semainier et vue mois avec replanification par glissement · domaines regroupant
sujets et connaissances · ingestion e-mail **et** messagerie · pièces jointes avec étiquetage
automatique de premier niveau · échange avec Relvo action-capable et conscient de la page ·
citations activées avec un affichage minimal.

### Ce qui reste manuel en V1

**Le tri.** Aucun sujet ne s'ouvre tout seul : c'est l'utilisateur qui désigne ce qui mérite d'en
devenir un. Le pipeline qui le fera à sa place est l'objet du prochain jalon majeur.

### Ce qui est reporté

Page d'activité autonome · niveaux 2 et 3 d'analyse des pièces jointes · édition des instructions
par Relvo · échange multi-appareils · affichage riche des citations · portée « sujet » pour un
document de connaissance · affectation d'une tâche à un utilisateur · temps réel par WebSocket
(V1 : rafraîchissement périodique) · facturation.

### Le réflexe d'arbitrage

> Cela simplifie l'usage pour un dirigeant food ou bâtiment ? → **V1.**
> Cela renforce Relvo comme surface d'action ? → **V1.**
> Cela peut attendre deux mois ? → **V2.**
> Cela ressemble à de l'outillage pour utilisateur avancé ou à de l'analytique ? → **V2.**

---

## 13. Ce qui est provisoire, et doit le rester

Trois règles de ce document sont des **échafaudages du mode manuel**. Elles sont écrites ici
pour qu'on ne les fossilise pas : sans cette section, quelqu'un les lira comme des contraintes du
domaine et cherchera à les préserver.

**1. L'écoute est la prothèse d'un objet manquant.** Là où l'objet existe, il n'y a rien à
écouter. Là où il manque, l'écoute est indispensable — sans elle, ouvrir un sujet embarquerait
des mois de bavardage. Le jour où le pipeline saura découper un flux **par le sens**, il
produira ce que l'objet d'e-mail donne gratuitement, et l'écoute **tombera** : sans migration,
l'ancre étant déjà optionnelle.

**2. « Au plus un sujet ouvert par conversation » est une règle métier, pas une contrainte de
schéma.** La table de liaison est **déjà** plusieurs-à-plusieurs. Lever la règle ne demande
aucune migration. ⚠️ Le jour où on la lèvera, il faudra **réinventer un signal plus fin** que le
bandeau d'appartenance, qui suppose un seul sujet à la fois.

**3. L'appartenance vit sur le message, jamais sur la conversation.** C'est précisément ce qui
rend l'échafaudage démontable : quand le pipeline décidera message par message, la règle
mécanique sera **remplacée**, pas complétée.

### Deux renoncements assumés

Ils ne sont pas des oublis, et ils reviendront sur la table.

**1. L'entrelacement dans une plage d'écoute n'est plus exprimable dans l'interface.** C'était
l'argument fondateur du modèle : un fournisseur qui alterne deux affaires dans le même fil. **Le
modèle le permet toujours** — l'appartenance est décidée message par message — mais l'interface
ne l'expose plus : dans une plage d'écoute, **tous** les messages appartiennent au sujet ; hors
plage, **aucun**.

> **Arbitrage assumé.** Séparer des affaires entrelacées est exactement le travail du pipeline
> IA. En attendant, **un peu de bruit dans un sujet vaut mieux qu'une interface que personne ne
> comprend**. On ne construit pas une mécanique manuelle sophistiquée pour six mois en sachant
> qu'une machine la remplacera.

**2. Les écoutes passées deviennent invisibles côté conversation.** Rien, dans le fil lui-même,
ne dit plus qu'une affaire y a été suivie puis close. C'est ce que rattrape le dépliant
« N sujets passés » du bandeau d'appartenance — sans lui, cette mémoire n'existerait plus nulle
part.

---

## 14. La garde

> ⚠️ **Le domaine reste commun aux deux canaux.** Ouverture de sujet, écoute, arrêt d'écoute,
> détachement, ignorance, statuts : une seule implémentation.
>
> Ce qui diverge par canal est le **rendu** et le **geste** — jamais la fonction appelée. Un
> swipe peut changer de libellé et de couleur ; il ne doit **jamais** changer de fonction.
>
> **Le jour où l'on duplique la logique métier « parce que l'e-mail est différent », on aura deux
> produits à maintenir**, et Relvo perdra ce qui fait sa valeur : réunifier des canaux dans un
> même espace de travail.
