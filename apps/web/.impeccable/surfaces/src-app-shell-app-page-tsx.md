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
dirigeant le 2026-10-12 : header en dégradé vers le blanc, zones en cartes, dock noir flottant
à bouton central, police fine, icônes pleines, couleur assumée, Relvo en bloc violet, cartes à
défiler dans « En attente de vous ».

## Direction contract

THESIS: Le camion lettré de l'artisan : l'entreprise se reconnaît à sa bande de couleur et à ses
gros chiffres. Refuse le tableau de bord gris à un accent, et la page plate sans zones.

OWN-WORLD: Bleu de travail #1f4fd8 en header (dégradé vers le blanc, un seul ruban oblique fin),
noir #111 du dock, blanc des cartes, bandes de domaine (Fournisseurs orange, Équipe vert,
Administration bleu, Travaux jaune, Clients rouge) sur la tranche des cartes, violet #5d4de8
réservé à la voix de Relvo. Une famille : Barlow 300/400, Barlow Semi Condensed 600 pour chiffres
et titres. Cartes 18 px, ombre portée douce. Sans le texte : un header bleu qui fond, des cartes
blanches à tranche colorée, un dock noir flottant.

STORY: Le dirigeant lit la phrase de Relvo, qui pointe sa preuve ; voit ses horaires du jour en
gros ; fait défiler ce qui attend sa décision, chaque carte disant le domaine, qui attend, depuis
quand et si un brouillon est prêt ; appuie sur le disque bleu pour agir.

FIRST VIEWPORT: Header bleu (avatar à gauche, burger discret à droite, date, « Bonjour Mam's »),
bloc Relvo violet pâle avec lien-preuve et question à répondre, carte Activité (86 · 4 · 12 en
condensé), liste Aujourd'hui (horaire condensé à gauche, retard barré rouge), cartes « En attente
de vous » à défiler avec bande de domaine, dock noir flottant, disque bleu Relvo au centre avec
badge. Action primaire : le disque Relvo.

FORM: « Lettrage d'artisan », candidate 6 de la liste de sept (ordre de résonance), assignée par
le tirage ; seed 9d6ada01. Relevée par les challengers écartés : état lisible à la forme ;
chaque phrase de Relvo pointe sa preuve ; palette comptée ; une seule famille ; sélection par
cerclage. Exception assumée au craft floor : la bande colorée sur la tranche des cartes est le
geste signature du monde, pas un border-left décoratif.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, DESIGN.md, and every shipping raster carrying its provenance
