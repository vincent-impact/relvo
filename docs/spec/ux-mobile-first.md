# Spécification UX — Mobile-first, agent central

> **Statut : proposition (2026-06-16), en attente de validation.** Source de vérité du **layout, de la navigation et du responsive** de Relvo V1. Le *pourquoi* produit vit dans [`../conception/01-principes.md §13`](../conception/01-principes.md) ; les *choix de stack* dans [`architecture.md`](architecture.md) ; l'*ordre de réalisation* dans [`../backlog/backlog-v1.md`](../backlog/backlog-v1.md) (module M9). Ce document remplace, pour tout ce qui touche à la disposition à l'écran, la maquette desktop figée de [`../../mockup/`](../../mockup) — laquelle sera régénérée mobile-first à partir d'ici.

---

## 1. Posture

Deux invariants gouvernent toute l'UI (cf. principe 13) :

1. **Mobile-first.** On dessine **d'abord** pour un téléphone tenu à une main (≈ 390 px de large). Le desktop est un **enrichissement progressif**, jamais le point de départ. Une vue n'est « finie » que si elle marche en colonne unique au pouce.
2. **L'agent est central.** La conversation avec Relvo est **le lieu par défaut**, pas un add-on. Les écrans structurés sont des **destinations** qu'on atteint par la nav ou via une carte rendue par Relvo.

Conséquence directe : on supprime les trois piliers desktop de l'ancienne maquette — **sidebar 4 entrées**, **drawer chat 40 %**, **bouton flottant 🤖** — au profit d'une **barre d'onglets basse**, d'une **conversation plein écran**, et d'un **accès à Relvo intégré à chaque page**.

---

## 2. Breakpoints & grille

| Palier | Largeur | Cible | Layout |
|---|---|---|---|
| **Base (mobile)** | `< 640px` | Téléphone | Colonne unique. Nav = barre d'onglets basse. Conversation = plein écran. |
| **`sm` / tablette** | `≥ 640px` | Grande tablette portrait | Colonne unique élargie (max-width lisible ~600px centrée), padding accru. |
| **`md`** | `≥ 768px` | Tablette paysage | Apparition optionnelle d'un **2ᵉ volet** (ex. liste + détail sur Messages/Dossier). |
| **`lg`** | `≥ 1024px` | Desktop | Barre d'onglets → **rail latéral** gauche ; la conversation peut redevenir un **panneau** co-visible (≈ 420px) à droite ; vues à 2 colonnes. |

Tailwind est mobile-first par nature (`class` = base, `md:` = enrichissement). **Règle d'écriture** : aucune classe de largeur fixe en px sans préfixe de breakpoint ; tout `flex-row`/grille multi-colonnes doit avoir un fallback `flex-col` en base.

On conserve les **tokens de couleur existants** (`globals.css` : navy `#0A1128`, blue `#2B6FE0`, red `#E63150`, neutres) — le virage est structurel, pas chromatique. Cibles tactiles ≥ 44 px. Zones sûres iOS (`env(safe-area-inset-bottom)`) respectées sous la barre d'onglets et le composer.

---

## 3. Navigation — barre d'onglets basse

Remplace la sidebar. **4 onglets** (alignés sur la nav V1 et le mapping de routes), fixés en bas, au pouce :

| Onglet | Icône | Route | Rôle |
|---|---|---|---|
| **Accueil** | maison | `/` | Brief + conversation (surface par défaut) |
| **Mon fil** | enveloppe | `/fil` | Traitement des sujets (inbox structurée) |
| **Dossiers** | classeur | `/dossiers` | Affaires + Connaissances par Folder |
| **Paramètres** | roue | `/parametres` | Compte, canaux, contacts |

Les **vues hors-nav** (Planning `/planning`, Messages `/messages`, Contacts `/contacts`, Sujet `/sujets/[id]`, Dossier `/dossiers/[id]`, Contact `/contacts/[id]`) ne sont pas dans la barre : on y arrive par un lien contextuel (carte du chat, widget agenda, feed-strip, clic sur un nom) ou la recherche. Sur ces vues, un **bouton retour** en en-tête ramène à l'onglet d'origine.

En `lg`, la barre d'onglets devient un **rail latéral gauche** (icônes + libellés), comportement identique.

---

## 4. L'Accueil hybride (brief + conversation)

Écran d'atterrissage. Structure verticale, en colonne unique :

