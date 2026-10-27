# Chantier « Les dossiers » — M23, 27 octobre 2026

## Démarrage à froid — à lire en premier

**Où on en est.** La recette de l'alpha (`2026-10-recette-alpha.md`) a livré sa première vague
et enregistré la deuxième ; M7 et M22 sont closes. La deuxième vague a tranché la première
épique à livrer : **les domaines deviennent des dossiers, en arbre** (`ecarts`, « Les domaines
deviennent des dossiers, en arbre » ; épique `M23-dossiers.md`). Ce fichier est le plan de M23
et le « où on en est » du dépôt le temps du chantier. Ensuite : M24 (dix boîtes par compte),
puis R9 à R12 du sprint de recette si elles ne sont pas livrées entre-temps.

**Ce qui existe et ne se refait pas.** `Folder` (schéma, `domain/folders.ts`) : slug, couleur,
icône, `is_default` pour Général, `is_active`. Ce qui le référence : `folder_id` sur Subject,
Message, KnowledgeDocument, RelvoQuestion ; `default_folder_id` sur Contact ; `folder_ids[]`
sur Channel. La couche Domaine du contexte (`server/ia/contexte/couches.ts`, `coucheDomaine`),
chargée par `loadAccountProjection` (`domain/structuration.ts`) : Général dans la couche
Compte, le domaine du sujet dans la couche Domaine. Les domaines typiques de la prise en main
(`domain/prise-en-main.ts`, `questions.ts`), les domaines proposés par le courrier
(`listFolderProposals`, `createFolderFromProposal`). La Mémoire (`app/(shell)/(app)/memoire/`,
`components/memoire/`, `cachedMemoire`), la palette (`lib/folders.ts`). Les outils de
l'échange prennent un domaine par son nom (`echange/outils.ts`).

**Ce qui est tranché avec le dirigeant le 2026-10-27, avant la première migration** (à ne pas
rouvrir) :

- **Profondeur : trois niveaux sous Général**, tenue par un test du domaine. Général › Clients ›
  Franchises › Narbonne est le chemin le plus long. Au-delà, création et déplacement sont refusés
  en langage client.
- **Un dossier est un dossier, à n'importe quel niveau.** Le dossier par défaut d'un contact, les
  dossiers d'un canal, la portée d'une question de Relvo acceptent toute profondeur. **La portée
  est la chaîne des pères** : un contact rangé dans Général › Franchise › Montpellier appartient à
  Général, à Franchise et à Montpellier — jamais à un frère ni à un cousin (Général › Fournisseur
  › Montpellier). Filtrer un dossier, c'est lui et ses fils.
- **Le Calendrier et ses pastilles lisent le premier dossier sous Général** de l'affaire : une
  affaire dans Clients › Franchises › Narbonne porte la couleur et le logo de Clients. La bande
  des cartes et des lignes de tâche suit la même règle.
- **L'invariant 17 reste vrai** : Général ne contient jamais d'affaire. Quand un dossier de
  premier niveau est supprimé, ses instructions et ses documents remontent dans Général, ses
  affaires redeviennent « sans dossier ».

**Le découpage**, en tranches verticales, chacune livrée, documentée et poussée :

1. **« L'arbre existe »** — M23.1 et M23.2 : `parent_id`, slug unique par père, profondeur bornée
   par un test, migration qui pose les domaines sous Général, chaîne d'héritage dans la couche
   Domaine, test d'intégration sur trois niveaux. Aucun écran.
2. **« On range »** — M23.3 et M23.4 : la Mémoire en arborescence (entrer, créer dans, renommer,
   déplacer avec le contenu, supprimer en remontant chez le père), la fiche d'une affaire qui
   choisit un chemin, la page Affaires qui filtre un dossier et ses fils, le Calendrier au premier
   niveau.
3. **« Relvo range et parle en dossiers »** — M23.5, M23.6, M23.7 : classement et propositions en
   chemins, outils de l'échange, le mot « dossier » dans l'interface, le script de la prise en main
   et les consignes ; `conception/` récrite en place.

## Tranche 1 — « L'arbre existe » (M23.1, M23.2)

**Livré.**
- `Folder.parent_id` (migration `20261027140000_m23_dossiers_arbre`) : les domaines existants
  passent sous Général, un compte sans Général en reçoit un, le slug devient unique **par père**
  (`folders_account_id_parent_id_slug_key`), seul Général est sans père (`folders_parent_requis`,
  citée dans `02`). Le père n'est jamais supprimé en cascade (Restrict) : le domaine remonte les
  fils avant.
- `domain/folders.ts` : l'arbre se lit **d'un coup** (`loadFolderTree`) et se parcourt en
  mémoire — `chaineDe` (racine en premier), `profondeurDe`, `cheminDe` (« Clients › Franchises
  › Narbonne », sans Général), `premierNiveauDe` (la couleur du Calendrier), `sousArbreDe` /
  `folderSubtreeIds` (la portée : lui et ses fils). `PROFONDEUR_MAX = 3`, tenue par
  `test/dossiers.test.ts`. `createFolder` prend un `parentId` (sinon Général) ; `moveFolder`
  (journalisé `folder_moved`) refuse la racine, soi-même, un fils, un frère de même slug, une
  profondeur dépassée ; `deleteFolder` remonte chez le père ses dossiers (slug suffixé en cas de
  doublon), instructions, documents, affaires, messages classés, contacts, canaux — **sauf**
  quand le père est Général : affaires, messages et contacts redeviennent « sans dossier »
  (invariant 17). Les questions de Relvo sur le dossier tombent avec lui.
