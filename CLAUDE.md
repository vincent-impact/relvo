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

Monorepo léger (pnpm workspaces), **deux déployables** partageant un schéma Prisma :

- **`apps/web`** — Next.js App Router **fullstack** → **Vercel**. UI + API (Route Handlers + Server Actions) + auth + chatbot + CRUD.
- **`apps/worker`** — daemon **Baileys** (WhatsApp) → **Railway/Render**. Process *always-on* tenant le socket WhatsApp 24/7 + pipeline IA asynchrone.
- **`packages/db`** — schéma **Prisma** + enums partagés (`Actor`, `Status`, `Priority`, `Kind`, `TriageHint`).

Points à ne pas oublier :
- **Pas de backend NestJS séparé.** Route Handlers + Server Actions + Prisma couvrent tout. Le plan initial (Turborepo + NestJS + JWT) est **abandonné** — si une doc le mentionne encore, c'est caduc, se référer à la spec.
- **Le worker est obligatoire pour WhatsApp** : Baileys exige un WebSocket permanent, impossible en serverless Vercel.
- **Email** = simple webhook Postmark (Route Handler dans `apps/web`), pas de worker.
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
│   └── db/prisma/schema.prisma   # schéma partagé web ↔ worker
└── apps/
    ├── web/                   # → Vercel (Root Directory = apps/web)
    │   ├── src/app/           # routes App Router (voir mapping ci-dessous)
    │   │   ├── api/chat/                  # AI SDK + Gateway
    │   │   └── api/webhooks/postmark/     # email entrant
    │   ├── src/components/    # layout/ (Sidebar, ChatDrawer), feed/, ui/ (shadcn)
    │   ├── src/lib/           # db.ts (client Prisma), auth.ts, helpers
    │   └── src/server/        # Server Actions + logique métier
    └── worker/                # → Railway/Render
        └── src/               # daemon Baileys + file BullMQ + pipeline IA