```
┌──────────────────────────────┐
│ En-tête : « Bonjour Vincent » │  ← salutation + date, recherche (icône)
├──────────────────────────────┤
│ ░ BRIEF (rendu par Relvo) ░   │  ← zone scrollable
│  • Bandeau KPIs (4, 2×2)      │     - KPIs en grille 2×2 (mobile) → 1×4 (md+)
│  • Carte « Agenda » (3 jours) │     - aperçu tâches à venir, lien → /planning
│  • 2-3 SubjectCard prioritaires│    - lien « Voir tout » → /fil
├──────────────────────────────┤
│ 💬 Composer « Demander à Relvo…»│  ← FIXE au-dessus de la barre d'onglets
├──────────────────────────────┤
│ 🏠   ✉   🗂   ⚙              │  ← barre d'onglets
└──────────────────────────────┘
```

- Le **brief** est le premier tour de parole de Relvo, rendu en **cartes** (mêmes composants que les vues structurées). Il scrolle ; le composer reste collé en bas.
- Le **composer persistant** (« Demander à Relvo… ») est toujours visible sur l'Accueil. **Taper / l'activer déploie la conversation plein écran** (§5). Un empty-state propose 3-4 prompts contextuels en gris italique (pas de fausses bulles).
- L'Accueil **n'a pas** de paire ✕/✓ sur les cartes (orientation, pas traitement — cf. principe 13). Le traitement se fait dans Mon fil.

---

## 5. La conversation — surface plein écran

Déclenchée depuis le composer de l'Accueil **ou** depuis l'accès Relvo d'une autre vue (§6.0).

```
┌──────────────────────────────┐
│ ‹ Relvo            + ⟳ (récent)│  ← retour, nouvelle conv, historique
│ Contexte : SUB-0142  ✕        │  ← chip page-aware (× = discussion générale)
├──────────────────────────────┤
│  … fil de messages …          │
│  [ Relvo rend des SubjectCard,│  ← GENERATIVE UI : vrais composants cliquables
│    TaskCard, blocs d'action ] │     dans le fil, pas du texte à puces
├──────────────────────────────┤
│ 💬 Écrire…                  ▶ │  ← composer
└──────────────────────────────┘
```

- **Plein écran** sur mobile (plus de drawer 40 %). En `lg`, peut redevenir un **panneau latéral co-visible** (≈ 420px) à droite de la vue courante.
- **Page-aware** : chip de contexte en haut (« Contexte : SUB-0142 — Sauce blanche »), `×` pour basculer en discussion générale.
- **Generative UI** : les réponses de Relvo rendent les **composants partagés** (§7) inline — c'est le mécanisme de rendu principal, et le support des **blocs d'action annulables** de l'action-capable (« ✦ J'ai créé la tâche… [Voir] [Annuler] »).
- **Sessions implicites** (reprise < 5 min), **éphémère** (IndexedDB), **historique** des N dernières conversations. Détail technique : `../conception/04-ia.md §11` (à ré-aligner, cf. §9).

---

## 6. Vues structurées — refonte mobile-first

### 6.0 Accès à Relvo, partout

Chaque vue structurée porte une entrée **persistante** vers la conversation, transmettant le **contexte de page** (URL + entité courante) : une barre fine « Demander à Relvo… » ancrée au-dessus de la barre d'onglets (cohérente avec l'Accueil), ou une action d'en-tête sur les sous-pages avec bouton retour. Pas de bouton flottant.

### 6.1 Mon fil (`/fil`)
Feed plein écran de **cartes-sujets en colonne unique** (référence, drapeau urgent, badge statut, badge `✦ N suggérées`, titre, résumé, méta, attachements, dernière activité, barre de progression). Filtres (Priorité défaut / Chronologique / Résolus) en **segmented control** horizontal scrollable. **Paire ✕/✓** sur chaque carte, cibles tactiles confortables (envisager swipe en V1.1, boutons explicites en V1). Bandeau Relvo « ✦ Aujourd'hui… » + lien → `/messages`.

### 6.2 Sujet (`/sujets/[id]`)
L'ancien layout 2 colonnes (main + panneau droit 340px) **s'empile** : en-tête (référence + statut + drapeau urgent + actions résoudre/archiver) → résumé Relvo → **onglets** (Messages / Tâches / Journal / Pièces jointes) en segmented control → contenu de l'onglet → **composer multi-canal** en bas (brouillon IA identifié « Suggestion de Relvo — modifiez librement avant d'envoyer »). Les « détails » (contact, dossier, canal) passent dans un onglet ou un repli en tête, pas une colonne. En `lg` : retour possible à 2 colonnes.

