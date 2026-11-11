# Chantier « Recette de l'alpha » — premières remontées des testeurs, 21 octobre 2026

## Démarrage à froid — à lire en premier

**Où on en est.** M7 est **terminée** (tranches 8 à 11 vérifiées en production par le
dirigeant, `2026-10-m7-tranche11-whatsapp-direct.md`). L'application est **en recette** : des
testeurs la prennent en main pour la première fois, et leurs remontées sont le « où on en est »
du dépôt le temps de ce chantier. Ce fichier tient la **liste des remontées**, ce qui a été
tranché pour chacune et ce qui est livré. **La quatrième vague est livrée** : R18 et R19, à éprouver par le
dirigeant sur l'iPhone ; R20 reste à vérifier en production. **À faire ensuite : R12.** Il s'allonge à chaque vague de recette ; quand la
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

**Couverte par R17.** Les questions de la lecture vivent dans l'échange de la lecture, celles du
script dans « Prise en main » : plus rien à retenir.

### R10 — Maintenir le bouton central du dock pour parler

Item **M22.8**. Le disque Relvo se maintient, on parle, relâcher ouvre l'échange sur une
nouvelle conversation avec la transcription envoyée. Même socle que le composer.

**Livré.** Le disque du dock porte les deux gestes : le tap ouvre l'échange, le maintien passé
un seuil court ouvre le micro (même `useDictee`, même route), la durée se dit au-dessus du
disque, relâcher envoie et l'échange s'ouvre en nouvel échange, la dictée partie d'elle-même
(`?dicte=`, effacée de l'adresse aussitôt). Un maintien trop court ou un micro refusé se
disent en toast.

**Repris sur le retour du dirigeant.** Le signal d'écoute était à peine perceptible (une
pilule au-dessus du disque) ; demandé : le vibreur, et un écran d'écoute organique. Livré :
le téléphone **vibre** à l'ouverture du micro et au relâcher (l'API Vibration sur Android ;
sur iOS, le détour de l'interrupteur, que les versions récentes peuvent fermer — rien n'en
dépend), et **la page entière se met à l'écoute** : le disque tenu est le point de chute du pouce,
un impact y pulse et des ondes violettes en partent jusqu'en haut de l'écran (deuxième retour du
dirigeant : « ondulatoire, forcer sur le violet »), « Relvo écoute… » et la durée au milieu de
l'écran, le geste qui reste en dessous — le même voile dans l'échange quand on maintient le micro du composer. Pas
un changement de page pendant le maintien : le doigt tient le disque, une navigation
démonterait le bouton et perdrait le micro ; l'échange vient au relâcher. **À éprouver sur le
téléphone** : le vibreur, le geste sur le disque qui déborde de la pilule.

### R11 — Une notification à chaque nouvelle affaire

Item **M12.10**. Née du tri à réception, jamais de la lecture à la connexion ; une par salve.

**Livré.** « Nouveau sujet : <titre> », qui ouvre la fiche, poussée par `trierConversation`
quand un sujet s'ouvre hors lot — la lecture à la connexion ne pousse rien. Des sujets nés à
moins de deux minutes d'écart font une seule notification (« 3 nouveaux sujets », la liste),
et le même tag remplace la précédente sur le téléphone. Nature de push `sujet`, journalisée
comme les autres.

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

## Troisième vague — remontées du 2026-11-01, après la première semaine de tests

Quatre remontées, tranchées par le dirigeant **avant** M24 et les épiques : ce sont des
correctifs d'usage, pas des chantiers.

### R13 — Le dock n'apparaît pas dans Safari sur iPhone

**Constat.** Un testeur consulte `app.relvo.net` dans le navigateur, sans l'installer : le dock
est absent, le contenu passe sous la barre d'outils de Safari. En PWA installée, rien à redire.

