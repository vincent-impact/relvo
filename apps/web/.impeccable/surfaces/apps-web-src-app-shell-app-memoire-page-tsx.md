---
version: 1
slug: "apps-web-src-app-shell-app-memoire-page-tsx"
primary_target: "apps/web/src/app/(shell)/(app)/memoire/page.tsx"
related_targets: ["apps/web/src/app/(shell)/(app)/memoire/[id]/page.tsx"]
---

# Surface : la page Dossiers et la fiche d'un dossier — mode Operate, code-led

Portée : `/memoire` (l'arbre), `/memoire/[id]` (un dossier), la feuille « Ranger dans… ».
Public : dirigeants food et bâtiment, debout ou posés. Tâche : voir l'arbre de ses dossiers
d'un coup, entrer dans un dossier, y ajouter, ranger un sujet. Preuves : Tasty Crousty. La
décision vit dans `backlog/ecarts-et-propositions.md`, « Un sujet se range dans un dossier »,
tranchée sur maquettes (trois structures, une retenue) ; le chantier dans
`backlog/sprints/2026-10-m27-dossiers-et-sujets.md`.

## Direction contract

THESIS: L'arbre déplié : une carte, tout l'arbre, Général en tête — ce qu'un explorateur de
fichiers montre, dans le monde « Lettrage d'artisan ». Refuse la liste à plat où la racine est
une ligne parmi d'autres, et la carte de régions teintées.

OWN-WORLD: Celui de `DESIGN.md`, inchangé : ciel, cartes blanches à filet, bande de premier
niveau sur la tranche, chiffres condensés, dock noir au disque violet. Ce que la surface ajoute
au vocabulaire : le trait de couleur qui relie un dossier à ses fils, le triangle rond sur
`fond-puce`, la bande pointillée de « Sans dossier », la tête de carte sur `fond-enfonce`.

STORY: Le dirigeant lit son arbre comme une table des matières, replie ce qui l'encombre,
entre dans un dossier, y lit la description que Relvo utilise pour ranger, passe d'un onglet à
l'autre (Dossiers · Sujets · Instructions · Connaissances), ajoute depuis la première ligne de
l'onglet, et range un sujet d'un glissement de ligne.

FIRST VIEWPORT: Ciel « Dossiers / Vos sujets, rangés » ; une carte qui chevauche le ciel :
Général en tête, puis les branches (triangle à gauche, bande, nom, sous-ligne, compte, chevron),
« Sans dossier » au pied, « Ajouter un dossier dans Général » en dernier ; le dock. Action
primaire : entrer dans un dossier (la ligne).

FORM: « L'arbre déplié », candidate 2 de la liste de sept structures (ordre de résonance),
tirée par le dé avec la carte (7) et l'explorateur (4) ; seed c000e07e. Choisie par le dirigeant
parce qu'elle seule sépare la vue générale de la vue d'un dossier ; précisée ensuite par lui :
deux gestes séparés sur la ligne, description du dossier en tête de fiche, quatre onglets à
icône avec un ajout chacun, feuille « Ranger dans… » plutôt qu'un glisser-déposer.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, DESIGN.md, and every shipping raster carrying its provenance
