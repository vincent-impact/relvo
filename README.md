# Relvo

Assistant IA de pilotage des sollicitations professionnelles. Relvo transforme le flux désordonné de messages d'un dirigeant (e-mails, WhatsApp) en **sujets métier structurés**, avec tâches, journal de bord et aide à la décision.

> 📖 Documentation : vision et modèle produit dans [`docs/conception/`](./docs/conception) · architecture technique dans [`docs/spec/architecture.md`](./docs/spec/architecture.md) · roadmap dans [`docs/backlog/backlog-v1.md`](./docs/backlog/backlog-v1.md). Conventions et invariants pour le développement : [`CLAUDE.md`](./CLAUDE.md).

## Architecture

Monorepo (pnpm workspaces) avec deux déployables partageant un schéma Prisma :

| Workspace | Rôle | Hébergement |
|---|---|---|
| **`apps/web`** | App Next.js fullstack (UI + API + auth + chatbot + CRUD) | Vercel |
| **`apps/worker`** | Daemon Baileys (connexion WhatsApp permanente) + pipeline IA | Railway / Render |
| **`packages/db`** | Schéma Prisma + client généré, partagé web ↔ worker | — |

**Pourquoi un worker séparé ?** Baileys maintient un WebSocket permanent vers WhatsApp pour recevoir les messages. Les fonctions serverless Vercel sont *request-scoped* et ne peuvent pas héberger un process always-on — d'où un worker sur une plateforme à process longs. L'e-mail, lui, arrive par webhook Postmark (simple Route Handler dans `apps/web`) et ne nécessite aucun worker. Détail : [`docs/spec/architecture.md`](./docs/spec/architecture.md).

```
relvo/
├── apps/
│   ├── web/        → Vercel (Root Directory = apps/web)
│   └── worker/     → Railway/Render
├── packages/
│   └── db/         schéma Prisma partagé
├── docs/           conception · spec · backlog
└── mockup/         maquette HTML figée (référence visuelle)
```

## Prérequis

- **Node.js** 24 LTS
- **pnpm** 9+
- **PostgreSQL** — Neon (provisionné via le Marketplace Vercel) ou une instance locale / Docker
- Un compte **WhatsApp** dédié pour le pairing du worker (risque de ban assumé sur un numéro perso)

## Installation

```bash
git clone <url-du-repo> relvo
cd relvo
pnpm install

# Copier et remplir les variables d'environnement (voir tableaux ci-dessous)
cp apps/web/.env.example    apps/web/.env.local
cp apps/worker/.env.example apps/worker/.env

# Générer le client Prisma + appliquer le schéma
pnpm --filter db prisma generate
pnpm --filter db prisma migrate dev
```

## Lancement en local

```bash
# Terminal 1 — app web (http://localhost:3000)
pnpm --filter web dev

# Terminal 2 — worker WhatsApp (affiche un QR code à scanner au premier lancement)
pnpm --filter worker dev

# Outil : explorer la base de données
pnpm --filter db prisma studio
```

Au premier démarrage du worker, un **QR code** s'affiche dans le terminal : scanne-le depuis WhatsApp (Appareils connectés) pour appairer le compte. L'état d'authentification est ensuite persisté, les redémarrages suivants se reconnectent automatiquement.

## Variables d'environnement

### `apps/web/.env.local`

| Variable | Description |
|---|---|
| `DATABASE_URL` | Chaîne de connexion PostgreSQL (Neon ou locale) |
| `AUTH_SECRET` | Secret Auth.js (`openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | OAuth Google (Auth.js) |
| `AI_GATEWAY_API_KEY` | Clé Vercel AI Gateway (routage des modèles Claude) |
| `ANTHROPIC_API_KEY` | Pour la Files API d'Anthropic (PDFs des Connaissances) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (stockage fichiers) |
| `POSTMARK_SERVER_TOKEN` | Envoi e-mail sortant |
| `POSTMARK_INBOUND_SECRET` | Vérification du webhook e-mail entrant |
| `RESEND_API_KEY` | E-mails transactionnels (vérification de compte) |
| `WORKER_SEND_URL` | URL de l'endpoint `send` du worker (envoi WhatsApp) |
| `WORKER_API_SECRET` | Secret partagé pour authentifier les appels web → worker |

### `apps/worker/.env`

| Variable | Description |
|---|---|
| `DATABASE_URL` | Même base que `web` (le worker écrit les messages entrants) |
| `WORKER_API_SECRET` | Même secret que côté `web` |
| `PORT` | Port d'écoute de l'endpoint `send` |
| `WA_AUTH_STATE_PATH` | Chemin de persistance de l'état d'auth Baileys |

> Sur Vercel, gérer les variables de `web` via `vercel env` ou le dashboard. Sur Railway/Render, configurer celles du `worker` dans leur interface respective.

## Déploiement

- **`apps/web`** → **Vercel**. Importer le repo, définir *Root Directory = `apps/web`*, renseigner les variables d'environnement. `git push` sur la branche de production déclenche le déploiement.
- **`apps/worker`** → **Railway** (ou Render). Pointer le service sur `apps/worker`, configurer les variables, activer le redémarrage automatique. Le worker doit rester *always-on*.
- Les deux pointent vers la **même base PostgreSQL**.

## Stack

Next.js (App Router) · TypeScript · Tailwind + Shadcn UI · Prisma + PostgreSQL · Auth.js · Vercel AI SDK + AI Gateway (Claude) · Vercel Blob · Baileys (WhatsApp) · Postmark / Resend (e-mail) · dnd-kit · dexie (IndexedDB).

## Scripts utiles

```bash
pnpm --filter web build              # build de l'app web
pnpm --filter db prisma migrate dev  # nouvelle migration
pnpm --filter db prisma studio       # interface base de données
pnpm lint                            # lint du monorepo
```
