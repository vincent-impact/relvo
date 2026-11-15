# Chantier « Sujets : une page, deux vues » — M28, 15 novembre 2026

## Démarrage à froid — à lire en premier

**Où on en est.** L'alpha a parlé : l'application est jugée complexe, l'arborescence des
dossiers est saluée. Le dirigeant a tranché le 2026-11-15 (`ecarts`, « Sujets : une page, deux
vues ») : une seule porte, la page Sujets, avec deux vues. L'épique est
`M28-sujets-deux-vues.md`. **La tranche 1 (M28.1) est livrée et poussée ; le dirigeant l'essaie
sur son iPhone avant la tranche 2.** Ne pas enchaîner sans son retour.

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

**Ce qui reste.**

- **M28.2 — l'ajout en fin de branche.** Une feuille composée sur `ui/sheet.tsx` (comme
  « Ranger dans… ») : bascule Un sujet / Un dossier, un nom, Créer — `createSubjectAction`,
  `createFolderAction`. La ligne « Ajouter dans <dossier> » en **gris** (le violet est à ce qui
  a bougé). Un dossier vide se déplie alors (il contient sa ligne). Le « + » du ciel et le
  bouton du pied ouvrent la même feuille ; aujourd'hui ils mènent aux pages de création.
- **M28.3 — le glisser-déposer.** dnd-kit (déjà au Calendrier ; un `id` stable, `PITFALLS`
  #62), maintien d'un tiers de seconde au doigt, tirer à la souris ; `moveFolderAction`,
  `updateSubjectAction` ; les interdits calculés comme les `exclus` de la feuille ; toast avec
  Annuler (`sujets-rangeables.tsx` en a la forme). La conception (`04` §Folder) se récrit à ce
  moment-là.

**Laissé ouvert par le dirigeant** : les instructions par dossier ont-elles encore un sens ?
Rien n'est retiré ; à regarder à l'usage.
