# Backlog fonctionnel — Relvo V1

> Ensemble des tâches à réaliser pour livrer la V1 de Relvo. S'appuie sur les documents de conception ([`../conception/`](../conception)) et sur la spécification technique ([`../spec/architecture.md`](../spec/architecture.md)). Les choix de stack ne sont **pas** répétés ici : ils vivent dans la spec.

---

## État d'avancement

> Suivi haut niveau. Légende : ✅ fait · 🟡 partiel · ⏸️ reporté · ⬜ à faire. Dernière mise à jour : 2026-06-09.

| Module | État | Note |
|---|---|---|
| **M1** — Fondations techniques | 🟡 **clos (fonctionnellement atteint)** | Socle + déploiement web (Vercel) + base prod (Neon) faits. M1.5 / M1.7 / worker (M1.8) / M1.9 reportés au moment Railway+Baileys (M6). Détail inline en §4. |
| **M2** — Auth & multi-tenant | ⬜ **prochaine étape** | — |
| M3 → M14 | ⬜ à faire | — |

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
- Ingestion email (Postmark Inbound) et WhatsApp (Baileys)
- Pipeline IA d'arrivée : compréhension, classement, rattachement, création de Subject + Contact, génération de tâches et brouillon, extraction de date
- 4 pages de nav : Accueil (brief), Mon fil (workspace), Mes dossiers, Paramètres
- 3 pages hors-nav : Planning (vue mois), Messages (conversations par contact), Contacts
- Drawer chatbot action-capable accessible partout, avec ~22 tools symétriques à l'UI
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
- **M1.4** ✅ — Scaffold `apps/worker` : squelette Node + endpoint healthcheck (runtime Baileys ajouté en M6)
- **M1.5** ⏸️ _(reporté → M6)_ — Logger structuré pino + Sentry (web + worker)
- **M1.6** ✅ — Configuration ESLint, Prettier, Husky (pre-commit hooks) _(Prettier + plugin Tailwind + Husky + lint-staged faits ; ESLint = web seulement, à étendre worker/db avec M1.7)_
- **M1.7** ⏸️ _(reporté → M6)_ — Pipeline CI GitHub Actions (lint + typecheck + tests sur PR)
- **M1.8** 🟡 — Déploiement Vercel (`apps/web`, Root Directory) ✅ **fait** + base Neon prod + migrations au build (`vercel-build`) ; Railway/Render (`apps/worker`) ⏸️ **reporté → M6**
- **M1.9** ⏸️ _(reporté → M6)_ — Healthcheck (route `apps/web` + endpoint `apps/worker` ✅) + UI debug côté front

---

### M2 — Auth & multi-tenant

**Objectif** : sécuriser l'accès à l'application et garantir l'isolation tenant systématique via `account_id`.

**Dépendances** : M1.

- **M2.1** — Auth.js avec provider Credentials (email/password + bcrypt)
- **M2.2** — Auth.js avec provider Google OAuth
- **M2.3** — Sessions Auth.js (cookie/JWT) + middleware Next de protection des routes authentifiées
- **M2.4** — Helper serveur d'accès au compte courant : injection de `account_id` dans les Server Actions et Route Handlers
- **M2.5** — Pages Login / Signup / Forgot password / Reset password (Shadcn forms)
- **M2.6** — Action de signup : création de l'`Account` + auto-création du Folder « Général » + EventLog
- **M2.7** — Email transactionnel de vérification de compte via Resend (template minimal)
- **M2.8** — Couche d'accès données tenant-aware : tout accès Prisma applique automatiquement le filtre `account_id`
- **M2.9** — Page Paramètres → onglet Profil (modification nom, email, mot de passe)

---

### M3 — Modèle de données & accès CRUD

**Objectif** : implémenter le modèle de données décrit dans [`../conception/02-modele-donnees.md`](../conception/02-modele-donnees.md) et exposer les opérations CRUD (Server Actions + Route Handlers) pour chaque entité.

**Dépendances** : M2 (tous les accès sont tenant-aware).

