# Chantier « Les groupes et les mentions » — M29, 24 novembre 2026

## Démarrage à froid — à lire en premier

**Où on en est.** Le dirigeant a fait passer M29 devant la fin de M25 le 2026-11-24 (`ecarts`,
« Les mentions d'abord ») : la mention WhatsApp qui s'affiche en chiffres et ne pèse sur rien
est ce que les testeurs remontent sans cesse. L'épique est `M29-groupes-et-mentions.md` ; ses
décisions sont dans `ecarts`, « Ignorer veut dire ne plus importer ; un groupe se lit sur
mention et deux fois par jour » et « La salve partout, et une minute ». M25 est en pause à sa
tranche 5 (`2026-11-m25-maitrise-des-medias.md`). **Les quatre tranches sont livrées** ; il
reste M29.7, après l'usage, et à constater en production ce qui n'a été vu qu'en simulation —
la liste est en fin de chaque tranche ci-dessous.

**Le rythme de lecture tranché, à ne pas rouvrir.** Un fil direct se lit à la salve (une
minute). Un groupe **sans sujet ouvert** se lit deux fois par jour, par lot, et **aussitôt
quand le dirigeant y est mentionné**. Un groupe **qui porte un sujet ouvert** se suit comme un
direct — c'est déjà le comportement du code (`relireApresSalve`). Un groupe ignoré n'est ni lu
ni importé, mention ou pas.

**Ce que l'agrégateur donne** (vérifié sur un groupe du dirigeant) : le texte porte `@<LID>`,
parfois `@<numéro>` ; le webhook n'a aucun champ de mention ; la liste des participants d'un
fil donne pour chacun le LID (`provider_id`), le numéro, le nom et `is_self` ; l'expéditeur
d'un webhook porte son LID (`attendee_provider_id`), son numéro et son nom.

**Ce qui existe après la tranche 1.**

- `packages/db/src/domain/annuaire-messagerie.ts` : la table `MessagingIdentity` (par canal :
  identifiant en chiffres, numéro, nom, « c'est moi ») ; `noterIdentites` (ne désapprend
  rien), `annuaireDesMentions`, `resoudreMentions`, et les fonctions pures `idsDesMentions`,
  `cleIdentite`, `ecrireMentions`, `mentionneLeDirigeant`. Test :
  `packages/db/test/annuaire-messagerie.test.ts`.
- `apps/web/src/server/annuaire-messagerie.ts` : ce qui nourrit l'annuaire depuis
  l'agrégateur — `identiteDuWebhook`, `completerAnnuaire` (la liste des participants, une fois
  par identifiant inconnu), `mentionDuDirigeant`.
- Le webhook de messagerie note l'expéditeur de chaque message, apprend « moi » sur un message
  envoyé par le compte, et pose `Message.mentionsSelf` avant d'ingérer.
- `getConversationThread` et la liste des conversations rendent le texte **mentions
  résolues** ; le fil rend aussi `unknownMentions`, et sa page va chercher les participants une
  fois quand il y en a — c'est ce qui fait lire juste les messages déjà en base.
- À l'écran : « @vous » en violet (`shared/linkified-text.tsx`), et une arobase cerclée sur la
  ligne d'une conversation où le dirigeant est mentionné dans un message non lu
  (`ConversationListItem.mentioned`).

**Ce que la tranche 1 ne fait pas, et qu'il ne faut pas croire fait.**

- **Rien n'a été vu sur un vrai groupe.** Les formes de l'agrégateur ont été vérifiées avant
  le chantier ; le chemin entier — webhook, participants, « c'est moi », affichage — ne l'a
  pas été. **À essayer par le dirigeant** : ouvrir un groupe où l'on mentionne quelqu'un, et se
  faire mentionner.
- **« C'est moi » s'apprend** : par un message que le dirigeant envoie, ou par la liste des
  participants d'un fil. Tant que ni l'un ni l'autre n'est arrivé sur un canal, une mention de
  lui n'est pas reconnue.
- **Les messages déjà en base ne portent pas `mentionsSelf`** : ils s'affichent « @vous », mais
  la liste ne marque que les mentions reçues depuis la livraison.
- **L'échange avec Relvo** (ses outils de lecture) reçoit encore le texte brut, identifiants
  en chiffres.
