# CLAUDE.md

> **Base : `SCAFFOLD.md` génération `2026.08.28` — rétroporté le 2026-09-07.** Relvo précède le
> kit : ce dépôt en est la matière première, pas le produit. La mention « rétroporté » dit que
> l'alignement a été fait après coup, pas qu'il a été généré.

> **Ce fichier est une carte, pas un entrepôt.** Il dit **où sont les choses**, **ce qu'il ne
> faut jamais faire**, et **où on en est**. Il ne recopie rien : ni invariants, ni hiérarchie de
> sources, ni pièges. À lire en premier, à chaque session.

## Projet

Relvo transforme le flux désordonné de messages reçus par un dirigeant — e-mails, messagerie —
en **sujets métier structurés**, avec tâches, journal de bord et aide à la décision.

**Public** : dirigeants des secteurs **food** et **bâtiment**. Peu familiers des SaaS
bureautiques, à l'aise avec les assistants conversationnels.

**Posture produit** : « **l'UI sert à accéder à l'info, Relvo sert à agir** ». C'est le réflexe
d'arbitrage de tout le produit.

**Propriété des comptes** : dépôt, équipe de déploiement, base, stockage et agrégateur au nom de
l'organisation propriétaire du projet. ⚠️ Ne jamais provisionner une ressource du projet sur un
compte personnel, **même « en attendant »** — c'est exactement ce qui ne se défait plus.

## Documentation

**À lire avant de créer ou de modifier quoi que ce soit.**

| Fichier | Ce qu'il porte |
|---|---|
| [`conception/00-sources.md`](conception/00-sources.md) | **La hiérarchie des sources.** Qui a raison quand deux documents se contredisent. **À lire en premier.** |
| [`conception/01-principes.md`](conception/01-principes.md) | Le *pourquoi* : problème, public, posture — **et le domicile unique des invariants produit** |
| [`conception/02-modele-donnees.md`](conception/02-modele-donnees.md) | Le **persisté** : entités, champs, relations, contraintes |
| [`conception/03-cas-usage.md`](conception/03-cas-usage.md) | Le **vécu** de l'utilisateur. Il raconte, il ne tranche pas |
| [`conception/04-design-domaine.md`](conception/04-design-domaine.md) + [`uml.mermaid`](conception/uml.mermaid) | Le **comportement** : agrégats, cycles de vie, règles métier, **périmètre V1** |
| [`conception/05-ia.md`](conception/05-ia.md) | Ce que Relvo fait, et surtout ce qu'il **ne fait pas** |
| [`conception/design-system/`](conception/design-system/) | Tokens, règles de composition, patterns de disposition |
| [`conception/mockup/`](conception/mockup/) | **Référence visuelle figée**, jamais buildée. ⚠️ **Ses données sont de la démonstration** — ne jamais dimensionner dessus |
| [`backlog/product-backlog.md`](backlog/product-backlog.md) | L'**ordre**. La définition de chaque item vit dans `backlog/epics/` |
| [`backlog/definition-of-done.md`](backlog/definition-of-done.md) | Les conditions de clôture d'un item. Non négociables |
| [`backlog/ecarts-et-propositions.md`](backlog/ecarts-et-propositions.md) | **L'historique des décisions** — le seul endroit du dépôt où il est à sa place |

### La règle d'écriture de `conception/` — non négociable

Ces fichiers décrivent **l'état actuel du projet, jamais son histoire**.

- **Une erreur se corrige, elle ne se surcharge pas.** On récrit la phrase juste et on supprime
  l'ancienne — jamais un avertissement daté trois lignes plus bas.
- **Aucun concept mort**, **aucune date**, **aucun chiffre**.
- **Classer par sujet, jamais par provenance.**
- **De l'intention, pas de l'inventaire** : un document de conception porte le *pourquoi* et
  **pointe** vers l'inventaire. Quand un inventaire doit rester écrit, il est tenu par un
  **test**, jamais par la vigilance.

### Où on en est

Voir le **dernier fichier de [`backlog/sprints/`](backlog/sprints/)**. Lire son démarrage à froid
en premier.

## Architecture

**Déployable unique** : `apps/web`, une application Next.js fullstack — interface, API, auth,
échange avec Relvo, et **webhooks d'ingestion**. E-mail et messagerie arrivent par webhooks
serverless ; il n'y a **aucun processus permanent** à héberger.

**Les frontières, à tenir :**

- `conception/` ne contient **aucun code exécutable** ; `apps/` **aucune documentation produit**.
  La maquette n'est **jamais** buildée.
- **Toute logique métier réutilisable passe par un paquet** : le domaine et l'accès aux données
  d'un côté, le stockage de l'autre. **Jamais de duplication.** L'intégration de l'agrégateur
  vit dans l'application, son unique consommateur.