- **M3.1** — Schéma Prisma de toutes les entités (`packages/db`) : Account, Folder, Contact, Channel, ChannelConfig, Subject, Message, Attachment, Task, Action, EventLog, KnowledgeDocument
- **M3.2** — Migrations initiales + seeds de dev (jeu Tasty Crousty cohérent avec les maquettes)
- **M3.3** — Convention d'accès données : Server Actions + Route Handlers, validation Zod, pagination cursor, structure d'erreurs standardisée
- **M3.4** — Domaine **Folders** : CRUD + invariant Folder « Général » (suppression interdite, pas de Subject possible)
- **M3.5** — Domaine **Contacts** : CRUD + statuts `auto` / `complete` + filtre « À compléter »
- **M3.6** — Domaine **Channels** : CRUD + ChannelConfig (paramètres techniques de connexion, status)
- **M3.7** — Domaine **Subjects** : CRUD + transitions de statut (`new` → `to_do` → `waiting` → `unread` → `resolved` → `archived`) + champs `last_*_at`
- **M3.8** — Domaine **Messages** : CRUD + détachement / réaffectation / ignore (cas M, N, O)
- **M3.9** — Domaine **Tasks** : CRUD + complétion + `completion_mode` (manual, message_match, action_match)
- **M3.10** — Domaine **Attachments** : CRUD + métadonnées IA (`ai_label`, `ai_summary`, `ai_analysis`)
- **M3.11** — Domaine **Actions** : CRUD + brouillons send_message (payload jsonb)
- **M3.12** — Domaine **EventLog** : insertion systématique via Prisma Client extension (chaque mutation génère un EventLog)
- **M3.13** — Requêtes d'agrégation : KPIs (sujets ouverts, messages à trier, tâches du jour, % d'aide Relvo), feed prioritaire (`priority IN (critical, high)`), liste « Sans sujet »
- **M3.14** — Tests unitaires sur les invariants critiques : isolation tenant, Folder Général ne reçoit pas de Subject, Contact non créé sans Subject

---

### M4 — Stockage fichiers

**Objectif** : gérer le stockage et la diffusion sécurisée des fichiers uploadés (pièces jointes, documents de Connaissances).

**Dépendances** : M2.

