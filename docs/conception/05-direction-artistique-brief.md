# 5. Brief de Direction Artistique — Relvo

> **Destinataire : Claude Design.** Ce document est un brief autoportant pour concevoir
> la **direction artistique** de Relvo. Il dit *ce qu'est le produit*, *à qui il
> s'adresse*, *quel registre viser*, et *quelles contraintes sémantiques sont
> déjà verrouillées*. À lire avec la maquette mobile (`mockup/mobile/`, voir §8),
> qui porte l'UX et l'inventaire des composants à habiller.
>
> **Ce qu'on attend de la DA** : une identité visuelle distinctive (couleurs,
> typographie, espacement, profondeur, motion, composants signature) — pas une
> refonte de l'UX, déjà figée par la maquette. On part de l'UX pour poser l'UI.

---

## 1. Le produit en une phrase

**Relvo est un assistant IA qui transforme le flux désordonné de messages reçus par
un dirigeant (e-mails, WhatsApp) en sujets métier structurés** — avec tâches,
journal de bord et aide à la décision. Ce n'est ni une boîte mail, ni un CRM, ni un
Notion : c'est un **agent** auquel on parle, qui range et fait avancer les affaires
en cours à votre place.

L'unité centrale n'est pas le message mais le **Sujet** : un espace de travail qui
rassemble messages, pièces jointes, tâches et événements autour d'une *situation
métier en cours de traitement* (« Remplacement sauce blanche fournisseur »,
« Panne congélateur Narbonne »).

## 2. L'objectif

- **Réduire la charge mentale** d'un dirigeant débordé de sollicitations. La promesse
  doit être **lisible immédiatement** : on ouvre l'app, on voit l'essentiel sans
  poser de question.
- **Faire ressentir que Relvo agit** — pas un tableau de bord passif de plus, mais un
  copilote qui a déjà préparé des tâches et des brouillons de réponse.
- **Inspirer confiance** : un dirigeant confie ses échanges professionnels à cet outil.
  L'esthétique doit être *rassurante, sérieuse, premium* — sans être froide ni
  corporate-bureautique.

## 3. À qui on s'adresse (le cœur du brief)

**Public cible : dirigeants des secteurs food et bâtiment.** Concrètement : le
gérant d'une franchise de fast-food (notre persona de référence : *Tasty Crousty*,
spécialiste poulet + riz + sauces), un patron d'entreprise de BTP, un restaurateur.

Caractéristiques déterminantes pour la DA :

- **Pas familiers des SaaS bureautiques.** Notion, HubSpot, Salesforce leur sont
  étrangers. Une sidebar dense, des tables à 7 colonnes, des réglages power-user
  les perdent. → **Minimalisme, gros titres, peu d'éléments par écran, cibles
  tactiles généreuses.**
- **À l'aise avec ChatGPT / Claude.** Leur modèle mental natif est la **conversation**.
  Ils savent parler à une IA. → La DA doit faire sentir qu'on **dialogue avec un
  agent**, pas qu'on remplit un logiciel.
- **Sur téléphone, une main.** Ils ne sont pas devant un bureau, ils sont en cuisine,
  sur un chantier, en déplacement. → **Mobile-first strict** : colonne unique,
  navigation au pouce, lisibilité en pleine lumière.
- **Pressés, peu patients.** L'info doit se lire en 30 secondes. → Hiérarchie visuelle
  forte, signal/bruit maximal, la rareté est le signal (cf. §5 « urgent »).

**Registre émotionnel visé** : *calme, premium, rassurant, humain, moderne.*
À éviter : le froid corporate-bleu-SaaS générique, le ludique-gadget, la densité
dashboard-analytics. On veut quelque chose qui respire, avec une **personnalité
chaleureuse mais sérieuse** — l'app d'un assistant de confiance, pas d'un ERP.

## 4. La posture produit qui guide toute l'UI

Deux invariants gouvernent chaque écran (ils ne sont pas négociables, ils orientent
la DA) :

