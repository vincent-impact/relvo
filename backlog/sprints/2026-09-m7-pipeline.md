# Sprint « Pipeline » — M7, à partir du 14 septembre 2026

## Démarrage à froid — à lire en premier

**Où on en est (2026-09-14, soir)** : les tranches 0 à 4 sont livrées et commitées. La tranche 4
met **le tri en production** : le webhook e-mail déclenche, après sa réponse HTTP, un pipeline
qui filtre le bruit sans appel, appelle le tri sur une conversation orpheline, écrit le verdict
sur la conversation, puis ouvre ou rattache par les primitives du domaine — journal à chaque
sous-action et à chaque sollicitation, coût en euros compris. Il ne tourne que pour les comptes
où l'**assistant est activé** — réglage « Assistant Relvo » dans Réglages › Préférences, coupé
par défaut, **coupé partout pour l'instant** : rien ne part en production sans un geste
explicite, et ce geste passe par la méthode du domaine (`setAssistantEnabled`), jamais par la
base. **La prochaine étape est double** : (1) le dirigeant active l'assistant sur son compte,
depuis l'application, puis on relit les premiers verdicts et le `cache_read` dans le journal ;
(2) la tranche 5, la structuration. Deux décisions ont été posées **par défaut**, faute de
chiffres discriminants sur la démonstration (22 verdicts sur 22 en confiance haute) : frontière
de confiance à « moyenne », « incertain » traité comme une confiance basse —
`ecarts-et-propositions.md`, « Frontière de confiance et verdict incertain ». Elles se
confirment sur le journal réel, pas sur un compte de test.

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
- [ ] **Clé d'API dédiée à Relvo** (`relvo-prod`), et **plafond de dépense mensuel posé sur le
      projet le jour même** : c'est la seule garde qui tient si le compteur applicatif est
      lui-même en cause.
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
- [x] **Le bilan en tête de l'onglet Conversations** : ce que Relvo a fait ces sept derniers
      jours — lues, ignorées, sujets ouverts, rattachées, laissées à trier — chaque compteur
      menant au filtre concerné (`getRelvoActivitySummary`, quatre comptages). Coupé, la carte
      renvoie vers le réglage. La fenêtre de sept jours est une constante de la page ; « depuis
      ma dernière visite » demanderait un horodatage de visite qui n'existe pas.

**Ce que la tranche laisse volontairement de côté** : la pastille d'un appui avec provenance
(le reste de M7.20) ; WhatsApp (A8) ; les préférences observées et les antécédents de tri
restent vides tant que M17 ne les calcule pas.

## Tranche 5 — La structuration (M7.6, M7.18, M7.20)

**« Le sujet arrive avec ses tâches et sa date. »** Second appel, uniquement quand un sujet
vient d'être ouvert.

- [ ] Couche Domaine chargée : instructions et documents du domaine. ⚠️ Sans M11.4, la couche
      est vide et la tranche fonctionne quand même ; avec, elle devient utile. Livrer M11.4 en
      parallèle si possible.
- [ ] Situation structurée, tâches déductibles avec type, date et **raison**, contact automatique
      avec rôle, domaine proposé quand aucun ne convient.
- [ ] **Précédents par domaine** : titres des sujets validés, fiches de clôture des plus proches
      par recherche plein texte, provenance en métadonnée de chaque tâche (M7.18).
- [ ] Raison et provenance affichées d'un appui sur la pastille Relvo (M7.20).
- [ ] Aucune tâche artificielle : le banc d'essai doit montrer des sujets **sans tâche** quand le
      message est informatif.

## Tranche 6 — La relecture (M7.9, M7.11, M12.5)

**« Relvo suit l'affaire. »** Un seul appel par message arrivant sur un sujet existant.

- [ ] Message entrant sur une conversation écoutée → relecture : situation mise à jour, nouvelles
      tâches, priorité recalibrée, résolution suggérée ou révoquée.
- [ ] Réouverture mécanique d'un sujet validé, puis relecture.
- [ ] Marqueur « En attente » : posé et levé **mécaniquement** (`04 §9`), Relvo n'y touche qu'en
      relecture.
- [ ] Contexte frais borné aux derniers messages : c'est le poste le plus fréquent, son budget
      est le plus surveillé.

## Tranche 7 — Le brouillon (M7.7, M7.10)

**« Le sujet arrive avec un brouillon prêt. »**

- [ ] Brouillon préparé **à la première ouverture de la zone de rédaction**, pas à la création de
      la tâche ; régénération sur demande ; jamais envoyé seul.
- [ ] Complétion d'une tâche de réponse à l'envoi, **déterministe** (M7.10), sans appel.
- [ ] Brouillon suggéré et message envoyé conservés côte à côte dans le journal.

## Tranche 8 — Durcissement (M7.12, M7.13, M7.15, M7.16)

- [ ] Citations portées par le schéma de sortie, stockées en métadonnée.
- [ ] Cache de prompt mesuré et ordonné ; les silencieux traqués.
- [ ] Plafonds par appel : jetons de sortie bornés, taille de message bornée.
- [ ] Le disjoncteur complet — seuils par compte, garde en vitesse — est **M14.5**, pas M7.
      Ce que M7 livre, c'est le compteur en euros qui le rend possible, et le plafond sur la clé
      posé en tranche 0.

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
- [ ] Tranche 5
- [ ] Tranche 6
- [ ] Tranche 7
- [ ] Tranche 8
- [ ] Tranche 9
