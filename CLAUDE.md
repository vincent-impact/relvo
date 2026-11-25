# CLAUDE.md

> **Base : `SCAFFOLD.md` génération `2026.08.28` — rétroporté le 2026-09-07.** Relvo précède le
> kit : ce dépôt en est la matière première, pas le produit. La mention « rétroporté » dit que
> l'alignement a été fait après coup, pas qu'il a été généré.

> **Ce fichier est une carte, pas un entrepôt.** Il dit **où sont les choses**, **ce qu'il ne
> faut jamais faire**, et **où on en est**. Il ne recopie rien : ni invariants, ni hiérarchie de
> sources, ni pièges. À lire en premier, à chaque session.

## Projet

Relvo transforme le flux désordonné de messages reçus par un dirigeant — e-mails, messagerie —
en **sujets structurés** (« sujet » dans le code, la conception et pour l'utilisateur — un sujet se range dans un **dossier**), avec tâches, journal de bord et aide à la décision.

**Public** : dirigeants des secteurs **food** et **bâtiment**. Peu familiers des SaaS
bureautiques, à l'aise avec les assistants conversationnels.

**Posture produit** : « **l'UI sert à accéder à l'info, Relvo sert à agir** ». C'est le réflexe
d'arbitrage de tout le produit.

**Propriété des comptes** : dépôt, équipe de déploiement, base, stockage et agrégateur au nom de
l'organisation propriétaire du projet. ⚠️ Ne jamais provisionner une ressource du projet sur un
compte personnel, **même « en attendant »** — c'est exactement ce qui ne se défait plus.

## Documentation

**À lire avant de créer ou de modifier quoi que ce soit.**

| Fichier | Ce qu'il porte |
|---|---|
| [`conception/00-sources.md`](conception/00-sources.md) | **La hiérarchie des sources.** Qui a raison quand deux documents se contredisent. **À lire en premier.** |
| [`conception/01-principes.md`](conception/01-principes.md) | Le *pourquoi* : problème, public, posture — **et le domicile unique des invariants produit** |
| [`conception/02-modele-donnees.md`](conception/02-modele-donnees.md) | Le **persisté** : entités, champs, relations, contraintes |
| [`conception/03-cas-usage.md`](conception/03-cas-usage.md) | Le **vécu** de l'utilisateur. Il raconte, il ne tranche pas |
| [`conception/04-design-domaine.md`](conception/04-design-domaine.md) + [`uml.mermaid`](conception/uml.mermaid) | Le **comportement** : agrégats, cycles de vie, règles métier, **périmètre V1** |
| [`conception/05-ia.md`](conception/05-ia.md) | Ce que Relvo fait, et surtout ce qu'il **ne fait pas** |
| [`conception/design-system/`](conception/design-system/) | Tokens, règles de composition, patterns de disposition |
| [`conception/mockup/`](conception/mockup/) | **Flux et libellés figés**, jamais buildée ; elle **ne fait pas foi sur le rendu** — c'est le design system. ⚠️ **Ses données sont de la démonstration** — ne jamais dimensionner dessus |
| [`backlog/product-backlog.md`](backlog/product-backlog.md) | L'**ordre**. La définition de chaque item vit dans `backlog/epics/` |
| [`backlog/definition-of-done.md`](backlog/definition-of-done.md) | Les conditions de clôture d'un item. Non négociables |
| [`backlog/ecarts-et-propositions.md`](backlog/ecarts-et-propositions.md) | **L'historique des décisions** — le seul endroit du dépôt où il est à sa place |
| [`backlog/suivi-client.md`](backlog/suivi-client.md) | La **page de suivi du client** : ses sources, sa liste blanche, ce qui n'est **jamais** publié |

### La règle d'écriture de `conception/` — non négociable

Ces fichiers décrivent **l'état actuel du projet, jamais son histoire**.

- **Une erreur se corrige, elle ne se surcharge pas.** On récrit la phrase juste et on supprime
  l'ancienne — jamais un avertissement daté trois lignes plus bas.
- **Aucun concept mort**, **aucune date**, **aucun chiffre**.
- **Classer par sujet, jamais par provenance.**
- **De l'intention, pas de l'inventaire** : un document de conception porte le *pourquoi* et
  **pointe** vers l'inventaire. Quand un inventaire doit rester écrit, il est tenu par un
  **test**, jamais par la vigilance.

### Où on en est

Voir le **dernier fichier de [`backlog/sprints/`](backlog/sprints/)** — par date de création,
pas par ordre alphabétique. Lire son démarrage à froid en premier.

## Architecture

**Déployable unique** : `apps/web`, une application Next.js fullstack — interface, API, auth,
échange avec Relvo, et **webhooks d'ingestion**. E-mail et messagerie arrivent par webhooks
serverless ; il n'y a **aucun processus permanent** à héberger.

**Les frontières, à tenir :**

- `conception/` ne contient **aucun code exécutable** ; `apps/` **aucune documentation produit**.
  La maquette n'est **jamais** buildée.
- **Toute logique métier réutilisable passe par un paquet** : le domaine et l'accès aux données
  d'un côté, le stockage de l'autre. **Jamais de duplication.** Les fournisseurs de courrier
  vivent dans l'application, leur unique consommateur, **derrière une seule frontière** :
  `server/courrier/` déclare le contrat (lire le récent, une pièce jointe, envoyer, l'état,
  supprimer) et choisit l'implémentation d'après `ChannelConfig.provider` ; `server/unipile/`
  (l'agrégateur : WhatsApp, et les boîtes e-mail reliées avant le relais) et `server/gmail/`
  (le relais, M24 — **toute nouvelle boîte e-mail passe par lui**)
  l'implémentent. Tout ce qui suit la réception — `recevoirCourrier`, `rangerCourrier` — est
  le même code pour les deux ; un webhook de fournisseur ne fait que traduire sa matière en
  `CourrierEntrant`.
- **Ignorer, c'est ne plus importer** (M25.9) : une conversation ignorée ne reçoit plus rien —
  ni texte, ni pièce, e-mail ou messagerie, ignorée par le dirigeant ou par Relvo. La règle vit
  dans le domaine (`domain/reception.ts`, `recevoir…`) : **tout ce qui reçoit un message d'un
  fournisseur appelle `recevoir…`, jamais `ingest…`** — tenu par `reception-garde.test.ts`.
- **Le nettoyage efface, jamais un geste** (`04 §11`) : ce qu'aucun sujet ne porte expire à
  trente jours, un sujet fermé s'efface trente jours après, une conversation e-mail vidée
  disparaît, un fil de messagerie reste. Les règles vivent dans `domain/nettoyage.ts` — le
  passage réel et sa simulation lisent **les mêmes filtres** —, le cron du matin les passe
  (`server/nettoyage.ts`), et **un message de plus de trente jours ne s'importe plus**
  (`recevoir…`). ⚠️ **Armé** : `NETTOYAGE_ACTIF` (`lib/nettoyage.ts`) est vrai ; le
  remettre à faux ramène le cron à la simulation et retire ce que l'écran en promet. ⚠️ Un test qui passe par `recevoir…` date ses
  messages **relativement à maintenant** (`PITFALLS.md` #81).
- **Décider avant de télécharger** (M25.3, `04 §11`) : une pièce de **messagerie** n'est
  stockée que si un sujet porte son message (un vocal, toujours) ; sinon c'est une
  **référence** — la ligne existe, le fichier reste chez l'agrégateur — ou une **trace**
  (autocollant, GIF). La règle est pure (`lib/medias.ts`), l'état d'une pièce se lit du domaine
  (`etatDePiece`, `domain/attachments.ts`), et `server/medias.ts` fait les trois gestes :
  recevoir, **compléter à l'ouverture**, compléter ce qu'un sujet prend (après le tri, après
  un rattachement, et aux deux crons). ⚠️ Toute route de pièce (`/download`, `/apercu`,
  `/contenu`) **complète** une référence : rien ne les appelle sans que le dirigeant ait
  touché la pièce — le fil montre la vignette (`PITFALLS.md` #82). ⚠️ `storage_key` est
  **nullable** : une requête qui compte du poids ou des clés filtre sur ce qui est stocké.
- **Un fichier reçu entre par un seul dépôt** (M25.8, M25.7, `04 §11`) :
  `deposerUnePiece` (`server/depot.ts`) — e-mail comme messagerie. Il **dédoublonne** : un
  contenu que le compte a déjà (même empreinte MD5, même poids — `domain/deduplication.ts`)
  n'est pas posé une seconde fois, la pièce **partage** la clé de l'autre. ⚠️ Une clé d'objet
  n'appartient donc plus à une seule pièce : **jamais** de `storage.delete` sur la clé d'une
  pièce — on supprime la LIGNE, la file épargne ce qui est encore tenu (`PITFALLS.md` #83). Ce
  qui s'est croisé à l'entrée est rapproché par le cron du matin (`dedoublonnerLeCompte`,
  d'après les empreintes en base) — **aucun geste au backoffice**. Le **quota** d'un
  compte (`STOCKAGE_QUOTA_COMPTE_GO`, `espaceDuCompte`) : au quota, rien ne se stocke plus de
  lui-même ; ce qu'on ouvre, oui.
- **Aucun accès direct au stockage** : tout passe par le paquet dédié, jamais par un client
  instancié à la main — c'est ce qui garde le fournisseur remplaçable et ce qui évite de recréer
  un client sans les deux réglages obligatoires (`PITFALLS.md` #8). **Une pièce s'ouvre dans
  Relvo** (recette R18) : `AttachmentViewer` choisit le geste au type, et ce que l'application
  lit elle-même — l'aperçu d'un classeur, les octets d'un fichier à partager — passe par
  `server/pieces.ts` (routes `/apercu` et `/contenu`), jamais par une lecture du stockage
  depuis le navigateur, que le bucket refuse (`PITFALLS.md` #77). Le lecteur de classeurs vit
  dans `@relvo/storage/classeur`, **serveur seulement**.
- **Deux layouts racine, par groupes de routes** : `app/(shell)/` porte la coquille de
  l'application (PWA, verrous de viewport, garde anti-rebond, session) ; `app/(public)/` porte ce
  qui se lit **hors** de l'application (le suivi client, le **site** `relvo.net` et ses pages
  légales) et n'hérite d'aucune de ces contraintes.
  Il n'y a **pas** de layout à la racine de `app/` — une page publique se crée dans `(public)`,
  jamais ailleurs (`PITFALLS.md` #48).
- **La zone d'administration `/admin` vit dans `(shell)`, hors du groupe `(app)`** : pas de dock,
  pas de menu. Gardée **deux fois** — par le proxy (rôle lu dans le jeton ; le callback `session`
  vit donc dans `auth.config.ts`, `PITFALLS.md` #64) et par `requireAdmin()` (rôle relu en base).
  Le rôle se donne **par script** (`admin:role`), jamais par la base. Le backoffice **lit les mêmes
  fonctions que le produit** et n'a aucun compteur à lui. ⚠️ **Un bouton du backoffice est un
  choix à faire**, jamais une tâche technique : ce qui ne se décide pas est un script s'il
  passe une fois, un cron s'il revient.
- **Un test qui touche la base vit dans les tests d'intégration**, jamais ailleurs. Les tests
  unitaires sont colocalisés. La ligne de partage n'est pas la taille du test mais **sa
  dépendance**.

**Dérogations d'arborescence accordées :**

| Dérogation | Date | Motif |
|---|---|---|
| `packages/` conservé après la disparition du second déployable | 2026-09-07 | La couche domaine et ses tests d'intégration y sont installés ; les déplacer coûterait plus que la frontière ne rapporte. À revoir si un second déployable réapparaît. |

## Arborescence

```
relvo/
├── PITFALLS.md               # le registre — RESTE, n'est jamais recopié
├── CLAUDE.md · README.md
├── conception/               # tout le matériau amont — aucun code
│   ├── 00-sources.md · 01-principes.md · 02-modele-donnees.md
│   ├── 03-cas-usage.md · 04-design-domaine.md · 05-ia.md · uml.mermaid
│   ├── design-system/ · sources/ · mockup/
├── backlog/                  # product-backlog · epics/ · definition-of-done
│   └── ecarts-et-propositions.md · sprints/
├── apps/web/                 # SEUL déployable
│   └── src/{app,components,hooks,lib,server,types}
│       └── app/{(shell),(public)}  # deux layouts racine — voir Architecture
└── packages/{db,storage}
```

### Routes → écrans

> ⚠️ **Cette table décrit la cible** tranchée le 2026-09-20 (`ecarts`, « La disposition
> générale »), livrée par l'épique **M18**. **En place** : le dock, le menu, le header, l'accueil
> en brief, le Calendrier, le Bilan, les Dossiers, l'Usage, les redirections, le badge du bouton
> Relvo et la `RelvoQuestion` élargie (M10), la notification push — un abonnement par appareil
> dans Préférences, le brief du matin, les questions nées hors écran et chaque sujet né du tri à
> réception (M12.7, M12.9, M12.10). ⚠️ Le
> **Bilan** et l'**Usage** affichent des **chiffres de démonstration** (`lib/demo-bilan.ts`) et
> le disent en tête : ils ne sont pas reliés au journal ni au compteur d'inférence.

| Route | Écran | Nav |
|---|---|---|
| `/` | **Accueil** — brief en quatre zones : dernières nouvelles (header) · activité · aujourd'hui · en attente de vous | onglet |
| `/calendrier` | **Calendrier** — la page des **tâches** : indicateurs, semaine ou mois | onglet |
| `/fil` | **Sujets** — **une page, deux vues** (M28) que l'interrupteur du ciel choisit et que l'appareil retient (`?vue=`, sinon le cookie, sinon Dossiers) : **Sujets**, la liste à plat ; **Dossiers**, l'arbre complet — une carte par dossier de premier niveau, « Sans dossier » en tête, le nom entre, la flèche à droite plie (état retenu sur l'appareil, l'arbre arrive replié), la pastille violette d'un dossier compte ses sujets qui **ont bougé** (nouveaux, ou tâches changées en votre absence — `domain/queries.ts`, `aBouge`), jamais un total ; la dernière ligne d'une branche dépliée est « Ajouter dans <dossier> » (une feuille du bas : un sujet ou un dossier, un nom) ; un sujet ou un dossier se **glisse** dans un autre dossier (maintien au doigt, tirer à la souris ; les interdits dans `lib/arbre-depot.ts` ; un toast annule). Dans les deux vues, un sujet se valide ou se ferme d'un **balayage**, et les indicateurs cliquables agissent de la même façon ; **tous** les sujets sont chargés ; le « + » crée ce que la vue montre | onglet |
| `/conversations` · `/conversations/[id]` | **Conversations** — **seule surface d'affichage et de réponse** d'un fil | onglet |
| `/relvo` · `/relvo/historique` · `/relvo/instructions` | **Échange avec Relvo**, plein écran — **les instructions qui valent partout** (celles de « Général ») s'y écrivent, à côté de l'historique (M28) ; l'échange **du dirigeant** : ce que Relvo a à dire n'y est qu'**une ligne par échange** en tête (`AttenteRelvo`), jamais une question dépliée ; l'historique ne liste que les échanges de l'appareil ; **la prise en main** (M13.2) : s'ouvre depuis la dernière diapositive, script en texte fixe — métier, dossiers, première règle, **la boîte en dernier** —, carte vivante de la lecture du courrier, sujets du moment ; **dictée** par le disque du composer (M22) — maintenir pour parler, relâcher envoie la transcription — et par le **disque du dock** (M22.8) : maintenir, relâcher ouvre un nouvel échange sur la dictée envoyée ; pendant le maintien **la page entière se met à l'écoute** (`VoileEcoute`, en portail sous le dock) et le téléphone vibre (`lib/haptique.ts`, au mieux de l'appareil) | **bouton central du dock** |
| `/relvo/echanges/[cle]` | **Un échange de Relvo** (05 §11.12) — une chose qu'il a à dire, à part, nommée par son origine : `prise-en-main` (le script), `lecture:<id>` (carte vivante, sujets du moment, question de fin), `sujet:<id>` (question née de la structuration, puce du sujet), `dossiers` (proposés par le courrier), `boite:<canal>` (migration), `ignorees` (le relevé hebdomadaire de ce que Relvo a ignoré, M25.11), `question:<id>` ; le fil des réponses passées, la question en cours en formulaire, le composer pour une réponse libre. Regroupement pur dans `domain/echanges-relvo.ts`, matière assemblée par `server/echanges-relvo.ts` ; la notification et l'accueil y mènent | hors-nav |
| `/bienvenue` | **Première connexion** — six diapositives à glisser, puis « Configurer Relvo » ouvre l'échange ; vues une fois (`welcome_seen_at`) | hors-nav |
| `/bilan` | **Bilan** — deux familles de chiffres, séparées | menu |
| `/memoire/[id]` · `/memoire/nouveau` | **La fiche d'un dossier** (« dossier », « sujet », « connaissance » pour l'utilisateur, `Folder` dans le code) — la vue d'ensemble des dossiers est la vue Dossiers de `/fil` (M28), il n'y a pas de page de liste. Un dossier s'ouvre sur sa **description** (Relvo s'en sert pour ranger ; invite en pointillé si elle manque) puis **quatre onglets à icône** Dossiers (son arbre en une carte : le **triangle à gauche** replie une branche, état retenu sur l'appareil, **la ligne entre** ; créer dedans) · Sujets (les siens et ceux de ses fils, s'ouvre là) · Instructions · Connaissances (déposer un PDF, une image, un texte : il part du navigateur vers le stockage, s'inscrit **à lire** ; la lecture par Relvo est M11), **un ajout en première ligne de chacun** ; le crayon renomme, **range dans** un autre père (la feuille « Ranger dans… », le même arbre) et supprime (le contenu remonte chez le père). **Ranger un sujet** : glisser sa ligne à droite dans un dossier, ou taper son dossier dans le ciel de sa fiche — la même feuille, un toast annule. La couleur d'une ligne, d'une tâche, du Calendrier est celle du **premier niveau** ; Relvo range et parle en **chemins** (« Clients › Franchises ») et l'échange liste, crée, déplace un dossier et range un sujet à la demande | hors-nav |
| `/contacts` · `/contacts/[id]` · `/contacts/nouveau` | **Contacts** — annuaire et fiche | menu |
| `/canaux` · `/profil` · `/preferences` · `/usage` | Quatre pages à part entière — l'**Usage** en %, jamais en euros — sa carte « Espace » est réelle (la part du quota de stockage, M25.7), celle du plafond mensuel encore de démonstration ; les **Préférences** portent l'assistant et les notifications de cet appareil. Il n'y a **pas** de page Réglages | menu |
| `/recherche` | Recherche transverse | menu, en dernier |
| `/sujets/[id]` · `/sujets/nouveau` | Fiche d'un sujet | hors-nav |
| `/admin` · `/admin/comptes/[id]` · `/admin/stockage` · `/admin/dictee` | **Backoffice** (M21) — rôle `admin` seulement : les comptes, les demandes à ouvrir, les gestes (assistant, test, suppression), le **stockage** (M25.1 : le poids du bucket contre son repère, ce qui tient les pièces, par type, par canal, par compte, et ce qu'un effacement aurait laissé — le bucket se liste par `@relvo/storage`, gardé un quart d'heure ; les doublons qui resteraient s'y comptent, rien ne s'y lance), l'**essai de dictée** (M22.1 : le micro en PWA, la mesure, le partage des enregistrements du benchmark) | entrée du menu pour les administrateurs ; retour à l'app par le pictogramme maison |
| `/(auth)/*` | Tunnel d'authentification — l'inscription est libre, **l'accès s'ouvre quand un administrateur valide la demande** (`/inscription/attente`) | — |
| `relvo.net` · `/confidentialite` · `/conditions` | **Le site** (M24.10) — un autre **hôte** du même déployable : la présentation (`(public)/site`, réécrite depuis `/` sur cet hôte), la politique de confidentialité et les conditions, à l'adresse déclarée à Google. Sur `app.relvo.net`, ces chemins renvoient au site ; sur `relvo.net`, tout autre chemin renvoie à l'application (`lib/hotes.ts`, `next.config.ts`) | hors-nav, sans session |

**Navigation** : barre d'onglets basse, fixe, violette, **cinq places** : Accueil · Calendrier ·
**Relvo** (bouton central, disque violet qui déborde du dock des deux côtés, le dock se soulevant autour de lui, badge = le nombre d'échanges de Relvo qui attendent une réponse) ·
Sujets · Conversations. Le **menu latéral** (burger, discret, à droite du header) porte Bilan, Contacts, Canaux, Profil,
Préférences, Usage, Rechercher. **Toute page du menu porte le burger** ; la flèche retour est
réservée aux écrans poussés (fiches, création) : elle fait **repartir l'écran vers la droite**, et une fiche ouverte depuis la page Sujets **entre de la droite** (`layout/ecran-transition.tsx`, les transitions de vue — `experimental.viewTransition`). Les boutons de page se posent **à droite**.

⚠️ **`/messages`, `/planning`, `/dossiers`, `/memoire` et `/parametres` sont redirigées** (M18,
M28) — vers Conversations, Calendrier, la vue Dossiers de `/fil` et les quatre pages du menu
(`next.config.ts`).

## Invariants produit

> **Domicile : [`conception/01-principes.md`](conception/01-principes.md) §14.** Ils ne sont
> **pas recopiés ici**, volontairement : une copie diverge. **Les lire avant tout arbitrage de
> périmètre ou de modèle.** Aucun code ne doit les contredire.
>
> ⚠️ **Leur numérotation est citée dans le code en une vingtaine d'endroits.** Un numéro n'est
> jamais réattribué.

## Conventions

- **TypeScript partout.** Les énumérés découlent du schéma.
- **Server Components par défaut**, directive client ciblée.
- **Validation aux frontières**, identifiants opaques.
- **Doc et code dans le même commit** — nécessaire, **pas suffisant** : voir `PITFALLS.md` #20 et
  la [Definition of Done](backlog/definition-of-done.md).
- **📣 Pied de message `Client:` sur les commits `feat` et `fix` — OBLIGATOIRE.** Une phrase en
  langage client, à la deuxième personne, décrivant un **effet observable** — elle est publiée
  telle quelle sur la page de suivi. `Client: -` pour exclure un commit qui ne concerne pas le
  client. ⚠️ **Absent, l'entrée n'est PAS publiée** : le journal du client refuse par défaut. Un
  commit `feat`/`fix` sans pied est donc un trou dans le journal, jamais du jargon envoyé au
  client — `pnpm changelog` le signale ligne à ligne.

  ```
  fix(pwa): le clavier Android n'écrase plus le composer

  Client: Sur Android, le clavier n'écrase plus la zone de saisie.
  ```
- **Le frontmatter d'une épique se met à jour dans le commit qui change son état** — c'est lui
  qui alimente la page de suivi. Cf. [`backlog/suivi-client.md`](backlog/suivi-client.md).
- **🔒 Réflexe registre de composants — le seul piège recopié ici, parce qu'il se déclenche à
  chaque session et AVANT toute écriture de composant.** Dès qu'un composant graphique doit être
  envisagé, la première action est **toujours** d'interroger le registre :
  1. **Chercher** dans le registre.
  2. **Trouvé** → l'installer, puis l'adapter au thème. Ne pas le réécrire.
  3. **Partiellement couvert** → **composer** à partir des primitives existantes.
  4. **Absent** (dernier recours) → sur mesure, avec les conventions du registre.

  Créer une primitive à la main alors qu'un équivalent existe est une **erreur de process**, pas
  un choix esthétique.

## Pièges

> **Domicile : [`PITFALLS.md`](PITFALLS.md).** Chaque entrée a coûté une session de débogage
> réelle. Les lire **avant** de dérouler un chantier qui les touche, pas après.

## Commandes

```bash
pnpm dev             # app web
pnpm typecheck       # types
pnpm lint            # eslint
pnpm test            # tests d'intégration
pnpm build           # ⚠️ « ƒ Proxy (Middleware) » DOIT apparaître (#5b)
pnpm db:start        # Postgres local
pnpm db:migrate      # nouvelle migration
pnpm db:generate     # ⚠️ après TOUTE migration (#33)
pnpm db:seed         # jeu de démonstration
pnpm --filter web ia:journal   # le compteur de l'inférence relu : coût, cache, silencieux
curl -H "Authorization: Bearer $CRON_SECRET" <app>/api/cron/matin   # le cron du matin à la main : le nettoyage (réel — `NETTOYAGE_ACTIF`), le filet de la déduplication (M25.8), drainage, brief, abonnements Gmail, le lundi le relevé de ce que Relvo a ignoré (M25.11), et la première lecture des groupes du jour (M29.5) — la seconde part du cron de la mi-journée, `/api/cron/catch-up`
pnpm --filter web push:essai <e-mail>   # pose une question de test et la pousse (M12.9)
pnpm --filter web admin:role <e-mail> admin|ceo   # donne ou retire le rôle admin, journalisé (M21.1) — effectif à la prochaine connexion
pnpm --filter web boites:migrer <e-mail> [adresse]   # propose à un compte de passer une boîte de l'agrégateur au relais Gmail (M24.9) — question poussée, rien ne bascule avant son retour de Google
pnpm --filter web pj:rattraper <e-mail> [--filtre kiloutou] [--tout] [--simuler]   # relit chez l'agrégateur les e-mails reçus sans pièce jointe et stocke celles qu'il porte
pnpm --filter web nettoyage:simuler [<e-mail>]   # SIMULE le nettoyage (04 §11) : ce que le passage du matin retirerait — messages sans sujet de plus de trente jours, leurs pièces, conversations e-mail vidées, sujets fermés ; n'écrit jamais rien. Le passage réel est le cron du matin, armé par `NETTOYAGE_ACTIF` (`apps/web/src/lib/nettoyage.ts`)
curl -H "Authorization: Bearer $CRON_SECRET" <app>/api/cron/drain-file-deletions   # vide la file de suppression du stockage sans attendre le matin (quatre minutes de drainage, PITFALLS #80)
pnpm --filter web groupes:juger [<e-mail>] [--executer] [--titres] [--limite N]   # juge une fois les groupes WhatsApp jamais jugés (M29.3) : hors du champ professionnel et sans doute, ignorés — SIMULATION sans --executer ; --titres liste chaque groupe, à réserver à son propre compte
curl -X POST -H "Authorization: Bearer $CRON_SECRET" <app>/api/groupes/lecture   # lit tout de suite les groupes WhatsApp qui ont parlé depuis leur dernière lecture (M29.5), sans attendre l'un des deux crons — par passes enchaînées, au tarif différé
pnpm --filter web groupes:lire [<e-mail>] [--heures N] [--titres] [--limite N]   # SIMULE la lecture des groupes sur les dernières heures : ce que Relvo ouvrirait, à quel coût — n'écrit jamais rien ; --titres à réserver à son propre compte
pnpm --filter web wa:reparer <e-mail> [--simuler]   # fond les conversations WhatsApp fantômes d'un compte dans le fil (PITFALLS #75), journalisé
pnpm --filter web eval:dictee --dossier <hors dépôt> [--compte <e-mail>]   # benchmark de la transcription, dictées HORS dépôt (M22.1)
curl -X POST -H "Authorization: Bearer $CRON_SECRET" -H 'content-type: application/json' -d '{"catchupId":"…"}' <app>/api/rattrapage/tranche   # relance une tranche de lecture du courrier (M7.19) ; le cron de la mi-journée (/api/cron/catch-up) n'est qu'un filet
```

Déploiement : pousser sur la branche de production. **Un seul déployable, deux hôtes** :
`app.relvo.net` (l'application, les webhooks) et `relvo.net` (le site) ; `relvo-app.vercel.app`
redirige. Un changement d'adresse = `AUTH_URL`, `VAPID_SUBJECT`, `UNIPILE_PUBLIC_URL` et les
webhooks de l'agrégateur réenregistrés (`scripts/unipile-webhook.mjs`).
