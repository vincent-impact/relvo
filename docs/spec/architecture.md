# Spécification technique — Architecture Relvo V1

> Source de vérité pour les **choix technologiques et l'architecture**. Pour le *quoi/pourquoi* produit, voir [`../conception/`](../conception). Pour l'ordre de réalisation, voir [`../backlog/backlog-v1.md`](../backlog/backlog-v1.md).

## 1. Vue d'ensemble

Relvo V1 est une application **Next.js fullstack** déployée sur **Vercel**, complétée par un **worker WhatsApp dédié** déployé sur une plateforme à process longs (Railway/Render). Les deux partagent une base **PostgreSQL** via un schéma **Prisma** commun.

Le tout vit dans un **monorepo léger** (pnpm workspaces) :

| Workspace | Rôle | Hébergement |
|---|---|---|
| **`apps/web`** | App Next.js fullstack : UI + API (Route Handlers + Server Actions) + auth + chatbot + CRUD | **Vercel** |
| **`apps/worker`** | Daemon Baileys : connexion WhatsApp permanente + pipeline de traitement asynchrone | **Railway / Render** |
| **`packages/db`** | Schéma Prisma + client généré + enums partagés (`Actor`, `SubjectStatus` — 4 valeurs : `acknowledged`, `resolved`, `archived`, `ignored` (défaut `acknowledged` ; « Nouveau » n'est plus un statut mais un marqueur dérivé de `last_opened_at == null`) ; `Priority` — 2 valeurs : `normal`, `urgent` ; `TaskKind`, `TriageHint`…) + couche domaine partagée | — |

## 2. Décision structurante : pas de backend découplé, mais un worker obligatoire

### Pourquoi Next.js fullstack plutôt qu'un back NestJS séparé

Pour ce produit (**1 compte = 1 humain**, polling 30 s, pas de RAG vectorielle), un backend découplé avec sa propre couche d'auth (JWT inter-services) **n'apporte aucune valeur** et alourdit l'exploitation (deux runtimes, deux déploiements, plomberie JWT). Les **Route Handlers** (`/api/*`) et **Server Actions** de Next.js, adossés à **Prisma**, couvrent l'intégralité du CRUD, de l'auth et de l'endpoint `/api/chat`.

> ⚠️ Cette décision **remplace** le plan initial (monorepo Turborepo + NestJS découplé + JWT) qui figurait dans les premières versions des docs. Toute mention de NestJS / `apps/api` / JWT inter-services dans d'anciens documents est **caduque**.

### Pourquoi un worker séparé reste indispensable

**WhatsApp est une priorité V1 au même titre que l'email.** L'ingestion passe par **Baileys** (client WhatsApp Web non officiel), seule voie viable pour le WhatsApp **personnel** d'un dirigeant. Or Baileys maintient un **WebSocket permanent** vers les serveurs WhatsApp pour recevoir les messages, gérer le pairing QR et se reconnecter.

Une fonction serverless Vercel est **request-scoped** : durée d'exécution bornée, aucune garantie de process *always-on*. Elle **ne peut donc pas** héberger Baileys. Le worker tourne sur une plateforme qui exécute des process Node longue durée (Railway/Render).

À noter : ce n'est **pas** un problème de « temps réel vers le navigateur » (résolu simplement par du polling 30 s, cf. §6), mais bien un besoin de **daemon permanent côté serveur**.

## 3. Flux de données

### Ingestion WhatsApp

1. `apps/worker` tient le socket Baileys 24/7 → reçoit un message entrant.
2. Le worker écrit le `Message` en base (`packages/db`) et déclenche le **pipeline de traitement IA** (cf. backlog M7).
3. `apps/web` lit en base ; le navigateur rafraîchit par polling 30 s.
4. Pour **envoyer** un message WhatsApp, `apps/web` appelle un endpoint `send` exposé par le worker (authentifié par un secret partagé).

### Ingestion Email

1. Postmark **Inbound** envoie un webhook signé.
2. Un **Route Handler** Next (`/api/webhooks/postmark/inbound`) reçoit, vérifie la signature, normalise en `Message` et déclenche le pipeline.
3. Envoi sortant via **Resend / Postmark SMTP**.

Aucun worker n'est nécessaire pour l'email : tout passe par `apps/web`.

### Pipeline de traitement IA

Le traitement (compréhension, classement, rattachement Subject/Contact, génération de tâches + brouillon, extraction de date) s'exécute en **tâche de fond**, déclenché par l'arrivée d'un message quel que soit le canal. Implémenté dans `apps/worker` (file BullMQ ou équivalent) pour ne pas dépendre des limites de durée serverless. Détail fonctionnel : `../conception/04-ia.md` et backlog M7.

Le `Message` porte deux champs liés au tri : `folder_id` (domaine assigné dès la réception par la classification Relvo, relation `Folder` en `onDelete: SetNull` ; donne ensuite son domaine au sujet créé à partir du message) et `read_at` (lu/non-lu — posé à l'ouverture du sujet rattaché ; les orphelins « Sans sujet » restent non-lus jusqu'au tri). `Folder` porte la relation inverse `messages Message[]`.

## 4. Stack détaillée

| Domaine | Choix |
|---|---|
| App / Front | **Next.js** App Router (fullstack), **mobile-first**, React Server Components par défaut, `"use client"` ciblé ; livré en **PWA installable** (manifest + service worker, `display: standalone`) — cf. ci-dessous |
| UI | **Shadcn UI** + **Tailwind**, thème navy (#0A1128) / blue (#2B6FE0) / red (#E63150) issu de la maquette |
| API | **Route Handlers** (`/api/*`) + **Server Actions** |
| Base de données | **PostgreSQL** (Neon, via le Marketplace Vercel) + **Prisma** |
| Types partagés | Enums Prisma exposés depuis `packages/db` (`SubjectStatus` 4 valeurs, `Priority` 2 valeurs, `Actor`, `TaskStatus`, `TriageHint`…) — pas de package `shared-types` séparé. La logique métier (queries, mutations) vit aussi dans `packages/db/src/domain` |
| Auth | **Auth.js** in-app (provider Credentials + Google OAuth), sessions cookie/JWT, middleware de protection des routes |
| IA | **Vercel AI SDK** + **Vercel AI Gateway** ; Claude **Haiku / Sonnet / Opus** selon complexité (Opus rare) ; **Files API** Anthropic pour les PDFs (`anthropic_file_id`) — **copie d'inférence en écriture seule, jamais la source de vérité** (cf. §5) ; **prompt caching** (system prompt + KnowledgeDocuments) ; **citations natives** activées (UI minimale en V1) |
| Chat local | **IndexedDB** via `dexie` (conversations chatbot éphémères, côté client, pas d'entité serveur) |
| Drag & drop | `dnd-kit` (replanification des tâches sur les calendriers) |
| Stockage fichiers | **Cloudflare R2** (object storage S3-compatible), upload navigateur via URL pré-signée. **Pas de CDN devant** : les fichiers sont privés et cloisonnés par tenant, un cache edge n'apporte rien à cette échelle et empêcherait les URLs pré-signées (cf. §5) |
| WhatsApp | **Baileys** dans `apps/worker` (WhatsApp perso du dirigeant, risque de ban assumé et documenté) |
| Email | **Postmark Inbound** (entrant) + **Resend / Postmark** (sortant) |
| File asynchrone | **BullMQ** (ou file simple) dans `apps/worker` |
| Temps réel | **Polling 30 s** en V1 (WebSocket = V2) |
| Observabilité | **Sentry** (web + worker), **Vercel Analytics**, logs Railway, dashboard coûts via AI Gateway |
| Hébergement | `apps/web` → **Vercel** (Root Directory = `apps/web`) · `apps/worker` → **Railway/Render** |

### Cible mobile : PWA en V1, Expo en réserve (décision 2026-06-18)

Le produit vise une **application mobile** (utilisateurs food/bâtiment qui vivent sur smartphone, toujours sur WhatsApp). Décision : **PWA** en V1, pas de natif.

- **Pourquoi PWA** : « mobile-first » est une affaire d'UI/CSS, pas de framework. Une PWA **installée** (`display: standalone`) tourne plein écran, sans chrome de navigateur — rendu quasi-natif (safe-areas gérées via `env(safe-area-inset-*)`, barres edge-to-edge, `backdrop-filter` disponible). **Zéro réécriture** : tout le Next.js (SSR, Server Actions, Route Handlers) est réutilisé ; distribution par **simple lien** (WhatsApp).
- **Seule vraie faiblesse** : la **friction d'installation iOS** (pas d'invite automatique — geste manuel *Partager → « Sur l'écran d'accueil »*, indifféremment depuis **Safari ou Chrome iOS** puisque le standalone est piloté par la meta tag, pas par le navigateur). Atténuée par un guide d'installation et l'accompagnement des premiers utilisateurs.
- **Issue de secours V2 — Expo / Capacitor** : si la présence **stores**, un **push iOS infaillible** ou la friction d'install deviennent bloquants, on emballe le frontend dans une coque native. Le **backend ne bouge pas** (worker, auth, DB, chatbot restent serveur) — c'est purement une question de coque frontend. Capacitor réutilise le code web ; Expo/React Native impliquerait une 2ᵉ codebase UI.

La maquette mobile-first de référence vit dans `mockup/mobile/`. Dans `apps/web`, l'installabilité PWA est câblée par :
- `src/app/manifest.ts` → `MetadataRoute.Manifest` servi sur `/manifest.webmanifest` : `display: standalone`, `theme_color: #6b5bd6`, icônes **192** et **512** (exigence d'installabilité Chrome).
- `src/app/layout.tsx` → métadonnées `appleWebApp.capable` (émet `<meta name="apple-mobile-web-app-capable">`), `statusBarStyle: black-translucent`, `other: { "mobile-web-app-capable": "yes" }`, plus `viewport` (`themeColor`, `viewportFit: cover`) et un bandeau violet fixe derrière la status bar (safe-area-inset-top).

> ⚠️ Sur iOS, le mode standalone est piloté par la **meta tag** `apple-mobile-web-app-capable`, pas par le navigateur : l'installation « Sur l'écran d'accueil » fonctionne donc **depuis Safari comme depuis Chrome iOS** (tous deux WebKit). La seule friction est l'absence d'invite automatique (geste manuel *Partager → « Sur l'écran d'accueil »*).

## 5. Choix techniques arbitrés

| Sujet | Choix retenu | Justification |
|---|---|---|
| Architecture | **Next.js fullstack** (pas de back découplé) | 1 compte = 1 humain, pas de besoin justifiant NestJS + JWT ; réduit à 1 le nombre de runtimes applicatifs |
| Worker WhatsApp | **Process séparé** sur plateforme always-on | Baileys exige un WebSocket permanent, impossible en serverless Vercel |
| Monorepo | **pnpm workspaces** (Turbo optionnel) | Justifié par le partage du schéma DB entre `web` et `worker` |
| Auth | **Auth.js** in-app | Standard, pas de dépendance payante, pas de JWT inter-services à gérer |
| Email entrant | **Postmark Inbound** (webhook) | Robuste, async natif, setup rapide vs IMAP polling |
| WhatsApp | **Baileys** (lib non officielle) | Seule voie viable pour le WhatsApp perso d'un dirigeant ; risque ban assumé |
| Stockage fichiers | **Cloudflare R2** (décision 2026-07-15) | **API S3-compatible** : un seul client S3 générique partagé `web` ⇄ `worker` (le worker Railway écrit les médias WhatsApp), outillage connu, sortie vers S3 possible sans réécrire les call sites. **Free tier permanent** (10 Go, 1 M écritures, 10 M lectures/mois) qui couvre toute la bêta, sans imposer un abonnement Vercel Pro. Setup = 1 bucket + 1 token, contre 5 services AWS (S3 + CloudFront + IAM + ACM + Route 53) pour S3, et contre un lock-in propriétaire sans API S3 pour Vercel Blob. Le coût n'a pas départagé : les trois options sont sous 2 $/mois à l'échelle V1 |
| Base de données | **Neon** (Marketplace Vercel) | Postgres managé, intégration native Vercel, branches de preview |
| Stripe | **Reporté V1.1** | Bêta privée gratuite |
| RAG | **Pas de base vectorielle** | Long context + prompt caching suffisent (cf. `../conception/04-ia.md §10`) |
| Files API ≠ stockage | **Deux copies assumées** : R2 (vérité) + Files API (inférence) | Un fichier uploadé via `POST /v1/files` porte `downloadable: false` **posé par le serveur** ; `GET /v1/files/{id}/content` renvoie **400** dessus (seuls les fichiers *générés* par les skills / le code execution tool sont téléchargeables). La Files API ne peut donc **pas** alimenter l'onglet Documents : c'est un cache d'inférence en écriture seule. Elle reste utile (gratuite, sans expiration, 500 Mo/fichier, 500 Go/organisation) pour éviter de re-uploader le PDF à chaque prompt. À savoir : **hors Zero Data Retention**, et indisponible sur Bedrock/Vertex |
| MCP | **Pas en V1** | Tool calling natif Anthropic suffit pour un chatbot in-app |
| Temps réel | **Polling 30 s** | Suffisant en V1, WebSocket en V2 |
| Conversations chatbot | **IndexedDB éphémère** | Pas d'entité serveur, architecture simplifiée |

## 6. Arborescence technique

```
relvo/
├── apps/
│   ├── web/                    # → Vercel (Root Directory = apps/web)
│   │   ├── src/app/            # routes App Router + UI (voir « Routes & navigation »)
│   │   │   ├── manifest.ts                # manifest PWA (display: standalone)
│   │   │   ├── api/chat/                  # AI SDK + Gateway
│   │   │   └── api/webhooks/postmark/     # email entrant
│   │   ├── src/components/     # layout/ (tab bar bas, composer Relvo), feed/, ui/ (shadcn)
│   │   ├── src/lib/            # db (client Prisma), auth, helpers
│   │   └── src/server/         # Server Actions + logique métier
│   └── worker/                 # → Railway/Render (always-on)
│       └── src/                # daemon Baileys + file BullMQ + pipeline IA
├── packages/
│   └── db/
│       └── prisma/schema.prisma   # schéma + enums partagés web ↔ worker
├── pnpm-workspace.yaml
├── turbo.json                  # optionnel (cache de build)
└── package.json
```

## 7. Routes & navigation (App Router)

L'app est **mobile-first**. La navigation est une **barre d'onglets en bas** à **4 entrées**, doublée d'un **composer Relvo persistant** (présent sur toutes les pages) qui ouvre la conversation Relvo. **Plus de sidebar ni de drawer latéral 40 %** : la conversation Relvo est une **surface plein écran**.

**4 onglets de la tab bar :**

| Onglet | Route | Écran |
|---|---|---|
| Accueil | `/` | Brief du jour (KPIs + agenda semaine + sujets prioritaires) |
| Mon fil | `/fil` | Traitement — 3 onglets de statut : Ouverts / Terminés / Ignorés (swipe ← Ignorer · → Terminer) |
| Mémoire | `/dossiers` | Liste des domaines |
| Réglages | `/parametres` | Compte, canaux, contacts |

**Routes hors-nav (atteintes par lien/recherche/clic) :**

| Route | Écran |
|---|---|
| `/dossiers/[id]` | Fiche domaine (onglets Instructions / Documents / Sujets) |
| `/sujets/[id]` | Détail d'un sujet — onglet pilotable via `?tab=` |
| `/sujets/nouveau` | Création d'un sujet |
| `/messages` | Pile des messages orphelins (« Sans sujet ») |
| `/messages/[id]` | Détail d'un message |
| `/planning` | Calendrier vue mois |
| `/contacts` · `/contacts/[id]` | Annuaire + fiche contact |
| `/recherche` | Recherche transverse |
| `/conversation` · `/conversations` | Conversation Relvo plein écran + historique des conversations |

Routes d'auth sous `(auth)/` (`connexion`, `inscription`, `mot-de-passe-oublie`, `reinitialiser-mot-de-passe`, `verifier-email`). Les routes applicatives vivent sous le groupe `(app)/` (layout partagé : tab bar + composer).

## 8. Déploiement

- **`apps/web`** → Vercel. Importer le repo, *Root Directory = `apps/web`*, renseigner les variables d'environnement, `git push` déclenche le déploiement.
- **`apps/worker`** → Railway/Render. Service pointé sur `apps/worker`, redémarrage automatique, doit rester *always-on*.
- Les deux pointent vers la **même base PostgreSQL** (Neon).
- Variables d'environnement : documentées dans le `README.md` à la racine.

## 9. Alternative écartée — backend NestJS découplé

Le plan initial prévoyait un monorepo Turborepo avec `apps/api` (NestJS + Prisma), un package `shared-types`, et une auth par JWT signé transmis du front au back. **Écarté** : pour un produit mono-utilisateur sans besoin d'API publique ni de scaling indépendant de la couche métier, le découplage ne fait qu'ajouter un runtime, un déploiement et de la plomberie d'authentification — sans bénéfice. Le seul composant qui justifie réellement un process séparé (le daemon WhatsApp) est isolé dans `apps/worker`, ce qui n'impose pas de découpler le reste de l'API.
