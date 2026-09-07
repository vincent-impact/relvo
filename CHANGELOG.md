# Journal des versions

<!-- Généré par scripts/generate-changelog.mjs (`pnpm changelog`).
     Ne pas éditer à la main : toute correction se fait dans le pied
     de message `Client:` du commit concerné, puis on régénère. -->

## 2026-09-07

- **Corrigé** — le fond droit recouvrait le gauche — mauvaise couleur, aucun libellé
- **Corrigé** — le proxy n'était jamais compilé — pièges #5b ET #5c
- **Corrigé** — ramener eslint à zéro erreur — la CI l'exigeait sans jamais l'avoir exécuté
- **Corrigé** — le clavier Android n'écrase plus le composer
- **Nouveau** — un geste, une surface — retours des premiers bêta-testeurs

## 2026-07-29

- **Nouveau** — régénérer le jeu Tasty Crousty pour le modèle M6quater

## 2026-07-28

- **Nouveau** — retour de la fiche contact → l'origine (conversation / liste)
- **Corrigé** — reconnaître un contact enregistré APRÈS la création d'une conversation
- **Corrigé** — pastille de statut ne chevauche plus le titre + un seul canal/type
- **Nouveau** — retour d'une conversation de groupe → onglet Groupes de l'annuaire
- **Nouveau** — fiche contact en « carte de visite » plein écran
- **Nouveau** — fiche contact — tous les champs visibles + actions dans le dock
- **Nouveau** — rattacher les entrants aussi sur les coordonnées secondaires
- **Nouveau** — menu (Conversations + Contacts icônes) & fiche contact multi-valeurs
- **Nouveau** — Contacts remplace Mémoire dans la nav ; Mémoire → onglet Domaines des Réglages
- **Corrigé** — e-mail — le fil cité était dans le HTML, jamais nettoyé
- **Corrigé** — e-mail entrant — retrait du fil cité même newlines aplaties
- **Nouveau** — fiche sujet — compteur conversations + point rouge, onglet Infos « fiche »
- **Nouveau** — fiche sujet — 4 ajustements UX (onglet Conversations + onglet Infos)

## 2026-07-27

- **Corrigé** — connexion/reconnexion en échec → toast, plus 500 silencieux
- **Nouveau** — reconnecter un canal sans perdre ses données + pastille honnête
- **Corrigé** — un échec d'envoi remonte en toast, plus en 500 silencieux
- **Corrigé** — ne plus scinder un fil e-mail en « conversation où l'on se parle seul »
- **Nouveau** — UI — deux onglets par canal (E-mail / Messagerie)
- **Nouveau** — rattachement auto in-set + détachement e-mail
- **Nouveau** — clé e-mail par SET de destinataires
- **Nouveau** — schéma — set de destinataires e-mail sur Conversation

## 2026-07-24

- **Nouveau** — barre KPI à 3 onglets par statut (Ouverts/Validés/Fermés)
- **Nouveau** — barre unique KPI-onglets (Agenda / En retard / À trier)
- **Corrigé** — l'ajout de conversation ne se réinitialise plus au PollRefresh
- **Corrigé** — retirer le retour auto E-mail après 7s dans l'ajout de conversation
- **Nouveau** — onglet Fermés + dock d'actions par statut (Fermer/Valider/Réouvrir/Supprimer)
- **Nouveau** — onglets Documents + Conversations comptés, Informations enrichi, détacher, multi-sujets
- **Corrigé** — canal en sous-ligne, avatars par type de contact, dédup interlocuteurs, filtres
- **Nouveau** — ajouter une conversation depuis un sujet (item 4)
- **Nouveau** — conversations — icône canal, filtre par canal, header enrichi (interlocuteurs + détacher), onglet Groupes

## 2026-07-23

- **Corrigé** — onglets par conversation (jamais de mélange), icône domaine fidèle, placeholder juste
- **Nouveau** — décision DANS le fil — cordon WhatsApp, Ouvrir/Lier, dialog création
- **Nouveau** — onglet Messages + KPI-onglets Sujets + filtre par domaine
- **Corrigé** — conversation — scroll H de secours, icône +, canal en clair, avatar cliquable
- **Corrigé** — dock d'action violet sur la conversation (chrome Relvo, pas CTA e-mail)
- **Corrigé** — e-mail responsive — viewport interne = largeur réelle de l'iframe
- **Corrigé** — conversation — contexte dans le hero, boutons d'action, e-mails sans scroll H
- **Nouveau** — correctifs conversations + sujets (mobile-first, préservation horizontale)

## 2026-07-22

