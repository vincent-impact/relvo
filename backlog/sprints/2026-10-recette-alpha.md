# Chantier « Recette de l'alpha » — premières remontées des testeurs, 21 octobre 2026

## Démarrage à froid — à lire en premier

**Où on en est.** M7 est **terminée** (tranches 8 à 11 vérifiées en production par le
dirigeant, `2026-10-m7-tranche11-whatsapp-direct.md`). L'application est **en recette** : des
testeurs la prennent en main pour la première fois, et leurs remontées sont le « où on en est »
du dépôt le temps de ce chantier. Ce fichier tient la **liste des remontées**, ce qui a été
tranché pour chacune et ce qui est livré. Il s'allonge à chaque vague de recette ; quand la
recette se clôt, le chantier d'après est la lecture de l'historique de la messagerie à la
connexion (reliquat de M7), puis M13 (ouverture de la bêta).

**Ce qui existe et ne se refait pas.** La première connexion = `/bienvenue` (M19.9 : six
diapositives, trace `welcome_seen_at`) ; la prise en main = le script de l'échange
(`domain/questions.ts`, `SCRIPT_PRISE_EN_MAIN`, `ensureOnboardingQuestions`, posé à l'ouverture
de `/relvo` et à la connexion d'un canal) ; la lecture du courrier à la connexion =
`channel_catchups` et la carte vivante (`components/shared/carte-vivante.tsx`), montrée dans
l'échange et sur Canaux ; la connexion d'un canal = hosted auth Unipile, canal pré-créé en
`pending`, finalisé par le webhook `notify` (`app/api/webhooks/unipile/route.ts`).

## Première vague — tranchée avec le dirigeant le 2026-10-21

Quatre remontées, toutes sur le **premier quart d'heure** d'un nouvel utilisateur. La décision
de fond est écrite dans `ecarts`, « La prise en main commence à la sortie des diapositives ; la
boîte se demande en dernier ». Ici, le détail de ce qui a été livré.

### R1 — Revenir en arrière de la page du fournisseur laissait un canal « En attente » sans issue

**Constat.** Le canal pré-créé reste `pending` sans compte externe ; la ligne n'est pas
cliquable, le bouton de connexion a disparu, « Reconnecter » ne vient pas. Il fallait supprimer.

**Livré.**
- `prepareChannelConnection` (domaine) : un canal **jamais connecté** du même type se
  **reprend** — renommé, fournisseur de messagerie mémorisé dans `connectionData.mailProvider` —
  au lieu d'un second canal ou d'un refus ; un canal connecté reste un conflit.
- La ligne de Canaux porte **« Connecter »** (`ChannelConnectButton` → `reprendreConnexionAction`)
  pour un canal jamais connecté : la page du fournisseur se rouvre sur le même canal et le même
  choix. Juste au retour du fournisseur (`?connected=1`, deux minutes), la ligne dit
  « Connexion… » le temps que le webhook passe.
- `PITFALLS.md` #70. Test `packages/db/test/channel-connection.test.ts`.

### R2 — L'échange avec Relvo doit s'ouvrir juste après les diapositives, pas à l'ajout d'un canal

**Constat.** Le testeur confiait sa boîte avant d'avoir dit son métier ; l'échange ne
commençait qu'à la connexion. Le dirigeant tranche : **configurer Relvo d'abord**, la boîte en
dernier.

**Livré.**
- La dernière diapositive (« Faisons connaissance. ») propose **« Configurer Relvo »** et ouvre
  `/relvo?from=%2F` ; « Plus tard » ramène à l'accueil. `connecterPremiereBoiteAction` est
  supprimée.
- Le script gagne une **quatrième étape**, en dernier : `prise-en-main/premiere-boite` — Gmail,
  Outlook, une autre boîte —, posée tant qu'aucune boîte e-mail n'a de compte chez le
  fournisseur. Dans l'échange, chaque réponse ouvre la page du fournisseur
  (`connecterBoiteDepuisEchangeAction`, retour dans l'échange avec `connected=1`) ; **c'est la
  connexion qui ferme la question** (`resolveMailboxStep`, appelée par le webhook `notify`),
  jamais le clic — revenir en arrière la laisse ouverte.
- Les adresses de retour de la page du fournisseur sont centralisées
  (`server/unipile/retour.ts`) : Canaux ou l'échange.

### R3 — Pendant la lecture des quatorze derniers jours, on doit voir qu'un travail tourne

**Constat.** Entre le retour du fournisseur et la première tranche, rien n'existe en base :
pas de carte, pas de rafraîchissement, l'application semblait arrêtée. Et hors de Canaux, rien
ne disait que Relvo lisait.

**Livré.**
- `server/lecture-en-cours.ts` : une boîte **en mise en route** (compte externe posé, aucune
  ligne de lecture, moins de trente minutes) a déjà sa carte vivante **« en attente »** ; Canaux
  et l'échange la montrent et se rafraîchissent (`PollRefresh`) jusqu'à la lecture, et encore
  pendant la lecture.
- **L'accueil** dit la lecture **en premier**, en direct (hors cache), avec ses compteurs, et
  mène à l'échange (« → Suivre la lecture »). La ligne « je lis encore » du brief, en cache,
  s'efface devant.
- **Le disque du dock respire** (les étoiles, `.respire`) tant qu'une lecture est ouverte
  (`countActiveCatchups`, compté par le layout avec le badge).

### R4 — « Un autre métier » ne doit pas valider : Relvo demande lequel et propose des domaines

**Livré.**
- La réponse « Un autre métier » est **libre** : le champ s'ouvre, le métier dit passe les
  secteurs à `other` **et** devient une instruction de Général (« Mon métier : … ») ; la phrase
  de Relvo le reprend.
- `DOMAINES_TYPIQUES.other` : clients, fournisseurs, devis, équipe, administratif — les domaines
  de toute entreprise, proposés quand aucun secteur connu ne les éclipse ; le texte de l'étape ne
  dit plus « votre métier » dans ce cas. Tests `questions.test.ts`, `domaines.test.ts`.

### R5 — L'assistant doit être actif au démarrage

**Constat.** Un compte nouveau avait l'assistant coupé : rien ne se triait tant que le testeur
n'avait pas trouvé l'interrupteur dans les Préférences.

**Livré.** `assistant_enabled` vrai par défaut (migration
`20261021120000_assistant_actif_par_defaut`, défaut de colonne seulement — les comptes existants
ne bougent pas) ; `activateAccount` rallume l'assistant quand l'administrateur ouvre l'accès,
journalisé (acteur `system`). Test `admin.test.ts`. `02-modele-donnees.md` récrit.

### R6 — Les notifications doivent être activées au démarrage

**Constat.** Le testeur ne recevait ni brief ni question : l'abonnement se faisait seulement
depuis la ligne des Préférences. Une permission push ne s'obtient que sur un geste de
l'utilisateur, sur CET appareil : on ne peut pas l'activer à sa place, on peut la demander au bon
moment.

**Livré.**
- `lib/push-appareil.ts` : la mécanique d'abonnement de l'appareil, partagée par la ligne des
  Préférences (`NotificationsToggle`, refaite dessus) et par deux nouvelles entrées.
- `InvitationNotifications` dans l'échange : quand les questions de Relvo sont traitées, un
  formulaire de Relvo propose « Activer les notifications » ; « Plus tard » se retient sur
  l'appareil et revient après trois jours (`doitReproposer`, testé dans `test/push.test.ts`) ;
  sur un iPhone hors application installée, le geste à faire est dit à la place.
- `LienNotifications` sur l'accueil : « → Activer les notifications sur cet appareil » dans le
  bloc des nouvelles, tant que l'appareil n'est pas abonné.

### R7 — Un compte ne se supprimait pas depuis le backoffice

**Constat.** La suppression de `mamadou@tastycrousty.io` échouait sans message ; en production,
la fiche répondait 500 après que l'agrégateur avait déjà perdu le compte (404 à la tentative
suivante).

**Livré.** `deleteAccount` efface d'abord le gros du tenant table par table, hors transaction,
puis trace et supprime la ligne du compte dans une transaction à délai explicite ; l'action
attrape l'erreur, la journalise avec le compte visé et répond en langage client ; un compte
déjà absent chez l'agrégateur compte comme déconnecté, pas comme un échec. `PITFALLS.md` #71.
**À refaire par le dirigeant** : relancer la suppression de ce compte depuis le backoffice.

### R8 — Les pièces jointes d'une conversation e-mail (Kiloutou, compte de Lila) n'ont pas été relevées

**Constat.** Sans accès à la base de production, la cause exacte n'est pas prouvée. Deux chemins
pouvaient perdre les pièces : la lecture de l'historique utilisait la ligne de liste de
l'agrégateur dès qu'elle portait un corps, sans vérifier qu'elle détaillait les pièces
annoncées (`has_attachments`) ; et le webhook ne stockait les pièces qu'au premier passage —
un message déjà importé sans elles ne les recevait jamais. Troisième lecture possible : les
pièces étaient sur un e-mail **envoyé** par la dirigeante, que Relvo ne rapatrie pas par choix
(« l'affaire se lit, elle ne stocke pas ce que le dirigeant a déjà »).

**Livré.**
- `doitRelireEmail` : la lecture relit l'e-mail entier quand des pièces sont annoncées sans
  être listées (testé, `unipile-map.test.ts`).
- Le webhook range les pièces d'un message déjà connu qui n'en avait aucune.
- `pnpm --filter web pj:rattraper <e-mail> --filtre kiloutou` : relit chez l'agrégateur les
  e-mails reçus sans pièce jointe et stocke celles qu'ils portent — à lancer **par le dirigeant
  avec les variables de production**, d'abord en `--simuler`. La garde `server-only` du module
  Unipile remonte sur son index pour que le script importe `client` et `attachments`.

## Vérification

- `pnpm typecheck`, `pnpm lint`, tests du paquet (`questions`, `domaines`, `channel-connection`)
  et tests unitaires de l'application : verts.
- Rendu headless (390 × 844) sur un compte local neuf : dernière diapositive, échange avec le
  script (métier → « un autre métier » écrit → domaines de toute entreprise → règle → boîte),
  Canaux avec un canal orphelin (« Connecter »), accueil et dock pendant une lecture.
- À vérifier **en production par le dirigeant** : le parcours complet avec une vraie boîte —
  retour en arrière puis « Connecter », et la carte « en attente » au retour du fournisseur.

## Deuxième vague — remontées du 2026-10-27, après une semaine d'usage

La première vague portait sur le premier quart d'heure ; celle-ci porte sur **la semaine
d'après** : ce que les testeurs demandent une fois qu'ils ont laissé Relvo lire. Les décisions
sont dans `ecarts`, « La deuxième vague de la recette » et les quatre titres qui suivent. Quatre
remontées sont assez grosses pour être des **épiques** (M23 à M26) ; elles ne se livrent pas
ici, le backlog dit leur ordre. Restent dans ce sprint les correctifs et les gestes.

### R9 — La prise en main mêle les questions de configuration et celles nées de la lecture

**Constat.** Dès que la boîte est confiée, la lecture démarre et pose ses questions (dossiers
que le courrier propose, fin de lecture, lecture étendue) au milieu du script, quand celui-ci
rejoue à la connexion d'un canal ; le testeur ne sait plus à quoi il répond.

**Tranché.** La configuration d'abord, la lecture ensuite ; la lecture ne se montre que par la
carte vivante tant qu'une étape du script est ouverte ; pas deux questions sur les dossiers.

**À livrer.** Les producteurs de questions de la lecture (`ensureFolderProposalQuestions`,
`poserFinDeLecture`, la lecture étendue) **retiennent** leur question tant qu'une étape du
script est ouverte (`originStep` le sait), et la posent quand le script se ferme ; l'échange
sépare visuellement ce que Relvo demande pour se configurer de ce qu'il dit de sa lecture ;
test sur `questions.test.ts`.

### R10 — Maintenir le bouton central du dock pour parler

Item **M22.8**. Le disque Relvo se maintient, on parle, relâcher ouvre l'échange sur une
nouvelle conversation avec la transcription envoyée. Même socle que le composer.

### R11 — Une notification à chaque nouvelle affaire

Item **M12.10**. Née du tri à réception, jamais de la lecture à la connexion ; une par salve.

### R12 — Relvo dit ce qui a changé

Item **M13.6**, avancé dans ce sprint parce que les testeurs de l'alpha en ont besoin
maintenant : à l'ouverture de l'échange, les entrées du journal client depuis le dernier
passage, en un message, une fois.

### Les quatre épiques nées de cette vague

- **M23 — Les dossiers** : les domaines deviennent une arborescence de dossiers, l'instruction
  d'un père vaut pour ses fils. Tranché.
- **M24 — Dix boîtes par compte** : relais Gmail en propre, l'agrégateur gardé pour WhatsApp,
  le nom de domaine de Relvo. **Tranché**, après M23.
- **M25 — La maîtrise des médias** : référence plutôt que téléchargement, sourdine à zéro,
  purge par cycle de vie, état du stockage au backoffice, quota. **Tranché** solution par
  solution dans l'épique ; après M23 et M24.
- **M26 — Des chiffres vrais** : le Bilan et l'Usage reliés au journal et au compteur.

## Où on en est

- [x] R1 à R4 livrées, documentées (`01` §11, `05` §11.11, `ecarts`, `PITFALLS` #70, `CLAUDE.md`).
- [x] R5 et R6 livrées (assistant actif par défaut, invitation aux notifications dans l'échange et sur l'accueil).
- [x] R7 livrée (suppression d'un compte robuste, PITFALLS #71) — à relancer en production sur le compte concerné.
- [x] R8 livrée (pièces jointes : relecture, webhook qui complète, script `pj:rattraper`) — à lancer en production sur le compte de Lila.
- [ ] Vérification en production par le dirigeant (première vague).
- [x] Deuxième vague enregistrée : R9 à R12 dans ce sprint, M23 à M26 au backlog, décisions
      dans `ecarts`.
- [x] M24 tranchée (webhook Gmail en propre, déclaration à Google, nom de domaine) ; ordre : **M23 puis M24**, le reste moins urgent.
- [x] M25 tranchée solution par solution : toutes les recommandations, S5 à éprouver, S10 et S17 écartées.
- [x] M23 démarrée dans son propre chantier (`2026-10-m23-dossiers.md`).
- [x] M23 terminée ; M27 (dossiers et sujets, tranché sur maquettes) démarrée dans son propre chantier (`2026-10-m27-dossiers-et-sujets.md`), avant M24.
- [ ] R9, R10, R11, R12 à livrer.
- [ ] Vagues de recette suivantes : à ajouter ici.
