# Spécification technique — Architecture Relvo V1

> Source de vérité pour les **choix technologiques et l'architecture**. Pour le *quoi/pourquoi* produit, voir [`../conception/`](../conception). Pour l'ordre de réalisation, voir [`../backlog/backlog-v1.md`](../backlog/backlog-v1.md).

## 1. Vue d'ensemble

Relvo V1 est une application **Next.js fullstack** déployée sur **Vercel**, complétée par un **worker WhatsApp dédié** déployé sur une plateforme à process longs (Railway/Render). Les deux partagent une base **PostgreSQL** via un schéma **Prisma** commun.

Le tout vit dans un **monorepo léger** (pnpm workspaces) :

| Workspace | Rôle | Hébergement |
|---|---|---|
| **`apps/web`** | App Next.js fullstack : UI + API (Route Handlers + Server Actions) + auth + chatbot + CRUD | **Vercel** |
| **`apps/worker`** | Daemon Baileys : connexion WhatsApp permanente + pipeline de traitement asynchrone | **Railway / Render** |
| **`packages/db`** | Schéma Prisma + client généré + enums partagés (`Actor`, `Status`, `Priority`, `Kind`, `TriageHint`) | — |

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

## 4. Stack détaillée

| Domaine | Choix |
|---|---|
| App / Front | **Next.js** App Router (fullstack), **mobile-first**, React Server Components par défaut, `"use client"` ciblé ; livré en **PWA installable** (manifest + service worker, `display: standalone`) — cf. ci-dessous |
| UI | **Shadcn UI** + **Tailwind**, thème navy (#0A1128) / blue (#2B6FE0) / red (#E63150) issu de la maquette |
| API | **Route Handlers** (`/api/*`) + **Server Actions** |
| Base de données | **PostgreSQL** (Neon, via le Marketplace Vercel) + **Prisma** |
| Types partagés | Enums Prisma exposés depuis `packages/db` (pas de package `shared-types` séparé) |
| Auth | **Auth.js** in-app (provider Credentials + Google OAuth), sessions cookie/JWT, middleware de protection des routes |
| IA | **Vercel AI SDK** + **Vercel AI Gateway** ; Claude **Haiku / Sonnet / Opus** selon complexité (Opus rare) ; **Files API** Anthropic pour les PDFs (`anthropic_file_id`) ; **prompt caching** (system prompt + KnowledgeDocuments) ; **citations natives** activées (UI minimale en V1) |
| Chat local | **IndexedDB** via `dexie` (conversations chatbot éphémères, côté client, pas d'entité serveur) |
| Drag & drop | `dnd-kit` (replanification des tâches sur les calendriers) |
| Stockage fichiers | **Vercel Blob**, upload via URL pré-signée |
| WhatsApp | **Baileys** dans `apps/worker` (WhatsApp perso du dirigeant, risque de ban assumé et documenté) |
| Email | **Postmark Inbound** (entrant) + **Resend / Postmark** (sortant) |
| File asynchrone | **BullMQ** (ou file simple) dans `apps/worker` |
| Temps réel | **Polling 30 s** en V1 (WebSocket = V2) |
| Observabilité | **Sentry** (web + worker), **Vercel Analytics**, logs Railway, dashboard coûts via AI Gateway |
| Hébergement | `apps/web` → **Vercel** (Root Directory = `apps/web`) · `apps/worker` → **Railway/Render** |

### Cible mobile : PWA en V1, Expo en réserve (décision 2026-06-18)

Le produit vise une **application mobile** (utilisateurs food/bâtiment qui vivent sur smartphone, toujours sur WhatsApp). Décision : **PWA** en V1, pas de natif.

- **Pourquoi PWA** : « mobile-first » est une affaire d'UI/CSS, pas de framework. Une PWA **installée** (`display: standalone`) tourne plein écran, sans chrome de navigateur — rendu quasi-natif (safe-areas gérées via `env(safe-area-inset-*)`, barres edge-to-edge, `backdrop-filter` disponible). **Zéro réécriture** : tout le Next.js (SSR, Server Actions, Route Handlers) est réutilisé ; distribution par **simple lien** (WhatsApp).
- **Seule vraie faiblesse** : la **friction d'installation iOS** (pas d'invite automatique — geste manuel *Partager → « Sur l'écran d'accueil »* ; sur Chrome iOS, via *« Plus »*). Atténuée par un guide d'installation et l'accompagnement des premiers utilisateurs.
- **Issue de secours V2 — Expo / Capacitor** : si la présence **stores**, un **push iOS infaillible** ou la friction d'install deviennent bloquants, on emballe le frontend dans une coque native. Le **backend ne bouge pas** (worker, auth, DB, chatbot restent serveur) — c'est purement une question de coque frontend. Capacitor réutilise le code web ; Expo/React Native impliquerait une 2ᵉ codebase UI.

La maquette mobile-first de référence vit dans `mockup/mobile/` (PWA installable déjà câblée : `manifest.webmanifest`, `sw.js`, `pwa.js`).

## 5. Choix techniques arbitrés

| Sujet | Choix retenu | Justification |
|---|---|---|
| Architecture | **Next.js fullstack** (pas de back découplé) | 1 compte = 1 humain, pas de besoin justifiant NestJS + JWT ; réduit à 1 le nombre de runtimes applicatifs |
| Worker WhatsApp | **Process séparé** sur plateforme always-on | Baileys exige un WebSocket permanent, impossible en serverless Vercel |
| Monorepo | **pnpm workspaces** (Turbo optionnel) | Justifié par le partage du schéma DB entre `web` et `worker` |
| Auth | **Auth.js** in-app | Standard, pas de dépendance payante, pas de JWT inter-services à gérer |
| Email entrant | **Postmark Inbound** (webhook) | Robuste, async natif, setup rapide vs IMAP polling |
| WhatsApp | **Baileys** (lib non officielle) | Seule voie viable pour le WhatsApp perso d'un dirigeant ; risque ban assumé |
| Stockage fichiers | **Vercel Blob** | Intégré à l'hébergement web, upload pré-signé |
| Base de données | **Neon** (Marketplace Vercel) | Postgres managé, intégration native Vercel, branches de preview |
| Stripe | **Reporté V1.1** | Bêta privée gratuite |
| RAG | **Pas de base vectorielle** | Long context + prompt caching suffisent (cf. `../conception/04-ia.md §10`) |
| MCP | **Pas en V1** | Tool calling natif Anthropic suffit pour un chatbot in-app |
| Temps réel | **Polling 30 s** | Suffisant en V1, WebSocket en V2 |
| Conversations chatbot | **IndexedDB éphémère** | Pas d'entité serveur, architecture simplifiée |

## 6. Arborescence technique

```
relvo/
├── apps/
│   ├── web/                    # → Vercel (Root Directory = apps/web)
│   │   ├── src/app/            # routes App Router + UI
│   │   │   ├── api/chat/                  # AI SDK + Gateway
│   │   │   └── api/webhooks/postmark/     # email entrant
│   │   ├── src/components/     # layout/ (Sidebar, ChatDrawer), feed/, ui/ (shadcn)
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

## 7. Déploiement

- **`apps/web`** → Vercel. Importer le repo, *Root Directory = `apps/web`*, renseigner les variables d'environnement, `git push` déclenche le déploiement.
- **`apps/worker`** → Railway/Render. Service pointé sur `apps/worker`, redémarrage automatique, doit rester *always-on*.
- Les deux pointent vers la **même base PostgreSQL** (Neon).
- Variables d'environnement : documentées dans le `README.md` à la racine.

## 8. Alternative écartée — backend NestJS découplé

Le plan initial prévoyait un monorepo Turborepo avec `apps/api` (NestJS + Prisma), un package `shared-types`, et une auth par JWT signé transmis du front au back. **Écarté** : pour un produit mono-utilisateur sans besoin d'API publique ni de scaling indépendant de la couche métier, le découplage ne fait qu'ajouter un runtime, un déploiement et de la plomberie d'authentification — sans bénéfice. Le seul composant qui justifie réellement un process séparé (le daemon WhatsApp) est isolé dans `apps/worker`, ce qui n'impose pas de découpler le reste de l'API.
