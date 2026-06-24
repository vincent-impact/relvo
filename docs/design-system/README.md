# Handoff — Relvo, Direction B (mobile)

## Overview
This package documents the **retained art direction (« Direction B »)** for the
Relvo mobile app and gives a developer everything needed to implement it in the
real codebase (`vincent-impact/relvo`, Next.js + Tailwind v4 + shadcn/ui).

Relvo is a French, mobile-first **AI-agent** app: it relève/trie email + WhatsApp
into business **Subjects** (messages + tasks + journal) and suggests replies. The
user talks to the agent; the UI is for accessing info.

## About the design files
The HTML/JSX in this bundle are **design references** — prototypes showing the
intended look and behaviour, **not** production code to paste in. The task is to
**recreate this direction in the app's existing stack** (React components +
Tailwind/shadcn), reusing its patterns. Where a value is given (hex, px, easing),
match it.

Two kinds of reference are included:
- **`components/relvo-b/`** — React primitives (plain JSX, inline styles reading
  CSS variables). The cleanest source of truth for each component's structure,
  props and styling.
- **`explorations/*-B*.html`** — full, validated static screens (the exact visual
  target). Open them in a browser to see the real thing. `relvo-b.css` is their
  shared stylesheet (class-based mirror of the components — useful to read exact
  CSS values).
- **`ui_kits/relvo-app/`** — the clickable React app composing the primitives
  (navigation, state, gestures). Run `index.html` (it loads `_ds_bundle.js`).

## Fidelity
**High-fidelity.** Final colours, type, spacing, radii, motion and interactions.
Recreate pixel-for-pixel with the codebase's component library.

---

## Direction B — the rules that govern everything
1. **No « white cards on grey ».** On mobile that flattens hierarchy. Hierarchy
   comes from **colour zones, lists, and type**.
2. **Violet agent zone** (`RelvoHeader`) tops every screen. The **Relvo logo is
   always top-right** and opens the conversations list.
3. **« Liquid Glass » dock**: a frosted translucent-white **tab bar** sits **above**
   a **fully-violet composer** → the app is framed violet-top / violet-bottom. The
   tab bar hides on scroll-down.
4. **Colour = actor / domain semantics (locked):** Moi = blue `#2B6FE0`,
   Relvo = violet `#6B5BD6`, Externe = amber `#854F0B`; urgent = red (rare = signal),
   terminé = green. Domain rails: Fournisseurs blue, RH purple, Juridique amber,
   Clients accent-red `#E63150`, Production green.
5. **Subjects are lines** (`SubjectRow`), not floating cards: colour rail + tinted
   icon; the urgent one is washed red; unread = **blue pip top-right**.
6. **Metrics = one « carte à cheval »** (`MetricsCard`) overlapping the header
   bottom; colour reserved for signal; circular gauge for memory saturation.
7. **Recipient-aware composer** (`RecipientComposer`): avatar selector left;
   **blue when writing to a human (Moi), violet when talking to Relvo**; placeholder
   verb + send icon follow; **mic when empty (voice-first), paper-plane while typing**;
   paperclip inside the field. Stays on the last chosen recipient.
8. **Swipe a Subject** (`SwipeRow`): **right → Terminer (green), left → Ignorer
   (red)**, ~80px threshold; low-priority = right only.
9. **Add-pattern** for any user-completable list (tasks, channels): « + Ajouter… »
   → inline input.

