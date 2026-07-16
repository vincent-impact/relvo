# Relvo

Assistant IA de pilotage des sollicitations professionnelles. Relvo transforme le flux désordonné de messages d'un dirigeant (e-mails, WhatsApp) en **sujets métier structurés**, avec tâches, journal de bord et aide à la décision.

> 📖 Documentation : vision et modèle produit dans [`docs/conception/`](./docs/conception) · architecture technique dans [`docs/spec/architecture.md`](./docs/spec/architecture.md) · roadmap dans [`docs/backlog/backlog-v1.md`](./docs/backlog/backlog-v1.md). Conventions et invariants pour le développement : [`CLAUDE.md`](./CLAUDE.md).

## Architecture

Monorepo (pnpm workspaces) avec deux déployables partageant un schéma Prisma :

| Workspace | Rôle | Hébergement |
|---|---|---|
| **`apps/web`** | App Next.js fullstack (UI + API + auth + chatbot + CRUD) | Vercel |
| **`apps/worker`** | Daemon Baileys (connexion WhatsApp permanente) + pipeline IA | Railway / Render |
| **`packages/db`** | Schéma Prisma + client généré + couche domaine, partagés web ↔ worker | — |
| **`packages/storage`** | Stockage fichiers (Cloudflare R2, API S3), partagé web ↔ worker | — |

**Pourquoi un worker séparé ?** Baileys maintient un WebSocket permanent vers WhatsApp pour recevoir les messages. Les fonctions serverless Vercel sont *request-scoped* et ne peuvent pas héberger un process always-on — d'où un worker sur une plateforme à process longs. L'e-mail, lui, arrive par webhook Postmark (simple Route Handler dans `apps/web`) et ne nécessite aucun worker. Détail : [`docs/spec/architecture.md`](./docs/spec/architecture.md).

```
relvo/
├── apps/
│   ├── web/        → Vercel (Root Directory = apps/web)
│   └── worker/     → Railway/Render
├── packages/
│   ├── db/         schéma Prisma + domaine, partagés
│   └── storage/    stockage fichiers R2, partagé
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
| `AUTH_SECRET` | Secret Auth.js (`openssl rand -base64 33`) — obligatoire |
| `AUTH_URL` | URL de base de l'app (liens des e-mails) — ex. `http://localhost:3000` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | OAuth Google (Auth.js) — optionnel ; sans ces clés, login e-mail seul |
| `EMAIL_FROM` | Expéditeur des e-mails Resend (ex. `Relvo <onboarding@resend.dev>`) |
| `AI_GATEWAY_API_KEY` | Clé Vercel AI Gateway (routage des modèles Claude) |
| `ANTHROPIC_API_KEY` | Files API d'Anthropic (copie d'inférence des PDFs — **pas** le stockage de vérité, cf. `docs/spec/architecture.md §5`) |
| `R2_ACCOUNT_ID` | Cloudflare R2 — ID de compte (visible dans l'URL du dashboard) |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Token de compte R2, permission « Object Read & Write » scopée au bucket |
| `R2_BUCKET` | Nom du bucket (ex. `relvo-files-prod`) |
| `R2_JURISDICTION` | `eu` (défaut) — résidence RGPD, **figée à la création du bucket** ; conditionne l'endpoint S3 |
| `CRON_SECRET` | Secret du cron Vercel qui draine l'outbox de suppression de fichiers (`openssl rand -base64 32`) |
| `RESEND_API_KEY` | E-mails transactionnels (vérification de compte) |
| `UNIPILE_DSN` | DSN régional (UE) de l'instance Unipile — ingestion email + WhatsApp (M5) |
| `UNIPILE_API_KEY` | Clé d'API Unipile (header `X-API-KEY`) |
| `UNIPILE_WEBHOOK_SECRET` | Secret du header `Unipile-Auth` vérifié sur `/api/webhooks/unipile` (`openssl rand -base64 32`) |

> **Bascule Unipile (2026-07-16)** — l'ingestion email **et** WhatsApp passe par l'agrégateur managé **Unipile** (envoi « au nom de » l'utilisateur, webhooks temps réel, UE/SOC2/DPA). Cela **remplace** le montage Postmark (forwarding + SMTP) **et supprime le worker always-on Baileys** : WhatsApp devient piloté par webhooks, donc serverless sur Vercel comme l'email. Il n'y a **plus de `apps/worker`**. Cf. `docs/spec/architecture.md`.

> Sur Vercel, gérer les variables via `vercel env` ou le dashboard.

### Vérifier le stockage R2

Une fois les variables `R2_*` renseignées, un aller-retour réel contre le bucket (upload pré-signé → lecture → contrôle d'accès → suppression) :

```bash
cp packages/storage/.env.example packages/storage/.env   # puis renseigner
pnpm --filter @relvo/storage smoke
```

## Déploiement

- **`apps/web`** → **Vercel**. Importer le repo, définir *Root Directory = `apps/web`*, renseigner les variables d'environnement. `git push` sur la branche de production déclenche le déploiement. **Un seul déployable** depuis la bascule Unipile — email et WhatsApp sont pilotés par webhooks (serverless), il n'y a plus de worker always-on à héberger.
- Base : **PostgreSQL** (Neon en prod).

## Stack

Next.js (App Router) · TypeScript · Tailwind + Shadcn UI · Prisma + PostgreSQL · Auth.js · Vercel AI SDK + AI Gateway (Claude) · Cloudflare R2 (stockage fichiers) · **Unipile** (email + WhatsApp) · Resend (e-mails transactionnels) · dnd-kit · dexie (IndexedDB).

## Scripts utiles

```bash
pnpm --filter web build              # build de l'app web
pnpm --filter db prisma migrate dev  # nouvelle migration
pnpm --filter db prisma studio       # interface base de données
pnpm lint                            # lint du monorepo
```