- La mention « à tout le groupe » n'a pas été observée ; une mention dans un message relu
  après une ignorance (M25.10) ne pose pas `mentionsSelf`.

**Ce qui existe après la tranche 2.**

- **Une mention du dirigeant fait lire le groupe.** Le webhook passe `mention` à
  `trierConversation` (`pipeline/tri.ts`) : un groupe orphelin n'y est trié que dans ce cas.
  Le tri attend la salve, puis lit **sans condition** — la mention porte le tri, pas le
  dernier message. Sur un groupe : ni filtre déterministe, ni décision par le profil de
  l'expéditeur, ni mise en sourdine.
- **La fenêtre** : `autourDeLaMention` (`pipeline/messagerie-regles.ts`) — six messages
  avant, la mention, deux après ; c'est ce que le modèle lit (`FIL_MENTION`,
  `ConversationContexte.groupe`) et c'est son début qui ancre l'écoute.
- **Relvo lit des noms** : `mentionsLisibles` est appliqué à la projection du tri, à la fiche
  d'un sujet (structuration) et aux nouveaux messages d'une relecture. `blocMessage` ajoute,
  sur un message reçu qui porte « @vous », la ligne « Mention : le dirigeant est interpellé
  nommément… » — c'est le signal de M29.6, donné aux trois profils.
