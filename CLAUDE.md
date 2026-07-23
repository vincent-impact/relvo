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
- **`docs/conception/03-cas-usage.md`** — flux utilisateur (cas A à V).
- **`docs/conception/04-ia.md`** — ce que l'IA fait et **ne fait pas**.

## Architecture (résumé)

> **Détail complet et raisonné : [`docs/spec/architecture.md`](docs/spec/architecture.md) — source de vérité.** Ce qui suit n'en est qu'un résumé.

Monorepo léger (pnpm workspaces), **déployable unique** (`apps/web`) sur un schéma Prisma partagé :

- **`apps/web`** — Next.js App Router **fullstack** → **Vercel**. UI + API (Route Handlers + Server Actions) + auth + chatbot + CRUD + **webhooks d'ingestion Unipile** (email + WhatsApp).
- **`packages/db`** — schéma **Prisma** + enums partagés (`Actor`, `Status`, `Priority`, `Kind`, `TriageHint`) + couche domaine.
- **`packages/storage`** — stockage fichiers R2 (upload pré-signé, download authentifié, outbox de suppression).

Points à ne pas oublier :
- **Pas de backend NestJS séparé.** Route Handlers + Server Actions + Prisma couvrent tout. Le plan initial (Turborepo + NestJS + JWT) est **abandonné** — si une doc le mentionne encore, c'est caduc, se référer à la spec.
- **🔀 Bascule Unipile (2026-07-16) — plus de worker always-on.** Email **et** WhatsApp passent par l'agrégateur managé **Unipile** (envoi « au nom de » l'utilisateur, hosted auth OAuth/IMAP/QR, webhooks temps réel, UE/SOC2/DPA). Cela **remplace** Postmark **et** le daemon Baileys : WhatsApp devient un webhook serverless comme l'email. Toute mention de `apps/worker`, Baileys, Railway/Render, BullMQ ou Postmark est **caduque**. Le client d'intégration vit dans `apps/web/src/server/unipile/` ; l'ingestion aboutit à un `Message` orphelin (« Sans sujet »), le pipeline IA (M7) fera le Sujet. Le **risque de ban WhatsApp** demeure (connexion non officielle chez Unipile).
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
│   ├── db/prisma/schema.prisma   # schéma + couche domaine (partagé app ↔ tests)
│   └── storage/src/              # stockage fichiers R2 (M4)
└── apps/
    └── web/                   # → Vercel (Root Directory = apps/web) — déployable UNIQUE
        ├── src/app/           # routes App Router (voir mapping ci-dessous)
        │   ├── api/chat/                  # AI SDK + Gateway
        │   └── api/webhooks/unipile/      # email + WhatsApp entrants (Unipile)
        ├── src/components/    # layout/ (Sidebar, ChatDrawer), feed/, ui/ (shadcn)
        ├── src/lib/           # db.ts (client Prisma), auth.ts, helpers
        └── src/server/        # Server Actions + logique métier + unipile/ (client intégration)
