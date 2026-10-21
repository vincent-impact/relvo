# Chantier « Le fil WhatsApp direct se trie à réception » — M7 tranche 11 (A8), 20 octobre 2026

## Démarrage à froid — à lire en premier

**Où on en est.** La tranche 10 de M7 (`2026-10-m7-tranche10-rattrapage.md`) est en production
depuis ce matin : la lecture du courrier dès la connexion, la prise en main (M13.2), les domaines
proposés (M17.10). **M7 est en `en-cours`** ; sa clôture attend la vérification du dirigeant sur
son compte (dernier point non coché du sprint précédent) — elle se fait **en parallèle** de ce
chantier, elle ne le bloque pas. **Le projet est présenté au client le 2026-10-21** : ce fichier
est le plan de la **tranche 11**, décidée et validée le 2026-10-20, qui lève la réserve **A8**
(« e-mail seulement ») pour les **conversations WhatsApp directes**. Il est le « où on en est »
du dépôt le temps du chantier. Ensuite : M7 se clôt (tranches 8 à 11 vérifiées sur le compte du
dirigeant) ; la lecture de l'historique de la messagerie à la connexion est la tranche d'après.

**Ce qui existe et ne se refait pas.** WhatsApp **entre déjà** dans Relvo (M6, M6bis, M6ter) :
le webhook `message_received` (`app/api/webhooks/unipile/route.ts`, `handleMessageReceived`)
ingère le message par `ingestInboundWhatsApp`, le range dans sa conversation (`whatsapp_direct`
ou `whatsapp_group`, clé `chat_id`), le rattache à l'affaire **qui écoute** la conversation s'il
y en a une (`findListeningSubjectForConversation`), stocke les médias, et l'écho de nos envois
est ignoré (`is_sender`). L'**écoute** — un lien affaire ↔ conversation avec une **ancre** —
existe, posée à la main depuis la fiche (M6ter) ; `openSubjectOnConversation` sait ouvrir une
affaire **ancrée** sur un message, en créant le contact depuis le numéro et le nom de profil
(`sender_raw`, `sender_name`), et `sweepConversationIntoSubject` emporte les messages depuis
l'ancre. **Le tri** (`server/ia/pipeline/tri.ts`, `trierConversationEmail`) est **e-mail
seulement** : il rend `canal-non-couvert` pour tout autre type ; `applyTriageMatter` (`domain/triage.ts`)
refuse d'ouvrir sur un fil de messagerie ; le webhook de messagerie ne lance **aucun** tri. En
revanche la projection (`getTriageProjection`) et le contexte (`contexte/couches.ts`) portent
déjà `canal: "email" | "whatsapp"` et disent « Canal : WhatsApp » au modèle ; le profil de
l'expéditeur se calcule par `sender_raw`, qui est le numéro ; le modèle de données décide
l'appartenance **message par message** (`04 §13`). La lecture à la connexion (`domain/catchup.ts`)
refuse un canal de messagerie et **continue de le refuser** dans cette tranche. Le client Unipile
ne sait ni lister les chats ni leur historique.

**Ce que le chantier livre, en une tranche** : à réception d'un message entrant sur une
conversation WhatsApp **directe** orpheline — aucune affaire ne l'écoute, elle n'est pas en
sourdine —, Relvo **attend la fin de la salve**, puis trie et structure par le **même pipeline**
que l'e-mail : nature, affaire ouverte avec titre, domaine ou domaine proposé, priorité, tâches,
contact créé ; l'affaire **écoute** la conversation depuis le premier message de la salve. Les
groupes restent à la main. L'historique n'est pas lu. Aucune migration.

## Tranché avec le dirigeant avant la première ligne de code (le 2026-10-20)

1. **Les conversations directes seulement.** Un groupe WhatsApp n'est jamais trié
   automatiquement : c'est le « groupe bavard » de `05 §9.5`, l'écoute s'y pose à la main depuis
   la fiche, comme aujourd'hui. Au client, c'est **un choix** à présenter, pas un manque.
