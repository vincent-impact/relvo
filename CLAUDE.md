# CLAUDE.md

> Fichier d'orientation pour Claude Code. Il explique **ce qu'est Relvo**, **comment l'app est architecturée**, et **où vit chaque chose** dans le repo. À lire en premier, à chaque session.

## Projet

Relvo est un assistant IA de pilotage des sollicitations professionnelles. Il transforme le flux désordonné de messages reçus par un dirigeant (e-mails, WhatsApp) en **sujets métier structurés**, avec tâches, journal de bord et aide à la décision.

**Public cible** : dirigeants des secteurs **food** et **bâtiment**. Pas familiers des SaaS bureautiques (Notion, Hubspot…), mais à l'aise avec ChatGPT/Claude. La promesse doit être lisible immédiatement et minimaliste.

**Posture produit** : « **l'UI sert à accéder à l'info, Relvo sert à agir** ». L'essentiel des actions passera par le chatbot, pas par les écrans. Cette posture oriente tous les arbitrages de scope.

## Documentation du projet

Trois corpus, séparés par nature. **À lire avant de créer ou modifier quoi que ce soit.**

| Dossier | Contenu | Rôle |
|---|---|---|
| [`docs/conception/`](docs/conception) | `01-principes.md`, `02-modele-donnees.md`, `03-cas-usage.md`, `04-ia.md` | Le **quoi / pourquoi** produit — source de vérité fonctionnelle |
| [`docs/spec/`](docs/spec) | `architecture.md` | Le **comment** technique — source de vérité de l'architecture |
| [`docs/backlog/`](docs/backlog) | `backlog-v1.md` | Le **quand / ordre** — roadmap par modules M1→M14 |
| [`mockup/`](mockup) | HTML/CSS statique | **Référence visuelle figée** — à reproduire en React/Next, non déployée |

Lecture obligatoire avant de toucher un écran :
- **`docs/conception/01-principes.md`** — le Subject est l'entité centrale (pas le message). Chaîne `Message → Task → Action → LogEvent`.
- **`docs/conception/02-modele-donnees.md`** — entités, champs, relations → guide le schéma Prisma.
- **`docs/conception/03-cas-usage.md`** — flux utilisateur (cas A à P).
- **`docs/conception/04-ia.md`** — ce que l'IA fait et **ne fait pas**.

## Architecture (résumé)

> **Détail complet et raisonné : [`docs/spec/architecture.md`](docs/spec/architecture.md) — source de vérité.** Ce qui suit n'en est qu'un résumé.

Monorepo léger (pnpm workspaces), **déployable unique** (`apps/web`) sur un schéma Prisma partagé :

- **`apps/web`** — Next.js App Router **fullstack** → **Vercel**. UI + API (Route Handlers + Server Actions) + auth + chatbot + CRUD + **webhooks d'ingestion Unipile** (email + WhatsApp).
- **`packages/db`** — schéma **Prisma** + enums partagés (`Actor`, `Status`, `Priority`, `Kind`, `TriageHint`) + couche domaine.
- **`packages/storage`** — stockage fichiers R2 (upload pré-signé, download authentifié, outbox de suppression).

Points à ne pas oublier :
- **Pas de backend NestJS séparé.** Route Handlers + Server Actions + Prisma couvrent tout. Le plan initial (Turborepo + NestJS + JWT) est **abandonné** — si une doc le mentionne encore, c'est caduc, se référer à la spec.
- **🔀 Bascule Unipile (2026-07-16) — plus de worker always-on.** Email **et** WhatsApp passent par l'agrégateur managé **Unipile** (envoi « au nom de » l'utilisateur, hosted auth OAuth/IMAP/QR, webhooks temps réel, UE/SOC2/DPA). Cela **remplace** Postmark **et** le daemon Baileys : WhatsApp devient un webhook serverless comme l'email. Toute mention de `apps/worker`, Baileys, Railway/Render, BullMQ ou Postmark est **caduque**. Le client d'intégration vit dans `apps/web/src/server/unipile/` ; l'ingestion aboutit à un `Message` orphelin (« Sans sujet »), le pipeline IA (M7) fera le Sujet. Le **risque de ban WhatsApp** demeure (connexion non officielle chez Unipile).
- **Temps réel navigateur** = polling 30 s (V1).

## Arborescence du repo

