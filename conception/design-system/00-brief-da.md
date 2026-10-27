# Design system — 0. Brief de direction artistique

> **L'entrée unique de toute direction artistique.** Ce fichier dit *ce qu'est le produit*, *à qui
> il s'adresse*, *quel registre viser*, *ce qui est verrouillé* et *ce qui est libre*, et il nomme
> **la direction en place**. Une direction se construit à partir de lui et de rien d'autre :
> **ce qui n'y est pas écrit sera réinventé.** Les valeurs des tokens vivent dans
> [`01-tokens.md`](01-tokens.md) et dans le code ; les règles de composition dans
> [`02-composants.md`](02-composants.md) ; la disposition dans [`03-patterns.md`](03-patterns.md).
> Ce brief ne les recopie pas.
>
> **Ce qu'on attend d'une direction** : une identité visuelle distinctive — couleurs,
> typographie, matière, profondeur, mouvement, composants signature — **pas une refonte des
> flux**, qui sont tranchés. On part de la disposition pour poser la matière.

---

## 1. Le produit en une phrase

**Relvo est un assistant qui transforme le flux désordonné de messages reçus par un dirigeant —
e-mails, messagerie — en affaires métier structurées**, avec tâches, journal de bord et aide à la
décision. Ce n'est ni une boîte mail, ni un CRM, ni un outil de notes : c'est un **agent** auquel
on parle, qui range et fait avancer les affaires en cours à votre place.

L'unité centrale n'est pas le message mais l'**Affaire** : un espace de travail qui rassemble
messages, pièces jointes, tâches et événements autour d'une *situation métier en cours de
traitement* (« Rupture sauce blanche », « Contrôle hygiène annoncé »).

## 2. L'objectif

- **Réduire la charge mentale** d'un dirigeant débordé de sollicitations. La promesse doit être
  **lisible immédiatement** : on ouvre l'app, on voit l'essentiel sans poser de question.
- **Faire ressentir que Relvo agit** — pas un tableau de bord passif de plus, mais un copilote qui
  a déjà préparé des tâches et des brouillons de réponse.
- **Inspirer confiance** : un dirigeant confie ses échanges professionnels à cet outil.
  L'esthétique doit être *rassurante, sérieuse, premium* — sans être froide ni
  corporate-bureautique.
- **Prendre par la main** : un produit encore vide n'est pas une suite de panneaux muets. Les
  premiers pas se font dans l'échange avec Relvo, et chaque état vide guide au lieu de constater.

## 3. À qui on s'adresse — le cœur du brief

**Public cible : dirigeants des secteurs food et bâtiment.** Concrètement : le gérant d'une
franchise de restauration rapide (le persona de référence, *Tasty Crousty*, poulet, riz et
sauces), un patron d'entreprise de BTP, un restaurateur.

Caractéristiques déterminantes pour la direction artistique :

- **Pas familiers des SaaS bureautiques.** Une barre latérale dense, des tables à colonnes, des
  réglages de power-user les perdent. → **Minimalisme, gros titres, peu d'éléments par écran,
  cibles tactiles généreuses.**
- **À l'aise avec les assistants conversationnels.** Leur modèle mental natif est la
  **conversation**. → La direction doit faire sentir qu'on **dialogue avec un agent**, pas qu'on
  remplit un logiciel.
- **Deux scènes à parts égales.** Debout, en mouvement — cuisine, chantier, camion : une main,
  lumière forte, trente secondes — et posé au bureau, dix minutes pour faire le point et
  répondre. → **Mobile-first strict**, colonne unique, navigation au pouce, lisibilité en pleine
  lumière ; dense quand on est posé.
- **Pressés, peu patients.** L'info doit se lire en trente secondes. → Hiérarchie visuelle forte,
  signal sur bruit maximal, **la rareté est le signal**.

**Registre émotionnel visé** : *calme, premium, rassurant, humain, moderne.* À éviter : le froid
corporate-bleu-SaaS générique, le ludique-gadget, la densité dashboard-analytics, et **l'aplat
d'informations** — un écran de texte et de filets sans zone délimitée, où l'utilisateur est
perdu. On veut quelque chose qui respire, avec une **personnalité chaleureuse mais sérieuse** —
l'app d'un assistant de confiance, pas d'un ERP. Le dirigeant trouve lourd ce qui est dense,
contrasté sans raison, et ce qui porte plus que ce qui sert : une direction allège autant
qu'elle habille, **mais alléger n'est pas aplatir**.