- `applyTriageMatter` ouvre un sujet sur un groupe **ancré**, comme sur un fil direct.
- **Essayé avec le vrai modèle**, hors application, sur trois fenêtres de groupe : une
  demande (« @vous il faut faire venir le technicien, tu peux l'appeler ? ») → à traiter,
  professionnel, un sujet « Friteuse n°2 hors service » ; un remerciement → rien à faire ; une
  invitation au foot → personnel, donc l'avis seul.
- **En production**, lecture seule, quelques minutes après la tranche 1 : l'annuaire reçoit
  bien l'expéditeur d'un vrai message (nom et numéro). « C'est moi » et une mention réelle du
  dirigeant n'avaient pas encore été vus.

**Ce que la tranche 2 ne fait pas, et qu'il ne faut pas croire fait.**

- **Le chemin entier n'a pas été vu sur un vrai groupe** : mention reçue → participants →
  « c'est moi » → tri → sujet → tâche. Chaque maillon est testé ou essayé seul.
- **La tâche pour le dirigeant est celle que la structuration propose** en lisant « @vous »
  et la ligne « Mention » : aucune règle ne la force. À regarder sur les premiers cas réels.
- **Le tri ne charge que les dix derniers messages du groupe** : si plus de dix messages
  arrivent pendant la minute de salve, la mention sort de la fenêtre et le tri s'arrête
  (issue « historique », mal nommée dans ce cas).
- **Pas de contexte du message cité** (`quoted`) : la fenêtre est chronologique.
- Un groupe où le dirigeant est mentionné mais qui est **ignoré** n'est ni importé ni lu —
  c'est la règle tranchée.

**Ce qui existe après la tranche 3.**

- **Un groupe se juge, une fois** (M29.3). `pipeline/groupe-jugement.ts` (`jugerLeGroupe`,
  sans Next ni `server-only`, chargé aussi par le script) et `pipeline/groupe.ts` (l'entrée de
  l'application). Même appel que le tri, avec le cadrage « un groupe à juger »
  (`ConversationContexte.decouverte`, dans `contexte/couches.ts`). La décision est pure :
  `deciderGroupe` (`pipeline/decision.ts`) — hors du champ professionnel et confiance haute,
  ignoré ; sinon gardé ; l'action de l'avis est reposée d'après la nature.
- **Quand** : `trierConversation`, sur un groupe sans mention, juge le groupe s'il n'a jamais
  reçu d'avis (`TriageProjection.dejaJuge`), n'est ni ignoré ni suivi, et que le message n'est
  pas de l'historique — après l'attente de la salve. Les groupes déjà connus se jugent donc
  d'eux-mêmes **à leur prochain message**.
- La liste des participants est demandée à ce moment : elle donne la taille du groupe et
  nourrit l'annuaire (« c'est moi » compris).
- **Le lot du stock** : `pnpm --filter web groupes:juger [<e-mail>] [--executer] [--titres]
  [--limite N] [--differe]` — simulation sans `--executer`. Il juge au tarif immédiat par
  défaut (le tarif différé est une option : le coût est de l'ordre de 0,0004 € par groupe).
- **Simulé en production le 2026-11-24**, lecture seule. Sur le compte du dirigeant, avec les
  titres : 14 groupes, 10 ignorés (anniversaire, vacances, danse, famille…), 4 gardés (RELVO,
  Protect Permis, Impulse - MTP Team, Click'n'Justice) — aucun verdict contestable à la
  lecture.
- **Le stock entier, simulé le même jour** (totaux seuls, aucun titre lu hors du compte du
  dirigeant) : 592 groupes sur six comptes — 62 ignorés (personnel, confiance haute), 527
  gardés (487 professionnels en confiance haute, 26 moyenne, 7 basse ; 7 personnels gardés
  faute de certitude), 3 non jugés car déjà suivis par un sujet ; 0,27 € d'appels. **Le
  jugement n'écarte donc qu'un groupe sur dix** : trois comptes portent 365, 98 et 78 groupes,
  presque tous actifs dans le mois et jugés professionnels. Ces verdicts-là n'ont pas été
  relus titre par titre — seul chaque dirigeant peut dire s'ils sont justes.
- **Ce que cela pèse sur la tranche 4**, mesuré sur quatorze jours : une lecture par groupe et
  par demi-journée où il a parlé ferait une centaine de lectures par jour pour le compte le
  plus chargé (470 messages par jour), une vingtaine pour le suivant, une dizaine ou moins
  pour les autres. Au coût d'un appel de tri, c'est de l'ordre d'un à deux euros par mois
  pour le premier — une estimation, à confirmer en livrant, contre le plafond d'inférence.

**Ce que la tranche 3 ne fait pas, et qu'il ne faut pas croire fait.**

- **Le lot n'est pas lancé** : il attend le dirigeant, qui le lance lui-même (l'accès de
  l'assistant à la production est en lecture seule). Tant qu'il ne l'est pas, un groupe qui
  ne parle pas reste « Sans avis ».
- **Le jugement à réception n'a pas encore été vu en production** : seule la simulation l'a
  été. La simulation ne connaît pas la taille du groupe (elle ne demande rien à l'agrégateur).
- **Un groupe jugé professionnel porte « À traiter · Professionnel »** dans la liste : c'est
  l'avis sur le groupe, pas une demande précise. À juger à l'usage.
- Un groupe ignoré à tort ne se rattrape que par le relevé du lundi et le filtre « Ignorées ».

**Ce qui existe après la tranche 4.**

- **Les deux lectures du jour** (M29.5). `vercel.json` porte toujours deux crons : le matin
  (6 h UTC) et la **mi-journée** (11 h UTC, l'ancien cron de 2 h). Chacun ne fait que LANCER
  la lecture (`lancerLectureDesGroupes`) : elle tourne dans sa propre fonction,
  `POST /api/groupes/lecture`, par passes enchaînées (`passeSuivante`, six au plus).
- **Quels groupes** : `listGroupesALire` (`packages/db/src/domain/lecture-groupes.ts`) — jugé,
  actif, aucun sujet ne l'écoute, un message entrant sans sujet depuis le repère. Le repère
  est `Conversation.groupReadUntil` (migration `20261125100000_m29_lecture_des_groupes`),
  réservé avant l'appel, rendu s'il échoue.
- **La lecture d'un groupe** : `pipeline/groupe-lecture.ts` (`lireLeGroupe`, sans Next ni
  `server-only`) — la projection sur une fenêtre (`getTriageProjection(…, { apres, plafond })`),
  le cadrage « un groupe lu depuis la dernière fois » (`ConversationContexte.lecture`,
  `FIL_LECTURE` : quarante messages), le même appel que le tri au tarif différé, borné à une
  minute. La décision est pure : `deciderLectureGroupe` (`pipeline/decision.ts`).
- **La passe** : `pipeline/groupes-du-jour.ts` — quatre comptes de front, trois groupes par
  compte ; structuration du sujet ouvert, relecture du sujet rejoint, une notification par
  compte ; le garde-fou des sujets (`LECTURE_GROUPES`, `compterSujetsNesDesGroupes`).
- **Une lecture sans suite** se note au journal (`noterLectureSansSuite`, événement
  `group_read`) et laisse l'avis du groupe intact.
- **Le script de mesure** : `pnpm --filter web groupes:lire` — simulation seulement.
- **Essayé de bout en bout en local**, vrai modèle, par la route : trois groupes posés par le
  domaine — la panne qui attend le patron rejoint son sujet ouvert et y ajoute la tâche, la
  cliente sans réponse ouvre un sujet structuré, l'échange de services ne laisse rien ; une
  seconde passe ne relit rien.
- **Simulé en production le 2026-11-24**, lecture seule, sur douze heures : 89 groupes lus
  (484 messages), 13 sujets ouverts dont 11 pour le compte le plus chargé (6 après le
  garde-fou), 1 rattaché, 29 doutes écrits sur le groupe, le reste sans suite ; 0,046 € au
  tarif immédiat, la moitié en différé. Les décisions prises sur ces chiffres : `ecarts`,
  « La lecture des groupes : prudente par défaut ».

**Ce que la tranche 4 ne fait pas, et qu'il ne faut pas croire fait.**

- **Aucune lecture réelle n'a encore tourné en production** : la première part au cron
  suivant la livraison. À regarder dans les journaux de la fonction : `[ia] lecture des
  groupes` — `dus`, `lus`, `ouverts`, `plafonnes`, `restants`, `echecs`.
- **Presque aucun groupe n'est « à lire » tant qu'il n'est pas jugé** : la lecture ne prend
  que les groupes qui portent un avis. Ils se jugent à leur prochain message (M29.3), ou par
  le lot `groupes:juger`.
- **La justesse des sujets ouverts n'a pas été relue** hors du compte du dirigeant : seuls des
  comptes ont été lus, aucun titre.
- **Un sujet par groupe et par lecture** : un groupe qui parle de trois affaires n'en ouvre
  qu'une, et le sujet emporte tous les messages lus. Au-delà de quarante messages depuis la
  dernière lecture, les plus anciens ne sont pas lus.
- **Les messages de l'après-midi attendent le lendemain matin**, sauf mention.
- **Le tarif différé peut faire attendre** : un appel de plus d'une minute est abandonné et le
  groupe reste dû. Le débit réel des passes n'est pas mesuré.
- Le filet du rattrapage du courrier tourne désormais à la mi-journée, plus la nuit.

## Le plan

1. **« La mention se lit »** — M29.1, M29.2. Livrée.
2. **« La mention force la lecture »** — M29.4, et le signal de M29.6 : une mention du
   dirigeant dans un groupe à traiter déclenche aussitôt la lecture du contexte proche ;
   un sujet s'ouvre ou se rattache, avec une tâche pour le dirigeant sauf si la mention
   n'exige rien ; si un sujet écoute déjà le groupe, la relecture reçoit le signal et ajoute
   la tâche. Le modèle lit des noms, pas des identifiants.
3. **« Le groupe se juge à sa découverte »** — M29.3 : un appel sur le titre, la taille et les
   premiers messages ; les groupes déjà connus jugés une fois, par lot.
4. **« Deux lectures par jour »** — M29.5 : greffées sur les deux crons existants, l'un
   déplacé vers la mi-journée ; jamais un troisième. Livrée.
5. M29.7 (la réponse qui cite un message du dirigeant vaut mention) — après l'usage.

## Où on en est

- [x] Tranche 1 — la mention se lit (M29.1, M29.2) — livrée le 2026-11-24, à essayer sur un
      vrai groupe.
- [x] Tranche 2 — la mention force la lecture (M29.4, signal de M29.6) — livrée le 2026-11-24, à
      essayer sur un vrai groupe.
- [x] Tranche 3 — le groupe se juge, une fois (M29.3) — livrée le 2026-11-24 ; **le lot du
      stock reste à lancer par le dirigeant**.
- [x] Tranche 4 — deux lectures par jour (M29.5) — livrée le 2026-11-24 ; **la première
      lecture réelle est à constater** dans les journaux, et ses sujets à juger par le dirigeant
- [ ] M29.7 — la réponse qui cite un message du dirigeant