```
relvo/
├── CLAUDE.md                  # ce fichier
├── README.md                  # setup humain (env vars, lancement, déploiement)
├── docs/
│   ├── conception/            # specs produit (4 docs numérotés)
│   ├── spec/architecture.md   # spec technique — source de vérité archi
│   └── backlog/backlog-v1.md  # roadmap modules M1→M14
├── mockup/                    # maquette HTML figée — référence visuelle
├── packages/
│   ├── db/prisma/schema.prisma   # schéma + couche domaine (partagé app ↔ tests)
│   └── storage/src/              # stockage fichiers R2 (M4)
└── apps/
    └── web/                   # → Vercel (Root Directory = apps/web) — déployable UNIQUE
        ├── src/app/           # routes App Router (voir mapping ci-dessous)
        │   ├── api/chat/                  # AI SDK + Gateway
        │   └── api/webhooks/unipile/      # email + WhatsApp entrants (Unipile)
        ├── src/components/    # layout/ (Sidebar, ChatDrawer), feed/, ui/ (shadcn)
        ├── src/lib/           # db.ts (client Prisma), auth.ts, helpers
        └── src/server/        # Server Actions + logique métier + unipile/ (client intégration)
```
> `apps/worker` (daemon Baileys) **n'existe plus** : bascule Unipile (webhooks serverless).

