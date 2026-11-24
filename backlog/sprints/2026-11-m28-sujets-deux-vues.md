# Chantier « Sujets : une page, deux vues » — M28, 15 novembre 2026

## Démarrage à froid — à lire en premier

**Où on en est.** L'alpha a parlé : l'application est jugée complexe, l'arborescence des
dossiers est saluée. Le dirigeant a tranché le 2026-11-15 (`ecarts`, « Sujets : une page, deux
vues ») : une seule porte, la page Sujets, avec deux vues. L'épique est
`M28-sujets-deux-vues.md`. **L'épique est terminée** : les quatre items (M28.1 à M28.4) sont
livrés, poussés et validés par le dirigeant, qui l'a fermée le 2026-11-24 — avec la recette de
l'alpha (`2026-10-recette-alpha.md`). Ce qui vient ensuite est au backlog : la fin de M24 (la
vérification Google, puis la migration des boîtes), M13.6, M25.

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

- **M28.4 — la fiche qui glisse** (livré). Les transitions de vue de React, branchées sur la
  navigation par `experimental.viewTransition` (`next.config.ts`). `layout/ecran-transition.tsx`
  enveloppe chaque écran (`Screen`, le corps de la fiche d'un sujet, son squelette) et nomme
  les deux types : `ECRAN_POUSSE` — posé sur l'ouverture d'un sujet (`SwipeableSubject`,
  `SwipeableDoneSubject`) et sur le nom d'un dossier de l'arbre — et `ECRAN_RETOUR`, posé sur
  la flèche retour de `RelvoHeader`, donc sur **tout** écran poussé. Le dessin est dans
  `globals.css` (« Transition d'écran ») ; le dock a son propre calque
  (`viewTransitionName: "dock"`) pour rester immobile. Vu en local, animations ralenties,
  dans Chrome ; **jamais sur iOS** — Safari sait faire depuis sa version 18, et un navigateur
  qui ne sait pas change de page comme avant. Le retour au geste du système ne porte pas de
  type : il ne s'anime pas. ⚠️ Vérifier un changement de `globals.css` en local demande de
  vider `.next/dev` (`PITFALLS` #76) — je l'ai repayé ici.
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