- **M4.1** — Setup Vercel Blob
- **M4.2** — Route Handler / Server Action d'upload via URL pré-signée
- **M4.3** — Download avec contrôle d'accès tenant
- **M4.4** — Service de validation des uploads (MIME, taille max, vérification basique d'extension)

---

### M5 — Ingestion email

**Objectif** : recevoir les emails entrants des utilisateurs et envoyer les emails sortants depuis Relvo.

**Dépendances** : M3 (Message, Contact, Channel), M4 (attachments).

- **M5.1** — Configuration Postmark Inbound, adresses dédiées par compte (`{slug}-{hash}@inbound.relvo.io`)
- **M5.2** — Route Handler Next `/api/webhooks/postmark/inbound` avec vérification de signature et idempotence via `external_id`
- **M5.3** — Parsing email et normalisation vers l'entité `Message` (subject_line, content text + html, sender_raw, external_thread_id)
- **M5.4** — Extraction et stockage des pièces jointes (upload Blob + création des `Attachment`)
- **M5.5** — Anti-loop : détection et blocage des emails sortants Relvo qui reviennent en boucle
- **M5.6** — Envoi sortant via SMTP Postmark/Resend (template minimal, signature, reply-to vers l'adresse inbound du compte)
- **M5.7** — UI Paramètres → onglet Canaux → ajout/configuration d'une boîte email (instructions de forwarder Gmail)
- **M5.8** — Statut de connexion du Channel (`last_sync_at`, gestion des erreurs)

---

### M6 — Ingestion WhatsApp (Baileys)

**Objectif** : recevoir et envoyer des messages WhatsApp via Baileys, en assumant les contraintes de la lib non-officielle. Toute cette logique vit dans `apps/worker` (process always-on, cf. [`../spec/architecture.md §2`](../spec/architecture.md)).

**Dépendances** : M3 (Message, Contact, Channel), M4 (medias).

- **M6.1** — Runtime Baileys dans `apps/worker` (process séparé always-on, scalable indépendamment du web)
- **M6.2** — Stockage persistant de la session Baileys (auth state en DB ou volume persistant)
- **M6.3** — UI Paramètres → onglet Canaux → pairing par QR code
- **M6.4** — Réception des messages entrants : écriture directe en base (`packages/db`) + déclenchement du pipeline ; endpoint `send` exposé au web pour l'envoi sortant (authentifié par secret partagé)
- **M6.5** — Envoi sortant via Baileys (appelé par `apps/web`)
- **M6.6** — Gestion des médias (image, audio, document) → upload Blob + création des `Attachment`
- **M6.7** — Reconnexion automatique + monitoring de health du worker
- **M6.8** — Documentation des risques (TOS WhatsApp, possibilité de ban du numéro) pour les utilisateurs

---

### M7 — Pipeline IA d'arrivée

**Objectif** : implémenter le cœur du produit — orchestrer le traitement IA d'un message entrant jusqu'à la création/mise à jour du Subject, des Task, des brouillons, et du journal de bord. Exécuté en tâche de fond dans `apps/worker`, déclenché par l'arrivée d'un message (email ou WhatsApp).

**Dépendances** : M3, M5, M6, M11 (KnowledgeDocuments accessibles).

- **M7.1** — Service `MessageProcessor` orchestrateur, avec file d'attente BullMQ (dans `apps/worker`)
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
- **M9.2** — Composants partagés Shadcn : `SubjectCard`, `TaskCard`, `MessageBubble`, `ActorPill` (M/R/E), `StatusBadge` (6 valeurs), `UrgentFlag`, `RelvoSuggestionBadge`
- **M9.3** — Page **Accueil** : bandeau KPIs (sujets ouverts, messages à trier, tâches du jour, % d'aide Relvo) + widget calendrier semaine pleine largeur + 3 cartes sujets prioritaires en 3 colonnes
- **M9.4** — Page **Mon fil** : feed plein écran avec cartes enrichies + filtres (Priorité par défaut / Chronologique / Résolus) + bandeau Relvo violet + paire ✕/✓ systématique sur chaque carte
- **M9.5** — Page **Sujet** : header (référence + statut + drapeau urgent) + résumé Relvo + onglets (Messages / Tâches / Journal / Pièces jointes) + composer multi-canal avec brouillon IA identifié « Suggestion de Relvo — modifiez librement avant d'envoyer »
- **M9.6** — Page **Mes dossiers** : grille des Folders avec compteurs (sujets, fichiers, notes)
- **M9.7** — Page **Dossier** : sections Sujets + Fichiers (upload drag-and-drop) + Notes (éditeur Markdown). Fiche du Folder Général masque la section Sujets.
- **M9.8** — Page **Planning** (hors-nav) : grille vue mois + barres pour tâches multi-jours + navigation mois précédent/suivant/aujourd'hui
- **M9.9** — Page **Messages** (hors-nav) : conversations par contact, tous canaux confondus + filtres « non lus » et « sans sujet » (URL filtrable `?filter=orphan`) + indicateur de canal sur chaque message
- **M9.10** — Page **Contacts** (hors-nav) : liste + filtre « À compléter »
- **M9.11** — Page **Contact** : fiche + édition (passage `auto` → `complete`)
- **M9.12** — Page **Paramètres** : 3 onglets (Profil / Canaux / Contacts)
- **M9.13** — Recherche globale topbar (sujets + contacts + messages)
- **M9.14** — Bouton ✕ Ignorer (rétrograde la priorité d'un cran selon `../conception/02-modele-donnees.md §Feed prioritaire`)
- **M9.15** — Bouton ✓ Marquer comme résolu, avec variante violette quand `resolution_suggested_at > last_opened_at`
- **M9.16** — Acquittement implicite : ouverture d'un sujet met à jour `last_opened_at`, ce qui fait disparaître les badges « ✦ à examiner » des listes
- **M9.17** — Drag-and-drop des tâches (dnd-kit) sur le widget calendrier semaine et la vue mois Planning

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

- **M14.1** — Tests d'intégration sur le `MessageProcessor` (couvrir les cas A à P de `../conception/03-cas-usage.md`)
- **M14.2** — Tests E2E Playwright sur les 3 flux critiques : login, traiter un sujet, dialoguer dans le drawer
- **M14.3** — Monitoring : Sentry (web + worker) + Vercel Analytics + logs Railway (worker)
- **M14.4** — Sauvegarde DB quotidienne (Neon : backups / point-in-time recovery) + test de restore
- **M14.5** — Dashboard de coûts Claude (tokens/jour/compte) via AI Gateway
- **M14.6** — Anti-loop d'ingestion email (header `X-Relvo-Outbound` sur les messages sortants)

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
