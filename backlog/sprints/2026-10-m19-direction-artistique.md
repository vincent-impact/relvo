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

## L'allègement, écran par écran (M19.6)

La méthode d'impeccable, telle quelle : `critique` en deux relectures isolées (une revue de
design, un détecteur plus des mesures navigateur, synthétisées ensuite), puis `distill` et
`polish` dans le même commit, et ce que l'`audit` aurait relevé consigné ici. Les données de
démonstration ont été **rafraîchies avant** (`pnpm db:seed`, dont les dates sont relatives au
jour) : plus de « 88 tâches en retard » ni de « depuis 77 j ». Captures avant et après dans le
scratchpad (`shots-t3/accueil-avant`, `accueil-apres`), rendues et relues avant le commit.

### Accueil

**Ce que la critique a dit.** Spécifique au produit, sauf la carte Activité, tuile de tableau
de bord générique qui portait **la plus grosse typographie de l'écran** après le prénom
(34 px) — trois zéros gris clair plus gros que le sujet urgent, à l'inverse du principe « ce
qui attend prime sur ce qui s'est passé ». Score Nielsen 21/36 (aide n/a). Les reproches
tenus : deux grammaires d'en-tête (Activité libellée dans sa carte, les deux autres zones par
`ZoneHeading`) ; le vide dit trois fois (« Aujourd'hui » · « rien de prévu » · « Rien de prévu
aujourd'hui. ») ; « Rien de nouveau depuis votre dernière visite » suivi de « 88 tâches en
retard », contradiction apparente ; le tampon « · à l'instant » qui datait la dernière
**visite** et se lisait comme l'heure de la prise de parole ; sur une carte d'attente sans
échéance, « Décision » (état), « Décision à prendre. » (phrase) et « Trancher » (puce) trois
fois ; la référence `SUB-02…` en repli de contact ; un titre tronqué à une ligne ; le lien de
suggestion à 13 px sur 17 px de haut, le burger à 30 px ; « 5 sujets » plafonné par la
requête ; « Bonjour » à 21 h. Le détecteur n'a rien levé d'autre que des tailles hors gamme
(13 px, 13,5 px) et deux exceptions déjà assumées ; les mesures : aucun débordement, console
vide, pas d'avertissement d'hydratation sur l'accueil, zéros à 1,9:1 (décision du dirigeant,
gardée).

**Ce qui a été retiré, et pourquoi il ne manque pas** :

| Retiré | Il ne manque pas parce que… |
|---|---|
| Le qualificatif « rien de prévu » quand la liste du jour est vide | la carte-invite juste dessous le dit en entier, et c'est elle la porte vers le Calendrier |
| Le tampon « · à l'instant » du bloc de Relvo | la phrase porte déjà sa fenêtre (« depuis votre dernière visite ») ; le tampon la répétait avec un référent faux |
| « Décision à prendre. » / « Réponse attendue. » sans échéance | l'état en haut à droite dit la nature de l'attente ; la ligne ne parle que quand elle a une date (« Avant ce soir. ») |
| La puce « Trancher » | troisième façon de dire « décision » sur 130 px, et elle n'ouvrait rien que la carte n'ouvre déjà ; seule reste « Répondre », le geste que Relvo prépare |
| La référence `SUB-…` en repli de contact | personne ne reconnaît un sujet à son code sur un brief ; sans contact, la ligne s'absente |
| Le libellé « ACTIVITÉ · 7 JOURS » dans la carte | il devient le `ZoneHeading` « Activité / 7 derniers jours » : une seule grammaire d'en-tête sur l'écran |

**Ce qui a changé de forme** : les chiffres d'activité au corps d'un indicateur (28 px, celui
des cellules de Sujets ou du Calendrier), carte resserrée, chevron qui dit la porte vers le
Bilan ; « Rien de nouveau **de mon côté** depuis votre dernière visite » ; le titre d'une carte
d'attente sur deux lignes au plus, la rangée du bas ancrée en bas ; les liens de suggestion à
14 px, en bloc, avec retrait suspendu, 30 px de haut ; la zone de frappe des boutons du ciel
portée à 44 px par un pseudo-élément, sans grossir le dessin (`SKY_BTN`, donc toutes les
pages) ; les qualificatifs de zone et les libellés sous 14 px en graisse 400, règle écrite dans
`01-tokens.md` ; « Bonsoir » à partir de 18 h ; la requête des sujets en attente en demande
six pour en montrer cinq et dire « les 5 plus pressants » quand il y en a d'autres (cache
`v15`) ; les squelettes à la taille du rendu.

**Confié à plus tard** : à M10, le fait qu'une suggestion écrite par Relvo devienne la phrase
de l'utilisateur dans le composer de `/relvo` (le premier tour devrait être rendu par Relvo),
et « brouillon prêt » sur la carte d'attente, que `AwaitingSubject` ne sait pas encore dire ;
à l'écran Calendrier, la case à cocher de `TaskItem` (22 px, la ligne ouvre une modale) et ses
états `hover:` inertes au doigt ; à `clarify`, une ligne de clôture du brief (« C'est tout pour
ce matin »), à discuter. L'exception « ligne du dessus » (la date, le domaine) est écrite dans
`DESIGN.md` contre le détecteur « kicker-above-heading ».

### Conversations — la liste et le fil

**Ce que la critique a dit.** La liste est spécifique et honnête, mais dit trois fois ce
qu'elle pourrait dire une fois : « 5 conversations à trier » en sous-titre du ciel, puis « 5 /
à trier » cerclé quarante pixels plus bas ; le canal écrit à côté de son icône ; « lu » dit par
quatre signaux, dont l'heure en violet — la livrée empruntée pour un état ; la cellule d'un
flux vu rendue **vide** au lieu de « 0 » ; « Supprimer » rouge sur le swipe d'un e-mail et
« Ignorer » sur WhatsApp pour le même geste, avec une boîte qui disait « Supprimer ce fil ?
… Aucune donnée n'est supprimée » ; un avatar-bouton caché de 40 px au bord gauche d'une
ligne qu'on balaie. Sur le fil : **deux commandes mortes dans le composer**, le micro (aucune
dictée dans le code) et le trombone (aucun gestionnaire) — l'objet le plus visible de la seule
surface de réponse du produit ne faisait rien ; la ligne « suivi dans » rendait le sujet par
un point de 8 px et un titre, là où le produit rend un sujet par sa bande et son domaine ;
détacher un fil était un tap de 28 px dans le ciel, sans mot ni confirmation ; la teinte bleue
du courriel sortant contredisait « un e-mail se rend sur blanc dans les deux sens » ; une
carte de pièce jointe ombrée dans une carte ombrée ; initiales à 9,5 px en graisse 800 ; un
bloc « Relvo n'a pas encore lu ce fil » qui prenait la place d'un message pour dire rien.
Scores Nielsen 23/36 (liste) et 22/36 (fil). Mesures : aucun débordement, console vide,
cibles de 28 px sur les puces et le détachement.

