# Design system — 0. Brief de direction artistique

> **L'entrée unique de toute direction artistique.** Ce fichier dit *ce qu'est le produit*, *à qui
> il s'adresse*, *quel registre viser*, *ce qui est verrouillé* et *ce qui est libre*. Une
> direction se construit à partir de lui et de rien d'autre : **ce qui n'y est pas écrit sera
> réinventé.** Les valeurs des tokens vivent dans [`01-tokens.md`](01-tokens.md) et dans le code ;
> les règles de composition dans [`02-composants.md`](02-composants.md) ; la disposition dans
> [`03-patterns.md`](03-patterns.md). Ce brief ne les recopie pas.
>
> **Ce qu'on attend d'une direction** : une identité visuelle distinctive — couleurs,
> typographie, matière, profondeur, mouvement, composants signature — **pas une refonte des
> flux**, qui sont tranchés. On part de la disposition pour poser la matière.

---

## 1. Le produit en une phrase

**Relvo est un assistant qui transforme le flux désordonné de messages reçus par un dirigeant —
e-mails, messagerie — en sujets métier structurés**, avec tâches, journal de bord et aide à la
décision. Ce n'est ni une boîte mail, ni un CRM, ni un outil de notes : c'est un **agent** auquel
on parle, qui range et fait avancer les affaires en cours à votre place.

L'unité centrale n'est pas le message mais le **Sujet** : un espace de travail qui rassemble
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
- **Sur téléphone, une main.** En cuisine, sur un chantier, en déplacement. → **Mobile-first
  strict** : colonne unique, navigation au pouce, lisibilité en pleine lumière.
- **Pressés, peu patients.** L'info doit se lire en trente secondes. → Hiérarchie visuelle forte,
  signal sur bruit maximal, **la rareté est le signal**.

**Registre émotionnel visé** : *calme, premium, rassurant, humain, moderne.* À éviter : le froid
corporate-bleu-SaaS générique, le ludique-gadget, la densité dashboard-analytics. On veut quelque
chose qui respire, avec une **personnalité chaleureuse mais sérieuse** — l'app d'un assistant de
confiance, pas d'un ERP. Le dirigeant trouve lourd ce qui est dense, contrasté sans raison, et ce
qui porte plus que ce qui sert : une direction allège autant qu'elle habille.

## 4. La posture produit qui guide toute l'UI

Deux invariants gouvernent chaque écran. Ils ne sont pas négociables, ils orientent la direction.

1. **« L'UI sert à accéder à l'info, Relvo sert à agir. »** L'essentiel des actions passe par
   l'**échange** avec Relvo, une surface plein écran atteinte depuis le **bouton central de la
   barre d'onglets**, présent au même endroit sur toutes les pages. Les écrans structurés sont
   des *destinations* où l'on creuse — pas le centre de gravité.