2. **La salve se laisse arriver.** WhatsApp envoie trois messages en trente secondes ; un tri
   déclenché sur le premier ne verrait qu'une ligne et le suivant coûterait un tour pour « ok
   merci ». Le tri d'un message **attend** `MESSAGERIE.attenteSalveMs` (quarante-cinq secondes)
   après sa réponse HTTP, puis ne se joue que si ce message est **toujours le dernier entrant**
   de la conversation — sinon il s'efface (`salve-en-cours`, zéro jeton) : le webhook du message
   suivant portera le tri. Une salve = un tour. Le webhook passe à `maxDuration = 120`.
3. **L'affaire écoute depuis le début de la salve.** L'ancre est le **plus ancien message
   orphelin** parmi ceux que le modèle a lus, daté de moins de `MESSAGERIE.fenetreSalveMs`
   (deux heures) avant le déclencheur — jamais un bavardage d'il y a dix jours que le tri avait
   laissé sans affaire. Rattacher à une affaire existante **ouvre une écoute** sur cette affaire,
   par la fonction de M6ter que la fiche utilise, avec la même ancre — jamais le rattachement
   permanent de l'e-mail.
4. **Sur la messagerie, « rien à faire » ne fait pas taire un interlocuteur.** La règle de
   `05 §9.5` (un « rien à faire » sûr met la source en sourdine) vaut pour les newsletters ; sur
   un fil direct, un « merci, bonne journée » n'est pas une raison de ne plus écouter un client.
   Sur `whatsapp_direct`, seules les natures **publicité** et **automatique** en confiance haute
   mettent en sourdine ; **professionnel** et **personnel** « rien à faire » n'écrivent que
   l'avis, la conversation reste vivante. La règle de l'expéditeur déjà écarté (`source-ecartee`)
   reste telle quelle : elle ne joue qu'après plusieurs ignorances de même raison.
5. **Un message d'historique n'est pas trié.** On ignore si l'agrégateur rejoue, à la connexion
   d'un numéro, des messages anciens par le webhook. Un message **daté d'avant la connexion du
   canal** (la date que le webhook de fin de connexion pose sur la configuration du canal) est
   rangé et laissé à la future lecture de la messagerie (`historique`, zéro jeton) — même règle
   pure que l'e-mail, `estHistorique(dateIso, connecteLe)`. Cette date est
   `ChannelConfig.lastSyncAt` : elle n'est écrite **qu'à cet endroit** (vérifié le 2026-10-20),
   une reconnexion la repose — ce qui est arrivé pendant la coupure est de l'historique, c'est
   juste. Sans date connue, rien n'est trié : le dirigeant qui connecte un numéro avec des années
   de fils ne paie jamais l'historique à contretemps. Pas de colonne nouvelle.
