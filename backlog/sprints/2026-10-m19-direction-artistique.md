# Sprint « Bijou » — M19, à partir du 12 octobre 2026

## Démarrage à froid — à lire en premier

**Où on en est.** M18 a livré la disposition générale (dock à cinq places, menu latéral, accueil
en brief, Calendrier, Bilan et Usage en maquette annoncée, Mémoire) et a été fermée en `partiel`
le 2026-10-12 : sa tranche 5 (`RelvoQuestion` élargie, badge, notification — M18.9, M18.11) se
livre avec M10, qui en est le consommateur. Le dirigeant trouve l'application **lourde** et
**sans accompagnement** : ce n'est pas la place des choses, c'est leur matière, et l'absence de
prise par la main. La décision vit dans
[`../ecarts-et-propositions.md`](../ecarts-et-propositions.md), « Une direction artistique
choisie parmi quatre, avant de construire l'échange » ; le découpage dans
[`../epics/M19-direction-artistique.md`](../epics/M19-direction-artistique.md).

**Ce que ce sprint livre**, dans l'ordre des tranches : **Voir** (le brief au présent, le point
zéro, quatre directions sur planches, une décision), **Habiller** (tokens et composants
signature), **Alléger** (écran par écran), **Guider** (langage de mouvement, premiers pas),
**Clore**. **M7 tranche 10 et M10 passent après.**

### Avant la première ligne

- [x] Installer les trois skills **au niveau utilisateur**, jamais dans le dépôt (M19.11) :
      `npx ui-ux-pro-max-cli init --ai claude --global` · `npx impeccable install --global
      --providers=claude -y` · `npx skills@latest add emilkowalski/skills -g -a claude-code`
      avec **un `-s` par skill** (douze retenues : ni `animate-expo`, ni `write-swift`, ni
      `pick-ui-library`). ⚠️ Ce que les installeurs font en plus est dans `PITFALLS.md` #56 :
      extras de ui-ux-pro-max mis à la corbeille, hook d'impeccable fusionné dans
      `.claude/settings.local.json` du projet.
- [ ] Relire `PITFALLS.md` #40 (Base UI, pas Radix), #51 (l'app est claire seulement, l'iPhone
      du dirigeant est en mode sombre), #54 (barre Android), et `conception/design-system/`
      en entier : c'est ce que les directions ont le droit de contester, pas d'ignorer.
- [ ] **Registre de composants d'abord**, comme toujours.

### Quatre règles pour toute la durée du sprint

- **La disposition ne rouvre pas** (invariants 34–38). Une envie de changer un flux se note
  dans le registre des écarts et se tranche à part.
- **Les outils interviennent chacun sur une tranche**, dans l'ordre des tranches. Le mouvement
  arrive en dernier : on n'anime pas ce qu'on va encore retirer.
- **Les fichiers des outils ne sont pas de la conception** : `PRODUCT.md` et `DESIGN.md` sont
  des pointeurs, `design-system/` est ignoré par git, les directions écartées ne survivent que
  dans l'artefact des planches.
- **Doc et code dans le même commit**, pied `Client:` sur chaque `feat` et `fix`, un commit
  par écran dans la tranche « Alléger ».

### Ce qui reste ouvert, à trancher en cours de sprint

- **La bibliothèque de mouvement** : CSS et View Transitions d'abord ; `motion` seulement si
  une tranche le réclame, et alors pour tout le produit.
- **Le témoin** : si la direction retenue est la DA actuelle poussée au bout, les tranches
  « Alléger » et « Guider » se livrent quand même.
- **Ce que `mobile-native` a le droit de dire** : relecteur, jamais correcteur du viewport.
- ~~**La trace « diapositives vues »**~~ (M19.9) — **tranché par le dirigeant** : une colonne
  horodatée sur le compte, migration additive accordée en exception ; les diapositives
  n'apparaissent qu'une seule fois.

---

## Point zéro — le relevé des écrans avant M19 (M19.2)

