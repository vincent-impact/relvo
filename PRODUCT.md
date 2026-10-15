# Product

<!-- impeccable:product-schema 1 -->

> Fichier d'outillage pour impeccable. La vérité produit vit dans `conception/` ; ce fichier la
> résume et pointe, il ne la remplace jamais. En cas de contradiction, `conception/00-sources.md`
> dit qui a raison.

## Platform

web

## Users

Dirigeants de petites entreprises des secteurs **food** (restauration, traiteur, distribution)
et **bâtiment**. Peu familiers des SaaS bureautiques, à l'aise avec les assistants
conversationnels. Ils reçoivent un flux désordonné d'e-mails et de messages WhatsApp de
fournisseurs, clients, équipes et administrations, et doivent décider vite.

Scène d'usage, à parts égales : **debout, en mouvement** (cuisine, chantier, camion : une main,
lumière forte, trente secondes) **et posé, au bureau** (matin ou soir, dix minutes pour faire le
point et répondre). Le brief se lit en mouvement ; les réponses se font posé.

Voir `conception/01-principes.md` §1–§3.

## Product Purpose

Relvo transforme le flux de messages reçus en **affaires métier structurées**, avec tâches, journal
de bord et aide à la décision. Succès : le dirigeant sait chaque matin ce qui attend sa décision,
répond sans chercher, et ne laisse rien tomber.

## Positioning

« **L'UI sert à accéder à l'info, Relvo sert à agir.** » Relvo lit les messages, ouvre et
rattache les affaires, prépare des brouillons qui citent leurs sources, et **pose des questions**
quand il hésite. Le dirigeant tranche ; Relvo n'envoie jamais seul. Voir `conception/05-ia.md`.

## Operating Context

- Canaux d'entrée : e-mail et WhatsApp via un agrégateur ; un fil e-mail *est* une affaire, un fil
  WhatsApp s'écoute entre deux ancres.
- Surfaces : PWA mobile-first, installée sur l'écran d'accueil, portrait verrouillé, viewport
  verrouillé. Dock bas à **cinq places** (Accueil · Calendrier · **Relvo** au centre · Affaires ·
  Conversations), menu latéral pour le reste. Table des routes dans `CLAUDE.md`.
- Accueil = brief en quatre zones : dernières nouvelles (Relvo parle en premier) · activité ·
  aujourd'hui · en attente de vous. Calendrier = la page des tâches. Affaires = indicateurs qui
  sélectionnent la liste. Conversations = seule surface d'affichage et de réponse d'un fil.
- Jeu de données de référence : la société de démonstration **Tasty Crousty** (`pnpm db:seed`).

## Capabilities and Constraints

- Invariants produit numérotés, domicile unique `conception/01-principes.md` §14 ; aucune
  direction ne les contredit. Les cinq verrous de disposition : dock, quatre zones et leur ordre,
  Relvo parle en premier, deux familles de chiffres séparées, usage en pourcentage.
- Statut d'une affaire : trois valeurs (ouvert, validé, clos) ; priorité : deux valeurs (normal,
  urgent) ; marqueurs dérivés, jamais saisis.
- Stack : Next.js (App Router), Tailwind v4, shadcn/ui sur **Base UI**. Thème **clair seulement**
  (`PITFALLS.md` #51). Un composant se cherche d'abord dans le registre shadcn.
- Terminologie : affaire, conversation, tâche, domaine, Mémoire, brief, canal. « Relvo » est le
  nom de l'assistant *et* du produit.

## Brand Commitments

- **Rôles de couleur** (`conception/design-system/00-brief-da.md` §5) : le violet est la voix de
  Relvo ; triptyque Moi / Relvo / Externe ; le relief est unique et réservé au bouton Relvo.
- **Socle visuel verrouillé** par le dirigeant à partir de quatre références (captures dans le
  scratchpad de session, jamais dans le dépôt) : header en **dégradé qui fond vers le blanc** du
  corps ; zones en **cartes** délimitées ; **dock noir flottant** (décollé du bas, par-dessus la
  page) avec le bouton principal **au centre** ; **police fine**, légère ; icônes pleines ;
  couleur assumée ; l'IA s'exprime dans des blocs à part. Toutes les directions partent de là.
- **Ouvert** : le signe de Relvo (les étoiles, la centrale plus grosse) et la matière de son
  bouton peuvent être redessinés par une direction.
- Geste retenu des planches précédentes : les **cartes à faire défiler horizontalement** dans
  « En attente de vous ».

## Evidence on Hand

- Captures « point zéro » des dix-huit écrans actuels (scratchpad, hors dépôt) et leur relevé
  dans `backlog/sprints/2026-10-m19-direction-artistique.md`.
- Données de démonstration Tasty Crousty (affaires, contacts, conversations, tâches réels de
  forme). Pas de témoignage client, pas de chiffre d'usage réel : ne rien fabriquer.
- Logo Relvo : SVG des étoiles dans `apps/web/src/components/`.

## Product Principles

1. L'info s'atteint en un geste ; l'action passe par Relvo.
2. Relvo parle en premier et pose des questions ; il n'agit jamais seul vers l'extérieur.
3. Ce qui attend le dirigeant prime sur ce qui s'est passé.
4. Lisible debout, en plein soleil, à une main ; dense quand on est posé.
5. Un écran se lit comme un produit de sa catégorie : zones nettes, hiérarchie évidente.

## Accessibility & Inclusion

Public peu familier des logiciels : libellés en français courant, cibles larges, contrastes
tenus en lumière forte. Pas de norme contractuelle établie.
