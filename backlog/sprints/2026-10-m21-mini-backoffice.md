# Chantier « Mini backoffice » — M21, 19 octobre 2026

## Démarrage à froid — à lire en premier

**Où on en est.** Le socle du push est livré (`ec1f583`), M10 est terminée, M7 reste en pause
sur sa tranche 10. L'alpha ouvre **le 21 octobre** avec des comptes de test que le dirigeant
créera et détruira au fil des essais. Il n'existe aujourd'hui **aucun écran d'administration** :
l'assistant d'un compte se coupe par un script (`ia:assistant`), le coût se lit par un script
(`ia:journal`), et un compte ne se supprime pas autrement qu'en base — ce que la première règle
du dépôt interdit (`ecarts`, « L'assistant s'active par un réglage du compte ; l'administration
viendra avec le backoffice »). Ce fichier est le plan de M21 et le « où on en est » du dépôt le
temps du chantier. M22 (parler à Relvo) suit, puis la tranche 10 de M7.

**Ce que le backoffice est, et ce qu'il n'est pas.** C'est **l'écran des méthodes du domaine
qui existent déjà** — `setAssistantEnabled`, `countOpenQuestions`, `listAiSolicitations` et
`summarizeAiSolicitations`, `listPushSubscriptions` — plus trois méthodes nouvelles, toutes
journalisées : changer un rôle, marquer un compte « test », supprimer un compte. **Aucun
compteur parallèle, aucun SQL direct, aucune console.** Ce n'est pas le disjoncteur par compte
(M14.5), ni les chiffres réels de la page Usage (M18.8), ni la supervision (M14.3) : il les
affichera quand ils existeront.

**Ce qui est tranché avant la première ligne** (le cadrage du 2026-10-19) :

- **La zone `/admin` vit dans `(shell)`, hors du groupe `(app)`** : pas de dock, pas de menu
  latéral — un cadre `MobileFrame` et un header à flèche retour vers l'application, comme
  l'échange plein écran. Elle est gardée **deux fois** : par le proxy (le rôle lu dans le JWT de
  session, edge-safe) et par le layout de la zone (le rôle **relu en base** à chaque rendu — une
  rétrogradation prend effet au rendu suivant, sans attendre que le jeton expire).
- **Le rôle `admin` est celui de l'énuméré `AccountRole`**, déjà présent dans la session (`M2`).
  On n'en crée pas un autre. Il se donne et se retire **par script** —
  `pnpm --filter web admin:role <e-mail> admin|ceo` — qui appelle une méthode du domaine
  journalisée sur le compte visé (`role_changed`, acteur `system`, ancien et nouveau rôle en
  métadonnée). Jamais par la base. ⚠️ Le proxy lit le rôle dans le **jeton** : une promotion
  n'ouvre `/admin` qu'à la **prochaine connexion** du compte promu — le script le dit en sortie.
- **Le backoffice lit les mêmes fonctions que le produit.** Le coût d'un compte est la somme du
  journal des sollicitations (`EVENT_TYPES.iaSollicitation`) relu par `listAiSolicitations` ;
  l'interrupteur est `setAssistantEnabled` ; les questions, `countOpenQuestions` ; les
  appareils, `listPushSubscriptions`. Une lecture par compte et par fonction : le backoffice est
  une page d'exploitation pour une poignée de comptes, pas une page produit — on accepte des
  requêtes en nombre de comptes, **jamais en nombre d'affaires ou de messages**.
- **Ordre de livraison.** Tranche 1 : M21.1 accès, M21.2 liste, M21.4 gestes, M21.6 porte de
  l'alpha — ce qui manque le jour J. Tranche 2 : M21.3 fiche, M21.5 vue d'ensemble — quand les
  premiers vrais appels auront rempli le journal.
- **Suppression = la seule opération irréversible du produit.** Les canaux sont d'abord
  déconnectés chez l'agrégateur (sinon ils continuent d'être facturés et d'envoyer des webhooks
  pour un compte mort), puis la base cascade (toutes les relations de `Account` sont en
  `onDelete: Cascade`), puis les triggers enfilent les clés de fichiers dans l'outbox que le cron
  du matin draine. Pas de corbeille, pas de « soft delete » : un compte de test supprimé
  n'existe plus. **À confirmer, voir ci-dessous.**

### Tranché avec le dirigeant avant la première ligne de code

1. **Suppression définitive, sans corbeille, Unipile d'abord** — « l'objectif du backoffice est
   justement d'optimiser l'espace mémoire et le contrôle de la data ». La trace s'écrit sur le
   compte de l'administrateur ; le sien et la démonstration ne se suppriment pas d'ici ; la
   déconnexion chez l'agrégateur est best-effort, son bilan consigné et affiché.
