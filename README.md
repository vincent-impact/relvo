# Relvo

Assistant IA de pilotage des sollicitations professionnelles. Relvo transforme le flux
désordonné de messages d'un dirigeant (e-mails, WhatsApp) en **sujets métier structurés**, avec
tâches, journal de bord et aide à la décision.

> 📖 **Ce fichier est le mode d'emploi humain** : installer, lancer, déployer. Pour comprendre le
> produit et l'architecture, lire [`CLAUDE.md`](./CLAUDE.md) — c'est la carte du dépôt.

## Prérequis

- **Node.js** 22 (voir [`.nvmrc`](./.nvmrc))
- **pnpm** 9+ — `corepack enable` suffit
- **Docker** — pour la base Postgres locale
- Un compte **Unipile** (ingestion e-mail et WhatsApp), un bucket **Cloudflare R2**, une clé
  **Resend** : facultatifs en dev, les flux concernés dégradent proprement sans eux.
- Une clé **OpenAI** du projet de l'organisation : sans elle, le pipeline laisse les
  conversations orphelines, il n'échoue pas.

## Installation

```bash
git clone <url-du-repo> relvo
cd relvo
pnpm install

# Variables d'environnement (voir le tableau plus bas)
cp apps/web/.env.example        apps/web/.env.local
cp packages/db/.env.example     packages/db/.env
cp packages/storage/.env.example packages/storage/.env

# Base Postgres locale + schéma + jeu de démonstration
pnpm db:start
pnpm db:migrate
pnpm db:seed
```

Le seed installe le compte de démonstration **Tasty Crousty** — données fictives mais cohérentes
d'un écran à l'autre. Elles ne mesurent rien : ne jamais dimensionner sur elles.

## Lancement en local

```bash
pnpm dev            # http://localhost:3000
pnpm db:studio      # explorer la base
pnpm test           # tests d'intégration (base relvo_test, créée au besoin)
```

## Variables d'environnement

### `apps/web/.env.local`

| Variable | Description |
|---|---|
| `DATABASE_URL` | Chaîne de connexion PostgreSQL (Neon en prod, conteneur local en dev) |
| `AUTH_SECRET` | Secret Auth.js — **obligatoire**. `openssl rand -base64 33` |
| `AUTH_URL` | URL de base de l'application, utilisée par les liens d'e-mail, les retours de l'agrégateur et la lecture par tranches. En prod `https://app.relvo.net` — une URL `.vercel.app` casse les liens de réinitialisation (#25) |
| `RELVO_SITE_HOST` · `RELVO_APP_HOST` | Les hôtes du site (`relvo.net`) et de l'application (`app.relvo.net`), lus par le routage par hôte (`next.config.ts`, `lib/hotes.ts`). Vides = les valeurs de production |
| `GMAIL_CLIENT_ID` · `GMAIL_CLIENT_SECRET` | Le client OAuth du relais Gmail (M24) — le même client Google que la connexion, sous un autre nom : `AUTH_GOOGLE_*` allumerait la connexion Google à l'application. Retour déclaré chez Google : `{AUTH_URL}/api/gmail/retour` |
| `GMAIL_PUBSUB_TOPIC` · `GMAIL_PUSH_SERVICE_ACCOUNT` | La réception par notification (M24.3) : le sujet Pub/Sub sur lequel Gmail publie les changements d'une boîte, et le compte de service dont l'abonnement push signe ses notifications — `/api/webhooks/gmail` vérifie ce jeton OIDC contre les clés de Google. Sans sujet, une boîte Gmail se connecte mais ne reçoit rien |
| `RELVO_CHIFFREMENT_CLE` | La clé qui chiffre en base les jetons OAuth des boîtes Gmail (AES-256-GCM, 32 octets en base64). **La perdre, c'est reconnecter toutes les boîtes.** `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` · `AUTH_GOOGLE_SECRET` | OAuth Google — optionnel. Sans les **deux**, seul le login e-mail / mot de passe est proposé |
| `RESEND_API_KEY` | E-mails de vérification et de réinitialisation. Sans clé, le lien est logué en console (dev) |
| `EMAIL_FROM` | Expéditeur des e-mails transactionnels |
| `OPENAI_API_KEY` | Clé du projet OpenAI de l'organisation, une par environnement. Sans clé, aucun appel : conversations orphelines |
| `OPENAI_BASE_URL` | Vide = point d'entrée standard. À passer sur `eu.api.openai.com` le jour où la résidence européenne est accordée au projet |
| `RELVO_IA_MODELE_*` | Affectation modèle ↔ tier (classification, extraction, rédaction, raisonnement). Vides = défauts du code. Tout modèle affecté doit figurer dans la table de tarifs |
| `RELVO_IA_CACHE_RETENTION` | Rétention du cache de prompt : `24h` (défaut) ou `in_memory`. Le journal de l'inférence se lit avec `pnpm --filter web ia:journal` |
| `UNIPILE_DSN` · `UNIPILE_API_KEY` | Instance et clé Unipile (ingestion e-mail + WhatsApp) |
| `UNIPILE_WEBHOOK_SECRET` | Secret du header `Unipile-Auth`, vérifié sur `/api/webhooks/unipile`. `openssl rand -base64 32` |
| `R2_ACCOUNT_ID` | Cloudflare R2 — identifiant de compte |
| `R2_ACCESS_KEY_ID` · `R2_SECRET_ACCESS_KEY` | Token de **compte** R2, permission « Object Read & Write » **scopée au bucket** |
| `R2_BUCKET` | Nom du bucket |
| `R2_JURISDICTION` | `eu` — résidence RGPD. **Figée à la création du bucket** : elle conditionne l'endpoint et ne se change plus |
| `CRON_SECRET` | Secret des crons et des tranches de fond : drainage de l'outbox de suppression de fichiers, le filet nocturne du rattrapage (`/api/cron/catch-up`) et chaque tranche du rattrapage du courrier récent (`POST /api/rattrapage/tranche`, lancée par le webhook de connexion puis par la tranche précédente) — appelables à la main avec `Authorization: Bearer <CRON_SECRET>`. `openssl rand -base64 32` |