- **Nouveau** — fiche sujet homogène — e-mails pleine largeur + HTML, comme le fil
- **Nouveau** — rendu HTML fidèle des e-mails dans un iframe isolé
- **Nouveau** — swipe droite email — « nouveau sujet » OU « rattacher à un existant »
- **Nouveau** — confirmation nommant les sujets au swipe gauche d'un fil écouté
- **Nouveau** — fiche sujet — ligne de sélection de conversation + feuille des écoutes
- **Nouveau** — gestes par canal — swipe droite conversation (email) / message (WhatsApp)
- **Nouveau** — rendu par canal + bandeau « Suivi dans » — le cordon disparaît
- **Nouveau** — écoute à deux bornes — primitive à ancre optionnelle, balayage email complet

## 2026-07-20

- **Corrigé** — filtre canal retiré, pop-up message uniformisée, titre éditable
- **Corrigé** — référence dérivée du maximum, plus du nombre de sujets
- **Nouveau** — entité Conversation — le sujet devient une fenêtre ancrée
- **Corrigé** — détection de groupe robuste + destinataire « Groupe » dans le composer
- **Corrigé** — balayage des frères orphelins hors transaction (évite P2028)
- **Nouveau** — navigation — balayage orphelins, groupes WhatsApp, liens, fiche contact

## 2026-07-18

- **Corrigé** — composer — trombone conservé + placeholder sur une seule ligne
- **Nouveau** — composer mobile — plus de largeur pour le texte
- **Nouveau** — nom de profil comme label + avatars cohérents (initiales partout)
- **Nouveau** — PJ inline dans le fil (miniature image) + masque la bulle vide
- **Corrigé** — PJ WhatsApp (attachment_id réel), label = numéro, anti-loop is_sender
- **Corrigé** — canal WhatsApp affiche le numéro (identifier générique) + log diag PJ/sender
- **Nouveau** — ingestion WhatsApp via Unipile (réception, rattachement par fil, envoi)

## 2026-07-17

- **Corrigé** — le webhook invalide le Data Cache → le polling voit enfin les messages
- **Nouveau** — visualiseur de PJ adapté mobile — lightbox image / navigateur PDF
- **Corrigé** — PJ cliquables + rattachées au sujet ; polling anti-cache (M12.3)
- **Corrigé** — bouton Supprimer invisible au survol + tuile WhatsApp « Bientôt »
- **Nouveau** — suppression d'un canal (hard-delete) + déconnexion Unipile
- **Corrigé** — email sortant en HTML — préserve sauts de ligne, espaces, tabs
- **Nouveau** — rattachement auto des emails (interlocuteur+objet) + corps sans fil cité
- **Corrigé** — réponse entrante crashait en 500 + composer email multi-ligne
- **Nouveau** — envoi sortant câblé + pré-sélection provider + webhook account_status

## 2026-07-16

- **Nouveau** — ingestion email via Unipile (backbone unifié email + WhatsApp)

## 2026-07-15

- **Corrigé** — embarquer les fixtures de démo dans le bundle Vercel
- **Corrigé** — content-type non signé + checksum du vide ; -170 lignes
- **Nouveau** — affichage inline des fichiers + durcissement du cache
- **Nouveau** — storage_key, routes upload/download, outbox de suppression
- **Nouveau** — package @relvo/storage — Cloudflare R2 derrière une interface

## 2026-06-28

- **Nouveau** — conversations par interlocuteur (composer ciblé, onglet Conversations)
- **Corrigé** — agenda reflète l'édition d'une tâche + Enregistrer conditionnel
- **Nouveau** — verrou portrait — voile en paysage sur téléphone
- **Corrigé** — hauteur de cadre = max des métriques viewport (footer surélevé au boot)
- **Corrigé** — hauteur de cadre fiable en standalone iOS + zoom bloqué
- **Corrigé** — modale clippée, overdue après déplacement, jours plus grands, KPI plus bas, slide PWA
- **Nouveau** — miniature de drag centrée, sujet cliquable, modale (pastille + croix)
- **Nouveau** — rail entre case/texte, sync coche+badges, miniature drag fixe
- **Nouveau** — rail de jours à scroll continu + drop au curseur + rail de couleur
- **Nouveau** — semainier slidable + drag&drop, fin de l'onglet En retard
- **Nouveau** — colonne heure/date, En retard par plages, modale d'ajout unifiée
- **Nouveau** — cases à cocher, sujet nullable, présentation unifiée groupée par jour
- **Nouveau** — TaskItem unifié swipable, nav Actions/Sujets, Contacts → Réglages
- **Nouveau** — Accueil = page des tâches (KPI + 3 onglets), KPI sujets sur Mon fil