### 6.3 Dossiers (`/dossiers`) & Dossier (`/dossiers/[id]`)
Liste : **cartes Folder empilées** (1 colonne mobile → grille 2-3 en md/lg) avec compteurs (sujets, fichiers, notes). Fiche Dossier : sections **empilées** Sujets puis Connaissances (Fichiers + Notes), au lieu de 2 colonnes. Upload = zone drag-and-drop **+ bouton explicite** (le drag natif n'existe pas au doigt). Folder « Général » masque la section Sujets.

### 6.4 Planning (`/planning`)
La grille mois 7 colonnes **ne tient pas** sur téléphone. Mobile = **vue agenda en liste** (jours empilés, tâches sous chaque jour, navigation jour/semaine). La **grille mois** classique réapparaît en `md`/`lg`. Drag-and-drop replanification sur les surfaces qui le permettent (md+) ; sur mobile, replanification via action sur la tâche. Pile « Aucune date » accessible en marge.

### 6.5 Messages (`/messages`)
Le **split-view 2 colonnes** devient une **navigation à 2 niveaux** sur mobile : liste des conversations (par contact, tous canaux) → tap → fil de la conversation plein écran (retour en arrière). En `md`/`lg` : split-view liste + fil. Filtres « non lus » / « sans sujet » (URL `?filter=orphan`). Indicateur de canal par message, badge de rattachement au sujet.

### 6.6 Contacts (`/contacts`) & Contact (`/contacts/[id]`)
La **table 7 colonnes** devient une **liste de cartes-contacts** (avatar, nom, entreprise, statut, dernière activité). Filtre « À compléter » en segmented control. Fiche contact : sections empilées (coordonnées, sujets liés, canaux, origine) ; édition `auto → complete`. 2 colonnes possibles en `lg`.

### 6.7 Paramètres (`/parametres`)
Sub-nav latérale sticky → **onglets** en haut (segmented control) ou liste-accordéon : Profil / Canaux / Contacts. Formulaires en colonne unique (label au-dessus du champ).

---

## 7. Composants partagés (une bibliothèque, deux surfaces)

Les composants de M9.2 sont rendus **à la fois** dans les vues structurées **et** dans la conversation (generative UI). Réflexe shadcn d'abord pour chacun (cf. CLAUDE.md). Liste :

`SubjectCard` · `TaskCard` · `MessageBubble` · `ActorPill` (M/R/E) · `StatusBadge` (6 valeurs) · `UrgentFlag` · `RelvoSuggestionBadge` · `KpiTile` · `ChatComposer` (réutilisé Accueil/conversation/Sujet) · `BottomTabBar` · `SegmentedControl` (filtres/onglets).

Chacun doit être **autonome et responsive** : un `SubjectCard` rendu dans une bulle de chat doit être identique à celui du feed.

---

## 8. Enrichissement desktop (`lg+`)

Le desktop n'est pas une autre app, c'est la même colonne unique qui **gagne de l'espace** :
- Barre d'onglets → **rail latéral gauche**.
- Conversation plein écran → **panneau co-visible** à droite (on garde la vue + Relvo en même temps).
- Vues à 2 niveaux (Messages, Dossier) → **split-view** réintroduit.
- Cartes empilées → **grilles** 2-3 colonnes.

Aucun comportement desktop n'est requis pour qu'une vue soit fonctionnelle : c'est du bonus.

---

## 9. Alignements de suivi (à traiter après validation de cette spec)

Ce virage rend caduques plusieurs passages encore rédigés « desktop/drawer ». À mettre à jour **après** validation, avant ou pendant M9 :

1. **`../conception/04-ia.md §11`** — « Disposition UI — drawer latéral », « bouton flottant 🤖 », « ~40 % de largeur » → ré-aligner sur conversation plein écran / page-aware / generative UI.
2. **`CLAUDE.md`** — invariants **22** (drawer 40 %, bouton flottant), **26** (page-aware), section « Conventions » (sidebar 4 entrées, drawer dans `layout.tsx`), mapping routes (la sidebar devient barre d'onglets). Ajouter la posture mobile-first.
3. **`../backlog/backlog-v1.md`** — **M9.1** (« sidebar 4 entrées + drawer » → barre d'onglets + surface conversation), **M10.1** (« Sheet ~40 % » → plein écran/panneau), note generative UI.
4. **`../../mockup/`** — régénérer mobile-first (étape suivante du process : maquette → serveur local → validation).

---

## 10. Décisions tranchées (2026-06-16)

- ✅ **Accès Relvo partout** : barre « Demander à Relvo… » **persistante sur toutes les vues** (onglets ET sous-pages), au-dessus de la barre d'onglets. Pas de variante « action d'en-tête seule ». Agent omniprésent assumé, au coût de ~56px verticaux.
- ✅ **Accueil = onglet par défaut** au lancement.
- ✅ **Accueil et Mon fil = deux onglets distincts** : Accueil = brief+chat (orientation), Mon fil = traitement (feed + ✕/✓). On ne fusionne pas — préserve les deux modes mentaux et le rituel « calendrier d'abord, sujets ensuite ».
- ▶ **Maquette d'amorçage** : on construit d'abord **Accueil + conversation + Mon fil** (les 3 écrans qui portent le virage agent-central), puis on généralise aux 7 vues après validation UX.
