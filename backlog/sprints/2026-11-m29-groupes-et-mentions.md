# Chantier « Les groupes et les mentions » — M29, 24 novembre 2026

## Démarrage à froid — à lire en premier

**Où on en est.** Le dirigeant a fait passer M29 devant la fin de M25 le 2026-11-24 (`ecarts`,
« Les mentions d'abord ») : la mention WhatsApp qui s'affiche en chiffres et ne pèse sur rien
est ce que les testeurs remontent sans cesse. L'épique est `M29-groupes-et-mentions.md` ; ses
décisions sont dans `ecarts`, « Ignorer veut dire ne plus importer ; un groupe se lit sur
mention et deux fois par jour » et « La salve partout, et une minute ». M25 est en pause à sa
tranche 5 (`2026-11-m25-maitrise-des-medias.md`).

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
   déplacé vers la mi-journée ; jamais un troisième.
5. M29.7 (la réponse qui cite un message du dirigeant vaut mention) — après l'usage.

## Où on en est

- [x] Tranche 1 — la mention se lit (M29.1, M29.2) — livrée le 2026-11-24, à essayer sur un
      vrai groupe.
- [x] Tranche 2 — la mention force la lecture (M29.4, signal de M29.6) — livrée le 2026-11-24, à
      essayer sur un vrai groupe.
- [ ] Tranche 3 — le groupe se juge à sa découverte (M29.3)
- [ ] Tranche 4 — deux lectures par jour (M29.5)
- [ ] M29.7 — la réponse qui cite un message du dirigeant
