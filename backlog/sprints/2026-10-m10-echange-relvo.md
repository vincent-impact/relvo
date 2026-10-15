# Sprint « L'échange » — M10, à partir du 15 octobre 2026

## Démarrage à froid — à lire en premier

**Où on en est.** M19 est fermée (`f0010fe`) : la direction artistique, le langage de mouvement,
les premiers pas, le mot « affaire ». M18 est en `partiel` : sa tranche 5 — `RelvoQuestion`
élargie, badge du bouton Relvo, notification (M18.9, M18.11) — se livre **ici**, M10 en étant le
consommateur. M7 est en pause sur sa tranche 10 (le rattrapage dès la connexion d'un canal),
qui passe **après** M10 : c'est la décision du dirigeant, l'assistant est la priorité numéro 1.
Aujourd'hui l'échange est une coquille : la page plein écran existe, le bloc de Relvo et ses
invites existent, le composer existe — et l'envoi répond « Relvo ne répond pas encore dans cet
écran ». `chat()` existe dans le client d'inférence, avec le flux, les outils, le plafond
d'étapes et la mesure, et **n'est appelé nulle part**.

**Ce que ce sprint livre**, en cinq tranches, chacune vérifiable en production sur le compte du
dirigeant : **Relvo répond et agit sur l'essentiel** (route de flux, outils de lecture, les trois
gestes du prérequis), **Relvo agit** (le reste de la palette d'écriture, provenance, annulation),
**Relvo se souvient** (stockage local, sessions, historique titré), **Relvo parle en premier**
(M18.9, M18.11, puis l'échange scripté M10.16), **Durcissement** (tier par tour, plafond
d'étapes, erreurs dans le fil, jeu d'évaluation). La définition des items vit dans
[`../epics/M10-echange-relvo.md`](../epics/M10-echange-relvo.md) ; la conception dans
[`../../conception/05-ia.md`](../../conception/05-ia.md) §10 et §11.

**Décisions du dirigeant, à ne pas rouvrir :**

- Les échanges restent **sur l'appareil** (IndexedDB, éphémère, `05 §11.3`). Aucune table, aucun
  stockage serveur du dialogue.
- Le **plafond** de tours et de coût par compte est M14.5, hors M10. La mesure par tour existe
  déjà dans `chat()` : la consigner dans le journal d'inférence suffit.
- L'**annulation** suit `05 §11.6` : un bouton « Annuler » sur chaque bloc d'action, actif
  quelques minutes.
- Le **brouillon** se dépose dans le composer et **ne s'envoie jamais**.
- **Prérequis non négociable dès la tranche 1** : Relvo sait créer une tâche, poser un
  rendez-vous (tâche datée avec heure, heure française, `PITFALLS.md` #55) et résumer une
  affaire.
- M11 n'est pas un bloqueur : les notes et les instructions existent dans le domaine
  (`createNote`, `updateNote`, `deleteNote`).
- **M10.16** (l'échange scripté de la prise en main) raconte le rattrapage de la tranche 10 de
  M7 : il se livre **en dernier**, ou juste après cette tranche.

### Avant la première ligne

- [ ] **Installer `@ai-sdk/react`** dans `apps/web` — il est absent ; `ai` 7.0.99 et
      `@ai-sdk/openai` sont là. Vérifier le hook contre la doc **installée** :
      `node_modules/ai/docs/04-ai-sdk-ui/` (`02-chatbot`, `03-chatbot-tool-usage`,
      `21-transport`, `50-stream-protocol`), `03-ai-sdk-core/15-tools-and-tool-calling` et
      `55-testing` — jamais contre un souvenir d'une version antérieure.
- [ ] **Registre de composants d'abord** : interroger le registre shadcn (MCP) et le registre
      « AI Elements » pour le fil, la bulle, le bloc d'outil. ⚠️ Ces derniers sont écrits sur
      Radix ; nos primitives enveloppent **Base UI** (`PITFALLS.md` #40). Le verdict attendu est
      « partiellement couvert → composer » à partir de ce qui existe : `RelvoBlock`,
      `RelvoSentence`, `MessageBubble`, `TaskItem`, `SubjectRow`, `ListPanel`, `EtapeFormulaire`,
      `CarteVivante`, `RecipientComposer`. Le verdict s'écrit dans le message du commit.
- [ ] Relire `PITFALLS.md` **#30** (une route `/api` est hors du proxy : elle vérifie la session
      elle-même et répond 401, jamais une redirection), **#40**, **#49** (la couche Produit seule
      dans le message système), **#55** (l'heure française, `@relvo/db/temps`), **#57**
      (`pnpm changelog` puis `node scripts/generate-suivi.mjs` avant de pousser), **#60**.
- [ ] Le **frontmatter de M10** passe en `en-cours`, `debut: 2026-10-15`, dans le premier commit
      de code ; `fin` reste une projection (`2026-11-06`), corrigée à la clôture. M7 et M18 sont
      en `partiel`, pas `en-cours` : une seule épique publique `en-cours`, la page de suivi
      l'exige. La ligne de M10 dans `product-backlog.md` suit dans le même commit.
- [ ] Serveur local : `PORT=3100 AUTH_URL=http://localhost:3100 pnpm --filter web dev`, compte
      `demo@tastycrousty.fr` / `demo1234`, `OPENAI_API_KEY` dans `.env.local`. Après toute
      migration : relancer `next dev` (`#61`).

### Règles pour toute la durée du sprint

- **M10.8 décide de tout.** Un outil de Relvo enveloppe une fonction de
  `packages/db/src/domain/` — jamais une server action, jamais du SQL, jamais une règle métier
  réécrite. Si la fonction manque, elle naît dans le domaine, avec son test d'intégration, et
  l'écran l'appelle aussi.
- **La disposition ne rouvre pas** (invariants 21–29, 34–38). L'échange est plein écran, atteint
  par le bouton central, conscient de la page ; l'état vide est un bloc de Relvo avec des invites,
  jamais de fausses bulles.
- **Un seul fournisseur, en direct, sans passerelle** (`05 §11.8`). Pas d'AI Gateway, pas de MCP.
  Le modèle vient du tier, le niveau de raisonnement est explicite à chaque appel, la clé de
  cache est l'identifiant du compte.
- **Chaque tour est mesuré et consigné** (`logAiSolicitation`, sollicitation `echange`), coût
  compris — c'est la ligne que M14.5 lira.
- **Un test couvre le comportement livré.** Les tests sans base vivent dans `apps/web/test/`
  (`ia-echange.test.ts`), ceux qui touchent la base dans `packages/db/test/`.
- **Doc et code dans le même commit**, pied `Client:` sur chaque `feat` et `fix`, aucune mention
  d'une IA dans les commits, `pnpm changelog` et `node scripts/generate-suivi.mjs` avant de
  pousser, `vercel ls` surveillé jusqu'à `Ready`. Un commit par geste livré, pas un commit par
  tranche.
- **Toujours rendre avant de montrer** : chaque tranche se vérifie sur l'iPhone du dirigeant, en
  production, avant de passer à la suivante.

### Ce qui reste ouvert, à trancher avec la tranche qui le touche

- **L'acteur d'une action demandée à Relvo** (tranche 2). Recommandation : **`user`**, avec
  `metadata.source = "chat"` — la tâche que le dirigeant dicte est la sienne, Relvo n'est que la
  main ; `05 §7.2` (Relvo ne valide ni ne ferme jamais une affaire) reste vrai, et l'invariant 6
  garde son sens (source Relvo = Relvo l'a proposée). Les propositions du pipeline restent `ai`.
- **La fenêtre d'annulation** (tranche 2). Recommandation : cinq minutes, **tenue par l'écran
  seulement** — au-delà, l'action reste réversible par les écrans habituels (`05 §11.6`), donc
  aucune garde serveur à construire.
- **Les noms des outils** : ceux de `05 §11.6`, en anglais (`list_subjects`, `create_task`…),
  descriptions en français. Recommandation : garder — ce sont les noms de la conception.
- **La recherche de messages** (`search_messages`) : aucune fonction de recherche n'existe dans
  le domaine (`/recherche` n'est pas construite). Recommandation : tranche 2, une requête bornée
  du domaine, pas une recherche vectorielle (invariant 29).
- **Le socle push** (tranche 4) : s'il n'existe pas, M18.11 glisse vers M12, comme M18 l'a
  prévu ; le badge et la ligne de l'accueil se livrent quand même.

---

## Ce qui existe et que M10 consomme sans le réécrire

| Fichier                                                                   | Ce qu'on prend                                                                                                                                                                                                                                                                                                                                                                                                                       | Ce qu'on ne touche pas                                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `apps/web/src/server/ia/client.ts`                                        | `chat()` : `streamText`, outils, `stepCountIs(PLAFONDS.etapesParTour)`, niveau exigé, entrée bornée, clé de cache, `mesure` résolue à la fin du flux                                                                                                                                                                                                                                                                                 | ses garanties ; on ajoute au plus une option, jamais un contournement                         |
| `apps/web/src/server/ia/config.ts`                                        | les tiers, `NIVEAU_RETENU`, `PLAFONDS` (6 étapes par tour, 60 000 jetons d'entrée en raisonnement)                                                                                                                                                                                                                                                                                                                                   | aucun nom de modèle ailleurs qu'ici                                                           |
| `apps/web/src/server/ia/contexte/`                                        | `coucheProduit`, `coucheCompteComplete`, `coucheDomaine`, `coucheInstant(maintenant, page)`, `ficheSujet`, `ficheContact`, `briefCompte`, `prefixeStable`, `BUDGETS`                                                                                                                                                                                                                                                                 | la règle `#49` : `system` ne porte que la couche Produit                                      |
| `apps/web/src/server/ia/produit/`                                         | le socle et les socles de secteur, avec la règle du mot « affaire »                                                                                                                                                                                                                                                                                                                                                                  | son budget, tenu par `test/ia-produit.test.ts`                                                |
| `packages/db/src/domain/`                                                 | `getOpenFeed`, `listSubjects`, `loadSubjectSheet`, `listTasks`, `getUpcomingTasks`, `getOverdueTasks`, `getKpis`, `listContacts`, `getContact`, `createTask`, `updateTask`, `completeTask`, `deleteTask`, `createSubject`, `updateSubject`, `updateSubjectStatus`, `updateSubjectPriority`, `createDraftReply`, `cancelAction`, `createNote`, `updateNote`, `deleteNote`, `logAiSolicitation`, `getBriefNews`, `getBriefSuggestions` | la frontière : un outil n'écrit jamais en base autrement que par l'une d'elles                |
| `apps/web/src/components/relvo-chat/`                                     | `RelvoChatShell` (ciel fixe, puce de contexte, bloc d'invites, composer), `EtapeFormulaire`                                                                                                                                                                                                                                                                                                                                          | la forme de l'état vide                                                                       |
| `apps/web/src/components/shared/`                                         | `RelvoBlock`, `RelvoSentence`, `RELVO_LINK`, `CarteVivante`, `MessageBubble`, `SubjectRow` + `toSubjectRowData`, `ListPanel`, `RecipientComposer` (`draft`, `onSend` qui rend `false` pour garder le texte)                                                                                                                                                                                                                          | leur matière : le violet pâle est la voix de Relvo, une bulle de l'utilisateur n'y vit jamais |
| `apps/web/src/components/subject/task-item.tsx` + `lib/task-item-data.ts` | `TaskItem`, `toTaskItemData` — la présentation unique des tâches (invariant 31)                                                                                                                                                                                                                                                                                                                                                      |                                                                                               |
| `apps/web/src/components/layout/relvo-dock-button.tsx`                    | la prop `pending`, jamais alimentée — tranche 4                                                                                                                                                                                                                                                                                                                                                                                      | sa matière                                                                                    |
| `app/(shell)/relvo/page.tsx`                                              | `?from=`, `?q=`, les invites par page                                                                                                                                                                                                                                                                                                                                                                                                |                                                                                               |
| `apps/web/scripts/ia/journal.ts`                                          | le compteur relu — il montre déjà la sollicitation `echange` dès qu'elle est consignée                                                                                                                                                                                                                                                                                                                                               |                                                                                               |

---

## Tranche 1 — « Relvo répond et agit sur l'essentiel »

**Items** : M10.1 (déjà en place), M10.5, M10.6 (en place), M10.7, M10.12, M10.14, M10.13 pour
la mesure ; M10.8 et M10.9 pour les outils de lecture et les trois gestes du prérequis.

**La route.** `app/api/relvo/route.ts`, `POST`, runtime Node (le flux ne demande rien d'autre,
`maxDuration` posé), région épinglée comme le reste. Elle **vérifie la session elle-même**
(`getCurrentAccountId`, sinon 401 — `#30`), lit les messages de l'interface, la page d'origine
et le drapeau « discussion générale », assemble le contexte, appelle `chat()` avec les outils,
et rend le flux au format du SDK (`toUIMessageStreamResponse`). Sans `OPENAI_API_KEY`
(`inferenceDisponible()` faux) ou assistant désactivé (`isAssistantEnabled`), elle rend une
phrase de Relvo dans le fil, pas une erreur.

**Le contexte — un profil `echange` dans `contexte/profils.ts`**, avec son budget par couche,
tenu par le test. Le cache de prompt est un préfixe (`#49`), donc l'ordre est décidé ici et
nulle part ailleurs :

1. `system` = **la couche Produit de l'échange** : le socle commun, les socles de secteur, puis
   le **socle de l'échange** (`SOCLE_ECHANGE`, comment Relvo parle au dirigeant et agit) —
   identique pour tous les comptes d'un même secteur, donc dans le préfixe caché. Il diffère du
   système du pipeline de ce seul bloc : les consignes de l'échange sont stables, elles n'ont
   rien à faire dans le message utilisateur.
2. Premier message utilisateur = **Compte + Domaine** (`coucheCompteComplete`, `coucheDomaine`
   du domaine de l'affaire ouverte, s'il y en a une) — stable pendant toute la session.
3. Puis l'historique de l'échange tel que l'interface le rejoue (texte, appels d'outils,
   résultats).
4. Le dernier tour est précédé du bloc **volatil** : `coucheInstant(maintenant, page)` — date,
   **heure française**, fuseau nommé (`#55`) — et la **Situation** de la page : le brief du
   compte (`briefCompte`, depuis les indicateurs déjà en cache) et la fiche de la page
   (`ficheSujet` sur `/sujets/[id]`, `ficheContact` sur `/contacts/[id]`, rien ailleurs). En
   dernier, parce qu'il change à chaque tour, et qu'un octet qui bouge en tête annulerait tout.

Ce que le modèle lit en tête du bloc volatil : il **répond au dirigeant** (deuxième personne,
« affaire » jamais « sujet » — le socle le dit déjà), court, et il agit par ses outils plutôt que
de décrire ce qu'il ferait. Un chargeur `getEchangeProjection` dans le domaine
(`packages/db/src/domain/echange.ts`) rend le compte, le brief et la fiche de la page en une
lecture, avec son test d'intégration.

**Les outils de lecture** (`server/ia/echange/outils.ts`, fabriqués par compte avec le `TenantDb`
scellé) — chacun rend une **projection prête pour l'écran**, pas un objet Prisma :

| Outil                          | Fonction du domaine                                | Ce qu'il rend                                                                 |
| ------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `list_subjects`                | `getOpenFeed` + `enrichSubjects`                   | des `SubjectRowData` (ouvertes, urgentes, en attente), bornées                |
| `get_subject`                  | `loadSubjectSheet`                                 | la fiche en texte structuré (`ficheSujet`) + les `TaskItemData` de ses tâches |
| `list_tasks`                   | `getUpcomingTasks`, `getOverdueTasks`, `listTasks` | des `TaskItemData` (aujourd'hui, semaine, en retard, par affaire)             |
| `get_kpis`                     | `getKpis`, `getTaskKpis`                           | les compteurs du jour                                                         |
| `list_contacts`, `get_contact` | `listContacts`, `getContact`                       | l'annuaire borné, la fiche                                                    |

Une affaire se désigne par sa **référence** (`SUB-0142`) ou son titre ; l'identifiant technique
ne sort jamais dans le texte, l'outil le résout. **Résumer une affaire** = `get_subject` puis la
rédaction du modèle dans le fil — aucune écriture.

**Les trois gestes du prérequis**, en écriture :

- `create_task` → `createTask` : titre, affaire optionnelle, **date** `AAAA-MM-JJ`, **heure**
  `HH:MM` nue (devient `startTime` par la même conversion que le pipeline, jamais « convertie »
  — `#55`, règle 3), heure de fin, type de la taxonomie existante. **Poser un rendez-vous** est
  ce même outil avec une date et une heure : une tâche datée à l'heure, qui tombe dans le rail
  « Rendez-vous » du Calendrier. La date du jour et l'heure que le modèle lit viennent de la
  couche Instant : « demain 10h » se résout sur l'horloge française.
- Le résultat de l'outil porte la `TaskItemData` créée **et** le descripteur d'annulation
  (`{ type: "task", id }`) que la tranche 2 branchera ; la tranche 1 affiche « Annuler » inactif
  avec son libellé, pour ne pas changer la forme du bloc plus tard.

**Le fil, côté client** (`relvo-chat/relvo-fil.tsx`, `useChat` + `DefaultChatTransport` avec
`from` et le drapeau de contexte dans le corps) :

- Un tour de l'utilisateur = la **bulle sortante** existante (`MessageBubble`), jamais du violet.
- Un tour de Relvo = **un `RelvoBlock`**, dans lequel le texte arrive en flux (`RelvoSentence`,
  paragraphes), et où les parties d'outil se rendent en **blocs** : en cours (« Je regarde… »,
  `.respire`), puis le résultat avec **les composants des écrans** — une liste d'affaires est une
  sous-carte à filet contenant des `SubjectRow`, une tâche créée est un `TaskItem` sous la
  phrase « ✦ J'ai créé la tâche … » avec [Voir] et [Annuler] (`05 §11.6`). Jamais une liste à
  puces pour ce que le produit sait rendre (`01 §11`).
- L'état vide reste le bloc d'invites existant ; la première réponse le remplace. La puce de
  contexte reste ; son × bascule en discussion générale sans quitter la page (M10.5) — le `from`
  reste dans l'URL pour le retour.
- Erreur en tranche 1 : une phrase de Relvo dans le fil (« Je n'ai pas pu répondre. Réessayez. »)
  et le texte gardé dans le composer (`onSend` rend `false`). Le traitement complet des motifs
  est en tranche 5.
- Rien n'est persisté : rafraîchir la page vide le fil, et c'est attendu jusqu'à la tranche 3.

**La mesure.** À la fin du flux, la route consigne `logAiSolicitation(db, { ...mesure })` —
sollicitation `echange`, tier, niveau, jetons, cache, coût, `prefixeStable` — dans `after()`
pour que la fonction ne soit pas coupée au dernier octet. `pnpm --filter web ia:journal` doit
montrer `cache_read` plein sur le deuxième tour d'une session : c'est **le** contrôle de `#49`,
avant le premier push.

**Les tests** (`apps/web/test/ia-echange.test.ts`, sans base) :

- `contexteEchange` : `system` est strictement `coucheProduit(secteurs)` ; Compte et Domaine sont
  dans le premier message ; Instant et Situation dans le dernier ; les budgets tiennent sur une
  fixture pire que la réalité.
- Les conversions d'arguments d'outil vers les entrées du domaine : date et heure nues, type,
  référence d'affaire — pures, sans base.
- Un tour simulé (`MockLanguageModelV4`, `simulateReadableStream`, comme `ia-plafonds.test.ts`)
  à travers `chat()` avec des outils dont `execute` est un espion : l'outil est appelé avec les
  arguments analysés, le plafond d'étapes tient, la mesure est rendue.

`packages/db/test/echange.test.ts` : `getEchangeProjection` rend le brief et la fiche de la page.

**Vérification en production, sur le compte du dirigeant :**

1. « Qu'est-ce qui est urgent aujourd'hui ? » depuis l'accueil → des `SubjectRow` cliquables
   dans le bloc de Relvo, pas une liste.
2. « Résume-moi cette affaire » depuis une fiche → la puce porte le titre, le résumé parle
   d'« affaire », cite ce que la fiche contient, rien d'inventé.
3. « Crée-moi une tâche : rappeler le plombier lundi » → le `TaskItem` dans le fil, la tâche
   dans le Calendrier au bon jour.
4. « Rendez-vous avec Karim demain à 10h » → la tâche datée à **10:00** dans le rail
   Rendez-vous, pas 08:00 ni 12:00.
5. Le deuxième tour d'une même session relit le cache (`ia:journal`, `cache_read`).
6. Sans réseau ou avec la clé retirée : une phrase de Relvo, le texte gardé.

**Commits** (chacun `feat`, pied `Client:`) : la route, le profil, les outils de lecture et le
fil (avec le frontmatter de M10 et la ligne du backlog) ; puis les trois gestes ; puis la doc
(`05 §11` si une phrase s'est révélée fausse en construisant, `PITFALLS.md` si un piège a coûté).

---

## Tranche 2 — « Relvo agit »

**Items** : M10.8, M10.9, M10.10, M10.13.

- **Le reste de la palette d'écriture** (`05 §11.6`), chaque outil sur sa fonction :
  `create_subject` (`createSubject`), `update_subject_status` (`updateSubjectStatus` — le
  dirigeant valide ou ferme, Relvo exécute), `update_subject_priority`
  (`updateSubjectPriority`), `update_subject_summary` (`updateSubject`), `update_task`,
  `mark_task_done` (`completeTask`), `mark_task_deleted` (`deleteTask`), `create_message_draft`
  (`createDraftReply` sur le fil que l'affaire écoute), `create_knowledge_note`,
  `update_knowledge_note`, `delete_knowledge_note` (`createNote`, `updateNote`, `deleteNote`),
  et `search_messages` sur une requête bornée du domaine, à écrire avec son test.
- **La provenance** (M10.13) : les fonctions d'écriture du domaine reçoivent une **origine
  optionnelle** (`{ source: "chat" }`), fusionnée dans `metadata` de l'entrée de journal
  qu'elles écrivent déjà — additif, aucune signature cassée, un test par fonction touchée. Pas de
  changement de schéma (`05 §11.6`). L'acteur suit la décision ouverte ci-dessus.
- **Le brouillon** : « J'ai préparé un brouillon pour Karim. [Aller au brouillon] » ouvre la
  conversation (invariant 11 : la seule surface de réponse), dont le composer reprend le
  brouillon ouvert (`getDraftProjection`, M7.7 — « un brouillon ouvert est réutilisé » ; à
  vérifier avant d'écrire, sinon c'est là que le geste manque). **Jamais d'envoi.**
- **L'annulation** (M10.10) : chaque bloc d'action porte son descripteur ; « Annuler » appelle
  une server action unique qui inverse par la fonction du domaine — `deleteTask`, le statut ou la
  priorité précédents, le résumé précédent, `cancelAction`, `deleteNote` — et le bloc se marque
  « annulé ». Le bouton s'éteint après la fenêtre, côté écran.
- **Vérification** : « Marque cette affaire comme réglée » → validée, journal avec `source:
chat`, « Annuler » la rouvre ; « Prépare une réponse à Karim » → le brouillon dans le composer
  de la conversation, rien d'envoyé ; une note créée depuis l'échange visible dans la Mémoire.

---

## Tranche 3 — « Relvo se souvient »

**Items** : M10.2, M10.3, M10.4.

- **IndexedDB** par une petite bibliothèque typée, pas de composant (rien à demander au
  registre) : un magasin d'échanges `{ id, titre, creeLe, dernierTourLe, page, messages }`, les
  messages au format de l'interface, rejoués au tour suivant.
- **Sessions implicites** (`05 §11.2`) : à l'ouverture, si le dernier tour date de moins de
  `SESSION_REPRISE_MS` (cinq minutes, configuration), l'échange en cours se rouvre ; sinon un
  nouvel échange, état vide et invites. « + Nouvel échange » toujours visible (il existe déjà sur
  l'historique).
- **Le titre** : après le premier tour, un appel de **classification** (sollicitation
  `titre-echange`, `classify`, niveau `none`, consigné comme les autres) — un seul par échange.
- **L'historique** (`/relvo/historique`) devient une liste lue sur l'appareil : titre, horodatage
  relatif en français, ouverture d'un échange ; dix échanges conservés, les plus anciens purgés ;
  « Effacer mon historique ». La page garde son en-tête et sa carte « Nouvel échange ».
- Les limites `05 §11.10` ne bougent pas : pas de cross-device, pas d'export.
- **Vérification** : fermer l'application, revenir dans la minute → l'échange reprend ; revenir
  une heure plus tard → nouvel échange, l'ancien dans l'historique avec son titre.

---

## Tranche 4 — « Relvo parle en premier »

**Items** : M18.9, M18.11, puis M10.16.

- **M18.9 — `RelvoQuestion` élargie.** Migration **additive** : la portée `account` dans
  `QuestionScope`, les réponses proposées (jsonb), l'étape de script d'origine — la contrainte
  « exactement une cible » se récrit à la main dans la migration (`#36`), et
  `02-modele-donnees.md` change **dans le même commit**, puis `pnpm db:generate` et le serveur
  relancé (`#33`, `#61`). Domaine `questions.ts` : poser, répondre, écarter, compter les
  ouvertes — la réponse applique sa destination par **la même fonction métier que la fiche**
  (`05 §11.12`), journalisée avec sa provenance. Dans l'échange, une question ouverte se pose en
  tête d'un nouvel échange, en `EtapeFormulaire` dans un bloc de Relvo. Le **badge** du bouton
  (`pending`, enfin alimenté depuis le compte des questions ouvertes, en cache par compte) et la
  ligne « Une question pour vous » de l'accueil (`getBriefSuggestions` la lit déjà) ouvrent cet
  échange.
- **M18.11 — la notification** : si un socle push existe (service worker, clés, abonnement), une
  notification à l'ouverture d'une question ; sinon M12, et la tranche le dit.
- **M10.16 — l'échange scripté.** Les étapes en texte fixe dans le produit, dans la voix de
  Relvo, sans appel au modèle ; la `CarteVivante` dans le fil, branchée sur `channel_catchups`
  comme sur la page des canaux ; les questions en formulaires, chacune avec sa destination ;
  l'étape atteinte **persistée sur le compte**, jamais dans le fil. Se livre **en dernier**, ou
  juste après la tranche 10 de M7 (le rattrapage dès la connexion), qu'il raconte.
- **Vérification** : une question née d'une structuration porte le badge, s'ouvre depuis le
  bouton, se répond dans l'échange, et la fiche montre la réponse ; le badge tombe.

---

## Tranche 5 — Durcissement

**Items** : M10.11, M10.15, et le jeu d'évaluation de l'échange.

- **Le tier par tour** (M10.11) : des règles écrites d'abord — une question factuelle courte
  sans verbe d'action passe en `tier: "extraction"`, le reste en raisonnement —, mesurées au
  journal avant de les affiner. Jamais un appel de plus pour décider.
- **Le plafond d'étapes** : quand `stepCountIs` arrête un tour, Relvo le dit dans le fil (« Je
  m'arrête là, demandez-moi la suite ») et la mesure est consignée comme les autres.
- **Les erreurs dans le fil** (M10.15) : chaque motif d'`EchecSollicitation` a sa phrase en
  langage client, le réseau coupé et la session expirée (401 → reconnexion) aussi ; le texte du
  dirigeant n'est jamais perdu.
- **Le jeu d'évaluation** : `scripts/evaluation/echanger.ts` et `jeu/echange/` — des questions
  avec l'outil attendu et ses arguments, le coût et `cache_read` affichés à chaque ligne, comme
  les autres jeux de M7.17.
- **La clôture** : `05 §11` relu contre le code, l'épique en `termine` avec sa date de fin
  réelle, M18 en `termine` si sa tranche 5 est entière (sinon elle reste `partiel` et M12 porte la
  notification), les pièges remontés.

---

## Où on en est

- [x] Tranche 1 — « Relvo répond et agit sur l'essentiel » : ✅ `getEchangeProjection`,
      `resolveSubject` et `loadAccountProjection` / `loadContactProjection` dans le domaine
      (extraits de la fiche sujet, un test d'intégration) · ✅ profil `echange` du contexte,
      socle de l'échange dans le système, bloc volatil avec le dernier tour — cache relu à
      **197 % du préfixe estimé** sur les premiers tours réels, zéro silencieux (`ia:journal`)
      · ✅ route `/api/relvo` (401 hors session, phrases de Relvo sans clé ou assistant
      désactivé, mesure consignée dans `after()`) · ✅ sept outils : cinq de lecture, et
      `create_task` qui porte la tâche comme le rendez-vous (« demain 10h » → 10:00 nue,
      vérifié) ; le résumé = `get_subject` + rédaction · ✅ le fil : bulle sortante, bloc de
      Relvo en flux, `SubjectRow` et `TaskItem` en sous-cartes, « ✦ J'ai créé la tâche »
      avec [Voir] et [Annuler] inactif, puce de contexte à bascule, erreur en phrase ·
      ✅ `ia-echange.test.ts` (contexte, conversions, un tour simulé au plafond d'étapes) ·
      ✅ rendu vérifié en headless iPhone (état vide, liste d'urgentes, résumé, rendez-vous)
      et en deux tours enchaînés avec outils rejoués. **Registre** : shadcn n'a aucune
      primitive de fil ; AI Elements (Radix) écarté — composé à partir de l'existant.
      **Reste à vérifier par le dirigeant en production**, sur son compte.
- [x] Tranche 2 — « Relvo agit » : ✅ la palette entière de `05 §11.6` — douze outils
      d'écriture de plus (`update_task`, `mark_task_done`, `mark_task_deleted`,
      `create_subject`, `update_subject_status`, `update_subject_priority`,
      `update_subject_summary`, `create_message_draft`, `create_knowledge_note`,
      `update_knowledge_note`, `delete_knowledge_note`) et `search_messages` (requête mot à
      mot du domaine, bornée) · ✅ **provenance** : les fonctions d'écriture du domaine
      reçoivent une `Origine` optionnelle, fusionnée dans la métadonnée du journal qu'elles
      écrivent déjà (`source: "chat"`), `deleteNote` journalise enfin · ✅ **annulation** : un
      descripteur par geste (`annulationSchema`, domaine), `defaireGeste` défait par la
      fonction de l'écran — une tâche supprimée se recrée depuis son instantané —, server
      action `annulerGesteAction`, bouton actif cinq minutes côté écran, bloc barré une fois
      défait · ✅ le brouillon passe par `preparerBrouillon` (M7.7) sur la tâche de réponse
      ouverte de l'affaire, ou une tâche de réponse créée avec la consigne ; « Aller au
      brouillon » ouvre la conversation, qui reprend le brouillon ouvert ; rien n'est envoyé ·
      ✅ tests : `packages/db/test/echange.test.ts` (provenance sur douze événements, recherche,
      chaque annulation, descripteur refusé) · ✅ vérifié en local contre le modèle : retrait
      d'urgence, instruction en Mémoire, recherche, brouillon pour Karim, affaire réglée, et
      « Annuler » sur une tâche créée (headless iPhone). **Reste à vérifier par le dirigeant
      en production.**
- [x] Tranche 3 — « Relvo se souvient » : ✅ M10.2 mémoire locale en IndexedDB (`idb`,
      `lib/echanges-store.ts`), les messages de l'interface rejoués tels quels, outils compris,
      dix échanges gardés, « Effacer mon historique » · ✅ M10.3 sessions implicites : l'échange
      en cours se rouvre en deçà de cinq minutes (`doitReprendre`), `?nouveau=1` en force un,
      « + » dans le ciel · ✅ M10.4 historique sur l'appareil (`/relvo/historique`), titres
      générés à la fin du premier tour par un appel de classification (`titre-echange`,
      `/api/relvo/titre`, consigné), repli sur les premiers mots, horloge dans le ciel ·
      ✅ règles pures tenues par `ia-echange.test.ts` (reprise, purge, titre, classification
      simulée) · ✅ vérifié en headless iPhone : tour, reprise après rechargement, historique
      titré (« Arbitrage quantité huile de friture »), nouvel échange forcé.
- [ ] Tranche 4 — « Relvo parle en premier » (M18.9, M18.11, puis M10.16)
- [ ] Tranche 5 — Durcissement