## 4. La posture produit qui guide toute l'UI

Deux invariants gouvernent chaque écran. Ils ne sont pas négociables, ils orientent la direction.

1. **« L'UI sert à accéder à l'info, Relvo sert à agir. »** L'essentiel des actions passe par
   l'**échange** avec Relvo, une surface plein écran atteinte depuis le **bouton central du
   dock**, présent au même endroit sur toutes les pages. Les écrans structurés sont des
   *destinations* où l'on creuse — pas le centre de gravité.
2. **Mobile-first, agent au centre.** L'**Accueil** est un **brief** en quatre zones, dans cet
   ordre : *Dernières nouvelles* (dans la voix de Relvo, avec sa question en attente), *Activité*,
   *Aujourd'hui*, *En attente de vous*. Il ne duplique aucune vue et ne porte aucune barre
   d'indicateurs. La page des **tâches** est le **Calendrier**.

**La disposition est tranchée** et ne se rouvre pas dans une direction artistique :

- **Cinq places dans le dock** : Accueil · Calendrier · **Relvo** · Affaires · Conversations. Relvo
  au centre, sans libellé, **le seul objet coloré du dock**, plus haut que lui, la pilule se
  soulevant autour de lui pour qu'il en fasse partie ; il porte un badge quand Relvo attend une
  réponse.
- **Un menu latéral**, ouvert par le burger, discret, à droite du header, pour tout ce qu'on
  ouvre moins d'une fois par jour : Bilan, Mémoire, Contacts, Canaux, Profil, Préférences, Usage,
  et Rechercher en dernier. Toute page du menu porte le burger ; la flèche retour, à gauche, est
  réservée aux écrans poussés. Les boutons propres à une page se posent **à droite** du header,
  avant le burger.
- **Il n'y a pas de zone de saisie permanente** en bas d'écran : l'accès à Relvo est le bouton
  central, le composer n'existe que dans l'échange et dans une conversation, où il prend la
  place du dock.
- **Relvo parle en premier** : ce qu'il attend de l'utilisateur est une question persistée, qui
  porte le badge du bouton, la notification et la ligne de l'accueil ; elle se répond dans
  l'échange, par un formulaire.

Une direction qui veut contester un de ces points le fait **explicitement**, par une entrée du
registre des écarts — jamais par une planche qui le contourne. La disposition ne fixe **ni** la
hauteur du header, **ni** la forme des chiffres, **ni** l'anatomie d'une ligne, **ni** ce qu'une
zone montre en premier : c'est le terrain d'une direction, et une direction qui n'y touche pas
n'est qu'un thème.

**Trois acteurs, un code couleur identitaire.** Le triptyque structure toute la lecture de l'app
et c'est un pilier de la direction : chaque chose affichée vient de quelqu'un, et ce quelqu'un a
une couleur, la même partout.

| Acteur | UI | Couleur sémantique | Sens |
|---|---|---|---|
| L'utilisateur | **Moi** | bleu | ce que je fais |
| L'assistant | **Relvo** | **violet** ✦ | ce que l'agent fait ou suggère |
| Le monde extérieur | **Externe** | ambre | contacts, fournisseurs, clients |

Le **violet est la livrée de Relvo** : il habille le chrome — le ciel du header, le bouton
central, l'action principale — **et** il marque la voix de l'agent. Comme le chrome est violet,
ce qui dit « c'est Relvo qui parle » n'est pas la teinte seule mais **le bloc violet pâle signé
des étoiles** : nouvelles, résumé, brouillon, question. C'est la convention que l'utilisateur
apprend sans qu'on la lui explique, et le fil identitaire à soigner en priorité.

## 5. La direction en place : « Lettrage d'artisan »

Le monde du **camion lettré et de la vitrine de l'artisan** : l'entreprise se reconnaît à sa
bande de couleur et à ses gros chiffres. Une direction se juge d'abord sur un socle que le
dirigeant a verrouillé, puis sur ce que son monde y apporte.

**Le socle, commun à toute direction future :**

- un **header en dégradé** qui fond vers le blanc de l'écran de travail, jamais une barre qui
  s'arrête net ;
- des **zones en cartes** délimitées, posées sur blanc, une ombre portée douce, jamais une carte
  dans une carte ;