## Content / voice
French. Relvo speaks first person (« J'ai préparé… »); address the user as « vous ».
Sentence case; UPPERCASE section labels; the ✦ sparkle prefixes anything from the
agent. No decorative emoji. References read like `SUB-0142` in mono.

---

## Screens (each = a tab or pushed view)
The 4 tabs: **Accueil · Mon fil · Mémoire · Réglages**. Pushed views: **Sujet**,
**Conversation**, **Conversations** (the list the logo opens).

- **Accueil** (`explorations/accueil-B-v2.html`): violet header « Bonjour Vincent »
  + brief **carousel** (3 infos, 3 pagination dots, auto-advance ~4.2s) → overlapping
  **MetricsCard** (Urgents/Tâches/RDV/Nouveaux, one line) → « Sujets prioritaires »
  (SubjectRows) → dock.
- **Mon fil** (`mon-fil-B.html`): header + glass search field; **SegTabs** overlap
  (Priorité 3 / Ouverts 13 / Terminés 5, round count badges); agent note; SubjectRows
  (swipeable).
- **Sujet** (`sujet-B.html`): detail header (back + logo) carrying the **status strip
  + Relvo summary** inside the violet zone; **SegTabs** (Messages / Tâches N / Journal);
  Messages = ChatBubbles + a Relvo draft action-block (Envoyer / Modifier); Tâches =
  TaskRows + « + Ajouter une tâche » (inline); Journal = actor-coloured timeline; bottom =
  **RecipientComposer** scoped (Karim ↔ Relvo), no tab bar.
- **Conversation** (`conversation-B.html`): agent surface; ChatBubbles (Moi blue /
  Relvo violet ✦); violet composer only.
- **Conversations** (`conversations-B.html`): « Nouvelle conversation » highlighted
  entry + Récentes (ConvListItem with optional `SUB-` context chip).
- **Mémoire** (`memoire-B.html`): header + MetricsCard with **gauge** (Sujets suivis /
  Instructions / Documents / Saturation %); agent note (« enrichir la mémoire… »);
  FolderRows by domain.
- **Réglages** (`reglages-B.html`): SegTabs **Profil / Canaux / Préférences**. Profil =
  form (Nom, Email `vincent@vccimpact.fr`, Entreprise, Mot de passe) + **Se déconnecter**
  (red). Canaux = WhatsApp + Email (`…@inbound.relvo.io`) + Ajouter. Préférences =
  toggles (Brief quotidien, Suggestions auto, Notifications push, Lecture vocale).

## Interactions & behaviour
- Tap a SubjectRow → open Sujet. Swipe → Terminer/Ignorer (animate off ~200ms).
- Composer: typing toggles mic→plane; avatar tap opens recipient menu; bar colour +
  send-icon colour switch blue↔violet by recipient.
- Tab bar collapses (max-height→0, opacity→0, .3s) when scrolling down, restores up.
- Brief carousel: horizontal scroll-snap, dots reflect index, auto-advance.
- SegTabs / Réglages tabs / Sujet tabs: switch panels.
- Toggles flip on tap. Add-task: reveals inline input, Enter or « Ajouter » appends.
- Motion: `--ease-standard cubic-bezier(.2,0,0,1)`; durations 120/200/320ms.

## State
Mostly local UI state: active tab, current view (stack), recipient key, typed text,
task list (+ done flags, added items), removed (swiped) subject ids, toggle states,
carousel index, tab-bar hidden (scroll). No data layer in the prototype — wire to the
real Subjects/Tasks/Conversations API.

## Design tokens
See `styles.css` → `tokens/*.css` (the canonical source). Highlights:
- **Brand** `--brand #2B6FE0` · **navy** `--brand-dark #0A1128` · **accent**
  `--brand-accent #E63150` · **Relvo** `--relvo #6B5BD6` / `--relvo-bg #F1EFFC`.
- Semantic 50/600/800 scales for blue/purple/amber/red/green (badges, states).
- Warm neutrals: surface `#FFFFFF`, surface-2 `#F7F7F5`, sunken `#EEECEA`,
  hairline `#E4E2DE`; text `#1A1A1A / #6B6B6B / #9A9A9A`.
- **Glass (B)**: `--glass-tab rgba(255,255,255,.5)`, composer
  `linear-gradient(rgba(123,107,230,.82), rgba(101,85,210,.86))`, `--blur-glass 26px`,
  `--sat-glass 190%`, `--glass-stroke rgba(255,255,255,.55)`, `--shadow-dock`,
  `--shadow-metrics`, `--hero-round 34px`.
- Type: Bricolage Grotesque (display) · **Geist** (UI, the real app font) ·
  Geist Mono (numerals/refs). Radii 6→10→14→16→pill. See `tokens/typography.css`,
  `tokens/spacing.css`.

## Assets
`assets/relvo-icon.png` (official app icon, 2048²) + web sizes `-256/-96/-48`. Used as
the header logo button and conversation avatars. Icons elsewhere = **Lucide** (stroke 2).

## Files in this bundle
- `README.md` — this document.
- `styles.css`, `tokens/` — design tokens (canonical values).
- `components/relvo-b/` — the 12 Direction-B primitives (`.jsx` + `.d.ts` + `.prompt.md`):
  RelvoHeader, GlassTabBar, SegTabs, RecipientComposer, SubjectRow, SwipeRow,
  MetricsCard, TaskRow, FolderRow, ChatBubble, ConvListItem, JournalTimeline.
- `ui_kits/relvo-app/` — clickable React app (`index.html`, `app.jsx`, `app.css`,
  `data.js`) + `_ds_bundle.js` (compiled components, so it runs offline).
- `explorations/` — the validated static screens (`*-B*.html`) + `relvo-b.css`.
- `assets/` — the Relvo icon (all sizes).

Start by reading this README, then open `ui_kits/relvo-app/index.html` to feel the
app, and read `components/relvo-b/*.jsx` for exact structure/values.
