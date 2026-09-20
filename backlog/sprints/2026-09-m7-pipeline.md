# Sprint « Pipeline » — M7, à partir du 14 septembre 2026

## Démarrage à froid — à lire en premier

**Où on en est (2026-09-20)** : les tranches 0 à 8 sont livrées ; les tranches 0 à 7 sont
**vérifiées en production**, la tranche 8 est **livrée en code, à vérifier en production** (un
brouillon réel avec une instruction de domaine → « Basé sur » ; le journal relu par
`pnpm --filter web ia:journal` sur la base de production). La tranche 8, le durcissement, a
livré : **un appel raté coûte et se journalise** (entrée trop longue refusée avant l'appel,
sortie tronquée ou non conforme = échec nommé qui porte sa mesure), **le cache adressé et
mesuré** (clé par compte, rétention longue, préfixe stable consigné, rapport des silencieux —
mesuré au banc : tout le préfixe relu sur un message jamais vu, `benchmark-iag.md` §6.10), et
**le brouillon cite ses sources** (schéma de sortie, résolues, stockées dans l'Action, « Basé
sur » sous la barre du composer). **La prochaine tranche est la 9, le rattrapage en lot.**
Le plafond de dépense sur la clé OpenAI est posé (100 € par mois) ; le cadre économique des
bêta-testeurs est arrêté (voir `ecarts`, « Un disjoncteur de consommation par compte ») et
M14.5 le traduira en seuils par compte. Restent ouverts en arrière-plan : essayer `none` sur la
relecture avec le jeu réel, reprogrammer une tâche
d'événement dont la date change, relire les structurations réelles dans le journal, confirmer
les deux décisions par défaut de la tranche 4 (frontière de confiance à « moyenne »,
« incertain » traité comme une confiance basse).

**Tout le socle fonctionne, sauf le cœur.** Ce sprint ouvre M7 : le pipeline qui transforme un
message entrant en sujet. La conception est à jour et fait foi : les cinq couches de contexte et
la boucle d'apprentissage dans [`../../conception/05-ia.md`](../../conception/05-ia.md) §9 et
§10, les nouvelles données dans [`02`](../../conception/02-modele-donnees.md), les règles
déterministes dans [`04`](../../conception/04-design-domaine.md) §10, les décisions dans
[`../ecarts-et-propositions.md`](../ecarts-et-propositions.md), les chiffres dans
[`../benchmark-iag.md`](../benchmark-iag.md).

**Le périmètre de ce sprint est M7 seul.** L'échange avec Relvo (M10) est l'épique suivante ; il
consomme le module de contexte et les fiches que M7 construit, et ajoute ce que M7 n'a pas :
les outils symétriques à l'interface, le streaming, la session côté client. Ce que M7 nourrit en
retour — étiquettes, raisons, questions — est M17.

**Trois règles pour toute la durée du sprint.**

- **Aucune tranche ne commence sans le banc d'essai.** La première question est le coût et la
  latence d'un message traité ; si la réponse est mauvaise, le découpage change.
- **Doc et code dans le même commit**, pied `Client:` sur chaque `feat` et `fix`, frontmatter de
  l'épique mis à jour dans le commit qui change son état. Cf. la
  [Definition of Done](../definition-of-done.md).
- **Aucune ressource sur un compte personnel**, même « en attendant ». Le compte du fournisseur
  d'inférence est au nom de l'organisation.

---

## Tranche 0 — Prérequis, avant la première ligne de code