1. **« L'UI sert à accéder à l'info, Relvo sert à agir. »** L'essentiel des actions
   passe par la **conversation**, pas par les écrans. La conversation avec Relvo est
   la **surface par défaut**, plein écran, accessible partout via un **composer
   persistant** (« Demander à Relvo… ») fixé au-dessus de la navigation. Les écrans
   structurés sont des *destinations* où l'on creuse — pas le centre de gravité.
2. **Mobile-first, agent au centre.** L'utilisateur ouvre l'app et il est, de fait,
   déjà en train de parler à Relvo. L'**Accueil** fusionne *brief* (ce qui m'attend
   aujourd'hui : KPIs + agenda + 2-3 sujets prioritaires) **et** *conversation* (le
   composer en pied de page) — le brief est le **premier tour de parole de Relvo**.

**Trois acteurs, un code couleur identitaire** (le triptyque structure toute la
lecture de l'app — c'est un pilier de la DA) :

| Acteur | UI | Couleur sémantique | Sens |
|---|---|---|---|
| L'utilisateur | **Moi** | bleu | ce que je fais |
| L'assistant IA | **Relvo** | **violet** ✦ | ce que l'agent fait / suggère |
| Le monde extérieur | **Externe** | ambre | contacts, fournisseurs, clients |

Le **violet Relvo** est la couleur signature de l'agent : tout ce qui émane de l'IA
(brouillon suggéré, tâche proposée, bandeau de brief, badge « ✦ N suggérées ») le
porte. C'est le fil rouge identitaire à soigner en priorité.

## 5. Contraintes sémantiques verrouillées (à respecter, pas à réinventer)

Ces choix portent du **sens métier** : la DA peut les sublimer (nuances, profondeur,
matière) mais **pas en changer la signification**.

### Palette de base déjà posée (tokens actuels — `mockup/mobile/css/app.css`)

```
Marque        --brand        #2B6FE0  (bleu)        — accent primaire, liens, "Moi"
              --brand-dark   #0A1128  (navy)        — texte fort, fonds profonds
              --brand-accent #E63150  (rouge)       — accent vif
Agent Relvo   --relvo        #6B5BD6  (violet)      — signature de l'IA  ✦
              --relvo-bg     #F1EFFC  (violet pâle) — fonds de blocs Relvo
Neutres       blanc #fff · gris #f7f7f5 / #eeecea · texte #1a1a1a / #6b6b6b / #9a9a9a
              bordures #e4e2de / #eeecea
```

Échelles sémantiques (50 / 100-200 / 600 / 800) pour badges & états, déjà définies :
**blue** (Moi, info), **purple** (Relvo), **amber** (Externe, attention douce),
**red** (urgent, danger), **green** (terminé, succès).

> La DA est **libre de retravailler ces teintes** (température, saturation, intro
> d'une couleur d'accent chaude pour le côté « food/humain ») **tant que les rôles
> sémantiques restent lisibles** : Moi=froid/bleu, Relvo=violet, Externe=ambre,
> urgent=rouge, terminé=vert. Si tu fais évoluer la palette, **conserve ces
> associations** ou propose un mapping équivalent explicite.

### Système d'état des sujets (à rendre visuellement, sans le complexifier)

