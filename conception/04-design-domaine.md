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

**Le sujet (`Subject`) est l'entité centrale du produit, pas le message.**

Un sujet est un **espace de travail** ouvert sur une situation métier en cours. Elle agrège, en un
seul endroit : les conversations qui l'alimentent, les tâches qui la font avancer, les pièces
jointes qui s'y rapportent, et le journal des décisions qui s'y sont prises.

C'est le seul agrégat du produit qui possède un cycle de vie complet. Tout le reste — messages,
conversations, contacts — existe avant elle, à côté d'elle, et après elle.

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
fine qu'une conversation. C'est pourquoi le rattachement se décide, **dans le modèle**, message
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
> **Un fil d'e-mail appartient à un sujet, une seule, à vie.**
>
> **Une conversation de messagerie est un FLUX ; un sujet l'ÉCOUTE — à partir d'un message,
> jusqu'à ce qu'il cesse d'écouter.**

**Pourquoi.** L'e-mail porte nativement une notion de fil : l'**objet**. Deux sujets menés
avec la même personne s'y séparent d'elles-mêmes — l'objet **est déjà** une délimitation
de sujet, posée par l'expéditeur. Il n'y a rien à découper, donc rien à borner.

La messagerie n'a pas d'objet. Le seul discriminant disponible est l'interlocuteur (ou le
groupe) : un fil est un flux continu où les sujets **s'entrelacent**. C'est là — et seulement
là — qu'un sujet doit se **brancher** sur le flux pour en extraire ce qui la concerne.

> **Un groupe de messagerie se comporte exactement comme un direct.** La tentation est de voir
> dans le **nom du groupe** l'équivalent d'un objet — « Chantier Narbonne », « Équipe
> Marne-la-Vallée ». C'est faux : un nom de groupe désigne un **collectif**, pas une **sujet**.
> Il parlera successivement d'une livraison en retard, d'un planning de congés et d'un
> congélateur en panne — exactement le mélange que l'objet d'e-mail évite.

**Dans un groupe, une mention se lit par un nom.** Le réseau écrit « @ » suivi d'un identifiant
en chiffres ; Relvo écrit « @Dahmani Eya », et « @vous » quand c'est le dirigeant qu'on
interpelle (`02`, MessagingIdentity). La traduction se fait à la lecture, partout où le texte
d'un message s'affiche — le fil, l'aperçu d'une ligne —, jamais dans ce qui est stocké. Un
message sait dès sa réception s'il mentionne le dirigeant, sans modèle ; la liste des
conversations marque d'une arobase le fil où il est interpellé tant qu'il ne l'a pas lu.

**Un groupe a trois rythmes de lecture, selon ce qu'il porte.** Sans sujet ouvert, Relvo le lit
**deux fois par jour**, d'un coup, depuis son repère de lecture — et **aussitôt** quand le
dirigeant y est mentionné. Dès qu'un sujet l'écoute, il se suit **en direct**, comme un fil :
chaque message rejoint le sujet, qui se relit. La validation ou la fermeture du sujet libère le
groupe, qui revient aux deux lectures du jour pour ce qui suit. Un groupe ignoré n'est ni
importé ni lu, mention ou pas (`05 §1.2`).

### ⚠️ L'énoncé est DIRECTIONNEL

C'est la lecture la plus facile à rater du modèle, et la rater **bloque l'implémentation**.

| Sens de lecture | Cardinalité | Énoncé |
|---|---|---|
| **conversation → sujet** | **1:1** | une conversation e-mail a **UNE** sujet, une seule, pour toute sa vie |
| **sujet → conversations** | **1:N** | un sujet porte **0, 1 ou n** conversations, e-mail et/ou messagerie |

**Ce qui est unique, c'est le sujet d'une conversation, pas la conversation d'un sujet.** Une
sujet **agrège** — c'est sa raison d'être, puisque c'est à son niveau que se fait la
réunification entre canaux.

> ⚠️ **Aucune contrainte d'unicité sur `subject_id` dans la table de liaison.** La poser
> interdirait d'un coup le changement d'objet, l'extension à un second canal et le changement
> d'adresse d'un interlocuteur.

### Un sujet agrège 0, 1 ou n conversations

- **0** — un sujet sans échange, purement personnelle : une liste de tâches.
- **1** — le cas courant : un fil d'e-mail, ou une écoute sur un fil de messagerie.
- **n** — le sujet s'étend : parti d'un fil de messagerie, l'utilisateur écrit **par e-mail** au
  même interlocuteur pour le même sujet. Le sujet porte alors une **écoute** d'un côté et un
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
| Ce qu'il propose | ouvrir une **nouveau sujet**, ou **rattacher à un sujet existant** | « ce message est important » → commencer l'écoute ici et ouvrir le sujet |
| Ancre transmise | **aucune** | le **message désigné** |
| Ce qui appartient à le sujet | **tout le fil**, amont compris | les messages **à partir de l'ancre**, jusqu'à l'éventuelle borne de fin |