**Le code est posé (2026-09-14) ; il attend la clé OpenAI.** La passerelle d'inférence prévue
a été écartée le même jour (`ecarts-et-propositions.md`, « Pas de passerelle d'inférence ») :
l'API OpenAI est appelée en direct, et le seul coût d'inférence est la facture OpenAI.

- [x] **Compte OpenAI au nom de l'organisation** (« Vccimpact »), projet « Relvo ». ⚠️ La
      résidence européenne **n'est pas en libre-service** : le sélecteur n'apparaît qu'aux
      organisations rendues éligibles par l'équipe commerciale d'OpenAI (`benchmark-iag.md`
      §6.3). Le projet est « Global », conforme à la décision « la conformité n'est pas un
      critère ». Si l'éligibilité est demandée un jour, le projet se recrée avec la région et
      `OPENAI_BASE_URL` change — aucun code.
- [x] **Clé d'API dédiée à Relvo** (`relvo-prod`), et **plafond de dépense mensuel posé sur le
      projet** (100 € par mois, posé le 2026-09-20) : c'est la seule garde qui tient si le
      compteur applicatif est lui-même en cause.
- [x] **Variables d'environnement.** `OPENAI_API_KEY` posée dans Vercel, production et aperçu,
      et dans `.env.local`. ⚠️ Piège rencontré : `OPENAI_API_KEY =` avec un espace avant le
      signe égal n'est pas lu — la clé est « vide » sans autre message. Bloc documenté dans
      `.env.example` et le README, avec `OPENAI_BASE_URL` (vide = point d'entrée standard) et
      les quatre surcharges `RELVO_IA_MODELE_*`.
- [x] **Premier appel réel** (2026-09-14, Luna, effort `none`, classification d'un e-mail de
      livraison) : sortie conforme au schéma, 98 jetons d'entrée, 21 de sortie, **0 de
      raisonnement** — le niveau `none` est bien honoré. 5,2 s au premier appel, 1,2 s au
      second. `cache_read` à 0 sur les deux : attendu, le préfixe est sous le seuil de cache
      du fournisseur (05 §10.5) ; à revérifier dès qu'un appel porte la couche Produit.
      Reste à confirmer dans le tableau de bord OpenAI que l'appel apparaît sur le projet Relvo.
- [x] **Dépendances.** `ai` (v7) et `@ai-sdk/openai` dans `apps/web`, API Responses. Rien dans
      `packages/`.
- [x] **Abstraction à quatre méthodes** — `apps/web/src/server/ia/` : `classify`, `extract`,
      `draft`, `chat`. Fournisseur instancié en un seul endroit, modèle par tier en
      configuration (`config.ts`), niveau de raisonnement **exigé par le type et revérifié au
      runtime** ; le test `ia-niveau-raisonnement` refuse un appel sans niveau sur les quatre
      méthodes et vérifie que le niveau atteint le modèle. Jetons de sortie bornés par tier,
      allers-retours d'outils bornés par tour.
- [x] **Table de tarifs versionnée** — `tarifs.ts` : jetons → euros par modèle, raisonnement
      compté à part et facturé au tarif de sortie ; un modèle sans tarif est **refusé avant
      l'appel**. Le test `ia-tarifs` tient le taux de change égal à celui de
      `scripts/cout-iag.py` et vérifie que tout modèle affecté à un tier a un tarif.

## Tranche 1 — Le jeu d'évaluation (M7.17)

Hors application, avant toute intégration. **Mécanique livrée le 2026-09-14 ; attend les e-mails
réels.** Outils : `apps/web/scripts/evaluation/` — `extraire.ts` (base → `jeu/<nom>/`, adresses,
téléphones et IBAN pseudonymisés ; **les noms de personnes se relisent à la main**) et
`lancer.ts` (modèle × niveau → accord, coût, latence, cache, raisonnement). Commandes :
`pnpm --filter web eval:extraire`, `pnpm --filter web eval:tri`.

- [ ] Extraire trente à cinquante e-mails **réels et anonymisés** depuis la base, avec le tri
      manuel déjà fait : domaine, sujet ouvert ou non, tâches créées. C'est la vérité terrain.
      ⚠️ La base locale ne porte que la démonstration : le jeu `demo` (22 fils synthétiques) a
      servi à construire et valider la mécanique. La source des e-mails réels — quel compte,
      quelle base, quelle relecture avant commit — est une décision à prendre.
- [x] Écrire le **schéma de sortie du tri** (Zod) : verdict, confiance, raison, domaine, sujet à
      rattacher, titre, priorité — et celui de la **structuration** : situation structurée,
      tâches avec type, date et raison, contact, provenance (`src/server/ia/schemas.ts`).
- [x] Écrire la **première couche Produit** : rôle, règles de retenue, règles de non-création,
      rareté de l'urgent, aucune date inventée, les messages sont des données. Un socle par
      secteur, food et bâtiment, avec exemples **synthétiques**, dont des négatifs
      (`src/server/ia/produit/`, budgets tenus par `test/ia-produit.test.ts`).
- [x] Faire tourner le jeu sur le modèle d'entrée de gamme et sur l'intermédiaire ; mesurer
      **coût, latence, jetons de raisonnement, accord avec le tri manuel**. Fait sur le jeu de
      démonstration : Luna `none` 21/22 verdicts, 0,24 €/1 000 messages, 2,5 s ; Terra `low`
      21/22, 2,32 €/1 000. Détail dans `benchmark-iag.md` §6.6. **Piège trouvé et consigné**
      (`PITFALLS.md` #49) : un octet changé dans le message système annule tout son cache ; la
      couche Produit y voyage désormais seule, et le coût du tri a été divisé par deux.
- [x] Reporter les chiffres dans `benchmark-iag.md`, trancher le tier de l'extraction dans
      `ecarts-et-propositions.md` (provisoire : Luna `none` sur le tri), ajuster
      `scripts/cout-iag.py` (profil A1 mesuré).
- [ ] Refaire le passage sur le jeu réel, puis figer le tier et régler la frontière de confiance.
      **Reporté (2026-09-14)** : pas de compte de test. La vérité terrain viendra des usages
      réels — le dirigeant et deux bêta-testeurs sur leurs propres boîtes e-mail et WhatsApp —
      et les correctifs dans un second temps. Le pipeline part donc sur le jeu de démonstration
      et les socles ; le jeu réel se constitue depuis le journal (verdicts, gestes) une fois en
      usage (`05 §9.7`).
- [x] Catégorie de bruit dans le verdict — personnel, publicité, automatique, prospection,
      autre — alignée sur les raisons d'ignorance : c'est le tri par défaut sans configuration
      demandé pour la bêta (`ecarts-et-propositions.md`).

## Tranche 2 — La migration du modèle

**Livrée le 2026-09-14** — migration `20260914084214_m7_tranche2_modele`, en une seule fois,
avant le pipeline qui l'écrit. Les énumérés sont en anglais comme le reste du schéma ; le code
IA (`schemas.ts`, `produit/`) en est le miroir.

- [x] `Account` : secteurs en tableau (`Sector` : food, construction, other), préférences
      observées et leur horodatage. Le compte de démonstration porte `food`.
- [x] `Contact` : rôle (`ContactRole`), note de Relvo — distincte des notes de l'utilisateur.
- [x] `Conversation` : raison d'ignorance (`IgnoreReason`) et note ; verdict, **catégorie du
      bruit** (même énuméré que les raisons d'ignorance, restreint par une contrainte), confiance,
      raison et horodatage du tri.
- [x] `Subject` : situation structurée en quatre champs et son horodatage, étiquettes (clés du
      registre), domaine proposé.
- [x] `Message` : origine du contenu, saisi ou transcrit.
- [x] `KnowledgeDocument` : sujet d'origine d'une instruction ; **renommage** de
      `anthropic_file_id` en `provider_file_id` — écrit à la main dans la migration, l'outil
      proposait un DROP + ADD.
- [x] Nouvelles tables `Label` et `RelvoQuestion`, cette dernière sous une contrainte « une
      cible, celle de la portée ».
- [x] `EventLog` : les conventions de métadonnées (proposition d'origine, sollicitations) sont
      décrites dans `02` ; leurs clés se posent dans le code au premier écrivain, tranche 4.
- [x] `pnpm db:generate` après la migration (`PITFALLS.md` #33), index plein texte GIN sur un
      vecteur `search_vector` tenu par trigger (titre pondéré A, situation pondérée B, dictionnaire
      français), et le **test doc ↔ base qui n'existait pas encore** : `test/schema-catalogue.test.ts`
      confronte le tableau de `02` aux triggers et contraintes de vérification du catalogue, dans
      les deux sens. Contrôle de dérive schéma ↔ base : aucune.

## Tranche 3 — L'assemblage du contexte (M7.3)

**Livrée le 2026-09-14** — `apps/web/src/server/ia/contexte/`, module PUR (aucune base) que le
pipeline et l'échange consomment tous les deux. Les types d'entrée sont des projections
explicites, champ par champ, jamais des entités Prisma ; les chargeurs qui les remplissent depuis
la base arrivent avec l'orchestration, tranche 4.

- [x] Constructeurs par couche : Produit (socles par secteur, ordre fixe — tranche 1), Compte
      (profil tri sans instructions ; profil complet avec instructions générales, registre
      d'étiquettes, préférences observées), Domaine (instructions et documents), Situation (fil
      borné, fiches), Instant (date lisible, semaine ISO, fériés français à trois semaines).
- [x] Les trois fiches — sujet, contact, brief du compte — et la **fiche de clôture** d'un sujet
      validé, déterministe : durée, tâches réalisées dans l'ordre, tâches écartées.
- [x] **Hygiène du message** : citations de réponse (en-têtes français et anglais, lignes « > »)
      et signatures retirées, plafond de longueur avec marqueur ; idempotente.
- [x] Profils par sollicitation — tri, structuration, relecture, brouillon, étiquette de pièce
      jointe — avec un **budget par couche tenu par un test** sur une fixture pire que la réalité
      (vingt messages longs, quarante tâches, dix précédents). Le fil poussé au tri est borné au
      premier message et aux trois derniers ; une fiche sujet aux derniers messages.
- [x] Ordre déterministe partout (domaines par nom, sujets par référence, messages par date,
      vérifié par un test qui mélange les entrées) ; le contenu des messages délimité comme
      données, délimiteurs injectés neutralisés ; message système = couche Produit seule
      (`PITFALLS.md` #49), vérifié pour les cinq profils.
- [x] Jeu de démonstration rejoué à l'identique sur le nouveau module.

## Tranche 4 — Le tri en production (M7.1, M7.2, M7.4, M7.5, M7.14, M7.15, M7.16)

**« Un e-mail entrant devient un sujet titré et classé. »** E-mail seul ; WhatsApp attend.
**Livrée le 2026-09-14.** Le partage est net : ce qui lit et écrit la base vit dans le domaine
(`packages/db/src/domain/triage.ts`, testé contre la base) ; le pipeline — filtre, appel,
décision, orchestration — vit dans l'application (`apps/web/src/server/ia/pipeline/`), unique
consommateur de l'inférence, et ses parties pures sont testées sans base.

- [x] **Chargeurs** : `getTriageProjection` remplit, depuis la base et par le domaine, les
      projections que le profil « tri » consomme — compte (nom du dirigeant, secteurs, domaines
      actifs avec description, quarante sujets ouverts les plus récents), fil (le plus ancien et
      les dix derniers messages, expéditeur nommé et adressé, sens), dernier entrant brut pour le
      filtre. ⚠️ Le compte ne porte pas de raison sociale : le nom du dirigeant tient lieu
      d'identité dans la couche Compte tant que le profil n'en a pas.
- [x] **Interrupteur par compte** : colonne `assistant_enabled`, fausse par défaut — elle
      gouverne tout ce que Relvo fait de lui-même, pas seulement le tri (renommée depuis
      `auto_triage_enabled`, migration `20260914130000`). Méthode du domaine
      `setAssistantEnabled`, journalisée ; réglage « Assistant Relvo » dans Réglages ›
      Préférences pour l'utilisateur. Un administrateur doit pouvoir couper un compte à tout
      moment : c'est la même méthode, depuis le backoffice à venir (`ecarts`, « L'assistant
      s'active par un réglage du compte »).
- [x] Orchestration : le webhook `mail_received` enregistre le message comme avant, puis, si le
      message est nouveau et qu'aucun sujet ne l'a capté au rangement, déclenche le tri **après
      la réponse HTTP** (`after()` de Next). Idempotence à deux niveaux : `created` côté
      webhook, et « une sollicitation `tri` déjà consignée pour ce message » côté pipeline.
- [x] **Filtre déterministe du bruit** (`pipeline/bruit.ts`) : expéditeur sans réponse
      possible, accusé ou réponse automatique à l'objet, lien de désabonnement en fin de
      message — et les en-têtes (`List-Unsubscribe`, `Auto-Submitted`, `Precedence`) **le jour
      où le webhook les fournira** : il ne les expose pas aujourd'hui, `toEmailHeaders` les
      lira s'ils apparaissent. Verdict « bruit » avec sa catégorie et sa règle, zéro jeton.
- [x] Appel de tri sur une conversation orpheline (`extract`, tier extraction, niveau retenu de
      la configuration) ; verdict, catégorie, confiance, raison et horodatage écrits sur la
      conversation. Décision en un seul endroit (`pipeline/decision.ts`) : bruit, incertain et
      confiance basse n'écrivent que le verdict.
- [x] Ouverture ou rattachement par `openSubjectOnConversation` (acteur Relvo, contact
      automatique, priorité, domaine résolu par son nom — jamais « Général », jamais un domaine
      inactif ; sinon sans domaine, avec le domaine proposé) et
      `attachEmailConversationToSubject` sur la référence d'un sujet ouvert ; une référence
      fermée ou inconnue ouvre. Le domaine résolu est posé sur les messages du fil.
- [x] **Un échec laisse la conversation orpheline** (M7.15) : tout est sous un seul `try`,
      l'échec est journalisé (`triage_failed`) et le webhook n'en sait rien.
- [x] Journal : `ia_sollicitation` par appel — sollicitation, tier, modèle, niveau, jetons
      d'entrée / cache / sortie / raisonnement, coût en euros et version des tarifs, durée
      (M7.16) ; `triage_verdict` par verdict, avec la proposition intégrale et la source
      (modèle ou règle) (M7.14) ; `subject_created` et `conversation_attached` portent l'acteur
      Relvo.
- [x] Invalidation du cache de données après chaque écriture du pipeline (`PITFALLS.md` #45).
- [ ] Vérifier `cache_read` sur les appels répétés **en production** : le journal le porte
      (`jetons.cacheLecture`) ; à relire après les premiers verdicts réels. Sur la démonstration,
      1 881 jetons relus sur 2 596.

**Ajouts du premier essai réel (le soir même)**, après un e-mail de test classé « bruit » sans
que rien ne le montre :

- [x] **Un bruit sûr fait taire la source** : verdict « bruit » en confiance haute (ou règle
      déterministe) → conversation ignorée, catégorie pour raison, phrase pour note, acteur Relvo
      (`ignored_by_actor`, migration `20260914150000`) ; réversible d'un appui. Seconde frontière
      dans `decision.ts`, décision dans `ecarts` (« Frontières de confiance »). `05 §9.5` récrit.
- [x] **Ce que Relvo en pense, visible** (première forme de M7.20) : sous chaque conversation
      lue, la ligne « Relvo · bruit · publicité — raison » ou « Ignorée par Relvo · … » ; en tête
      du fil, la même ligne, ou « Relvo n'a pas encore lu ce fil ».
- [x] **Ce que Relvo a fait en mon absence, dans les pastilles du sélecteur** : « Sans sujet »
      porte un stock (toutes les conversations à trier), « Suivies » et « Ignorées » un flux (ce
      que Relvo y a rangé depuis le dernier passage, qui tombe une fois l'onglet vu — deux
      horodatages sur le compte, migration `20260914180000`, `getConversationBadges` /
      `markConversationFilterSeen`). Volontairement hétérogène, décision dans `ecarts`
      (« Trois pastilles, deux natures »). A remplacé une carte de bilan sur sept jours, retirée.

- [x] **L'avis parle en deux parts, dans les mots de l'utilisateur** : action (à traiter, à
      considérer, rien à faire) et nature (professionnel, publicité, automatique, personnel),
      toujours posée — `triage_nature`, migration `20260915090000`. Le rattachement prime sur
      l'action ; le filtre déterministe ne conclut plus que sur la publicité ; le contexte pose le
      cadre du message reçu et nomme le dirigeant comme tel. Décision dans `ecarts` (« L'avis de
      Relvo parle en deux parts »). Jeu d'évaluation réétiqueté, deux cas ajoutés.

- [x] **Le profil de l'expéditeur, avant le modèle** : calculé par le domaine en une requête
      (`getSenderProfile`) — contact connu, sujets nés de ses fils, domaine habituel, ignorances
      par raison, sujets ouverts avec lui et leur attente. Deux règles sans appel
      (`pipeline/expediteur.ts`, seuil et fenêtre en constantes testées) : une source écartée
      trois fois pour la même raison se tait ; un contact dont le seul sujet ouvert attend sa
      réponse est rattaché. La liste des sujets poussée au tri est choisie autour de lui, plafond
      ramené de quarante à vingt. Le profil part au modèle en trois lignes. Décision dans `ecarts`
      (« Le profil de l'expéditeur décide avant le modèle »).

**Ce que la tranche laisse volontairement de côté** : la pastille d'un appui avec provenance
(le reste de M7.20) ; WhatsApp (A8) ; les préférences observées et les antécédents de tri
restent vides tant que M17 ne les calcule pas.

## Tranche 5 — La structuration (M7.6, M7.18, M7.20)

**« Le sujet arrive avec ses tâches et sa date. »** Second appel, uniquement quand un sujet
vient d'être ouvert par le tri. **Livrée le 2026-09-15.** Même partage que la tranche 4 : ce qui
lit et écrit la base vit dans le domaine (`packages/db/src/domain/structuration.ts`, testé
contre la base) ; le pipeline — retenue de la proposition, orchestration — vit dans
l'application (`apps/web/src/server/ia/pipeline/{proposition,structuration}.ts`), et sa partie
pure est testée sans base.

- [x] Couche Domaine chargée : instructions et documents **lus** du domaine du sujet, plus les
      instructions de « Général » et le registre d'étiquettes dans la couche Compte. M11.4 étant
      déjà livré (rédaction des instructions dans la fiche d'un domaine), la couche est utile dès
      la première instruction écrite. La couche Compte du profil complet ne liste plus les sujets
      ouverts : ils ne servent qu'au tri.
- [x] Situation structurée en quatre champs et résumé écrits sur le sujet ; tâches déductibles
      avec type, date conforme à la sémantique asymétrique (`02`, Task) et **raison** en
      métadonnée ; contact automatique complété (identité, entreprise, **rôle**) — un contact
      vérifié ne reçoit que le rôle, s'il est vide ; domaine proposé quand le sujet n'en a ni un,
      ni une proposition du tri. Tout passe par `createTask` et par un journal
      `subject_structured` qui porte la proposition intégrale.
- [x] **Précédents par domaine** (M7.18) : titres des sujets validés du même domaine (ou
      partageant une étiquette), fiches de clôture des trois plus proches par recherche plein
      texte sur `search_vector` (requête brute, filtre tenant posé à la main) — tâches réalisées
      dans l'ordre, tâches de Relvo écartées relues depuis le journal, que `deleteTask` conserve
      désormais telles que proposées. La provenance d'une tâche est **résolue** contre ce que le
      modèle a lu (référence d'un précédent, titre d'une instruction ou d'un document) ; une
      référence inconnue n'est jamais reconnue.
- [x] Raison et provenance affichées d'un appui (M7.20) : la modale d'une tâche de Relvo dit
      « pourquoi » et « d'après quoi » sous la pastille Relvo ; la fiche du sujet ouvre sur « ce
      que Relvo a compris » — situation en quatre lignes et résumé — dès que le sujet a été
      structuré.
- [x] Aucune tâche artificielle : le banc d'essai (`pnpm --filter web eval:structuration`)
      montre les deux messages informatifs de la démonstration **sans tâche**, et une tâche par
      sujet en moyenne là où la démonstration en attendait deux — l'écart est du savoir métier
      que Relvo n'a pas le droit d'inventer (`benchmark-iag.md` §6.7). La consigne a été
      resserrée sur les dates (dans les champs, jamais dans le titre) et les demandes explicites.
- [x] Première structuration réelle relue (le soir même) : juste sur le fond, mais un résumé plus
      long que l'e-mail, les tâches répétées dans l'analyse, deux résumés côte à côte (Relvo et
      descriptif), domaine sous le résumé. Corrigé : consigne de brièveté (résumé d'une phrase, sans
      les actions), **un seul champ « Résumé »** — le descriptif de l'utilisateur, sinon le résumé
      de Relvo signalé par sa pastille, l'édition reprend le texte affiché —, la prochaine étape
      avec son échéance en dessous, domaine et urgence en tête. Décision dans `ecarts` (« Un seul
      résumé sur la fiche »).
- [x] Deuxième relecture (même jour) : les tâches passent sur la page principale du sujet, le
      journal en dernier onglet, la prochaine étape n'est plus affichée ; l'avis de tri ne
      s'affiche plus sur un fil suivi (liste et header) ; le contact automatique est désormais
      complété (la fiche passée au modèle se déclare « à compléter »). Décision dans `ecarts`
      (« La fiche du sujet, c'est le résumé et les tâches »).
- [ ] Relire les structurations réelles suivantes : tâches gardées ou supprimées, `cache_read`.

**Ce que la tranche laisse volontairement de côté** : l'étiquette nouvelle et les questions de
Relvo sont **conservées dans le journal** (proposition intégrale) mais pas matérialisées — le
registre, sa promotion et l'encart des questions sont M17.4 et M17.6 ; un sujet ouvert **par
l'utilisateur** (glissement sur une conversation) n'est pas structuré — décision dans `ecarts`
(« La structuration retient moins qu'elle ne propose ») ; le délai de réponse constaté du contact
reste nul dans sa fiche. Le sujet rattaché par le tri est relu depuis la tranche 6.

## Tranche 6 — La relecture (M7.9, M7.11, M12.5)

**« Relvo suit l'affaire. »** Un seul appel par message arrivant sur un sujet existant.
**Livrée le 2026-09-16.** Même partage que les tranches 4 et 5 : ce qui lit et écrit la base vit
dans le domaine (`packages/db/src/domain/relecture.ts`, testé contre la base) ; le pipeline —
retenue, orchestration — dans l'application (`apps/web/src/server/ia/pipeline/relecture.ts`,
`retenirRelecture` dans `proposition.ts`), sa partie pure testée sans base. Décision dans
`ecarts` (« La relecture suit l'affaire sans piloter le statut »).

- [x] Message entrant capté par un sujet → relecture, **après la réponse HTTP** du webhook, une
      fois par message : situation et résumé réécrits, tâches nouvelles par `createTask` (une
      tâche qui répète une ouverte est écartée, plafond de quatre), étiquettes ajoutées, priorité
      recalibrée par `updateSubjectPriority` (acteur Relvo), clôture **suggérée** seulement sans
      tâche ouverte, **retirée** dès que le message rouvre des questions. Journal
      `subject_reviewed` avec la proposition intégrale ; échec `relecture_failed`, le sujet reste
      tel quel.
- [x] Le fil **rattaché par le tri** — par le modèle ou par la règle de l'expéditeur — enchaîne
      sur la relecture : c'est ce que la tranche 5 laissait en attente.
- [x] Réouverture mécanique d'un sujet validé (`createMessage`), **constatée** par la projection
      dans le journal et dite au modèle ; un sujet non ouvert n'est pas relu.
- [x] Marqueur « En attente » : posé et levé **mécaniquement** (`04 §9`, tranche 7) ; Relvo le
      **pose** en relecture quand un tiers est attendu et nommé (`waiting_for_reply_set`), ne le
      lève jamais.
- [x] Contexte frais borné : la fiche aux **deux derniers messages antérieurs**, le message
      nouveau à part, une seule fiche de précédent ; budget de la couche Situation tenu par le
      test sur la fixture pire que la réalité.
- [x] Pastille « ✦ À valider ? » sur la ligne du sujet quand la clôture est suggérée ; le geste
      reste au swipe.
- [x] Banc d'essai : huit suites (`jeu/demo/suites.jsonl`), `pnpm --filter web eval:relecture`
      — `benchmark-iag.md` §6.9. « Terminé » et « en attente » justes 8/8, 0,61 € les mille
      relectures à `low`, 0,41 € à `none`.
- [x] **Premier essai réel (le jour même)** : e-mail 1 → sujet, tâche de validation du devis,
      réponse par « Répondre » : bon. E-mail 2 « intervention mardi 8 h, rien à faire » → aucune
      tâche : la consigne ne connaissait que les actions *demandées*. Corrigé : **un événement
      annoncé à une date est toujours une tâche datée** (`05 §2.2`, consigne des deux profils,
      suite-009 au banc). Deux retours d'écran corrigés, puis la fiche **réorganisée** sur un troisième
      (« patchwork ») : hero = titre, référence et marqueurs en petits chips ; une ligne de
      puces pour le contexte (domaine, interlocuteur, urgence) ; Résumé ; Tâches avec leur
      progression dans le titre de la section. Décision dans `ecarts` (« Un
      événement annoncé devient une tâche datée, et la fiche dit avec qui »).
- [x] **Second essai réel, scénario complet** : le crochet à réécrire au clavier était le pire
      moment → le choix se tranche d'un appui dans le texte (puces au-dessus du champ, « Réécrire »,
      appui sur le compte pour passer au suivant) ; la situation structurée revient sur la fiche
      sous le résumé (où on en est, prochaine étape, on attend — pour quand) ; les tâches se lisent
      la plus récente en tête. Décision dans `ecarts` (« Trancher un choix d'un appui… »), avec
      les questions ouvertes sur la présentation et la mémoire des choix (`proposé`).
- [x] **Troisième essai réel, premier e-mail du devis** : sept retours, tous retenus — la
      description en panneau (Résumé, Où on en est, Prochaine étape en sous-titres, plus de bouton
      « Modifier ») ; une seule ligne de prochaine étape (« En attente : … » quand on attend) ;
      **un envoi relit le sujet** (la fiche disait encore « valider le devis » après l'envoi) ;
      une note conditionnelle « [Si validé : …] » n'est pas un choix (consigne + filet Garder /
      Retirer) ; un choix se lit comme un bouton ; le fil reste lisible derrière le composer ; le
      hero respire. Décision dans `ecarts` (« La fiche décrit, un envoi se relit… »). **Arbitrage
      du dirigeant : la relecture après envoi est gardée malgré son coût** — une réponse peut
      engager sur une tâche ; suites 010 (envoi → en attente) et 011 (envoi → tâche datée) au jeu
      d'évaluation, justes toutes deux.
- [x] **Quatrième retour, le même jour : le choix dans le texte est abandonné.** Trois
      maquettes comparées (artefact), la fiche de décision entre le message et le composer
      retenue. Livré : les **décisions** portées par la tâche de réponse (métadonnées, aucune
      migration), proposées par la structuration et la relecture, bornées par la retenue ;
      le **formulaire de décisions** dans le fil (`decision-sheet.tsx`), réponse journalisée,
      « Rédiger la réponse » une fois tout répondu, repli en une ligne ; la tâche dit
      « N décisions à prendre » puis « Décidé : … » ; le composer ne surligne ni ne bloque plus
      rien ; consigne « jamais de crochets ». Décision dans `ecarts` (« Les décisions d'un
      message deviennent un formulaire »).
- [x] **Premier essai du formulaire (17–18 septembre) : huit retours, tous livrés** — pop-up
      lisible, membres d'un groupe repliés, fil ouvert en bas, hero fixe, contact au nom
      d'adresse complété (téléphone et e-mail de la signature), formulaire teinté Relvo, décision
      prise conservée dans le fil, **tâches devenues sans objet retirées par la relecture**
      (`retireTaskByAi`, seulement les tâches de Relvo, journal). Décision dans `ecarts` (« Huit
      retours du premier essai du formulaire de décisions »).
- [x] **Second essai du formulaire (18 septembre) : sept retours, tous livrés** — le toast
      « Sujet fermé » lisible sur un téléphone en mode sombre (piège #51 : l'app est claire
      seulement) ; hero de conversation compact, sans libellés, membres d'un groupe dépliés
      depuis la puce du canal ; formulaire pleine largeur ; **le choix fait reste la carte du
      formulaire, figée** ; **la relecture coche les tâches qu'un message montre accomplies**
      (`taches_terminees`, la parole du dirigeant l'emporte sur le planning, suite-012) ;
      **la dernière tâche cochée à la main lève l'attente et propose la clôture, sans IA**
      (`settleSubjectAfterLastTask`, rouvrir retire la suggestion) ; libellés Résumé /
      Description intervertis sur la fiche. Décisions dans `ecarts`.
- [x] **Tranche close le 2026-09-18**, vérifiée en production sur le scénario complet.

**Reste ouvert, hors tranche** : essayer `none` sur la relecture avec le jeu réel ; une tâche
d'événement qui change de date est écartée comme doublon, reprogrammer l'existante (`ecarts`).

**Ce que la tranche laisse volontairement de côté** : la note de Relvo sur le contact au fil
des relectures (`05 §1.3`) ; WhatsApp (A8).

## Tranche 7 — Le brouillon (M7.7, M7.10)

**« Le sujet arrive avec un brouillon prêt. »** **Livrée le 2026-09-15**, avancée avant la
tranche 6 à la demande du dirigeant : c'est le passage à l'action. Domaine
`packages/db/src/domain/{brouillon,reply-match}.ts` (testés contre la base), pipeline
`apps/web/src/server/ia/pipeline/brouillon.ts`, action serveur `actions/brouillon.ts`.

- [x] **Bouton « Répondre »** sur une tâche qui se règle par un message (réponse, décision),
      dans la fiche du sujet comme sur l'Accueil : ouvre le fil de la tâche — celui de son
      message d'origine, sinon celui que le sujet écoute — avec la zone de rédaction.
- [x] Brouillon rédigé **à l'appui**, jamais à la création de la tâche ; brouillon ouvert
      repris ; régénération et effacement dans la barre du composer ; jamais envoyé seul.
      Une décision non prise laisse le choix entre crochets.
- [x] Les choix entre crochets **surlignés** dans le composer, comptés dans la barre du
      brouillon, et **l'envoi retenu** tant qu'il en reste un ; composer **élargi** dès qu'on
      rédige plus d'une ligne ; rédaction par Relvo animée (retour du premier brouillon réel).
- [x] Correctif du premier envoi réel : la réponse partait sous « Re: » + le **titre du sujet**
      et ouvrait un fil fantôme (la clé de conversation contient l'objet). L'objet vient
      désormais du fil, dérivé par le domaine — `PITFALLS.md` #50.
- [x] Complétion d'une tâche de réponse à l'envoi, **déterministe** (M7.10), dans la
      transaction de `createMessage` : la tâche du brouillon et les tâches de réponse ouvertes
      cochées par correspondance, le brouillon exécuté, « En attente » posé s'il ne reste rien
      et levé au message entrant suivant (04 §9).
- [x] Brouillon suggéré et message envoyé côte à côte dans le journal : l'Action porte le
      brouillon, le message sortant y est rattaché à l'envoi.
- [x] Banc d'essai (`pnpm --filter web eval:brouillon`, `benchmark-iag.md` §6.8) : 0,30 € les
      mille brouillons, 4 s, texte court dans le ton du fil.

## Tranche 8 — Durcissement (M7.12, M7.13, M7.15, M7.16)

**Livrée le 2026-09-20.** Rien de nouveau à l'écran hors une ligne « Basé sur » ; tout est dans
ce qui ne se voit pas — et qui coûte. Décision dans `ecarts` (« Le durcissement : un appel raté
coûte, un cache s'adresse, un brouillon cite »). Client (`client.ts`), contexte, pipelines et
domaine touchés ; **aucune migration** — le préfixe stable et le motif d'échec vivent dans les
métadonnées du journal, les sources dans le payload de l'Action.

- [x] **Citations portées par le schéma de sortie** (M7.12) : le brouillon rend `texte` et
      `sources` (`SortieBrouillon`), résolues contre ce que le modèle a lu (`retenirSources`,
      jamais une source inconnue, plafond de trois), stockées dans le payload de l'Action et
      journalisées avec le brouillon, rendues au composer qui affiche « Basé sur : … » sous la
      barre. Les tâches citaient déjà (tranche 5). Le tier de rédaction rend un objet quand on
      lui donne un schéma.
- [x] **Cache de prompt mesuré et adressé** (M7.13) : clé de cache = identifiant du compte,
      rétention longue (`RELVO_IA_CACHE_RETENTION`, `24h` par défaut) ; chaque mesure consigne
      `prefixeStable` ; `pnpm --filter web ia:journal` relit le compteur par sollicitation et
      nomme les **silencieux** (préfixe chaud non relu, jamais le premier appel d'une fenêtre).
      Test d'invariant : structuration, relecture et brouillon partagent leur préfixe **octet
      pour octet**, le tri partage la tête. Banc : `eval:tri --cache`, `benchmark-iag.md` §6.10.
- [x] **Plafonds par appel** (M7.15, M7.16) : entrée bornée par tier et vérifiée AVANT l'appel
      (zéro jeton) ; instructions plafonnées par note et par bloc avec marqueur, résumés de
      documents bornés ; sortie tronquée (`length`) ou non conforme = `EchecSollicitation`
      nommée qui **porte la mesure** — les quatre pipelines la journalisent comme une
      sollicitation, puis l'échec avec son motif. Plafond de sortie de l'extraction relevé pour
      que six tâches à décisions ne le heurtent pas. Tests : `ia-plafonds`, `ia-contexte`,
      `ia-proposition`, `brouillon` et `ia-journal` côté domaine.
- [x] Le disjoncteur complet — seuils par compte, garde en vitesse — est **M14.5**, pas M7.
      Ce que M7 livre, c'est le compteur en euros qui le rend possible — désormais **sans trou**
      sur les appels ratés — et sa lecture ; le plafond sur la clé est posé (tranche 0).
- [ ] Vérifier en production : un brouillon avec une instruction de domaine montre « Basé sur » ;
      `ia:journal` sur la base de production après quelques messages (cache relu, aucun
      silencieux, aucun échec avec coût perdu).

## Tranche 9 — Le rattrapage en lot (M7.19)

**« Relvo lit le courrier récent la nuit de la connexion. »** La démonstration que les clients
réclament.

- [ ] Mode « rattrapage » du pipeline : les messages récents d'un canal, soumis en **lot** à
      moitié prix, sans latence exigée.
- [ ] Résultat au matin : sujets ouverts, domaines proposés, expéditeurs à ignorer.
- [ ] C'est ce que M13.2 déclenche à la connexion d'un canal.

## Ce qui attend

- **WhatsApp message par message (A8, M7.4 côté messagerie)** : après que l'e-mail est stable.
  Le modèle le permet déjà — l'appartenance vit sur le message.
- **M17** : étiquettes, raisons, questions, préférences, part d'aide. Le pipeline écrit dès M7
  ce que M17 relit ; les champs existent dès la tranche 2.
- **M10** : l'échange. Même module de contexte, profil différent, plus les outils.

---

## Où on en est

- [x] Tranche 0 — livrée le 2026-09-14, premier appel réel passé
- [x] Tranche 1 — livrée le 2026-09-14 sur le jeu de démonstration ; le jeu réel viendra des usages bêta
- [x] Tranche 2 — livrée le 2026-09-14
- [x] Tranche 3 — livrée le 2026-09-14
- [x] Tranche 4 — livrée le 2026-09-14 ; l'assistant s'active compte par compte, dans Préférences
- [x] Tranche 5 — livrée le 2026-09-15 ; banc d'essai en `benchmark-iag.md` §6.7
- [x] Tranche 6 — livrée le 2026-09-16, close le 2026-09-18 après quatre essais réels ; banc d'essai en `benchmark-iag.md` §6.9 ; jeu à douze suites
- [x] Tranche 7 — livrée le 2026-09-15, avant la 6 ; banc d'essai en `benchmark-iag.md` §6.8
- [x] Tranche 8 — livrée le 2026-09-20 ; à vérifier en production ; banc d'essai en `benchmark-iag.md` §6.10
- [ ] Tranche 9