- un **dock noir flottant**, décollé du bas, le bouton Relvo plein et coloré au centre ;
- une **police fine**, les graisses réservées aux titres et aux chiffres ;
- des **icônes pleines** ;
- de la **couleur assumée**, qui a un rôle ;
- l'assistant dans des **blocs à part**.

**Ce que le monde apporte, et seulement ça** — typographie, palette, densité, un geste :

- **Le ciel étoilé.** Le header est un ciel à la tombée de la nuit : violet nuit en haut, violet
  de Relvo, puis le blanc. Quelques points fins et trois étoiles à quatre branches, celles du
  signe, qui s'effacent vers le bas. Du CSS, jamais une image. Sur la connexion, le ciel prend
  près de la moitié de l'écran et le signe y flotte.
- **La bande de domaine.** Chaque carte d'affaire et chaque ligne de liste porte sur sa tranche
  gauche la bande pleine de son domaine, et le nom du domaine en capitales condensées de la
  même couleur. Une bande par carte, sur la tranche : multipliées, les bandes font un camion de
  foire.
- **Les gros chiffres.** Les indicateurs, les horaires et les délais sont en condensé, gros
  comme un numéro de téléphone sur un camion ; le texte courant est fin. Une seule famille, deux
  dessins.
- **L'état se lit à la forme**, pas seulement à la couleur : urgent est une pastille pleine, en
  attente une pastille cerclée, en retard un horaire barré.
- **La sélection se montre par un cerclage** : l'indicateur actif est un chiffre cerclé, à
  distance de son libellé, jamais un remplissage qui efface la couleur.
- **Chaque phrase de Relvo pointe sa preuve** : l'affaire, la tâche ou le message dont elle parle
  est un lien sous la phrase.
- **« En attente de vous » se feuillette** : des cartes à faire défiler horizontalement, une par
  affaire, avec le contact, l'enjeu, depuis quand, et le geste — la seule exception voulue à
  « une liste est une suite de lignes dans une carte ».

**Ce que la direction refuse** : le relief nacré, le verre, le grain, le fond pierre, le ruban
décoratif, le cerclage de l'onglet actif du dock, un bouton de l'utilisateur en violet pâle, un
compteur à zéro affiché.

## 6. Contraintes sémantiques verrouillées — à respecter, pas à réinventer

Ces choix portent du **sens métier**. Une direction peut les sublimer (nuances, profondeur,
matière) mais **pas en changer la signification**.

### Les rôles de couleur

Les rôles sont des **décisions**, les teintes sont des **réglages**. Moi bleu, Relvo violet,
Externe ambre, urgent rouge, validé vert, en attente ambre. Une direction qui fait évoluer la
palette **conserve ces associations** ou propose un mapping équivalent explicite. Un bouton de
l'utilisateur n'est jamais en violet pâle signé : ce bloc-là est réservé à la voix de Relvo. La
signification de chaque famille de tokens vit dans [`01-tokens.md`](01-tokens.md).

### Le bouton Relvo

Le produit est plat ; le **bouton Relvo** est le seul objet coloré du dock. Il déborde de la
pilule en haut et en bas, dans son axe, et la pilule se soulève autour de lui en courbe douce,
comme un tissu tendu : il est dans la barre et non posé dessus. Ce qui le désigne, c'est la couleur, pas un
relief : si une tuile ou un panneau se met à briller, ou si un second objet du dock se colore,
on perd « ce qui se détache, c'est Relvo ».

### Le système d'état des affaires — à rendre visuellement, sans le complexifier

- **Statut = cycle de vie à trois valeurs, exclusif.** `ouvert` : l'affaire est en cours, défaut
  à la création, **invisible** — on lit « ouvert » par l'**absence** de badge, parce qu'un badge
  porté par la quasi-totalité des affaires n'informe pas. `validé` : le travail est fait, badge
  **Validé** avec coche. `fermé` : l'affaire est écartée, hors du flux des ouverts. Validés et
  fermés vivent dans leurs onglets et ne sont jamais purgés : on les **remet**.
- **Marqueurs = cumulables, dérivés au calcul, indépendants du statut** : **Nouveau** (affaire
  jamais ouverte, disparaît à l'ouverture de la fiche), **Urgent** (pastille rouge pleine, levée
  seulement sur la priorité `urgent` — **la rareté est le signal** : une ou deux affaires sur
  vingt-quatre), **À faire** (tâches ouvertes), **En attente** (pastille cerclée : on attend un
  retour d'un tiers), **En retard** (une échéance dépassée, l'horaire barré en rouge).