⚠️ **Ouvrir un sujet sur une conversation e-mail balaie le fil ENTIER, amont compris.** Un
échange de six e-mails déjà reçus produit un sujet portant les **six** messages, pas le dernier.
La règle « messages ≥ ancre » est un héritage de la messagerie ; appliquée à l'e-mail, elle
n'en rattacherait qu'un sur six.

**Côté e-mail, le geste ne crée pas le lien : il DÉCLARE que ce fil mérite d'être suivi.** Tous
les fils ne sont pas des sujets — une newsletter, un accusé de réception, un démarchage n'ont
pas à devenir des sujets. Le geste ne fabrique pas une correspondance, il **reconnaît** celle
que l'objet a déjà posée.

⚠️ **Corollaire : une ligne de conversation de messagerie n'ouvre jamais un sujet directement.**
Le faire reviendrait à proposer « faire de ce groupe un sujet » — or un groupe n'est jamais
un sujet, et il n'existe pas d'ancre par défaut à lui donner. Le geste d'écartement, lui,
existe sur les deux canaux.

**Ce que la ligne porte, en revanche, c'est un geste de CLASSEMENT** — sur les deux canaux. Il
n'ouvre rien lui-même : il propose les deux issues à parité (nouveau sujet, ou rattachement à une
sujet existant) puis **transmet l'intention à l'écran de conversation**, seul endroit où le fil
est lisible. En e-mail, l'écran enchaîne aussitôt. En messagerie, il ouvre le **choix du message
d'ancrage** — la règle « l'utilisateur désigne toujours le message » est donc tenue, non
contournée.

**Pourquoi ce relais plutôt qu'un geste qui tranche depuis la liste.** Le tri se fait au pouce,
en rafale : refuser tout geste d'entrée sur la liste obligeait à ouvrir chaque conversation, à
agir, puis à revenir. Mais décider **sans avoir lu** reste exclu. Le relais réconcilie les deux :
le geste est disponible là où le pouce est, la décision se prend là où le fil est visible.

### Étendre une écoute : le même geste, sur un message plus ancien

Si un sujet écoute déjà la conversation et que l'utilisateur désigne un message **antérieur à
l'ancre**, l'écoute **remonte jusqu'à lui** — les messages traversés entrent dans le sujet.

**Pourquoi le même geste.** L'utilisateur n'a qu'une intention à exprimer, « le sujet commence
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
elle **EST** le fil.

### Appartenance et statut sont deux axes indépendants

C'est l'erreur qu'il ne faut pas refaire, et elle a été commise une fois.

| | Question posée | Ce qui y répond |
|---|---|---|
| **Appartenance** | *quels messages sont dans ce sujet ?* | les **bornes** — jamais le statut |
| **Statut** | *où en est ce sujet ?* | `Subject.status` |

Les confondre produit des effets absurdes : valider un sujet ampute silencieusement son
périmètre, et un sujet ne peut plus être rouverte sans réécrire son appartenance.

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
| Sujet `validé` ou `fermé` | le message la **ROUVRE** (`→ ouvert`, `closed_at` effacé) | rien : le message reste sans sujet, la conversation redevient orpheline |
| Comment faire taire le fil | **ignorer la conversation**, et rien d'autre | ignorer la conversation, ou arrêter l'écoute |

**Pourquoi l'e-mail rouvre.** De l'activité sur un sujet signifie qu'elle est **vivante**. Un
fournisseur relance sur un sujet validé il y a trois jours : soit son message rouvre
le sujet et remonte dans le fil, soit il s'y range **en silence** — et l'utilisateur rate exactement
le message qu'il ne fallait pas rater. Le statut dit ce que l'utilisateur *croyait* en le
posant ; le message entrant dit ce qui *est*. Quand les deux se contredisent, c'est le message
qui a raison.

**Pourquoi la messagerie ne rouvre pas.** La conversation n'y est pas le sujet mais un flux qui
charrie des sujets successifs : un message arrivé après l'arrêt d'une écoute ne parle pas
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
| **Ignorer la conversation** | ses messages ne sont plus importés : elle n'alimente plus **aucun** sujet | **aucune** | les deux |

**Détacher un fil e-mail est un rattrapage d'erreur, pas un arrêt.** Sur un fil e-mail il n'y a
pas d'écoute à arrêter : le détachement corrige un **rangement erroné**, il ne défait pas un
envoi. C'est la seule façon de défaire un rattachement e-mail, et la marche arrière des trois
cas de rattachement manuel — sans lui, une erreur serait irréversible.

