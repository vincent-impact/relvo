# Chantier « Relvo lit le courrier récent dès la connexion » — M7 tranche 10, 20 octobre 2026

## Démarrage à froid — à lire en premier

**Où on en est.** M22 est terminée (la dictée), M21 (le backoffice) et M10 (l'échange) aussi.
L'alpha ouvre le 21 octobre. **M7 est en `partiel` depuis le 2026-09-20** : ses neuf premières
tranches sont en production, la **tranche 9** lit le courrier récent **la nuit** — la connexion
d'un canal e-mail pose une demande (`channel_catchups`), le cron de deux heures importe
l'historique depuis Unipile et trie en lot, sous trois plafonds (trois cents messages, deux
euros, trois nuits). Ce fichier est le plan de la **tranche 10** (M7.19, révision décidée le
2026-09-20 : « Le rattrapage commence à la connexion, pas la nuit ») et, parce que c'est elle qui
fait naître le premier échange avec Relvo, il porte aussi **M13.2** (la prise en main par
l'échange) et **M17.10** (les domaines proposés). C'est le « où on en est » du dépôt le temps du
chantier. Ensuite : M7 se clôt (ses tranches 8, 9 et 10 vérifiées sur le compte du dirigeant).

**Ce qui existe et ne se refait pas.** Le domaine du rattrapage (`packages/db/src/domain/catchup.ts`),
le pipeline (`server/ia/pipeline/rattrapage.ts`, règles pures dans `rattrapage-regles.ts`), la
constante `RATTRAPAGE` (`server/ia/config.ts`), le cron `/api/cron/catch-up`, la carte vivante
(`components/shared/carte-vivante.tsx`, consommée par Canaux et par l'échange), les questions de
Relvo en formulaires (`questions-relvo.tsx`, `domain/questions.ts`, badge du dock, `notifierQuestion`),
le script en texte fixe (`SCRIPT_PRISE_EN_MAIN` : le métier, la première règle, posé à l'ouverture
de l'échange, idempotent), la première connexion en diapositives (M19.9). Le pipeline pose un
**domaine proposé** (`Subject.proposedFolder`) quand aucun domaine ne convient.

**Ce que le chantier livre, en trois tranches**, chacune vérifiable seule :

1. **La lecture dès la connexion** (M7.19) — le webhook de fin de connexion lance la première
   tranche ; chaque tranche importe ce que l'agrégateur a synchronisé, trie **du plus récent au
   plus ancien**, puis enchaîne la suivante ; la ligne se clôt quand le courrier est épuisé ou au
   garde-fou ; le cron devient un filet ; l'avancement se lit en fraction dans la carte vivante ;
   une tranche morte est reprise quand l'application se rouvre.
2. **Le premier échange scripté** (M13.2) — la première règle avec son nouvel exemple, la question
   de fin de lecture qui rappelle le dirigeant (badge, notification), les explications en texte
   fixe au fil de la carte, les affaires du moment sous la carte, la ligne discrète de l'accueil
   quand on quitte l'échange avant la fin, l'outil de lecture « où en est la lecture ».
3. **Les domaines** (M17.10) — les domaines typiques des secteurs à cocher pendant la lecture, et
   la suggestion de créer un domaine dès que deux affaires partagent la même proposition,
   acceptée d'un geste depuis l'échange, les affaires reclassées dans la même transaction.

## Tranché avec le dirigeant avant la première ligne de code (le 2026-10-20)

1. **Périmètre entier** : M13.2 et M17.10 sont livrés ici, pas seulement ce que `05 §11.11`
   exige. Leurs lignes se cochent dans leur épique et `ecarts` dit pourquoi.
2. **La fenêtre passe de trente à quatorze jours.** Les tranches trient du plus récent au plus
   ancien : la première impression est la même ; la fenêtre ne décide que de la queue, et la queue
   de la troisième et quatrième semaine est plus souvent réglée qu'en cours — ouverte par Relvo,
   elle ressemble à du bruit. Ce qu'il manquerait (un devis de trois semaines sans réponse, en
   bâtiment) passe par une **porte** : la réponse « Lisez deux semaines de plus » de la question de
   fin de lecture ouvre un second rattrapage sur les jours quatorze à vingt-huit, même mécanique.
3. **La première lecture est large, et mesurée, jamais économe.** Les plafonds de la tranche 9
   n'arrêtent plus une première lecture. Le garde-fou se place loin au-dessus d'une boîte réelle :

   | Réglage | Tranche 9 | Tranche 10 |
   |---|---|---|
   | Fenêtre lue | 30 jours | **14 jours** |
   | Messages par rattrapage | 300 | **5 000** |
   | Euros par rattrapage | 2 € | **10 €** |
   | Reprises | 3 nuits | **120 tranches**, coupe-circuit de boucle seulement |
   | Niveau de service | « flex » (lot) partout | **standard en direct**, « flex » la nuit |

   Aux coûts mesurés (`benchmark-iag.md` §6.10, §6.7, §6.9 : tri 0,18 €, structuration 0,60 €,
   relecture 0,60 € les mille au niveau standard), cinq mille messages lus en entier coûtent
   entre deux et quatre euros ; un rattrapage qui atteint dix euros est un emballement, pas une
   boîte. **En direct le dirigeant regarde** : les tranches lancées par la connexion trient au
   niveau standard (latence deux fois moindre). **La nuit reste pour ce qui dépasse le
   garde-fou** : le cron reprend une ligne arrêtée au plafond, au niveau « flex », à moitié prix,
   avec les mêmes plafonds comptés par nuit, trois nuits au plus — en pratique jamais atteint.
   Le journal d'inférence (`ia:journal`, la fiche du backoffice) mesure ce que la lecture coûte
   sur le compte du dirigeant : **c'est la première mesure réelle que le dépôt attend**
   (`ecarts`, « Mesurer le compte réel du premier utilisateur »), et elle se lit après la
   première connexion en production.
4. **Le courrier vide ou presque.** La ligne ne se clôt « courrier épuisé » qu'après **deux
   passes d'import vides espacées d'au moins dix minutes** — on ignore en combien de temps
   l'agrégateur synchronise l'historique. Pendant ce temps la carte dit « Je n'ai rien trouvé
   encore » ; à la clôture sans affaire, elle dit qu'il n'y avait rien à ouvrir et que chaque
   message qui arrivera sera lu, avec un renvoi vers Canaux pour une autre adresse. Le script
   continue sans le courrier (le métier, les domaines typiques, la première règle n'en dépendent
   pas). **Aucune notification pour une lecture vide.** Sur le compte de démonstration, sans
   compte chez l'agrégateur, la ligne se clôt aussitôt : l'échange montre le script sans carte.
5. **Les phrases du script**, exactes et validées — chaque question est une `RelvoQuestion` de
   portée compte, avec son étape d'origine, sa destination écrite par la même fonction du domaine
   que l'écran, journalisée avec sa provenance ; aucune n'est bloquante :

   1. **Métier** (existante ; secteurs du compte) : « Pour mieux lire votre courrier : dans quel
      métier êtes-vous ? » — « La restauration, l'alimentaire » · « Le bâtiment, les travaux » ·
      « Les deux » · « Un autre métier ».
   2. **Domaines typiques** (nouvelle, après le métier, seulement si le compte n'a que Général ;
      création des domaines par la fonction de la Mémoire) : « Je range vos affaires par domaine.
      Dans votre métier, on trouve souvent ceux-ci. Lesquels gardez-vous ? » Choix multiples puis
      « Garder ceux-là ». Food : Fournisseurs · Équipe · Matériel · Clients · Administratif.
      Bâtiment : Chantiers · Devis · Fournisseurs · Équipe · Administratif. Chaque domaine porte
      une description d'une ligne. Secondaire : « Aucun pour l'instant, on verra avec le courrier ».
   3. **Domaine proposé par le courrier** (nouvelle, posée par la lecture dès que deux affaires
      partagent la même proposition, une question par nom ; création du domaine et reclassement
      des affaires, réversible par les gestes ordinaires) : « Plusieurs affaires parlent de
      « Fournisseurs ». J'en fais un domaine et je les y range ? » — « Oui, créez-le » · « Non,
      pas celui-là » (jamais reproposé) · « Plus tard ».
   4. **Première règle** (existante, **exemple changé** ; instruction dans Général) : « Y a-t-il
      une règle que je dois toujours suivre ? Par exemple « Crée automatiquement une affaire
      urgente quand un client demande la réalisation d'un devis ». » — « Je vous l'écris… » ·
      « Plus tard ».
   5. **Fin de lecture** (nouvelle, posée à la clôture quand au moins une affaire est ouverte ;
      c'est elle qui porte le badge et la notification, invariant 36) : « J'ai fini de lire
      votre courrier : 6 affaires ouvertes, 14 messages mis de côté. Est-ce que ça ressemble à
      votre activité ? » — « Oui, c'est ça » (noté) · « Il en manque » · « Il y en a trop »
      (réponse libre → instruction dans Général) · « Lisez deux semaines de plus » (point 2).

   Les explications ne sont pas des questions : texte fixe au fil de la carte, selon son état.
   Pendant la lecture : « Une affaire, c'est un sujet qui demande quelque chose de vous : un
   devis, une panne, une candidature. J'y range les messages, les tâches et ce que j'en sais. »
   À la question des domaines : « Un domaine regroupe les affaires d'un même périmètre et ce que
   je dois savoir pour les traiter. » À la fin : « Une tâche, c'est ce qu'il reste à faire sur
   une affaire. Vous la cochez, je la retire. »

**Décisions antérieures, à ne pas rouvrir** : le script est scripté, pas généré (`05 §11.11`) ;
l'onboarding se joue dans l'échange, rien n'est bloqué ; l'état vit sur le compte (les questions
et le rattrapage, pas le fil) ; les outils de lecture prennent les critères que le dirigeant dit
(`PITFALLS.md` #68) ; e-mail seulement (A8).

### Règles pour toute la durée du chantier

Celles des sprints précédents : registre de composants (`@shadcn`, par le MCP) avant tout
composant, verdict dans le message du commit ; un test par comportement livré (unitaires dans
`apps/web/test`, sans base ; intégration dans `packages/db/test`) ; un cas d'évaluation par
comportement livré dans le jeu concerné, et **l'annonce de ce qui est rejoué et sur quel
compte** (un cas coûte un tour réel) ; doc et code dans le même commit, conception récrite **en
place** ; frontmatter de l'épique mis à jour dans le commit qui change son état — M7 est
**publique**, aucune autre épique publique n'est « en-cours » aujourd'hui (vérifié) ; pied
`Client:` sur tout `feat`/`fix`, en langage client, à la deuxième personne ; `pnpm changelog`
puis `node scripts/generate-suivi.mjs` avant de pousser (#57) ; aucune mention d'une IA dans les
commits ; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, tests web et base verts ; push sur
`main` après vérification, puis `vercel ls --scope vcc-impact-labs 2>&1` jusqu'à Ready. Serveur
local : `PORT=3100 AUTH_URL=http://localhost:3100 pnpm --filter web dev` ; après une migration,
`pnpm db:generate` **puis redémarrer** (#61). **Toujours rendre avant de montrer** : Chrome
`--headless=new --remote-debugging-port=9333`, 390×844, un contexte neuf par capture, cookie de
session par `curl` sur `/api/auth/csrf` puis `/api/auth/callback/credentials`.

⚠️ **Le rattrapage réel passe par Unipile.** En local, aucune boîte n'est connectée : les états
de la carte se rendent depuis une ligne de rattrapage posée **par les fonctions du domaine**
(jamais par SQL), et l'import se double dans les tests. **Ce qui ne se vérifie qu'en production
sur le compte du dirigeant** : ce que l'agrégateur synchronise et en combien de temps, le coût
réel au journal, la notification de fin de lecture. **Rien n'est poussé qui relance un import sur
un compte réel sans le dire** : le déploiement ne lance rien de lui-même — seule une nouvelle
connexion de boîte, ou le filet sur une ligne restée ouverte, démarre une lecture ; avant tout
déclenchement à la main, le dirigeant est prévenu.

Pièges à relire avant chaque tranche : **#45** (toute écriture de fond invalide le cache du
tenant), **#49** (rien de variable dans le message système ; le parallélisme chauffe le cache
après le premier appel, jamais avant), **#53** (un statut stocké se répare par les faits), **#55**
(l'heure française), **#60** (une action qui change l'état d'un layout ne redirige pas), **#61**,
**#68**, **#30** (une route `/api` vérifie son secret elle-même).

## Tranche 1 — La lecture dès la connexion (M7.19)

### Le modèle (migration additive, `02` récrit dans le même commit)

`channel_catchups` gagne : `tranche_started_at` (le **verrou** : une tranche à la fois par ligne,
posé par une mise à jour conditionnelle — null ou plus vieux que la durée maximale d'une
fonction —, jamais par un `SELECT` puis un `UPDATE`), `last_tranche_at` (ce que le filet et la
reprise regardent), `empty_rounds` (passes d'import vides consécutives), `candidates_total` (les
candidats au moment où l'import se ferme, pour lire l'avancement en fraction), `service_level`
(`standard` ou `flex`, ce que la ligne trie en ce moment). La colonne `runs` reste et compte
désormais les **tranches** (son commentaire change) ; `stop_reason` connaît `tranches-epuisees`
à la place de `nuits-epuisees`. `CatchupStatus` ne change pas.

### Les règles pures (`rattrapage-regles.ts`, testées sans base)

- `estHistorique(dateIso, requestedAt)` : un message daté **d'avant la demande de rattrapage**
  est de l'historique synchronisé ; la règle des six heures disparaît (`delaiWebhookMs` retiré).
- `motifDArret(etat)` : plafond de messages, d'euros, de tranches ; les plafonds viennent de
  `RATTRAPAGE` (14 jours, 5 000, 10 €, 120 tranches, `pageImport`, `salveTri`, `parallele: 3`,
  `attenteSyncMs: 10 min`, `relanceApresMs: 6 min`).
- `peutClore({ importVide, emptyRounds, requestedAt, now, restants })` : deux passes vides
  consécutives **et** dix minutes depuis la demande **et** aucun candidat restant.
- `estEnPanne({ status, lastTrancheAt, trancheStartedAt, now })` : une ligne ouverte dont la
  dernière tranche date de plus de `relanceApresMs` et sans verrou vivant — ce que la reprise et
  le filet relancent.

### Le domaine (`catchup.ts`, testé contre la base)

- `claimCatchupTranche(db, id)` : pose le verrou et incrémente `runs`, ou rend null si une
  tranche vit déjà ; `releaseCatchupTranche` le lève et pose `last_tranche_at`.
- `listCatchupCandidates` trie **du plus récent au plus ancien** (l'ordre s'inverse, le test
  aussi) ; `recordCatchupProgress` gagne `candidatesTotal`, `emptyRounds` (remise à zéro quand
  une passe importe), `serviceLevel`.
- `hasOpenCatchup(db, channelId)` et `getOpenCatchup(db, channelId)` pour le webhook et les pages.
- `listStaleCatchups()` hors tenant (comme `listDueCatchups`) : les lignes en panne, pour le filet.
- `finishCatchup` : `capped` garde ses motifs ; une ligne arrêtée au plafond **en direct** reste
  reprenable la nuit (statut `capped`, `service_level` passe à `flex` à la reprise ; les
  compteurs du plafond repartent de zéro par nuit, trois nuits au plus — le compteur de nuits
  est le nombre de reprises nocturnes, journalisé).

### Le pipeline (`rattrapage.ts`)

- `executerTranche(catchupId, chrono)` : verrou → **import** (pages depuis l'agrégateur, ceux
  déjà en base non relus, ingestion ordinaire, pièces jointes, `expireTenantData`) → si rien
  n'est importé et que la ligne n'est pas clôturable, la tranche **attend** (une minute) et
  réessaie l'import tant que son budget le permet → **tri** des candidats, du plus récent au plus
  ancien, par salves ; **la première conversation seule** (elle chauffe le cache, #49), puis
  **trois en parallèle** ; au niveau de service de la ligne → avancement → **clôture** (courrier
  épuisé, plafond) ou **enchaînement** de la tranche suivante → verrou levé.
- `lancerTranche(catchupId)` : un `POST /api/rattrapage/tranche` avec le secret du cron ; la
  route répond **202 aussitôt** et travaille dans `after()` (`maxDuration = 300`) ; l'appelant
  n'attend que le 202. Même secret que le cron, vérifié en première ligne (#13, #30).
- Le **webhook** de fin de connexion demande le rattrapage (quatorze jours) puis lance la
  première tranche. Le webhook de **réception** : un message daté d'avant la demande d'un
  rattrapage ouvert sur le canal est rangé et laissé à la tranche ; sans rattrapage ouvert, ou
  daté d'après, il est trié au fil de l'eau comme avant. Le courrier vivant n'attend jamais.
- La **reprise** : la page de l'échange et la page des canaux, quand elles voient une ligne en
  panne, relancent une tranche dans `after()` — c'est ce qui reprend après la fermeture de
  l'application sans attendre la nuit. Le **cron** devient le filet : il relance les lignes en
  panne et reprend les lignes `capped` au niveau « flex », sous son budget ; il ne fait rien dans
  le cas normal.

### La carte vivante

Phrases récrites pour la lecture en direct : `pending` → « Je commence à lire le courrier des
deux dernières semaines de {boîte}. » ; `running` → « Je lis le courrier des deux dernières
semaines de {boîte}. » avec, dès que l'import est fermé, « {lus} messages lus sur {total} » (la
fraction), sinon « Je ne connais pas encore le total » ; « Je n'ai rien trouvé encore. » tant
que rien n'est importé ; `done` → « J'ai lu le courrier récent de {boîte}. Le reste arrive au
fil de l'eau. » ou, sans affaire, la phrase du point 4 ; `capped` → « J'ai lu jusqu'au garde-fou.
Je continuerai cette nuit. » ; `failed` → « La lecture s'est interrompue ; je reprends dans
quelques minutes. ». La carte reste la même primitive, Canaux et l'échange la partagent.

### Tests et vérification

- Unitaires (`ia-rattrapage.test.ts`) : l'historique par la date de la demande ; les motifs
  d'arrêt avec les tranches ; la règle de clôture (deux passes vides, dix minutes, zéro
  restant) ; la panne ; un appel en direct ne demande aucun niveau de service, un appel de nuit
  demande « flex ».
- Intégration (`catchup.test.ts`) : le verrou (deux prises concurrentes, une seule gagne) ; les
  candidats du plus récent au plus ancien ; `hasOpenCatchup` ; les lignes en panne ;
  `candidatesTotal` et `emptyRounds` ; la reprise nocturne d'une ligne `capped`.
- Aucun comportement du modèle ne change : pas de cas d'évaluation nouveau ; **la mesure est le
  journal sur le compte du dirigeant**.
- Headless (compte de démonstration, ligne posée par le domaine) : les états de la carte dans
  l'échange et dans Canaux, la fraction. **Production** : connecter une boîte sur le compte du
  dirigeant, voir la carte monter, relire `ia:journal` et la fiche du backoffice.

### Clôture de la tranche 1

M7 en `statut: en-cours` dans le premier commit (fin projetée au 2026-10-23, corrigée à la
clôture). `05 §9.6` récrit en place (les tranches, le direct, le filet, le garde-fou sans
chiffre) ; `02` (`ChannelCatchup`) ; `ecarts` : « La première lecture est large : quatorze
jours, le garde-fou loin au-dessus d'une boîte, le direct au niveau standard, la nuit en lot »
(les valeurs y vivent) ; `README.md` (`CRON_SECRET` : le filet et la route de tranche) ;
`CLAUDE.md` (la commande de déclenchement à la main) ; `PITFALLS.md` si un piège a coûté une
session.

## Tranche 2 — Le premier échange scripté (M13.2)

- **Le script** (`domain/questions.ts`) : l'exemple de la première règle changé ; l'étape de
  **fin de lecture** (`prise-en-main/fin-de-lecture/<catchupId>`, une par rattrapage), posée par
  la clôture d'une ligne quand au moins une affaire est ouverte, avec ses compteurs dans le
  texte ; ses destinations : « Oui » noté ; « Il en manque » et « Il y en a trop » ouvrent la
  réponse libre, qui devient une instruction dans Général ; « Lisez deux semaines de plus »
  demande un rattrapage sur les jours quatorze à vingt-huit (l'action lance la tranche). La
  notification (`notifierQuestion`, M12.9) part à la pose de cette question, par le pipeline.
- **Le script naît à la connexion**, pas seulement à l'ouverture de l'échange : le webhook de
  fin de connexion appelle `ensureOnboardingQuestions` après la demande — le badge s'allume
  avant que le dirigeant n'ouvre l'échange. Le même script rejoue, plus court, à chaque canal :
  les étapes `applicable` le tiennent déjà.
- **L'échange** : un composant `PriseEnMain` (composé de `CarteVivante`, `RelvoBlock`,
  `RelvoSentence`, `SubjectRow` — registre interrogé, verdict attendu « composer ») qui rend la
  carte, l'explication de l'état, puis **les affaires du moment** : les affaires nées depuis la
  demande de rattrapage, les plus récentes d'abord, rendues par `SubjectRow`, cinq au plus, avec
  « Toutes les affaires » vers `/fil`. Les questions ouvertes se posent en dessous, comme
  aujourd'hui. Rafraîchissement par `PollRefresh` tant que la ligne est ouverte.
- **La ligne discrète de l'accueil** : une règle de `getBriefSuggestions` — « Je lis encore votre
  courrier : {lus} messages lus, {ouvertes} affaires ouvertes » — qui ouvre l'échange ; au plus
  deux suggestions, la question en attente comprise (`05 §11.12`).
- **L'outil de lecture** `get_mail_reading` (`05 §10.3`, #68) : « Où en es-tu de la lecture de
  mon courrier ? » — critère optionnel : la boîte ; rend l'état, les compteurs, la fraction, la
  raison d'arrêt. Cas **E19** dans `eval:echange` (rejoué sur le compte de démonstration, un
  tour).
- Tests : `questions.test.ts` (la fin de lecture, ses quatre destinations, une par rattrapage,
  le script rejoué plus court) ; `brief.test.ts` (la règle de l'accueil) ; `ia-echange.test.ts`
  (l'outil et ses critères).
- Headless : l'échange sur le compte de démonstration avec une ligne posée par le domaine, les
  cinq états, la question de fin, les affaires sous la carte ; l'accueil avec la ligne.
- Docs : `05 §11.11` relu contre le code ; `04 §10` (`RelvoQuestion`, la fin de lecture) ;
  épique **M13** : M13.2 cochée, `ecarts` dit pourquoi ici ; `CLAUDE.md` (la table des routes :
  `/relvo` porte la prise en main).

## Tranche 3 — Les domaines (M17.10)

- **Les domaines typiques** : la matière vit dans le domaine (`domain/prise-en-main.ts`,
  `DOMAINES_TYPIQUES` par secteur, nom et description d'une ligne) — c'est une donnée de
  création, pas une consigne au modèle. L'étape `prise-en-main/domaines-typiques` se pose après
  le métier, si le compte n'a que Général ; réponse **multiple** : `answerQuestion` accepte
  `keys[]`, la destination crée chaque domaine coché par `createFolder` (la fonction de la
  Mémoire), journalisé. Le formulaire à choix multiples se **compose** sur `EtapeFormulaire`
  (options qui se cochent, puis « Garder ceux-là ») — registre interrogé d'abord (`checkbox`,
  `toggle-group`), verdict dans le commit.
- **Les domaines proposés par le courrier** : `listFolderProposals(db)` (`domain/folders.ts`) —
  les affaires ouvertes ou validées sans domaine, groupées par `proposedFolder`, deux au moins,
  les noms écartés exclus (une question écartée d'origine `domaine-propose/<slug>`) ;
  `createFolderFromProposal(db, { name }, origine)` crée le domaine et reclasse ces affaires par
  `updateSubject`, dans une transaction, journalisé ; la proposition reste sur l'affaire —
  supprimer le domaine la fait réapparaître (réversible par les gestes ordinaires). Les questions
  naissent **par la lecture** (après chaque salve, `ensureFolderProposalQuestions`) et à
  l'ouverture de l'échange (les propositions du fil de l'eau aussi). Pas d'encart nouveau dans
  la Mémoire : la question dans l'échange et le badge suffisent ; la Mémoire montre le résultat.
- Tests : `folders.test.ts` ou `questions.test.ts` (le groupement, les écartés exclus, la
  création reclasse, la suppression rend la proposition, la réponse multiple) ; un cas du jeu
  de structuration où aucun domaine du compte ne convient et une proposition est attendue
  (`jeu/demo/cas.jsonl`, rejoué sur un cas, compte de démonstration) — à vérifier que le lanceur
  lit `domaine_propose`, sinon il l'apprend.
- Headless : la question des domaines typiques avec ses choix multiples ; une proposition née de
  deux affaires posées par le domaine, acceptée, les affaires reclassées dans la Mémoire.
- Docs : `05 §9.6` et `04 §10` (Folder) relus ; épique **M17** : M17.10 cochée, `ecarts`
  (« Suggérer les domaines à la prise en main » passe à tranché, pourquoi ici).

## Clôture du chantier

M7 en `statut: termine` avec sa date de fin réelle, quand les tranches 8, 9 et 10 ont été
vérifiées sur le compte du dirigeant en production ; M10.16 n'a plus de reliquat (épique M10
relue) ; les pièges remontés ; `conception/` sans phrase datée.

## Où on en est

- [x] Plan validé par le dirigeant le 2026-10-20 (périmètre entier, quatorze jours, courrier
      vide, les phrases du script avec le nouvel exemple de la première règle).
- [x] **Tranche 1 livrée** — migration additive `20261020100000_m7_rattrapage_tranches` (verrou,
      dernière tranche, passes vides, total des candidats, niveau de service, nuits) ; règles
      pures (`estHistorique` par la date de la demande, `motifDArret` en tranches, `peutClore`,
      `estEnPanne`) ; domaine (`claimCatchupTranche` par mise à jour conditionnelle,
      `releaseCatchupTranche`, `resumeCatchupAtNight`, `getOpenCatchup`, `listOpenCatchups`,
      `findCatchupForTranche`, candidats du plus récent au plus ancien) ; pipeline
      `executerTranche` (import avec attente de synchronisation, tri en direct au niveau
      standard — la première seule puis trois en parallèle —, clôture ou enchaînement) ; route
      `POST /api/rattrapage/tranche` (202, travail dans `after()`) ; le webhook de connexion
      lance la première tranche, le webhook de réception laisse à la tranche un message daté
      d'avant la demande ; `/relvo` et `/canaux` relancent une ligne en panne ; le cron n'est
      qu'un filet (lignes en panne, lignes arrêtées au garde-fou reprises en « flex ») ; la carte
      vivante dit la fraction, « rien trouvé encore », le garde-fou, le vide. Tests :
      `ia-rattrapage.test.ts` (7), `catchup.test.ts` (6, dont le verrou concurrent).
      **Vérifié en headless** (compte de démonstration, ligne posée par le domaine) : les états
      en attente, en cours, fraction, garde-fou, terminé, vide, dans l'échange et dans Canaux ;
      la route refuse sans secret (401) ; **une tranche réelle** jouée par la route sur la ligne
      de démonstration : un fil trié au niveau standard (une sollicitation, 0,0006 €, mis en
      sourdine), ligne close « courrier épuisé », verrou levé, aucune tranche enchaînée, journal
      demandé → commencé → terminé. **À vérifier en production sur le compte du dirigeant** :
      ce qu'Unipile synchronise et en combien de temps, la carte qui monte, le coût au journal.
- [x] **Tranche 2 livrée** — le script : l'exemple de la première règle changé ; l'étape de
      **fin de lecture** (`prise-en-main/fin-de-lecture/<rattrapage>`, posée par le pipeline à
      la clôture d'une ligne avec au moins une affaire, notifiée par `notifierQuestion`) avec ses
      quatre destinations (noté ; « Il en manque » et « Il y en a trop » s'écrivent — réponses
      `libre` — et deviennent une instruction de Général ; « Lisez deux semaines de plus » rend
      `lecture-etendue`, l'action demande et lance la lecture suivante sur le même canal) ; le
      script naît au webhook de connexion (`ensureOnboardingQuestions` avant la première
      tranche) ; `PriseEnMain` (carte vivante, explication en texte fixe selon l'état, les
      affaires nées depuis la demande rendues par `SubjectRow`, « Toutes les affaires ») dans
      l'échange, une lecture finie restant montrée deux heures ; la ligne « Je lis encore votre
      courrier » de l'accueil (`getBriefSuggestions`, `kind: "lecture"`, ouvre l'échange sans
      premier tour) ; l'outil `get_mail_reading` (critère : la boîte), rendu en carte vivante
      dans le fil ; cas **E19** dans `eval:echange` — **1/1** sur le compte de démonstration
      (`get_mail_reading`, `{"boite":null}`, tier extraction, 0,0014 €). Tests :
      `questions.test.ts` (la fin de lecture : une par lecture, ses compteurs, jamais vide, ses
      destinations), `brief.test.ts` (la ligne de lecture, en premier, disparaît à la clôture).
      **Vérifié en headless** (démonstration, états posés par le domaine) : l'accueil avec la
      ligne de lecture ; l'échange avec la carte finie, l'explication, les deux affaires, la
      question de fin de lecture et son champ libre ouvert par « Il en manque ». Registre
      interrogé avant `PriseEnMain` : composé de `CarteVivante`, `RelvoBlock`, `SubjectRow`.
      **En production** : la notification de fin de lecture et le script posé au webhook.
- [x] **Tranche 3 livrée** — les domaines typiques des secteurs dans le domaine
      (`prise-en-main.ts` : cinq par secteur, description d'une ligne, logo curé ;
      `domainesTypiquesDe` sans doublon), l'étape `prise-en-main/domaines-typiques` du script
      (après le métier, tant que le compte n'a que Général ; réponses calculées depuis les
      secteurs ; `keys[]` dans la réponse ; chaque domaine coché naît par `createFolder` ;
      « Aucun pour l'instant » ne crée rien ; `OpenQuestion.multiple`) ; le formulaire à choix
      multiples `EtapeChoixMultiples` (registre interrogé : `checkbox` et `toggle-group`
      existent, composé sur l'option d'`EtapeFormulaire` avec la coche à la place du chevron,
      « Garder ceux-là (n) ») ; les propositions du courrier (`listFolderProposals` : groupées
      par slug, deux affaires au moins, les tranchées exclues ; `createFolderFromProposal` :
      crée ou reprend le domaine, range par `updateSubject`, la proposition reste sur
      l'affaire) ; `ensureFolderProposalQuestions` posée par la lecture après chaque salve qui
      ouvre et à l'ouverture de l'échange ; destinations « Oui, créez-le » /
      « Non, pas celui-là ». Lanceur du tri : `--cas` et l'attente `domaine_propose` ; cas
      **demo-025** (le garage, le contrôle technique de l'utilitaire — aucun domaine du
      compte ne convient) → « Véhicules et entretien » proposé, 1/1, un appel réel sur le jeu
      de démonstration. Tests : `domaines.test.ts` (6), `questions.test.ts` relu.
      **Vérifié en headless** (compte admin local, remis à neuf ensuite) : le métier répondu,
      la proposition « Assurances » (2) acceptée → domaine créé, deux affaires rangées ; les
      domaines typiques cochés deux à deux → Fournisseurs et Équipe dans la Mémoire.
      ⚠️ Piège évité : un composant client qui importe une **valeur** de `@relvo/db` embarque
      Prisma dans le navigateur et rend un 500 sur toute l'application (`pg` dans le bundle) ;
      `multiple` est posé par la projection du domaine, le client n'importe que des types.
- [x] Migration `20261020100100_m7_rattrapage_anciennes_lignes` : les lignes de la tranche 9
      arrêtées au plafond ont eu leurs nuits — **le déploiement ne relance aucune lecture** sur
      un compte réel ; seule une nouvelle connexion de boîte démarre une lecture.
- [ ] **Clôture** : vérification en production sur le compte du dirigeant (connecter une
      boîte, la carte qui monte, le coût au journal, la question de fin de lecture et sa
      notification, les domaines proposés) ; alors M7 passe en `termine`.