**Conditions.** Dix-huit captures, le 2026-10-12, au format téléphone 390 × 844 (facteur 2),
**mode sombre émulé** (`PITFALLS.md` #51), compte de démonstration `demo@tastycrousty.fr`, serveur
local. Les captures vivent dans le scratchpad de la session, **jamais dans le dépôt** ; le script
(`playwright-core` sur le Chrome du poste, `colorScheme: "dark"`) se rejoue en quelques secondes.
⚠️ Le port 3000 du poste appartient à un autre projet : Relvo se lance sur `PORT=3100` **et**
`AUTH_URL=http://localhost:3100`, sinon le retour d'authentification retombe sur l'autre projet.
Le bouton à cibler est celui du formulaire mot de passe, pas le premier `submit` de la page
(« Continuer avec Google »).

**Ce que chaque écran porte** — zones · contrôles · compteurs :

| Écran | Zones, de haut en bas | Contrôles | Compteurs visibles |
|---|---|---|---|
| Accueil | Header violet (bonjour, date, panneau *Dernières nouvelles* : phrase + deux suggestions) · *Activité* trois chiffres · *Aujourd'hui* · *En attente de vous* (lignes avatar + titre + état) · dock | burger · deux suggestions · trois portes · bouton Relvo | 3 chiffres d'activité · « rien de prévu » · « 5 sujets » · drapeaux urgents |
| Menu | Feuille latérale : identité, Bilan · Mémoire · Contacts, Canaux · Profil · Préférences · Usage, Rechercher, déconnexion | 8 entrées + fermer + déconnexion | — |
| Calendrier | Header (titre, sous-titre, segmented Semaine/Mois, +) · barre KPI blanche débordante (Aujourd'hui · Rendez-vous · En retard) · rail de jours · zone *Aujourd'hui* | burger · segmented · + · 3 KPI · ~35 jours | 3 KPI dont un « 88 » rouge |
| Sujets | Header (titre, loupe, +) · barre KPI-onglets débordante (Ouverts · Validés · Fermés) · chips de domaine défilantes · compteur « 25 sujets » · panneau de lignes (tuile de domaine colorée, référence mono, badge plein Urgent/Nouveau, titre, résumé, progression) · dock | burger · loupe · + · 3 onglets · 7 chips · swipe par ligne | 25/5/0 · « 25 sujets » · x/y tâches · badges |
| Fiche sujet | Header poussé (titre, référence) · barre d'onglets débordante (tâches · conversations · documents · journal, avec compteurs) · chip de domaine · chip de contact + badge Urgent · *Résumé* (invite) · *Tâches* (panneau, rail bleu, case, date) · « Ajouter une tâche » | retour · 4 onglets · domaine · contact · cases · Répondre · ajouter | 3 · 2 · 1 · 11 · 0/3 |
| Conversations | Header (titre, « 5 conversations à trier ») · segmented débordant (Sans sujet · Suivies · Ignorées) · chips canal (Tous · E-mail · WhatsApp) · panneau de lignes (avatar ambre, titre, canal + aperçu, date, pastille non-lus) | burger · 3 onglets · 3 chips · swipe | 5 · 27 · pastilles « 1 » |
| Conversation WhatsApp | Header poussé (contact, chips canal + contact, bandeau *Suivi dans*) · bulles · composer (pièce jointe, dictée) — **le dock cède la place** | retour · contact · arrêter l'écoute · composer | — |
| Conversation e-mail | Header poussé (objet, « Relvo n'a pas encore lu ce fil », chips canal + expéditeur, Enregistrer) · message pleine largeur sur blanc | retour · voir l'interlocuteur · enregistrer | — |
| Échange | Header poussé (Relvo, « Nouvelle conversation », historique) · chip *Contexte : Accueil* · **état vide** : orbe ✦, « Comment puis-je vous aider ? », quatre invites en pointillés italiques · composer de verre violet (pièce jointe, dictée) | retour · historique · fermer le contexte · 4 invites · composer | — |
| Historique | Header poussé · carte lavande « Nouvel échange » · *Récentes* vide | retour · nouvel échange | — |
| Bilan | Header (titre, mois, segmented Mois/Tout) · bandeau ambre « chiffres de démonstration » · *Ce que Relvo a fait pour vous* six tuiles · *Où en êtes-vous* : histogramme, lignes | burger · segmented | 6 tuiles + 7 barres + lignes |
| Mémoire | Header (titre, sous-titre, +) · *Votre entreprise* : quatre instructions **en cartes séparées** + « Ajouter une instruction » · *Par domaine* : lignes avec rail | burger · + · cartes · lignes | « 4 instructions » · « 7 domaines » · compteurs par domaine |
| Contacts | Header (titre, « 20 contacts », champ de recherche) · segmented débordant (Contacts · Groupes) · liste alphabétique : **lettres sur blanc, lignes sur pierre** · badge « À compléter » | burger · + · recherche · 2 onglets | 20 · 2 |
| Canaux | Header · panneau de quatre canaux (icône, nom, adresse, badge ambre « En attente », corbeille) · encart pointillé | burger · 4 corbeilles | — |
| Profil | Header · trois cartes-formulaires (identité, mot de passe, compte) | burger · 2 enregistrer · déconnexion · réinitialiser | — |
| Préférences | Header · panneau de quatre interrupteurs bleus | burger · 4 switches | — |
| Usage | Header · bandeau ambre de démonstration · carte « Ce mois-ci » : pourcentage violet, jauge, texte | burger | « 32 % » |
| Recherche | Header (titre, champ) · phrase d'aide | burger · champ | — |

**Ce qui pèse, vu d'ensemble** — c'est contre ceci que l'allègement se mesurera :

- **Le chrome prend de la hauteur** : le header violet occupe entre un cinquième et plus d'un
  tiers de l'écran (accueil avec les nouvelles) ; le dock et son bouton en relief en prennent
  encore un douzième. Sur Sujets, **trois surfaces blanches à ombre** (barre KPI, chips,
  panneau) précèdent la première ligne de contenu, plus un compteur « 25 sujets » qui répète
  l'onglet.
- **Trois vocabulaires de couleur sur une même ligne** : tuile de domaine en aplat, badge plein
  Urgent rouge ou Nouveau bleu, barre de progression verte. Les trois premiers sujets de la démo
  sont urgents : la rareté, qui devait être le signal, n'est pas tenue par les données.
- **Le violet déborde de la voix de Relvo** : il remplit les onglets actifs, les chips
  sélectionnées, le segmented du Calendrier, le rail de jours, les boutons des formulaires et la
  tuile d'un domaine — alors que `01-tokens.md` le réserve à l'agent.
- **Des zéros affichés** : tuiles d'activité 0 · 0 · 0, « 0 Fermés », « 0 Rendez-vous », contre
  la règle « un compteur à zéro ne s'affiche pas ».
- **La matière s'inverse par endroits** : Contacts pose les lettres sur blanc et les lignes sur
  pierre ; Mémoire rend les instructions en cartes empilées ; Profil empile trois cartes-formulaires.
- **Les données de démonstration ont vieilli** : tout date de juillet, donc « 88 tâches en
  retard », chaque attente « en retard », un rail de jours sans tâche. Une direction se juge sur
  des volumes plausibles : rafraîchir le jeu de démo avant la tranche 3.
- **Mode sombre émulé** : aucune dérive sur ces dix-huit écrans, l'application reste claire ;
  les toasts (#51) n'ont pas été déclenchés. Un avertissement d'hydratation (attributs serveur/client différents) s'est affiché une
  fois en console de développement sur l'accueil, serveur fraîchement démarré ; rejoué ensuite
  après connexion, après rechargement et en navigation directe : **non reproduit**. À surveiller
  quand le header sera reconstruit, rien à corriger aujourd'hui.

## Les quatre directions sur planches (M19.3)

**Le canevas** — douze planches au format téléphone, trois écrans héros (Accueil, Sujets, Échange)
par direction, mêmes données partout, une note par direction (parti-pris, palette mappée sur les
rôles, couple typographique, matière, mouvement, ce qu'elle refuse) :
<https://claude.ai/artifact/JfcxaQEyouWXJEH6vvKAtf>. ⚠️ Ce sont des planches, pas la maquette :
elles disent la matière, pas les flux. Les directions écartées ne survivent que là.

**Première série, écartée le jour même.** Quatre directions qui ne faisaient varier que la
couleur et la typographie, la structure des écrans étant gardée à l'identique : le dirigeant les
a trouvées quasi identiques. La leçon : « la disposition ne rouvre pas » vaut pour les cinq
invariants (dock, quatre zones et leur ordre, Relvo parle en premier, deux familles de chiffres,
usage en pourcentage), **pas** pour la hauteur du header, la forme des chiffres, la barre
d'onglets de Sujets, l'anatomie d'une ligne ni ce qu'une zone montre en premier. Une direction
artistique qui ne touche pas à ça n'est qu'un thème.

**Seconde série, écartée elle aussi** — quatre **thèses structurelles**, chacune avec sa
matière, restées sur le canevas. Aucune ne garde le cadre violet : le violet est partout ramené à
la voix de Relvo.

| | Thèse | Ce qu'elle conteste, et le dit |
|---|---|---|
| **A · Ligne** | Tout en lignes, aucune tuile : les chiffres sont une phrase, le header tient sur une ligne, la liste commence au premier tiers ; Sujets sans barre d'onglets, neuf sujets visibles | Le header violet structurel et la tuile KPI (design system) ; respecte les quatre zones |
| **B · Journal** | La page se lit comme un quotidien : manchette, article de une dans la voix de Relvo, titres avec chapeau, filtres en texte courant, échange en interview numérotée | Le header violet, les panneaux, la tuile KPI, « une seule famille » (Newsreader en titres) |
| **C · Cartes** | Les gens d'abord : ce qui attend votre réponse domine en grandes cartes avec le contact et le geste à faire ; chiffres relégués en bas ; Sujets groupé par attente | L'ordre des quatre zones (invariant 34), « une ligne, pas une carte », Bricolage Grotesque en titres |
| **D · Flux** | Un seul fil chronologique : nouvelles, tâches et attentes sont des événements sur un rail de temps, acteur en couleur ; Sujets par dernière activité ; l'échange est le même fil ; fond sombre | L'accueil en quatre zones (invariant 34), « clair seulement » (#51), les chiffres en tuiles |

⚠️ Une thèse retenue qui conteste un invariant (C ou D) se tranche par une entrée du registre des
écarts **avant** la tranche 2, jamais par la planche seule.

**Le verdict du dirigeant sur la seconde série.** Les quatre planches sont un **aplat
d'informations** : aucune zone délimitée, aucune consistance, aucune image, tout est plat et
homogène, sans hiérarchie — l'utilisateur est perdu. Le bouton Relvo nacré, gardé tel quel de
l'application, n'a aucun sens posé sur ces écrans. **Une seule chose retenue** : les cartes à
faire défiler horizontalement dans « En attente de vous » (planche C, Accueil). Le diagnostic,
une fois les planches rendues en navigateur (ce qui n'avait pas été fait avant de les montrer) :
une direction faite de texte et de filets n'a ni surfaces ni matière ; « alléger » a été lu comme
« aplatir » ; et le bouton nacré a été traité comme un verrou alors que le brief ne fige que
**l'existence** d'un relief unique, pas sa matière. Les planches rendues sont dans le scratchpad
(`planches-png/`), jamais dans le dépôt.

**Ce que ui-ux-pro-max a réellement donné : rien d'une direction.** C'est un dictionnaire
(styles, palettes, couples de polices, règles UX en une phrase) interrogé par recherche plein
texte ; il ne contient aucun exemple d'écran et ne produit aucune disposition. Ses requêtes
`--design-system` rendent un pattern de page de vente quelle que soit la formulation (#56). Ses
couples typographiques (Cormorant + Montserrat, Poppins + Open Sans, Fredoka + Nunito, Inter seul)
ont tous été écartés. **Conclusion : cette skill ne sert pas M19.3.** L'épique lui confie
« produire les quatre directions » : la ligne est à corriger.

**Troisième tentative, avec impeccable : la direction est retenue.** La méthode de la skill a
été suivie telle quelle : `PRODUCT.md` écrit à la racine après trois questions au dirigeant
(scène d'usage : debout **et** posé ; les quatre références qu'il a envoyées deviennent un
**socle verrouillé** ; le signe de Relvo et son bouton restent ouverts) ; sept mondes listés
depuis l'univers food et bâtiment (code couleur HACCP, bordereau carbone, planning mural
magnétique, signalétique de chantier, faïence métro, camion lettré, devis d'artisan) ; tirage
`concept-seed --scope direction --mode operate` (clé `9d6ada01`) qui assigne le **camion lettré**
et oppose six challengers de catalogue ; page de décision servie dans le navigateur, quatre cartes
pleines avec esquisse de l'Accueil (la direction assignée, le choix de l'outil « Code couleur de
cuisine », le challenger compétitif « Tableau des départs », le standard de la catégorie), cinq
challengers écartés rangés en bas avec ce qu'ils ont cédé. Le dirigeant a retenu la direction
assignée avec trois corrections (violet en livrée à la place du bleu de travail, bouton Relvo
abaissé, onglet actif du dock sans cerclage), puis deux autres après la déclinaison (cercle des
indicateurs aéré, **ciel étoilé** à la place du ruban). Une relance du tirage a été cliquée puis
annulée par la confirmation du choix : elle n'a pas été servie. Le contrat de direction en six
blocs vit dans `apps/web/.impeccable/surfaces/` ; la décision et ce qu'elle a retenu contre quoi
dans `ecarts` (« Une direction artistique : “Lettrage d'artisan” »).

**Les dix-neuf écrans sur le canevas**, en première ligne, au-dessus des directions écartées :
les trois héros, puis menu, Calendrier, fiche sujet, Conversations, conversation WhatsApp,
e-mail, historique, Recherche, Bilan, Mémoire, Contacts, Canaux, Profil, Préférences, Usage,
Connexion. Chaque planche est rendue en navigateur et relue avant publication (règle désormais
écrite dans le brief) ; les rendus vivent dans le scratchpad (`planches-png/`). Le détecteur
d'impeccable signale sur ces planches la bande de domaine (« side-tab ») et des textes à 10 px :
la bande est le geste signature, exception à écrire dans `DESIGN.md` en tranche 2 ; les tailles
se traitent à la construction.

**Ce que ui-ux-pro-max a réellement donné : rien d'une direction.** Un dictionnaire (styles,
palettes, couples de polices, règles UX en une phrase) interrogé par recherche plein texte, sans
exemple d'écran ; ses requêtes `--design-system` rendent un pattern de page de vente (#56).
La ligne de l'épique est corrigée.

## La décision écrite (M19.4)

Récrits en place, au présent : `00-brief-da.md` (le socle, la direction en place et ce qu'elle
refuse, le violet livrée et voix, le bouton qui déborde, le burger à droite, « rendue en
navigateur avant d'être montrée ») et `01-tokens.md` (livrée en trois violets et ciel, bloc de
Relvo, bande + texte par domaine, états par la forme, sélection par cerclage, Barlow en deux
dessins, blanc et cartes, plus de verre ni de grain ni de relief). `CLAUDE.md` et
`01-principes.md` ont suivi sur le bouton et le burger. `02-composants.md` et `03-patterns.md` ont suivi en
ouverture de la tranche 2 (quatre matières, bande de domaine, chiffres condensés, état par la
forme, le cadre ciel et dock). **Jusqu'à M19.5 et M19.7, le code décrit l'ancienne matière.**

## La tranche 2 en pratique — ce qui a été tranché en construisant

- **Les anciens noms de tokens vivent en alias** (`--stone`, `--surface`, `--text-tertiary`,
  `--elev-*`, `--glass-*`…) pointés sur la matière retenue : l'application a rendu dans la
  direction dès M19.5, et chaque lot a remplacé les alias par les vrais noms sur les écrans qu'il
  touchait. Les alias restants se retirent quand plus aucun fichier ne les cite — c'est le test
  des tokens qui le dira, pas la vigilance. Les utilitaires `.grain` et `.glass-relvo` sont
  rendus inertes.
- **Un composant partagé est né** d'une duplication constatée : `IndicatorTabs` (Sujets,
  Calendrier, Conversations, Contacts), le chiffre actif cerclé. `SegTabs` reste pour les onglets
  d'une fiche, actif souligné. Le dock a ses quatre icônes pleines dans `dock-icons.tsx`, celles
  des planches que le dirigeant a validées.
- **Le ciel** est un utilitaire CSS (`.ciel`, `--ciel`, `--ciel-haut`, `--etoiles`), son fondu
  vers le blanc ancré au **bas** du header (les 44 derniers pixels) pour que la première carte le
  chevauche quelle que soit la hauteur du header et qu'un texte blanc reste sur le violet de
  Relvo — des arrêts depuis le haut éclaircissaient la fiche là où elle porte encore du texte,
  retour du dirigeant après les icônes ; les trois étoiles du signe évitent le coin haut droit où vivent les boutons
  de page.
- **Le sujet en attente** (`getSubjectsAwaitingUser`) porte désormais son domaine et
  l'entreprise du contact : la carte d'attente les affiche. Version de cache `v14`.
- **Le burger est à droite** dans `RelvoHeader`, après les actions de page ; la flèche retour à
  gauche sur un écran poussé ; `eyebrow` au-dessus du titre (la date sur l'accueil, le domaine sur
  une fiche).
- **Vérification** : typage, lint et les 127 tests passent ; chaque lot a été capturé en
  navigateur (scratchpad `shots-m197/`) et relu avant commit. L'avertissement d'hydratation
  s'est montré une fois sur `/usage` pendant ces captures, jamais sur l'accueil : à regarder en
  tranche 3 avec les écrans un par un.
- **`pnpm build` passe**, le proxy apparaît (#5b). **Pas encore fait** : les
  détecteurs d'impeccable signalent la bande de domaine comme tic d'interface générée tant que
  `DESIGN.md` n'écrit pas l'exception ; la page publique de suivi garde sa feuille à part.

## Le retour du téléphone

La tranche 2 poussée en production, le dirigeant a regardé l'application sur son compte : « beaucoup
plus claire et agréable », et six retours, tous appliqués dans le même commit :

- **Le ciel étouffait sous la barre d'état** : les boutons se collaient à l'heure et à la
  batterie. Le header prend une marge sous la zone sûre.
- **Une seule rangée dans le ciel** : le titre de la page, puis les actions et le burger à sa
  droite, sur toutes les pages — la rangée des boutons seule disparaît. Un titre long (fiche,
  conversation) descend sous la flèche. La rangée économisée paie la marge.
- **L'avatar de l'accueil est retiré** : il ne menait nulle part.
- **Un indicateur à zéro écrit « 0 »**, en gris clair, pas un tiret. `02-composants.md` distingue
  désormais le badge (absent à zéro) de l'indicateur (cellule fixe).
- **Le dock est abaissé** de dix pixels.
- **Le bouton Relvo est réaxé** dans la pilule. Un premier essai sans débord semblait posé sur
  la barre ; un anneau noir autour d'un disque plus grand était trop circulaire ; le dirigeant a
  montré sa référence : la pilule se **soulève autour du disque** en courbe douce, comme un
  tissu tendu. C'est une silhouette SVG derrière la pilule (`DockFabric`, calée sur `--dock-h`
  et `--dock-etire`), l'ombre en drop-shadow pour qu'elle la suive. Le brief, les tokens, les
  patterns, les principes et la carte du projet le disent ; `--dock-deborde` disparaît.

## L'outillage — M19.11

- **`DESIGN.md` est écrit depuis le code livré**, à la racine, en suivant la méthode
  `document` d'impeccable en mode relevé : le frontmatter recopie les valeurs de `globals.css`
  (couleurs, deux dessins typographiques, rayons comptés, espacements, variantes de
  composants) pour les outils qui le lisent ; le texte pointe vers `conception/design-system/`
  et ne redit pas les règles — il nomme les **exceptions assumées aux détecteurs** : la bande
  de domaine (« side-tab »), le violet sémantique (livrée et voix), le débordement du disque
  Relvo (le relief unique), et les deux textes à 10 px du dock. Son sidecar
  `apps/web/.impeccable/design.json` (rampes tonales, ombres, paliers, neuf composants en
  extraits autonomes) se régénère depuis `DESIGN.md` par un script du scratchpad. Les questions
  de langage de la méthode (étoile polaire, caractère des couleurs, philosophie d'élévation)
  n'ont pas été reposées : les réponses sont dans `00-brief-da.md` et `01-tokens.md`.
  **Les tokens de mouvement n'existent pas encore** (`--dur-*`, `--ease-*` cités par
  `01-tokens.md`) : `DESIGN.md` le dit, ils arrivent avec M19.8.
- **Le contrat de direction** du brief de surface est tenu au présent : il disait encore le
  bleu de travail, le ruban et le disque bleu ; il dit le violet livrée, le ciel étoilé et le
  disque réaxé — une revue qui juge contre un contrat périmé rend de faux écarts.
- **Le détecteur ne lève rien sur l'application** : la bande est un fond, pas une bordure. Sa
  seule alerte vit dans la feuille de la page publique de suivi (`.why`, `border-left`), hors
  tranche ; un avis sur `animate-bounce` dans le composeur de destinataires, pour M19.8.
- **`/design-system/` est ignoré par git, motif ancré** : ui-ux-pro-max écrit à la racine, et
  un motif sans barre initiale aurait aussi avalé `conception/design-system/`. Il n'a rien
  écrit à ce jour. Le docteur d'impeccable ne signale plus que `buildPath`, un réglage qu'il
  demande de taire sans outil de génération d'images.
- **La revue de finition** (le relecteur d'impeccable, lancé à part avec les dix-huit captures,
  le contrat, `DESIGN.md` et l'esquisse de la page de décision comme référence) rend **fix** :
  typographie, matière, fond, ciel, bloc de Relvo, cartes d'attente, dock, indicateurs sont
  conformes ; aucune dérive sombre sur dix-neuf écrans ; huit corrections matérielles. **Cinq
  sont appliquées dans ce lot** : les lignes de Sujets se rendaient en cartes arrondies séparées
  dans leur `ListPanel`, les fonds de swipe transparaissant aux jonctions (prop `rounded` de
  `SwipeableSubject` supprimée) ; les zéros d'Activité étaient en noir plein (gris clair) ; le
  bandeau de résolution portait un bouton à reflet nacré et des couleurs en dur (il est devenu
  un bloc de Relvo, bouton plat, sorti du cliquet du test) ; « Nouvel échange » de l'historique
  posait une action de l'utilisateur sur le violet pâle de Relvo (carte blanche) ; les textes
  à 10,5 px de la ligne de sujet et des compteurs d'onglets passent à 11 px. **Trois sont
  confiées à la tranche 3**, qui travaille écran par écran et commence par cette liste :
  l'annuaire des Contacts hors `ListPanel` ; les en-têtes RÉSUMÉ / TÂCHES de la fiche en
  petites capitales de l'ancienne matière (`ZoneHeading`, puis `section-label.tsx` à
  supprimer) ; les textes sous 11 px et les couleurs en dur restantes (fiche sujet, e-mail,
  bulles, pastille d'acteur à 9 px, agenda, instructions, mois du planning ; le cliquet
  `RESTE_A_MIGRER`, et `MetricsCardSkeleton` à remplacer par un squelette d'`IndicatorTabs`).
  **La dernière a été tranchée par le dirigeant le jour même** : le socle dit « icônes
  pleines », et seul le dock l'était (le menu latéral, les avatars de canal, les onglets de la
  fiche et les corbeilles de Canaux étaient en trait). Tout pictogramme vient désormais de
  `shared/picto.tsx` — Phosphor en graisse « fill », depuis l'entrée SSR pour servir les
  composants serveur comme client, la graisse posée une fois pour que personne ne l'oublie ;
  lucide ne fournit plus que les glyphes qui sont un trait, et le test des tokens tient la
  ligne. Un remplissage ne dit plus un état (le drapeau Urgent, les puces de canal) : la
  couleur et la puce le portent. Les suggestions de l'échange quittent le pointillé violet,
  réservé à « vide / à compléter », pour la puce blanche à filet. Le résidu d'anticrénelage
  aux coins de Sujets a été regardé sur le téléphone : rien à corriger.
  Deux lectures non matérielles à garder en tête pour la tranche 3 : l'état vide « rien de prévu » diffère entre l'accueil (carte) et
  le Calendrier (texte nu) ; la bande de domaine de la fiche est un losange dans le ciel, faute
  de carte pour porter la tranche — adaptation acceptée.
- **Verdict après recapture** : les lignes de Sujets, les zéros d'Activité, l'action de
  l'historique et le bandeau de résolution sont **résolus**, sans régression sur les quatre
  écrans recapturés ; les textes sous 11 px, les couleurs en dur et les en-têtes de la fiche
  sont **partiels** (la part reportée), Contacts et les icônes **ouverts**. Un résidu à
  surveiller sur téléphone : aux deux coins hauts du `ListPanel` de Sujets, l'anticrénelage
  de l'arrondi laisse une pointe de vert du fond de swipe de la première ligne ; s'il se
  voit, poser le fond de swipe sous le rognage du panneau. La disposition reste « fix » tant
  que des items sont ouverts : c'est la liste de départ de la tranche 3, pas un défaut du
  chrome, propre à l'exception de la question des icônes.
- **Depuis que `DESIGN.md` existe, le détecteur lit sa gamme typographique** et émet des avis
  (non bloquants) sur chaque taille littérale hors des six rôles du frontmatter. La gamme
  réelle se fixe à la tranche 3, quand les écrans allégés auront dit quelles tailles restent.
- Le serveur local et les captures : `PORT=3100 AUTH_URL=http://localhost:3100 pnpm dev`, le
  script `shoot.mjs` du scratchpad (copié de session en session, `playwright-core` sur le Chrome
  du poste) ; l'avertissement d'hydratation s'est montré une fois encore sur `/usage`, jamais
  ailleurs — toujours pour la tranche 3.

## La tranche 3 commence par les reports de la revue (M19.6)

Un commit par écran, capture avant (celles de la revue) et après (scratchpad `shots-t3/`) :

- **Contacts** : l'annuaire vit dans **un** `ListPanel`, les lettres sont des lignes d'en-tête
  enfoncées (`fond-enfonce`) dans la même carte ; elles ne sont plus collantes (le panneau rogne
  ses coins, vingt contacts n'ont pas besoin d'index). Les groupes perdent leurs couleurs en dur.
- **Fiche d'un sujet** : « Résumé » et « Tâches » passent à `ZoneHeading`, qui gagne `badge`
  (qui parle, la pastille Relvo à côté du titre) et `className` (la fiche impose sa gouttière) ;
  `section-label.tsx`, orphelin, est supprimé. Le brouillon de Relvo devient un **bloc de
  Relvo** (violet pâle signé, boutons plats) au lieu d'un liseré ; le journal, la liste des
  conversations, la puce Urgent, la jauge des tâches, les documents et le marqueur d'état du
  ciel (11 px) passent aux tokens.
- **Conversations** : avatars d'e-mail et de bulle à 11 px, pastille d'acteur à 16 px / 11 px,
  feuille de décision et aperçus de pièces jointes aux tokens. La feuille injectée dans
  l'iframe d'un e-mail reçu (`email-html-frame.tsx`) rejoint les exceptions durables du test :
  les variables de l'application n'y existent pas.
- **Calendrier** : agenda et mois à 11 px ; `metrics-card.tsx`, orphelin depuis M18, est
  supprimé, et le squelette du Calendrier devient celui d'`IndicatorTabs`.
- **Mémoire** : « Désactivée » à 11 px, documents d'un domaine aux tokens.

**Le cliquet `RESTE_A_MIGRER` est vide** : plus aucune couleur en dur hors des six exceptions
nommées. Il reste à la tranche 3 ce que la revue n'a pas ouvert : l'allègement proprement dit
de chaque écran (`critique → distill → polish → audit`), l'état vide « rien de prévu » à
unifier entre l'accueil et le Calendrier, le rafraîchissement du jeu de démonstration, et
l'avertissement d'hydratation sur `/usage`.

## Tranché à la reprise de la tranche 3 — la première connexion (M19.9)

Le dirigeant ajoute à la tranche 4 une **séquence de première connexion** : cinq ou six
**diapositives à glisser**, une phrase courte chacune, qui disent ce que Relvo fait — du
contexte, pas un mode d'emploi — ; puis le **guidage**, qui invite à connecter sa première
adresse e-mail. L'échange scripté (M10.16) reste la prise en main et commence à la connexion de
ce canal : les diapositives y conduisent, elles ne le remplacent pas. La décision et ce qu'elle
a retenu contre quoi sont dans `ecarts` (« La première connexion s'ouvre sur des
diapositives ») ; `01-principes.md` §11, `05-ia.md` §11.11 et le brief disent la séquence.
La trace « vues une fois » est une colonne du compte, migration accordée (ci-dessus).

## Où on en est

- [x] Tranche 1 — « Voir » : ✅ M19.1 brief au présent · ✅ M19.2 point zéro · ✅ M19.3 la
      direction « Lettrage d'artisan » retenue par le dirigeant sur la page de décision
      d'impeccable, dix-neuf écrans sur le canevas (deux séries avec ui-ux-pro-max écartées
      avant) · ✅ M19.4 décision écrite dans `ecarts`, brief et tokens récrits en place
- [x] Tranche 2 — « Habiller » : ✅ `02-composants.md` et `03-patterns.md` récrits dans la
      matière retenue · ✅ M19.5 tokens dans `globals.css`, tenus par `test/design-tokens.test.ts`
      (inventaire, matière écartée, cliquet des couleurs en dur) · ✅ M19.7 composants signature
      et déclinaison sur tous les écrans, en cinq lots (chrome et accueil ; Sujets, Calendrier,
      Conversations, Contacts ; menu, fiche sujet, échange ; conversations et fiche contact ;
      pages du menu et connexion) · ✅ M19.11 outillage : `PRODUCT.md`, `DESIGN.md` écrit
      depuis le code livré avec ses exceptions aux détecteurs, sidecar, contrat de direction au
      présent, revue de finition rendue, son lot de corrections appliqué, icônes pleines
      partout
- [ ] Tranche 3 — « Alléger » : ✅ les reports de la revue de finition (Contacts, en-têtes de
      la fiche, textes sous 11 px, couleurs en dur — cliquet vide) · ⏳ M19.6 l'allègement écran
      par écran · M19.10 robustesse
- [ ] Tranche 4 — « Guider » : M19.8 langage de mouvement · M19.9 premiers pas — diapositives
      de première connexion, invitation à connecter la première adresse, états vides qui guident
- [ ] Tranche 5 — « Clore » : M19.12