```

**Règles de navigation pour Claude** :
- Avant de créer/modifier un écran, **lire les docs `docs/conception/` concernées** — elles priment sur toute supposition.
- Pour reproduire fidèlement un écran, s'appuyer sur le HTML/CSS correspondant dans `mockup/`.
- Le schéma Prisma (`packages/db`) doit rester **cohérent avec `02-modele-donnees.md`**.
- Toute logique partagée web/worker (types, accès DB) passe par `packages/db` — jamais de duplication.
- `docs/` et `mockup/` ne sont buildés par personne (Next ne build que `apps/web/src/app`).

### Mapping routes ↔ écrans

Routes francophones, alignées sur la nav V1.

| Route | Écran | Nav |
|---|---|---|
| `/` | Accueil (🏠) — brief matinal : KPIs + calendrier semaine + 3 sujets prioritaires | Sidebar |
| `/fil` | Mon fil (✉️) — workspace de traitement : feed + filtres + actions | Sidebar |
| `/dossiers` · `/dossiers/[id]` | Dossiers (liste + fiche : sujets + connaissances) | Sidebar |
| `/parametres` | Paramètres (compte, canaux, contacts) | Sidebar |
| `/sujets/[id]` | Détail d'un sujet | Fiche détail |
| `/planning` | Calendrier vue mois | Hors-nav (lien depuis le widget semaine de l'Accueil) |
| `/messages` | Messages bruts par contact (filtres non-lus / sans sujet) | Hors-nav (lien depuis le feed-strip de Mon fil) |
| `/contacts` · `/contacts/[id]` | Annuaire + fiche contact | Hors-nav (recherche topbar, clic sur un nom) |

Sidebar = **4 entrées** (Accueil, Mon fil, Mes dossiers, Paramètres). Le **drawer chatbot 🤖** est un bouton flottant présent sur **toutes les pages**, rendu dans `app/layout.tsx`. Icône **maison** pour l'Accueil ; le **robot** est réservé au drawer (rôles visuels distincts).

## Invariants produit à respecter

> Liste condensée. Le détail et la justification sont dans `docs/conception/`. Ne pas les enfreindre sans validation explicite.

**Modèle & acteurs**
1. `Account` est le tenant. Toutes les ressources portent `account_id`. Pas de FK utilisateur sur les ressources.
2. Type partagé `Actor = enum(user, ai, contact, system)`. UI : **Moi / Relvo / Externe** avec badges `M` (bleu) / `R` (violet) / `E` (ambre).
3. « **Relvo** » dans l'UI, « IA » dans la doc technique. L'enum reste `ai`.

**Sujets, tâches, messages, contacts**
4. Le **Subject** est l'entité centrale, pas le message. Chaîne : Message → Task → Action → LogEvent.
5. Pas de statut `to_qualify` : un message incompris ne crée ni sujet ni contact → reste « Sans sujet » avec un `triage_hint`.
6. Une **tâche** est rattachée au sujet, pas à un utilisateur (affectation = V2). Source visible via actor-pill (`✦ Relvo` / `Moi`).
7. **Statuts UI fidèles au modèle** (6 valeurs : `new`, `to_do`, `waiting`, `unread`, `resolved`, `archived`), un badge coloré par valeur. Pas de simplification binaire.
8. **Priorité UI binaire** : un seul drapeau **urgent** (rouge) levé uniquement si `priority = critical`. La **rareté est le signal** (1-2 sujets sur 24). Feed Accueil = `priority IN (critical, high)`. Paire ✕/✓ systématique sur chaque carte (✕ rétrograde la priorité, ✓ résout).
9. **Brouillon Relvo dans le composer** (jamais affiché comme un message du fil). Actions « Régénérer » / « Effacer ».
10. **Acquittement implicite** des suggestions : ouvrir un sujet vaut acquittement (logique sur `last_opened_at`). Pas de bouton « valider ».
11. **Conversations par contact**, pas par canal (email + WhatsApp d'un même contact = une seule conversation).
12. Un **contact** n'est créé qu'à la création d'un sujet. Expéditeur inconnu = `sender_raw` + avatar `?`.
13. Sujets **multi-contacts** (`contact_ids: UUID[]`).

**Dates & planning**
14. Task : 4 champs date nullable (`start_date/time`, `end_date/time`). La deadline vit dans `start_*` ; `end_*` = durée.
15. Deux surfaces calendaires : **semaine** (widget Accueil) + **mois** (`/planning`). Code couleur par Dossier. Drag-and-drop.

**Dossiers & connaissances**
16. `Folder` (modèle) = « Dossier » (UI). Regroupe Sujets (`Subject.folder_id`) **et** Connaissances (`KnowledgeDocument.folder_id`).
17. Folder « **Général** » auto-créé (`is_default`), documentaire transversal, jamais de sujets.
18. `KnowledgeDocument` : `kind = file` (PDF/image, non modifiable) ou `kind = note` (Markdown éditable). Pas de page « Connaissances » séparée.
19. Ajout de fichier = drag-and-drop d'un PDF dans la fiche Dossier (Files API Anthropic via `anthropic_file_id`).
20. V1 : seul l'utilisateur édite les notes ; Relvo les consulte sans les modifier.

**Chatbot Relvo**
21. Deux modes : **Accueil** = brief structuré (pas un chat) ; **conversation** = drawer accessible partout.
22. Drawer ~40 % de largeur, bouton flottant 🤖 sur toutes les pages. Pas de page dédiée.
23. Conversations chat **éphémères en IndexedDB** (aucune entité serveur en V1). Ce qui persiste = actions + résultats.
24. Sessions implicites (seuil 5 min). Bouton « + Nouvelle conversation ». Liste des N dernières.
25. **Action-capable day-one** : chaque opération UI a un tool API correspondant (même fonction métier). Actions rendues en blocs visuels annulables. Le brouillon atterrit dans le composer, jamais envoyé directement.
26. **Page-aware** : URL + contexte transmis à chaque tour. Chip de contexte en haut du drawer.
27. Stack chatbot : AI SDK + AI Gateway, tool calls natifs (pas de MCP en V1), prompt caching, Files API, citations.
28. **Empty state** : 3-4 prompts d'exemple contextuels à la page, en gris italique (pas de fausses bulles).
29. **Pas de RAG vectorielle** : long context + prompt caching pour les Connaissances, tool calls pour les données dynamiques.

## Conventions

- **TypeScript partout.** Les enums (`Actor`, `Status`, `Priority`, `Kind`, `TriageHint`) découlent du schéma Prisma (`packages/db`).
- **Tailwind + Shadcn.** Réutiliser/étendre les composants shadcn plutôt que réécrire des primitives. Conserver la palette navy (#0A1128) / blue (#2B6FE0) / red (#E63150) + neutres.
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
pnpm --filter worker dev              # dev du daemon WhatsApp
pnpm --filter db prisma migrate dev   # migrations DB
pnpm --filter db prisma studio        # explorer la base

# Déploiement : git push → Vercel déploie apps/web automatiquement
#               apps/worker déployé sur Railway/Render
```

## Scope V1 (rappel)

**Inclus (MUST)** : modèle `Account`/`Actor`, Dossiers (Sujets + Connaissances), modèle de date riche, calendrier semaine + planning mois + drag-and-drop, statuts fidèles + drapeau urgent rare, chatbot drawer action-capable page-aware, WhatsApp (Baileys) **et** email dès V1, citations API (UI minimale), pièces jointes **niveau 1** (étiquetage Haiku).

**Reporté V2** : page Activité standalone, pièces jointes niveau 2/3, édition de notes par Relvo, chatbot cross-device, UI riche citations, scope `subject` pour KnowledgeDocument, affectation tâche → utilisateur, WebSocket temps réel.

**Réflexe d'arbitrage** : simplifie l'usage food/bâtiment ? → V1. Renforce le chatbot comme surface d'action ? → V1. Peut attendre 2 mois ? → V2. Ressemble à du power-user/analytics ? → V2.
