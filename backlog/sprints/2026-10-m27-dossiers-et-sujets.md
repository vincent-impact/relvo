# Chantier « Dossiers et sujets » — M27, 27 octobre 2026

## Démarrage à froid — à lire en premier

**Où on en est.** M23 a livré l'arbre des dossiers (`2026-10-m23-dossiers.md`) et le dirigeant
l'a regardé : la page Mémoire ne montre pas un arbre, et le mot « affaire » n'est pas celui de
ses clients. Il a tranché **sur maquettes**, avant tout code (`ecarts`, « Un sujet se range dans
un dossier ») ; l'épique est `M27-dossiers-et-sujets.md`. Ce fichier est le plan de M27 et le
« où on en est » du dépôt le temps du chantier. Ensuite : M24 (dix boîtes par compte), puis R9 à
R12 du sprint de recette.

**Ce qui existe et ne se refait pas.** L'arbre (`domain/folders.ts` : `loadFolderTree`,
`chaineDe`, `arbreOrdonne`, `presentationDe`, `listFolderOptions`, `moveFolder`,
`deleteFolder`), `cachedMemoire` (`server/cached.ts`), la Mémoire (`app/(shell)/(app)/memoire/`,
`components/memoire/`), les onglets à icône de la fiche d'un sujet (`shared/seg-tabs.tsx`,
`iconOnly`), le swipe d'une ligne (`shared/swipe-row.tsx`), la feuille du registre
(`ui/sheet.tsx`), l'émission d'une URL d'upload vers le stockage (`api/uploads`, scope
`knowledge`, M4.3), le sélecteur de dossier d'un sujet dans le ciel de sa fiche
(`subject/subject-folder-eyebrow.tsx`, une boîte centrée à liste plate), `Folder.description`
(en base et dans le domaine, jamais montrée).

**Ce qui est tranché avec le dirigeant le 2026-10-27, sur maquettes** (à ne pas rouvrir) :

- **Le mot.** Une affaire redevient un **sujet** ; un sujet se range dans un **dossier**, comme
  un fichier ; la page Mémoire s'appelle **Dossiers** ; les fichiers d'un dossier sont des
  **connaissances**. Le code garde ses noms (`Subject`, `/sujets`, `/fil`, `/memoire`,
  `KnowledgeDocument`). Les consignes du modèle parlaient déjà de « sujet » : la règle du socle
  qui forçait « affaire » tombe, celle du « dossier » reste.
- **La page Dossiers** est **l'arbre déplié** : une carte, Général en tête de carte, tout l'arbre
  dessous. Deux gestes par ligne, séparés : le **triangle à gauche** déplie ou replie (44 px de
  frappe, état retenu sur l'appareil), **la ligne** entre dans le dossier. Pas de triangle sans
  dossier dessous. « Sans dossier » au pied, bande pointillée. Structures écartées : la carte
  (régions teintées), l'explorateur (arbre en haut, contenu en bas) — elles vivent dans
  l'artefact des planches, pas dans le dépôt.
- **La fiche d'un dossier** : la **description** en première carte sous le ciel (c'est elle qui
  aide Relvo à ranger ; invite en pointillé quand elle manque), puis **quatre onglets à icône**
  dans l'ordre **Dossiers · Sujets · Instructions · Connaissances** — du contenant au contenu —
  mais la fiche **s'ouvre sur Sujets**. L'onglet Dossiers est l'arbre du dossier, même mécanique
  que Général. **Un ajout en première ligne de chaque onglet** : il dit ce qu'il ajoute, et une
  longue liste ne le pousse pas sous le dock.
- **Ranger un sujet** : pas de glisser-déposer entre dossiers. Une **feuille du bas** « Ranger
  dans… » montre le même arbre (Général grisé, « Sans dossier » possible), le dossier actuel
  cerclé ; un tap range, un toast annule. Déclencheurs : **glisser la ligne vers la droite** dans
  l'onglet Sujets d'un dossier, et **le dossier dans le ciel** de la fiche d'un sujet. Sur la page
  Sujets, les gestes restent ceux d'aujourd'hui (à droite valider, à gauche fermer) : un même
  geste ne dit pas deux choses sur la même page. La même feuille déplace un dossier.
- **Conséquence** : l'icône de l'onglet « Sujets » du dock était un dossier ; elle devient une
  corbeille à courrier, le dossier reste le dessin des dossiers.

**Le découpage**, en tranches verticales, chacune livrée, documentée et poussée :

1. **« Le mot »** — M27.1 : le vocabulaire dans l'interface, les phrases de Relvo, le journal et
   les erreurs du domaine, les tests, le socle ; « Dossiers » et « Connaissances » ; le dock ; la
   conception récrite en place ; `CLAUDE.md`, `PRODUCT.md`.
2. **« L'arbre »** — M27.2 : la page Dossiers.
3. **« La fiche »** — M27.3 : description, quatre onglets, quatre ajouts.
4. **« Ranger dans… »** — M27.4 : la feuille, ses deux déclencheurs, le déplacement d'un dossier.
5. **« Déposer »** — M27.5 : l'ajout d'une connaissance.

**Méthode.** Chaque écran est rendu en headless (390 × 844, clair et sombre émulé, `PITFALLS.md`
#51) avant d'être montré ; typage, lint et tests verts avant chaque commit ; pied `Client:` ;
journal du client régénéré avant le push (#57) ; `vercel ls` jusqu'à Ready.

## Tranche 1 — « Le mot » (M27.1)

_En cours._

## Où on en est

- [ ] Tranche 1 — « Le mot »
- [ ] Tranche 2 — « L'arbre »
- [ ] Tranche 3 — « La fiche »
- [ ] Tranche 4 — « Ranger dans… »
- [ ] Tranche 5 — « Déposer »