2. **Mobile-first, agent au centre.** L'**Accueil** est un **brief** en quatre zones, dans cet
   ordre : *Dernières nouvelles* (dans le header, dans la voix de Relvo, avec au plus deux
   suggestions qui ouvrent l'échange), *Activité*, *Aujourd'hui*, *En attente de vous*. Il ne
   duplique aucune vue et ne porte aucune barre d'indicateurs. La page des **tâches** est le
   **Calendrier**.

**La disposition est tranchée** et ne se rouvre pas dans une direction artistique :

- **Cinq places dans la barre d'onglets** : Accueil · Calendrier · **Relvo** · Sujets ·
  Conversations. Relvo au centre, plus gros, sans libellé, **le seul objet en relief du
  produit** ; il porte un badge quand Relvo attend une réponse.
- **Un menu latéral**, ouvert par le burger à gauche du header, pour tout ce qu'on ouvre moins
  d'une fois par jour : Bilan, Mémoire, Contacts, Canaux, Profil, Préférences, Usage, et
  Rechercher en dernier. Toute page du menu porte le burger ; la flèche retour est réservée aux
  écrans poussés. Les boutons propres à une page se posent **à droite** du header.
- **Il n'y a pas de zone de saisie permanente** en bas d'écran : l'accès à Relvo est le bouton
  central, le composer n'existe que dans l'échange et dans une conversation.
- **Relvo parle en premier** : ce qu'il attend de l'utilisateur est une question persistée, qui
  porte le badge du bouton, la notification et la ligne de l'accueil ; elle se répond dans
  l'échange, par un formulaire.

Une direction qui veut contester un de ces points le fait **explicitement**, par une entrée du
registre des écarts — jamais par une planche qui le contourne.

**Trois acteurs, un code couleur identitaire.** Le triptyque structure toute la lecture de l'app
et c'est un pilier de la direction : chaque chose affichée vient de quelqu'un, et ce quelqu'un a
une couleur, la même partout.

| Acteur | UI | Couleur sémantique | Sens |
|---|---|---|---|
| L'utilisateur | **Moi** | bleu | ce que je fais |
| L'assistant | **Relvo** | **violet** ✦ | ce que l'agent fait ou suggère |
| Le monde extérieur | **Externe** | ambre | contacts, fournisseurs, clients |

Le **violet** est la voix de l'agent : tout ce qui émane de Relvo le porte — nouvelles, brouillon
suggéré, tâche proposée, question, badge de suggestions. C'est la seule convention que
l'utilisateur apprend sans qu'on la lui explique, et le fil identitaire à soigner en priorité.

## 5. Contraintes sémantiques verrouillées — à respecter, pas à réinventer

Ces choix portent du **sens métier**. Une direction peut les sublimer (nuances, profondeur,
matière) mais **pas en changer la signification**.

### Les rôles de couleur

Les rôles sont des **décisions**, les teintes sont des **réglages**. Une direction est libre de
retravailler température et saturation, d'introduire un accent chaud pour le côté food et humain,
**tant que les rôles restent lisibles** : Moi froid et bleu, Relvo violet, Externe ambre, urgent
rouge, validé vert. Si elle fait évoluer la palette, elle **conserve ces associations** ou
propose un mapping équivalent explicite. Le violet ne se dilue pas : un bouton de l'utilisateur
n'est jamais violet. La signification en place de chaque famille de tokens vit dans
[`01-tokens.md`](01-tokens.md).

### Le relief

Le produit est plat ; le **bouton Relvo** est l'unique objet en relief. Si une tuile ou un
panneau brille, on perd « ce qui brille, c'est Relvo ». Quelle que soit la direction, le relief
ne s'étend pas.

### Le système d'état des sujets — à rendre visuellement, sans le complexifier

- **Statut = cycle de vie à trois valeurs, exclusif.** `ouvert` : l'affaire est en cours, défaut
  à la création, **invisible** — on lit « ouvert » par l'**absence** de badge, parce qu'un badge
  porté par la quasi-totalité des sujets n'informe pas. `validé` : le travail est fait, badge
  **Validé** avec coche. `fermé` : l'affaire est écartée, hors du flux des ouverts. Validés et
  fermés vivent dans leurs onglets et ne sont jamais purgés : on les **remet**.
- **Marqueurs = cumulables, dérivés au calcul, indépendants du statut** : **Nouveau** (sujet
  jamais ouvert, disparaît à l'ouverture de la fiche), **Urgent** (drapeau rouge, levé seulement
  sur la priorité `urgent` — **la rareté est le signal** : un ou deux sujets sur vingt-quatre),
  **À faire** (tâches ouvertes), **En attente** (on attend un retour d'un tiers), **En retard**
  (une échéance dépassée).
- **Priorité à deux valeurs** : `normal` / `urgent`. Un seul drapeau rouge.
- **La pastille de non-lus se lit sur la conversation**, là où les messages arrivent, jamais sur
  le sujet.
- **On n'ignore pas un sujet, on ignore une source** : une conversation est `active` ou
  `ignorée`. Les gestes suivent : sur une ligne de sujet, ← **Fermer** / → **Valider** ; sur une
  ligne de conversation, ← **Ignorer**. Rien n'est détruit, et le vocabulaire le dit.

→ Enjeu de direction : **hiérarchiser ces signaux sans saturer la ligne**. L'urgent doit sauter
aux yeux *parce qu'il est rare*. Le reste reste discret et lisible.

### Les domaines — la Mémoire de Relvo

Les domaines métier (Fournisseurs, RH, Juridique…) sont présentés comme la **Mémoire** de Relvo,
page du menu. Chacun a une **couleur** propre, héritée par ses sujets puis par leurs tâches, et
manifestée par un **rail** à l'intérieur de la ligne. La direction définit cette palette de
domaines : des teintes distinctes et harmonieuses, lisibles sans lire les titres.

### Le rendu par canal

Le rendu d'un message **diverge par canal** et c'est voulu : **bulles** en messagerie ; **pleine
largeur, fond blanc dans les deux sens**, en-tête avatar + expéditeur + date, en e-mail — un fond
teinté fatigue sur du texte long. Le détail de cette divergence (typographie, en-têtes,
séparateurs) est libre ; son principe ne l'est pas.

## 6. Ce qu'une direction habille

La direction produit un **langage de composants** cohérent. L'inventaire vit dans le code
(`apps/web/src/components/`) et les règles de composition dans [`02-composants.md`](02-composants.md) ;
voici les pièces **signature**, celles qui portent l'identité :

**Le chrome**
- La **barre d'onglets** basse, fixe, à cinq places, et le **bouton Relvo** en son centre —
  l'élément signature du produit.
- Le **header** et, sur l'accueil, le **panneau des nouvelles** dans la voix de Relvo.
- La **feuille du menu** latéral.

**Les lignes et les tuiles — réutilisées dans les écrans ET dans l'échange**
- La **ligne de sujet** : icône de domaine, référence, titre, résumé, marqueurs, progression des
  tâches. **Le composant le plus important du produit.**
- La **tâche** : présentation unique partout — case, titre, sujet, rail de domaine, heure ou
  date en colonne droite.
- La **tuile KPI**, contextuelle par page : tâches sur le Calendrier, sujets sur Sujets, jamais
  les deux lentilles sur un même écran.
- Le **panneau de liste** : les lignes vivent dans un panneau unique, séparées par un filet,
  jamais une carte par ligne.
- La **pastille d'acteur**, les **badges et marqueurs** (Validé, Nouveau, Urgent, À faire, En
  attente, suggestions), la **pastille de non-lus** sur la conversation.
- Le **bandeau « Suivi dans »** en tête d'une conversation : pastille de domaine + titre du sujet.

**Les surfaces de l'échange**
- L'**échange plein écran** : header avec retour et chip de contexte, **état vide** (orbe ✦ et
  invites), **composer** auto-grow. C'est le cœur « agent » — soigner l'orbe comme élément
  d'identité.