2. **Inscription libre, activation sur validation de la demande.** Le compte créé par
   l'inscription attend (`activated_at` nul), ne se connecte pas, voit la page d'attente ; le
   backoffice l'ouvre d'un appui et lui envoie un e-mail. **Le compte en attente est la
   demande** : pas de table d'invitations. Google compris, comptes existants ouverts par la
   migration, pas d'interrupteur de configuration.
3. **Une migration** : `accounts.activated_at` (rattrapée à `created_at` pour les comptes en
   place) et `accounts.is_test`.
4. **Bascule dans les deux sens** : entrée « Backoffice » dans le menu latéral pour les
   administrateurs ; depuis la zone, retour à l'application (flèche, pictogramme maison).
5. **Motif de coupure** en métadonnée de `setAssistantEnabled`, acteur `system`.

### Règles pour toute la durée du chantier

Celles des sprints M10 et M12 : registre de composants (`@shadcn`, par le MCP) avant tout
composant ; un test par comportement livré (unitaires dans `apps/web/test`, sans base ;
intégration dans `packages/db/test`) ; doc et code dans le même commit ; frontmatter de
l'épique mis à jour dans le commit qui change son état ; pied `Client:` sur tout `feat`/`fix`
(ici presque toujours `Client: -`) ; `pnpm changelog` puis `node scripts/generate-suivi.mjs`
avant de pousser (#57) ; aucune mention d'une IA dans les commits ; typecheck, lint et tests
verts ; push sur `main` après vérification et `vercel ls --scope vcc-impact-labs` jusqu'à
Ready. Serveur local : `PORT=3100 AUTH_URL=http://localhost:3100 pnpm --filter web dev`.
**Toujours rendre avant de montrer** : Chrome headless (`--headless=new
--remote-debugging-port=9333`, 390×844), cookie de session obtenu par `curl` sur
`/api/auth/csrf` puis `/api/auth/callback/credentials`.

## Tranche 1 — Voir, couper, supprimer, choisir qui entre

### M21.1 — L'accès

- `auth.config.ts` : `ADMIN_ROUTES = ["/admin"]`. Sans session → `/connexion` (inchangé) ;
  session sans rôle `admin` → redirection vers `/` (le callback `authorized` rend une
  `Response`). Le test `auth-deny-by-default.test.ts` gagne ses cas : `/admin` et `/admin/x`
  fermés à un visiteur **et** à une session `ceo`, ouverts à une session `admin`.
- `server/admin.ts` : `requireAdmin()` — `requireAccount()` puis le rôle **relu en base** ;
  sinon `redirect("/")`. Appelé par le layout de la zone et par **chaque** Server Action
  d'administration (une action n'a pas de chemin, le proxy ne la voit pas — #30).
- `app/(shell)/admin/layout.tsx` : `requireAdmin()`, `MobileFrame` sans dock, header de zone
  (`RelvoHeader`, `back="/"`). Pages : `/admin` (liste), `/admin/comptes/[id]` (gestes en
  tranche 1, fiche complète en tranche 2), `/admin/invitations`.
- Domaine `accounts.ts` : `setAccountRole(db, accountId, role, { actor })` — journalisé
  `role_changed` (`EVENT_TYPES.roleChanged`), de/vers en métadonnée ; idempotent.
- Script `apps/web/scripts/admin/role.ts`, commande `admin:role` dans `package.json`, sur le
  modèle d'`activer-assistant.ts`. Sortie : le rôle posé et le rappel « effectif à la prochaine
  connexion ».
- Menu latéral : entrée « Backoffice » pour les administrateurs (`isAdmin` projeté par le
  layout `(app)`).
- Tests : intégration `admin.test.ts` (`setAccountRole` journalise, idempotent) ; unitaire
  (le proxy, ci-dessus).

### M21.2 — La liste des comptes

- Domaine `packages/db/src/domain/admin.ts` (hors tenant, comme `listPushAccounts`) :
  `listAccountsForAdmin({ now })` → une ligne par compte : identité, rôle, `isTest`, création,
  secteurs, assistant actif, **canaux** (nom, type, statut de la config), **affaires ouvertes**
  (`subject.count` statut `open`), **questions ouvertes** (`countOpenQuestions`), **appareils
  push** (`listPushSubscriptions().length`), **dernière activité** (un `groupBy` cross-tenant :
  dernier `EventLog` d'acteur `user` par compte, une requête pour tous), **coût 7 et 30 jours**
  (`listAiSolicitations(tenantDb(id), { since: 30 j })`, la fenêtre de 7 jours découpée en
  mémoire — une lecture, deux chiffres).
- Page `/admin` : cartes empilées (mobile-first), triées par dernière activité ; chaque carte
  mène à `/admin/comptes/[id]`. Composants du registre : `Card`, `Badge`, `Button`, `Input`,
  `AlertDialog`, `Switch` (déjà installés) ; `Table` à vérifier dans le registre si un tableau
  s'impose sur grand écran.
- Tests : intégration — deux comptes, l'un avec un canal, une affaire ouverte, une question, un
  appareil et deux sollicitations (dont une à 20 jours) : les compteurs et les deux coûts sont
  justes, un compte vide rend des zéros.

### M21.4 — Les gestes

- `setAssistantEnabled(db, id, enabled, Actor.system, { motif })` depuis
  `server/actions/admin.ts` (après `requireAdmin()`).
- `setAccountTest(db, id, isTest)` — colonne `is_test`, journalisé (`account_test_marked` /
  `account_test_unmarked`).
- **Supprimer** — `server/actions/admin.ts › deleteAccountAction(id, emailRetape)` :
  1. `requireAdmin()` ; refus si `id` est le compte courant ou `DEMO_ACCOUNT_ID` ; refus si
     l'e-mail retapé ne correspond pas ;
  2. lecture des `externalAccountId` des canaux du compte ; `deleteUnipileAccount` pour chacun,
     échecs collectés ;
  3. `deleteAccount(adminDb, { targetId, unipile: { deconnectes, echecs } })` (domaine
     `admin.ts`) : journalise `account_deleted` **sur le compte de l'administrateur**, puis
     `prisma.account.delete` — la cascade et les triggers font le reste ; l'outbox est drainée
     par le cron du matin (ou à la main).
  La confirmation est un `AlertDialog` du registre avec un champ où l'on **retape l'e-mail** ;
  bouton rouge, libellé « Supprimer définitivement ».
- Tests : intégration — un compte avec canal + config Unipile, conversation, message, pièce
  jointe et document : après `deleteAccount`, plus aucune ligne du tenant, **deux clés dans
  l'outbox**, un événement `account_deleted` sur le compte de l'admin avec l'e-mail en
  métadonnée ; `setAccountTest` journalise ; `setAssistantEnabled` acteur `system` porte le
  motif. Unitaire — les refus (soi-même, démo, e-mail qui ne correspond pas) dans la fonction
  pure de garde.

### M21.6 — La porte de l'alpha

- Colonne `accounts.activated_at` (null = en attente) ; `createAccount({ activated })` ;
  l'inscription crée le compte **non ouvert** et redirige vers `/inscription/attente` (sous
  `/inscription`, déjà publique par préfixe) ; pas de connexion immédiate.
- Connexion : identifiants justes mais accès fermé → `AccesEnAttente` (`CredentialsSignin`,
  code `acces_en_attente`) remontée par Auth.js jusqu'à l'action, qui affiche la phrase juste.
  Google : compte inconnu → création non ouverte, retour `/inscription/attente` ; compte en
  attente → idem.
- Domaine `activateAccount` (journalisé `account_activated`) ; action `adminActivateAction` qui
  envoie « Votre accès à Relvo est ouvert ». Liste : section « À ouvrir » en tête, bouton sur la
  ligne ; fiche : la même carte.
- Tests : intégration (`activateAccount` une fois) ; unitaire (`/inscription/attente` passe sans
  session).

### Clôture de la tranche 1

- Épique M21 : frontmatter `statut: en-cours`, `debut: 2026-10-19` au premier commit ; items
  M21.1, M21.2, M21.4, M21.6 en ✅.
- `CLAUDE.md` : table des routes (`/admin`, hors nav, administrateurs), Architecture (la zone
  d'administration dans `(shell)`, hors `(app)`), Commandes (`admin:role`). `README.md` :
  la commande. `ecarts` : « Le mini backoffice : l'écran des méthodes du domaine », avec la
  suppression définitive et la porte de l'alpha. `04-design-domaine.md` : le périmètre
  (administration, invitation).
- Vérification headless (faite) : `/admin` renvoie un `ceo` vers `/` ; la liste et la fiche
  rendent avec le compte de démonstration ; une inscription atterrit sur la page d'attente, sa
  connexion affiche « Votre accès n'est pas encore ouvert » ; la demande apparaît « À ouvrir »,
  s'ouvre d'un appui, la connexion passe ensuite ; la suppression fait retaper l'adresse, renvoie
  sur la liste, la fiche rend 404 et la connexion échoue ; le menu porte « Backoffice ».
- Production : le dirigeant promu par `admin:role` sur la base de production (variable
  `DATABASE_URL` pointée le temps du script), reconnexion, `/admin` depuis l'iPhone.

## Tranche 2 — La fiche et la vue d'ensemble

### M21.3 — La fiche d'un compte

- `/admin/comptes/[id]` : la synthèse `summarizeAiSolicitations` rendue en page — par
  sollicitation : appels, euros, jetons d'entrée, cache relu contre attendu, sortie et
  raisonnement, latence, silencieux (ce que `ia:journal` imprime, en cartes) ; le journal de
  bord récent (50 dernières entrées, `ActorPill`) ; les rattrapages (`channel_catchups`) ; les
  appareils push ; les questions ouvertes.
- **Tours en échec** : `EchecSollicitation` n'écrit rien au journal aujourd'hui — ajouter
  `logAiFailure` (`EVENT_TYPES.iaEchec` : sollicitation, tier, modèle, raison, durée) au site
  d'appel du client d'inférence ; la fiche les compte et les liste. Test unitaire (le client,
  doublé) et d'intégration (la ligne écrite).
- Tests : la projection de la fiche (intégration) ; `lireLigne`/synthèse déjà couverts.

### M21.5 — La vue d'ensemble

- En tête de `/admin` : coût d'inférence du **mois en cours** contre le **plafond de la clé**
  (constante de configuration `OPENAI_PLAFOND_MENSUEL_EUR`, défaut 100, dans `.env.example`),
  appels et silencieux du mois, **comptes actifs sur 7 jours** (dernière activité), **échecs** :
  `triage_failed` / `structuration_failed` / `relecture_failed` / `ia_echec` sur 7 jours,
  entrées de l'outbox en attente (`countPendingFileDeletions`), rattrapages en échec.
- Domaine `admin.ts › getAdminOverview({ now })` — chaque chiffre vient d'une fonction qui
  existe ou du journal, jamais d'un compteur tenu à part.
- Tests : intégration (les agrégats sur un jeu de trois comptes).

### Clôture de M21

- Items M21.3 et M21.5 en ✅ ; frontmatter `statut: termine`, `fin`. `CLAUDE.md` : le Bilan et
  l'Usage restent en démonstration (inchangé) — l'administration, elle, lit le vrai journal.
  Ce fichier : « où on en est » final, suivant = M22.

## Où on en est

- [x] Plan validé par le dirigeant le 2026-10-19 (les cinq points ci-dessus).
- [x] **Tranche 1 livrée** — M21.1 accès (`ADMIN_ROUTES` dans le proxy, `requireAdmin`, layout
      `(shell)/admin`, `setAccountRole` + `admin:role`, entrée de menu, piège #64 : le callback
      `session` doit vivre dans `auth.config.ts` pour que le proxy voie le rôle) · M21.2 liste
      (`listAccountsForAdmin`, `getAccountForAdmin` : canaux, affaires, questions, appareils,
      dernière activité, coût 7 j / 30 j par les fonctions du produit) · M21.4 gestes
      (`setAssistantEnabled` + motif, `setAccountTest`, `deleteAccount` tracé chez l'admin,
      Unipile déconnecté d'abord, refus purs testés) · M21.6 porte de l'alpha (`activated_at`,
      page d'attente, `AccesEnAttente`, « À ouvrir », e-mail d'ouverture). Migration
      `20261019103245_m21_backoffice`. Tests : `admin.test.ts` (7), `admin-regles.test.ts` (4),
      `auth-deny-by-default.test.ts` (10). Vérifié en headless.
- [x] **Tranche 2 livrée** — M21.3 fiche (`getAccountJournal` : synthèse par sollicitation,
      silencieux, **tours en échec** consignés par l'échange via `logAiFailure` / `ia_echec`,
      rattrapages, questions ouvertes, journal récent) · M21.5 vue d'ensemble
      (`getAdminOverview` : coût du mois à Paris contre `OPENAI_PLAFOND_MENSUEL_EUR`, appels et
      silencieux, comptes actifs 7 j, demandes, échecs 7 j, outbox, rattrapages en échec ;
      `debutDuMoisParis` dans `temps.ts`). Tests dans `admin.test.ts`. Vérifié en headless.
- [x] Le dirigeant est administrateur en production (rôle posé par `admin:role` sur la base
      Neon) ; l'entrée du menu n'apparaît que lorsque le jeton porte aussi le rôle (`eb73e74`).
      Le compte de démonstration n'est administrateur nulle part.

**M21 terminée.** **Suivant** : **M22 — Parler à Relvo**, puis la tranche 10 de M7 (M7.19).
