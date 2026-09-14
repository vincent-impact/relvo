# Sprint « Pipeline » — M7, à partir du 14 septembre 2026

## Démarrage à froid — à lire en premier

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

Tout ce que `02` porte de nouveau, en une migration, avant le pipeline qui l'écrit.

- [ ] `Account` : secteurs en tableau, préférences observées.
- [ ] `Contact` : rôle, note de Relvo.
- [ ] `Conversation` : raison d'ignorance et note ; verdict, confiance, raison et horodatage du
      tri.
- [ ] `Subject` : situation structurée en quatre champs et son horodatage, étiquettes, domaine
      proposé.
- [ ] `Message` : origine du contenu, saisi ou transcrit.
- [ ] `KnowledgeDocument` : sujet d'origine d'une instruction ; renommage de l'identifiant de
      copie d'inférence en `provider_file_id`.
- [ ] Nouvelles tables `Label` et `RelvoQuestion`.
- [ ] `EventLog` : conventions de métadonnées pour la proposition d'origine et pour les
      sollicitations (tier, niveau, jetons, coût).
- [ ] `pnpm db:generate` après la migration (`PITFALLS.md` #33), index plein texte sur titre et
      situation des sujets, test d'intégration doc ↔ base à jour.

## Tranche 3 — L'assemblage du contexte (M7.3)

Le module que M7 et M10 consomment tous les deux. Aucune duplication.

- [ ] Constructeurs par couche : Produit (fichiers par secteur, ordre fixe), Compte, Domaine,
      Situation, Instant (date, jour, semaine, fériés proches).
- [ ] Les trois fiches : sujet, contact, brief du compte — et la **fiche de clôture** d'un sujet
      validé, déterministe.
- [ ] **Hygiène du message** : citations de réponse et signatures retirées, plafond de longueur.
      C'est la première optimisation, en coût comme en qualité.
- [ ] Profils par sollicitation — tri, structuration, relecture, brouillon, étiquette de pièce
      jointe — avec un **budget par couche tenu par un test**.
- [ ] Ordre déterministe partout ; le contenu des messages délimité comme données.

## Tranche 4 — Le tri en production (M7.1, M7.2, M7.4, M7.5, M7.14, M7.15, M7.16)

**« Un e-mail entrant devient un sujet titré et classé. »** E-mail seul ; WhatsApp attend.

- [ ] Orchestration : le webhook enregistre le message comme aujourd'hui, puis déclenche le
      traitement **après la réponse HTTP**, idempotent — une sollicitation par message, jamais
      deux. Sur le plan Vercel actuel, pas de cron à la minute : l'exécution différée après
      réponse est le choix simple.
- [ ] **Filtre déterministe du bruit** avant tout appel : en-tête de désabonnement, expéditeur
      sans réponse possible, envoi en masse, accusé automatique → « à trier », zéro jeton.
- [ ] Appel de tri sur une conversation orpheline ; verdict, confiance et raison écrits sur la
      conversation ; sous la frontière de confiance, rien d'autre n'est écrit.
- [ ] Ouverture ou rattachement par les fonctions du domaine existantes —
      `openSubjectOnConversation`, `createSubjectFromConversation` — jamais par un chemin
      parallèle.
- [ ] **Un échec laisse la conversation orpheline**, il n'invente rien (M7.15).
- [ ] Une entrée de journal par sollicitation, avec jetons et coût en euros (M7.16), et une par
      sous-action (M7.14).
- [ ] Invalidation du cache de données après écriture (`PITFALLS.md` #45).
- [ ] Vérifier `cache_read` sur les appels répétés : un cache à zéro signale un invalidateur
      silencieux.

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
- [ ] Tranche 2
- [ ] Tranche 3
- [ ] Tranche 4
- [ ] Tranche 5
- [ ] Tranche 6
- [ ] Tranche 7
- [ ] Tranche 8
- [ ] Tranche 9