```
> `apps/worker` (daemon Baileys) **n'existe plus** : bascule Unipile (webhooks serverless).

**Règles de navigation pour Claude** :
- Avant de créer/modifier un écran, **lire les docs `docs/conception/` concernées** — elles priment sur toute supposition.
- Pour reproduire fidèlement un écran, s'appuyer sur le HTML/CSS correspondant dans `mockup/`.
- Le schéma Prisma (`packages/db`) doit rester **cohérent avec `02-modele-donnees.md`**.
- Toute logique métier réutilisable passe par un package : `packages/db` (types, accès DB, domaine), `packages/storage` (fichiers R2) — jamais de duplication. L'intégration Unipile (email + WhatsApp) vit dans `apps/web/src/server/unipile/` (unique consommateur : l'app).
- **Aucun accès direct au stockage** : tout passe par `@relvo/storage` (`getStorage()`), jamais par un client S3 instancié à la main. C'est ce qui garde le fournisseur remplaçable — et ce qui évite de recréer un `S3Client` sans les deux réglages R2 obligatoires (`signableHeaders` sur `content-type`, checksums en `WHEN_REQUIRED` : cf. `r2.ts`, sans eux la signature ne contraint pas le type de fichier et le SDK signe le CRC32 du vide).
- **Afficher un fichier = une URL stable, jamais une URL signée.** `<img src={`/api/attachments/${id}/download?inline=1`} />` — le navigateur suit la redirection 307 vers R2 tout seul. L'URL signée (5 min) est un détail interne, jamais manipulée par un composant. C'est l'architecture par défaut d'ActiveStorage, en version **authentifiée** (le défaut Rails ne l'est pas). Sans `?inline=1` → téléchargement sous le vrai nom du fichier. **Ne jamais mettre une URL pré-signée dans `next/image`** : la clé de cache Vercel inclut la query string ⇒ signature qui tourne = MISS + transformation **facturée** à chaque rendu. **Ne jamais streamer un fichier à travers une Function** (« lightweight API layer, not a media server » — Vercel ; body de réponse plafonné à 4,5 Mo).
- **Toute route servant de la donnée d'un tenant envoie `Cache-Control: private` + `Vercel-CDN-Cache-Control: no-store`.** La clé de cache d'un CDN est méthode + URL, sans aucun header de requête : une route authentifiée par cookie a donc la **même clé pour tous les utilisateurs**. Ne pas s'en remettre au défaut plateforme — incident Railway du 2026-03-30 : cache activé par accident, « requests for one user [served] to a different user », seules les apps qui envoyaient `private` explicitement ont été épargnées.
- **🚫 Ne JAMAIS supprimer un fichier R2 depuis une fonction de suppression.** Le domaine ignore le stockage : un **trigger PostgreSQL** met `storage_key` dans l'outbox `pending_file_deletions` (dans la transaction), un cron draine hors transaction (M4.6). C'est le seul mécanisme qui capte les **cascades**, dont Prisma est aveugle par conception. Supprimer en synchrone rouvrirait les pertes de données qui ont fait retirer ce comportement de Django en 1.3. **Toute nouvelle table portant un `storage_key` doit recevoir son trigger dans la migration.**
- `docs/` et `mockup/` ne sont buildés par personne (Next ne build que `apps/web/src/app`).

### Mapping routes ↔ écrans

Routes francophones, alignées sur la nav V1.

| Route | Écran | Nav |
|---|---|---|
| `/` | **Actions** (🗓️ agenda) — page des TÂCHES : barre KPI Tâches (RDV · Aujourd'hui · En retard · À trier) + 2 onglets **Agenda** (semainier slidable + drag&drop) / **À trier** | Onglet |
| `/fil` | **Sujets** (📦 carton, ex-« Mon fil ») — **barre KPI-onglets** (Urgents · Nouveaux · Ouverts · Validés — chiffres cliquables qui SÉLECTIONNENT la liste, cellule active teintée violet ; plus de « Sans sujet », plus d'accès direct à « Fermés ») + **barre de filtres par DOMAINE** (chips défilables, icône + couleur du dossier) | Onglet |
| `/dossiers` · `/dossiers/[id]` | **Mémoire** (🧠) — liste des domaines + fiche : onglets Instructions/Documents/Sujets | Onglet |
| `/parametres` | **Réglages** (⚙️) — onglets Profil / Canaux / **Contacts** (annuaire) / Préférences | Onglet |
| `/contacts` · `/contacts/[id]` | Annuaire + fiche contact | Hors-nav (atteint via l'onglet Contacts des Réglages) |
| `/sujets/[id]` | Détail d'un sujet | Fiche détail |
| `/planning` | Calendrier vue mois | Hors-nav (lien depuis le widget semaine de l'Accueil) |
| `/conversations` · `/conversations/[id]` | **Messages** (✉️ enveloppe) — liste triée par activité **PUREMENT temporelle** (le non-lu ne remonte plus, 2026-07-23), filtres **Sans sujet** (défaut) / Ignorées / Toutes + filtre canal. **Détail (v2, 2026-07-23)** : tout le contexte (interlocuteur, canal en clair « E-mail »/« WhatsApp », domaine, résumé placeholder, sujets suivis) vit DANS le hero violet ; l'avatar de l'expéditeur est cliquable (contact connu → sa fiche · « ? » → création pré-remplie) ; le dock 5-icônes cède la place à un **dock d'action violet** — « Ignorer » (fantôme) / « Ouvrir un sujet » (blanc plein). ⚠️ **Rendu et gestes par canal** (cf. invariant n°13bis) | Onglet (**Messages**, entre Sujets et Mémoire, 2026-07-23) |

**Navigation = barre d'onglets en bas** (mobile-first), **5 entrées** (décision 2026-07-23, ex-4) : **Actions** 🗓️, **Sujets** 📦, **Messages** ✉️, **Mémoire** 🧠, **Réglages** ⚙️. **« Messages » (→ `/conversations`) a rejoint le dock**, entre Sujets et Mémoire : les conversations comptent tant qu'aucune IA ne fait le tri, et la barre rend visible la chaîne de transformation **Actions ← Sujets ← Messages**. Icônes revues le même jour : Actions = **agenda** (ex-✅), Sujets = **carton/projet** (ex-📥 inbox), Messages = **enveloppe**. Sur le **détail** d'une conversation (`/conversations/[id]`), le dock est masqué au profit du dock d'action (« Ignorer » / « Ouvrir un sujet »). « Accueil » est devenu **Actions** (page des tâches, cf. invariant n°30) et « Mon fil » est devenu **Sujets**. **Contacts a quitté le dock** : c'est désormais un **onglet des Réglages** (entre Canaux et Préférences) — l'usage Équipe à venir le re-promouvra peut-être. Note IA : un contact rattaché à un **pôle/dossier** influencera la qualification des messages reçus (les sujets d'un contact « RH » tomberont probablement dans le dossier RH). L'**échange** avec Relvo (`/relvo`) est une **surface plein écran** (plus un drawer latéral), atteinte via un **bouton Relvo en haut à droite du header violet** — présent sur toutes les pages, même forme que l'ancien bouton ✦ du composer (décision 2026-06-27, abandon du composer persistant du bas : trop encombrant, hidden-menu, confusion avec le composer destinataire d'un sujet). Les éventuels boutons de page (ex. « + » Nouveau sujet) se posent **à gauche** du bouton Relvo. La **barre d'onglets basse est fixe, sur fond violet** (comme l'ancien composer). Le virage mobile-first et la PWA sont détaillés dans `docs/spec/ux-mobile-first.md` ; cf. `01-principes.md §13`.

## Invariants produit à respecter

> Liste condensée. Le détail et la justification sont dans `docs/conception/`. Ne pas les enfreindre sans validation explicite.

**Modèle & acteurs**
1. `Account` est le tenant. Toutes les ressources portent `account_id`. Pas de FK utilisateur sur les ressources.
2. Type partagé `Actor = enum(user, ai, contact, system)`. UI : **Moi / Relvo / Externe** avec badges `M` (bleu) / `R` (violet) / `E` (ambre).
3. « **Relvo** » dans l'UI, « IA » dans la doc technique. L'enum reste `ai`.

**Sujets, tâches, messages, contacts**
4. Le **Subject** est l'entité centrale, pas le message. Chaîne : **Message → Conversation → Subject → Task → Action → LogEvent** (insertion de `Conversation`, 2026-07-20).
5. ⚠️ **Caduc depuis le 2026-07-20** (M6bis). Le rangement en **Conversation** est **déterministe et infaillible** à la réception : il n'y a plus de message orphelin ni d'échec à justifier. `triage_hint` n'est **plus alimenté** (champ conservé pour l'historique). Le KPI « Sans sujet » compte désormais les **conversations qu'aucun sujet ouvert n'écoute**.
6. Une **tâche** est rattachée au sujet, pas à un utilisateur (affectation = V2). Source visible via actor-pill (`✦ Relvo` / `Moi`).
7. **Statut = cycle de vie à 3 valeurs** (`ouvert`, `validé`, `fermé`), exclusif. `ouvert` = état par défaut, **invisible** (aucun badge) ; `validé` = **le travail est FAIT** (swipe droite) ; `fermé` = **l'affaire est ÉCARTÉE** — jamais traitée, abandonnée (swipe gauche). ⚠️ **La distinction entre les deux terminaux compte** : sans elle, impossible de répondre à « qu'ai-je réellement traité ce mois-ci ? ». **Les deux sont RÉCUPÉRABLES** — onglets **Validés** / **Fermés** (⚠️ **l'onglet « Fermés » n'a plus d'accès direct sur la page Sujets depuis le 2026-07-23** : la barre KPI-onglets ne propose que Urgents/Nouveaux/Ouverts/**Validés**. Les sujets fermés existent toujours et restent récupérables ; leur surface de listing sera re-exposée plus tard). ⚠️ **« Fermer » est une SUPPRESSION DOUCE, jamais une destruction** (2026-07-21) : vocabulaire **« Fermer » / « Fermés » / « Remettre »**, **jamais** « Supprimer » / « Corbeille ». Raisons : (1) c'est **honnête**, rien n'est détruit ; (2) **un sujet est le seul endroit où vivent les tâches et le journal des décisions** — un message supprimé par erreur existe encore dans Gmail, une **tâche** supprimée par erreur n'existe **nulle part ailleurs**. Les deux transitions terminales posent `closed_at` (**une simple date**, plus une borne d'appartenance) et **arrêtent les écoutes** du sujet — ⚠️ **donc ses conversations WhatsApp UNIQUEMENT** (cf. n°13bis) : un sujet email **n'écoute rien**, il n'y a rien à arrêter. ⚠️ **La réouverture automatique d'un sujet EMAIL à la réception est MAINTENUE — règle rétablie le 2026-07-21** (elle avait été retirée le matin même sur une lecture erronée de « `validé` n'est plus alimenté », phrase écrite dans une section « **arrêt des écoutes** », donc portant sur **WhatsApp seul**). Un nouvel email de même objet + même interlocuteur **rejoint TOUJOURS le sujet du fil** et le repasse en **`ouvert`** (`closed_at` effacé). **Le seul geste qui fait taire un fil email est `ignoreConversation`** — c'est pour cela que Relvo le propose après « Valider » et « Fermer ». Côté **WhatsApp**, aucune réouverture : le message reste sans sujet, la conversation redevient orpheline. Cf. `03-cas-usage.md` **Cas W**. ⚠️ **`archived` est retiré** et **`ignored` a migré sur la `Conversation`** (on fait taire une **source**, pas un sujet) — avec eux disparaissent l'ignorance collante et la purge à 15 j. **« Nouveau » n'est pas un statut** mais un **marqueur dérivé** (`lastOpenedAt == null`) ; ouvrir la fiche le pose et éteint le marqueur (acquittement implicite, cf. n°10). Marqueurs cumulables : Urgent, Nouveau, À faire, En attente (`waiting_for_reply`), pastille de non-lus. Ex-statuts `to_do`/`waiting`/`unread`/`new` supprimés.
8. **Priorité (urgence) à 2 valeurs** (`urgent`, `normal`) ; **drapeau urgent** (rouge) si `priority = urgent`. La **rareté est le signal** (1-2 sujets sur 24). `getOpenFeed` = tous les ouverts, **urgents en tête**. **Swipes — la cible dépend de la surface** :
   - **sur un SUJET** (page Sujets) : ← **Fermer** (rouge, `status = fermé` → onglet **Fermés**, récupérable par **Remettre**) · → **Valider** (vert, `status = validé`). Plus d'« Archiver », plus d'« Ignorer » sur un sujet.
   - **sur une CONVERSATION** (page `/conversations`) : ← **écarter** (= **PAUSE**, aucune borne de fin) · → **ouvrir un sujet** — ⚠️ **email uniquement** (cf. n°13bis : en WhatsApp le swipe droite porte sur le **MESSAGE**). L'écartement s'**habille par canal** — email « **Supprimer** » / **rouge**, WhatsApp « **Ignorer** » / **orange** — mais appelle **`ignoreConversation` dans les deux cas : AUCUNE donnée n'est supprimée**.
   - ⚠️ **Le swipe gauche sur une conversation ÉCOUTÉE ouvre d'abord une CONFIRMATION qui NOMME les sujets concernés** (2026-07-21). **Jamais « un ou plusieurs sujets »** : on ne fait pas confirmer un risque sans dire lequel — une confirmation sans information se clique sans être lue. Pas de confirmation si aucun sujet ouvert n'écoute le fil.
   - **sur un MESSAGE WhatsApp** : → **swipe droite** = « ce message est important » → **commencer l'écoute ici et ouvrir le sujet** ; sur un message **plus ancien** alors qu'une écoute existe, **elle remonte jusqu'à lui**. ⚠️ **Le TAP est réservé à l'ouverture des pièces jointes** — plus aucune pop-up de message, sur aucun canal.
9. **Brouillon Relvo dans le composer** (jamais affiché comme un message du fil). Actions « Régénérer » / « Effacer ».
10. **Acquittement implicite** des suggestions : ouvrir un sujet vaut acquittement (logique sur `last_opened_at`). Pas de bouton « valider ».
11. ⚠️ **« Conversations par contact, tous canaux confondus » est CADUC** (2026-07-20). La `Conversation` est une **entité** à clé canonique **par canal** — `email:<interlocuteur>:<objet>`, `wa-group:<chat_id>`, `wa-direct:<numéro>` : un même contact qui écrit par email puis par WhatsApp produit **deux conversations**. La réunification entre canaux **remonte d'un cran**, au **Sujet**, qui agrège 0/1/n conversations. Fiche sujet : l'onglet s'appelle **« Conversations »** ; le **composer n'apparaît que dans cet onglet**. ⚠️ **Évolution du 2026-07-21 — le sélecteur désigne une CONVERSATION, plus un contact.** La fiche n'affiche **qu'UNE conversation à la fois** : une **ligne unique** en tête de l'onglet (icône du canal + nom + **état d'écoute**), **tapable** → **feuille** listant toutes les conversations du sujet avec leur état et l'action « **arrêter l'écoute** ». C'est à la fois le **sélecteur** et la **surface de gestion des écoutes** ; le **composer est synchronisé** avec elle. **Écartés, avec leur raison** : le **flux chronologique fusionné** (email pleine largeur + bulles WhatsApp = le chaos visuel que la divergence par canal cherche à éviter), le **carrousel horizontal** (le swipe est déjà pris par le geste sur les messages), les **onglets** (l'onglet Conversations vit déjà dans une barre à 3 onglets — pas d'onglets dans des onglets). Le terme **« Interlocuteur(s) »** remplace « Destinataire(s) » dans l'UI.
12. **Création automatique d'un contact** (pipeline IA) uniquement à la création d'un sujet — l'IA ne crée jamais un contact « dans le vide ». Expéditeur inconnu = `sender_raw` + avatar `?`. **La création manuelle par l'utilisateur reste permise** (bouton + de l'annuaire `/contacts` → `sourceActor: user`, statut `complete` d'emblée).
13. Sujets **multi-contacts** (`contact_ids: UUID[]`).
13bis. **UX par canal — on diverge sur le RENDU et les GESTES, jamais sur le DOMAINE** (2026-07-20, **simplifié le 2026-07-21**). Forcer une UX unique dessert les deux canaux : les messages email sont longs et structurés (la bulle les étrangle), et WhatsApp n'a pas d'**objet**.
   - **🔑 Énoncé central** : **un fil d'email EST un sujet ; une conversation WhatsApp est un FLUX, qu'un sujet ÉCOUTE — à partir d'un message, jusqu'à ce qu'il cesse d'écouter.** Tout le reste en découle.
   - ⚠️ **« Un fil d'email EST un sujet » est DIRECTIONNELLE** (précision du 2026-07-21) — la lire comme bidirectionnelle **bloque l'implémentation** : **conversation → sujet = 1:1** (une conversation email a UN sujet, un seul, à vie) ; **sujet → conversations = 1:N** (un sujet porte 0, 1 ou n conversations, email et/ou WhatsApp). **Ce qui est unique, c'est le sujet d'une conversation, pas la conversation d'un sujet.** ⚠️ **Aucune contrainte d'unicité sur `subjectId` dans `SubjectConversation`** — la poser casserait les cas M (nouvel objet), S (second canal) et X (autre adresse).
   - **Changement d'adresse d'un interlocuteur** (décision du 2026-07-21) : Karim répond depuis `karim@sogood.fr` après avoir écrit depuis `karim@gmail.com`, **même objet** → l'interlocuteur ayant changé, **la clé change**, donc **une seconde conversation** naît. **On n'y touche pas côté tri** : l'utilisateur la **rattache au même sujet** d'un swipe droite (« Rattacher à un sujet existant »), geste qui existe déjà. ⚠️ **Aucun rapprochement automatique** : détecter « même objet, autre adresse » demanderait de l'**inférence à la réception**, ce qui détruirait le **déterminisme** du rangement et la **stabilité de l'identité** d'une conversation. Coût = un rattachement manuel occasionnel ; bénéfice = **la clé reste calculable et infaillible**. Cf. `03-cas-usage.md` **Cas X**.
   - **Vocabulaire : « ÉCOUTE » remplace « fenêtre »** (2026-07-21). « Écoute » décrit une **action du sujet** (il se branche, il se débranche) là où « fenêtre » décrivait une **plage subie** — et ça déplace la commande dans **la fiche du sujet**. ⚠️ **Le modèle ne change pas** : `anchorMessageId` et `closingMessageId` **SONT** le début et la fin d'une écoute. **L'écoute est un concept exclusivement WhatsApp** (« thread sans objet ») : côté email, un sujet **n'écoute rien**, il **EST** le fil.
   - **Rendu** : email = **pleine largeur**, **fond blanc dans les deux sens** — c'est l'**en-tête** (avatar + expéditeur + date) qui porte l'information, le sortant se signalant par « **Moi** ». ⚠️ **Pas de fond teinté** sur du texte long (cf. Gmail/Superhuman/Outlook) ; repli si insuffisant : teinte **très légère au sortant seulement**. **WhatsApp conserve les bulles.**
   - **Gestes** (2026-07-21) : **email → swipe droite sur la CONVERSATION** (ouvrir un nouveau sujet **ou** rattacher à un sujet existant) ; **WhatsApp → swipe droite sur le MESSAGE** (commencer l'écoute ici et ouvrir le sujet ; sur un message **plus ancien** alors qu'une écoute existe, **elle remonte** — **un seul geste qui crée ET qui étend**). ⚠️ **Le TAP est RÉSERVÉ à l'ouverture des pièces jointes** : plus aucune pop-up de message, plus de rattachement/détachement message par message dans l'UI. Swipe gauche inchangé (« Supprimer »/rouge · « Ignorer »/orange, **même `ignoreConversation`**), désormais précédé d'une **confirmation nommant les sujets** (cf. n°8).
   - ⚠️ **SUPPRIMÉS le 2026-07-21** : le **cordon de sujet** (rail coloré par message, trait entre messages consécutifs, point creux, rupture visuelle montrant l'entrelacement), la **poignée d'ancre** glissante, **dnd-kit sur l'ancre**, l'**aperçu en direct** pendant le drag, le **défaut d'ancre**. **Raison** : une conversation est désormais **soit écoutée par un sujet ouvert, soit pas** — binaire. Dans la plage d'écoute **tous** les messages appartiennent au sujet, hors plage **aucun** : un rail qui alterne des couleurs n'a plus rien à montrer.
   - **Signal d'appartenance = un BANDEAU en en-tête de conversation, sur les DEUX canaux** : « **Suivi dans : *titre du sujet*** » + pastille de couleur du domaine, cliquable vers la fiche, **plus un discret « N sujets passés »** qui déplie les écoutes terminées. ⚠️ **Ce dépliant n'est pas un ornement** : sans lui, les écoutes passées **n'existent plus nulle part** côté conversation.
   - ⚠️ **DEUX RENONCEMENTS ASSUMÉS, à ne pas cacher.** (1) **L'entrelacement dans une plage d'écoute n'est plus exprimable dans l'UI** — c'était l'argument fondateur du modèle (un fournisseur qui alterne deux affaires). Le modèle le permet toujours (`Message.subjectId` demeure), l'**interface ne l'expose plus** : c'est exactement le travail que fera **M7**, et en attendant **un peu de bruit vaut mieux qu'une UI incompréhensible**. (2) **Les écoutes passées deviennent invisibles côté conversation** — d'où le « N sujets passés ».
   - **Email — le sujet EST le fil.** ⚠️ **Ouvrir un sujet email balaie le fil ENTIER, amont compris** — la règle « messages ≥ ancre » est un héritage WhatsApp qui, appliquée à l'email, ne rattacherait qu'**un** message sur un fil de six.
   - **WhatsApp — une écoute à DEUX bornes.** `anchorMessageId` (début) et `closingMessageId` (fin, colonne nullable, **aucun backfill**). **Directs ET groupes, même régime** (le nom du groupe **ne fait pas office d'objet**).
   - **Arrêt des écoutes — donc, structurellement, WhatsApp** (rétabli le 2026-07-21) : **`fermé`** → **plus d'écoute du tout**, la conversation ne référence plus ce sujet ; **`validé`** → la conversation **n'alimente plus** le sujet ; **« arrêter l'écoute »** (feuille de la fiche sujet) → cette conversation-là seulement — ⚠️ **c'est le SEUL geste qui détache un fil email d'un sujet** ; **conversation ignorée (mute)** → elle n'alimente plus **aucun** des sujets ouverts qui l'écoutent, **sans borne de fin** (PAUSE réversible sur les **deux** canaux — sinon « Réactiver » serait un bouton sans effet). ⚠️ **Les deux premières lignes ne concernent QUE WhatsApp** : les conversations **email** d'un sujet ne sont **jamais** touchées par un changement de statut — elles continuent de l'alimenter et le **ROUVRENT** (cf. n°7 et `03-cas-usage.md` Cas W).
   - **Modèle : des RÉFÉRENCES, jamais des copies.** Un `Message` porte `conversationId` **et** `subjectId` ; `SubjectConversation` est une table de liaison. Lu depuis la conversation ou depuis le sujet, **c'est la même ligne**. ⚠️ Ne jamais « optimiser » en dupliquant les messages dans le sujet.
   - **Une seule primitive de domaine**, pas deux : *ouvrir un sujet **sur une conversation**, avec une ancre **OPTIONNELLE***. Ancre nulle → tout le fil ; ancre posée → l'écoute commence là. ⚠️ **La logique métier teste l'ANCRE, jamais le canal.**
   - ⚠️ **`Subject.closedAt` est DÉCLASSÉ** : simple date de clôture. **Distinguer l'APPARTENANCE** (les bornes d'écoute) **du STATUT** (`status`). Une borne qui désigne **un message** ne ment jamais ; une borne déduite d'un **horodatage** devient fausse dès que deux messages arrivent dans la même seconde.
   - **Plusieurs sujets SIMULTANÉS sur une même conversation : écarté de la V1** — `SubjectConversation` est déjà une liaison plusieurs-à-plusieurs, seule une **règle métier V1** l'interdit. ⚠️ Le jour où on la lèvera, il faudra **réinventer un signal plus fin que le bandeau**, qui suppose un seul sujet à la fois.
   - **Pourquoi** : l'**écoute n'est pas un concept du modèle, c'est la prothèse d'un objet manquant**. Elle tombera avec M7, comme l'« écoute active » (`01-principes.md §9`).
   - ⚠️ **Garde** : le domaine (ouverture de sujet, écoute, arrêt d'écoute, ignorance, statuts) reste **commun**. Le jour où l'on duplique la logique métier « parce que l'email est différent », **on aura deux produits**.

**Dates & planning**
14. Task : 4 champs date nullable (`start_date/time`, `end_date/time`). La deadline vit dans `start_*` ; `end_*` = durée.
15. Deux surfaces calendaires : **semaine** (widget Accueil) + **mois** (`/planning`). Code couleur par Dossier. Drag-and-drop.

**Dossiers & connaissances**
16. `Folder` (modèle) = **« Mémoire »** (nav, icône cerveau) ; chaque Folder = **« un domaine de la mémoire de Relvo »**, fiche en **3 onglets : Instructions / Documents / Sujets**. Regroupe Sujets (`Subject.folder_id`) **et** Connaissances (`KnowledgeDocument.folder_id`).
17. Folder « **Général** » auto-créé (`is_default`), documentaire transversal, jamais de sujets.
18. `KnowledgeDocument` : `kind = file` (UI **« Documents »**, PDF/image non modifiable) ou `kind = note` (UI **« Instructions »**, Markdown éditable). Un `file` porte un état d'absorption `read` (✦ lu, injecté dans les prompts) / `ignored` (écarté du retrieval), décidé par Relvo. Pas de page « Connaissances » séparée.
19. Ajout de document = drag-and-drop d'un PDF dans l'onglet Documents. **Deux stockages, jamais un seul** : le fichier vit dans **Cloudflare R2** (`storage_key` — une **clé d'objet, pas une URL** : bucket privé, URLs signées à la demande ; source de vérité et seule voie d'affichage à l'utilisateur) et une copie part vers la **Files API Anthropic** (`anthropic_file_id`) pour l'inférence. La Files API est en **écriture seule** — un fichier uploadé porte `downloadable: false` et n'est jamais relisible. Upload = **navigateur → R2 via URL pré-signée** (une Vercel Function plafonne le body à 4,5 Mo, une Server Action à 1 Mo — le PDF ne transite pas par le code).
20. V1 : seul l'utilisateur édite les Instructions ; Relvo les consulte sans les modifier.

**Chatbot Relvo**
21. Deux modes : **Accueil** = brief structuré (pas un chat) ; **échange** = surface **plein écran** accessible partout (`/relvo`).
22. **Échange plein écran** (mobile-first) à `/relvo`, ouvert depuis le **bouton Relvo en haut à droite du header** (présent sur toutes les pages, sauf dans l'échange lui-même). Page-aware : le bouton transmet la page d'origine (`?from=`) pour le chip de contexte, les prompts et le retour. L'historique (`/relvo/historique`) est atteint depuis l'échange (icône horloge). ⚠️ **« Échange » et non « conversation »** (2026-07-20) : depuis M6bis, une **Conversation** est une entité de données — le fil avec un interlocuteur externe. Cf. `02-modele-donnees.md §5bis`. Plus de composer persistant en bas, plus de drawer latéral 40 % (décision 2026-06-27 ; l'ancien composer du bas créait de l'encombrement, un hidden-menu et une confusion avec le composer destinataire de la fiche Sujet).
23. Conversations chat **éphémères en IndexedDB** (aucune entité serveur en V1). Ce qui persiste = actions + résultats.
24. Sessions implicites (seuil 5 min). Bouton « + Nouvel échange ». Liste des N derniers.
25. **Action-capable day-one** : chaque opération UI a un tool API correspondant (même fonction métier). Actions rendues en blocs visuels annulables. Le brouillon atterrit dans le composer, jamais envoyé directement.
26. **Page-aware** : URL + contexte transmis à chaque tour. Chip de contexte en haut de l'échange.
27. Stack chatbot : AI SDK + AI Gateway, tool calls natifs (pas de MCP en V1), prompt caching, Files API, citations.
28. **Empty state** : 3-4 prompts d'exemple contextuels à la page, en gris italique (pas de fausses bulles).
29. **Pas de RAG vectorielle** : long context + prompt caching pour les Connaissances, tool calls pour les données dynamiques.

**Actions & tâches (Accueil)**
30. **L'Accueil (« Actions ») est la page des TÂCHES**, pas des sujets (décision 2026-06-28). Header **« Bonjour … » + sous-titre « Actions du jour »** (identifie la page → contextualise les KPI ; le « Brief du jour » de Relvo est **retiré**, sans valeur pour l'instant) + barre KPI Tâches + **2 onglets** : **Agenda** (semainier) et **À trier**. La barre KPI est **contextuelle par page** : KPI Tâches sur Actions, KPI Sujets sur la page Sujets — jamais les deux lentilles sur un écran. ⚠️ **Sur Sujets, la barre KPI est devenue une BARRE D'ONGLETS** (2026-07-23) : les chiffres (Urgents · Nouveaux · Ouverts · Validés) ne sont plus décoratifs, ils SÉLECTIONNENT la liste. La barre KPI Tâches d'Actions reste, elle, indicative. **Taxonomie des tâches** dérivée de `start_date`/`start_time` (zéro migration) : **RDV** (date+heure), **tâche datée** (date sans heure), **flottante / à trier** (sans date). Marqueur dérivé **« En retard »** = tâche ouverte à échéance < aujourd'hui (granularité jour ; une flottante n'est jamais en retard). **L'onglet « En retard » dédié est SUPPRIMÉ** (décision 2026-06-28 *quater*) : le retard se gère désormais **dans le semainier** — on slide vers les jours passés (badges rouges) pour traiter / replanifier les tâches échues. Le compteur KPI « En retard » reste.
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
pnpm --filter db prisma migrate dev   # migrations DB
pnpm --filter db prisma studio        # explorer la base
pnpm --filter db test                 # tests d'invariants + domaine (base relvo_test)

# Déploiement : git push → Vercel déploie apps/web (déployable unique)
```

## Scope V1 (rappel)

**Inclus (MUST)** : modèle `Account`/`Actor`, Dossiers (Sujets + Connaissances), modèle de date riche, calendrier semaine + planning mois + drag-and-drop, statuts fidèles + drapeau urgent rare, chatbot drawer action-capable page-aware, WhatsApp **et** email dès V1 (via **Unipile**), citations API (UI minimale), pièces jointes **niveau 1** (étiquetage Haiku).

**Reporté V2** : page Activité standalone, pièces jointes niveau 2/3, édition de notes par Relvo, chatbot cross-device, UI riche citations, scope `subject` pour KnowledgeDocument, affectation tâche → utilisateur, WebSocket temps réel.

**Réflexe d'arbitrage** : simplifie l'usage food/bâtiment ? → V1. Renforce le chatbot comme surface d'action ? → V1. Peut attendre 2 mois ? → V2. Ressemble à du power-user/analytics ? → V2.