- **Priorité à deux valeurs** : `normal` / `urgent`. Une seule pastille rouge.
- **Le non-lu se compte sur la conversation et sur l'affaire** : une affaire qui a reçu trois
  messages a bougé, et elle porte le chiffre partout où elle se rend, en ligne comme en carte —
  c'est ainsi qu'on le sait sans l'ouvrir.
- **On n'ignore pas une affaire, on ignore une source** : une conversation est `active` ou
  `ignorée`. Les gestes suivent : sur une ligne d'affaire, ← **Fermer** / → **Valider** ; sur une
  ligne de conversation, ← **Ignorer**. Rien n'est détruit, et le vocabulaire le dit.

→ Enjeu de direction : **hiérarchiser ces signaux sans saturer la ligne**. L'urgent doit sauter
aux yeux *parce qu'il est rare*. Le reste reste discret et lisible.

### Les domaines — la Mémoire de Relvo

Les domaines métier (Fournisseurs, Équipe, Administration, Travaux, Clients…) sont présentés
comme la **Mémoire** de Relvo, page du menu, et s'emboîtent comme des dossiers. Chaque domaine
de **premier niveau** a une **couleur** propre, héritée par ses sous-domaines, par leurs affaires
puis par leurs tâches, et manifestée par la **bande** sur la tranche de la carte ou de la ligne :
la couleur dit la famille, le **chemin** écrit au-dessus du titre (« Fournisseurs › Kiloutou »)
dit le rangement précis. La palette de domaines est faite de teintes distinctes et harmonieuses,
lisibles sans lire les titres, chacune avec sa variante de texte qui tient le contraste sur blanc.

### Le rendu par canal

Le rendu d'un message **diverge par canal** et c'est voulu : **bulles** en messagerie, aux
couleurs des acteurs ; **pleine largeur, dans une carte blanche**, en-tête expéditeur +
destinataire + date, en e-mail — un fond teinté fatigue sur du texte long. Le détail de cette
divergence (typographie, en-têtes, séparateurs) est libre ; son principe ne l'est pas.

## 7. Ce qu'une direction habille

La direction produit un **langage de composants** cohérent. L'inventaire vit dans le code
(`apps/web/src/components/`) et les règles de composition dans [`02-composants.md`](02-composants.md) ;
voici les pièces **signature**, celles qui portent l'identité :

**Le chrome**
- Le **dock** noir flottant à cinq places et le **bouton Relvo** en son centre — l'élément
  signature du produit.
- Le **ciel** du header et, sur l'accueil, le **bloc des nouvelles** dans la voix de Relvo.
- La **feuille du menu** latéral.

**Les lignes et les cartes — réutilisées dans les écrans ET dans l'échange**
- La **ligne d'affaire** : bande de domaine, nom du domaine, titre, qui attend quoi, depuis quand.
  **Le composant le plus important du produit.**
- La **carte d'attente** : contact, enjeu, geste, à feuilleter sur l'accueil.
- La **tâche** : présentation unique partout — horaire en condensé à gauche, titre, affaire, case
  ronde quand elle se coche.
- L'**indicateur** cerclé quand il est actif, contextuel par page : tâches sur le Calendrier,
  affaires sur Affaires, jamais les deux lentilles sur un même écran.
- La **carte de liste** : les lignes vivent dans une carte unique, séparées par un filet, jamais
  une carte par ligne.
- La **pastille d'acteur**, les **pastilles d'état** (pleine, cerclée, barrée), la **pastille de
  non-lus**, sur la conversation comme sur l'affaire.
- Le **bandeau « Suivi dans »** en tête d'une conversation : bande de domaine + titre de l'affaire.

**Les surfaces de l'échange**
- L'**échange plein écran** : ciel court avec retour et contexte, blocs de Relvo, bulle de
  l'utilisateur, **composer** et son disque de dictée. C'est le cœur « agent ».
- Le **brouillon de Relvo** prêt dans une conversation, les **blocs d'action**, la **question en
  formulaire** à grosses options.
- Les composants des **premiers pas** : les diapositives de première connexion, la carte
  vivante d'avancement, l'étape-formulaire, les états vides qui guident.