**Ignorer, c'est ne plus importer.** Tant qu'une conversation est ignorée, rien de ce qui y
arrive n'entre dans Relvo ; elle en tient seulement le compte. Deux gestes la rendent au travail,
et eux seuls : la **réactiver**, ou la **rattacher à un sujet** — un sujet ne peut pas écouter un
fil dont plus rien n'est importé. Le même geste **relit le trou** chez le fournisseur du canal :
le texte de ce qui s'est dit pendant l'ignorance revient dans le fil, et le geste répond par ce
qu'il a retrouvé. Ce qui ne revient pas — une photo, un vocal, un message supprimé à la
source — est dit, jamais passé sous silence. Tant que la relecture n'a pas abouti, le trou
reste écrit sur la conversation, et son fil propose de recommencer.

**Ce qu'une conversation ignorée avait déjà reçu peut être allégé.** Ses pièces et la mise en
forme de ses e-mails se retirent, par un geste d'exploitation, simulé avant d'être fait et
journalisé conversation par conversation. Trois choses restent toujours : le **texte** de chaque
message, ce qu'un **sujet** porte — un message qu'il couvre, une pièce qui y est rangée —, et la
mise en forme d'un message qui n'a pas de texte. Ce retrait ne se défait pas dans Relvo : les
originaux sont dans la boîte ou sur le téléphone, et réactiver la conversation ne les ramène
pas.

**Ignorer est une PAUSE, pas une FIN.** L'ignorance est réversible : la réactiver doit faire
**reprendre** l'alimentation. Si elle posait une borne de fin, « Réactiver » serait un bouton
sans effet observable.

**Ignorer se fait avec une raison.** Le geste propose une raison en un appui, et c'est elle qui
rend l'ignorance exploitable : un expéditeur ignoré plusieurs fois pour publicité n'est plus
soumis au tri. Sans raison, une conversation ignorée est un fait ; avec, c'est une leçon.

⚠️ **Écarter une conversation écoutée exige une confirmation qui NOMME les sujets concernés.**
Jamais « une ou plusieurs sujets » : le nom. On ne demande pas à quelqu'un de confirmer un risque
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
la **ferme**.

### Trois états exclusifs

| Statut | Sens | Alimenté ? | Récupérable ? | Visible ? |
|---|---|---|---|---|
| `ouvert` | le sujet est **en cours** | oui | — | **aucun badge** |
| `validé` | le travail est **fait** | non | oui | badge |
| `fermé` | le sujet est **écartée** — jamais traitée, abandonnée | non | oui | badge |

`ouvert` est l'état par défaut et il est **invisible** : un état porté par la quasi-totalité des
sujets n'informe pas. On lit « ouvert » par l'**absence** de badge.

**La distinction entre les deux états terminaux compte.** `validé` dit « c'est fait » ; `fermé`
dit « on ne l'a pas fait, et on ne le fera pas ». Les confondre reviendrait à ne plus pouvoir
répondre à « qu'est-ce que j'ai réellement traité ce mois-ci ? ».

### « Fermer » est une suppression douce

**C'est un statut, jamais une destruction.** Le sujet sort de la vue, ses écoutes cessent, et elle
reste récupérable. Le vocabulaire retenu est **« Fermer » / « Fermés » / « Remettre »** — jamais
« Supprimer » ni « Corbeille ». Deux raisons :

1. **C'est honnête.** Rien n'est détruit, autant que le mot le dise. Un vocabulaire de
   destruction pour une opération réversible entraîne soit l'hésitation, soit la fausse
   confiance.
2. **Un sujet est le SEUL endroit où vivent les tâches et le journal des décisions.** Un message
   supprimé par erreur existe encore dans Gmail ; une **tâche** supprimée par erreur n'existe
   **nulle part ailleurs**. Le coût d'une fausse manœuvre n'est pas symétrique.

⚠️ **« Remettre » ne redémarre pas les écoutes.** Les bornes de fin restent posées ; l'utilisateur
relance l'écoute qu'il veut, là où il veut repartir. Sans cela, un sujet de messagerie remise
après trois semaines **avalerait d'un bloc** tout ce que le fil a charrié entre-temps. Remettre
dit « je reprends ce sujet », pas « rattrape tout ce que j'ai manqué ». Côté e-mail il n'y
a rien à redémarrer : le fil n'a jamais été détaché.

⚠️ **Un sujet fermé s'efface au bout de trente jours — et il le dit.** Fermer, c'est sortir un
sujet de la zone d'intérêt sans le valider ; le garder pour toujours ferait de Relvo l'archive de
ce qu'on a écarté. Mais une destruction différée derrière un geste annoncé comme réversible
serait le pire des deux mondes : le geste dit donc l'échéance au moment où il est fait, et la
fiche du sujet fermé porte sa date d'effacement. Le **remettre** d'ici là annule le compte à
rebours. Un sujet **validé** ne s'efface jamais : c'est un précédent (§11).

