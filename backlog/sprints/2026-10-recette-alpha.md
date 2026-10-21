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

## Vérification

- `pnpm typecheck`, `pnpm lint`, tests du paquet (`questions`, `domaines`, `channel-connection`)
  et tests unitaires de l'application : verts.
- Rendu headless (390 × 844) sur un compte local neuf : dernière diapositive, échange avec le
  script (métier → « un autre métier » écrit → domaines de toute entreprise → règle → boîte),
  Canaux avec un canal orphelin (« Connecter »), accueil et dock pendant une lecture.
- À vérifier **en production par le dirigeant** : le parcours complet avec une vraie boîte —
  retour en arrière puis « Connecter », et la carte « en attente » au retour du fournisseur.

## Où on en est

- [x] R1 à R4 livrées, documentées (`01` §11, `05` §11.11, `ecarts`, `PITFALLS` #70, `CLAUDE.md`).
- [x] R5 et R6 livrées (assistant actif par défaut, invitation aux notifications dans l'échange et sur l'accueil).
- [ ] Vérification en production par le dirigeant.
- [ ] Vagues de recette suivantes : à ajouter ici.
