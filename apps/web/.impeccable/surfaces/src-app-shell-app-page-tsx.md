---
version: 1
slug: "src-app-shell-app-page-tsx"
primary_target: "src/app/(shell)/(app)/page.tsx"
related_targets: ["src/app/(shell)/(app)/fil/page.tsx","src/app/(shell)/relvo/page.tsx"]
---

# Surface : l'application Relvo (Accueil, Sujets, Échange avec Relvo) — mode Operate, code-led

Portée : la coquille mobile 390 px et ses trois écrans héros ; le dock, le menu et les quatre
zones de l'accueil sont figés (`conception/01-principes.md` §14). Public : dirigeants food et
bâtiment, debout en mouvement ou posés au bureau. Tâche : voir en deux secondes ce qui attend
une décision, et agir via Relvo. Preuves : données Tasty Crousty. Socle verrouillé par le
dirigeant : header en dégradé vers le blanc, zones en cartes, dock noir flottant à bouton
central, police fine, icônes pleines, couleur assumée, Relvo en bloc violet, cartes à défiler
dans « En attente de vous ». La décision et ses corrections vivent dans
`backlog/ecarts-et-propositions.md`, « Une direction artistique : “Lettrage d'artisan” » ; la
matière dans `conception/design-system/` et `DESIGN.md`.

## Direction contract

THESIS: Le camion lettré de l'artisan : l'entreprise se reconnaît à sa bande de couleur et à ses
gros chiffres. Refuse le tableau de bord gris à un accent, et la page plate sans zones.

OWN-WORLD: Livrée violette en trois valeurs (nuit, Relvo, clair) : le header est un ciel étoilé
à la tombée de la nuit qui fond vers le blanc, aucun ruban ; noir du dock ; blanc des cartes
(18 px, ombre portée douce, filet) ; bandes de domaine pleines sur la tranche gauche des cartes
et des lignes, nom du domaine en capitales condensées de la même couleur ; le violet pâle signé
des étoiles est réservé à la voix de Relvo. Une famille : Barlow 300/400/500, Barlow Semi
Condensed 600 pour chiffres, horaires et titres. Sans le texte : un ciel violet qui fond, des
cartes blanches à tranche colorée, un dock noir flottant avec un disque violet au centre.

STORY: Le dirigeant lit la phrase de Relvo, qui pointe sa preuve ; voit ses horaires du jour en
gros ; fait défiler ce qui attend sa décision, chaque carte disant le domaine, qui attend, depuis
quand et si un brouillon est prêt ; appuie sur le disque violet pour agir.

FIRST VIEWPORT: Ciel sur une rangée (date en petites capitales, « Bonjour Mam's » condensé, burger
discret à droite), bloc Relvo violet pâle signé avec lien-preuve et question à répondre, carte
Activité (trois chiffres condensés, « 0 » écrit en gris clair), liste Aujourd'hui (horaire
condensé à droite, retard barré rouge), cartes « En attente de vous » à défiler avec bande de
domaine et état à la forme (pastille pleine ou cerclée), dock noir flottant, disque violet Relvo
au centre, débordant de la pilule qui se soulève autour de lui. Action primaire : le disque Relvo.

FORM: « Lettrage d'artisan », candidate 6 de la liste de sept (ordre de résonance), assignée par
le tirage ; seed 9d6ada01. Relevée par les challengers écartés : état lisible à la forme ;
chaque phrase de Relvo pointe sa preuve ; palette comptée ; une seule famille ; sélection par
cerclage. Corrections du dirigeant intégrées : violet en livrée à la place du bleu de travail,
ciel étoilé à la place du ruban, bouton Relvo plat et réaxé dans le dock, onglet actif du dock
sans cerclage. Exceptions assumées au craft floor, écrites dans `DESIGN.md` : la bande colorée
sur la tranche des cartes est le geste signature du monde, pas un border-left décoratif ; le
violet est sémantique (livrée et voix), pas un dégradé violet-bleu d'interface générée ; le
relief unique est le débordement du disque Relvo.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, DESIGN.md, and every shipping raster carrying its provenance