À la fermeture, Relvo propose d'**ignorer aussi la conversation** — c'est le geste qui empêche un
fil bavard de reproposer indéfiniment de nouveaux sujets, et le seul qui fasse taire un fil
e-mail. L'ignorance vit sur la **conversation** : ce n'est pas un sujet qu'on veut faire taire,
c'est une **source**.

### Où vivent ces transitions

**Toutes dans les swipes d'une ligne de sujet sur la page Sujets — dans la liste à plat comme
dans l'arbre —, aucune dans la fiche.** Un sujet ouvert se
valide ou se ferme au swipe ; un sujet terminal se **remet** au swipe droite, et se **supprime**
au swipe gauche — cette dernière étant la seule destruction définitive, et la seule à demander
une confirmation.

**Pourquoi la fiche n'en porte aucune.** Des boutons de statut y doublaient les swipes : deux
chemins pour un même geste, dont un affiché en grand sous le contenu. Le résultat n'était pas
« deux fois plus accessible » mais **ambigu** — l'utilisateur y lisait deux mécanismes distincts
et n'osait plus ni l'un ni l'autre.

⚠️ **Un geste retiré d'une surface doit exister sur l'autre AVANT de disparaître.** Les boutons
de la fiche étaient l'unique chemin de réouverture d'un sujet terminal, dont la liste ne portait
alors aucun swipe : les retirer d'abord aurait enfermé pour de bon tout sujet validé.

### Les marqueurs : cumulables, indépendants du statut

Ce ne sont pas des étapes de vie mais des **états instantanés**, qui coexistent. Aucun n'est
stocké comme statut ; tous sont **dérivés** :

| Marqueur | Dérivé de |
|---|---|
| **Nouveau** | `last_opened_at == null` sur un sujet ouvert **et frais** (la date est posée dès la création quand c'est le dirigeant qui crée : il n'est jamais nouveau pour lui) — ouvrir la fiche l'éteint ; passé le délai de fraîcheur, un sujet que personne n'a ouvert n'est plus une nouvelle, c'est un sujet ouvert |
| **A bougé** | le sujet est nouveau, **ou** une de ses tâches a été ajoutée, modifiée ou retirée **par un autre que le dirigeant** depuis qu'il a ouvert la fiche — lu dans le journal, qui porte l'acteur. Ouvrir la fiche l'éteint |
| **Urgent** | `priority = urgent` |
| **À faire** | il reste au moins une tâche ouverte |
| **En attente** | `waiting_for_reply` — posé après un envoi quand il ne reste aucune tâche ouverte, levé par tout message entrant **ou quand l'utilisateur coche la dernière tâche ouverte** (§10). **Mécanique, sans IA** ; Relvo ne le pose lui-même qu'en relecture, quand un sujet attend un tiers sans qu'aucun envoi ne l'ait dit |

Un sujet **ouverte** peut afficher en même temps Urgent et « À faire » — impossible à représenter
dans un énuméré exclusif. C'est la preuve que les deux axes devaient être séparés.

**Un message reçu ne fait pas bouger un sujet.** S'il change ce qu'il y a à faire, la relecture
touche aux tâches, et ce sont elles qui allument ; s'il ne change rien, il n'y a rien à revoir.
Une tâche que le dirigeant ajoute ou coche lui-même n'allume rien non plus : on ne l'avertit pas
de son propre geste.

**Le non-lu appartient à la conversation, pas à le sujet.** C'est là que les messages arrivent, et
c'est l'ouverture de la **conversation** — non celle du sujet — qui marque un message comme lu.

---

## 10. Les autres cycles de vie

### Task

Une tâche est rattachée **à le sujet, pas à un utilisateur** : elle matérialise une action
nécessaire, indépendamment de qui l'exécutera. En V1, un compte = un humain.

Une tâche peut n'avoir **aucun sujet** : créée à la volée, ou détachée. La suppression d'un sujet
supprime en cascade les tâches qui lui sont rattachées.

**Taxonomie dérivée de la date**, sans champ dédié : **rendez-vous** (date + heure), **tâche
datée** (date sans heure), **flottante** (sans date). Le marqueur **En retard** est dérivé —
tâche ouverte à échéance passée, à la granularité du jour ; une flottante n'est jamais en retard.

La **source** (`Relvo` ou `Moi`) est un attribut historique permanent : elle reste lisible pour
toute la vie de la tâche.

**Une tâche de réponse se coche seule, sans IA.** Quand un message sortant part vers un contact
du sujet alors qu'une tâche de réponse y est ouverte, elle est terminée par correspondance. Un
jugement du modèle n'y apporterait rien et coûterait un appel par message envoyé.