**Un composant rendu par Relvo est celui de l'écran.** Une seule bibliothèque, deux surfaces.

## 8. Ce qui est figé et ce qui est libre

| Figé | Libre — le terrain de jeu d'une direction |
|---|---|
| La disposition : cinq places, Relvo au centre, menu latéral, accueil en brief, Calendrier | Hauteur du header, forme des chiffres, anatomie d'une ligne, ce qu'une zone montre en premier |
| Le socle : dégradé vers le blanc, cartes, dock noir flottant, police fine, icônes pleines, couleur assumée, Relvo en bloc à part | Typographie, palette, densité, et **un** geste signature |
| Les rôles sémantiques de couleur (Moi / Relvo / Externe, urgent, validé, en attente) et le violet livrée et voix | Température et saturation des teintes, la palette de domaines |
| Le bouton Relvo, seul objet coloré du dock, dans son axe, le dock soulevé autour | Sa matière, tant qu'elle reste plate |
| Le statut à trois valeurs, les marqueurs dérivés, la rareté de l'urgent | La forme des pastilles |
| La divergence de rendu par canal | Le détail de cette divergence |
| Mobile-first, colonne unique, cible tactile généreuse, thème clair | Densité, espacements |
| Stack : Tailwind v4 + shadcn/ui sur Base UI — la direction reste **implémentable en tokens CSS et en variants** | Tout le reste |

> **Contrainte d'implémentation.** La direction se traduit en **design tokens** (variables CSS :
> couleurs, typographie, rayons, élévations, durées et courbes) et en **variants de composants**,
> jamais en maquettes figées. **Aucune valeur en dur dans un composant** : l'inventaire des tokens
> est tenu par un test, pas par la vigilance.

## 9. Ce sur quoi une direction se juge, et ce qu'elle livre

- **Rendue en navigateur avant d'être montrée.** Une planche qui n'a pas été regardée n'existe
  pas.
- **L'application elle-même**, avec le compte de démonstration : les captures du point zéro, au
  format téléphone, en mode sombre émulé — l'iPhone du dirigeant est en mode sombre et l'app est
  claire seulement, c'est là que les dérives se voient.
- **Trois écrans héros** d'abord — **Accueil** (la vitrine de l'identité et la voix de Relvo),
  **Affaires** (la ligne d'affaire, brique centrale), **Échange** (l'âme agent) — puis **tous les
  écrans** : une direction qui ne tient pas sur les trois premiers ne tiendra pas ailleurs, et
  une direction validée sur trois écrans se vérifie sur les seize autres.
- **De vraies données**, à volumes plausibles : les planches portent les données de
  démonstration ; la direction se vérifie ensuite sur le compte du dirigeant, avec ses longs noms
  et ses listes vides. La maquette (`../mockup/`) porte les flux et les libellés ; **ses données
  sont de la démonstration** et ne dimensionnent rien.
- **Le nom caché** : l'écran se lit-il comme un produit de sa catégorie, mieux fini que les
  références du dirigeant et plus distinctif ? Les zones sont-elles nettes, la hiérarchie
  évidente, le geste signature trouvable au premier regard ?

Une direction livre **un monde nommé** (ce qu'il apporte, ce qu'il refuse), **une palette mappée
sur les rôles**, **une typographie**, **une matière**, **un geste signature**, **les composants
signature habillés** et **les écrans rendus**. Plusieurs directions se comparent visuellement
avant de converger, sur un socle commun ; une seule survit dans `conception/`, les autres ne
vivent que dans l'artefact des planches. La décision, et ce qu'elle a retenu contre quoi, vit
dans le registre des écarts.

---

### Données de référence — pour peupler des exemples réalistes

Cas *Tasty Crousty* (chaîne de restauration poulet, riz et sauces), dirigeante **Mam's** :
**Karim Benali** (SoGood Distribution, fournisseur — rupture de sauce blanche, décision avant
vendredi) · **Rachid** (équipe — renfort samedi soir) · **Sonia Marchand** (fournisseur — achat
groupé d'huile de friture) · **DDPP Hérault** (administration — contrôle hygiène, relevés de
températures) · **Metro Pro** (fournisseur — livraisons) · **ClimaPro** (administration —
contrat climatisation) · un **devis de friteuse à Montpellier** (travaux) · **AS Épinay
Football** (communication — partenariat).
