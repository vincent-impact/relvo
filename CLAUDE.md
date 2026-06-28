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
| `/` | **Actions** (✅) — page des TÂCHES : barre KPI Tâches (RDV · Aujourd'hui · En retard · À trier) + 2 onglets **Agenda** (semainier slidable + drag&drop) / **À trier** | Onglet |
| `/fil` | **Sujets** (📥, ex-« Mon fil ») — barre KPI Sujets (Urgents · Nouveaux · Ouverts · Sans sujet↗) + barre de filtres (Statut/Domaine/Urgent/Nouveau) | Onglet |
| `/dossiers` · `/dossiers/[id]` | **Mémoire** (🧠) — liste des domaines + fiche : onglets Instructions/Documents/Sujets | Onglet |
| `/parametres` | **Réglages** (⚙️) — onglets Profil / Canaux / **Contacts** (annuaire) / Préférences | Onglet |
| `/contacts` · `/contacts/[id]` | Annuaire + fiche contact | Hors-nav (atteint via l'onglet Contacts des Réglages) |
| `/sujets/[id]` | Détail d'un sujet | Fiche détail |
| `/planning` | Calendrier vue mois | Hors-nav (lien depuis le widget semaine de l'Accueil) |
| `/messages` | Messages bruts par contact (filtres non-lus / sans sujet) | Hors-nav (lien depuis le KPI « Sans sujet » des Sujets) |

**Navigation = barre d'onglets en bas** (mobile-first), **4 entrées** : **Actions** ✅, **Sujets** 📥, **Mémoire** 🧠, **Réglages** ⚙️ (décision 2026-06-28). « Accueil » est devenu **Actions** (page des tâches, cf. invariant n°30) et « Mon fil » est devenu **Sujets**. **Contacts a quitté le dock** : c'est désormais un **onglet des Réglages** (entre Canaux et Préférences) — l'usage Équipe à venir le re-promouvra peut-être. Note IA : un contact rattaché à un **pôle/dossier** influencera la qualification des messages reçus (les sujets d'un contact « RH » tomberont probablement dans le dossier RH). La conversation Relvo est une **surface plein écran** (plus un drawer latéral), atteinte via un **bouton Relvo en haut à droite du header violet** — présent sur toutes les pages, même forme que l'ancien bouton ✦ du composer (décision 2026-06-27, abandon du composer persistant du bas : trop encombrant, hidden-menu, confusion avec le composer destinataire d'un sujet). Les éventuels boutons de page (ex. « + » Nouveau sujet) se posent **à gauche** du bouton Relvo. La **barre d'onglets basse est fixe, sur fond violet** (comme l'ancien composer). Le virage mobile-first et la PWA sont détaillés dans `docs/spec/ux-mobile-first.md` ; cf. `01-principes.md §13`.

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
7. **Statut = cycle de vie à 4 valeurs** (`acknowledged`, `resolved`, `archived`, `ignored`), exclusif. `acknowledged` est l'état **actif/ouvert par défaut** (à la création) ; seul **Terminé** (`resolved`) est visible ; `archived` est **système** (auto après inactivité), **`ignored`** = sujet **écarté** (hors des ouverts, **hors mémoire de Relvo**, purgeable après 15 j d'inactivité, récupérable via l'onglet Ignorés). L'« ignorance » est **collante** : un nouveau message ne ressort jamais un sujet ignoré (sinon frustration « groupe WhatsApp bavard »). **« Nouveau » n'est plus un statut** mais un **marqueur dérivé** : `lastOpenedAt == null` (sujet ouvert jamais consulté) — décision 2026-06-27, au même titre que « Urgent » (priority) ou « À faire » (tâches ouvertes). Ouvrir la fiche pose `lastOpenedAt` → le marqueur disparaît (acquittement implicite, cf. n°10). Les états cumulables sont des **marqueurs** distincts — Urgent (drapeau), Nouveau (dérivé `lastOpenedAt`), À faire (dérivé tâches ouvertes), En attente (`waiting_for_reply`), pastille de non-lus. Ex-statuts `to_do`/`waiting`/`unread`/`new` supprimés.
8. **Priorité (urgence) à 2 valeurs** (`urgent`, `normal`) ; **drapeau urgent** (rouge) si `priority = urgent`. La **rareté est le signal** (1-2 sujets sur 24). « Ignoré » n'est **pas** une priorité mais un **statut** (cf. n°7). Deux actions en **swipe** : **Ignorer** (swipe gauche, rouge — `status = ignored`) et **Terminer** (swipe droite, vert — `status = resolved`). « **Terminer** » remplace « Résoudre » ; **pas de bouton « Archiver »** (état système). `getOpenFeed` = tous les ouverts, **urgents en tête**.
9. **Brouillon Relvo dans le composer** (jamais affiché comme un message du fil). Actions « Régénérer » / « Effacer ».
10. **Acquittement implicite** des suggestions : ouvrir un sujet vaut acquittement (logique sur `last_opened_at`). Pas de bouton « valider ».
11. **Conversations par contact**, pas par canal (email + WhatsApp d'un même contact = une seule conversation). Fiche sujet : l'onglet s'appelle **« Conversations »** (ex-« Messages ») ; le **composer n'apparaît que dans cet onglet**. Son **select d'interlocuteur switche la conversation** affichée (filtrage par `senderContactId`/`recipientContactId` — un message appartient à un interlocuteur qu'il soit entrant ou sortant). Défaut = **dernier interlocuteur actif**. Dès **> 1 interlocuteur**, le select propose **« Tous »** = fil complet **et** cible de **diffusion** à tous (envoi réel = post-V1). Le terme **« Interlocuteur(s) »** remplace « Destinataire(s) » dans l'UI.
12. **Création automatique d'un contact** (pipeline IA) uniquement à la création d'un sujet — l'IA ne crée jamais un contact « dans le vide ». Expéditeur inconnu = `sender_raw` + avatar `?`. **La création manuelle par l'utilisateur reste permise** (bouton + de l'annuaire `/contacts` → `sourceActor: user`, statut `complete` d'emblée).
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
22. **Conversation plein écran** (mobile-first), ouverte depuis le **bouton Relvo en haut à droite du header** (présent sur toutes les pages, sauf dans la conversation elle-même). Page-aware : le bouton transmet la page d'origine (`?from=`) pour le chip de contexte, les prompts et le retour. L'historique des conversations est atteint depuis la conversation (icône horloge). Plus de composer persistant en bas, plus de drawer latéral 40 % (décision 2026-06-27 ; l'ancien composer du bas créait de l'encombrement, un hidden-menu et une confusion avec le composer destinataire de la fiche Sujet).
23. Conversations chat **éphémères en IndexedDB** (aucune entité serveur en V1). Ce qui persiste = actions + résultats.
24. Sessions implicites (seuil 5 min). Bouton « + Nouvelle conversation ». Liste des N dernières.
25. **Action-capable day-one** : chaque opération UI a un tool API correspondant (même fonction métier). Actions rendues en blocs visuels annulables. Le brouillon atterrit dans le composer, jamais envoyé directement.
26. **Page-aware** : URL + contexte transmis à chaque tour. Chip de contexte en haut de la conversation.
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