## 2026-06-27

- **Nouveau** — KPI Urgents/Nouveaux/Ouverts → Mon fil filtré
- **Nouveau** — filtres unifiés + « Nouveau » devient un marqueur dérivé
- **Nouveau** — garde anti-rebond iOS minimale (touchmove non-passif)
- **Corrigé** — body en violet pour fondre la bande de safe-area sous le dock
- **Corrigé** — hauteur du cadre via --app-height (JS) au lieu de 100dvh
- **Nouveau** — Mon fil — loupe + filtres rapides (Urgent/Nouveaux/Domaines)
- **Corrigé** — rubber-band iOS neutralisé en JS (fin de la bande blanche)
- **Corrigé** — MobileFrame en h-full (colle au body épinglé) — fin de la bande blanche
- **Corrigé** — body épinglé en position fixed (bande blanche + rubber-band)
- **Corrigé** — retire height:100% du verrou document (bande blanche sous le dock)
- **Corrigé** — dock fixe — verrouille le document contre le rubber-band iOS
- **Corrigé** — violet réservé à Relvo (hors palette domaines) + scroll prioritaire au tap
- **Corrigé** — SubjectRow — icône domaine à gauche (réduite), retrait du rail
- **Corrigé** — polish Accueil (brief, lignes de sujet, header, tab bar)
- **Corrigé** — ajustements fiche sujet (header, badges, urgence, composer)
- **Corrigé** — fiche sujet plus compacte + ajustements
- **Nouveau** — accès Relvo via bouton header + tab bar fixe violette

## 2026-06-26

- **Nouveau** — progress bar d'avancement dans le hero du sujet
- **Nouveau** — création de tâche en modale (cohérence UX avec l'édition)
- **Corrigé** — tap sur une tâche ouvre la modale d'édition
- **Nouveau** — tâches au premier plan + lignes de sujets simplifiées (façon e-mail)
- **Nouveau** — badge « Nouveau » + instructions en page dédiée + seed étoffé ; retrait chip « suggérée »
- **Corrigé** — bump des clés de cache (v2) — KPI « Nouveaux » vide après changement de forme
- **Nouveau** — édition du logo d'un domaine existant (M9.20)
- **Nouveau** — Mémoire — domaines personnalisables (logo) + instructions éditables/activables (M9.20)
- **Nouveau** — KPIs Accueil cohérents temps réel + réordonnés (Urgents/Nouveaux/Ouverts/Tâches)
- **Nouveau** — Contact prénom + nom (migration name → first_name/last_name)
- **Nouveau** — annuaire Contacts (recherche + sections alpha + ajout) ; recherche = sujets uniquement
- **Nouveau** — Contacts en onglet de premier rang + tunnel auth Direction B (M9.20→M9.23)

## 2026-06-25

- **Corrigé** — maxDuration 300s sur Réglages — évite le timeout du reset démo (115 tâches)
- **Nouveau** — jeu de démo étoffé Tasty Crousty / Mam's Diallo (M9.24)
- **Corrigé** — zéro erreur ESLint (apostrophes JSX, refs au render, import mort)

## 2026-06-24

- **Corrigé** — icônes in-app nettes depuis la source 2048px (alpha préservé)
- **Corrigé** — icônes PWA nettes — régénérées depuis la source 2048px
- **Corrigé** — icône PWA sur fond blanc opaque + logo réduit (~82%, marge)
- **Nouveau** — status bar immersive (black-translucent + bandeau) + loading instantané
- **Nouveau** — ajoute meta mobile-web-app-capable (parité maquette PWA)
- **Nouveau** — config PWA — manifest standalone + meta iOS (apple-web-app)
- **Nouveau** — écrans mobile-first + flux messages/agenda/tâches
- **Nouveau** — design system « Direction B » — chrome mobile-first + primitives
- **Nouveau** — messages orphelins, statut ignoré, priorité 2 niveaux, hard-delete tâche

## 2026-06-21

- **Nouveau** — M9 Phase A — pages applicatives mobile-first
- **Nouveau** — refonte modèle statut/marqueurs + provisioning compte démo

## 2026-06-18

- **Corrigé** — descendre la tabbar près du bord (placement façon Tinder)
- **Corrigé** — safe-areas iOS en standalone (plus de bandes grises)
- **Nouveau** — aide d'installation iOS plus explicite
- **Nouveau** — PWA installable (manifest, SW, icônes, meta standalone)

## 2026-06-10

- **Nouveau** — M3 — modèle de données & accès CRUD (couche domaine partagée)

## 2026-06-09

- **Nouveau** — M2 — authentification & multi-tenant (Auth.js v5)