- **Statut = cycle de vie à 4 valeurs, exclusif** : `new` (Nouveau, seul statut
  actif avec un badge visible) → `acknowledged` (Lu — **état par défaut INVISIBLE**,
  aucun badge : on lit « actif » par l'absence de badge) → `resolved` (Terminé) →
  `archived` (système, hors flux). **Seuls « Nouveau » et « Terminé » s'affichent.**
- **Marqueurs = cumulables, indépendants du statut** (plusieurs à la fois sur une
  carte) : 🚩 **Urgent** (drapeau rouge — *uniquement* si priorité critique ; la
  **rareté est le signal**, 1-2 sujets sur 24), **À faire** (tâches ouvertes),
  **En attente** (on attend un retour d'un tiers), **pastille non-lus** (compteur
  façon WhatsApp).
- **Priorité à 3 valeurs** : `low` / `high` / `critical`. Un seul drapeau urgent
  rouge, levé seulement sur `critical`.

→ Enjeu DA : **hiérarchiser ces signaux sans saturer la carte**. L'urgent doit
sauter aux yeux *parce qu'il est rare*. Le reste doit rester discret et lisible.

### Dossiers = « Mémoire » de Relvo

Les dossiers métier (Fournisseurs, RH, Juridique…) sont présentés comme **« la
mémoire de Relvo »** (icône cerveau 🧠 dans la nav). Chacun a un **code couleur**
propre, réutilisé dans le calendrier (tâches colorées par dossier). La DA définit
cette palette de dossiers (jeu de teintes distinctes et harmonieuses).

## 6. Inventaire des composants à habiller

La DA doit produire un **langage de composants** cohérent. Les pièces (toutes
visibles dans la maquette, cf. §8) :

**Navigation & chrome**
- **Barre d'onglets basse** — 4 entrées : Accueil 🏠 · Mon fil ✉️ · Mémoire 🧠 ·
  Réglages. Se rétracte au scroll (draw down/up).
- **App bar** — titre + sous-titre + action.
- **Composer Relvo persistant** — barre fixe « Demander à Relvo… » avec ✦ (historique),
  champ, 📷 photo, 🎙 vocal. **Élément signature.**

**Cartes & blocs (la brique de base — réutilisés dans les écrans ET dans le chat)**
- **SubjectCard** — la carte-sujet enrichie (avatar contact, titre, référence, badges
  de statut/marqueurs, drapeau urgent, badge « ✦ N suggérées », pastille non-lus,
  barre de progression). **Le composant le plus important du produit.**
- **KpiTile** — tuiles du bandeau Accueil (Sujets ouverts, Messages à trier, Tâches
  du jour, **% d'aide Relvo** — cette dernière en violet, c'est le KPI fierté de
  l'agent).
- **TaskCard** — tâche cochable, avec pastille de source (✦ Relvo / Moi) et dates.
- **MessageBubble** — bulle de message (entrant/sortant), indicateur de canal
  (email / WhatsApp).
- **ActorPill** — pastille Moi / Relvo / Externe (le triptyque couleur).
- **Badges & marqueurs** — StatusBadge (Nouveau/Terminé), drapeau Urgent, « À faire »,
  « En attente », badge suggestions, pastille non-lus.
- **AgendaCard / mini-calendrier** — agenda semaine (Accueil) + vue mois (Planning),
  tâches colorées par dossier.
- **SegmentedControl** — filtres/onglets (Priorité / Ouverts / Terminés ;
  Instructions / Documents / Sujets).

**Surfaces conversationnelles**
- **Conversation plein écran** — header retour + chip de contexte (« Contexte :
  SUB-0142 ») + **empty-state** (orbe ✦ Relvo + 3-4 prompts d'exemple en gris
  italique) + composer auto-grow. C'est le cœur « agent » — soigner l'**orbe/avatar
  Relvo** comme élément d'identité.
- **Brouillon Relvo (draft-pill)** — bloc « ✦ Suggestion de Relvo — modifiez librement »
  dans le composer d'un sujet.
- **Blocs d'action** — quand Relvo agit dans le chat, il rend des blocs visuels
  annulables (« ✦ J'ai créé la tâche … »).

**Mémoire / Connaissances**
- Cartes Dossier (compteurs sujets/documents/instructions), badge d'absorption
  (« ✦ lu » / « ignoré ») sur les documents, dropzone d'upload PDF.

## 7. Ce qui est libre vs ce qui est figé

| Figé (ne pas toucher) | Libre (terrain de jeu de la DA) |
|---|---|
| L'UX, les écrans, la nav 4 onglets, les flux (cf. maquette) | Couleurs (température, accents), profondeur, ombres, matière |
| Les rôles sémantiques de couleur (Moi/Relvo/Externe, urgent, terminé) | **Typographie** (la maquette est en système par défaut — à définir !) |
| Le système statut/marqueurs (4+marqueurs) et la rareté de l'urgent | Iconographie, illustrations, micro-interactions, motion |
| Mobile-first, colonne unique | Forme/rayon des cartes, style des badges, signature de l'orbe ✦ Relvo |
| Stack : Tailwind v4 + shadcn/ui (base-ui) — la DA doit rester **implémentable en tokens CSS + variants** | Densité, espacements, ambiance générale (clair/sombre, chaud/froid) |

> **Contrainte d'implémentation importante** : l'app est en **Tailwind v4 +
> shadcn/ui**. La DA doit se traduire en **design tokens (variables CSS)** et en
> **variants de composants**, pas en maquettes Figma figées. Pense « design system »
> (échelles de couleur, tokens d'espacement, niveaux d'élévation, styles de
> composants) — c'est ce qui sera resynchronisé dans le code via `/design-sync`.
> La typographie n'est aujourd'hui **pas définie** (police système par défaut) :
> proposer un couple typographique web-safe / Google Fonts est explicitement
> souhaité.

## 8. La maquette à digérer (UX de référence)

Donne à Claude Design le dossier **`mockup/mobile/`** — HTML/CSS statique, mobile-first,
qu'il manipule parfaitement. C'est la **référence UX figée** : layout, inventaire de
composants, hiérarchie. La DA habille ce squelette, elle ne le refait pas.

- **`css/app.css`** — *à lire en premier* : porte tous les tokens actuels (le `:root`
  cité au §5), la structure des composants, le device-frame mobile.
- **`index.html`** — Accueil (brief : KPIs + agenda + sujets prioritaires + composer).
- **`fil.html`** — Mon fil (feed de SubjectCards + filtres + swipe Ignorer/Terminer).
- **`sujet.html`** — fiche Sujet (header, status-strip, résumé Relvo, onglets
  Messages/Tâches/Journal/PJ, composer avec brouillon).
- **`conversation.html`** / `conversations.html` / `conversation-thread.html` — la
  surface agent (empty-state, historique, fil de discussion).
- **`dossiers.html`** / `dossier.html` — la Mémoire (cartes Dossier, 3 onglets).
- **`planning.html`**, `messages.html` + thread, `contacts.html` + `contact.html`,
  `parametres.html` — le reste des destinations.

**Conseil de lecture pour la DA** : commencer par `app.css` (tokens + composants),
puis `index.html` (la page d'atterrissage, vitrine de l'identité), `fil.html` et
`sujet.html` (les SubjectCards, brique centrale), `conversation.html` (l'âme agent).

## 9. Livrables attendus de la DA

1. **Une direction artistique argumentée** : moodboard / parti-pris (registre,
   inspiration, ce qu'on évite).
2. **Le système de tokens** : palette complète (en respectant/mappant les rôles
   sémantiques du §5), échelle typographique + couple de polices, échelle
   d'espacement, rayons, niveaux d'élévation/ombre, langage de motion.
3. **Les composants signature habillés** : en priorité **SubjectCard**, **KpiTile** (dont
   la tuile violette « % d'aide Relvo »), le **composer Relvo** et l'**orbe ✦** de la
   conversation, les **badges/marqueurs**, l'**ActorPill** (triptyque).
4. **2-3 écrans héros** rendus dans la DA : **Accueil**, **Mon fil**, **Sujet** — pour
   juger l'ambiance d'ensemble.

Si plusieurs partis-pris sont possibles, **proposer 2-3 directions distinctes** à
comparer visuellement avant de converger — c'est précisément la valeur d'une
exploration en amont du code.

---

### Données de référence (pour peupler des exemples réalistes)

Cas *Tasty Crousty* (chaîne de restauration poulet/riz/sauces) :
**Karim Benali** (SoGood Distribution, fournisseur — sauce blanche) ·
**Sophie Blanchard** (RH — congé maternité) · **ClimaPro Services** (juridique —
contrat climatisation) · **Restaurant Le Palais** (client — virement) ·
**PackPlus SARL** (fournisseur — emballage) · **FroidExpert SA** (production — panne
congélateur Narbonne).