**La dernière tâche cochée à la main règle le sujet, sans IA.** Quand l'utilisateur coche la
dernière tâche ouverte d'un sujet ouvert, plus rien ne reste à faire : ce qu'on attendait d'un
tiers est arrivé — c'est le plus souvent cette tâche même, une livraison, une intervention. Le
marqueur « En attente » se lève et Relvo propose la clôture, le journal le dit. Rouvrir une tâche
retire la suggestion. Relvo, lui, ne déclenche pas cette mécanique quand il coche : sa relecture
décide de la clôture avec toute la situation sous les yeux (`05 §5.5`). La limite est assumée :
si la tâche cochée n'avait rien à voir avec l'attente, la suggestion est de trop, et « pas
encore » la retire d'un tap.

**La relance se dérive de la situation, sans IA.** Quand la situation structurée d'un sujet dit
qu'on attend un tiers et que l'échéance passe sans message entrant, une tâche « Relancer » naît,
portée par Relvo, datée du jour. Une seule par échéance : si l'utilisateur la supprime, elle n'est
pas recréée pour la même attente. C'est le premier bénéfice concret d'une situation structurée.

**Une tâche proposée par Relvo ne s'efface jamais sans trace.** Sa suppression est un vrai
effacement, mais le journal conserve la tâche telle qu'elle avait été proposée, avec le geste :
c'est la matière première de l'apprentissage (cf. `05 §9`).

### Contact

Un contact naît **complet** quand l'utilisateur le crée, **automatique** quand Relvo le déduit.
⚠️ **Relvo ne crée jamais un contact « dans le vide »** : uniquement à la création d'un sujet. Un
expéditeur inconnu reste une chaîne brute jusqu'à ce qu'un sujet existe.

Un contact porte une adresse et un téléphone **primaires**, plus des **secondaires**.
L'auto-rattachement des messages entrants consulte **les deux**.

Relvo écrit sur la fiche un **rôle** et une **note** d'une ligne ; l'utilisateur corrige, et la
correction l'emporte. Un contact automatique reste « à compléter » tant que l'utilisateur ne l'a
pas vérifié.

### Folder

Un `Folder` est un **dossier de la mémoire de Relvo** : il regroupe les sujets d'un périmètre
**et** les connaissances qui servent à les traiter.

Le folder **« Général »** est auto-créé, **purement documentaire**, et **non supprimable** : il
ne contient jamais de sujet. Il accueille les connaissances transversales, chargées dans le
contexte de tous les sujets. Un sujet que Relvo ne sait pas ranger reste **sans dossier** — il
n'atterrit **pas** dans Général.

**Les dossiers s'emboîtent**, comme sur un ordinateur : « Général » est la racine,
tout autre dossier a un père, un sujet se range à n'importe quelle profondeur. **Une
instruction ou un document donnés à un père s'appliquent à tous ses fils et à leurs
sujets** — ce n'est pas une option, c'est ce qu'un dossier veut dire ; la chaîne se lit du
plus général au plus précis, et le plus précis précise les autres sans les effacer. Un dossier
se **déplace** avec tout ce qu'il contient ; jamais la racine, jamais dans lui-même ni dans un
de ses fils, jamais au-delà de la profondeur bornée. Un dossier se **supprime en remontant**
ce qu'il contenait chez son père — ses dossiers, ses instructions, ses documents, ses sujets,
ses messages classés, les contacts et canaux qui le citaient — ; rien n'est perdu. Quand le
père est « Général », les sujets et les contacts redeviennent **sans dossier** plutôt que d'y
entrer. Les questions de Relvo sur ce dossier tombent avec lui.

**Un dossier n'est jamais créé par Relvo.** Quand aucun dossier ne convient, Relvo pose sur
le sujet un **dossier proposé** ; quand il range, il parle en **chemins** (« Clients › Franchises »),
le plus précis qui convient. Dès que plusieurs sujets portent la même proposition, l'interface
suggère de créer le dossier et d'y ranger ces sujets — un geste, réversible. Les socles des
secteurs du compte proposent par ailleurs des dossiers typiques à la prise en main, de premier
niveau. Les dossiers **émergent du courrier** ; ils ne s'inventent pas devant un formulaire vide.
Dans l'échange, Relvo liste, crée, déplace un dossier et range un sujet **à la demande du
dirigeant**, par les fonctions de l'interface.

**La fiche d'un dossier s'ouvre sur sa description** — c'est elle que Relvo lit, avec le
chemin, pour décider qu'un sujet se range là plutôt qu'ailleurs ; quand elle manque, la fiche
invite à l'écrire — puis sur quatre onglets, du contenant au contenu : ses dossiers (son arbre),
ses sujets (les siens et ceux de ses fils), ses instructions, ses connaissances. Chaque onglet
commence par son geste d'ajout. Général, qui ne range aucun sujet, n'a ni description ni onglet
Sujets.

