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

## Où on en est

- [ ] Tranche 1 — l'arbre existe.
- [ ] Tranche 2 — on range.
- [ ] Tranche 3 — Relvo range et parle en dossiers.
