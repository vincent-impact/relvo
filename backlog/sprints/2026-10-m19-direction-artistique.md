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

## Où on en est

- [x] Tranche 1 — « Voir » : ✅ M19.1 brief au présent · ✅ M19.2 point zéro · ✅ M19.3 la
      direction « Lettrage d'artisan » retenue par le dirigeant sur la page de décision
      d'impeccable, dix-neuf écrans sur le canevas (deux séries avec ui-ux-pro-max écartées
      avant) · ✅ M19.4 décision écrite dans `ecarts`, brief et tokens récrits en place
- [ ] Tranche 2 — « Habiller » : M19.11 outillage (`PRODUCT.md` est posé ; `DESIGN.md` et les
      exceptions du détecteur restent) · M19.5 tokens, tenus par un test · M19.7 composants
      signature · ✅ `02-composants.md` et `03-patterns.md` récrits dans la matière retenue
- [ ] Tranche 3 — « Alléger » : M19.6 écran par écran · M19.10 robustesse
- [ ] Tranche 4 — « Guider » : M19.8 langage de mouvement · M19.9 premiers pas
- [ ] Tranche 5 — « Clore » : M19.12