**Ranger un sujet, déplacer un dossier : une seule feuille.** Elle monte du bas et montre
l'arbre des dossiers, le dossier actuel cerclé ; pour un sujet, Général est grisé (la racine
n'en range aucun) et « Sans dossier » reste possible ; pour un dossier, Général se choisit et ce
que l'arbre refuse est grisé. Elle s'ouvre en glissant une ligne de sujet vers la droite dans
la fiche d'un dossier, en tapant le dossier dans le ciel de la fiche d'un sujet, et depuis le
crayon d'un dossier. Un tap range ; un toast annule.

**Les dossiers n'ont pas de page à eux : ils sont une vue de la page Sujets.** La même matière
se lit de deux façons, qu'un interrupteur dans le ciel choisit et que l'appareil retient : la
**liste à plat** et **l'arbre**, dossiers et
sujets ensemble — une carte par dossier de premier niveau, « Sans dossier » en tête quand il
n'est pas vide. Les indicateurs d'état agissent sur les deux vues de la même façon. Dans
l'arbre, chaque dossier porte deux gestes qui ne se confondent pas : **entrer** (son nom) et
**plier** (la flèche, à droite) ; l'état déplié appartient à l'appareil, pas au compte — c'est
un confort de lecture, pas une donnée —, et l'arbre arrive replié. Un dossier y dit **combien
de ses sujets ont bougé**, les siens et ceux de ses dossiers, jamais combien il en contient ;
un sujet qui a bougé s'y lit à la graisse de son titre. Un sujet s'y balaie comme dans la
liste à plat : le même geste dit la même chose dans les deux vues.

**Dans l'arbre, ranger se fait aussi en déposant.** Un sujet ou un dossier se tient puis se
lâche sur un autre dossier ; au doigt, il faut d'abord maintenir — bouger avant annule le geste
et laisse défiler la page. Seules les cibles permises se signalent : un dossier ne va ni dans
lui-même, ni dans un de ses dossiers, ni au-delà de la profondeur bornée, ni « sans dossier » ;
un sujet ne remonte pas « au premier niveau ». Un dossier lâché au pied de l'arbre redevient un
premier niveau. Un toast annule. Ce qu'on tient ne saute pas à la prise : la ligne reste où elle
était, et le point touché reste le point d'accroche. Tant qu'on tient une ligne, son balayage
est gelé : un seul geste parle à la fois. **Ce geste n'est jamais le seul chemin** : la feuille reste,
parce qu'un geste maintenu ne se découvre pas seul et ne se fait pas d'une main occupée.

**On ajoute là où l'on est.** La dernière ligne de chaque branche dépliée propose d'ajouter
dans ce dossier, à tous les niveaux — un dossier vide se déplie donc quand même. Elle ouvre une
feuille qui ne demande qu'un choix (un sujet ou un dossier) et un nom : la destination est déjà
dite, et tout le reste se donne sur la fiche, après. Un dossier ne se propose plus quand la
profondeur bornée est atteinte ; hors de tout dossier, seul un sujet se crée ; au premier
niveau, seul un dossier. **Un sujet que le dirigeant crée lui-même, il l'a vu** : il n'est ni
nouveau, ni allumé.

**Les instructions qui valent partout se donnent à Relvo, chez lui.** Ce sont celles de
« Général », que toute la chaîne hérite ; elles se lisent et s'écrivent depuis l'échange, à
côté de l'historique. « Général » ne se montre pas dans l'arbre : il ne range aucun sujet.

### Label

Une étiquette naît **candidate** quand Relvo la propose sur un sujet, devient **active** dès
qu'un second sujet la porte, et n'est jamais supprimée : une étiquette sans sujet est simplement
inutilisée. Relvo choisit dans le registre actif et ne propose au plus qu'une étiquette nouvelle
par sujet. L'utilisateur ne la saisit jamais ; il filtre dessus.

### RelvoQuestion

Une question naît **ouverte** à la structuration d'un sujet, ou à une étape de la prise en
main et du rattrapage, avec pour portée le contact, le dossier, le sujet ou le compte qu'elle
concerne. Elle devient **répondue** quand l'utilisateur y répond — sur la fiche, ou dans
l'échange par le formulaire —, la réponse étant écrite dans la fiche, dans l'objet du compte ou
dans une instruction, dans la même transaction ; ou **écartée** d'un geste. Tant qu'une question
est ouverte, le bouton Relvo porte un badge et l'accueil la montre. Une question écartée n'est
pas reposée. Une question n'entre jamais dans l'agenda.

### KnowledgeDocument

Deux natures, et la distinction n'est pas cosmétique : les **documents** (`file`) sont des
**références** auxquelles on se fie, non modifiables dans l'app ; les **instructions** (`note`)
sont une **mémoire** que l'utilisateur façonne. La sensation de contrôle vient des instructions.