- Le **brouillon de Relvo** dans le composer d'une conversation, les **blocs d'action**
  annulables, la **question en formulaire**.
- Les composants des **premiers pas** : la carte vivante d'avancement, l'étape-formulaire, les
  états vides qui guident.

**Un composant rendu par Relvo est celui de l'écran.** Une seule bibliothèque, deux surfaces.

## 7. Ce qui est figé et ce qui est libre

| Figé | Libre — le terrain de jeu de la direction |
|---|---|
| La disposition : cinq places, Relvo au centre, menu latéral, accueil en brief, Calendrier | Couleurs (température, accents), profondeur, ombres, matière, grain, verre |
| Les rôles sémantiques de couleur (Moi / Relvo / Externe, urgent, validé) et le violet voix de l'agent | **Typographie** : famille(s), échelle, graisses — la direction en place est une seule famille, une direction peut la contester en le disant |
| Le relief réservé au bouton Relvo | Iconographie, illustrations, micro-interactions, **langage de mouvement** |
| Le statut à trois valeurs, les marqueurs dérivés, la rareté de l'urgent | Forme et rayon des surfaces, style des badges, signature de l'orbe ✦ |
| La divergence de rendu par canal | Le détail de cette divergence |
| Mobile-first, colonne unique, cible tactile généreuse | Densité, espacements, ambiance générale (clair ou sombre, chaud ou froid) |
| Stack : Tailwind v4 + shadcn/ui sur Base UI — la direction reste **implémentable en tokens CSS et en variants** | Tout le reste |

> **Contrainte d'implémentation.** La direction se traduit en **design tokens** (variables CSS :
> couleurs, typographie, rayons, élévations, durées et courbes) et en **variants de composants**,
> jamais en maquettes figées. **Aucune valeur en dur dans un composant** : l'inventaire des tokens
> est tenu par un test, pas par la vigilance.

## 8. Ce sur quoi une direction se juge

- **L'application elle-même**, avec le compte de démonstration : les captures du point zéro, au
  format téléphone, en mode sombre émulé — l'iPhone du dirigeant est en mode sombre et l'app est
  claire seulement, c'est là que les dérives se voient.
- **Trois écrans héros**, rendus en planches au format téléphone : **Accueil** (la vitrine de
  l'identité et la voix de Relvo), **Sujets** (la ligne de sujet, brique centrale), **Échange**
  (l'âme agent). Une direction qui ne tient pas sur ces trois-là ne tiendra pas ailleurs.
- **De vraies données.** Les planches portent les données de démonstration ; la direction retenue
  se vérifie ensuite sur le compte du dirigeant, avec ses volumes, ses longs noms et ses listes
  vides.
- La maquette (`../mockup/`) porte les flux et les libellés ; **ses données sont de la
  démonstration** et ne dimensionnent rien.

## 9. Ce qu'une direction livre

1. **Un parti-pris nommé** : registre, inspiration, et **ce qu'elle refuse**.
2. **Une palette mappée sur les rôles sémantiques** du §4 et §5, un **couple typographique**,
   une **matière** (fond, surfaces, profondeur), un **langage de mouvement** (durées, courbes, ce
   qui ne s'anime pas).
3. **Les composants signature habillés**, en priorité la ligne de sujet, la tuile KPI, le bouton
   Relvo, le header et le panneau des nouvelles, le composer et l'orbe ✦, les badges et la
   pastille d'acteur.
4. **Les trois écrans héros** rendus dans la direction.

**Plusieurs directions se comparent visuellement avant de converger** — c'est la valeur d'une
exploration en amont du code. Parmi elles, la direction en place **poussée au bout** sert de
témoin ; une direction qui conteste un choix verrouillé **le dit et le justifie**. Une seule
survit dans `conception/` : les autres ne vivent que dans l'artefact des planches.

---

### Données de référence — pour peupler des exemples réalistes

Cas *Tasty Crousty* (chaîne de restauration poulet, riz et sauces) : **Karim Benali** (SoGood
Distribution, fournisseur — sauce blanche) · **Sophie Blanchard** (RH — congé maternité) ·
**ClimaPro Services** (juridique — contrat climatisation) · **Restaurant Le Palais** (client —
virement) · **PackPlus SARL** (fournisseur — emballage) · **FroidExpert SA** (production — panne
congélateur Narbonne).
