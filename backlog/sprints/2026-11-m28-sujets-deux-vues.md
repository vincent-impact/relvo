# Chantier « Sujets : une page, deux vues » — M28, 15 novembre 2026

## Démarrage à froid — à lire en premier

**Où on en est.** L'alpha a parlé : l'application est jugée complexe, l'arborescence des
dossiers est saluée. Le dirigeant a tranché le 2026-11-15 (`ecarts`, « Sujets : une page, deux
vues ») : une seule porte, la page Sujets, avec deux vues. L'épique est
`M28-sujets-deux-vues.md`. **Les tranches 1 et 2 (M28.1, M28.2) sont livrées et poussées ; la
tranche 1 est validée par le dirigeant, il essaie la tranche 2 sur son iPhone avant la
tranche 3.** Ne pas enchaîner sans son retour.

**La maquette** : planche B de l'artefact du dirigeant (« une carte par dossier »). Elle fait foi
sur les flux, les libellés et la disposition ; pas sur le rendu, pas sur les volumes. Elle n'a
jamais été essayée sur un téléphone — le glisser-déposer au doigt surtout.

**Ce qui existe après la tranche 1, et ne se refait pas.**

- `domain/queries.ts` : `estNouveau`, `aBouge` (les deux règles, pures), `FRAICHEUR_JOURS`,
  `listSubjectsByStatus` (tous les sujets d'un état), et `enrichSubjects` qui rend `isNew` et
  `moved` — « a bougé » se lit dans le journal (`event_logs`, les événements de tâche dont
  l'acteur n'est pas le dirigeant). Test : `packages/db/test/sujets-bouges.test.ts`.
- `components/feed/sujets-arbre.tsx` : la vue Dossiers. `components/feed/feed-view.tsx` : les
  deux vues derrière les mêmes indicateurs. `app/(shell)/(app)/fil/page.tsx` : l'interrupteur,
  `?vue=`, le cookie `relvo-vue-sujets`.
- `hooks/use-ids-retenus.ts` : un ensemble d'identifiants retenu sur l'appareil — les branches
  dépliées de l'arbre (`relvo:sujets:deplies`), les branches repliées de la fiche d'un dossier.
- `layout/header-switch.tsx` : `retenir` pose un cookie au toucher.
- `shared/picto.tsx` : trois pictogrammes au trait, l'exception de l'arbre.
- `app/(shell)/relvo/instructions/` : les instructions de Général, dans l'échange.
- `components/feed/ajouter-dans-sheet.tsx` (M28.2) : la feuille de création, composée sur
  `ui/sheet`, `ui/tabs`, `ui/input`, `ui/button` ; `feed/bouton-ajout-ciel.tsx` : le « + » du
  ciel, qui parle à l'arbre par l'événement `relvo:sujets:ajouter`. `createSubject` pose
  `lastOpenedAt` quand c'est le dirigeant qui crée.

**Ce qui reste.**

- **M28.3 — le glisser-déposer.** dnd-kit (déjà au Calendrier ; un `id` stable, `PITFALLS`
  #62), maintien d'un tiers de seconde au doigt, tirer à la souris ; `moveFolderAction`,
  `updateSubjectAction` ; les interdits calculés comme les `exclus` de la feuille ; toast avec
  Annuler (`sujets-rangeables.tsx` en a la forme). La conception (`04` §Folder) se récrit à ce
  moment-là.

- **M28.4 — la fiche qui glisse** (demandé à l'essai de la tranche 1). La fiche d'un sujet
  n'a aujourd'hui aucune entrée animée (`Screen entree` n'y est pas posé), celle d'un dossier
  entre de 16 px (`.entre-ecran`). Le dirigeant veut l'entrée pleine de la droite ET la sortie
  inverse au retour : la sortie demande les View Transitions du routeur (ou une transition
  tenue côté client) — à cadrer avant d'écrire, et à éprouver sur iOS (geste de retour du
  bord, PWA).
- **À éprouver sur l'iPhone, tranche 2** : la feuille de création monte du bas avec le champ
  en autofocus — le clavier d'iOS peut recouvrir « Créer » ; la touche « OK » du clavier
  valide le formulaire.

**Laissé ouvert par le dirigeant** : les instructions par dossier ont-elles encore un sens ?
Rien n'est retiré ; à regarder à l'usage.