### `packages/db/.env` et `packages/storage/.env`

`DATABASE_URL` pour Prisma (CLI), les variables `R2_*` pour le test de bout en bout du stockage.
La base de test est **dérivée** de `DATABASE_URL` en changeant le nom (`relvo_test`) — la
renseigner explicitement via `TEST_DATABASE_URL` n'est utile que pour pointer ailleurs.

> ⚠️ `TEST_DATABASE_URL` ne doit **jamais** valoir `DATABASE_URL` : les tests tronquent les
> tables de la base sur laquelle ils tournent.

### Sur Vercel

Les variables se gèrent via `vercel env`. Un poste neuf se met à jour en une commande :

```bash
vercel env pull apps/web/.env.local
```

Renseigner les **trois** environnements (Production, Preview, Development) : une variable oubliée
en Preview ne se voit qu'au moment où une preview casse.

## Vérifier le stockage R2

Un aller-retour réel contre le bucket — upload pré-signé, lecture, contrôle d'accès, suppression :

```bash
pnpm --filter @relvo/storage smoke
```

## Déploiement

- **`apps/web` → Vercel**, *Root Directory = `apps/web`*. **Déployable unique** : e-mail et
  WhatsApp arrivent par webhooks serverless, il n'y a aucun process permanent à héberger.
- **Deux hôtes, un déployable** (M24.10) : `relvo.net` sert le **site** — la présentation et les
  pages légales, que Google lit pour vérifier l'application — et `app.relvo.net` sert
  **l'application** et ses webhooks ; `www.relvo.net` et l'ancienne adresse `relvo-app.vercel.app`
  redirigent (`next.config.ts`, `src/lib/hotes.ts`). Le domaine est au nom de l'organisation
  (registrar Ionos, DNS posé à la main, domaines ajoutés au projet Vercel).
- La commande de build applique les migrations (`vercel-build`), previews comprises.
  ⚠️ **Vérifier que les previews sont isolées de la production** avant de pousser une branche :
  sans branche de base par branche git, une branche de travail migre la **production**.
- **Webhooks Unipile** : déclarer `https://app.relvo.net/api/webhooks/unipile` côté Unipile, avec le
  header `Unipile-Auth: <UNIPILE_WEBHOOK_SECRET>` — e-mails reçus **et envoyés** (`mail_sent` :
  un envoi depuis un client e-mail compte), messagerie, état des comptes
  (`apps/web/scripts/unipile-webhook.mjs`).
- Base **PostgreSQL** (Neon).

## Scripts

```bash
pnpm dev             # app web
pnpm build           # build
pnpm typecheck       # types
pnpm lint            # eslint
pnpm test            # tests d'intégration
pnpm format          # prettier
pnpm db:start        # Postgres local (docker compose)
pnpm db:migrate      # nouvelle migration
pnpm db:generate     # régénérer le client Prisma — après TOUTE migration
pnpm db:seed         # jeu de démonstration
pnpm db:studio       # explorer la base
pnpm --filter web admin:role <e-mail> admin|ceo   # rôle admin (backoffice /admin), par le domaine
pnpm --filter web boites:migrer <e-mail> [adresse]   # propose la migration d'une boîte de l'agrégateur au relais Gmail (M24.9)
pnpm --filter web eval:dictee --dossier <hors dépôt> [--compte <e-mail>]   # benchmark de la transcription (M22.1)
```

## Stack

Next.js (App Router) · TypeScript · Tailwind + shadcn/ui sur Base UI · Prisma + PostgreSQL ·
Auth.js · Vercel AI SDK + API OpenAI en direct · Cloudflare R2 · Unipile (e-mail + WhatsApp) ·
Resend · dnd-kit · dexie.