Un document se **dépose** depuis l'onglet Connaissances d'un dossier : le navigateur l'envoie
au stockage en direct, puis il s'inscrit dans le dossier, **à lire**. Il porte ensuite un état
d'absorption décidé par Relvo : **lu** (injecté dans les prompts) ou
**écarté**.

Un document déposé **s'ouvre** au tap, par le même geste qu'une pièce jointe (design system,
« Une pièce s'ouvre dans Relvo »).

⚠️ **Deux stockages, jamais un seul.** Le fichier vit dans le stockage objet — **source de
vérité et seule voie d'affichage**. Une copie part vers la Files API pour l'inférence : elle est
en **écriture seule** et n'est jamais relisible. Si l'identifiant d'inférence est perdu, on
ré-uploade depuis la source ; l'inverse est impossible.

---

## 11. Les règles de conservation

**Relvo garde ce qui sert à un sujet, et pas le reste.** Rattacher un message à un sujet, c'est
dire qu'il compte : c'est ce signal, que personne n'a à donner exprès, qui décide de ce qui
reste. Sans lui, un dirigeant qui n'ose rien ignorer de peur de manquer quelque chose ferait de
Relvo la copie de sa boîte.

**La même règle décide de ce que Relvo télécharge.** À la réception d'un message de
messagerie, Relvo lit ce que le fournisseur *dit* de ses pièces — leur type, leur poids — avant
d'en lire un octet, et décide pour chacune :

| Décision | Pour quoi | Ce qui en reste |
|---|---|---|
| **Stockée** | ce qu'un sujet porte déjà, sous le plafond de son type ; un message vocal, toujours | le fichier, en plein format |
| **Référence** | tout le reste — la photo, la vidéo, le document d'un message qu'aucun sujet ne porte ; ce qui dépasse le plafond | son nom, son type, son poids annoncé, la vignette que le réseau y joint ; le fichier reste à la source |
| **Trace** | un autocollant, un GIF | un mot dans le fil, rien à ouvrir |

Une référence **se complète** — devient un fichier stocké — dans deux cas, et deux seulement :
le dirigeant **l'ouvre**, ou **un sujet prend le message**. Le tri n'y perd rien : le modèle ne
lit pas les médias, il lit leur nom. Une pièce que le fournisseur ne sert plus le dit, et
renvoie au téléphone ; une référence qu'aucun sujet ne prend part avec son message, au
nettoyage, sans avoir rien pesé. Les plafonds sont une configuration de l'application.

**L'e-mail garde ses pièces** : une pièce d'e-mail est un document, elle se stocke à la
réception. Seules ses images **incorporées** au corps et légères — un logo de signature, un
pixel de suivi — ne sont pas des pièces, et ne sont jamais lues.

**Aucun geste courant ne détruit de données sur le coup** — le vocabulaire de l'interface le
reflète —, et c'est le **nettoyage**, lui, qui efface, selon quatre règles :

| Règle | Ce qu'elle fait |
|---|---|
| **La suppression** | Supprimer un canal ou un compte efface aussitôt tout ce qui en dépend, fichiers compris. Supprimer un sujet ne supprime pas ses conversations : seule l'attache message-sujet et conversation-sujet disparaît. Supprimer un **dossier** ne détruit rien : son contenu remonte chez son père (§10) |
| **L'expiration** | Un message qu'aucun sujet ne porte est effacé trente jours après sa date, texte et pièces, que sa conversation soit active ou ignorée. Ce qu'un sujet porte reste tant que le sujet existe |
| **L'effacement des sujets fermés** | Un sujet fermé est effacé trente jours après sa fermeture, tâches et journal compris ; ses messages redeviennent ordinaires et expirent par la règle précédente. Un sujet validé ne s'efface jamais |
| **L'ignorance** | N'efface rien : une conversation ignorée cesse d'accumuler (`05 §5.6`) |

Ce que les gestes font vraiment, en conséquence :

| Geste | Ce qu'il fait vraiment |
|---|---|
| « Fermer » un sujet | pose un statut, réversible **trente jours** ; passé ce délai le sujet s'efface |
| « Ignorer » une conversation | met la **source** en pause, réversible, sur les deux canaux — jamais « Supprimer » ; ce qu'elle portait sans sujet expire comme le reste |
| « Détacher » un fil e-mail | supprime une **liaison**, pas des messages |
| Cocher une tâche | pose un état, réversible |

**Une conversation e-mail vidée disparaît ; un fil de messagerie reste.** Un fil e-mail *est*
son objet (§4) : sans message, il ne veut plus rien dire, et il part avec eux. Une conversation
de messagerie est un fil continu, sans début ni fin : vidée, elle reste — c'est elle qui retient
qu'un fil est ignoré, ou comment un groupe a été jugé — et sort seulement des listes, jusqu'à
son prochain message. Une conversation e-mail **ignorée** qui refuse encore du courrier reste le
temps qu'elle en refuse : c'est sa sourdine qui travaille.

**Ce qui est expiré ne revient pas.** Un message daté de plus de trente jours ne s'importe plus :
sans sujet il expirerait aussitôt, et un fournisseur qui rejoue son historique ramènerait ce que
le nettoyage a effacé pour le faire trier une seconde fois. Relvo n'est pas l'archive : l'original
reste dans la boîte ou sur le téléphone, que le nettoyage ne touche jamais.

Le nettoyage passe **une fois par jour**, compte par compte, et sait dire d'avance ce qu'il
retirerait — par les mêmes filtres. Son passage est **armé par un interrupteur** de
l'application ; tant qu'il ne l'est pas, il simule, et rien à l'écran ne promet ce qui n'a pas
lieu.

⚠️ **La suppression d'un fichier ne passe JAMAIS par la fonction qui supprime la ligne.** Le
domaine ignore le stockage : un **trigger** pousse la clé d'objet dans une outbox **dans la
transaction**, un cron la draine **hors transaction**. C'est le seul mécanisme qui capte les
**cascades**, dont l'ORM est aveugle par conception. Supprimer en synchrone rouvrirait des
pertes de données. **Toute nouvelle table portant une clé d'objet reçoit son trigger dans la
même migration.**

**Ce mécanisme se prouve, il ne se suppose pas.** Le backoffice mesure le stockage par deux
lectures qu'il rapproche : ce que la **base** sait des pièces — leur poids par compte, par
canal, par type, et selon ce qui les tient (un sujet, rien, une conversation ignorée) — et ce
que le **bucket** porte réellement, listé chez le fournisseur par le paquet de stockage. Un
fichier stocké que la base ne connaît plus et que la file n'attend pas est **sans
propriétaire** : c'est ce qu'un effacement aurait laissé derrière lui, et il ne doit pas y en
avoir. Une pièce connue de la base et absente du bucket ne s'ouvrira pas : elle se compte
aussi. Les pièces gardées en **référence** se comptent à part, avec le poids que leur source
annonce : c'est ce que le stockage n'a pas eu à porter. Le poids du bucket se lit contre un **repère** de configuration, et alerte à son
approche, comme le plafond de l'inférence.

---

## 12. Le périmètre V1

### Ce qui est outillé

Multi-tenant par compte · triptyque d'acteurs · rangement déterministe en conversations ·
ouverture de sujet manuelle sur les deux canaux · écoutes et leurs bornes · tâches avec modèle de
date riche, semainier et vue mois avec replanification par glissement · domaines regroupant
sujets et connaissances · ingestion e-mail **et** messagerie · pièces jointes avec étiquetage
automatique de premier niveau · échange avec Relvo action-capable et conscient de la page,
**dicté** aussi bien que tapé — on maintient le micro, on relâche, la transcription part ·
citations activées avec un affichage minimal · **administration** : un rôle d'administrateur,
une inscription libre dont l'accès s'ouvre sur validation, et depuis un backoffice la lecture de
chaque compte (coût d'inférence compris), la coupure de son assistant et sa **suppression
définitive** — la seule destruction du produit, l'agrégateur déconnecté d'abord.

### Ce qui reste manuel en V1

**Le tri.** Aucun sujet ne s'ouvre toute seule : c'est l'utilisateur qui désigne ce qui mérite d'en
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
des mois de bavardage. L'échafaudage commence à tomber : sur un fil direct, c'est le **pipeline**
qui pose l'écoute, ancrée au premier message de la salve qu'il a lue (`05-ia.md` §1.2) — le
dirigeant ne désigne plus le message, Relvo le fait. Le jour où le pipeline saura découper un
flux **par le sens**, il produira ce que l'objet d'e-mail donne gratuitement, et l'écoute
**tombera** : sans migration, l'ancre étant déjà optionnelle.

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
l'argument fondateur du modèle : un fournisseur qui alterne deux sujets dans le même fil. **Le
modèle le permet toujours** — l'appartenance est décidée message par message — mais l'interface
ne l'expose plus : dans une plage d'écoute, **tous** les messages appartiennent à le sujet ; hors
plage, **aucun**.

> **Arbitrage assumé.** Séparer des sujets entrelacés est exactement le travail du pipeline
> IA. En attendant, **un peu de bruit dans un sujet vaut mieux qu'une interface que personne ne
> comprend**. On ne construit pas une mécanique manuelle sophistiquée pour six mois en sachant
> qu'une machine la remplacera.

**2. Les écoutes passées deviennent invisibles côté conversation.** Rien, dans le fil lui-même,
ne dit plus qu'un sujet y a été suivie puis close. C'est ce que rattrape le dépliant
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
