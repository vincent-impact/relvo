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
  les toasts (#51) n'ont pas été déclenchés. Un avertissement d'hydratation s'affiche en console
  de développement sur l'accueil (attributs serveur/client différents), à regarder avant la
  tranche 2.

## Où on en est

- [ ] Tranche 1 — « Voir » : M19.1 brief au présent · M19.2 point zéro · M19.3 quatre
      directions sur planches (Accueil, Sujets, Échange) · M19.4 décision écrite
- [ ] Tranche 2 — « Habiller » : M19.11 outillage · M19.5 tokens, tenus par un test · M19.7
      composants signature
- [ ] Tranche 3 — « Alléger » : M19.6 écran par écran · M19.10 robustesse
- [ ] Tranche 4 — « Guider » : M19.8 langage de mouvement · M19.9 premiers pas
- [ ] Tranche 5 — « Clore » : M19.12