**Ce qui a été retiré, et pourquoi il ne manque pas** :

| Retiré | Il ne manque pas parce que… |
|---|---|
| Le sous-titre « N conversations à trier » / « Tout est couvert par un sujet » | l'indicateur cerclé dit le même nombre et le même mot ; l'état vide dit déjà « tout est couvert » |
| Le mot « Email » / « WhatsApp » à côté de l'icône | ce public lit l'enveloppe et le logo sans mot, la puce de canal active le redit ; l'aperçu gagne soixante pixels |
| L'heure en violet sur une ligne non lue | la graisse du titre et la pastille disent le non-lu ; le violet est la voix de Relvo, pas un état |
| Le tap caché sur l'avatar (fiche ou création du contact) | la même porte existe dans le fil, libellée (« Enregistrer », chevron) ; un bouton invisible au bord d'une ligne à balayer est un piège |
| « Supprimer » (rouge, corbeille) sur le swipe d'un e-mail | rien n'est détruit : « Ignorer », ambre, sur les deux canaux, et la boîte titre « Ignorer ce fil ? » — `04-design-domaine.md` aligné |
| L'heure du verdict en liste | la ligne porte déjà la sienne vingt pixels plus haut ; elle reste dans le fil |
| Le « ✦ » de « Rien à trier » | le signe dit « Relvo parle » ; ici personne ne parle |
| Le micro du composer | il ne dictait rien : le disque porte l'avion, désactivé à vide. Le micro de la direction revient avec la dictée, **à placer au backlog** par le dirigeant |
| Le trombone | aucun envoi de pièce jointe n'existe ; il revient avec |
| « Relvo n'a pas encore lu ce fil. » | l'absence de verdict est déjà le signal ; le bloc ne s'affiche que quand Relvo a quelque chose à dire |
| La teinte bleue du courriel sortant | l'en-tête porte déjà l'avatar bleu « M » et « Moi » ; la règle « blanc dans les deux sens » est tenue |
| « modifiez librement avant d'envoyer » sur la barre de brouillon | le champ est visiblement éditable, le curseur y est |
| « Encore N réponses. » au pied du formulaire de décisions | l'en-tête porte « 0 / 2 » |

**Ce qui a changé de forme** : un flux vu écrit « 0 » en gris clair, jamais une cellule vide ;
puces de canal à 36 px, 44 de frappe ; pastille de non-lus à 22 px comme sur une ligne de
sujet ; la ligne « suivi dans » rend le sujet par sa bande, son domaine en capitales
condensées et son titre (le domaine exposé par `ConversationListening`) ; détacher ou
arrêter l'écoute passe par une confirmation qui nomme le sujet, 44 px de frappe ; une bulle
qui suit une bulle du même expéditeur ne répète pas son en-tête ; initiales en 11 px condensé ;
gouttière du fil e-mail à 16 px comme toute carte ; pièce jointe en sous-carte à filet, sans
ombre, étiquette grise (l'ambre est Externe, c'est Relvo qui a nommé) ; le signe de Relvo —
le logo — partout où il parle (barre de brouillon, formulaire de décisions) ; sous 14 px, plus
de graisse fine ni de graisse 700 (libellés de swipe, états vides, en-têtes de formulaire).