- **L'héritage** (`loadAccountProjection`) : la couche Domaine est la **chaîne** du sujet,
  Général exclu (il reste en couche Compte) ; chaque instruction et document dit son dossier ;
  ordre = chaîne puis nom, déterministe pour le cache. `DomaineContexte.chemin` et
  `coucheDomaine` : « # Domaine : Clients › Franchises › Narbonne », la phrase d'héritage, et
  « (dossier Clients) » sur ce qui vient d'un père. Un domaine de premier niveau rend
  exactement ce qu'il rendait.
- `02` (Folder, table des contraintes), `04 §10` (Folder), `05 §10.1` et §10.2 récrits en
  place — avec le mot « domaine », que la tranche 3 remplace partout.

**Vérification.** `pnpm typecheck`, `pnpm lint`, suites du paquet et de l'application vertes ;
migration appliquée sur la base locale et recomptée (les six domaines de démonstration sous
Général) ; `migrate diff` sans dérive ; pages Mémoire, Affaires, fiche d'affaire et Calendrier
rendues en local après la migration.

## Tranche 2 — « On range » (M23.3, M23.4)

**Livré.**
- **La règle de présentation, en un seul endroit** (`presentationDe`, `domain/folders.ts`) :
  une affaire porte le **chemin** de son dossier (« Fournisseurs › Kiloutou »), et les clés de
  logo — slug, couleur, icône — de son **premier niveau** sous Général. Toutes les projections
  passent par elle : `enrichSubjects` (lignes d'affaires, `folderPath`, `folderChainIds`),
  `enrichTasks` (rail des tâches), le brief (affaires en attente), le Calendrier (mois), le fil
  d'une conversation (cordon et bandeau d'écoute), les options de sujets de la modale de tâche.
  `listFolderOptions` / `arbreOrdonne` : les dossiers en ordre de lecture (profondeur d'abord,
  frères par nom) avec chemin, père, profondeur — ce que lisent les listes de choix et la Mémoire.
- **La Mémoire en arborescence** : `/memoire` liste le **premier niveau** (Général en dernier,
  pour ses documents) ; `FolderRow` et `AddFolderRow` (`components/memoire/folder-row.tsx`)
  sont la ligne et l'invite partagées ; un dossier (`/memoire/[id]`) porte sa chaîne dans le
  ciel (fil d'Ariane, primitive `breadcrumb` du registre — piège #52 rejoué : paquet `cn`
  fantôme retiré), ses **sous-domaines** avec « Ajouter un domaine ici » (tant que la
  profondeur le permet), puis les onglets ; l'onglet Affaires compte **lui et ses fils** ; les
  onglets ne chevauchent le ciel que lorsque rien ne les précède (`FeedTabs overlap`). La
  flèche remonte chez le père. `/memoire/nouveau?dans=<id>` crée dedans. Le dialogue du crayon
  gagne **« Rangé dans »** (Général ou tout père que l'arbre accepte : ni lui-même, ni un fils,
  ni une profondeur dépassée, hauteur du sous-arbre comprise — `moveFolderAction`) et
  **« Supprimer ce domaine »** (confirmation qui nomme où remonte le contenu ; les affaires
  d'un dossier de premier niveau redeviennent sans domaine).
- **Ranger une affaire** : l'eyebrow de la fiche et les listes de choix (fiche, création,
  dialogue de création depuis une conversation) proposent les dossiers **en ordre d'arbre avec
  leur chemin** ; Général n'y est plus (invariant 17).
- **La page Affaires** filtre par **dossier et ses fils** (`?dossier=<id>`, `folderChainIds`) ;
  la barre de puces montre « Tous », les pères du dossier choisi, lui-même, puis ses fils qui
  ont une affaire — on descend puce après puce, et on remonte par un père. L'en-tête de filtre
  dit le chemin.
- `cached.ts` : `CachedFolderRow` porte père, profondeur, chemin, nombre de fils et les
  affaires ouvertes du sous-arbre ; `FolderChip` porte l'identifiant, le chemin, le père ;
  `cachedFolderNames` (inutilisé) retiré ; version de cache `v16`.

**Vérification.** Typecheck, lint, suites du paquet (`dossiers.test.ts` : présentation,
ordre de l'arbre, chaîne sur une affaire enrichie) et de l'application vertes. Rendu headless
390 × 844, clair et sombre émulé, sur le compte démo avec un arbre posé par les fonctions du
domaine (Fournisseurs › Kiloutou › Agence de Narbonne) : Mémoire, dossier Fournisseurs,
dossier Kiloutou (fil d'Ariane, sous-domaines, onglets), Affaires filtrées sur Fournisseurs
(puces Fournisseurs puis Kiloutou, chemins sur les lignes), fiche d'une affaire (chemin dans le
ciel), Calendrier, création « dans Fournisseurs › Kiloutou », dialogue du crayon et sa
confirmation de suppression ; console sans erreur (un `<li>` dans un `<li>` du fil d'Ariane
cassait l'hydratation — les séparateurs sont des frères).

## Où on en est

- [x] Tranche 1 — l'arbre existe.
- [x] Tranche 2 — on range.
- [ ] Tranche 3 — Relvo range et parle en dossiers.
