# Backlog fonctionnel — Relvo V1

> Ensemble des tâches à réaliser pour livrer la V1 de Relvo. S'appuie sur les documents de conception ([`../conception/`](../conception)) et sur la spécification technique ([`../spec/architecture.md`](../spec/architecture.md)). Les choix de stack ne sont **pas** répétés ici : ils vivent dans la spec.

---

## État d'avancement

> Suivi haut niveau. Légende : ✅ fait · 🟡 partiel · ⏸️ reporté · ⬜ à faire. Dernière mise à jour : 2026-07-20.

| Module | État | Note |
|---|---|---|
| **M1** — Fondations techniques | 🟡 **clos (fonctionnellement atteint)** | Socle + déploiement web (Vercel) + base prod (Neon) faits. M1.5 / M1.7 / M1.9 reportés. ⚠️ Les items **worker** (scaffold `apps/worker`, Railway/Render, Sentry worker) sont **caducs** depuis la bascule Unipile (M5) : plus de worker à héberger. Détail inline en §4. |
| **M2** — Auth & multi-tenant | ✅ **fait** | Auth.js v5 (Credentials + Google OAuth, sessions JWT), `proxy.ts` (Next 16), helper tenant + client Prisma tenant-aware (`$extends`), signup public, vérif email + reset via Resend, onglet Profil. Détail inline en §4. |
| **M3** — Modèle de données & accès CRUD | ✅ **fait** | Couche domaine partagée `packages/db/src/domain/` (tenant-aware, fonctions pures réutilisables par le worker M7), conventions (Zod, DomainError, pagination curseur, `logEvent`), 8 domaines CRUD + agrégations (KPIs/feed/sans-sujet), Server Actions web (wrappers `ActionResult`), seeds Tasty Crousty, 7 tests d'invariants vitest (base `relvo_test`). Détail inline en §4. |
| **M9** — Pages applicatives front | ✅ **clos (2026-06-30)** | Les 7 pages reproduites en React/Next (mobile-first « Direction B »), cliquables et branchées sur le seed démo, + PWA installable. Divergences vs plan d'origine assumées (statut 4 valeurs, priorité 2 valeurs, dock 4 onglets, Accueil = page des tâches, Messages = pile d'orphelins). **Démo client validée le 2026-06-29** (retour très positif). Améliorations continues à venir « au fil de l'usage », hors jalon. Détail : §5 + plan de clôture M9.18→M9.24. |
| **M4** — Stockage fichiers | ✅ **clos (2026-07-15)** | **Cloudflare R2** (bucket juridiction `eu`), package partagé `@relvo/storage`, upload navigateur pré-signé, download authentifié (URL stable → 307 vers URL signée 5 min, `?inline=1`), suppression par **outbox alimentée par trigger PostgreSQL** (seul mécanisme qui capte les cascades — Prisma en est aveugle), fixtures de démo en git. M4.1→M4.6 faits ; **M4.7** (uploads abandonnés → préfixe `pending/` + lifecycle R2) reporté **à M11**, qui apporte l'UI d'upload ; **M4.8** (balayage) reporté sur preuve de dérive. Détail inline en §4. |
| **M5** — Ingestion email | ✅ **clos (2026-07-17)** | **Bascule Unipile** (agrégateur managé email + WhatsApp) — abandon du forwarding Postmark **et du worker Baileys**. Réception (orphelin + **auto-rattachement** interlocuteur+objet), **envoi HTML « au nom de » l'utilisateur**, PJ → R2 + **visualiseur** (lightbox/navigateur), **suppression de canal** (hard-delete + `account.delete` Unipile), UI Canaux (hosted auth un-clic). Validé end-to-end en prod. Détail + raffinements M5.9→M5.13 : §M5. |
| **M6** — Ingestion WhatsApp | 🟡 **code livré (2026-07-18), validation prod à faire** | Via **Unipile** (webhooks serverless, plus de worker Baileys) — pattern M5 dupliqué : connexion QR hosted auth, réception (orphelin + **rattachement par fil `chat_id`**), envoi dans un fil existant, médias → R2. **Aucune migration** (modèle déjà channel-agnostic). 6 tests verts + typecheck propre. Reste : déclarer le webhook `messaging` côté Unipile + valider end-to-end (QR device réel, anti-loop écho). Détail : §M6. |
| **M6bis** — Refonte « Conversation » | ✅ **livré (2026-07-20)** — 58 tests verts, `db`+`web` compilent, build OK. Migration **répétée sur base jetable** avec jeu d'essai (préfixes `Re:`, sortants, groupe, objet nul, 4 anciens statuts) : 0 message sans conversation. ⚠️ **À rejouer sur une copie de la prod avant application réelle.** | Introduit l'entité **`Conversation`** entre Message et Subject : le tri devient **déterministe à la réception** (clé par canal), et le `Subject` devient une **fenêtre de travail** ancrée sur un message, avec appartenance **message par message** (seule façon de traiter les sujets **entrelacés** d'un fil WhatsApp direct). Statuts sujet → `ouvert/validé/fermé` ; l'**ignoré migre sur la conversation**. **Bloque M7.** Rend caducs `/messages`, `assignMessageToSubject` et le balayage des frères. **Migration de données non triviale** (créer les conversations rétroactivement). Détail : §M6bis. |
| **M6ter** — UX par canal (email ≠ WhatsApp) | ⬜ **à faire** — décidé le **2026-07-20**, **corrigé et SIMPLIFIÉ le 2026-07-21** | **Vocabulaire : un sujet ÉCOUTE une conversation** (« fenêtre » est retiré ; `anchor_message_id` / `closing_message_id` **sont** le début et la fin d'une écoute — aucune migration de plus). Côté **email** un sujet n'écoute rien : il **EST** le fil (⚠️ **balayage du fil ENTIER**, amont compris). ⚠️ **SUPPRIMÉS le 2026-07-21** : le **cordon** (rail coloré par message), la **poignée d'ancre** glissante, dnd-kit sur l'ancre, l'aperçu en direct, le **défaut d'ancre**, le **tap-pop-up** sur message, le **rattachement/détachement message par message**, et la **réouverture automatique d'un sujet email**. **Gestes** : email = swipe droite sur la **CONVERSATION** (nouveau sujet / rattacher) ; WhatsApp = swipe droite sur le **MESSAGE** (crée le sujet **et** remonte une écoute existante) ; **tap = pièces jointes uniquement**. **Bandeau « Suivi dans » + « N sujets passés » sur les DEUX canaux.** **Arrêts** : `fermé` → toutes les écoutes cessent ; `validé` → la conversation n'alimente plus ; **ignorer = PAUSE** avec **confirmation nommant les sujets**. **« Fermer » = suppression douce** → onglet **Fermés** + **Remettre**. **Fiche sujet : une seule conversation affichée**, ligne sélecteur → feuille de gestion des écoutes. Détail : §M6ter. |
| M7 → M8, M10 → M14 | ⬜ à faire | **M11 (Connaissances)** branche l'UI d'upload sur le socle M4 et débloque M7 **et** M10. M7 (pipeline IA) ouvre des Sujets sur les **conversations orphelines** de M6bis — même mécanique d'ancrage que le mode manuel, seul l'acteur change. |

> **⚠️ Migration de schéma requise avant/avec M9** — refonte UX mobile-first (2026-06-18). Le modèle de conception a évolué ([`02-modele-donnees.md`](../conception/02-modele-donnees.md)) ; à répercuter dans `packages/db/prisma/schema.prisma` :
> - `Status` : `enum(new, to_do, waiting, unread, resolved, archived)` → **`enum(acknowledged, resolved, archived, ignored)`** (cycle de vie exclusif ; `to_do`/`waiting`/`unread` **et `new`** deviennent des marqueurs, pas des statuts — `new` retiré le 2026-06-27, « Nouveau » dérivé de `last_opened_at == null`).
> - `Priority` : `enum(low, medium, high, critical)` → **`enum(low, high, critical)`** (`medium` retiré).
> - `Subject` : + **`waiting_for_reply Boolean @default(false)`** (marqueur « En attente » posé par Relvo).
> - `KnowledgeDocument` : + **`absorption_status enum(read, ignored) @default(read)`** (Relvo absorbe ✦ ou écarte un `file`).
> - Renommages **UI seulement** (aucune migration) : nav **« Mémoire »** (ex-Dossiers, icône cerveau), onglets **« Instructions »** (`kind=note`) / **« Documents »** (`kind=file`), action **« Terminer »** (ex-Résoudre). Cible mobile = **PWA** (cf. [`architecture.md §4`](../spec/architecture.md)).

---

## 1. Résumé du projet

**Relvo** est un assistant IA de pilotage des sollicitations professionnelles. Il transforme le flux désordonné de messages reçus par un dirigeant (emails, WhatsApp) en **sujets métier structurés**, avec tâches, journal de bord et aide à la décision.

Le produit est destiné à des dirigeants des secteurs **food** et **bâtiment**. Ces utilisateurs ne sont pas familiers des SaaS bureautiques (Notion, Hubspot, Pipedrive) mais connaissent ChatGPT et Claude. La promesse V1 doit donc être lisible immédiatement et minimaliste à la prise en main.

**Posture produit assumée** : « l'UI sert à accéder à l'info, Relvo sert à agir ». Les utilisateurs cibles feront l'essentiel de leurs actions via le chatbot intégré plutôt que via les écrans. Cette posture oriente toutes les décisions de scope.

### Concepts centraux

- **Subject** — entité centrale du produit. Un sujet regroupe les messages, les pièces jointes, les tâches et les événements liés à une situation métier en cours.
- **Triptyque d'acteurs Moi / Relvo / Externe** — chaque événement est typé par son acteur (`user`, `ai`, `contact` côté modèle).
- **Chaîne fondamentale** — `Message → Task → Action → LogEvent` structure tout le produit.
- **Acquittement implicite** — ouvrir une fiche de sujet vaut acquittement des suggestions de Relvo, sans bouton « valider ».

---

## 2. Périmètre V1

### Cible de la première mise en ligne

**Bêta privée gratuite**, 3 à 10 comptes provisionnés manuellement. Pas de facturation à ce stade. Stripe est explicitement reporté en V1.1, après validation produit auprès des premiers utilisateurs.

### Inclus en V1

- Multi-tenant via entité `Account` racine
- Triptyque d'acteurs avec badges UI Moi / Relvo / Externe
- Ingestion email et WhatsApp via **Unipile** (agrégateur managé, webhooks serverless — plus de worker Baileys ; bascule 2026-07-16)
- Pipeline IA d'arrivée : compréhension, classement, rattachement, création de Subject + Contact, génération de tâches et brouillon, extraction de date
- 4 onglets de nav (barre basse) : Accueil (brief), Mon fil (workspace), **Mémoire** (Dossiers), **Réglages**
- Pages hors-nav : Planning (vue mois), **Messages (pile d'orphelins « Sans sujet »)**, Contacts (+ fiche), Recherche, fiche Sujet, page Message `/messages/[id]`
- **Conversation Relvo plein écran**, action-capable, accessible partout via le **composer persistant** (plus de drawer latéral), avec ~22 tools symétriques à l'UI
- Calendrier semaine sur l'Accueil + vue mois sur Planning, avec drag-and-drop
- Connaissances : PDFs uploadés (Files API Anthropic) + notes Markdown, organisés par Folder
- Pièces jointes IA **niveau 1** uniquement (étiquetage Haiku automatique) ; niveaux 2-3 reportés V2
- Citations natives Anthropic activées (affichage UI minimal)
- Statuts UI fidèles au modèle (6 valeurs) + drapeau urgent binaire

### Reporté en V2

- Stripe et gestion des plans
- Page Activité standalone (KPIs long terme, courbe 8 semaines, fil EventLog)
- Pièces jointes IA niveaux 2 (résumé Sonnet) et 3 (analyse profonde à la demande)
- Édition de notes par Relvo (V1 = utilisateur seul édite)
- Cross-device chatbot (V1 = IndexedDB côté client)
- UI riche pour les citations (panneau latéral, surlignage)
- Affectation d'une tâche à un utilisateur spécifique (V1 = un compte = un humain)
- WebSocket temps réel (V1 = polling 30 s)

---

## 3. Convention d'identifiants

- Chaque tâche porte un identifiant `Mx.y` (module, ordre dans le module).
- Les tâches d'un même module peuvent être réalisées dans un ordre flexible mais respectent les dépendances inter-modules listées en §5.

---

## 4. Backlog détaillé par module

### M1 — Fondations techniques

**Objectif** : poser le socle technique qui conditionne tout le reste du projet. Détail de la stack : [`../spec/architecture.md`](../spec/architecture.md).

**Dépendances** : aucune (point de départ).

- **M1.1** ✅ — Setup monorepo **pnpm workspaces** (`apps/web`, `apps/worker`, `packages/db`) + Turbo optionnel
- **M1.2** ✅ — `packages/db` : Prisma + PostgreSQL local via Docker Compose + enums partagés (`Actor`, `Status`, `Priority`, `Kind`, `TriageHint`) _(NB : Prisma **7** — driver adapter + `prisma.config.ts` ; schéma complet des 12 entités + migration `init` appliquée)_
- **M1.3** ✅ — Scaffold `apps/web` : Next.js App Router + Tailwind + Shadcn CLI init + application du thème navy/blue/red défini dans la maquette
- **M1.4** — ~~Scaffold `apps/worker`~~ **Caduc** (bascule Unipile 2026-07-16 : plus de worker). Le scaffold éventuel est à retirer.
- **M1.5** ⏸️ _(reporté)_ — Logger structuré pino + Sentry (**web** ; volet worker sans objet)
- **M1.6** ✅ — Configuration ESLint, Prettier, Husky (pre-commit hooks) _(Prettier + plugin Tailwind + Husky + lint-staged faits ; ESLint = web seulement, à étendre db avec M1.7)_
- **M1.7** ⏸️ _(reporté)_ — Pipeline CI GitHub Actions (lint + typecheck + tests sur PR)
- **M1.8** ✅ — Déploiement Vercel (`apps/web`, Root Directory) + base Neon prod + migrations au build (`vercel-build`). ~~Railway/Render (`apps/worker`)~~ **sans objet** (déployable unique depuis la bascule Unipile).
- **M1.9** ⏸️ _(reporté)_ — Healthcheck (route `apps/web` ✅) + UI debug côté front

---

### M2 — Auth & multi-tenant

**Objectif** : sécuriser l'accès à l'application et garantir l'isolation tenant systématique via `account_id`.

**Dépendances** : M1.

- **M2.1** ✅ — Auth.js avec provider Credentials (email/password + bcrypt, 12 tours)
- **M2.2** ✅ — Auth.js avec provider Google OAuth _(branché conditionnellement si `AUTH_GOOGLE_ID/SECRET` présents ; find-or-create du compte par email dans le callback `signIn`)_
- **M2.3** ✅ — Sessions Auth.js **JWT** (pas de table Session) + **`proxy.ts`** _(Next 16 a renommé `middleware.ts`)_ de protection des routes. Config split edge-safe (`auth.config.ts`) / Node (`auth.ts`)
- **M2.4** ✅ — Helpers serveur `getCurrentAccount` / `requireAccount` / `requireAccountId` (`src/server/auth-context.ts`) — `account_id` toujours dérivé de la session
- **M2.5** ✅ — Pages FR `/connexion`, `/inscription`, `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe`, `/verifier-email` (Server Actions + `useActionState`, primitives shadcn ; le composant RHF `form` n'existe pas dans le registre base-ui)
- **M2.6** ✅ — `createAccount()` réutilisable : `Account` + Folder « Général » (`is_default`) + EventLog `account_created`, en transaction
- **M2.7** ✅ — Emails de vérification **et** de reset via Resend (`src/lib/email.ts`) ; sans `RESEND_API_KEY`, le lien est logué (dev). Jetons en table `verification_tokens`
- **M2.8** ✅ — Client Prisma tenant-aware via `$extends` (`src/lib/tenant-db.ts`, `getTenantDb()`) : injection auto de `account_id` sur where/data. _Caveat documenté : update/delete par clé unique non scopés — passer par updateMany/deleteMany_
- **M2.9** ✅ — Page `/parametres` → onglet Profil (nom/email + mot de passe ; gère le cas Google-only sans mot de passe). Onglets Canaux/Contacts en placeholder (M5/M9)

> **Changements de schéma (migration `auth_multi_tenant`)** : `Account.passwordHash` → nullable (comptes Google-only) ; ajout `emailVerified`, `image`, `googleId` ; nouveau modèle `VerificationToken` + enum `VerificationTokenType`.

---

### M3 — Modèle de données & accès CRUD

**Objectif** : implémenter le modèle de données décrit dans [`../conception/02-modele-donnees.md`](../conception/02-modele-donnees.md) et exposer les opérations CRUD (Server Actions + Route Handlers) pour chaque entité.

**Dépendances** : M2 (tous les accès sont tenant-aware).

- **M3.1** ✅ — Schéma Prisma des 12 entités _(déjà posé en M1/M2 ; vérifié, `prisma generate` propre — aucune nouvelle migration nécessaire)_
- **M3.2** ✅ — Seeds de dev `prisma/seed.ts` (jeu Tasty Crousty cohérent maquettes : 6 dossiers, 6 contacts, 3 canaux, 6 sujets SUB-xxxx, 8 messages dont 2 « Sans sujet », tâches datées, brouillon, notes, EventLog). Idempotent (reset par email). S'appuie sur la couche domaine via le client tenant
- **M3.3** ✅ — Conventions d'accès (`packages/db/src/domain/`) : validation **Zod** co-localisée par domaine, `DomainError` (code + httpStatus), `ActionResult<T>` + `tryAction`, **pagination curseur** (`cursorArgs`/`toPage`), `ensureAffected` (mutation par id tenant-safe via updateMany). _Route Handlers : convention posée (mapping `httpStatus`), endpoints ajoutés au besoin (M5/M10)_
- **M3.4** ✅ — Domaine **Folders** : CRUD + invariant Folder « Général » (suppression interdite, jamais de Subject)
- **M3.5** ✅ — Domaine **Contacts** : CRUD + transition `auto` → `complete` (`completeContact`) + filtre `listContacts({ status })`
- **M3.6** ✅ — Domaine **Channels** : CRUD + ChannelConfig (upsert 1-1, `connection_data` jsonb, status, `last_sync_at`)
- **M3.7** ✅ — Domaine **Subjects** : CRUD + transitions de statut **validées** (map `TRANSITIONS`) + `updateSubjectPriority`/`ignoreSubject` (dépriorisation d'un cran) + `openSubject` (acquittement implicite) + `suggestResolution` + référence auto `SUB-NNNNN`. Invariant folder Général respecté
- **M3.8** ✅ — Domaine **Messages** : CRUD + `assignMessageToSubject` (cas M), `ignoreMessage` (cas N), `reassignMessage`/`detachMessage` (cas O), `triage_hint` réservé aux messages sans sujet
- **M3.9** ✅ — Domaine **Tasks** : CRUD + `completeTask` + `completion_mode` + 4 champs date (règle start=deadline) + soft delete
- **M3.10** ✅ — Domaine **Attachments** : CRUD + setters IA idempotents (`ai_label`/`ai_summary`/`ai_analysis` avec flag de cache horodaté)
- **M3.11** ✅ — Domaine **Actions** : CRUD + `createDraftReply` (brouillon send_message, payload jsonb) + `markActionDone` + `cancelAction`
- **M3.12** ✅ — **EventLog** via helper explicite `logEvent(...)` appelé dans la transaction de chaque mutation (`event_type`/`actor`/titre sémantiques) — choix retenu vs extension générique pour un journal lisible
- **M3.13** ✅ — Requêtes d'agrégation (`queries.ts`) : `getKpis` (sujets ouverts, messages à trier, tâches du jour, % d'aide Relvo), `getPriorityFeed` (`priority IN (critical, high)`), `listOrphanMessages` (« Sans sujet »)
- **M3.14** ✅ — Tests vitest d'invariants (base dédiée `relvo_test`, migrate auto) : isolation tenant (lecture + mutation), Folder Général sans Subject + non supprimable, transitions de statut, `triage_hint`. _« Contact non créé sans Subject » garanti par l'absence de chemin auto en M3 (respecté par le pipeline M7)_

---

### M4 — Stockage fichiers

**Objectif** : gérer le stockage et la diffusion sécurisée des fichiers uploadés (pièces jointes, documents de Connaissances).

**Dépendances** : M2. **M4 bloque M11** (upload PDF → Files API), qui bloque **M7** et **M10**.

**➡️ M4 CLÔTURÉ le 2026-07-15.** M4.1→M4.6 livrés et vérifiés contre le vrai bucket (aller-retour d'upload, isolation inter-tenants, cascade à 2 niveaux captée par le trigger, drainage réel). **M4.7, M4.8 et M4.9 restent ouverts mais ne bloquent pas** : M4.7 attend M11 (il lui faut l'UI d'upload pour avoir un sens), M4.8 est un filet à n'ajouter que sur preuve de dérive, et **M4.9 est un risque connu et assumé** (bucket unique dev/prod — reporté explicitement, pas oublié).

> **⚠️ Action requise avant la mise en prod de M11** : poser `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_JURISDICTION` et `CRON_SECRET` sur Vercel. Sans elles : le cron de drainage échoue en 500 chaque nuit, et toute route fichier lèverait — sans impact aujourd'hui puisque aucune UI ne les appelle. _(Les PJ email/WhatsApp récupérées via Unipile s'écrivent aussi dans R2, côté `apps/web` — plus de worker à configurer.)_

> **Fournisseur retenu : Cloudflare R2** (décision 2026-07-15, benchmark vs Vercel Blob / S3+CloudFront / Supabase / UploadThing). Justification complète dans [`../spec/architecture.md §5`](../spec/architecture.md). En bref : API S3-compatible (un client générique dans `packages/storage`, outillage connu, sortie possible), free tier permanent couvrant toute la bêta sans imposer Vercel Pro, setup en 1 bucket + 1 token. **Le coût n'a pas départagé** — les trois options sont sous 2 $/mois à l'échelle V1.
>
> **Pas de CDN** : les fichiers sont privés et cloisonnés par tenant, consultés par 3-10 utilisateurs. Un cache edge n'apporte rien et, chez R2, les URLs pré-signées ne fonctionnent que sur le domaine S3 API — cache et pré-signature sont **mutuellement exclusifs**. À rouvrir seulement si un usage public de fichiers apparaît.

- **M4.1** ✅ — Setup Cloudflare R2 : bucket `relvo-files-prod` en **juridiction `eu`** (résidence RGPD — figée à la création, conditionne l'endpoint `<account>.eu.r2.cloudflarestorage.com`), token de **compte** en « Object Read & Write » scopé au bucket. Un seul environnement (bêta) : le dev local écrit dans le même bucket, isolé par le préfixe `accounts/<id>/`. Vérifié par `pnpm --filter @relvo/storage smoke` (aller-retour réel + contrôle que le bucket n'est pas public)
- **M4.2** ✅ — Package `@relvo/storage` isolant le fournisseur (presign-put / presign-get / put / delete / head) — la couche domaine ne connaît que `storage_key`, chaîne opaque ⇒ le choix reste réversible
- **M4.3** ✅ — Upload **navigateur → R2 via URL pré-signée** émise par un Route Handler authentifié (obligatoire : body plafonné à 4,5 Mo sur une Vercel Function, 1 Mo sur une Server Action).
  - ⚠️ **Deux réglages non négociables du SDK AWS**, trouvés à l'audit de conformité du 2026-07-15 et vérifiés contre le vrai bucket :
    - **`signableHeaders: new Set(["content-type"])`** sur `getSignedUrl`. Le presigner met `content-type` dans ses `unsignableHeaders` **par défaut** — sans cette option, un PUT en `text/html` sur une URL signée pour `application/pdf` renvoyait **HTTP 200** et R2 stockait `text/html`. L'allowlist MIME ne contraignait donc **rien**. Corrigé → 403.
    - **`requestChecksumCalculation`/`responseChecksumValidation: "WHEN_REQUIRED"`** sur le `S3Client`. Depuis la v3.729 le SDK injecte `x-amz-checksum-crc32` dans l'URL pré-signée ; à la présignature il n'y a pas de corps, donc c'est le **CRC32 du vide** (`AAAAAA==`). R2 liste ces en-têtes comme non implémentés et les ignore — nos uploads passaient **par chance**. S'il les validait, tout upload non vide échouerait.
  - Ces deux propriétés dépendent de **défauts du SDK qui ont déjà changé une fois** et cassent en silence (l'upload continue de marcher, seule la garantie disparaît) → verrouillées par `packages/storage/test/presign.test.ts`.
  - Pas de `forcePathStyle` (le SDK signe en virtual-hosted, R2 l'accepte), `region: "auto"` (valeur documentée par Cloudflare, non utilisée par R2).
- **M4.4** ✅ — Download avec contrôle d'accès tenant : pathname `accounts/<account_id>/...`, **résolu depuis la DB scopée par `getTenantDb`, jamais depuis un input utilisateur**, auth vérifiée dans le Route Handler (pas en middleware). **URL stable + redirection 307 vers une URL signée 5 min** — l'architecture par défaut d'ActiveStorage (`url_for` → `/rails/active_storage/blobs/redirect/…` → 302 vers une URL de service, `service_urls_expire_in` = 5 min), en version **authentifiée** (le défaut Rails ne l'est pas : « *Anyone who knows the URL can access the file, even if the rest of your application requires authentication* » — d'où les « Authenticated Controllers » qu'il recommande pour les fichiers sensibles ; tous les nôtres le sont). `?inline=1` → affichage dans la page (`<img>`, `<iframe>`) ; défaut → téléchargement sous le vrai nom.
  - **Pourquoi pas une URL signée directement dans le composant** : la clé de cache de Vercel inclut la query string ⇒ une signature qui tourne = MISS systématique = « *billed as an image transformation and image cache write* » (cas documenté : 10 images → 150+ transformations en 12 h). `remotePatterns.search` fait du **match exact**, donc inutilisable ; l'omettre ouvre un **proxy d'optimisation** sur tout le hostname.
  - **Pourquoi pas streamer les octets** : « *Vercel Functions […] should be treated like a lightweight API layer, not a media server* » (Vercel), et le body de réponse plafonne à 4,5 Mo.
  - **`images.maximumRedirects: 1`** (`next.config.ts`) : l'optimiseur suit les redirections « *without validating remotePatterns again on the redirect location* » — une origine autorisée qui redirige fait sauter la frontière. 1 suffit à notre chaîne.
  - **`Cache-Control: private` + `Vercel-CDN-Cache-Control: no-store`** sur les redirections. Défense en profondeur : la clé de cache d'un CDN est méthode + URL, sans header de requête ⇒ même clé pour tous les utilisateurs. Incident Railway 2026-03-30 (cache activé par accident, « *requests for one user [served] to a different user* ») : seules les apps envoyant `private` explicitement ont été épargnées.
  - **Pas de bucket public / pas de clivage « avatars publics »** : Relvo n'a **aucun fichier non sensible** (`Contact` n'a pas de photo, `Account.image` est une URL Google OAuth hors R2). Tout ce qui entre dans le bucket est de la donnée métier. Le pattern multi-services de Rails (`public: true`) est documenté mais Rails ne prescrit **nulle part** « avatars publics / documents privés » — c'est une inférence de communauté. Sans objet ici.
  - ⚠️ **Contrainte R2 structurante** : « *Presigned URLs cannot be used with custom domains* » ⇒ URL pré-signée et cache/transformations CDN sont **mutuellement exclusifs**. Si un jour le cache CDN devient nécessaire, il faudra un Worker + binding R2 (l'auth vit dans le Worker), pas une URL signée.
- **M4.5** ✅ — Validation des uploads : **allowlist MIME par scope** (Connaissances ≠ pièces jointes) + plafond de taille (32 Mo / 64 Mo). Pas de vérification d'extension : elle était redondante et ne produisait que des faux positifs — le vrai rempart est la **signature du `content-type`** (M4.3), et aucun MIME dangereux n'est dans l'allowlist. Le nom de fichier n'est pas demandé à l'upload (il ne sert pas à la clé et vit en base)
- **M4.6** ✅ — Cycle de vie des fichiers : **outbox transactionnel alimenté par trigger PostgreSQL** (décidé le 2026-07-15 après revue des pratiques Rails / Django / WarpStream).

  **Pourquoi pas la suppression synchrone** (première approche, abandonnée) : Django l'a **retirée en 1.3** pour cause de perte de données — *« This opened the door to several data-loss scenarios, including rolled-back transactions and fields on different models referencing the same file »*. Rails l'interdit en transaction : *« Deleting files off the service will initiate an HTTP connection which may be slow or prevented, so you should not use [purge] inside a transaction or in callbacks; use purge_later instead. »* Et elle est **structurellement incapable** de voir les cascades.

  **Pourquoi pas le balayage de réconciliation** : il supprime sur une **différence calculée**. Si la requête listant les `storage_key` renvoie vide (filtre cassé, migration en cours), il conclut que tout est orphelin et vide le bucket. Sans versioning R2 → irrécupérable. L'outbox ne supprime que des clés qu'une vraie suppression a explicitement mises en file.

  **Le mécanisme** :
  - **Trigger `AFTER DELETE`** sur chaque table porteuse d'un `storage_key` (`attachments`, `knowledge_documents`) → insère la clé dans `pending_file_deletions`, **dans la transaction de suppression**. Garanti par la doc PostgreSQL : *« If a foreign key constraint specifies referential actions […] any triggers that exist on the referencing table will be fired for those changes. »* C'est le **seul** moyen de capter les cascades — Prisma en est aveugle par conception (*« Referential actions are actually defined and executed at the database level, not at the Prisma Client level »*, équipe Prisma).
  - **Atomicité** : un `ROLLBACK` annule la mise en file (testé). C'est ce qu'un job applicatif type `purge_later` n'obtient pas.
  - **Drainage hors transaction** (`drainFileDeletions`) via **Vercel Cron** quotidien (`/api/cron/drain-file-deletions`, protégé par `CRON_SECRET` ; le plan Hobby limite à 1 cron/jour). Le report est sans conséquence : **un fichier devient inaccessible dès que sa ligne disparaît**, puisqu'une URL n'est signée qu'à partir d'une clé résolue en base.
  - **Garde-fou « clé réattribuée »** : avant de supprimer, on vérifie qu'aucune ligne ne référence encore la clé (scénario Django n°2). Sans lui, le reset démo effacerait les fixtures qu'il vient de reposer sur les mêmes clés déterministes.
  - **Échec du stockage** → l'entrée reste en file avec `attempts`/`last_error`. La fuite est **visible**, pas silencieuse — c'est ce qui rend le balayage non nécessaire.
  - **Le domaine ne connaît plus le stockage** : `deleteAttachment(db, id)`, `deleteDocument(db, id)`. Rien à se rappeler en écrivant une suppression.
  - ⚠️ **Seul point de vigilance restant** : toute nouvelle table portant un `storage_key` doit recevoir son trigger. Explicite (une ligne de migration) plutôt que diffus dans le code.
  - ⚠️ **`TRUNCATE` ne déclenche pas les triggers `ON DELETE`** (doc PostgreSQL). Sans effet ici : le seul `TRUNCATE` du projet est dans les tests, contre une base sans fichiers réels.

  **Fixtures du compte démo** (`packages/db/prisma/fixtures/`, ~4,6 Ko) : de vrais PDF en git, poussés dans R2 à chaque reset sur des **clés déterministes** (`…/seed/<nom>` → un PUT écrase en place). Avant, cliquer un document de la démo renvoyait « introuvable ». Pas de purge explicite : le `deleteMany` sur l'Account déclenche le trigger, qui met **toutes** les clés du compte (uploads des béta-testeurs compris) dans l'outbox ; le cron les efface, et `stillReferenced` épargne les fixtures reposées.

- **M4.7** ⬜ — **Upload abandonné** : URL émise → fichier poussé → onglet fermé avant l'écriture en base. Aucune ligne, donc aucun trigger, donc aucune entrée de file. **Solution retenue, à câbler : préfixe `pending/` + Object Lifecycle Rule R2 (`Days: 1`)** — R2 sait expirer les objets d'un préfixe tout seul, zéro ligne de code. Nuance : exécution best-effort sous ~24 h (un objet peut survivre ~48 h) ⇒ ramasse-miettes paresseux, pas un TTL. Nécessite le pattern « pending upload » (ligne créée AVANT l'émission de l'URL, confirmée après). Non bloquant : à faire avec M11, qui apporte l'UI d'upload.
- **M4.9** ⬜ — **⚠️ RISQUE CONNU, non corrigé (décidé le 2026-07-15 : plus tard)** — **le dev local peut détruire les fichiers de la prod.**
  - **Cause** : un seul bucket (`relvo-files-prod`) pour les deux environnements, **et** `DEMO_ACCOUNT_ID` est une **constante** (`00000000-0000-4000-8000-0000000000de`, figée pour qu'une session survive à un reset). Prod et local écrivent donc **exactement les mêmes clés**. Le préfixe `accounts/<id>/` ne cloisonne rien ici, contrairement à ce qui avait été supposé au moment du choix « un seul environnement ».
  - **Séquence qui casse** : `pnpm db:seed` en local supprime le compte démo → le trigger met ses clés dans l'outbox **locale** → un drainage manuel local → `stillReferenced` interroge la base **locale**, ne trouve rien → supprime les objets dans R2 → **les documents de la démo en prod sont morts**. Frôlé le 2026-07-15 : le drainage manuel a répondu `skipped: 7` **uniquement** parce que le reseed avait recréé les lignes juste avant.
  - **Portée** : modéré — le cron ne tourne que sur Vercel, donc en local le drainage doit être lancé à la main. Mais rien ne l'empêche.
  - **Correctif** (2 min, gratuit — le free tier R2 est par compte, pas par bucket) : créer `relvo-files-dev` (**juridiction `eu`** comme l'autre), l'ajouter au scope du token existant, et pointer les `.env` locaux (`packages/storage`, `packages/db`, `apps/web/.env.local`) dessus. Vercel garde `relvo-files-prod`.
- **M4.8** ⬜ — *(filet de sécurité, à n'ajouter que sur preuve de dérive)* **Balayage de réconciliation**. Le consensus (Rails `unattached` + délai de grâce, WarpStream) est que le chemin nominal et le filet sont des **couches**, pas des alternatives. Reporté car l'outbox rend les fuites visibles (`pending_file_deletions` qui monte). Si un jour nécessaire : **garde-fous obligatoires** — refus si la base renvoie zéro clé, plafond de suppression par passe, délai de grâce 24 h, mode simulation par défaut.

---

### M5 — Ingestion email (via Unipile)

**Objectif** : recevoir les emails entrants des utilisateurs et envoyer les emails sortants **depuis leur vraie adresse**.

**Dépendances** : M3 (Message, Contact, Channel), M4 (attachments).

> **🔀 Bascule technique majeure (2026-07-16).** L'ingestion ne passe **plus** par un forwarding Gmail → Postmark, mais par l'agrégateur managé **[Unipile](https://www.unipile.com)** (email + WhatsApp unifiés). Arbitrages : envoi « au nom de » l'utilisateur **obligatoire** (exclut le Reply-To), lecture = **nouveau courrier seulement** (pas d'historique → pas d'audit Google CASA), agrégateur **retenu** (UE/SOC2/DPA). Conséquence : **le worker always-on Baileys est abandonné** — WhatsApp (M6) passera aussi par Unipile, en webhooks serverless. Cf. `../spec/architecture.md §2`.

- **M5.1** ✅ — Client Unipile (`apps/web/src/server/unipile/`) bâti sur le **SDK officiel `unipile-node-sdk`** (`UnipileClient` : `account.createHostedAuthLink` avec `sync_limit: NO_HISTORY_SYNC` + `providers ["GOOGLE","OUTLOOK","MAIL"]`, `email.send`, `email.getEmailAttachment` → `Blob`, `account.getOne`, `webhook.create`). Config lazy + dégradation propre sans credentials. Résolution du tenant via `ChannelConfig.external_account_id` (colonne unique, migration `20260716120000`).
- **M5.2** ✅ — Route Handler `/api/webhooks/unipile` : vérif du header secret `Unipile-Auth`, idempotence via `@@unique([channelId, externalId])` + check applicatif, routage `notify` / `mail_received` / `account_status`.
- **M5.3** ✅ — Mapper pur `mail_received` → `Message` orphelin (`ingestInboundEmail`, domaine) : subject_line, content (texte/dé-balisage HTML), sender_raw, external_thread_id.
- **M5.4** ✅ — Récupération des PJ via Unipile → **R2** (`getStorage().put`) + création des `Attachment` (garde-fou taille), au premier passage uniquement.
- **M5.5** ✅ — Anti-loop : nos envois passent par l'API (pas de reboucle) ; garde-fous dédup `external_id` + `mail_sent` ignoré.
- **M5.6** ✅ — Envoi sortant depuis la vraie adresse (`sendEmailReply` domaine via port injecté `EmailSenderPort` + `sendEmailReplyAction`).
- **M5.7** ✅ — UI Paramètres → onglet Canaux → « Connecter une boîte email » (hosted auth un-clic, multi-provider Gmail/Outlook/IMAP).
- **M5.8** ✅ — Statut de connexion du Channel (`external_account_id`, `status`, `last_sync_at`) posé par le webhook `notify` / `account_status`.

**Raffinements post-plan (validés en prod le 2026-07-17)** :
- **M5.9** ✅ — **Rattachement métier pré-M7** (règle déterministe, remplaçable par l'IA en M7) : un email entrant rejoint un sujet existant si — et seulement si — **même interlocuteur ET même objet normalisé** qu'un message/titre du sujet. `normalizeSubjectLine` retire `Re/Ré/Rép/Fwd/Tr/Aw/Answer…` (répétés, multilingues, `Re[2]`, casse) ; `findSubjectForInboundEmail` matche via contact lié **ou** `sender_raw` brut, **exclut `ignored`** (collant, invariant n°7) **et `archived`**. Sinon → orphelin. Résout aussi le `senderContactId` (→ fil de l'interlocuteur) et remonte `last_activity_at`.
- **M5.10** ✅ — **Corps sortant en HTML** (le champ `body` d'Unipile est interprété HTML) : `\n`→`<br>`, tab/indentations figées en `&nbsp;`, `white-space:pre-wrap` — l'email n'arrive plus « aplati ». **Corps entrant nettoyé du fil cité** (`stripQuotedReply` : coupe à « … a écrit : » / « … wrote: » / lignes `>` / séparateurs Outlook ; retire les `<blockquote>`/`gmail_quote` en HTML).
- **M5.11** ✅ — **Suppression d'un canal** (Réglages → Canaux : corbeille + `AlertDialog` d'avertissement) en **hard-delete assumé** : FK `messages.channel_id` **RESTRICT→CASCADE** (migration `20260717120000`) → messages + PJ effacés (PJ → trigger R2 → cron, jamais de delete R2 synchrone), **sujets/tâches survivent** (FK SetNull) ; **`account.delete` Unipile** (best-effort) stoppe l'ingestion et la facturation par compte.
- **M5.12** ✅ — **Visualiseur de PJ mobile/PWA** (`AttachmentViewer`) : image → **lightbox in-app** (Dialog, tap dehors = ferme, pinch-zoom), PDF/autre → **ouverture navigateur** (rendu natif fiable) ; cartes PJ cliquables dans le fil **et** la box Détails (PJ héritent du `subjectId` du message). Tuile **WhatsApp « Bientôt »** grisée dans l'ajout de canal (connexion réelle = M6).
- **M5.13** ✅ — **Rafraîchissement** (`PollRefresh`, anticipe M12.3) : re-fetch serveur toutes les **12 s** (onglet visible + retour d'onglet) sur fiche sujet / Sujets / Messages. **Le webhook d'ingestion invalide le Data Cache** (`expireTenantData` → `revalidateTag(tenant-data, "max")`) dès qu'un message est créé — sinon `unstable_cache` (KPI/fil, `revalidate 120 s`) resservait du périmé et le polling ne voyait rien. Couvre aussi le **Router Cache client** (`staleTimes.dynamic = 30 s`) et l'**absence de WebSocket** en V1. Routes tenant en `no-store` (pas un cache CDN). Latence observée : ~35 s max en 20 s → ramenée à ~25 s en 12 s.

> **✅ M5 clos (2026-07-17)** — validé end-to-end en prod (`relvo-app.vercel.app`, **compte perso + Gmail perso**, tenant isolé de la démo Tasty Crousty) : connexion Gmail hosted-auth un-clic, réception (orphelin + auto-rattachement + PJ), envoi HTML **depuis la vraie adresse**, visualiseur PJ, suppression de canal. **Raffinements reportés** : (a) **intégrer le parcours de connexion OAuth dans l'app** (aujourd'hui on redirige vers l'écran hosted d'Unipile) ; (b) **branding « Relvo » vs « UNIPILE »** sur le consentement Google — nécessiterait **notre propre app OAuth vérifiée**, ce qui **réintroduit l'audit Google CASA** (scope lecture = restricted) : tradeoff assumé (utiliser l'app vérifiée d'Unipile nous en dispense). Prochaine étape : **M6 (WhatsApp)** réutilise le client Unipile.

> **Reste à faire hors code** (config, pas du dev) : provisionner l'instance Unipile (UE) ✅ fait, renseigner `UNIPILE_DSN` / `UNIPILE_API_KEY` / `UNIPILE_WEBHOOK_SECRET` ✅ posées sur Vercel, déclarer les webhooks (`mail_received` + `account_status`) côté dashboard Unipile ✅ fait. Le **pipeline IA** qui transforme l'orphelin en Sujet = **M7** ; l'**étiquetage Haiku** des PJ = **M8**.

---

### M6 — Ingestion WhatsApp (via Unipile)

**Objectif** : recevoir et envoyer des messages WhatsApp. **Via Unipile**, comme l'email (bascule 2026-07-16) — **plus de worker Baileys** : le socket permanent vit chez Unipile, WhatsApp devient un webhook serverless. M6 **réutilise le client Unipile de M5**.

**Dépendances** : M3 (Message, Contact, Channel), M4 (medias), **M5 (client Unipile + route webhook + résolution tenant)**.

> **✅ Code livré le 2026-07-18** (pattern M5 dupliqué en parallèle). **Aucune migration** : le modèle était déjà channel-agnostic (`ChannelType.whatsapp`, `externalThreadId` = `chat_id`, `senderRaw` = numéro, allowlist MIME `attachments` incluait déjà audio/vidéo). 6 tests d'ingestion verts + typecheck web/db propres. **Validation end-to-end en prod à faire** (config webhook Unipile `messaging` + test QR sur device réel) — cf. note de clôture.

- **M6.1** ✅ — ~~Runtime Baileys~~ **Abandonné.** Réutilise `apps/web/src/server/unipile/` et la route `/api/webhooks/unipile` (branche `messaging` ajoutée à côté de `mail_received` / `account_status`).
- **M6.2** — ~~Session Baileys persistante~~ **Sans objet** (Unipile gère la session côté serveur).
- **M6.3** ✅ — UI Réglages → Canaux : tuile **WhatsApp** cliquable (`connectWhatsAppChannelAction` → `createWhatsAppHostedAuthLink` `providers:["WHATSAPP"]`, hosted auth **QR code**). Finalisation par le même `handleHostedAuthNotify` que l'email (`name`=channelId → `externalAccountId`).
- **M6.4** ✅ — Réception des `message_received` : `handleMessageReceived` (route) → `ingestInboundWhatsApp` (domaine, idempotent `@@unique([channelId, externalId])`) → `Message` orphelin **ou rattaché par fil** (`chat_id`). **Rattachement pré-M7 par `chat_id`** (`findSubjectByChatThread`, pas d'objet en WhatsApp) : rejoint un sujet ouvert portant déjà un message du même fil ; 1er message d'un chat → orphelin ; exclut `ignored`/`archived`. Le pipeline IA reste M7.
- **M6.5** ✅ — Envoi sortant dans un fil existant : `sendWhatsAppReply` (domaine, port `WhatsAppSenderPort`) → `messaging.sendMessage({chat_id, text})`. Composer fiche Sujet routé par canal (`whatsappReplyTargets` par interlocuteur, email prioritaire sinon WhatsApp). `startNewChat` (écrire à un numéro sans échange préalable) **reporté post-V1**.
- **M6.6** ✅ — Médias → `fetchMessageAttachment` (Unipile) → **R2** + `createAttachment`, au 1er passage (réutilise exactement le chemin PJ de M5.4, garde-fou taille 64 Mo).
- **M6.7** ✅ — Santé de la connexion : **rien à coder** — le webhook `account_status` était déjà géré génériquement par `handleAccountStatus` (résolution tenant via `externalAccountId`) depuis M5.8.
- **M6.8** ✅ — Risque TOS WhatsApp (ban possible du numéro) : **note d'avertissement dans l'UI Canaux** sous la tuile WhatsApp. Unipile ôte la charge opérationnelle, **pas** le risque TOS (connexion non officielle sous le capot).

> **Reste à faire hors code** (config, comme M5) : déclarer le webhook Unipile `messaging` (`message_received`) via `node --env-file=.env.local scripts/unipile-webhook.mjs create-messaging <URL>`, puis valider end-to-end en prod (connexion QR sur téléphone réel, réception + média, réponse depuis le composer, **anti-loop de l'écho** de nos envois — à confirmer contre un vrai payload, cf. leçon M5 `in_reply_to`). Le pipeline IA orphelin→Sujet = **M7** ; l'étiquetage Haiku des médias = **M8**.

---

### M6bis — Refonte « Conversation » (couche de tri déterministe)

**Objectif** : introduire l'entité **`Conversation`** entre `Message` et `Subject`, et faire du `Subject` une **fenêtre de travail temporaire** ancrée sur un message. Le tri quitte le moment « création de sujet » pour le moment « **réception** », et devient **déterministe, sans IA**. Conception : [`01-principes.md §2/§3/§9`](../conception/01-principes.md), [`02-modele-donnees.md §5bis/§6/§7`](../conception/02-modele-donnees.md), [`03-cas-usage.md` cas A→D, K→S](../conception/03-cas-usage.md).

**Pourquoi maintenant** : le mur rencontré en usage réel (2026-07-20). WhatsApp n'a pas d'objet — un fil direct **entrelace** les sujets, et aucune règle de fenêtre temporelle ne sait les séparer. Il faut que la **granularité sémantique (le sujet) soit plus fine que la granularité de transport (la conversation)**, donc que le rattachement se décide **message par message**.

**Dépendances** : M3, M5, M6. **Bloque M7** (le pipeline IA doit travailler sur des conversations, pas sur des messages orphelins).

- [x] **M6bis.1** — Schéma : entité `Conversation` (`type`, `key` unique par compte, `title`, `contact_id`, `interlocutor_raw`, `external_thread_id`, `normalized_subject`, `status`, `last_message_at`), table `SubjectConversation(subject_id, conversation_id, anchor_message_id)`, `Message.conversation_id` **non nullable**
- [x] **M6bis.2** — Schéma : `Subject.status` → `enum(ouvert, validé, fermé)` + `closed_at` ; **retrait** de `archived` et `ignored`
- [x] **M6bis.3** — Domaine : `resolveConversation(message)` — calcul de la clé canonique (`email:<interloc>:<objet>`, `wa-group:<chat_id>`, `wa-direct:<numéro>`) + find-or-create, branché sur l'ingestion **email et WhatsApp**
- [x] **M6bis.4** — Domaine : **règle d'ancrage** à la réception — si la conversation porte un sujet `ouvert`, le message reçoit son `subject_id` automatiquement
- [x] **M6bis.5** — Domaine : `openSubjectFromMessage(messageId)` (crée le sujet + la ligne `SubjectConversation` avec l'ancre + le contact **sauf conversation de groupe**), `closeSubject` / `validateSubject` (posent `closed_at`), `ignoreConversation` / `reactivateConversation`
- [x] **M6bis.6** — Domaine : glissement de l'ancre au détachement du message d'ancrage ; rattachement d'un message isolé ⚠️ **retiré de l'UI par M6ter (2026-07-21)** : plus de rattachement ni de détachement message par message
- [x] **M6bis.7** — Unipile : capter le **nom du groupe** et le **type** via `client.messaging.getChat({chat_id})` → `name` (titre de la conversation) et `type` (`SINGLE`/`GROUP`/`CHANNEL`, **discriminant autoritaire**, plus fiable que le `is_group` du webhook). Un seul appel **à la création de la conversation**, pas par message
- [x] **M6bis.8** — UI : page `/conversations` (hors-nav, atteinte par le **KPI « Sans sujet »**) — liste triée par activité, non-lus en tête (fond distinct, gras, pastille), **3 filtres** (Sans sujet / Ignorées / Toutes) + filtre canal, **swipe gauche = Ignorer**
- [x] **M6bis.9** — UI : détail d'une conversation — timeline façon messagerie + **cordon de sujet** ⚠️ **le cordon est SUPPRIMÉ par M6ter (2026-07-21)** : remplacé par le **bandeau « Suivi dans »** en en-tête, sur les deux canaux
- [x] **M6bis.10** — UI : **pop-up message** — si rattaché : affiche le sujet + « Détacher » ; sinon : « Ouvrir un sujet » (ce message devient l'ancre) ou « Rattacher à un sujet existant »
- [x] **M6bis.11** — UI : swipes de la page Sujets → **Fermer** (gauche) / **Valider** (droite) ; **retrait de l'onglet Ignorés** ; proposition « ignorer la conversation ? » enchaînée à la fermeture
- [x] **M6bis.12** — UI : étendre un sujet à une seconde conversation (cas S) — **créer** (email, objet pré-rempli par le titre du sujet) ou **rattacher avec une nouvelle ancre** (WhatsApp direct, une seule conversation directe par contact)
- [x] **M6bis.13** — Tests : clés de conversation par type, idempotence, règle d'ancrage, entrelacement (détacher/déplacer), glissement d'ancre, fermeture → conversations orphelines, ignorance → sortie du KPI

#### ⚠️ Ce que cette refonte rend caduc

| Élément | Devenir |
|---|---|
| Pages `/messages` et `/messages/[id]` | **supprimées** → `/conversations` |
| `assignMessageToSubject` + **balayage des frères orphelins** | **supprimés** — la conversation fait ce travail à la réception, mieux et plus tôt |
| `Message.triage_hint` | **plus alimenté** (le tri ne peut plus échouer) ; champ conservé pour l'historique |
| `Message.status = ignored` | remplacé par `Conversation.status = ignoré` (on ignore la **source**, pas l'événement) |
| `Subject.status` `archived` / `ignored` | **retirés** |
| Onglet « Ignorés » de la page Sujets, purge à 15 j | **supprimés** |
| Réouverture auto d'un sujet `resolved` à réception | **supprimée** (contredit la métaphore de la fenêtre) |
| KPI « Sans sujet » | **conservé mais recâblé** : compte des **conversations** dont le dernier message n'est rattaché à aucun sujet |

`detachMessage` et `reassignMessage`, en revanche, **survivent et prennent tout leur sens** : ils portent la correction manuelle de l'entrelacement (puis, en M7, la correction par Relvo).

#### ⚠️ Migration de données — le point délicat

Il faut **inventer une conversation** pour chaque message existant. Ce n'est pas mécanique :

1. **Emails** — recalculer la clé `(interlocuteur, objet normalisé)` depuis `sender_raw` / `subject_line`. Messages **sans objet** : repli sur une conversation `direct` par interlocuteur, à défaut de mieux.
2. **WhatsApp** — `external_thread_id` donne le fil, mais le **type** (groupe vs direct) n'est fiable que depuis la capture de `is_group` (2026-07-18). Pour les messages antérieurs : repli sur l'heuristique **déjà en production** — un fil comptant **≥ 2 expéditeurs distincts** est un groupe.
3. **Titres manquants** — le **nom des groupes** n'a jamais été stocké : prévoir une passe de rattrapage `getChat` par `chat_id`, avec repli sur le `chat_id` en attendant.
4. **Sujets existants** — créer une ligne `SubjectConversation` par couple (sujet, conversation), avec **ancre = premier message du sujet dans cette conversation**.
5. **`Message.subject_id` est conservé tel quel** : c'était déjà la vérité d'appartenance, rien à recalculer.
6. **Statuts** — `acknowledged` → `ouvert`, `resolved` → `validé`, `archived` → `validé`, `ignored` → `fermé` (+ passer les conversations correspondantes en `ignoré`, pour préserver l'intention initiale de l'utilisateur).

> La migration doit être **rejouable** et vérifiée sur une copie de la base de prod avant application : c'est la première migration du projet qui **crée de la donnée** plutôt que de déplacer des colonnes.

---

### M6ter — UX par canal (email ≠ WhatsApp)

**Objectif** : cesser de forcer une **UX unique** sur deux canaux qui n'ont ni la même forme de message ni le même système d'objet. La divergence porte sur le **rendu** et les **gestes** ; le **domaine reste commun**. Conception : [`01-principes.md §3/§9`](../conception/01-principes.md), [`02-modele-donnees.md §5bis/§6/§7`](../conception/02-modele-donnees.md), [`03-cas-usage.md` cas B, D, K, M, N, Q, R, S, T, U, V](../conception/03-cas-usage.md).

**Pourquoi maintenant** : constat du **test en production de M6bis** (2026-07-20). Deux causes — la **taille et la forme** des messages email (longs, structurés, HTML : la bulle les étrangle), et le **système d'objet**, inexistant en WhatsApp.

**La raison profonde** — ce n'est pas une scission subie, c'est le **modèle qui devient visible**. Les clés de conversation le disaient déjà :

| Clé | Contient | Nature |
|---|---|---|
| `email:<interlocuteur>:<objet>` | la personne **et l'affaire** | ≈ un sujet, par construction |
| `wa-direct:<numéro>` / `wa-group:<chat_id>` | la personne / le groupe **seuls** | un flux d'affaires successives |

⚠️ **Le `groupe` ne fait PAS exception** (précision du 2026-07-20) : le **nom du groupe ne joue pas le rôle d'un objet d'email**. Il nomme un collectif, pas une affaire — un groupe **s'écoute exactement** comme un direct.

> **L'écoute n'a jamais été un concept du modèle : c'est la PROTHÈSE d'un objet manquant.** Là où l'objet existe (email), **il n'y a rien à écouter** ; là où il manque (WhatsApp), l'écoute est indispensable. Quand M7 saura découper un flux **par le sens**, cette prothèse tombera — exactement comme l'« écoute active », déjà documentée comme un échafaudage (`01-principes.md §9`).

#### 🔑 Correction et SIMPLIFICATION du 2026-07-21

> **Un fil d'email EST un sujet. Une conversation WhatsApp est un FLUX ; un sujet l'ÉCOUTE, à partir d'un message, jusqu'à ce qu'il cesse d'écouter.**

Ce qui change par rapport à la rédaction du 2026-07-20 :

| Écrit le 2026-07-20 | Devenir |
|---|---|
| « fenêtre » | **« écoute »** — une action du sujet, pas une plage subie ; ⚠️ **modèle inchangé**, `anchor_message_id` / `closing_message_id` **sont** ses deux bornes |
| « côté email, l'ancre est nulle » (mais fenêtre quand même) | côté email un sujet **n'écoute rien** : il **EST** le fil |
| **cordon** de sujet (rail coloré par message, trait, point creux, rupture visuelle) | **SUPPRIMÉ** — une conversation est **écoutée ou pas**, un rail qui alterne n'a plus rien à montrer |
| **poignée d'ancre** glissante (dnd-kit, aperçu en direct) | **SUPPRIMÉE** — remplacée par le **même swipe** sur un message plus ancien |
| **défaut d'ancre** (« le dernier message, toujours ») | **SUPPRIMÉ** — l'utilisateur désigne toujours le message |
| **tap sur message** → pop-up (détacher / ancrer / rattacher) | **SUPPRIMÉ** — le **tap est réservé aux pièces jointes** |
| rattachement / détachement **message par message** | **retiré de l'UI** (reste dans le modèle, pour M7) |
| bandeau « Suivi dans » **email seulement** | **les DEUX canaux**, + « **N sujets passés** » dépliable |
| **réouverture automatique** d'un sujet email à la réception | **SUPPRIMÉE** — `validé` n'est plus alimenté ; réouverture **manuelle** (« Remettre ») |
| swipe droite = ouvrir un sujet, sur les deux canaux | **email → sur la CONVERSATION** ; **WhatsApp → sur le MESSAGE** |
| « fermer » ≈ supprimer | **suppression douce** : statut `fermé`, onglet **Fermés**, bouton **Remettre** |

**Les deux renoncements, écrits pour être relus** :

1. **L'entrelacement dans une plage d'écoute n'est plus exprimable dans l'UI.** C'était l'argument fondateur du modèle. Le modèle le permet toujours (`Message.subject_id`), l'interface ne l'expose plus. **Arbitrage assumé** : c'est exactement le travail de M7, et en attendant **un peu de bruit vaut mieux qu'une UI incompréhensible**.
2. **Les écoutes passées deviennent invisibles côté conversation** — d'où le « **N sujets passés** » du bandeau, qui en est désormais la seule trace.

**Dépendances** : M6bis. **Migration** : une **colonne nullable** `SubjectConversation.closing_message_id`, **aucun backfill** (`anchor_message_id` était déjà nullable). Le changement de vocabulaire ne touche **aucune colonne**.

- [ ] **M6ter.0** — Migration : **`SubjectConversation.closing_message_id: UUID nullable`** — **fin d'écoute**, symétrique du début (`anchor_message_id`). `null` = écoute en cours. ⚠️ **Aucun backfill** — les lignes existantes valent « écoute en cours », ce qui est exactement leur état. **Pourquoi une borne qui désigne un message** plutôt qu'une borne déduite de `closed_at` : (1) `closed_at` est déclassé en simple date ; (2) une borne calculée sur un **horodatage** devient fausse dès que **deux messages arrivent dans la même seconde**.
- [ ] **M6ter.1** — Domaine : **une seule primitive d'ouverture, à ancre OPTIONNELLE** — *ouvrir un sujet **sur une conversation**, `anchorMessageId?`*. Ancre `null` → **tout le fil** ; ancre posée → **l'écoute commence là**. ⚠️ **La fonction teste l'ANCRE, jamais le canal** — un `if (channel === 'email')` dans le domaine est le premier pas vers deux produits. C'est l'UI qui décide quelle valeur transmettre : `null` en email, le **message swipé** en WhatsApp.
- [ ] **M6ter.2** — Domaine : ⚠️ **balayage du fil ENTIER à l'ouverture d'un sujet email**, en **amont comme en aval**. La règle actuelle ne balaie que les messages **≥ ancre** (héritée de WhatsApp, où elle est juste) : telle quelle, ouvrir un sujet sur un fil de **six** emails n'en rattacherait qu'**un**.
- [ ] **M6ter.3** — UI : **rendu email pleine largeur** dans le détail de conversation — emails enchaînés au fil du scroll, **fond blanc dans les deux sens**, en-tête porteur (avatar + expéditeur + date), sortant signalé par « **Moi** ». **WhatsApp conserve les bulles.** ⚠️ **Pas de fond teinté sur l'email** : sur du texte long il fatigue et abîme la lisibilité — c'est précisément ce qu'on vient gagner en sortant de la bulle (cf. Gmail / Superhuman / Outlook). Repli si insuffisant : teinte **très légère au sortant seulement**.
- [ ] **M6ter.4** — UI : **swipe gauche par canal** — email « **Supprimer** » / **rouge**, WhatsApp « **Ignorer** » / **orange**. ⚠️ **Même mécanisme dessous : `ignoreConversation`. Aucune donnée supprimée.** L'email vit toujours dans la boîte Gmail de l'utilisateur (nous n'en avons qu'une copie), supprimer détruirait notre historique (sujets, tâches, PJ), et le fil restant chez Unipile, un nouveau message sur le même objet recréerait la conversation **vide de son passé**.
- [ ] **M6ter.4bis** — UI : **confirmation d'ignorance qui NOMME les sujets** écoutant la conversation (« Elle n'alimentera plus **Retard livraison sauce blanche** »). ⚠️ **Jamais « un ou plusieurs sujets »** : on ne fait pas confirmer un risque sans dire lequel — une confirmation sans information se clique sans être lue. **Pas de confirmation** si aucun sujet ouvert n'écoute le fil.
- [ ] **M6ter.5** — UI : **swipe droite sur la CONVERSATION = email uniquement**, avec deux choix — **ouvrir un sujet** ou **rattacher à un sujet existant** (nouvelle ligne `SubjectConversation`, deux bornes `null`, balayage du fil entier). Côté WhatsApp, la ligne de conversation ne porte **pas** de swipe droite.
- [ ] **M6ter.6** — UI : **swipe droite sur un MESSAGE = WhatsApp uniquement**. S'il n'y a pas d'écoute → **ouvre le sujet** avec ce message pour ancre. S'il y a déjà une écoute **et que le message est antérieur à l'ancre** → **l'écoute remonte** jusqu'à lui (réécrit `anchor_message_id`, les messages traversés reçoivent le `subject_id`). ⚠️ **Un seul geste qui crée ET qui étend** — une règle à retenir au lieu de deux, et plus aucun dispositif de correction à construire.
- [ ] **M6ter.6bis** — UI : ⚠️ **le TAP sur un message est réservé à l'ouverture des pièces jointes**, sur les deux canaux. **Retrait total de la pop-up message** (détacher / ancrer / rattacher). Le tap est le geste le plus naturel sur un message : il doit avoir l'effet le plus prévisible et le plus inoffensif ; ce qui **modifie** l'appartenance passe par le **swipe**.
- [ ] **M6ter.6ter** — Domaine : **arrêt des écoutes, règle unique sur les deux canaux**. `fermé` → **toutes** les écoutes du sujet s'arrêtent (`closing_message_id` posé sur chaque conversation), qui **ne référencent plus** ce sujet. `validé` → la conversation **n'alimente plus** le sujet. **Ignorer une conversation = PAUSE** : elle n'alimente plus **aucun** sujet ouvert qui l'écoute, mais **aucune borne de fin n'est posée** — réactiver fait **reprendre** (sans quoi « Réactiver » serait un bouton sans effet).
- [ ] **M6ter.6quater** — Domaine : ⚠️ **SUPPRIMER la réouverture automatique d'un sujet email à la réception** (écrite le 2026-07-21 au matin, retirée le même jour). Elle contredit « un sujet `validé` n'est plus alimenté ». Un message arrivant sur une conversation dont l'écoute est arrêtée **reste sans sujet** ; la conversation redevient **orpheline** et réapparaît dans le KPI « Sans sujet ». **Même règle sur les deux canaux.**
- [ ] **M6ter.7** — UI + domaine : **« Fermer » est une SUPPRESSION DOUCE**. Statut `fermé`, le sujet sort de la vue, ses écoutes cessent, il reste **récupérable** — onglet **« Fermés »** + bouton **« Remettre »** (repasse en `ouvert`, `closed_at` effacé ; ⚠️ **les écoutes ne redémarrent PAS d'elles-mêmes**). **Vocabulaire imposé : Fermer / Fermés / Remettre**, jamais « Supprimer » / « Corbeille ». Raisons : (1) c'est **honnête**, rien n'est détruit ; (2) **un sujet est le seul endroit où vivent les tâches et le journal des décisions** — un message supprimé par erreur existe encore dans Gmail, une **tâche** supprimée par erreur n'existe **nulle part ailleurs**.
- [ ] **M6ter.8** — UI : **bandeau « Suivi dans » en en-tête de conversation, sur les DEUX canaux** — pastille de couleur du **domaine** + **titre du sujet**, **cliquable vers la fiche**, plus un discret « **N sujets passés** » qui **déplie la liste des écoutes terminées**. ⚠️ **Aucun marqueur d'appartenance par message, sur aucun canal** : dans la plage d'écoute tous les messages appartiennent au sujet, hors plage aucun — un signal répété serait identique partout, donc muet. ⚠️ **Le « N sujets passés » n'est pas un ornement** : c'est la **seule** trace des écoutes terminées côté conversation.
- [ ] **M6ter.8bis** — UI : **fiche sujet — une seule conversation affichée à la fois**. Une **ligne unique** en tête de l'onglet Conversations (icône du canal + nom + **état d'écoute**), **tapable** → **feuille** listant toutes les conversations du sujet avec leur état et l'action « **arrêter l'écoute** ». Le **sélecteur du composer** est synchronisé et désigne désormais une **conversation**, plus un contact (invariant n°11 mis à jour). ⚠️ **Écartés, avec leur raison** : le **flux fusionné** (email pleine largeur + bulles WhatsApp = le chaos visuel qu'on cherche à éviter), le **carrousel** (le swipe est déjà pris par le geste sur les messages), les **onglets** (l'onglet Conversations est déjà dans une barre à 3 onglets — pas d'onglets dans des onglets).
- [ ] **M6ter.8ter** — Domaine : **les messages sont des RÉFÉRENCES, jamais des copies**. Un `Message` porte `conversation_id` **et** `subject_id` ; `SubjectConversation` est une table de liaison. Lu depuis la conversation ou depuis le sujet, **c'est la même ligne**. ⚠️ À ne pas « optimiser » en dupliquant les messages dans le sujet : marquer comme lu, corriger un rattachement ou supprimer une PJ doit se voir **partout à la fois**.
- [ ] **M6ter.9** — Tests : ouverture email → ancre `null` **et fil entier rattaché** (y compris messages antérieurs) ; ouverture WhatsApp **direct et groupe** par swipe sur un message → ancre = ce message, messages ≥ ancre ; **swipe sur un message antérieur alors qu'une écoute existe → l'écoute remonte** et les messages traversés reçoivent le `subject_id` ; **valider / fermer → `closing_message_id` posé sur CHAQUE conversation écoutée**, sur les deux canaux ; **nouveau message après un statut terminal → PAS de réouverture**, conversation orpheline ; **ignorer puis réactiver → l'alimentation reprend** et `closing_message_id` est resté `null` ; **ignorer une conversation écoutée → confirmation NOMMANT les sujets** ; **fermer puis Remettre → sujet `ouvert`, tâches et journal intacts, écoutes NON redémarrées** ; swipe gauche email → `Conversation.status = ignoré` et **aucune suppression**.

#### Écarté de la V1 — plusieurs sujets SIMULTANÉS sur une même conversation

Hypothèse **mise de côté**, et son coût d'ajournement est **nul** : `SubjectConversation` est **déjà** une table de liaison **plusieurs-à-plusieurs**, donc le schéma l'autorise depuis le premier jour. Ce qui l'interdit n'est qu'une **règle métier V1** (« au plus un sujet ouvert par conversation »), levable **sans migration** — c'est déjà documenté ainsi. ⚠️ **Mais le jour où on la lèvera, il faudra réinventer un signal d'appartenance plus fin que le bandeau** : celui-ci suppose qu'une conversation n'est écoutée que par **un** sujet à la fois. C'est le prix, assumé, de la simplification du 2026-07-21.

Le cas jugé **plus probable** — des écoutes **successives** sur un même fil, sans chevauchement — **fonctionne déjà** avec la paire début/fin : ce sont des **plages disjointes** sur le même flux.

#### ⚠️ Ce que ce module rend caduc

| Élément | Devenir |
|---|---|
| Le mot **« fenêtre »** | remplacé par **« écoute »** — ⚠️ **aucun changement de modèle** |
| Le **cordon de sujet** (rail coloré par message, trait, point creux, rupture visuelle) | **SUPPRIMÉ (2026-07-21)** — l'appartenance est **binaire par conversation**, un rail n'a plus rien à montrer |
| La **poignée d'ancre** glissante (dnd-kit, aperçu en direct pendant le drag) | **SUPPRIMÉE (2026-07-21)** — remplacée par le **même swipe** sur un message plus ancien |
| Le **défaut d'ancre** (« le dernier message, toujours ») | **SUPPRIMÉ** — l'utilisateur désigne toujours le message swipé |
| La **pop-up « tap sur message »** (détacher / ancrer / rattacher) | **SUPPRIMÉE sur les DEUX canaux** — le **tap est réservé aux pièces jointes** |
| Le **rattachement / détachement message par message** dans l'UI | **retiré** — reste dans le modèle (`Message.subject_id`) pour M7 |
| « Un sujet s'ouvre **toujours** depuis une conversation » | **nuancé** — email : la **conversation** ; WhatsApp : le **message** |
| Balayage « messages ≥ ancre » **appliqué à l'email** | **caduc** — l'email balaie le fil **entier**, amont compris |
| `Subject.closed_at` = « **borne haute de la fenêtre** » | **déclassé** — simple date, ne gouverne plus l'appartenance |
| **Réouverture automatique** d'un sujet email à la réception | **SUPPRIMÉE (2026-07-21)** — contredit « `validé` n'est plus alimenté » ; réouverture **manuelle** (« Remettre ») |
| Bandeau « Suivi dans » **email seulement** | **les deux canaux**, + « **N sujets passés** » |
| Bulles de message côté email | **remplacées** par le rendu pleine largeur |
| Swipe gauche à libellé unique « Ignorer » | **habillage par canal** (mécanisme inchangé) + **confirmation nommant les sujets** |
| « fermer » ≈ « supprimer » | **suppression douce** : `fermé` → onglet **Fermés** → **Remettre** |

**Ce qui ne bouge pas, et ne doit pas bouger** : le domaine — ouverture de sujet, écoute, arrêt d'écoute, ignorance, statuts. ⚠️ **Le jour où l'on duplique la logique métier « parce que l'email est différent », on aura deux produits.** Un swipe peut changer de libellé, de couleur et de cible ; il ne doit **jamais** changer de fonction appelée.

---

### M7 — Pipeline IA d'arrivée

**Objectif** : implémenter le cœur du produit — orchestrer le traitement IA d'un message entrant jusqu'à la création/mise à jour du Subject, des Task, des brouillons, et du journal de bord. Exécuté en **tâche de fond serverless** (déclenché depuis le webhook Unipile), déclenché par l'arrivée d'un message (email ou WhatsApp). **Plus de worker/BullMQ** (bascule 2026-07-16).

**Dépendances** : M3, M5, M6, M11 (KnowledgeDocuments accessibles).

- **M7.1** — Service `MessageProcessor` orchestrateur, en **exécution de fond serverless** (fonction de fond Vercel / **Vercel Queues** ; plafond de durée relevé par Fluid Compute) — choix de l'orchestration à arrêter ici
- **M7.2** — Prompt système global Relvo (rôle, ton, règles de non-création, format de sortie)
- **M7.3** — Construction du contexte par message : Folder match + KnowledgeDocuments du Folder + Folder Général + dernières conversations du contact
- **M7.4** — Appel Claude Sonnet via AI Gateway : comprendre le message, classer le Folder, rattacher à un Subject existant ou en créer un nouveau, créer un Contact si nécessaire
- **M7.5** — Génération du `title` et du `summary` du Subject
- **M7.6** — Génération des tâches déductibles du message + extraction de date (`start_date`, `start_time`, `end_date`, `end_time` selon les règles de `../conception/04-ia.md §2.5`)
- **M7.7** — Génération du brouillon de réponse si une tâche `reply` est créée (stocké dans `Action.payload`)
- **M7.8** — Génération du `triage_hint` quand Relvo ne crée pas de sujet (`too_short`, `ambiguous`, `prospection`, `unknown_sender`, `informative_only`, `other`)
- **M7.9** — Mise à jour du `Subject.status` selon les cas A à F décrits dans `../conception/03-cas-usage.md`
- **M7.10** — Auto-cochage des tâches `reply` lors d'un envoi sortant (cas H — `completion_mode = message_match`)
- **M7.11** — Suggestion de résolution (`resolution_suggested_at`) quand le sujet semble stabilisé
- **M7.12** — Stockage des `citation_ids` retournés par Anthropic dans `Task.metadata` et `Action.metadata`
- **M7.13** — Configuration du prompt caching (system prompt + KnowledgeDocuments, TTL 5 min ou 1 h extended)
- **M7.14** — Génération systématique d'EventLog pour chaque sous-action du pipeline
- **M7.15** — Gestion d'erreur : si Claude échoue, le message reste « Sans sujet » avec `triage_hint = other`
- **M7.16** — Observabilité : log des tokens consommés par message pour suivi des coûts

---

### M8 — Pièces jointes IA

**Objectif** : implémenter l'analyse des pièces jointes. **V1 = niveau 1 uniquement** ; les niveaux 2 et 3 sont reportés V2 (cf. §2).

**Dépendances** : M3 (Attachment), M5/M6 (réception des PJ).

- **M8.1** — Niveau 1 : étiquetage Haiku automatique à la réception (`ai_label` parmi facture, bon de livraison, contrat, planning, devis, justificatif, photo, autre)
- **M8.2** — *(V2)* Niveau 2 : génération du résumé Sonnet lazy au premier accès (cache permanent via `ai_summary_at`)
- **M8.3** — *(V2)* Niveau 3 : analyse profonde Sonnet à la demande explicite (bouton « Analyser avec l'IA »), cache via `ai_analysis_at`
- **M8.4** — Stratégie de cache via `ai_label_at` (+ `ai_summary_at`, `ai_analysis_at` en V2) : jamais d'appel double pour un même niveau
- **M8.5** — UI : badge label coloré à côté du nom du fichier (résumé / bouton « Analyser » = V2)

---

### M9 — Pages applicatives front

**Objectif** : implémenter les 7 pages décrites dans `CLAUDE.md` (4 nav + 3 hors-nav) à partir des maquettes HTML existantes dans [`mockup/`](../../mockup).

**Dépendances** : M2 (auth), M3 (accès CRUD).

- **M9.1** — Layout global : sidebar 4 entrées (Accueil, Mon fil, Mes dossiers, Paramètres) + topbar (recherche, profil) + bouton flottant chatbot + slot drawer
- **M9.2** ✅ — Composants partagés (Direction B) : `SubjectRow`, `MessageBubble`, `ActorPill` (M/R/E), badges de statut (**5 valeurs**) + drapeau urgent (`priority=urgent`), `SegTabs`, `MetricsCard`, `ConfirmDialog`, `SwipeToRemove`… _(plus de `StatusBadge` 6 valeurs ni `SubjectCard`/`TaskCard` desktop)_
- **M9.3** — Page **Accueil** : bandeau KPIs (sujets ouverts, messages à trier, tâches du jour, % d'aide Relvo) + widget calendrier semaine pleine largeur + 3 cartes sujets prioritaires en 3 colonnes
- **M9.4** ✅ — Page **Mon fil** : feed plein écran, **3 onglets de statut** (Ouverts urgents en tête / Terminés / Ignorés) + hero violet + **swipe** ← Ignorer (`ignored`) · → Terminer (`resolved`) ; onglet Ignorés avec « Remettre dans le fil » _(plus de filtres Priorité/Chrono/Résolus ni de paire ✕/✓)_
- **M9.5** — Page **Sujet** : header (référence + statut + drapeau urgent) + résumé Relvo + onglets (Messages / Tâches / Journal / Pièces jointes) + composer multi-canal avec brouillon IA identifié « Suggestion de Relvo — modifiez librement avant d'envoyer »
- **M9.6** — Page **Mes dossiers** : grille des Folders avec compteurs (sujets, fichiers, notes)
- **M9.7** — Page **Dossier** : sections Sujets + Fichiers (upload drag-and-drop) + Notes (éditeur Markdown). Fiche du Folder Général masque la section Sujets.
- **M9.8** — Page **Planning** (hors-nav) : grille vue mois + barres pour tâches multi-jours + navigation mois précédent/suivant/aujourd'hui
- **M9.9** ✅ — Page **Messages** (hors-nav) : **pile d'orphelins** (« Sans sujet ») — PAS des conversations par contact ; lu/non-lu, rétention 15 j, actions créer un sujet / rattacher à un sujet existant / créer un contact / retirer (swipe) + **page de détail `/messages/[id]`**
- **M9.10** — Page **Contacts** (hors-nav) : liste + filtre « À compléter »
- **M9.11** — Page **Contact** : fiche + édition (passage `auto` → `complete`)
- **M9.12** — Page **Paramètres** : 3 onglets (Profil / Canaux / Contacts)
- **M9.13** — Recherche globale topbar (sujets + contacts + messages)
- **M9.14** ✅ — Action **Ignorer** (swipe gauche) → pose `status = ignored` (sujet écarté, hors mémoire, **collant**, récupérable) — **plus une rétrogradation de priorité**
- **M9.15** — Bouton ✓ Marquer comme résolu, avec variante violette quand `resolution_suggested_at > last_opened_at`
- **M9.16** — Acquittement implicite : ouverture d'un sujet met à jour `last_opened_at`, ce qui fait disparaître les badges « ✦ à examiner » des listes
- **M9.17** — Drag-and-drop des tâches (dnd-kit) sur le widget calendrier semaine et la vue mois Planning

---

### M9 — Finalisation (plan de clôture, établi le 2026-06-25)

> ⚠️ **Les descriptions M9.1–M9.17 ci-dessus reflètent le plan d'origine** (desktop, sidebar, statut 6 valeurs, paire ✕/✓, Messages = conversations par contact). **Le réalisé a divergé** suite au virage mobile-first « Direction B » (18→25 juin) : statut **5 valeurs** dont `ignored`, priorité **2 valeurs** (`normal`/`urgent`), swipe Ignorer/Terminer, dock 4 onglets + composer Relvo persistant, Messages = **pile d'orphelins**, PWA installable. Les items ci-dessous closent M9 **sur la base du réalisé**, à reprendre dans une nouvelle fenêtre de contexte.

- **M9.18 ✅ — Réalignement docs ⇄ code (point 0) [PRIORITAIRE]** — conception/spec réalignés avec le code (commit `f3f3eda`). Dérives traitées :
  - `conception/02-modele-donnees.md` : **`Message.read_at`** (lu/non-lu) et **`Message.folder_id`** (message classé dans un **domaine à la réception** → c'est lui qui donne ensuite son domaine au sujet) — ABSENTS, à documenter. Vérifier **Priorité = 2 valeurs** (`normal`/`urgent`). Task : suppression = **hard delete** désormais (l'enum `TaskStatus.deleted` subsiste mais n'est plus posé par `deleteTask`). Confirmer **SubjectStatus 4 valeurs** (`acknowledged`/`resolved`/`archived`/`ignored` — `new` retiré le 2026-06-27, « Nouveau » devenu marqueur dérivé de `last_opened_at == null`).
  - `conception/01-principes.md` : ignorance **« collante »** (un nouveau message ne ressort jamais un sujet `ignored`) + priorité 2 valeurs + virage mobile-first / PWA (§13).
  - `conception/03-cas-usage.md` : cas **messages orphelins** (pile « sans intérêt », rétention 15 j, créer un sujet / **rattacher à un sujet existant** / créer un contact depuis l'expéditeur) ; cas **ignorer / remettre** un sujet.
  - `conception/04-ia.md` : l'IA respecte l'ignorance collante ; classifie un message en domaine à la réception ; les sujets `ignored` sont **hors mémoire**.
  - `spec/architecture.md` : enums Status(5)/Priority(2) ; routes `/messages`, `/messages/[id]`, `/sujets/[id]?tab=` ; **PWA** (manifest standalone + meta apple — cf. `apps/web/src/app/manifest.ts`, `layout.tsx`, bandeau status-bar).
  - `spec/ux-mobile-first.md` : agenda à **jours cliquables** ; **tâches datables** (date = deadline `start_*`) + date à la création (chips) ; install PWA iOS (Safari **ou** Chrome → Partager → Sur l'écran d'accueil ; standalone piloté par `apple-mobile-web-app-capable`).
  - **Le backlog lui-même** : corriger/✅ M9.2 (`StatusBadge` 6→5 valeurs + 2 priorités), M9.4 (filtres Priorité/Chrono/Résolus + ✕/✓ → 3 onglets Ouverts/Terminés/Ignorés + swipe), M9.9 (Messages = conversations → pile d'orphelins + page `/messages/[id]`), M9.14 (Ignorer = rétrograde la priorité → pose `status=ignored`, collant).
- **M9.19 ✅ — Réactivité / cache du chargement (point 1)** — shell instantané + zones streamées (`<Suspense>`) sur toutes les surfaces, cache de données tenant (`unstable_cache` + invalidation par tag, cf. `@/server/cached`), pooling Neon (PgBouncer + pool serverless), `staleTimes` client. Plan d'origine : `loading.tsx` sur **toutes** les surfaces (manquent au moins `/sujets/[id]`, `/sujets/nouveau`, et les pages hors-`(app)`) ; mise en cache / revalidation (`revalidate`, `unstable_cache`, cache de données tenant) sur les écrans peu volatils ; pooling de connexions Neon ; réduire les requêtes séquentielles. But : navigation quasi-instantanée.
- **M9.20 ✅ — Page Mémoire + sous-pages : D.A. + UX (point 2)** — `/dossiers` et `/dossiers/[id]` (fiche 3 onglets Instructions / Documents / Sujets) **déjà conformes Direction B** (hero violet, FeedTabs, MetricsCard, cache serveur + Suspense) depuis M9.6/M9.7 ; vérifiés au point de clôture.
- **M9.21 ✅ — Page Réglages + sous-pages : D.A. + UX (point 3)** — `/parametres` conforme Direction B (hero + SegTabs Profil / Canaux / Préférences). **Contacts retiré des Réglages** (devient un onglet de premier rang, cf. M9.22).
- **M9.22 ✅ — Page Contacts + sous-pages : D.A. + UX + accès (point 4)** — `/contacts` et `/contacts/[id]` conformes Direction B. **Point d'accès tranché (2026-06-26) : Contacts = 3ᵉ onglet du dock** (entre Mon fil et Mémoire), destination de premier rang en vue de l'usage **Équipe** — pas un sous-menu de Réglages. Dock 4→**5 entrées** (CLAUDE.md + `bottom-tab-bar.tsx` mis à jour). Note IA : un contact rattaché à un pôle/dossier orientera la qualification des messages reçus (à exploiter au pipeline M7).
- **M9.23 ✅ — Page Connexion (login) : D.A. + UX (point 5)** — tunnel `(auth)/*` repassé Direction B : hero violet de marque (logo + tagline) + carte blanche « à cheval », bouton primaire violet, liens violets (`AuthCard`/`AuthLink`). Statut PWA `black-translucent` géré (`max(env(safe-area-inset-top), …)` + `env(safe-area-inset-bottom)`).
- **M9.24 ✅ — Jeu de données de démo plus conséquent & crédible (point 6)** — `packages/db/src/seed-demo.ts` étoffé (univers Mam's Diallo / Tasty Crousty Épinay) : 6 domaines dont Communication, 18 contacts, 29 sujets (statuts variés), 115 tâches datées juin→juillet, messages orphelins, connaissances. Idempotent + reset-able via Réglages.

**Itérations UX post-plan (26→30 juin), incluses dans M9 réalisé :**
- **Accueil = page des TÂCHES** (« Actions du jour ») : barre KPI Tâches contextuelle, **semainier slidable** (rail de jours, aujourd'hui centré, badges rouges/bleus) avec **drag-and-drop long-press** d'une tâche d'un jour à l'autre (curseur = cible), onglet « À trier » ; KPI Sujets sur la page Sujets. `TaskItem` unifié (case à cocher, rail de couleur domaine, colonne heure). Sujet cliquable depuis une ligne (retour contextuel via `?from=`).
- **Fiche Sujet — Conversations** : composer limité à l'onglet, **select d'interlocuteur qui switche la conversation** (filtre `sender/recipientContactId`), option **« Tous »** (diffusion) dès > 1 interlocuteur ; « Destinataire » → « Interlocuteur ».
- **PWA iOS fiabilisée** : hauteur de cadre stable (`--app-height` = max des métriques viewport, dont `screen.height` en portrait) — fin du cadre rétréci / bande blanche au lancement ; **verrou portrait** (voile paysage) ; zoom bloqué ; garde anti-rebond corrigée (ignore l'horizontal).
- Filtres « Mon fil » à un niveau (chips + select), « Nouveau » devenu marqueur dérivé.

**➡️ M9 CLÔTURÉ le 2026-06-30.** Démo client du 2026-06-29 validée (« très satisfaits »). Reste du travail d'**amélioration continue** de l'UI, mené au fil de l'usage — **hors jalon**, pas bloquant. Prochaine étape produit : **M10 (drawer chatbot)**, la surface d'action principale.

---

### M10 — Drawer chatbot

**Objectif** : implémenter la surface d'action principale du produit — un chatbot drawer page-aware, action-capable, accessible partout, avec une palette de tools symétrique à l'UI.

**Dépendances** : M3 (accès CRUD), M7 (pipeline IA), M11 (Knowledge).

- **M10.1** — UI drawer latéral (Shadcn Sheet, ~40 % de largeur) + bouton flottant chatbot présent sur toutes les pages
- **M10.2** — Stockage IndexedDB des conversations chatbot (lib `dexie` : conversations + messages)
- **M10.3** — Sessions implicites : réouverture de la conversation en cours si dernière activité < 5 min, sinon nouvelle conversation
- **M10.4** — Liste des N dernières conversations dans le drawer (10 par défaut) + titre auto-généré par Haiku
- **M10.5** — Chip de contexte page-aware en haut du drawer (« Contexte : SUB-0142 — Sauce blanche ») + bouton × pour basculer en discussion générale
- **M10.6** — Empty state : 3 à 4 prompts contextuels à la page courante, rendus en texte gris italique sans bulle de message, cliquables pour pré-remplir le champ
- **M10.7** — Route API Next.js `/api/chat` qui orchestre Vercel AI SDK + AI Gateway → Claude
- **M10.8** — Système de **tools** symétriques à l'UI :
  - Lecture : `list_subjects`, `get_subject`, `list_tasks`, `get_task`, `search_messages`, `get_kpis`, `list_contacts`, `get_contact`, `list_knowledge_documents`, `read_knowledge_document`
  - Écriture : `create_subject`, `update_subject_status`, `update_subject_priority`, `update_subject_summary`, `create_task`, `update_task`, `mark_task_done`, `mark_task_deleted`, `create_message_draft` (dépose dans le composer, jamais d'envoi direct), `create_knowledge_note`, `update_knowledge_note`, `delete_knowledge_note`
- **M10.9** — Rendu des actions exécutées par Relvo sous forme de **blocs visuels structurés** dans le fil (« ✦ J'ai créé la tâche… [Voir] [Annuler] »)
- **M10.10** — Mécanisme d'**annulation** d'une action chat-driven dans une fenêtre de quelques minutes (restauration de l'état précédent via `EventLog`)
- **M10.11** — Routing automatique du modèle : Haiku pour les requêtes simples, Sonnet pour analyse et écriture
- **M10.12** — Prompt caching configuré (system prompt + KnowledgeDocuments)
- **M10.13** — Trace `EventLog.metadata.source = "chat"` sur toute action chat-driven
- **M10.14** — Streaming des réponses Claude dans le drawer (text + tool calls)
- **M10.15** — Gestion des erreurs (timeout, tool fail) avec messages explicites dans le fil

---

### M11 — Connaissances (KnowledgeDocument)

**Objectif** : permettre à l'utilisateur d'alimenter la base de connaissances de Relvo via PDFs et notes Markdown, organisés par Folder.

**Dépendances** : M3 (KnowledgeDocument), M4 (stockage fichiers).

- **M11.1** — Upload PDF par drag-and-drop directement dans la fiche d'un Dossier
- **M11.2** — Upload vers l'API Files d'Anthropic + stockage de l'`anthropic_file_id`
- **M11.3** — Étiquetage Haiku automatique du fichier (`ai_label` : organigramme, facture, devis, contrat-type, procédure, autre)
- **M11.4** — CRUD des notes Markdown (éditeur simple type Textarea + preview, ou éditeur léger Markdown)
- **M11.5** — Affichage des citations dans les `Task` et `Action` : petit lien « Source » discret quand `citation_ids` est renseigné

---

### M12 — Mécanismes transverses

**Objectif** : implémenter les mécanismes UX et techniques qui s'appliquent à plusieurs modules à la fois.

**Dépendances** : M3, M7, M9.

- **M12.1** — Génération automatique de la `reference` du Subject (SUB-00001, SUB-00002, etc.)
- **M12.2** — Système de notifications côté UI (toast Shadcn) pour les actions chat-driven et les confirmations
- **M12.3** — Real-time : polling 30 s sur Mon fil et fiche Sujet (WebSocket reporté en V2)
- **M12.4** — Recalcul automatique des KPIs, en cache, refresh sur mutation
- **M12.5** — Invalidation des suggestions : si une activité postérieure invalide une résolution suggérée, `resolution_suggested_at` est remis à null
- **M12.6** — Pile « Aucune date » accessible en marge des calendriers (semaine + mois)

---

### M13 — Onboarding & lancement bêta

**Objectif** : préparer le produit à accueillir ses premiers utilisateurs en bêta privée.

**Dépendances** : M2, M5, M6, M11.

- **M13.1** — Provisioning manuel d'un compte (CLI ou page admin protégée par un secret)
- **M13.2** — Onboarding in-app en 3 écrans : connecter ses canaux + créer un dossier + uploader sa première note de Connaissances
- **M13.3** — Pages d'erreur 404, 500, maintenance
- **M13.4** — Documentation utilisateur courte (1 page intégrée dans Paramètres ou Notion)
- **M13.5** — Widget de feedback in-app (« ✦ Donner un avis » → email vers inbox interne)

---

### M14 — Qualité & exploitation

**Objectif** : sécuriser le bon fonctionnement du produit en production et préparer l'exploitation.

**Dépendances** : tous les modules précédents.

- **M14.1** — Tests d'intégration sur le `MessageProcessor` (couvrir les cas A à V de `../conception/03-cas-usage.md`)
- **M14.2** — Tests E2E Playwright sur les 3 flux critiques : login, traiter un sujet, dialoguer dans le drawer
- **M14.3** — Monitoring : Sentry (web) + Vercel Analytics + suivi de l'état des connexions Unipile (webhook `account_status`)
- **M14.4** — Sauvegarde DB quotidienne (Neon : backups / point-in-time recovery) + test de restore
- **M14.5** — Dashboard de coûts Claude (tokens/jour/compte) via AI Gateway
- **M14.6** — Durcissement anti-loop d'ingestion (déjà couvert en M5.5 par la dédup `external_id` + `mail_sent` ignoré ; renforcer si dérive constatée)

---

## 5. Dépendances et ordre de réalisation

### Graphe de dépendances

```
M1 (fondations)
   └─→ M2 (auth)
          └─→ M3 (modèle + CRUD)
                 ├─→ M4 (stockage fichiers)
                 ├─→ M5 (ingestion email)  ──┐
                 ├─→ M6 (ingestion WhatsApp) ┤
                 ├─→ M9 (pages front)        ├─→ M7 (pipeline IA)
                 ├─→ M11 (Connaissances)     ┘     │
                 └─→ M12 (mécanismes transverses)  │
                                                   ├─→ M10 (chatbot)
                                                   ├─→ M8 (PJ IA)
                                                   └─→ M13 (onboarding)
                                                         │
                                                         └─→ M14 (qualité)
```

### Jalon démo intermédiaire

Après **M1 + M2 + M3 + M9** (CRUD UI fonctionnelle avec données seed, sans IA ni ingestion réelle), on dispose d'une **démo cliquable** utilisable pour démarchage prospects en parallèle du développement IA.

### Ordre recommandé

1. **Socle** : M1, M2, M3, M4
2. **Front en parallèle de l'ingestion** : M9 d'un côté, M5 + M6 de l'autre
3. **Cœur produit** : M7, M11, M12
4. **Surface d'action principale** : M10
5. **Finitions** : M8, M13
6. **Stabilisation** : M14