**Règles de navigation pour Claude** :
- Avant de créer/modifier un écran, **lire les docs `docs/conception/` concernées** — elles priment sur toute supposition.
- Pour reproduire fidèlement un écran, s'appuyer sur le HTML/CSS correspondant dans `mockup/`.
- Le schéma Prisma (`packages/db`) doit rester **cohérent avec `02-modele-donnees.md`**.
- Toute logique métier réutilisable passe par un package : `packages/db` (types, accès DB, domaine), `packages/storage` (fichiers R2) — jamais de duplication. L'intégration Unipile (email + WhatsApp) vit dans `apps/web/src/server/unipile/` (unique consommateur : l'app).
- **Aucun accès direct au stockage** : tout passe par `@relvo/storage` (`getStorage()`), jamais par un client S3 instancié à la main. C'est ce qui garde le fournisseur remplaçable — et ce qui évite de recréer un `S3Client` sans les deux réglages R2 obligatoires (`signableHeaders` sur `content-type`, checksums en `WHEN_REQUIRED` : cf. `r2.ts`, sans eux la signature ne contraint pas le type de fichier et le SDK signe le CRC32 du vide).
- **Afficher un fichier = une URL stable, jamais une URL signée.** `<img src={`/api/attachments/${id}/download?inline=1`} />` — le navigateur suit la redirection 307 vers R2 tout seul. L'URL signée (5 min) est un détail interne, jamais manipulée par un composant. C'est l'architecture par défaut d'ActiveStorage, en version **authentifiée** (le défaut Rails ne l'est pas). Sans `?inline=1` → téléchargement sous le vrai nom du fichier. **Ne jamais mettre une URL pré-signée dans `next/image`** : la clé de cache Vercel inclut la query string ⇒ signature qui tourne = MISS + transformation **facturée** à chaque rendu. **Ne jamais streamer un fichier à travers une Function** (« lightweight API layer, not a media server » — Vercel ; body de réponse plafonné à 4,5 Mo).
- **Toute route servant de la donnée d'un tenant envoie `Cache-Control: private` + `Vercel-CDN-Cache-Control: no-store`.** La clé de cache d'un CDN est méthode + URL, sans aucun header de requête : une route authentifiée par cookie a donc la **même clé pour tous les utilisateurs**. Ne pas s'en remettre au défaut plateforme — incident Railway du 2026-03-30 : cache activé par accident, « requests for one user [served] to a different user », seules les apps qui envoyaient `private` explicitement ont été épargnées.
- **🚫 Ne JAMAIS supprimer un fichier R2 depuis une fonction de suppression.** Le domaine ignore le stockage : un **trigger PostgreSQL** met `storage_key` dans l'outbox `pending_file_deletions` (dans la transaction), un cron draine hors transaction (M4.6). C'est le seul mécanisme qui capte les **cascades**, dont Prisma est aveugle par conception. Supprimer en synchrone rouvrirait les pertes de données qui ont fait retirer ce comportement de Django en 1.3. **Toute nouvelle table portant un `storage_key` doit recevoir son trigger dans la migration.**
- `docs/` et `mockup/` ne sont buildés par personne (Next ne build que `apps/web/src/app`).

### Mapping routes ↔ écrans

Routes francophones, alignées sur la nav V1.

| Route | Écran | Nav |
|---|---|---|
| `/` | **Actions** (✅) — page des TÂCHES : barre KPI Tâches (RDV · Aujourd'hui · En retard · À trier) + 2 onglets **Agenda** (semainier slidable + drag&drop) / **À trier** | Onglet |
| `/fil` | **Sujets** (📥, ex-« Mon fil ») — barre KPI Sujets (Urgents · Nouveaux · Ouverts · Sans sujet↗) + barre de filtres (Statut/Domaine/Urgent/Nouveau) | Onglet |
| `/dossiers` · `/dossiers/[id]` | **Mémoire** (🧠) — liste des domaines + fiche : onglets Instructions/Documents/Sujets | Onglet |
| `/parametres` | **Réglages** (⚙️) — onglets Profil / Canaux / **Contacts** (annuaire) / Préférences | Onglet |
| `/contacts` · `/contacts/[id]` | Annuaire + fiche contact | Hors-nav (atteint via l'onglet Contacts des Réglages) |
| `/sujets/[id]` | Détail d'un sujet | Fiche détail |
| `/planning` | Calendrier vue mois | Hors-nav (lien depuis le widget semaine de l'Accueil) |
| `/conversations` · `/conversations/[id]` | **Conversations** — liste triée par activité, filtres **Sans sujet** (défaut) / Ignorées / Toutes + filtre canal ; détail en timeline avec **cordon de sujet**. ⚠️ **Rendu et gestes par canal** (cf. invariant n°13bis) | Hors-nav (lien depuis le KPI « Sans sujet » des Sujets) |

**Navigation = barre d'onglets en bas** (mobile-first), **4 entrées** : **Actions** ✅, **Sujets** 📥, **Mémoire** 🧠, **Réglages** ⚙️ (décision 2026-06-28). « Accueil » est devenu **Actions** (page des tâches, cf. invariant n°30) et « Mon fil » est devenu **Sujets**. **Contacts a quitté le dock** : c'est désormais un **onglet des Réglages** (entre Canaux et Préférences) — l'usage Équipe à venir le re-promouvra peut-être. Note IA : un contact rattaché à un **pôle/dossier** influencera la qualification des messages reçus (les sujets d'un contact « RH » tomberont probablement dans le dossier RH). L'**échange** avec Relvo (`/relvo`) est une **surface plein écran** (plus un drawer latéral), atteinte via un **bouton Relvo en haut à droite du header violet** — présent sur toutes les pages, même forme que l'ancien bouton ✦ du composer (décision 2026-06-27, abandon du composer persistant du bas : trop encombrant, hidden-menu, confusion avec le composer destinataire d'un sujet). Les éventuels boutons de page (ex. « + » Nouveau sujet) se posent **à gauche** du bouton Relvo. La **barre d'onglets basse est fixe, sur fond violet** (comme l'ancien composer). Le virage mobile-first et la PWA sont détaillés dans `docs/spec/ux-mobile-first.md` ; cf. `01-principes.md §13`.

## Invariants produit à respecter

> Liste condensée. Le détail et la justification sont dans `docs/conception/`. Ne pas les enfreindre sans validation explicite.

**Modèle & acteurs**
1. `Account` est le tenant. Toutes les ressources portent `account_id`. Pas de FK utilisateur sur les ressources.
2. Type partagé `Actor = enum(user, ai, contact, system)`. UI : **Moi / Relvo / Externe** avec badges `M` (bleu) / `R` (violet) / `E` (ambre).
3. « **Relvo** » dans l'UI, « IA » dans la doc technique. L'enum reste `ai`.

**Sujets, tâches, messages, contacts**
4. Le **Subject** est l'entité centrale, pas le message. Chaîne : **Message → Conversation → Subject → Task → Action → LogEvent** (insertion de `Conversation`, 2026-07-20).
5. ⚠️ **Caduc depuis le 2026-07-20** (M6bis). Le rangement en **Conversation** est **déterministe et infaillible** à la réception : il n'y a plus de message orphelin ni d'échec à justifier. `triage_hint` n'est **plus alimenté** (champ conservé pour l'historique). Le KPI « Sans sujet » compte désormais les **conversations dont le dernier message n'est couvert par aucun sujet**.
6. Une **tâche** est rattachée au sujet, pas à un utilisateur (affectation = V2). Source visible via actor-pill (`✦ Relvo` / `Moi`).
7. **Statut = cycle de vie à 3 valeurs** (`ouvert`, `validé`, `fermé`), exclusif — refonte M6bis du **2026-07-20**. `ouvert` est l'état par défaut et **invisible** (aucun badge) ; `validé` = travail fait (swipe droite) ; `fermé` = sujet écarté (swipe gauche). Les deux terminaux posent `closed_at` — ⚠️ **une simple date depuis le 2026-07-21, plus une borne d'appartenance** (cf. n°13bis). Ce qu'ils font à l'appartenance **dépend du canal** : **WhatsApp** → `closingMessageId` posé, la fenêtre se referme, la conversation **redevient orpheline** (pas de réouverture) ; **email** → **rien ne change**, le fil reste entier dans son sujet et un nouveau message **ROUVRE** le sujet. La règle « pas de réouverture d'un sujet clos » (2026-07-20) est **fausse côté email**. ⚠️ **`archived` est retiré** (n'exprimait rien qu'une fermeture n'exprime) et **`ignored` a migré sur la `Conversation`** (on fait taire une **source**, pas un sujet) — avec eux disparaissent l'ignorance collante, la purge à 15 j et l'onglet « Ignorés ». **« Nouveau » n'est plus un statut** mais un **marqueur dérivé** : `lastOpenedAt == null` (sujet ouvert jamais consulté) — décision 2026-06-27, au même titre que « Urgent » (priority) ou « À faire » (tâches ouvertes). Ouvrir la fiche pose `lastOpenedAt` → le marqueur disparaît (acquittement implicite, cf. n°10). Les états cumulables sont des **marqueurs** distincts — Urgent (drapeau), Nouveau (dérivé `lastOpenedAt`), À faire (dérivé tâches ouvertes), En attente (`waiting_for_reply`), pastille de non-lus. Ex-statuts `to_do`/`waiting`/`unread`/`new` supprimés.
8. **Priorité (urgence) à 2 valeurs** (`urgent`, `normal`) ; **drapeau urgent** (rouge) si `priority = urgent`. La **rareté est le signal** (1-2 sujets sur 24). `getOpenFeed` = tous les ouverts, **urgents en tête**. **Swipes — la cible dépend de la surface** (2026-07-20) :
   - **sur un SUJET** (page Sujets) : ← **Fermer** (rouge, `status = fermé`) · → **Valider** (vert, `status = validé`). Plus d'« Archiver », plus d'« Ignorer » sur un sujet.
   - **sur une CONVERSATION** (page `/conversations`) : ← **écarter** (= **PAUSE**, aucune ancre de fin — cf. n°13bis) · → **ouvrir un sujet** (= *déclarer que ce fil mérite d'être suivi* ; tous les fils email ne sont pas des affaires — M7 le décidera plus tard à la place de l'utilisateur). ⚠️ L'écartement s'**habille par canal** — email « **Supprimer** » / **rouge**, WhatsApp « **Ignorer** » / **orange** — mais appelle **`ignoreConversation` dans les deux cas : AUCUNE donnée n'est supprimée** (l'email vit toujours chez Gmail, on n'en a qu'une copie ; supprimer détruirait sujets/tâches/PJ, et le fil restant chez Unipile recréerait la conversation vide de son passé). Cf. n°13bis.
9. **Brouillon Relvo dans le composer** (jamais affiché comme un message du fil). Actions « Régénérer » / « Effacer ».
10. **Acquittement implicite** des suggestions : ouvrir un sujet vaut acquittement (logique sur `last_opened_at`). Pas de bouton « valider ».
11. ⚠️ **« Conversations par contact, tous canaux confondus » est CADUC** (2026-07-20). La `Conversation` est une **entité** à clé canonique **par canal** — `email:<interlocuteur>:<objet>`, `wa-group:<chat_id>`, `wa-direct:<numéro>` : un même contact qui écrit par email puis par WhatsApp produit **deux conversations**. La réunification entre canaux **remonte d'un cran**, au **Sujet**, qui agrège 0/1/n conversations. Fiche sujet : l'onglet s'appelle **« Conversations »** (ex-« Messages ») ; le **composer n'apparaît que dans cet onglet**. Son **select d'interlocuteur switche la conversation** affichée (filtrage par `senderContactId`/`recipientContactId` — un message appartient à un interlocuteur qu'il soit entrant ou sortant). Défaut = **dernier interlocuteur actif**. Dès **> 1 interlocuteur**, le select propose **« Tous »** = fil complet **et** cible de **diffusion** à tous (envoi réel = post-V1). Le terme **« Interlocuteur(s) »** remplace « Destinataire(s) » dans l'UI.
12. **Création automatique d'un contact** (pipeline IA) uniquement à la création d'un sujet — l'IA ne crée jamais un contact « dans le vide ». Expéditeur inconnu = `sender_raw` + avatar `?`. **La création manuelle par l'utilisateur reste permise** (bouton + de l'annuaire `/contacts` → `sourceActor: user`, statut `complete` d'emblée).
13. Sujets **multi-contacts** (`contact_ids: UUID[]`).
13bis. **UX par canal — on diverge sur le RENDU et les GESTES, jamais sur le DOMAINE** (décision 2026-07-20, après test en prod de M6bis). Forcer une UX unique dessert les deux canaux : les messages email sont longs et structurés (la bulle les étrangle), et WhatsApp n'a pas d'**objet**.
   - **Rendu** : email = **pleine largeur**, emails enchaînés au scroll, **fond blanc dans les deux sens** — c'est l'**en-tête** (avatar + expéditeur + date) qui porte l'information, le sortant se signalant par « **Moi** ». ⚠️ **Pas de fond teinté** : sur du texte long il fatigue et abîme la lisibilité, ce qu'on vient précisément gagner en sortant de la bulle (cf. Gmail/Superhuman/Outlook). Repli si insuffisant : teinte **très légère au sortant seulement**. **WhatsApp conserve les bulles.**
   - **Gestes** : cf. n°8. **Tap sur un message = WhatsApp uniquement**. ⚠️ **On ouvre TOUJOURS un sujet depuis une CONVERSATION, jamais depuis un message** (2026-07-21) : côté WhatsApp le tap ne fait que **désigner l'ancre**, il n'ouvre pas un second chemin ; côté email il n'y a pas de tap.
   - **Signal « ce fil est suivi par un sujet »** (2026-07-20) : **cordon** (point coloré par message) en **WhatsApp** ; **bandeau « Suivi dans : *titre du sujet* »** en **en-tête de conversation** côté email — pastille de couleur du domaine, cliquable vers la fiche — et ⚠️ **AUCUN cordon ni rail de couleur par message**. Ce n'est pas une perte mais une **conséquence du modèle** : l'ancre email étant nulle, **tout** le fil appartient au sujet, donc un signal par message serait **identique partout**, donc muet. Le cordon garde son sens en WhatsApp, où l'appartenance **varie d'un message à l'autre**.
   - **🔑 Énoncé central** (2026-07-21) : **un fil d'email EST un sujet ; une conversation WhatsApp est un FLUX, où la fenêtre et son ancre FABRIQUENT l'objet que le médium ne fournit pas.** Tout le reste en découle.
   - **Email — AUCUNE notion de fenêtre.** Lien conversation ↔ sujet **1:1 et permanent** ; appartenance **totale et définitive** (tous les messages du fil, passés et futurs, sans borne). ⚠️ **Ouvrir un sujet email balaie le fil ENTIER, amont compris** — la règle « messages ≥ ancre » est un héritage WhatsApp qui, appliquée à l'email, ne rattacherait qu'**un** message sur un fil de six. **Jamais de second sujet sur un fil email** : la formulation « tout le fil **non encore couvert** » est **caduque**, c'est **tout le fil**. Un nouveau message de même objet + même interlocuteur **ROUVRE** le sujet (`validé`/`fermé` → `ouvert`) : de l'activité sur une affaire signifie qu'elle est vivante, et **le SEUL geste qui fait taire un fil est d'ignorer la conversation** (un mécanisme d'extinction, pas deux qui se ressemblent).
   - **WhatsApp — fenêtre à DEUX bornes.** `anchorMessageId` (début) **et `closingMessageId`** (fin, nouvelle colonne nullable, **aucun backfill** — 2026-07-21). `null`/`null` = tout le fil, encore ouvert. **Ignorer la conversation = PAUSE** : le sujet cesse d'être alimenté mais **aucune ancre de fin n'est posée**, donc réactiver fait **reprendre** l'alimentation (sans quoi « Réactiver » serait un bouton sans effet). **Valider / fermer = FIN** : `closingMessageId` posé sur le dernier message reçu, le cordon se referme. **Directs ET groupes, même régime** (le nom du groupe **ne fait pas office d'objet**). **Défaut d'ancre au swipe droite = le DERNIER message reçu, toujours** — aucune exception, aucune borne temporelle.
   - ⚠️ **`Subject.closedAt` est DÉCLASSÉ** (2026-07-21) : ce n'est **plus** « la borne haute de la fenêtre », juste la date où l'utilisateur a considéré l'affaire close. **Distinguer l'APPARTENANCE** (quels messages sont dans le sujet → les ancres) **du STATUT** (où en est l'affaire → `status`) : les confondre était l'erreur du modèle précédent. Une borne qui désigne **un message** ne ment jamais ; une borne déduite d'un **horodatage** devient fausse dès que deux messages arrivent dans la même seconde.
   - **Une seule primitive de domaine**, pas deux : *ouvrir un sujet **sur une conversation**, avec une ancre **OPTIONNELLE***. Ancre nulle → tout le fil ; ancre posée → à partir d'elle. ⚠️ **La logique métier teste l'ANCRE, jamais le canal** — c'est la garde ci-dessous appliquée à la lettre.
   - **Plusieurs sujets SIMULTANÉS sur une même conversation : écarté de la V1**, et ça ne coûte rien — `SubjectConversation` est **déjà** une liaison plusieurs-à-plusieurs, seule une **règle métier V1** l'interdit, levable **sans migration**. Le jour venu : uniquement du **rendu** (cordons alignés horizontalement). Les sujets **successifs** sans chevauchement **fonctionnent déjà** via la paire début/fin.
   - **Poignée d'ancre** (2026-07-20) : le **cordon WhatsApp est épaissi** et son **nœud de départ devient une poignée** qu'on **attrape et fait glisser** vers le haut/bas — remonter fait **entrer** les messages antérieurs, descendre les fait **sortir**. C'est le mécanisme de correction du défaut ci-dessus. **Réutiliser `dnd-kit`, déjà dans le projet** (semainier, planning mois) — pas de seconde librairie de drag. ⚠️ **Le drag DOIT montrer en direct les messages qui entrent et sortent** (surbrillance / estompage) : déplacer l'ancre **réécrit des `Message.subjectId`**, sans aperçu le geste est aveugle. **Exigence, pas suggestion.**
   - **Pourquoi** : l'**ancre n'est pas un concept du modèle, c'est la prothèse d'un objet manquant**. La clé `email:<interlocuteur>:<objet>` contient l'**affaire** ; `wa-direct:<numéro>` ne contient que la **personne**. Elle tombera avec M7, comme la « fenêtre active » (`01-principes.md §9`).
   - ⚠️ **Garde** : le domaine (ouverture de sujet, ancre, rattachement, détachement, ignorance, statuts) reste **commun**. Le jour où l'on duplique la logique métier « parce que l'email est différent », **on aura deux produits**.

**Dates & planning**
14. Task : 4 champs date nullable (`start_date/time`, `end_date/time`). La deadline vit dans `start_*` ; `end_*` = durée.
15. Deux surfaces calendaires : **semaine** (widget Accueil) + **mois** (`/planning`). Code couleur par Dossier. Drag-and-drop.

**Dossiers & connaissances**
16. `Folder` (modèle) = **« Mémoire »** (nav, icône cerveau) ; chaque Folder = **« un domaine de la mémoire de Relvo »**, fiche en **3 onglets : Instructions / Documents / Sujets**. Regroupe Sujets (`Subject.folder_id`) **et** Connaissances (`KnowledgeDocument.folder_id`).
17. Folder « **Général** » auto-créé (`is_default`), documentaire transversal, jamais de sujets.
18. `KnowledgeDocument` : `kind = file` (UI **« Documents »**, PDF/image non modifiable) ou `kind = note` (UI **« Instructions »**, Markdown éditable). Un `file` porte un état d'absorption `read` (✦ lu, injecté dans les prompts) / `ignored` (écarté du retrieval), décidé par Relvo. Pas de page « Connaissances » séparée.
19. Ajout de document = drag-and-drop d'un PDF dans l'onglet Documents. **Deux stockages, jamais un seul** : le fichier vit dans **Cloudflare R2** (`storage_key` — une **clé d'objet, pas une URL** : bucket privé, URLs signées à la demande ; source de vérité et seule voie d'affichage à l'utilisateur) et une copie part vers la **Files API Anthropic** (`anthropic_file_id`) pour l'inférence. La Files API est en **écriture seule** — un fichier uploadé porte `downloadable: false` et n'est jamais relisible. Upload = **navigateur → R2 via URL pré-signée** (une Vercel Function plafonne le body à 4,5 Mo, une Server Action à 1 Mo — le PDF ne transite pas par le code).
20. V1 : seul l'utilisateur édite les Instructions ; Relvo les consulte sans les modifier.

**Chatbot Relvo**
21. Deux modes : **Accueil** = brief structuré (pas un chat) ; **échange** = surface **plein écran** accessible partout (`/relvo`).
22. **Échange plein écran** (mobile-first) à `/relvo`, ouvert depuis le **bouton Relvo en haut à droite du header** (présent sur toutes les pages, sauf dans l'échange lui-même). Page-aware : le bouton transmet la page d'origine (`?from=`) pour le chip de contexte, les prompts et le retour. L'historique (`/relvo/historique`) est atteint depuis l'échange (icône horloge). ⚠️ **« Échange » et non « conversation »** (2026-07-20) : depuis M6bis, une **Conversation** est une entité de données — le fil avec un interlocuteur externe. Cf. `02-modele-donnees.md §5bis`. Plus de composer persistant en bas, plus de drawer latéral 40 % (décision 2026-06-27 ; l'ancien composer du bas créait de l'encombrement, un hidden-menu et une confusion avec le composer destinataire de la fiche Sujet).
23. Conversations chat **éphémères en IndexedDB** (aucune entité serveur en V1). Ce qui persiste = actions + résultats.
24. Sessions implicites (seuil 5 min). Bouton « + Nouvel échange ». Liste des N derniers.
25. **Action-capable day-one** : chaque opération UI a un tool API correspondant (même fonction métier). Actions rendues en blocs visuels annulables. Le brouillon atterrit dans le composer, jamais envoyé directement.
26. **Page-aware** : URL + contexte transmis à chaque tour. Chip de contexte en haut de l'échange.
27. Stack chatbot : AI SDK + AI Gateway, tool calls natifs (pas de MCP en V1), prompt caching, Files API, citations.
28. **Empty state** : 3-4 prompts d'exemple contextuels à la page, en gris italique (pas de fausses bulles).
29. **Pas de RAG vectorielle** : long context + prompt caching pour les Connaissances, tool calls pour les données dynamiques.

**Actions & tâches (Accueil)**
30. **L'Accueil (« Actions ») est la page des TÂCHES**, pas des sujets (décision 2026-06-28). Header **« Bonjour … » + sous-titre « Actions du jour »** (identifie la page → contextualise les KPI ; le « Brief du jour » de Relvo est **retiré**, sans valeur pour l'instant) + barre KPI Tâches + **2 onglets** : **Agenda** (semainier) et **À trier**. La barre KPI est **contextuelle par page** : KPI Tâches sur Actions, KPI Sujets sur la page Sujets — jamais les deux lentilles sur un écran. **Taxonomie des tâches** dérivée de `start_date`/`start_time` (zéro migration) : **RDV** (date+heure), **tâche datée** (date sans heure), **flottante / à trier** (sans date). Marqueur dérivé **« En retard »** = tâche ouverte à échéance < aujourd'hui (granularité jour ; une flottante n'est jamais en retard). **L'onglet « En retard » dédié est SUPPRIMÉ** (décision 2026-06-28 *quater*) : le retard se gère désormais **dans le semainier** — on slide vers les jours passés (badges rouges) pour traiter / replanifier les tâches échues. Le compteur KPI « En retard » reste.
31. **Présentation UNIQUE des tâches** (`TaskItem`) partout — liste d'un sujet ET listes à plat : **case à cocher** (gauche, distingue une tâche d'un sujet) + titre + sujet (+ interlocuteur si à plat) + heure éventuelle. Le **badge créateur** (Relvo/Moi) **n'est PAS dans la ligne** (trop chargé) — on le retrouve dans la modale. Chaque tâche porte **le titre du sujet en clair**. Cocher = terminer / décocher = remettre « à faire » (`reopenTask`) ; **pas de swipe**. Tap sur la ligne = **modale** (titre, date/heure, **sujet rattaché — affiché + (ré)assignable/détachable**, suppression). État fait = **barré + fond gris** ; **tâche en retard = fond rouge clair** (`--red-50`, date/heure inchangées en rouge). **Rail de couleur** (3 px, **entre la case à cocher et le texte** — pas au bord d'écran, sinon invisible) = **domaine** (Folder) hérité du sujet (`folderColor(folderSlug)`). **Colonne droite ~22 %** réservée à l'**heure** (RDV) et à la **date** selon le contexte (`meta` = none/time/date) ; la **date n'apparaît PAS** dans les listes à plat de l'Accueil (le semainier porte déjà le jour) — **uniquement dans la liste d'un sujet**. **Semainier (onglet Agenda)** : **rail de jours** qui glisse librement de gauche à droite (**scroll horizontal natif, sans chevrons**), **aujourd'hui centré** au chargement ; fenêtre **bornée** (±21 j) — au-delà, passer par le mois `/planning`. Chaque jour porte un **badge** (rouge = nb en retard pour les jours passés, bleu = nb à faire pour aujourd'hui/futur) et est une **zone de dépôt** ; une tâche du jour sélectionné se **déplace par long-press → drag** (dnd-kit, collision `pointerWithin` → c'est la **position du curseur** qui désigne la cellule, pas le bord de la tâche) sur un autre jour du rail (réécrit `start_date`, optimiste) — même geste que le mois `/planning`. La **miniature de drag** (`DragOverlay`) est **centrée sur le curseur** (modifier `snapCenterToCursor`). Dans une liste à plat, le **sujet sous le titre est un lien** (souligné) vers sa fiche ; il transmet `?from=<page courante>` → le bouton **Retour** de la fiche revient à l'écran d'origine (ex. Actions). La **modale tâche** affiche une **pastille de couleur du domaine** à gauche du champ Sujet, et **« Retirer la date » = croix** (cohérent avec le détachement du sujet).
32. **Une tâche peut ne pas avoir de sujet** (`Task.subjectId` **nullable**, migration 2026-06-28). Créée « à la volée » via le **bouton « + » du header Actions** (modale, sujet optionnel) ou détachée depuis la modale. La FK reste en cascade (supprimer un sujet supprime ses tâches rattachées).

## Conventions

- **TypeScript partout.** Les enums (`Actor`, `Status`, `Priority`, `Kind`, `TriageHint`) découlent du schéma Prisma (`packages/db`).
- **Tailwind + Shadcn.** Conserver la palette navy (#0A1128) / blue (#2B6FE0) / red (#E63150) + neutres (thème dans `apps/web/src/app/globals.css`).
- **🔒 Réflexe shadcn obligatoire — ne jamais créer un composant UI sans vérifier shadcn d'abord.** Dès qu'un composant graphique doit être envisagé (bouton, dialog, table, calendrier, sélecteur de date, sheet/drawer, toast, form, etc.), la première action est **toujours** d'interroger le **MCP shadcn** (`.mcp.json` à la racine) pour voir s'il existe déjà dans le registre. Workflow impératif, dans cet ordre :
  1. **Chercher** dans le registre shadcn via le MCP (search + view de la démo/du code).
  2. **Trouvé** → l'installer (`pnpm --filter web exec shadcn add <composant>`) et l'adapter au thème Relvo. Ne pas le réécrire à la main.
  3. **Partiellement couvert** → **composer** à partir des primitives shadcn existantes (`Button`, `Dialog`, `Popover`…) plutôt que repartir de zéro.
  4. **Absent du registre** (dernier recours seulement) → créer un composant sur mesure, mais en réutilisant les tokens du thème et les conventions shadcn (`cn()`, variants `cva`, structure de `src/components/ui`).

  Créer une primitive from scratch alors qu'un équivalent shadcn existe est considéré comme une **erreur de process**, pas un choix esthétique.
- Server Components par défaut ; `"use client"` ciblé (drawer chat, drag-and-drop, formulaires interactifs).
- Données métier dynamiques (sujets, messages, tâches) → tool calls / DB. Connaissances statiques → prompt caching.
- Page active dans la nav = classe `.active` (ou équivalent state) sur l'entrée correspondante.

## Données de référence (cohérence inter-écrans)

Données fictives mais réalistes, inspirées du cas **Tasty Crousty** (chaîne de restauration). À garder cohérentes partout :

- **Karim Benali** (SoGood Distribution) — fournisseur, SUB-0142 (sauce blanche)
- **Sophie Blanchard** — RH, SUB-0148 (congé maternité)
- **ClimaPro Services** — juridique, SUB-0082 (contrat climatisation)
- **Restaurant Le Palais** — business, SUB-0131 (virement client)
- **PackPlus SARL** — fournisseur, SUB-0103 (papier emballage)
- **FroidExpert SA** — production, SUB-0117 (congélateur Narbonne)
- **J. Morel** — contact inconnu, message sans sujet
- **Marie Campos** — comptable, message sans sujet

## Commandes

```bash
pnpm install                          # installe le monorepo
pnpm --filter web dev                 # dev de l'app Next.js
pnpm --filter db prisma migrate dev   # migrations DB
pnpm --filter db prisma studio        # explorer la base
pnpm --filter db test                 # tests d'invariants + domaine (base relvo_test)

# Déploiement : git push → Vercel déploie apps/web (déployable unique)
```

## Scope V1 (rappel)

**Inclus (MUST)** : modèle `Account`/`Actor`, Dossiers (Sujets + Connaissances), modèle de date riche, calendrier semaine + planning mois + drag-and-drop, statuts fidèles + drapeau urgent rare, chatbot drawer action-capable page-aware, WhatsApp **et** email dès V1 (via **Unipile**), citations API (UI minimale), pièces jointes **niveau 1** (étiquetage Haiku).

**Reporté V2** : page Activité standalone, pièces jointes niveau 2/3, édition de notes par Relvo, chatbot cross-device, UI riche citations, scope `subject` pour KnowledgeDocument, affectation tâche → utilisateur, WebSocket temps réel.

**Réflexe d'arbitrage** : simplifie l'usage food/bâtiment ? → V1. Renforce le chatbot comme surface d'action ? → V1. Peut attendre 2 mois ? → V2. Ressemble à du power-user/analytics ? → V2.