**Cause et livraison.** La hauteur de cadre pilotée par JS (le `max` de plusieurs mesures, remède
au lancement à froid en standalone) ne vaut qu'en PWA installée ; hors standalone, le cadre
retombe sur `100dvh` et la variable est effacée (`PITFALLS` #74). Livré. **À vérifier par le
dirigeant dans Safari, sur son iPhone**, onglet et écran d'accueil.

### R14 — Une réponse WhatsApp envoyée depuis Relvo n'apparaît pas dans le fil

**Constat.** La réponse écrite depuis le téléphone s'affiche ; celle écrite dans Relvo part bien
mais ne se voit nulle part.

**Cause et livraison.** Le sortant se rangeait dans une conversation fantôme (`PITFALLS` #75).
L'envoi demande désormais à la conversation du fil son interlocuteur, son contact et sa nature,
et la réponse retombe dans le même fil — direct ou groupe ; test de régression dans
`whatsapp-ingestion.test.ts`. Les fantômes déjà créés se fondent par
`pnpm --filter web wa:reparer <e-mail>` — **à lancer en production sur chaque compte de
testeur**, `--simuler` d'abord.

**Reprise.** Le dirigeant a choisi de garder l'historique des testeurs, fantômes compris — et la
réponse ne se voyait toujours pas : la recherche du fil par `chat_id` rendait le fantôme dès que la
vraie conversation avait reçu d'autres messages (reproduit en test). La réponse va désormais dans
la **conversation ouverte à l'écran**, et toute recherche par fil écarte un fantôme tant qu'une
autre conversation existe (`conversationDuFil`), pour l'envoi depuis Relvo comme pour l'écho du
téléphone. Au passage, le fil n'affichait que ses 200 messages **les plus anciens** : il montre
maintenant les 200 plus récents.

### R15 — La liste des sujets se lit mal debout ou en voiture

**Constat.** Les testeurs lisent leurs sujets en action ; la ligne de 58 px, son titre de
14,5 px et sa ligne fine de 12 px sont trop petits.

**Tranché.** Trois propositions en artefact (« Lignes de sujets »), aux vraies tailles d'un
iPhone ; le dirigeant a retenu **C, gros caractères** : titre 20 px en graisse 500 sur deux
lignes au plus — **ramené à 18 px après un jour d'usage, puis à 16 px le lendemain, à l'essai**, la graisse et les deux lignes gardées —, nom du dossier 12,5 px, chiffres 22 px, bande plus large, **sans ligne de
résumé** — « autant trancher net ». Livré sur `SubjectRow`, partout où la ligne se rend
(Sujets, Dossiers, recherche, échange). Les lignes de tâches et de conversations ne bougent
pas tant que les testeurs ne le demandent pas.

### R16 — Une tâche s'ouvre pour être lue, et mène à son message

**Constat.** Un tap sur une tâche ouvrait directement le formulaire de modification ; et le résumé
de Relvo ne suffit pas : le testeur veut le message qui a fait naître la tâche, pour le contexte.

**Livraison.** La feuille d'une tâche s'ouvre sur **la tâche elle-même**, pas sur un
formulaire : son titre en tête à côté du pictogramme de tâche, un **crayon** pour le récrire ;
le sujet, la date et l'heure se changent **d'un tap sur eux** ; pourquoi Relvo la propose et
d'après quoi ; et **« Voir le message d'origine »**, qui ouvre la conversation **sur ce
message**, surligné. « Enregistrer » ne s'allume que si quelque chose a changé. Une première
version en deux états (lecture puis « Modifier ») a été refusée par le dirigeant : un tap de
plus pour toucher ce qu'on lit déjà. Le domaine remonte le fil du message d'origine de chaque
tâche (`resolveSourceConversations`), pour toutes les listes.

### R17 — Relvo propose des échanges, il ne les mélange pas

**Constat.** Tout ce que Relvo a à dire — une étape de la prise en main, la carte de lecture,
une question née d'un sujet — se posait en tête du même fil que la discussion du dirigeant, et
les deux se mélangeaient. Proposition maquettée sur un canevas, mise en production demandée
telle quelle, à juger à l'usage (`ecarts`, « Relvo propose des échanges, il ne les mélange pas »).

**Livré.** Chaque chose que Relvo a à dire est un échange à part, nommé par son origine
(`/relvo/echanges/[cle]`) ; l'échange vide n'en montre qu'une ligne chacun en tête ; le badge du
disque compte ces échanges ; la notification d'une question et la ligne de l'accueil y mènent.
**Premier retour du dirigeant, appliqué** : pas de pastille sur l'horloge ni de rappel dans
l'historique (l'accueil les annonce déjà), pas de bouton « Nouvel échange » dans l'historique,
et la ligne d'une lecture en cours respire. Le regroupement est pur et testé
(`domain/echanges-relvo.ts`). R9 tombe avec : les questions de la lecture vivent dans l'échange
de la lecture.

## Quatrième vague — remontées du 2026-11-11, sur deux vidéos d'un testeur

Deux remontées filmées par un testeur le 2026-11-01, tranchées par le dirigeant le 2026-11-11
(`ecarts`, « Un fichier s'ouvre dans Relvo, jamais sur une page blanche » et « La recherche de
l'échange : la personne d'abord, la pertinence ensuite, et seulement ce que Relvo retient »).
Elles sont passées en premier, devant R12 et devant la suite de M24 : **R18 et R19 sont livrées.**

### R18 — Un fichier Excel reçu ne s'ouvre pas : page blanche

**Constat.** Dans une conversation e-mail, le testeur touche la pièce jointe
« TASTY CRA 2026.xlsx ». Le volet de navigation de l'iPhone s'ouvre sur l'adresse du stockage, la
barre de chargement se fige, la page reste blanche. À la fermeture du volet, l'application
elle-même reste blanche plusieurs secondes.

**Cause.** `AttachmentViewer` envoie tout ce qui n'est pas une image vers le navigateur en
affichage dans la page (`?inline=1`, `target="_blank"`). Le chemin a été conçu pour les PDF ; un
classeur arrive sans nom ni consigne de téléchargement, et le navigateur ne propose rien.

**Tranché.** Un fichier s'ouvre dans Relvo.
- Image et PDF : inchangés.
- Classeur (xlsx, xls, csv) : **aperçu du tableau dans Relvo**, plein écran, avec ses onglets ;
  une bibliothèque de lecture Excel entre au projet (la même lecture servira à M8).
- Tout autre fichier, ou aperçu en échec : un écran qui dit le nom, le type et le poids, avec
  **« Ouvrir avec… »** (la feuille de partage de l'appareil) et **« Télécharger »** sous le vrai
  nom du fichier. Jamais de page blanche, jamais d'échec muet.

**Livré (2026-11-11).**
- **Le geste se choisit au type** (`lib/pieces.ts`, `genreDePiece`) dans
  `components/shared/attachment-viewer.tsx`, sans étape entre le tap et l'écran. Un classeur se
  reconnaît à son **nom** d'abord : une pièce d'e-mail arrive souvent typée « flux d'octets ».
- **L'aperçu d'un classeur** (`components/shared/piece-ecran.tsx`) : plein écran, une puce par
  feuille, colonnes lettrées et lignes numérotées qui restent en place quand on défile, nombres
  et dates écrits à la française. Les feuilles masquées sont passées ; un classeur très long est
  coupé, et l'écran dit ce qu'il montre sur ce que la feuille compte.
- **L'écran du fichier**, pour tout autre fichier et tout aperçu en échec : nom, type dit en
  clair, poids, la **raison** (type non affiché, classeur illisible, protégé, vide, trop lourd,
  fichier disparu), « Ouvrir avec… » et « Télécharger » sous le vrai nom.
- **Le fichier est lu par le serveur** (`server/pieces.ts`, routes `/apercu` et `/contenu` des
  pièces jointes et des connaissances) : le bucket ne porte **aucune règle CORS** — sondé, pas
  supposé (`PITFALLS.md` #77). L'aperçu est calculé côté serveur ; les octets du partage sont
  plafonnés à **4 Mo**. Le fichier se charge **à l'ouverture de l'écran**, pour que le tap sur
  « Ouvrir avec… » partage dans le geste.
- **Le lecteur** : `@relvo/storage/classeur` (SheetJS 0.20.3, embarquée ; choix motivé dans
  `ecarts`), et une lecture bornée `read` au contrat du stockage — ce que M8 reprendra.
- **Partout où une pièce se touche** : conversation et détail d'un message (`AttachmentPreview`),
  documents d'un sujet (`DocumentRow`), et les **connaissances d'un dossier**, qui ne s'ouvraient
  pas du tout (`ConnaissanceRow`).

**Vérifié.** Typage, lint, tests (le lecteur sur xlsx, xls, csv, encodages, coupes, fichiers
illisibles ; les règles de l'écran). Rendu headless à 390 × 844 : classeur à cinq feuilles,
fichier sans aperçu, aperçu en échec, fichier trop lourd. Lecture par le serveur éprouvée contre
le vrai stockage ; lecture directe refusée, constatée dans un navigateur.

**Reste au dirigeant, sur l'iPhone, en application installée** — rien de ceci ne se vérifie
ailleurs :
1. l'**aperçu** de « TASTY CRA 2026.xlsx » depuis la conversation, et le défilement du tableau ;
2. **« Ouvrir avec… »** : la feuille de partage s'ouvre au premier tap et propose Excel, Numbers
   ou Fichiers ;
3. **« Télécharger »** : le fichier arrive sous son vrai nom sans quitter Relvo ;
4. que **Relvo ne reste plus blanc** au retour ;
5. un fichier de **plus de 4 Mo** : l'écran doit le dire et « Télécharger » aboutir.

**Ce qui n'a pas bougé, et se verra.** Un **PDF** part toujours au volet du navigateur
(décision) : si Relvo reste blanc au retour d'un PDF, c'est le même défaut par l'autre porte, à
remonter. Et le **dépôt d'une connaissance** envoie le fichier du navigateur au stockage : sans
règle CORS, ce dépôt ne peut pas aboutir — **à vérifier en production**, c'est hors de R18.

### R21 — Un e-mail à quatre pièces jointes n'en montre qu'une

**Constat (dirigeant, 2026-11-11, en éprouvant R18).** Un e-mail envoyé avec quatre pièces
jointes n'en affiche qu'une dans la conversation, et aucune dans l'onglet Documents du sujet.

**Causes, deux, distinctes.** La conversation ne rendait que la **première** pièce d'un message
(`toThreadMessageData`), en renvoyant le reste à une fiche de message qui n'existe plus.
L'onglet Documents, lui, ne liste que les pièces dont le message a été capté par le sujet **à la
réception** : un sujet né après n'en hérite pas.

**Livré (2026-11-11).** Un message montre **toutes** ses pièces, e-mail comme messagerie
(`AttachmentList`). Chaque pièce porte l'**icône de son type** (`PieceIcone`) — PDF rouge,
classeur vert au tableau, document bleu, présentation orange, les autres en gris à leur forme —
dans la conversation, les documents d'un sujet, les connaissances d'un dossier et l'écran du
fichier. **L'onglet Documents, corrigé le même jour.** Tranché (`ecarts`, « Les documents d'un sujet
sont les pièces de ses conversations, par référence ») : il liste toutes les pièces des
conversations du sujet, on n'y dépose rien. Diagnostiqué en base de production, en lecture
seule : les pièces étaient stockées et leur message rangé, mais le balayage d'une conversation
vers un sujet ne les emportait jamais (ordre de deux mises à jour, `PITFALLS.md` #78) — 860
pièces sur huit comptes. Le balayage est corrigé, et l'onglet lit désormais le sujet du
**message** : les pièces déjà reçues reparaissent sans reprise de données. Le journal d'un
sujet, jugé inutile, est noté dans `ecarts`.

### R19 — Relvo ne retrouve pas un message et en affiche des dizaines sans rapport

**Constat.** Le testeur demande à Relvo de retrouver le message d'Olivier lui demandant un retour
sur la sauce curry, puis d'y répondre. Relvo affiche une quarantaine de messages sans lien avec
la personne ni le contexte (rapports d'activité, comptes rendus de réunion), ne trouve pas, puis
propose le message d'un autre contact sur le seul mot « oublie ». Le message existe : la vidéo le
montre dans WhatsApp, reçu la veille.

**Causes, trois, distinctes.**
1. **Le message n'est probablement pas dans Relvo** : sur la vidéo, les conversations WhatsApp
   du compte s'arrêtent au 22 octobre alors que ses e-mails sont à jour. Non prouvé sans accès à
   la production — c'est R20.
2. **La recherche est rigide puis trop large** : `searchMessages` exige chaque mot tel quel
   (`contains`), sans classement ; quand rien ne sort, le modèle relâche ses critères et reçoit
   des messages récents quelconques. Un prénom n'est jamais rapproché d'un contact.
3. **L'écran montre toutes les tentatives** : chaque appel de recherche se rend en cartes dans
   le fil (`relvo-fil.tsx`), avant la phrase de Relvo.

**Tranché — cinq points, dans cet ordre.**
1. **N'afficher que ce que Relvo retient** : une recherche intermédiaire est une ligne discrète ;
   seuls les messages que Relvo désigne dans sa réponse se rendent en cartes.
2. **La personne avant le texte** : le nom dit devient un contact, puis ses conversations, tous
   canaux confondus ; plusieurs homonymes, Relvo demande lequel.
3. **Classer par pertinence** : recherche plein texte de la base, en français, sans accents ni
   pluriels bloquants ; ce qui porte le plus de mots demandés sort en premier. Pas de vectoriel
   (invariant 29) — le mécanisme existe déjà pour les sujets.
4. **Le contexte d'un message trouvé** : ses voisins dans la conversation, pour que Relvo vérifie
   qu'il tient le bon avant de répondre.
5. **Le cas au banc d'essai** (`eval:echange`) : une personne, un contexte, un canal, et un
   message que le mot à mot manque.

**Livré (2026-11-11).**
- **Le fil** (`relvo-fil.tsx`) : une recherche aboutie — ou plusieurs de suite — est **une ligne
  grise** (« J'ai cherché dans vos messages : Olivier Garnier · sauce curry retour. ») ; les
  cartes ne viennent que de `show_messages`, l'outil par lequel Relvo **désigne** ce qu'il
  retient. Le socle de l'échange le lui dit : un message qui ne partage qu'un mot, ou qui vient
  d'un autre, ne se propose pas ; introuvable, il le dit sans rien montrer.
- **La personne** (`trouverPersonnes`, `resoudrePersonne`) : `search_messages` prend `personne`
  à la place d'`expediteur`. Un nom se résout en fiche de l'annuaire **ou** en expéditeur sans
  fiche (un contact ne naît qu'à l'ouverture d'un sujet), accents indifférents ; les adresses et
  numéros d'un même nom font une personne ; plusieurs candidats, Relvo demande. La recherche se
  borne à ses messages et à ses conversations, tous canaux ; ses derniers messages remontent
  même sans mot porté.
- **Le classement** : colonne `messages.search_vector`, tenue par le trigger
  `messages_search_vector` (objet, expéditeur, texte ; chaque texte indexé tel quel et sans
  accents, par la fonction `sans_accents` — sans extension à installer), index GIN, messages
  existants remplis par la migration. Un mot porté suffit à remonter, le plus de mots sort en
  premier, puis le plus récent ; `motsPortes` dit à Relvo lesquels.
- **Les voisins** : `get_message` rend un message en entier et trois messages de chaque côté.
- **Le banc d'essai** : `eval:echange` sait vérifier **ce qui est montré** (`attendu.montre`).
  E24 — le message WhatsApp d'Olivier, sans fiche, « sauces currys », « gouter », avec un rappel
  d'une autre qui partage « oublie » et « retour » — et E25 — personne de ce nom, rien montré.
  Le jeu de démonstration porte les trois messages. Joués le 2026-11-11 avec E8, E11, E12, E17 :
  six sur six.
- `05` §11.6 (« Retrouver un message »), `02` (le trigger), `PITFALLS` #68 étendu.

**Ce que ça ne règle pas.** Le message de la vidéo n'était sans doute pas entré (R20) : une
recherche juste ne retrouve pas ce que le canal n'a pas reçu.

### R20 — WhatsApp semble ne plus entrer sur le compte du testeur depuis le 22 octobre

**Constat.** Vu sur la vidéo de R19 seulement. **À vérifier par le dirigeant** : l'état du canal
WhatsApp de ce compte (Canaux, backoffice), puis la date du dernier message WhatsApp reçu. Si le
canal est tombé sans que rien ne le dise, c'est un défaut à part : un canal qui n'écoute plus
doit se voir.

**Complément du 2026-11-11.** Le testeur dit que Relvo se déconnecte parfois de son WhatsApp ;
le dirigeant regarde le backoffice chaque jour et voit le canal connecté. Les deux sont
compatibles, et **rien aujourd'hui ne permet de trancher** :
- l'état du canal est **écrasé en place** (`setChannelConfigStatus`), sans historique ni entrée
  au journal ; un canal en erreur **repasse connecté tout seul** au premier message livré
  (`confirmChannelConnected`). Une coupure de quelques heures ne laisse aucune trace ;
- les journaux de l'hébergeur ne remontent que sur quelques jours, ne disent pas quel compte un
  webhook concerne, et sont noyés sous deux avertissements de Node classés en erreur.

**Proposé, pas urgent.** Tracer chaque changement d'état d'un canal (avant, après, libellé brut
du fournisseur, horodatage) ; dire le compte et le type d'événement dans la ligne de journal du
webhook ; montrer au backoffice, par canal, la date du **dernier message reçu** et les derniers
changements d'état ; prévenir le dirigeant du compte quand un canal tombe.

## Où on en est

- [x] R18 livrée (2026-11-11) : un fichier s'ouvre dans Relvo — à éprouver sur l'iPhone par le
      dirigeant (aperçu, « Ouvrir avec… », « Télécharger », retour sans écran blanc).
- [x] R21 livrée (2026-11-11) : toutes les pièces d'un message, et l'icône de leur type ; l'onglet
      Documents est tranché (toutes les pièces des conversations, par référence).
- [x] Onglet Documents d'un sujet : les pièces des conversations y paraissent toutes
      (2026-11-11) — à constater par le dirigeant sur « Alpha Test ».
- [x] R19 livrée (2026-11-11) : la personne d'abord, le texte classé, un message relu avec ses
      voisins, et le fil ne montre que ce que Relvo désigne — à éprouver par le dirigeant
      (« retrouve le message de … sur … »).
- [x] R19, retour du dirigeant (2026-11-11) : la carte d'un message trouvé ouvrait la conversation
      en bas du fil ; elle mène maintenant au message, surligné, chargé même hors des récents.
- [ ] R20 à vérifier en production par le dirigeant.
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
- [x] M23 terminée ; M27 (dossiers et sujets, tranché sur maquettes) démarrée dans son propre chantier (`2026-10-m27-dossiers-et-sujets.md`), avant M24 — **terminée le jour même**.
- [x] R10 et R11 livrées (2026-11-01) ; R10 reprise le jour même sur le retour du dirigeant
      (vibreur, écran d'écoute) — à éprouver sur le téléphone.
- [x] R17 livrée (2026-11-01) : les échanges de Relvo, séparés de la discussion — tranchée sur
      canevas, à juger à l'usage ; R9 tombe avec.
- [ ] R12 à livrer (R9 est couverte par R17).
- [x] Troisième vague enregistrée, livrée et **validée en production par le dirigeant** (R13 à
      R16) ; R15 tranchée C puis ramenée à 18 px, puis 16 px à l'essai ; R16 reprise sur son retour.
- [x] `wa:reparer` : le dirigeant a choisi de ne pas réécrire l'historique des testeurs — les
      fantômes restent, le script reste disponible ; R14 reprise pour tenir avec eux (2026-11-01),
      à revérifier en production par le dirigeant.
- [ ] Vagues de recette suivantes : à ajouter ici.
