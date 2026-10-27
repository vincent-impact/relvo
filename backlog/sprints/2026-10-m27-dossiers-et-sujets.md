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

**Livré.**
- « sujet » partout où le dirigeant lisait « affaire » : l'interface (onglet du dock, indicateurs
  « ouverts · validés · fermés », fiches, états vides, toasts, diapositives), les phrases de
  Relvo (nouvelles, brief, blocs de l'échange, prise en main), les titres du journal et les
  erreurs du domaine, les champs client des épiques publiques (le journal du client les publie),
  les tests qui citent ces textes. Balayage outillé avec les accords (`un sujet ouvert`, `ce
  sujet`, `aucun sujet`, participes et adjectifs au masculin), relu sur le diff ; les
  identifiants du code gardent leurs noms, les étiquettes de type de l'échange
  (`affaire-creee`, `affaire-rangee`…) aussi, parce que l'historique local des appareils les
  porte.
- « Dossiers » à la place de « Mémoire » : l'entrée du menu (icône dossier), le titre et la
  ligne du dessous de la page (« Vos sujets, rangés »), la diapositive de première connexion,
  les libellés de l'échange (« Voir dans les Dossiers », « Je cherche dans vos dossiers ») et
  ses réponses de prise en main ; les descriptions d'outils parlent des dossiers.
- « Connaissances » à la place de « Documents » pour les fichiers d'un dossier (onglet, compte
  sur la ligne, état vide). Les pièces jointes d'un sujet restent des documents.
- Le dock : l'onglet « Sujets » porte une corbeille à courrier ; le dossier reste le dessin des
  dossiers.
- Le socle des consignes ne force plus « affaire » : la règle du mot ne garde que « dossier »,
  et dit que « sujet » est aussi le mot du dirigeant. Les phrases rendues tautologiques par le
  balayage (« pas de second sujet pour la même affaire ») sont récrites (« pour ce qui est déjà
  suivi »). Le budget du socle ne bouge pas.
- La conception récrite en place (`00` à `05`, le design system, `uml.mermaid`), `CLAUDE.md`,
  `PRODUCT.md`, `DESIGN.md`. L'invariant 16 nomme les onglets d'aujourd'hui (Instructions /
  Connaissances / Sujets) ; les quatre onglets arrivent avec la tranche 3. L'historique n'est
  pas récrit.

**Vérification.** Typage, lint, les 234 tests du domaine et les 213 de l'application ;
l'évaluation de l'échange sur ses 23 cas, 23 réussis (« Mes affaires avec Karim » et « Range
l'affaire… » restent compris : le dirigeant peut dire l'un ou l'autre) ; rendu headless de
Dossiers, Sujets et de l'accueil.

**Piège vu.** Un balayage de mot qui change le genre ne se fait pas en une passe : les
déterminants (`une affaire` → `un sujet`) consomment le mot avant que les accords postposés
(`affaire ouverte`) ne le voient. Deux passes, puis une relecture du diff par motif (adjectifs
en -ée, -ie, -ue, -te ; `toutes les` ; `est-elle`).

## Tranche 2 — « L'arbre » (M27.2)

**Livré.**
- La page Dossiers est **une carte, tout l'arbre** (`components/memoire/folder-tree.tsx`) :
  Général en tête de carte sur fond enfoncé (« la racine — tout est dedans », ses instructions
  et connaissances comptées, la ligne entre dans Général), puis les dossiers en ordre d'arbre.
  Chaque branche porte **deux gestes séparés** : le triangle à gauche (rond de 26 px, 44 px de
  frappe) replie ou déplie, la ligne entière entre (le chevron à droite le dit). Pas de
  triangle sans dossier dessous ; un trait de la couleur du premier niveau relie un dossier à ses
  fils ; le compte de sujets ouverts au bout, ses fils compris, et un zéro ne s'écrit pas.
- L'état replié vit sur l'appareil (`localStorage`, clé `relvo:dossiers:replies`), lu par
  `useSyncExternalStore` : le serveur et la première peinture disent « tout déplié », puis
  l'appareil impose ses plis — ni écart d'hydratation, ni `setState` dans un effet (le lint
  le refuse).
- « Sans dossier » au pied, bande pointillée, seulement s'il y en a : la page Sujets reçoit
  `?dossier=aucun` et une puce « Sans dossier » (`feed-domain-bar.tsx`, `SANS_DOSSIER`) ; le
  cache de la page porte le compte (`cachedMemoire.unfiledOpenSubjects`, `CACHE_V` v17).
- La zone « Votre entreprise » quitte la page : les instructions du compte sont celles de
  Général, on les lit en entrant dans Général.

**Vérification.** Typage, lint ; rendu headless de la page en clair et en sombre émulé (l'arbre
de démonstration à trois niveaux : Fournisseurs › Kiloutou › Agence de Narbonne), de la page
Sujets filtrée « Sans dossier » ; console propre.

## Tranche 3 — « La fiche » (M27.3)

**Livré.**
- La fiche d'un dossier s'ouvre sur **sa description** (`components/memoire/folder-description.tsx`) :
  la première carte sous le ciel, signée « Relvo s'en sert pour ranger les sujets ici », le
  crayon ouvre une boîte à une phrase (500 caractères) ; quand elle manque, la carte est une
  invite en pointillé « Décrire ce dossier ». Le formulaire de création la demande aussi,
  facultative. Général n'en a pas : il est la racine.
- **Quatre onglets à icône** (`dossier-tabs.tsx`, le mode `iconOnly` de `SegTabs` : l'icône, le
  mot à 11 px, le compte en badge), Dossiers · Sujets · Instructions · Connaissances ; la fiche
  s'ouvre sur Sujets, Général sur Instructions et sans Sujets. Le serveur passe la clé de
  l'onglet, le composant client la change en dessin — une fonction ne traverse pas la frontière
  serveur/client (l'erreur l'a rappelé au premier rendu).
- L'onglet Dossiers est **l'arbre du dossier** (`FolderTree` généralisé : niveau relatif, racine
  facultative, ajout en tête ou en pied), même triangle, même ligne ; au dernier niveau, il dit
  qu'on n'y range plus de dossier.
- **Un ajout en première ligne de chaque onglet** : « Ajouter un dossier ici » (la page de
  création, dans ce père), « Ajouter un sujet ici » (`/sujets/nouveau?dossier=` : le dossier
  pré-rempli, le retour y ramène), « Ajouter une instruction » (la ligne passe en tête de la
  liste). Pas d'ajout sur Connaissances tant que rien ne se dépose (tranche 5) : un contrôle
  sans effet se retire.
- La zone « Dans ce dossier » du ciel disparaît : l'arbre vit dans son onglet.

**Vérification.** Typage, lint ; rendu headless de Fournisseurs sur ses quatre onglets, de
Général, de Kiloutou (deux niveaux sous Général), du nouveau sujet pré-rangé ; console propre.

## Où on en est

- [x] Tranche 1 — « Le mot »
- [x] Tranche 2 — « L'arbre »
- [x] Tranche 3 — « La fiche »
- [ ] Tranche 4 — « Ranger dans… »
- [ ] Tranche 5 — « Déposer »