- **Aucun accès direct au stockage** : tout passe par le paquet dédié, jamais par un client
  instancié à la main — c'est ce qui garde le fournisseur remplaçable et ce qui évite de recréer
  un client sans les deux réglages obligatoires (`PITFALLS.md` #8).
- **Un test qui touche la base vit dans les tests d'intégration**, jamais ailleurs. Les tests
  unitaires sont colocalisés. La ligne de partage n'est pas la taille du test mais **sa
  dépendance**.

**Dérogations d'arborescence accordées :**

| Dérogation | Date | Motif |
|---|---|---|
| `packages/` conservé après la disparition du second déployable | 2026-09-07 | La couche domaine et ses tests d'intégration y sont installés ; les déplacer coûterait plus que la frontière ne rapporte. À revoir si un second déployable réapparaît. |

## Arborescence

```
relvo/
├── PITFALLS.md               # le registre — RESTE, n'est jamais recopié
├── CLAUDE.md · README.md
├── conception/               # tout le matériau amont — aucun code
│   ├── 00-sources.md · 01-principes.md · 02-modele-donnees.md
│   ├── 03-cas-usage.md · 04-design-domaine.md · 05-ia.md · uml.mermaid
│   ├── design-system/ · sources/ · mockup/
├── backlog/                  # product-backlog · epics/ · definition-of-done
│   └── ecarts-et-propositions.md · sprints/
├── apps/web/                 # SEUL déployable
│   └── src/{app,components,hooks,lib,server,types}
└── packages/{db,storage}
```

### Routes → écrans

| Route | Écran | Nav |
|---|---|---|
| `/` | **Actions** — la page des **tâches** : indicateurs + agenda de la semaine + à trier | onglet |
| `/fil` | **Sujets** — indicateurs cliquables qui **sélectionnent** la liste, filtres par domaine | onglet |
| `/conversations` · `/conversations/[id]` | **Conversations** — **seule surface d'affichage et de réponse** d'un fil | onglet |
| `/contacts` · `/contacts/[id]` · `/contacts/nouveau` | **Contacts** — annuaire et fiche | onglet |
| `/parametres` | **Réglages** — Profil · Canaux · **Domaines** · Préférences | onglet |
| `/sujets/[id]` · `/sujets/nouveau` | Fiche d'un sujet | hors-nav |
| `/dossiers/[id]` · `/dossiers/nouveau` | Fiche d'un domaine — Instructions / Documents / Sujets | hors-nav |
| `/planning` | Calendrier, vue mois | hors-nav |
| `/recherche` | Recherche transverse | hors-nav |
| `/relvo` · `/relvo/historique` | **Échange avec Relvo**, plein écran | bouton du header |
| `/(auth)/*` | Tunnel d'authentification | — |

**Navigation** : barre d'onglets basse, **cinq entrées**, fixe, sur fond violet. L'accès à Relvo
est un bouton **en haut à droite du header**, présent sur toutes les pages ; les boutons de page
se posent à sa gauche.

⚠️ **`/messages` et `/messages/[id]` existent encore dans le code** alors que la conception les a
remplacées par `/conversations`. À retirer.

## Invariants produit

> **Domicile : [`conception/01-principes.md`](conception/01-principes.md) §14.** Ils ne sont
> **pas recopiés ici**, volontairement : une copie diverge. **Les lire avant tout arbitrage de
> périmètre ou de modèle.** Aucun code ne doit les contredire.
>
> ⚠️ **Leur numérotation est citée dans le code en une vingtaine d'endroits.** Un numéro n'est
> jamais réattribué.

## Conventions

- **TypeScript partout.** Les énumérés découlent du schéma.
- **Server Components par défaut**, directive client ciblée.
- **Validation aux frontières**, identifiants opaques.
- **Doc et code dans le même commit** — nécessaire, **pas suffisant** : voir `PITFALLS.md` #20 et
  la [Definition of Done](backlog/definition-of-done.md).
- **🔒 Réflexe registre de composants — le seul piège recopié ici, parce qu'il se déclenche à
  chaque session et AVANT toute écriture de composant.** Dès qu'un composant graphique doit être
  envisagé, la première action est **toujours** d'interroger le registre :
  1. **Chercher** dans le registre.
  2. **Trouvé** → l'installer, puis l'adapter au thème. Ne pas le réécrire.
  3. **Partiellement couvert** → **composer** à partir des primitives existantes.
  4. **Absent** (dernier recours) → sur mesure, avec les conventions du registre.

  Créer une primitive à la main alors qu'un équivalent existe est une **erreur de process**, pas
  un choix esthétique.

## Pièges

> **Domicile : [`PITFALLS.md`](PITFALLS.md).** Chaque entrée a coûté une session de débogage
> réelle. Les lire **avant** de dérouler un chantier qui les touche, pas après.

## Commandes

```bash
pnpm dev             # app web
pnpm typecheck       # types
pnpm lint            # eslint
pnpm test            # tests d'intégration
pnpm build           # ⚠️ « ƒ Proxy (Middleware) » DOIT apparaître (#5b)
pnpm db:start        # Postgres local
pnpm db:migrate      # nouvelle migration
pnpm db:generate     # ⚠️ après TOUTE migration (#33)
pnpm db:seed         # jeu de démonstration
```

Déploiement : pousser sur la branche de production. **Un seul déployable.**