**Confié à plus tard** : la dictée et l'envoi de pièces jointes, deux items que le dirigeant
place au backlog (M10 pour la dictée, probablement) ; l'heure absolue et un séparateur de jour
dans un fil de bulles (aujourd'hui « 1 h » répété) ; le hero fixe du fil, qui garde ~200 px
hors défilement — décision du 2026-09-18, à rouvrir seulement si l'usage le réclame ; les
durées littérales des trois points « Relvo rédige », qui attendent les tokens de M19.8.

### Sujets et la fiche d'un sujet

**Ce que la critique a dit.** La liste est spécifique, mais chaque ligne disait son compte de
tâches **deux fois** (« 0/4 tâches » à gauche, « 0/4 » à droite) et « à vous » sous sept lignes
sur neuf — le défaut nommé était devenu du bruit ; « Ouverts · 25 sujets » redisait l'indicateur
cerclé soixante pixels plus haut ; les puces de domaine faisaient 28 px et menaient parfois à
une liste vide ; l'état vide disait « Rien ici pour le moment ». Sur la fiche, le domaine était
dit **trois fois** (bande et nom dans le ciel, puis puce icône + nom sous les onglets) ; le
journal enregistrait **chaque ouverture** de la fiche (vingt-huit « Sujet SUB-0142 ouvert » sur
le sujet de démonstration après les relectures) ; une tâche en retard n'était jamais rendue
barrée, le drapeau n'étant pas dérivé par la page ; le titre de la fiche était à 19 px, plus
petit que l'horaire d'une tâche ; « SUB-0142 » en sous-titre ; quatre onglets à icônes sans
mot ; une jauge, une icône et un chiffre pour dire 0/3 ; Documents en cartes empilées sous une
phrase d'explication permanente ; une ligne de conversation réécrite autrement que sur
`/conversations` (avatar ambre d'état, pastille bleue, graisse 800) ; le journal en frise à
points de couleur illisibles au soleil. Scores Nielsen 22/36 (liste) et 20/36 (fiche).

**Ce qui a été retiré, et pourquoi il ne manque pas** :

| Retiré | Il ne manque pas parce que… |
|---|---|
| « 0/4 tâches » dans la ligne fine d'un sujet | le même compte est à droite, en condensé ; la ligne fine porte le résumé court du sujet, ou rien |
| « à vous » sous le chiffre | c'est l'état par défaut ; ne pas le nommer est ce qui fait ressortir « attend », « nouveau », « à valider » |
| La référence `SUB-…` en repli de la ligne fine et en sous-titre de la fiche | personne ne reconnaît un sujet à son code ; il reste dans l'URL |
| L'en-tête « Ouverts · 25 sujets » sans filtre | l'indicateur cerclé nomme la zone et la compte ; sous filtre, l'en-tête dit « Fournisseurs · 7 sur 25 », seul endroit qui le dise |
| Les puces des domaines sans sujet dans l'onglet | une puce vers une liste vide est une puce morte ; le domaine réapparaît dès qu'un sujet l'habite |
| La puce « Fournisseurs ⌄ » sous les onglets de la fiche | la ligne du dessus du ciel porte déjà la bande et le nom, et c'est elle, désormais, qui ouvre le sélecteur |
| L'icône et la jauge de l'en-tête « Tâches » | le chiffre condensé « 0/3 » est le même que sur la ligne de la liste, et c'est lui qu'on attrape |
| La phrase « Les pièces jointes reçues… s'accumulent ici » au-dessus des documents | une liste qui existe s'explique seule ; la phrase vit dans l'état vide |
| « Sujet SUB-0142 ouvert » à chaque ouverture (domaine) | le journal ne note que la **première** ouverture, celle qui acquitte « Nouveau » ; les suivantes n'ont rien à dire |

**Ce qui a changé de forme** : le titre de la fiche à 26 px, celui d'un écran poussé ; les
onglets portent leur mot sous l'icône, à 11 px comme le dock ; Urgent se lit à la forme
(pastille pleine rouge sur puce blanche, pointillé quand il est éteint) ; une tâche en retard
est barrée en rouge sur la fiche comme ailleurs ; « Résumer ce sujet en une phrase » et
« Ajouter une conversation » prennent le dessin de « Ajouter une tâche » — une seule invite sur
la fiche ; Documents et Journal en lignes dans une carte, la lettre de l'acteur dans son disque
à la place d'un point ; la ligne de conversation de la fiche est celle de `/conversations`
(initiales ambre, icône du canal, pastille 22 px) ; puces de domaine à 36 px, 44 de frappe ;
le squelette de la liste a la silhouette d'une carte de lignes et celui de la fiche celle du
ciel ; les états vides de Sujets apprennent le geste (« Glissez un sujet vers la gauche pour le
fermer ») ; sous 14 px, plus de graisse fine ni de 700.

**Confié à plus tard** : la pastille de non-lus sur une ligne de sujet, que le brief réserve à
la conversation (à trancher : la retirer, ou amender le brief) ; « Urgent » en mot sur la
ligne et en pastille sur la carte d'attente — deux formes pour un état, le brief dit la
pastille ; la liste plafonnée à 40 sujets par la requête, l'indicateur compterait faux au
41ᵉ ; sur un sujet ouvert par Relvo, l'invite « Résumer ce sujet » demande au dirigeant le
travail de Relvo — question pour M10 ; les entrées « ouvert » déjà écrites dans les journaux
existants restent (jamais de SQL direct), elles ne grossissent plus ; la case de `TaskItem` et
« 15 oct. » au lieu d'« Aujourd'hui », pour l'écran Calendrier. L'avertissement de clé React
de l'onglet Documents est résolu : une icône Phosphor passée en enfant d'un composant client
depuis la page serveur traverse la frontière sans clés — la ligne est devenue un composant
client qui rend son icône lui-même (`PITFALLS.md` #58).

### Mémoire, un domaine, les Contacts et la fiche d'un contact

**Ce que la critique a dit.** La Mémoire posait le signe de Relvo (une étoile générique) sur
chaque instruction, que seul l'utilisateur écrit ; ses aperçus montraient « # Ton » puis
« … » ; une zone « Ce que Relvo a appris · bientôt » annonçait M17 sur un écran de travail ;
le « + » du ciel menait à « Nouveau domaine » au-dessus d'une liste d'instructions ; chaque
domaine comptait « 0 document » ; supprimer une instruction était un tap sans confirmation à
côté du bouton primaire. Un domaine n'avait pas sa couleur sur sa propre fiche, ses documents
étaient des cartes empilées, ses sujets des lignes nues, et « Déposer un document » un cadre
pointillé sans effet. L'annuaire disait « 20 contacts » deux fois, triait par nom de famille
en affichant le prénom d'abord (« Karim Benali » sous B), répétait l'entreprise sous un
contact qui est l'entreprise, et les groupes étaient hors carte, en vert emprunté à « fait » ;
le champ de recherche montrait deux croix (la native de WebKit et la nôtre). La fiche d'un
contact faisait disparaître le dock, donc Relvo, pour une barre « Supprimer / Modifier » ;
elle disait le nom trois fois, habillait un tiers en violet avec un halo, et le numéro de
téléphone n'appelait pas. Scores Nielsen 16/36 (Mémoire), 17/36 (domaine), 22/36 (annuaire),
16/36 (fiche). Mesures : console propre, aucun débordement.

**Ce qui a été retiré, et pourquoi il ne manque pas** :

| Retiré | Il ne manque pas parce que… |
|---|---|
| L'étoile devant chaque instruction | elle disait « Relvo parle » sur ce que l'utilisateur écrit (invariant 20) ; l'état se lit à la puce « Désactivée » seule |
| « vous seul les écrivez » dans le qualificatif | c'est vrai de toutes les instructions ; l'état vide le dit |
| La zone « Ce que Relvo a appris · bientôt » | il n'y a rien derrière ; elle revient avec M17, avec quelque chose à montrer |
| Le « + » du ciel de la Mémoire | « Ajouter un domaine » vit en bas de la liste des domaines, dans la grammaire d'« Ajouter une instruction » |
| « 0 document » dans la sous-ligne d'un domaine | l'absence du mot dit l'absence de la chose ; « rien encore » si tout est à zéro |
| Le sous-titre « Un domaine de la mémoire de Relvo » | la flèche retour et « Mémoire » l'ont dit ; la bande du domaine, dans le ciel, dit ce que rien d'autre ne disait |
| « Déposer un document (PDF, image) » | il ne déposait rien ; il revient avec l'envoi |
| Le sous-titre « 20 contacts » | l'indicateur cerclé le dit, en plus gros |
| L'entreprise sous un contact qui est l'entreprise | c'est le titre |
| « Groupe WhatsApp » sous chaque groupe | l'onglet s'appelle Groupes et l'avatar porte le pictogramme |
| La barre « Supprimer / Modifier » de la fiche contact | Modifier est le crayon du ciel comme sur toute fiche ; Supprimer est un lien en édition, confirmé en nommant le contact ; le dock et Relvo reviennent (invariant 22) |
| L'avatar géant violet, le nom et l'entreprise dans la carte | le ciel est la carte de visite : titre, ligne du dessus, marqueur « À compléter » |
| Les lignes Prénom / Nom / Entreprise en lecture et « Non renseigné » | un carnet lit « Karim Benali · SoGood », il ne lit pas des champs ; l'édition montre les champs |

**Ce qui a changé de forme** : l'aperçu d'une instruction est son premier paragraphe, sans
titres Markdown ; supprimer une instruction demande confirmation en la nommant ; le domaine
porte sa bande dans le ciel, ses documents et ses sujets sont des lignes dans une carte,
« Lu » est signé du logo de Relvo ; l'annuaire trie et sectionne sur le nom affiché, les
contacts sans initiales lisibles prennent le pictogramme ; les groupes sont des tiers (ambre)
dans une carte ; le champ de recherche a 16 px (pas de zoom iOS) et une seule croix, 44 px de
frappe ; sur la fiche d'un contact, chaque numéro appelle et chaque adresse écrit, le numéro en
condensé — le numéro sur le camion ; en édition, une barre prend la place du dock comme un
composer ; le squelette des onglets a la silhouette de `SegTabs` ; sous 14 px plus de graisse
fine ni de 700. Pictogramme `Phone` ajouté au registre des pleins.

**Confié à plus tard** : Général à deux portes (ses instructions en tête de la Mémoire et en
dernière ligne des domaines) et l'icône de domaine choisie mais jamais rendue — deux
questions de périmètre pour le dirigeant ; l'éditeur d'instruction en modale centrée, dont le
bas passe sous le clavier (un écran poussé serait la forme juste, M19.10) ; une porte de la
fiche contact vers ses sujets et ses conversations (périmètre, `05-ia.md` §10.1).

### Calendrier et Échange avec Relvo

**Ce que la critique a dit.** Le Calendrier colorait les tâches du mois et la miniature de
glissé par une **palette parallèle** (`folderColor`, « 600 du mockup ») : Fournisseurs en bleu
de Moi, RH en violet de Relvo, Juridique en rouge d'urgent — contre « aucun domaine n'est
violet » et « urgent et fait ne s'empruntent pas » — alors que toute ligne du produit passe
par la bande du domaine. Les lentilles ne comptaient pas ce que leurs listes montraient
(« 6 aujourd'hui » au-dessus de dix lignes « 10 restantes ») ; « Semaine du 12 oct. » était
figé sur le jour courant ; la ligne de tâche partagée avait une case de 22 px sans zone de
frappe, des `hover:` inertes, une sous-ligne en graisse fine, un tiret « — » quand la tâche
n'a pas d'heure, « 15 oct. » pour aujourd'hui ; le mois avait des en-têtes en 700 synthétique,
un glissé qui partait au moindre défilement, une phrase d'aide permanente et un bouton
« Aujourd'hui » sans effet sur le mois courant ; quatre fichiers de composants sans
consommateur traînaient dans `shared/`. L'Échange était l'état vide de n'importe quel chatbot :
orbe, « Comment puis-je vous aider ? », quatre cartes d'invites dont **deux nommaient des
données de démonstration en dur** (« le congélateur de Narbonne », « Karim ») pour tous les
comptes, un second composer avec le micro et le trombone que Conversations venait de retirer,
un toast « arrive en M10 » devant le client, un bouton Historique vers une page vide,
« SUB-0142 — … » en puce de contexte. Scores Nielsen 17/36 (Calendrier) et 14/36 (Échange).
Mesures : une erreur d'hydratation reproductible sur le Calendrier (les identifiants ARIA de
dnd-kit, numérotés différemment entre serveur et client).

**Ce qui a été retiré, et pourquoi il ne manque pas** :

| Retiré | Il ne manque pas parce que… |
|---|---|
| La palette parallèle `folderColor` / `SLUG_COLOR` / `DOT_COLORS` | la couleur d'un domaine est sa bande, une seule source (`lib/folders`), sur le mois, la miniature et la modale de tâche comme partout |
| « Semaine du 12 oct. » | « Octobre 2026 », le mois, dans la même graphie que la vue mois ; le rail montre les dates |
| Le tiret « — » d'une tâche sans heure | le vide dit qu'il n'y a pas d'heure ; le tiret disait « donnée manquante » |
| « Glissez une tâche d'un jour à l'autre pour la replanifier. » | une tâche se replanifie aussi depuis sa fiche ; le glissé reste pour qui le connaît |
| « Aujourd'hui » sur le mois courant | un bouton sans effet se retire ; hors du mois courant il revient, blanc, pas sur le violet pâle de Relvo |
| Le « ✦ » de « Aucune tâche en retard » | le signe dit « Relvo parle » |
| `agenda-card.tsx`, `segmented-control.tsx`, `kpi-tile.tsx`, `task-card.tsx` | aucun consommateur ; de la matière écartée qui attendait d'être copiée |
| L'orbe, « Comment puis-je vous aider ? », « Posez votre question… » | Relvo parle en premier, dans son bloc signé ; trois façons de dire « parlez » |
| Les invites « congélateur de Narbonne » et « Karim » | des données de démonstration écrites en dur : sur un vrai compte, une fausse bulle |
| Le composer propre à l'échange, son micro et son trombone | le composer est celui des conversations, le seul que M10 branchera |
| « NOUVELLE CONVERSATION » et le bouton Historique | un seul état avant M10 ; une porte vers une page vide est un bouton sans effet (la page reste dans le dépôt) |
| La puce « Contexte : Accueil » | elle ne changeait rien aux invites ; depuis un sujet, la puce porte le titre, jamais le code |
| Le toast « La conversation avec Relvo arrive en M10. » | « Relvo ne répond pas encore dans cet écran. » — jamais un code de sprint devant le client |

**Ce qui a changé de forme** : les lentilles comptent ce que leurs listes montrent ; la case
d'une tâche a 44 px de frappe sans grossir, « Répondre » 36 px, « Aujourd'hui » et « Demain »
en mots ; le jour vide est une carte comme sur l'accueil ; le mois : en-têtes en libellé,
chiffres condensés, hors-mois en gris lisible, dépôt en fond enfoncé, appui long avant de
glisser (comme la semaine), chevrons à 44 px ; le switch Semaine / Mois a 44 px de frappe ;
l'échange s'ouvre sur un bloc de Relvo et ses invites en liens fléchés, le squelette a la
silhouette du ciel ; les deux contextes de glissé portent un identifiant stable (plus
d'erreur d'hydratation).

**À arbitrer par le dirigeant** : **la forme du mois**. Soixante-neuf puces de 45 × 21 px,
texte blanc tronqué sur l'aplat du domaine, c'est le camion de foire que le brief refuse ; la
forme juste serait une grille en carte, chaque case un chiffre et jusqu'à trois pastilles de
domaine, le tap qui sélectionne le jour et la liste du jour sous la grille (la grammaire de
la semaine), le glissé depuis la liste vers une case. L'invariant 15 (couleur par domaine,
replanification par glissement) reste tenu ; ce qui change, c'est ce qu'on glisse. **Confié à
plus tard** : le mois du jour sélectionné dans le sous-titre (état client à remonter) ; une
seule liste du jour avec les rendez-vous en tête plutôt que deux lentilles sur la même
journée (question de périmètre) ; la première phrase du bloc de Relvo calculée (les nouvelles
de l'accueil) quand M10 s'y pose.

### Le menu, Canaux, Profil, Préférences, Usage et la connexion

**Ce que la critique a dit.** Les quatre pages du menu n'avaient pas reçu la direction au
même degré que les onglets : primitives du registre non adaptées (`Card` à anneau sans ombre
de carte, interrupteur de 18 px, champs et boutons de 36 px), textes à 12–13 px en graisse
fine, et aucune première carte qui chevauche le ciel. Canaux : l'encart « E-mail et WhatsApp
sont connectés » s'affichait sous quatre canaux « en attente » (il testait l'existence, pas
le statut) ; **l'action la plus destructrice du produit** était une corbeille nue de 32 px sur
chaque ligne ; l'invite était un choix technique à quatre cases (Gmail, Outlook, IMAP,
WhatsApp) avant même de savoir pourquoi confier son courrier ; « Reconnecter » un glyphe de
rotation seul. Profil : trois cartes, trois descriptions qui redisaient trois titres, « Se
déconnecter » en rouge et en double (le menu l'a déjà), un champ « Mot de passe actuel
(aucun) » désactivé. Préférences : **trois interrupteurs sans effet** qui répondaient « arrive
bientôt ». Usage : « 32 % » à 44 px, plus gros que le titre de page ; dit trois fois ;
l'encart de démonstration en ambre d'Externe ; une **erreur d'hydratation reproductible** —
le composant de jauge du registre formate son texte ARIA selon la locale du processus
(« 32% » sur le serveur, « 32 % » sur un téléphone en français). Menu : l'avatar de Moi
peint avec le dégradé du disque de Relvo, la page courante non marquée, « Se déconnecter » à
22 px au ras du bord. Connexion : le ciel s'arrêtait net sur un violet clair sans fondu ;
trois accroches pour dire « bienvenue » ; « Oublié ? » à 12 px gris, le lien le plus utile du
public qui oublie ses mots de passe. Scores Nielsen 17/36 (Canaux), 22 (Profil), 20
(Préférences), 20/32 (Usage), 22 (menu), 23 (connexion).

**Ce qui a été retiré, et pourquoi il ne manque pas** :

| Retiré | Il ne manque pas parce que… |
|---|---|
| L'encart « sont connectés. Supprimez un canal… » | il mentait ; l'absence de bouton d'ajout dit déjà qu'on ne peut plus ajouter, le retrait vit en pied, nommé |
| La corbeille sur chaque ligne de canal | « Retirer un canal… » en pied de page, rouge, fait choisir le canal puis confirme en le nommant — la destruction ne se tient pas à douze pixels d'un badge |
| Les quatre tuiles techniques et leurs deux paragraphes | un bouton « Connecter ma boîte e-mail », et le choix Gmail / Outlook / une autre boîte vient après le « oui », dans une feuille ; WhatsApp en second, son avertissement dans sa feuille |
| « Aucun canal connecté. » | le vide est un bloc de Relvo qui dit pourquoi relier une boîte — c'est là que la première connexion aboutit (M19.9) |
| La carte « Session » et ses deux boutons | l'e-mail est dans le champ, « Se déconnecter » au pied du menu ; la réinitialisation de la démo est une commande de démonstration, en pied de page |
| Les descriptions sous les titres du Profil | les champs le disent ; seule reste la phrase du compte Google sans mot de passe |
| Le champ « Mot de passe actuel (aucun) » | un champ désactivé n'est pas une information |
| Brief quotidien, Notifications push, Lecture vocale, et leur toast | ils ne faisaient rien ; ils reviennent avec leur fonction (tranche 5, M10), pas avec une excuse |
| Le sous-titre « Votre part du plafond mensuel » et la première phrase du paragraphe | « Ce mois-ci » et « 32 % » se comprennent seuls ; ne reste que la phrase qui désamorce la peur du plafond |
| « Votre assistant de messagerie » et « Accédez à votre espace Relvo. » | le ciel a fait la promesse ; la carte nomme la tâche : « Connexion », « Créer un compte » |
| Le glyphe de rotation « Reconnecter » | une puce qui dit son mot, à la place du badge d'état quand le canal n'est pas connecté |

**Ce qui a changé de forme** : les champs et les boutons du registre à 44 px partout ;
l'interrupteur à 48 px, activé en dégradé de Relvo ; les premières cartes des quatre pages
chevauchent le ciel ; l'avatar du menu est bleu (Moi), son en-tête ouvre le Profil, la page
courante est marquée au fond enfoncé, fermer et se déconnecter se frappent au pouce ; la
ligne de rattrapage des Canaux en 14 px violet (c'est Relvo qui parle), « ignorée » au lieu
de « en sourdine » ; la jauge du registre fixe sa locale (plus d'erreur d'hydratation),
dégradé de Relvo sur fond puce ; l'encart de démonstration en gris ; le ciel de la connexion
fond vers le blanc, « Oublié ? » en 14 px violet avec 44 px de frappe, « E-mail » en
français, le bandeau de succès aux tokens. `DESIGN.md` écrit le mot-marque à 40 px et les
formulaires à 44 px.

**Confié à plus tard** : une alerte ailleurs que sur Canaux quand une boîte reste « en
attente » (l'accueil, dans la voix de Relvo) ; dire sur l'accueil que l'assistant est coupé ;
la date de remise à zéro de l'Usage quand le compteur sera réel ; le nom d'un canal quand V1
n'en autorise qu'un par type.

**M19.6 est livré** : les douze écrans de la liste sont passés par la méthode. Reste M19.10.

## Tranché à la reprise de la tranche 3 — la première connexion (M19.9)

Le dirigeant ajoute à la tranche 4 une **séquence de première connexion** : cinq ou six
**diapositives à glisser**, une phrase courte chacune, qui disent ce que Relvo fait — du
contexte, pas un mode d'emploi — ; puis le **guidage**, qui invite à connecter sa première
adresse e-mail. L'échange scripté (M10.16) reste la prise en main et commence à la connexion de
ce canal : les diapositives y conduisent, elles ne le remplacent pas. La décision et ce qu'elle
a retenu contre quoi sont dans `ecarts` (« La première connexion s'ouvre sur des
diapositives ») ; `01-principes.md` §11, `05-ia.md` §11.11 et le brief disent la séquence.
La trace « vues une fois » est une colonne du compte, migration accordée (ci-dessus).

## La robustesse commence par le téléphone (M19.10)

Le dirigeant a testé la tranche 3 en production, sur son iPhone, et a renvoyé cinq captures.
Chaque point est un défaut qu'aucune capture à 390 px en headless n'avait montré — ou que
j'avais regardé sans le voir. Les cinq sont corrigés dans le même commit.

1. **Le ciel d'un écran poussé empilait quatre étages** (fil d'une conversation : la flèche
   seule, le titre, les puces, la carte du sujet). La flèche tient désormais la **ligne du
   titre**, qui replie dans sa colonne — sur toutes les fiches, le gain est une rangée de 46 px.
   Dans le fil, le canal est une **icône** (son mot n'ajoutait rien), et le sujet suivi tient
   sur **une ligne** : la bande, le domaine en capitales, le titre. Le HTML d'un e-mail
   d'invitation débordait de sa carte : les cellules en `nowrap` sont repliées de force.
2. **Le fondu du ciel était brutal** : violet → blanc en 44 px, arrêté au bord du header. Le
   ciel finit maintenant sur sa **lueur** (`--ciel-bas`), et sa **queue** (`.ciel-queue`, 56 px,
   sans hauteur dans le flux) s'éteint dans le blanc **sous** ce qui suit — carte, en-tête de
   zone, bloc de Relvo. Le fondu dure deux fois plus longtemps sans coûter un pixel. Quand le
   ciel est fixe (conversation, échange), la queue se pose en tête de ce qui défile : sinon elle
   voilerait les messages. Écrit dans `03-patterns.md` et `DESIGN.md`, tenu par le test des
   tokens.
3. **Fiche sujet** : les compteurs des onglets, à droite des icônes, élargissaient l'onglet et
   « 50 » sortait de la carte. Le compteur est un **badge sur l'icône**, coin haut droit, comme
   sur un téléphone ; le point rouge du non-lu tient l'autre coin (`02-composants.md`). Le
   « Résumé » n'est plus signé Relvo : que Relvo l'ait rédigé va de soi sur une fiche qu'il
   tient. « Urgent » en pointillé est validé par le dirigeant.
4. **Calendrier** : le cercle du jour sélectionné, décollé de 4 px, mordait sur la lettre du
   jour et sur le point ; il est au ras du chiffre (40 px), le cercle de l'indicateur ne change
   pas. Et une tâche créée par le « + » du ciel se propose **au jour sélectionné** dans le rail :
   un petit magasin client (`selected-day.ts`) relie les deux îlots.
5. **Fiche contact** : le dirigeant a été étonné de n'y voir que le numéro. La carte redevient
   la **fiche entière** — Prénom, Nom, Entreprise, Téléphone(s), Email(s), « Non renseigné »
   quand il manque — ; un numéro appelle et une adresse écrit, par le disque au bout de la
   ligne. L'entreprise n'est plus redite dans le ciel.

**Deuxième retour, le même jour.** Le fondu corrigé restait court : le dirigeant veut celui des
**planches** de la direction, où le dégradé est celui de la page entière et où le violet clair
atteint le blanc 150 px sous le header, sous les cartes. C'est désormais la queue du ciel : le
header finit sur le violet clair, la queue fait 150 px. Et la fiche contact « n'était pas au
standing de Relvo » : elle redevient une **carte de visite** — le portrait au centre du ciel
(initiales, ou la silhouette d'un visage), le nom, le rôle que Relvo a écrit et l'entreprise ;
la note de Relvo sur l'interlocuteur dans son bloc (le champ existait, aucun écran ne le
montrait) ; puis tous les champs. Le portrait appelle une photo : proposition « La photo d'un
contact » dans `ecarts`, sans bouton tant que le geste n'existe pas.

**Le pire cas, par les formulaires.** Les données extrêmes sont entrées par les écrans de
l'application, à la frontière réelle (actions, Zod) : trois contacts (« Aleksandra
Wiśniewska-Kowalczyk » avec l'adresse de 63 caractères, « Jo » sans rien, « María José de la
Cruz y Fernández »), deux sujets (un titre de 200 caractères, la limite du domaine, et
« Benachrichtigungseinstellungen »), deux tâches longues ; puis chaque écran à 390 et 320 px,
les compteurs forcés à 999 par injection (inféré, pas la frontière des données), et cinq écrans
à 1280 px. Un compte neuf, inscrit par le formulaire, a donné les seize écrans vides.

Ce qui a cassé, et la correction :

1. **Créer un sujet à la main renvoyait une erreur 500** sur le compte de démonstration. La
   séquence des références prend le maximum *lexicographique* de « SUB-… » ; le jeu de
   démonstration porte des références à quatre chiffres (« SUB-0219 »), qui passent devant
   « SUB-00220 » dans l'ordre des chaînes : la deuxième création reproposait 220 et cassait sur
   l'unicité. La référence calculée est désormais sondée et avance tant qu'elle est prise ; un
   test fixe le cas des paddings mélangés.
2. **Un titre de 200 caractères prenait sept lignes** dans le ciel de la fiche. Le `line-clamp`
   du titre n'opérait pas à travers le bouton d'édition en place : le texte se borne lui-même à
   trois lignes, le titre entier reste dans le champ d'un appui.
3. **Un compte neuf lisait « Rien à trier · toutes vos conversations sont couvertes »** : faux,
   rien n'est arrivé. Quand le compte n'a aucune conversation, Relvo le dit dans son bloc et
   mène à Canaux.
4. **À 320 px, « Calendrier » devenait « Cale… »** derrière le segmented : sous 360 px, les
   actions de page passent sur une ligne à elles, le burger reste sur celle du titre.
5. Trois textes sous 14 px encore en graisse 300 (Recherche, Bilan) passent en 400.

Ce qui a tenu : les noms longs et les adresses sans espace (repli, troncature au bon endroit),
les initiales (« J » pour Jo, « AW »), les compteurs à trois chiffres dans les indicateurs, les
badges d'onglet et les pastilles, les cartes à 320 px, le repli desktop (colonne centrée), les
seize écrans vides. Le sombre est couvert par le code : rien ne lit `prefers-color-scheme`
hors du suivi public, les captures sont toutes en sombre émulé (#51). Android : `theme_color`,
`viewport-fit=cover` et la zone sûre du dock sont en place, rien à changer côté page (#54). En
pleine lumière, la règle « sous 14 px jamais 300 » est tenue par le code, à vérifier au soleil
par le dirigeant.

**Confié à plus tard** : la Recherche ne cherche que les sujets (« Aucun sujet pour
« Northwind » » alors qu'un contact porte ce nom) — le périmètre de `/recherche` est un item
fonctionnel, pas de robustesse ; l'état vide de Sujets et de Contacts en texte nu, à mettre
dans la voix de Relvo avec les états vides qui guident (M19.9).

**M19.10 est livré.**

**Hors code** : le nom de famille d'un contact rempli par une adresse e-mail (« Carole
carole.garat@… ») est une erreur d'extraction de Relvo, corrigée à la main par le dirigeant ;
à surveiller dans M7 (le contact déduit d'un expéditeur sans nom).

## Le langage de mouvement (M19.8)

Le mouvement arrive en dernier, comme prévu : on n'anime pas ce qu'on va retirer, et la
tranche 3 a retiré beaucoup. La règle d'Emil Kowalski qui gouverne tout : **une animation se
juge d'abord à sa fréquence**. Ce qu'on touche trente fois par jour — un onglet du dock, un
segmented, un indicateur — ne s'anime pas ; ce qu'on voit de temps en temps — une feuille, un
menu, un écran poussé — s'anime court et sort vite ; seul ce qu'on voit une fois — les
premiers pas, la carte vivante — a le droit d'être vu. D'où les **quatre durées**
(`--dur-presse` 120 ms, `--dur-court` 160, `--dur-moyen` 240, `--dur-accompagnement` 480) et
les **trois courbes** (`--courbe-sortie`, la `cubic-bezier(0.23, 1, 0.32, 1)` forte pour tout
ce qui entre ou sort ; `--courbe-deplacement` pour ce qui se déplace ; `--courbe-feuille`, la
courbe iOS, pour une feuille). Les utilitaires Tailwind partent d'eux-mêmes sur la durée courte
et la courbe de sortie (`--default-transition-*`) : un composant n'a plus rien à dire.

**Cinq primitives**, en opacité et `transform` seulement : `.apparait` (ce que le serveur livre
après coup monte de 6 px ; `.apparait-liste` échelonne de 35 ms — l'accueil, Sujets,
Conversations, Mémoire, Canaux), `.entre-ecran` (un écran poussé entre de la droite, par
`<Screen entree>` — fiches, créations, recherche, l'échange), les feuilles et menus du registre
(la feuille sur `moyen`/`feuille`, dialogues et menu sur `court`/`sortie`), `.pressable` en
transition sur la durée d'appui, `.arrive` (un chiffre qui change) et `.respire` (Relvo
travaille, la seule boucle — elle remplace le `animate-bounce` du composer). Le mode réduit du
téléphone ramène tout à un fondu, primitives du registre comprises (tw-animate-css n'en sait
rien). **Ce qui ne s'anime pas** est écrit dans `01-tokens.md`, et le **test des tokens tient
la doctrine** : aucune durée ni courbe littérale dans un composant, jamais `transition-all`,
jamais `ease-in`, jamais `animate-bounce` — y compris dans les primitives du registre, qui
sont adaptées au thème comme les autres (`transition-all` nommé propriété par propriété dans
dix fichiers de `ui/`).

**La relecture.** Le skill `review-animations` n'est pas installé (les douze d'Emil retenues ne
le comprennent pas) ; la relecture a été faite par un agent isolé avec sa table « never ship »,
sur le diff et les fichiers. Rien de bloquant ; trois défauts réels corrigés : l'échelonnement
survivait au mode réduit (une media query n'ajoute pas de spécificité, `:nth-child(n)` la
remonte) ; l'accordéon du registre sautait de 0 à auto (tw-animate n'écoute que les variables
de Radix, Base UI expose `--accordion-panel-height` — images-clés récrites) ; l'entrée de
l'échange était posée sur le cadre entier, qui débordait de 16 px pendant un quart de seconde.
Et trois ajustements : `width` seul sur la barre de progression, la durée d'appui sur le
`Button` du registre, la doc qui disait « moyen » là où le code dit « court ». **Limite
assumée** : un retour arrière rejoue l'entrée de droite — le CSS ne connaît pas le sens de la
navigation. **Non mesuré** : `animation-performance` sur un téléphone d'entrée de gamme ; ce
qu'on sait par le code, c'est que tout est en `transform`/`opacité` hors les deux cas tolérés
(le repli d'une ligne glissée en `max-height`, la barre de progression en `width`), et qu'aucune
variable CSS n'est animée sur un parent. La mesure se fera sur le téléphone du dirigeant.

## Les premiers pas (M19.9)

**Les diapositives.** Un compte qui n'a jamais vu les diapositives ne voit pas le chrome : le
groupe `(app)` l'envoie sur `/bienvenue`, hors dock. Le ciel plein (`--ciel-plein`, sans
fondu), « Passer » en haut à droite, six diapositives à glisser en `scroll-snap` natif — pas
de bibliothèque, le pouce fait ce qu'il fait partout —, chacune une illustration faite de
**morceaux du produit** et une phrase. Les textes sont ceux du dirigeant, relus en retour de la
première version : « Je fais le tri dans vos messages et je vous avertis quand une affaire
mérite votre attention » · « Je prends les devants » (un e-mail qui devient une affaire
urgente, puis ses tâches à cocher, reliés par des flèches) · « Vos priorités, chaque jour » ·
« Je prépare vos réponses… rien ne part sans votre accord » · « Le disque au centre, c'est
moi ! » · « J'apprends vite » (l'entrée Mémoire du menu et une instruction retenue). Du
contexte, pas un mode d'emploi : aucune n'explique un écran. Les diapositives disent déjà
« affaire » ; le mot pour le reste du produit est une proposition dans `ecarts`. La septième est
l'**invitation**, un bloc de Relvo sur le ciel avec
l'**étape-formulaire** des trois boîtes (la même liste que Canaux, exportée) et « Plus tard ».
« Passer » mène à l'invitation, pas hors de la séquence : l'invitation est le but. La trace
`welcome_seen_at` est posée par le domaine (`markWelcomeSeen`, idempotent) — la seule
migration que M19 s'accorde, additive — ; le compte de démonstration naît avec la trace (il a
déjà ses boîtes). Seule surface à la durée d'accompagnement : l'illustration se pose quand sa
diapositive devient courante.

**Le piège trouvé en vérifiant.** « Plus tard » posait la trace et ne ramenait pas à
l'accueil : la `redirect("/")` de l'action retombait sur le **cache du routeur**, qui avait
mémorisé « / » comme une redirection vers `/bienvenue` — c'est par là que le compte était
arrivé — pendant `staleTimes.dynamic`. L'action rend la main et le client fait une navigation
complète (`window.location.replace`), qui repart de zéro — `PITFALLS.md` #60. L'autre, #61 :
le client Prisma d'un serveur de développement déjà lancé ignore une colonne ajoutée tant
qu'on ne le relance pas (`db.account.updateMany` refusait `welcomeSeenAt` après
`pnpm db:generate`).

**Le guidage, sur les surfaces qui existent.** Quatre écrans recopiaient le bloc de Relvo à la
main ; il est désormais UN composant, `RelvoBlock`, avec sa phrase et son lien fléché, et
trois formes y vivent — la phrase, l'**étape-formulaire** (`EtapeFormulaire` : une question,
deux à quatre options blanches à filet de 48 px, une réponse secondaire en texte) et la **carte
vivante** (`CarteVivante` : la phrase qui dit où Relvo en est, trois compteurs qui se posent
quand ils changent, les trois points qui respirent tant qu'il lit). M13.2 et M10.16 les
consommeront ; ils ont déjà chacun un consommateur réel : la dernière diapositive, et la page
des canaux, où la ligne de rattrapage sous chaque boîte devient une carte vivante sous la liste
(la page se rafraîchit tant que Relvo lit). Les **états vides guident** dans la voix de Relvo,
et distinguent « rien n'est encore arrivé » (aucune boîte reliée : la phrase mène à Canaux) de
« rien à montrer » : les nouvelles de l'accueil, les sujets ouverts, l'annuaire, les
conversations, les boîtes. Validés et fermés gardent leur texte nu, qui enseigne le geste. Le
nombre de boîtes vient du cache tenant (`cachedChannelCount`) ; relier ou retirer une boîte
l'invalide. L'ouverture du premier sujet et la présentation du bouton Relvo n'ont pas de
surface à eux : le premier sujet est dit par le bloc des nouvelles (« ouvert 1 sujet »), le
bouton par la cinquième diapositive — l'échange scripté (M10.16) fera le reste.

**Vérifié** : un compte neuf inscrit par le formulaire, les six diapositives, « Plus tard »,
puis l'accueil, Sujets, Contacts, Conversations, Canaux et le Calendrier vides, en 390 px
sombre émulé, zéro erreur console (`premiers-pas.mjs` dans le scratchpad) ; les huit écrans de
démonstration après le langage de mouvement, zéro erreur ; les 305 tests. **À vérifier par le
dirigeant** : la séquence sur son iPhone (il verra les diapositives une fois, son compte n'a
pas la trace), le geste de glissé, et le choix d'une boîte jusqu'à Canaux.

## Le mot du dirigeant : « affaire » (tranché le jour même)

À la lecture des diapositives, le dirigeant a tranché le mot : **« affaire »**, pas « sujet ».
« Sujet » est impersonnel ; une affaire parle à tout le monde, on *traite* des affaires, et
c'est ce qu'on fait avec Relvo. La décision est dans `ecarts` ; la livraison a suivi dans la
journée, en un chantier à part, parce qu'un mot qui change à moitié est pire qu'un mot qui ne
change pas. **Trois périmètres.** Le mot de l'utilisateur, partout où il le lit ou l'entend :
les libellés (l'onglet du dock, « Nouvelle affaire », « ouvertes · validées · fermées », les
états vides, les toasts, les confirmations, les invites de l'échange, la devise de la
connexion), les phrases de Relvo (les nouvelles, le brief, les suggestions, la carte vivante),
les titres du journal et les messages d'erreur du domaine (« Affaire SUB-0219 créée »,
« Relvo a relu l'affaire », « Aucune affaire ouverte… »), les champs client des épiques,
`CLAUDE.md`, et la conception récrite **en place** — `01` à `05`, le design system,
`uml.mermaid` pour ses libellés, `DESIGN.md`, `PRODUCT.md` — par trois agents isolés avec
les mêmes règles, relus sur le diff. **Ce qui ne bouge pas** : `Subject` et ses routes
(`/sujets`, `/fil`, `sans-sujet`), les identifiants, les invariants numérotés, les commentaires
du code, l'historique (sprints, journal du client, registre). **Les consignes du modèle**
gardent « sujet » comme nom de concept — deux cents occurrences, un vocabulaire que les jeux
d'évaluation ont appris — et reçoivent une règle dans le socle : tout texte destiné au
dirigeant dit « affaire ». À confirmer par `eval:*` à leur prochaine passe ; sept tests du
domaine qui citaient un titre de journal ont été mis à jour, rien d'autre n'a bougé.

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
      par écran : ✅ Accueil · ✅ Conversations · ✅ Sujets et fiche Sujet · ✅ Mémoire,
      domaine, Contacts et fiche contact · ✅ Calendrier et Échange · ✅ menu, Canaux, Profil,
      Préférences, Usage, connexion — **M19.6 livré** · ⏳ M19.10 robustesse : ✅ les cinq
      retours du téléphone (ciel, étages, badges d'onglet, Calendrier, fiche contact) · ✅ le
      fondu des planches, la fiche contact en carte de visite · ✅ le pire cas par les
      formulaires, le compte vide, 320 px, 999, desktop, sombre, Android — **M19.10 livré**
- [x] Tranche 4 — « Guider » : ✅ M19.8 langage de mouvement (quatre durées, trois courbes,
      cinq primitives, mode réduit, cliquet dans le test des tokens, relecture faite) · ✅ M19.9
      premiers pas — diapositives de première connexion, invitation en étape-formulaire, bloc
      de Relvo partagé, carte vivante sur Canaux, états vides qui guident — **livrés, à
      vérifier sur l'iPhone du dirigeant**
- [ ] Tranche 5 — « Clore » : M19.12
