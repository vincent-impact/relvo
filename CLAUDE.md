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
| `/` | Accueil (🏠) — brief : KPIs « Vue du jour » + agenda semaine + 2-3 sujets prioritaires | Onglet |
| `/fil` | Mon fil (✉️) — traitement : 3 onglets-statut Ouverts (urgents en tête, swipe ← Ignorer · → Terminer) / Terminés / Ignorés (récupérables) | Onglet |
| `/contacts` · `/contacts/[id]` | **Contacts** (👥) — annuaire + fiche contact | Onglet |
| `/dossiers` · `/dossiers/[id]` | **Mémoire** (🧠) — liste des domaines + fiche : onglets Instructions/Documents/Sujets | Onglet |
| `/parametres` | Paramètres (compte, canaux) | Onglet |
| `/sujets/[id]` | Détail d'un sujet | Fiche détail |
| `/planning` | Calendrier vue mois | Hors-nav (lien depuis le widget semaine de l'Accueil) |
| `/messages` | Messages bruts par contact (filtres non-lus / sans sujet) | Hors-nav (lien depuis le feed-strip de Mon fil) |

**Navigation = barre d'onglets en bas** (mobile-first), **5 entrées** : Accueil 🏠, Mon fil ✉️, **Contacts 👥**, **Mémoire 🧠**, Paramètres. Contacts est une **destination de premier rang** (3ᵉ onglet, entre Mon fil et Mémoire) — pas un sous-menu de Réglages — en vue de l'usage **Équipe** à venir (gestion collaborative des sujets). Note IA : un contact rattaché à un **pôle/dossier** influencera la qualification des messages reçus (les sujets d'un contact « RH » tomberont probablement dans le dossier RH). La conversation Relvo est une **surface plein écran** (plus un drawer latéral), atteinte via le **composer Relvo persistant** présent sur toutes les pages. Le virage mobile-first et la PWA sont détaillés dans `docs/spec/ux-mobile-first.md` ; cf. `01-principes.md §13`.

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
7. **Statut = cycle de vie à 5 valeurs** (`new`, `acknowledged`, `resolved`, `archived`, `ignored`), exclusif. Seuls **Nouveau** et **Terminé** sont visibles ; `acknowledged` (« Lu ») est l'état actif **invisible**, `archived` est **système** (auto après inactivité), **`ignored`** = sujet **écarté** (hors des ouverts, **hors mémoire de Relvo**, purgeable après 15 j d'inactivité, récupérable via l'onglet Ignorés). L'« ignorance » est **collante** : un nouveau message ne ressort jamais un sujet ignoré (sinon frustration « groupe WhatsApp bavard »). Les états cumulables sont des **marqueurs** distincts — Urgent (drapeau), À faire (dérivé tâches ouvertes), En attente (`waiting_for_reply`), pastille de non-lus. Ex-statuts `to_do`/`waiting`/`unread` supprimés.
8. **Priorité (urgence) à 2 valeurs** (`urgent`, `normal`) ; **drapeau urgent** (rouge) si `priority = urgent`. La **rareté est le signal** (1-2 sujets sur 24). « Ignoré » n'est **pas** une priorité mais un **statut** (cf. n°7). Deux actions en **swipe** : **Ignorer** (swipe gauche, rouge — `status = ignored`) et **Terminer** (swipe droite, vert — `status = resolved`). « **Terminer** » remplace « Résoudre » ; **pas de bouton « Archiver »** (état système). `getOpenFeed` = tous les ouverts, **urgents en tête**.
9. **Brouillon Relvo dans le composer** (jamais affiché comme un message du fil). Actions « Régénérer » / « Effacer ».
10. **Acquittement implicite** des suggestions : ouvrir un sujet vaut acquittement (logique sur `last_opened_at`). Pas de bouton « valider ».
11. **Conversations par contact**, pas par canal (email + WhatsApp d'un même contact = une seule conversation).
12. Un **contact** n'est créé qu'à la création d'un sujet. Expéditeur inconnu = `sender_raw` + avatar `?`.
13. Sujets **multi-contacts** (`contact_ids: UUID[]`).

**Dates & planning**
14. Task : 4 champs date nullable (`start_date/time`, `end_date/time`). La deadline vit dans `start_*` ; `end_*` = durée.
15. Deux surfaces calendaires : **semaine** (widget Accueil) + **mois** (`/planning`). Code couleur par Dossier. Drag-and-drop.

**Dossiers & connaissances**
16. `Folder` (modèle) = **« Mémoire »** (nav, icône cerveau) ; chaque Folder = **« un domaine de la mémoire de Relvo »**, fiche en **3 onglets : Instructions / Documents / Sujets**. Regroupe Sujets (`Subject.folder_id`) **et** Connaissances (`KnowledgeDocument.folder_id`).
17. Folder « **Général** » auto-créé (`is_default`), documentaire transversal, jamais de sujets.
18. `KnowledgeDocument` : `kind = file` (UI **« Documents »**, PDF/image non modifiable) ou `kind = note` (UI **« Instructions »**, Markdown éditable). Un `file` porte un état d'absorption `read` (✦ lu, injecté dans les prompts) / `ignored` (écarté du retrieval), décidé par Relvo. Pas de page « Connaissances » séparée.
19. Ajout de document = drag-and-drop d'un PDF dans l'onglet Documents (Files API Anthropic via `anthropic_file_id`).
20. V1 : seul l'utilisateur édite les Instructions ; Relvo les consulte sans les modifier.

**Chatbot Relvo**
21. Deux modes : **Accueil** = brief structuré (pas un chat) ; **conversation** = surface **plein écran** accessible partout.
22. **Conversation plein écran** (mobile-first), ouverte depuis le **composer Relvo persistant** (✦ = historique des conversations, champ = nouvelle conversation, 📷 photo, 🎙 vocal) présent sur toutes les pages. Plus de drawer latéral 40 %.
23. Conversations chat **éphémères en IndexedDB** (aucune entité serveur en V1). Ce qui persiste = actions + résultats.
24. Sessions implicites (seuil 5 min). Bouton « + Nouvelle conversation ». Liste des N dernières.
25. **Action-capable day-one** : chaque opération UI a un tool API correspondant (même fonction métier). Actions rendues en blocs visuels annulables. Le brouillon atterrit dans le composer, jamais envoyé directement.
26. **Page-aware** : URL + contexte transmis à chaque tour. Chip de contexte en haut de la conversation.
27. Stack chatbot : AI SDK + AI Gateway, tool calls natifs (pas de MCP en V1), prompt caching, Files API, citations.
28. **Empty state** : 3-4 prompts d'exemple contextuels à la page, en gris italique (pas de fausses bulles).
29. **Pas de RAG vectorielle** : long context + prompt caching pour les Connaissances, tool calls pour les données dynamiques.

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
