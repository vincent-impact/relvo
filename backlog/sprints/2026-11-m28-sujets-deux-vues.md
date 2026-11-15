# Chantier « Sujets : une page, deux vues » — M28, 15 novembre 2026

## Démarrage à froid — à lire en premier

**Où on en est.** L'alpha a parlé : l'application est jugée complexe, l'arborescence des
dossiers est saluée. Le dirigeant a tranché le 2026-11-15 (`ecarts`, « Sujets : une page, deux
vues ») : une seule porte, la page Sujets, avec deux vues. L'épique est
`M28-sujets-deux-vues.md`. **Les trois tranches (M28.1, M28.2, M28.3) sont livrées et poussées ;
les deux premières sont validées par le dirigeant, il essaie le glisser-déposer sur son
iPhone.** Reste M28.4 (la fiche qui glisse), à cadrer avec lui.

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
- Le glisser-déposer (M28.3) : `lib/arbre-depot.ts` dit ce qui se dépose où (pur, testé dans
  `apps/web/test/arbre-depot.test.ts`) ; `sujets-arbre.tsx` porte le geste — dnd-kit, `id`
  stable, souris à 6 px, doigt à 320 ms de maintien, collision au pointeur, ouverture d'un
  dossier replié après 700 ms de survol, miniature décalée du doigt. Les lignes prenables
  coupent la sélection de texte et le menu d'aperçu d'iOS (`-webkit-touch-callout`).

**Ce qui reste.**

- **M28.4 — la fiche qui glisse** (demandé à l'essai de la tranche 1). La fiche d'un sujet
  n'a aujourd'hui aucune entrée animée (`Screen entree` n'y est pas posé), celle d'un dossier
  entre de 16 px (`.entre-ecran`). Le dirigeant veut l'entrée pleine de la droite ET la sortie
  inverse au retour : la sortie demande les View Transitions du routeur (ou une transition
  tenue côté client) — à cadrer avant d'écrire, et à éprouver sur iOS (geste de retour du
  bord, PWA).
- **Essai de la tranche 2 par le dirigeant** : le clavier montait par-dessus la feuille à
  l'ouverture — le champ ne prend plus le focus de lui-même ; touché, le clavier pousse la
  feuille, c'est bon. Les invites de l'arbre (« Ajouter dans… », « Nouveau dossier », « Tout
  replier ») repassent en violet : **ce qui se touche est violet**, c'est le code de Relvo.

- **Essai de la tranche 3 par le dirigeant, et ce qui a été repris** : (1) la miniature se
  recalait sous le doigt à la prise — elle est maintenant la ligne elle-même, à sa place et à sa
  taille (aucun modificateur) ; (2) elle restait bloquée dès que la page défilait — elle est
  rendue en portail sur `document.body`, hors de la zone qui défile ; **cause présumée, non
  reproduite avant correction** (un ancêtre animé en `transform` sert de bloc conteneur au
  `position: fixed` de la miniature) : si son essai confirme, l'écrire en piège ; (3) le
  balayage manquait dans l'arbre — les lignes de sujet y sont enveloppées de
  `SwipeableSubject` / `SwipeableDoneSubject`, gelés par `gele()` tant qu'un glisser tient la
  ligne ; (4) le vibreur ne répond pas sur son iPhone — sans gravité, laissé. La cible est
  jugée facile à viser.

**Laissé ouvert par le dirigeant** : les instructions par dossier ont-elles encore un sens ?
Rien n'est retiré ; à regarder à l'usage.