6. **Ce que la tranche ne fait pas**, et dit pourquoi : la **relecture** d'une affaire qui écoute
   déjà, à chaque message capté (une ligne de plus dans le webhook, même discipline de salve ;
   reportée pour mesurer d'abord ce que coûte le tri seul sur un vrai numéro) ; la **lecture de
   l'historique** de la messagerie à la connexion (import des chats par l'agrégateur, une passe
   par conversation, sur la mécanique par tranches de la tranche 10 — deux à trois jours, la
   tranche d'après) ; les **groupes** ; l'**entrelacement** de deux affaires dans un même fil
   direct (une seule écoute ouverte à la fois, `04 §13` garde sa règle).

**Décisions antérieures, à ne pas rouvrir** : l'écoute est la prothèse que le pipeline remplace
(`04 §13`) — ici, il la **pose** ; la relecture après envoi est gardée (`ecarts`) ; les outils de
lecture prennent les critères que le dirigeant dit (`PITFALLS.md` #68) ; aucun écran de réglage
de l'IA (M17) ; le mot « affaire » partout dans l'interface.

### Règles pour toute la durée du chantier

Celles des sprints précédents : registre de composants (`@shadcn`, par le MCP) avant tout
composant — **aucun composant nouveau n'est prévu**, le bandeau d'appartenance et la fiche
d'affaire existent ; un test par comportement livré (unitaires dans `apps/web/test`, sans base ;
intégration dans `packages/db/test`) ; un cas d'évaluation par comportement livré, et
**l'annonce de ce qui est rejoué et sur quel compte** (un cas coûte un tour réel) ; doc et code
dans le même commit, conception récrite **en place**, aucun concept mort, aucun chiffre ;
frontmatter de l'épique mis à jour dans le commit qui change son état ; pied `Client:` sur tout
`feat`/`fix`, en langage client, à la deuxième personne ; `pnpm changelog` puis
`node scripts/generate-suivi.mjs` avant de pousser (#57) ; aucune mention d'une IA dans les
commits ; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, tests web et base verts, `pnpm build`
avec la ligne du proxy (#5b) ; push sur `main` après vérification, puis
`vercel ls --scope vcc-impact-labs 2>&1` jusqu'à Ready. Serveur local :
`PORT=3100 AUTH_URL=http://localhost:3100 pnpm --filter web dev`. **Toujours rendre avant de
montrer** : Chrome `--headless=new --remote-debugging-port=9333`, 390×844, un contexte neuf par
capture, cookie de session par `curl` sur `/api/auth/csrf` puis `/api/auth/callback/credentials`.
Comptes locaux : `demo@tastycrousty.fr` / `demo1234` ; `admin-local@relvo.test` / `Essai1234!`.

⚠️ **WhatsApp réel passe par Unipile.** M6 est **terminée** : le dirigeant a validé en
production, le 2026-10-20, le webhook de messagerie, la réception d'un message et d'un média sur
son numéro, la réponse depuis l'app et l'anti-boucle de l'écho. La réception n'est donc plus en
question. **Ce qui ne se vérifie qu'en production sur le compte du dirigeant** : si l'agrégateur
rejoue l'historique à la connexion d'un numéro (la décision 5 le couvre), le délai du webhook,
le coût au journal (`ia:journal`, la fiche du backoffice). ⚠️ **Le déploiement change le comportement des
comptes réels** : dès la mise en production, tout message WhatsApp direct reçu sur un compte qui a
un numéro connecté est trié, au tarif standard — le dirigeant est prévenu dans le bilan, avant
le push. Le compte de démonstration n'a aucun compte chez l'agrégateur : rien n'y arrive.

Pièges à relire avant de coder : **#45** (toute écriture de fond invalide le cache du tenant),
**#49** (rien de variable dans le message système), **#53** (un statut stocké se répare par les
faits), **#55** (l'heure française), **#68**, **#30** (une route `/api` vérifie son secret
elle-même), et l'avertissement de M5 : **l'anti-boucle de l'écho se vérifie contre un vrai
payload, jamais de tête**.

## La tranche — « Le fil direct se trie à réception » (M7.4 côté messagerie, A8)

### Les règles pures (`pipeline/messagerie-regles.ts`, testées sans base)

- `estDernierDeLaSalve({ declencheurId, dernierEntrantId })` : le tri ne se joue que si le
  message qui l'a déclenché est encore le dernier entrant de la conversation.
- `ancreDeLaSalve(messages, declencheur, fenetreMs)` : le plus ancien message orphelin lu par le
  modèle, daté de moins de `fenetreMs` avant le déclencheur ; à défaut, le déclencheur.
- `peutFaireTaire({ canal, nature, confiance })` : sur `email`, la règle de `05 §9.5` ; sur
  `whatsapp`, publicité et automatique seulement.
- `estHistorique` est réutilisée (`rattrapage-regles.ts`) avec la date de connexion du canal.
- La constante `MESSAGERIE` dans `server/ia/config.ts` : `attenteSalveMs`, `fenetreSalveMs`.

### Le domaine (`triage.ts`, `subject-conversations.ts`, testé contre la base)

- `getTriageProjection` : le type `whatsapp_direct` est couvert ; les **messageries** du compte
  poussées au contexte incluent le numéro WhatsApp connecté (aujourd'hui les boîtes e-mail
  seules) ; `dernierEntrant` porte son identifiant ; les messages projetés portent
  `orphelin` (sans affaire) pour l'ancre. La date de connexion du canal est lue avec la
  conversation.
- `applyTriageMatter` : accepte `whatsapp_direct` avec `anchorMessageId` obligatoire ; **ouvrir**
  passe par `openSubjectOnConversation` ancré (contact créé depuis le numéro et le nom de
  profil, `auto`) ; **rattacher** passe par `attachConversationToSubjectFromMessage` (M6ter,
  « Lier à une affaire » de la fiche) sur l'affaire existante, avec l'ancre ; le domaine et le
  domaine proposé comme sur l'e-mail. Un groupe reste refusé.
- `ignoreConversation` ne change pas ; c'est le pipeline qui décide d'appeler ou non.
- Tests d'intégration (`packages/db/test/triage.test.ts` ou voisin) : l'ouverture ancrée sur une
  conversation directe emporte la salve et pas le message antérieur ; le rattachement ouvre une
  écoute sur l'affaire existante ; un groupe est refusé ; la projection d'une conversation
  directe dit `canal: whatsapp` et porte le numéro du compte.

### Le pipeline (`tri.ts`)

- `trierConversationEmail` devient `trierConversation` (l'e-mail et le rattrapage l'appellent
  sans changement de comportement) ; le garde `email_subject` accepte `whatsapp_direct`, un
  groupe rend `canal-non-couvert`. Issues nouvelles : `historique`, `salve-en-cours`.
- Ordre pour la messagerie : gardes (inférence, assistant, idempotence par message) → projection
  (type, orphelinat) → **historique** → **attente de la salve** → projection relue, **dernier de
  la salve** et orphelinat revérifiés → filtre déterministe (il ne lit que ce qu'il a : pas
  d'en-têtes, le lien de désabonnement dans le texte) → règle de l'expéditeur par numéro →
  modèle → décision avec `peutFaireTaire` → `applyTriageMatter` ancré → structuration (ouvert) ou
  relecture (rattaché), comme sur l'e-mail. Un échec laisse la conversation orpheline,
  journalisé, jamais vers l'appelant.
- Le **webhook** `handleMessageReceived` : si `created` et sans affaire, `after(trierConversation(...))`
  — le pipeline décide seul (groupe, historique, salve) ; une erreur sur WhatsApp ne touche pas
  la réception des e-mails, qui garde son chemin tel quel.
- Tests unitaires (`apps/web/test/ia-messagerie.test.ts`) : la salve (dernier entrant, sinon
  rien) ; l'ancre (le plus ancien orphelin dans la fenêtre, jamais au-delà) ; ce qui fait taire
  par canal ; l'historique par la date de connexion ; `deciderTri` inchangé sur l'e-mail.

### Le contexte

`couches.ts` dit déjà « Canal : WhatsApp ». Vérifier que la couche du fil, sans objet, reste
lisible (expéditeur « Nom <+33 6…> », messages courts, l'heure française #55), et que la
structuration ne suppose aucun objet. Rien de variable dans le message système (#49).

### Le jeu d'évaluation (`jeu/demo/cas.jsonl`, `types.ts` : `canal: "email" | "whatsapp"`)

Trois cas WhatsApp directs, sur le contexte du compte de démonstration, **trois appels réels,
aucun compte touché** (le lanceur ne lit ni n'écrit la base) :

- **demo-026** — une salve de trois messages d'un client inconnu : « Bonjour », « c'est pour un
  devis de terrasse, 40 m² environ », « vous pouvez passer jeudi ? » → `a_traiter`,
  professionnel, titre, domaine (ou proposé selon le compte), une tâche datée.
- **demo-027** — « Merci c'est parfait, bonne journée 👍 » d'un interlocuteur connu, aucune
  affaire ouverte avec lui → `rien_a_faire`, professionnel (la décision 4 se teste en unitaire :
  pas de sourdine).
- **demo-028** — « Pour la sauce blanche, c'est bon pour la SB-210, livrez jeudi » de Karim
  Benali, affaire `SUB-0142` ouverte et en attente → `rattache: SUB-0142`.

Lancer avec `--cas demo-026,demo-027,demo-028` ; annoncer avant de jouer.

### Vérification

- **En local, sans agrégateur** : rejouer sur `POST /api/webhooks/unipile` trois payloads
  `message_received` en salve (dix secondes d'écart) sur le canal « WhatsApp Gérant » du compte
  de démonstration, relié à un identifiant d'agrégateur fictif **par la fonction du domaine qui le
  fait à la connexion** (jamais par SQL), avec une date de connexion postérieure aux messages
  de démonstration et antérieure aux payloads → **un seul tour** (le troisième message porte le
  tri), une affaire ouverte, l'écoute ancrée sur le premier message, visible dans Conversations
  (bandeau d'appartenance) et dans la fiche de l'affaire ; un quatrième payload capté par
  l'écoute sans tour ; un payload de groupe sans tour ; un payload daté d'avant la connexion
  rangé sans tour. Chaque état est **rendu** (390×844) avant d'être décrit. Le compte de
  démonstration est remis à neuf ensuite (`pnpm db:seed`). **Un tour réel sur le compte de
  démonstration, annoncé.**
- **En production, par le dirigeant** : un message envoyé depuis un autre téléphone sur son
  numéro déjà connecté ; l'affaire qui s'ouvre avec ses tâches ; un second message capté par
  l'écoute sans nouveau tour ; le coût au journal.

### Clôture

- `05 §1.2` : la puce WhatsApp récrite — la question se pose par salve sur un fil direct, Relvo
  pose l'écoute ; les groupes à la main. `05 §9.5` : ce qui fait taire, par canal. `05 §9.6` :
  la dernière phrase — la lecture à la connexion reste e-mail tant que l'historique de la
  messagerie n'est pas importé. `04 §13` : l'échafaudage commence à tomber — sur un fil direct,
  l'écoute est posée par le pipeline. `02` : rien (aucune migration).
- `ecarts`, « Décisions tranchées », après « La première lecture est large » : « Le fil WhatsApp
  direct se trie à réception, par salve ; les groupes attendent » (les six décisions, les
  valeurs). Les mentions « e-mail seulement (A8) » des entrées précédentes restent : elles
  datent une décision.
- Épiques : M7 — la ligne M7.4 dit « e-mail et messagerie directe », le découpage gagne la
  tranche 11 ; `statut` reste `en-cours`, `fin` corrigée à la clôture. M6 est déjà `termine`.
  `CLAUDE.md` : rien, sauf un piège nouveau dans `PITFALLS.md`.
- Pied `Client:` du commit : « Relvo lit vos conversations WhatsApp directes comme vos e-mails :
  une affaire s'ouvre à réception, avec ses tâches. Les groupes restent à votre main. »
- Avant le push : dire au dirigeant que le déploiement trie désormais tout message WhatsApp
  direct reçu sur un compte qui a un numéro connecté.

## Où on en est

- [x] Règles pures (`pipeline/messagerie-regles.ts` : `estDernierDeLaSalve`, `ancreDeLaSalve`,
      `peutFaireTaire`), constante `MESSAGERIE` (quarante-cinq secondes, deux heures), tests
      unitaires `ia-messagerie.test.ts` (8 : la salve, l'ancre dans la fenêtre et jamais au-delà,
      ce qui fait taire par canal, l'historique par la date de connexion, `deciderTri` inchangé).
- [x] Domaine : `getTriageProjection` couvre `whatsapp_direct`, pousse le numéro WhatsApp dans les
      messageries du compte, lit `connecteLe` (`ChannelConfig.lastSyncAt`) avec la conversation,
      marque chaque message `orphelin` avec son identifiant ; `applyTriageMatter` accepte
      `anchorMessageId` (obligatoire sur un fil direct, refusé sur un groupe), ouvre par
      `openSubjectOnConversation` ancré, rattache par `attachConversationToSubjectFromMessage`
      (acteur Relvo, nouveau paramètre), ne classe que les messages couverts par l'écoute. Tests
      d'intégration `triage.test.ts` (5 nouveaux : projection, ouverture ancrée qui emporte la
      salve et pas le message antérieur, rattachement qui ouvre une écoute, groupe et fil sans
      ancre refusés, canal jamais connecté sans date).
      ⚠️ **Le code contredit le plan sur un point** : `lastSyncAt` n'est pas écrite qu'au webhook
      de fin de connexion — `confirmChannelConnected` la repose quand un message guérit un canal
      « en attente » ou « en erreur », et le webhook d'état de compte la repose à chaque libellé
      « connecté ». Option conservatrice retenue : la règle lit la colonne telle quelle ; le
      message qui guérit un canal est lui-même daté d'avant la guérison et rangé en
      `historique`, le message suivant de la salve l'emporte comme ancre. Sur un numéro
      connecté (le cas du dirigeant), rien ne change.
- [x] Pipeline : `trierConversationEmail` devient `trierConversation` (l'e-mail et le rattrapage
      l'appellent sans changement) ; branche messagerie — historique, attente de la salve, dernier
      entrant et orphelinat revérifiés, ancre, `peutFaireTaire` sur la décision du modèle — puis
      le tronc commun (`trierFil`) ; issues `historique` et `salve-en-cours` ; le webhook de
      messagerie lance le tri dans `after()` quand le message est créé sans affaire ;
      `maxDuration` à 120.
- [x] Jeu d'évaluation : `types.ts` (`canal: "email" | "whatsapp"`), demo-026, demo-027,
      demo-028 **joués** (un appel chacun, gpt-5.6-luna « low », clé de cache `demo-eval`, aucun
      compte touché) : demo-026 ouvre « Devis terrasse — passage jeudi » (confiance moyenne,
      domaine Business) ; demo-027 « rien à faire » en confiance haute mais jugé **personnel**
      sans profil d'expéditeur — ce qui, sur WhatsApp, ne fait justement pas taire le fil ;
      demo-028 rattaché à SUB-0142, domaine Fournisseurs. Deux vérités de mon cru corrigées
      après coup, hors plan : le domaine de la terrasse (Business), l'action de la confirmation
      de Karim (rien à faire, rattachée — comme demo-024). Coût des trois : 0,0013 €.
- [x] **Vérification locale, rendue** (compte de démonstration, canal « WhatsApp Gérant » relié
      à `acc_demo_wa_local` par le webhook de fin de connexion, config posée par
      `upsertChannelConfig`, assistant activé par le script) : trois payloads à dix secondes →
      `salve-en-cours`, `salve-en-cours`, `ouvert` SUB-00244 « Devis terrasse — passage jeudi »,
      structuré, une tâche « Confirmer le passage » datée du jeudi 22, décision proposée, contact
      automatique Bruno Lefèvre créé du numéro et du nom de profil, domaine proposé « Travaux et
      aménagement », **un seul tour, 0,0020 €** ; l'écoute ancrée sur le premier message, les
      trois messages dans l'affaire ; le bandeau d'appartenance dans Conversations et la fiche
      de l'affaire capturés à 390×844 ; un quatrième payload capté par l'écoute sans tour ; un
      payload de groupe → `canal-non-couvert` ; un payload daté de la veille de la connexion →
      `historique`. Compte remis à neuf (`pnpm db:seed`).
- [x] Conception récrite en place (`05 §1.2`, §9.5, §9.6 ; `04 §13`) ; `ecarts` (« Le fil
      WhatsApp direct se trie à réception, par salve ; les groupes attendent ») ; épique M7
      (M7.4, tranche 7 du découpage) ; aucun piège nouveau.
- [x] Gate (typage, lint, format, 215 tests base, 204 tests web, build avec la ligne du proxy) ;
      push `512dfd7` ; déploiement Ready en production.
- [x] **Clôture** : vérifié en production par le dirigeant sur son numéro le 2026-10-21 (« cela
      fonctionne vraiment très bien ») ; **M7 passe en `termine`**, tranches 8 à 11 vues sur son
      compte. La lecture de l'historique de la messagerie à la connexion est la tranche d'après,
      hors M7.
