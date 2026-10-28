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

## Tranche 4 — « Ranger dans… » (M27.4)

**Livré.**
- La feuille `components/memoire/ranger-dans-sheet.tsx` (la primitive `Sheet` du registre, côté
  bas, poignée, rayon de feuille, ombre de feuille) : **le même arbre** que la page Dossiers,
  mêmes triangles et même état replié (`useRepliesDossiers`, exporté de l'arbre), le dossier
  actuel cerclé et marqué « ici », Général grisé pour un sujet (invariant 17) ou choisissable
  « à la racine » pour un dossier, « Sans dossier » en pied pour un sujet, les dossiers que
  l'arbre refuse grisés. Un tap choisit et ferme.
- **Déclencheur 1** : dans l'onglet Sujets d'un dossier, la ligne glissée vers la droite révèle
  « Ranger » (`sujets-rangeables.tsx`, le `SwipeRow` du produit, ton `brand` — le geste de
  l'utilisateur, jamais le violet de Relvo) ; on lâche, la ligne revient, la feuille s'ouvre. Un
  tap sur la ligne ouvre la fiche. Le rangement passe par `updateSubjectAction` et un toast
  « Annuler » le défait. Sur la page Sujets, les gestes restent valider et fermer.
- **Déclencheur 2** : le dossier dans le ciel de la fiche d'un sujet
  (`subject-folder-eyebrow.tsx`) ouvre la feuille à la place de la boîte centrée à liste plate ;
  même toast, même annulation.
- **Déplacer un dossier** : dans le crayon, « Rangé dans » est une ligne qui ouvre la même
  feuille, Général choisissable, lui-même, ses fils et les pères trop profonds grisés ; le
  déplacement se fait à l'enregistrement, comme avant.
- Au passage : le crayon recevait comme père l'identifiant de Général là où ses cibles disent
  « nul » pour la racine — aucune puce n'était jamais active sous Général. La fiche passe
  désormais le père tel que la feuille le lit.

**Vérification.** Typage, lint ; rendu headless de la feuille ouverte depuis la fiche d'un sujet
et depuis le crayon d'un dossier ; console propre. Le glissé ne se capture pas en headless : le
composant est celui des lignes fermées de la page Sujets, déjà vérifié au téléphone.

## Tranche 5 — « Déposer » (M27.5)

**Livré.**
- « Ajouter une connaissance », première ligne de l'onglet Connaissances
  (`components/memoire/deposer-connaissance.tsx`) : le fichier part du navigateur vers le
  stockage **en direct** (invariant 19 ; `api/uploads`, scope `knowledge`, l'URL signée de
  M4.3), puis `deposerConnaissanceAction` l'inscrit dans le dossier. Deux gardes côté serveur :
  la clé est celle d'un objet du compte (le préfixe signé), et l'objet existe à la taille lue
  (`head`). PDF, images, texte ; le serveur dit le refus.
- Le domaine : `createDocument` (`domain/knowledge.ts`), kind `file`, état **`pending`** —
  nouvelle valeur de `AbsorptionStatus` (migration `20261027190000_m27_connaissance_deposee`,
  additive) : une connaissance déposée est **à lire**, hors des prompts tant que Relvo ne l'a
  pas lue (la couche Domaine ne charge que `read`). Journal : « Connaissance « x » déposée ».
  Test d'intégration `test/connaissances.test.ts`.
- La ligne d'une connaissance dit son état : « À lire » (pointillé), « Lu » (le signe de
  Relvo), « Écarté ». L'état vide invite à déposer.
- M11.1 est livré par cette tranche ; **la lecture** du dépôt par Relvo (copie d'inférence,
  étiquette, résumé) reste M11.

**Vérification.** Typage, lint, les tests du domaine (le catalogue du schéma, les dossiers, la
connaissance déposée) et ceux de l'application ; rendu headless de l'onglet Connaissances ; le
dépôt lui-même se vérifie en production, sur un compte réel, avec le stockage.

## Relecture de finition

La relecture d'impeccable (le relecteur de finition, contre le contrat de direction du brief de
surface et `DESIGN.md`) a jugé la construction fidèle et rendu cinq correctifs, tous appliqués :
les deux dialogues de dossier passaient par des alias d'avant M19 (`border`, `red-600`, une
graisse 700, un bouton à coins ronds) — ils prennent `libelle`, `filet`, `urgent`, la pilule ;
dans l'onglet Sujets d'un dossier, chaque ligne redisait le nom du dossier en ligne du dessus —
elle n'écrit plus que ce qui descend sous lui ; la feuille « Rangé dans… » grisait tout sans
dire pourquoi quand un dossier ne peut vivre qu'à la racine — elle le dit ; l'état vide des
sujets d'un dossier parle dans la voix de Relvo, sous la carte. `DESIGN.md` est récrit depuis le
code livré (l'arbre, les quatre onglets, la feuille, la description, le dock). Le balayage du
mot avait laissé quatre élisions fautives devant une majuscule (« l'Sujet ») : corrigées.

## Où on en est

**M27 terminée et close.** Livrée le jour de son ouverture, en cinq commits poussés et
déployés, plus la relecture de finition ; **testée et validée en production par le dirigeant sur
son compte le 2026-10-28** : l'arbre de la page Dossiers (replier, entrer), la fiche d'un dossier
(décrire, les quatre onglets, les ajouts), ranger un sujet d'un glissement et depuis sa fiche,
déposer une connaissance avec le stockage réel. **Suivant : M24** (dix boîtes par compte), puis
R9 à R12 du sprint de recette. Hors chantier : la lecture par Relvo d'une connaissance déposée
(M11).

- [x] Tranche 1 — « Le mot »
- [x] Tranche 2 — « L'arbre »
- [x] Tranche 3 — « La fiche »
- [x] Tranche 4 — « Ranger dans… »
- [x] Tranche 5 — « Déposer »
