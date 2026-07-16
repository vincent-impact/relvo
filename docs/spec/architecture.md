# Spécification technique — Architecture Relvo V1

> Source de vérité pour les **choix technologiques et l'architecture**. Pour le *quoi/pourquoi* produit, voir [`../conception/`](../conception). Pour l'ordre de réalisation, voir [`../backlog/backlog-v1.md`](../backlog/backlog-v1.md).

## 1. Vue d'ensemble

Relvo V1 est une application **Next.js fullstack** déployée sur **Vercel** — **déployable unique** depuis la bascule Unipile (2026-07-16, cf. §2) : email et WhatsApp sont ingérés par webhooks serverless, il n'y a plus de worker always-on. Base **PostgreSQL** via un schéma **Prisma**.

Le tout vit dans un **monorepo léger** (pnpm workspaces) :

| Workspace | Rôle | Hébergement |
|---|---|---|
| **`apps/web`** | App Next.js fullstack : UI + API (Route Handlers + Server Actions) + auth + chatbot + CRUD + **webhooks d'ingestion Unipile** | **Vercel** |
| **`packages/db`** | Schéma Prisma + client généré + enums partagés (`Actor`, `SubjectStatus` — 4 valeurs : `acknowledged`, `resolved`, `archived`, `ignored` (défaut `acknowledged` ; « Nouveau » n'est plus un statut mais un marqueur dérivé de `last_opened_at == null`) ; `Priority` — 2 valeurs : `normal`, `urgent` ; `TaskKind`, `TriageHint`…) + couche domaine partagée | — |
| **`packages/storage`** | Stockage fichiers R2 (upload pré-signé, download authentifié, outbox de suppression) | — |

> **~~`apps/worker`~~ (Daemon Baileys) — abandonné** avec la bascule Unipile : le socket WhatsApp permanent vit désormais chez Unipile, WhatsApp devient un webhook serverless comme l'email.

## 2. Décision structurante : pas de backend découplé, et plus de worker (bascule Unipile)

### Pourquoi Next.js fullstack plutôt qu'un back NestJS séparé

Pour ce produit (**1 compte = 1 humain**, polling 30 s, pas de RAG vectorielle), un backend découplé avec sa propre couche d'auth (JWT inter-services) **n'apporte aucune valeur** et alourdit l'exploitation (deux runtimes, deux déploiements, plomberie JWT). Les **Route Handlers** (`/api/*`) et **Server Actions** de Next.js, adossés à **Prisma**, couvrent l'intégralité du CRUD, de l'auth et de l'endpoint `/api/chat`.

> ⚠️ Cette décision **remplace** le plan initial (monorepo Turborepo + NestJS découplé + JWT) qui figurait dans les premières versions des docs. Toute mention de NestJS / `apps/api` / JWT inter-services dans d'anciens documents est **caduque**.

### Pourquoi il n'y a plus de worker always-on (bascule Unipile, 2026-07-16)

**Le plan initial** exigeait un process séparé *always-on* (Railway/Render) parce que l'ingestion WhatsApp passait par **Baileys** (client WhatsApp Web non officiel), qui maintient un **WebSocket permanent** — impossible en serverless Vercel (fonctions *request-scoped*, durée bornée).

**Décision 2026-07-16 : email ET WhatsApp passent désormais par l'agrégateur managé [Unipile](https://www.unipile.com).** Unipile porte, derrière une API unifiée, la connexion des boîtes (OAuth Gmail/Outlook, IMAP), l'envoi **« au nom de » l'utilisateur** (la réponse part de sa vraie adresse, atterrit dans ses Envoyés) et la réception **par webhooks temps réel**. Il gère aussi WhatsApp (connexion par **QR code**, webhooks). Le socket permanent WhatsApp vit **chez Unipile**, plus chez nous. Conséquences :

- **Plus de daemon permanent, plus de `apps/worker`.** Email et WhatsApp deviennent des **webhooks → `apps/web`** (serverless). Un seul déployable (Vercel).
- **Envoi vraie adresse résolu pour tous les providers** (Gmail/Outlook/IMAP : OVH, Orange, Free…) sans audit Google CASA — car on ne lit **pas** l'historique, seulement le nouveau courrier.
- **RGPD** : Unipile héberge en **UE**, est **SOC 2** et fournit un **DPA**. C'est un tiers traitant, à contractualiser.
- **Le risque de ban WhatsApp demeure** (connexion non officielle sous le capot) : Unipile ôte la charge *opérationnelle* (hosting du socket, reconnexion), pas le risque *TOS*. À documenter côté utilisateur (backlog M6).

Pourquoi Unipile plutôt que Nylas (l'autre agrégateur crédible) : Nylas ne fait pas WhatsApp. Unipile **unifie email + WhatsApp** sous un seul contrat → M5 et M6 partagent l'intégration. Coût : 49 €/mois (10 comptes connectés), puis 5 €/compte.

> ⚠️ Toute mention d'un worker Baileys, de Railway/Render, de BullMQ ou de Postmark dans d'anciens documents est **caduque** depuis cette bascule.

## 3. Flux de données

### Ingestion Email & WhatsApp (via Unipile)

1. L'utilisateur **connecte sa boîte** (ou son WhatsApp) via le **hosted auth** Unipile — un lien généré côté serveur (`POST /api/v1/hosted/accounts/link`), vers lequel on le redirige ; Unipile gère tout le consentement OAuth/IMAP (ou le QR WhatsApp). Un webhook `notify` nous renvoie l'`account_id` Unipile, qu'on relie au `Channel` (`ChannelConfig.external_account_id`).
2. À chaque nouveau message, Unipile poste un **webhook signé** (header secret `Unipile-Auth`) sur `/api/webhooks/unipile`. Le Route Handler **vérifie le secret**, **résout le tenant** depuis `external_account_id` (accès Prisma hors tenant, même schéma que le cron M4.6), et **normalise en `Message`** de façon **idempotente** (dédup sur `channel_id + external_id`). Le message naît **orphelin** (« Sans sujet ») ; le pipeline IA (M7) le transformera en Sujet.
3. Les **pièces jointes** sont récupérées via l'API Unipile puis stockées dans **R2** (source de vérité), et un `Attachment` est créé (M5.4). Unipile n'est qu'un transport.
4. **Envoi sortant** (`POST /api/v1/emails`) : `apps/web` appelle Unipile, qui envoie **depuis la vraie adresse** de l'utilisateur. Aucun endpoint `send` à héberger.
5. `apps/web` lit en base ; le navigateur rafraîchit par polling 30 s.

> **Anti-loop** : nos envois passent par l'API (pas par un transfert qui reboucle), donc le risque de boucle est marginal. Garde-fous conservés : dédup par `external_id`, on n'ingère jamais un `mail_sent`, on ignore un entrant dont l'expéditeur est une de nos propres adresses connectées.

### Pipeline de traitement IA

Le traitement (compréhension, classement, rattachement Subject/Contact, génération de tâches + brouillon, extraction de date) s'exécute en **tâche de fond**, déclenché par l'arrivée d'un message quel que soit le canal. Sans worker always-on, il s'appuiera sur une exécution **serverless** (fonction de fond Vercel / **Vercel Queues**, plafond de durée relevé par Fluid Compute). Choix de l'orchestration à arrêter en **M7**. Détail fonctionnel : `../conception/04-ia.md` et backlog M7.

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
| Email + WhatsApp | **Unipile** (agrégateur managé UE/SOC2/DPA) : hosted auth (OAuth Gmail/Outlook, IMAP, QR WhatsApp), webhooks entrants temps réel, envoi « au nom de » l'utilisateur. Remplace Postmark **et** Baileys (bascule 2026-07-16). Le risque de ban WhatsApp reste assumé et documenté |
| Emails transactionnels | **Resend** (vérification de compte, reset password) — inchangé |
| Traitement asynchrone | **Serverless** (webhooks Unipile + fonction de fond / **Vercel Queues** pour le pipeline IA M7). Plus de BullMQ ni de daemon |
| Temps réel | **Polling 30 s** en V1 (WebSocket = V2) |
| Observabilité | **Sentry** (web), **Vercel Analytics**, dashboard coûts via AI Gateway |
| Hébergement | **`apps/web` → Vercel** (Root Directory = `apps/web`), **déployable unique** — plus de worker Railway/Render |

### Cible mobile : PWA en V1, Expo en réserve (décision 2026-06-18)

Le produit vise une **application mobile** (utilisateurs food/bâtiment qui vivent sur smartphone, toujours sur WhatsApp). Décision : **PWA** en V1, pas de natif.

- **Pourquoi PWA** : « mobile-first » est une affaire d'UI/CSS, pas de framework. Une PWA **installée** (`display: standalone`) tourne plein écran, sans chrome de navigateur — rendu quasi-natif (safe-areas gérées via `env(safe-area-inset-*)`, barres edge-to-edge, `backdrop-filter` disponible). **Zéro réécriture** : tout le Next.js (SSR, Server Actions, Route Handlers) est réutilisé ; distribution par **simple lien** (WhatsApp).
- **Seule vraie faiblesse** : la **friction d'installation iOS** (pas d'invite automatique — geste manuel *Partager → « Sur l'écran d'accueil »*, indifféremment depuis **Safari ou Chrome iOS** puisque le standalone est piloté par la meta tag, pas par le navigateur). Atténuée par un guide d'installation et l'accompagnement des premiers utilisateurs.
- **Issue de secours V2 — Expo / Capacitor** : si la présence **stores**, un **push iOS infaillible** ou la friction d'install deviennent bloquants, on emballe le frontend dans une coque native. Le **backend ne bouge pas** (auth, DB, chatbot, webhooks d'ingestion restent serveur) — c'est purement une question de coque frontend. Capacitor réutilise le code web ; Expo/React Native impliquerait une 2ᵉ codebase UI.

La maquette mobile-first de référence vit dans `mockup/mobile/`. Dans `apps/web`, l'installabilité PWA est câblée par :
- `src/app/manifest.ts` → `MetadataRoute.Manifest` servi sur `/manifest.webmanifest` : `display: standalone`, `theme_color: #6b5bd6`, icônes **192** et **512** (exigence d'installabilité Chrome).
- `src/app/layout.tsx` → métadonnées `appleWebApp.capable` (émet `<meta name="apple-mobile-web-app-capable">`), `statusBarStyle: black-translucent`, `other: { "mobile-web-app-capable": "yes" }`, plus `viewport` (`themeColor`, `viewportFit: cover`) et un bandeau violet fixe derrière la status bar (safe-area-inset-top).

> ⚠️ Sur iOS, le mode standalone est piloté par la **meta tag** `apple-mobile-web-app-capable`, pas par le navigateur : l'installation « Sur l'écran d'accueil » fonctionne donc **depuis Safari comme depuis Chrome iOS** (tous deux WebKit). La seule friction est l'absence d'invite automatique (geste manuel *Partager → « Sur l'écran d'accueil »*).

## 5. Choix techniques arbitrés

| Sujet | Choix retenu | Justification |
|---|---|---|
| Architecture | **Next.js fullstack** (pas de back découplé) | 1 compte = 1 humain, pas de besoin justifiant NestJS + JWT ; réduit à 1 le nombre de runtimes applicatifs |
| Email + WhatsApp | **Unipile** (agrégateur managé), bascule 2026-07-16 | Envoi « au nom de » l'utilisateur exigé + multi-provider (OVH/Orange/Free) + connexion un-clic. Un seul vendor unifie email et WhatsApp → **supprime le worker always-on** (Baileys) et le montage Postmark. UE/SOC2/DPA. Cf. §2 |
| ~~Worker WhatsApp~~ | **Abandonné** (bascule Unipile) | Le socket WhatsApp permanent vit chez Unipile ; WhatsApp devient un webhook serverless comme l'email |
| Monorepo | **pnpm workspaces** | Partage de `packages/db` (schéma + domaine) et `packages/storage` entre l'app et les scripts ; conservé même sans worker |
| Auth | **Auth.js** in-app | Standard, pas de dépendance payante, pas de JWT inter-services à gérer |
| Lecture email | **Nouveau courrier seulement** (pas d'historique) | Évite les scopes Gmail « restricted » et l'audit **CASA** ; le webhook `mail_received` suffit à alimenter le pipeline |
| Stockage fichiers | **Cloudflare R2** (décision 2026-07-15) | **API S3-compatible** : un client S3 générique dans `packages/storage` (les pièces jointes email/WhatsApp récupérées via Unipile y sont poussées), outillage connu, sortie vers S3 possible sans réécrire les call sites. **Free tier permanent** (10 Go, 1 M écritures, 10 M lectures/mois) qui couvre toute la bêta, sans imposer un abonnement Vercel Pro. Setup = 1 bucket + 1 token, contre 5 services AWS (S3 + CloudFront + IAM + ACM + Route 53) pour S3, et contre un lock-in propriétaire sans API S3 pour Vercel Blob. Le coût n'a pas départagé : les trois options sont sous 2 $/mois à l'échelle V1 |
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
│   └── web/                    # → Vercel (Root Directory = apps/web) — déployable UNIQUE
│       ├── src/app/            # routes App Router + UI (voir « Routes & navigation »)
│       │   ├── manifest.ts                # manifest PWA (display: standalone)
│       │   ├── api/chat/                  # AI SDK + Gateway
│       │   └── api/webhooks/unipile/      # email + WhatsApp entrants (Unipile)
│       ├── src/components/     # layout/ (tab bar bas, composer Relvo), feed/, ui/ (shadcn)
│       ├── src/lib/            # db (client Prisma), auth, helpers
│       └── src/server/         # Server Actions + logique métier + unipile/ (client intégration)
├── packages/
│   └── db/
│       └── prisma/schema.prisma   # schéma + enums (partagé app ↔ scripts/tests)
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

- **`apps/web`** → Vercel (**déployable unique**). Importer le repo, *Root Directory = `apps/web`*, renseigner les variables d'environnement (dont `UNIPILE_*`), `git push` déclenche le déploiement.
- Base **PostgreSQL** (Neon). Variables d'environnement documentées dans le `README.md` à la racine.
- **Webhook Unipile** : configurer, côté dashboard Unipile, l'URL `https://<app>/api/webhooks/unipile` avec un header `Unipile-Auth: <UNIPILE_WEBHOOK_SECRET>`.

## 9. Alternative écartée — backend NestJS découplé

Le plan initial prévoyait un monorepo Turborepo avec `apps/api` (NestJS + Prisma), un package `shared-types`, et une auth par JWT signé transmis du front au back. **Écarté** : pour un produit mono-utilisateur sans besoin d'API publique ni de scaling indépendant de la couche métier, le découplage ne fait qu'ajouter un runtime, un déploiement et de la plomberie d'authentification — sans bénéfice. Le seul composant qui aurait justifié un process séparé (le daemon WhatsApp Baileys) a lui-même été **supprimé** par la bascule vers Unipile (webhooks serverless, cf. §2) : il ne reste donc **qu'un seul runtime applicatif**.
