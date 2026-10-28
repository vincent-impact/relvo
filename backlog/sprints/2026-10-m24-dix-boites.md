# Chantier « Dix boîtes par compte » — M24, 28 octobre 2026

## Démarrage à froid — à lire en premier

**Où on en est.** M27 est close et validée en production (`2026-10-m27-dossiers-et-sujets.md`).
Les testeurs exigent **au moins dix boîtes e-mail par compte**, toutes Gmail ; l'agrégateur
facture chaque boîte connectée environ cinq euros, pour un abonnement vendu cinquante-neuf. Le
dirigeant a tranché le 2026-10-27 (`ecarts`, « Le relais Gmail se construit, avec le nom de
domaine de Relvo ») : Relvo construit **son propre relais Gmail**, se déclare auprès de Google,
et prend **son nom de domaine** ; l'agrégateur reste pour WhatsApp et les boîtes qui ne sont pas
Gmail. L'épique est `M24-dix-boites.md`. Ce fichier est le plan de M24 et le « où on en est » du
dépôt le temps du chantier. Ensuite : R9 à R12 du sprint de recette, puis M25.

**Ce qui existe et ne se refait pas.** Le **contrat de courrier entrant** est celui du domaine :
`IngestInboundEmailInput` et `IngestOutboundEmailInput` (`domain/messages.ts`), consommés par
`ingestInboundEmail` / `ingestOutboundEmail` ; aujourd'hui `server/unipile/map.ts` les fabrique
depuis un webhook de l'agrégateur, et `natureDuCourrier` décide d'après le dossier (`role`,
`folders`) si un courrier est reçu, envoyé, brouillon ou écarté (#69). Le **contrat d'envoi** est
le port `EmailSenderPort` (`domain/email-port.ts`), branché dans `sendEmailReply`. Tout ce qui
suit la réception — rangement par set (M6quater), écoute d'un sujet, tri à réception, relecture
après envoi, pièces jointes dans R2 (`stockerPiecesJointes`), lecture à la connexion par
tranches (`channel_catchups`, `server/ia/pipeline/rattrapage.ts`, M7.19), étape « première
boîte » de la prise en main (`resolveMailboxStep`, `ensureOnboardingQuestions`), carte vivante,
invalidation du cache (#45) — est le code d'aujourd'hui et **ne se touche pas**.
`ChannelConfig.provider` existe déjà (toujours `"unipile"`), et `externalAccountId` — unique,
global — est **la clé de résolution du tenant** d'un webhook non authentifié. L'application
connaît son adresse par `AUTH_URL` (`lib/email.ts`, `unipile/client.ts` via `appBaseUrl`,
`pipeline/rattrapage.ts`), par `UNIPILE_PUBLIC_URL` (prime sur `AUTH_URL` chez l'agrégateur) et
par `VAPID_SUBJECT` (push). Les pages lues hors de l'application vivent dans `(public)` (#48).

**Ce qui est tranché avec le dirigeant** (à ne pas rouvrir) :

- Relvo construit son webhook Gmail et se déclare auprès de Google. Pas de négociation
  tarifaire à la place. **L'e-mail, c'est Gmail** (tranché le 2026-10-28, à la livraison de la
  tranche 2 ; `ecarts`) : l'agrégateur n'est plus proposé pour une boîte e-mail — il écoute
  WhatsApp et garde les boîtes reliées avant l'épique jusqu'à leur migration.
- **M24.10 d'abord** — le nom de domaine et l'infrastructure publique : Google l'exige avant
  tout. **M24.7**, la vérification Google, démarre **le premier jour**, en parallèle.
- Toute ressource — projet Google Cloud, domaine, Pub/Sub, DNS — au nom de l'**organisation**,
  jamais sur un compte personnel « en attendant » (`CLAUDE.md`).
- **Aucun processus permanent** : le courrier entre par webhook ; au plus **deux crons**.
- **Un seul contrat de courrier entrant, un seul contrat d'envoi, deux implémentations.** Rien
  du domaine n'est dupliqué.

**Ce que ce chantier décide, et pourquoi** (décisions d'architecture, à descendre dans `ecarts`
dans le commit qui les livre) :

- **La frontière du fournisseur** est un module `server/courrier/` qui déclare un contrat
  `FournisseurCourrier` — lire le courrier récent depuis une date, lire un e-mail entier, lire
  une pièce jointe, envoyer dans un fil, l'état du compte, la suppression du compte — et une
  fonction `fournisseurDe(config)` qui rend l'implémentation d'après `ChannelConfig.provider`
  (`unipile` ou `gmail`). `server/unipile/` devient la première implémentation ; `server/gmail/`
  la seconde. Le rattrapage, l'envoi, les pièces jointes et la page Canaux parlent au contrat,
  jamais à un fournisseur. La forme pivot d'un courrier est **celle du domaine** : chaque
  fournisseur fabrique `IngestInboundEmailInput`, et la nature du courrier se lit dans ses
  étiquettes Gmail (`DRAFT`, `SPAM`, `TRASH`, `SENT`, `INBOX`) comme dans les dossiers de
  l'agrégateur — une seule fonction de décision, deux lectures d'étiquettes.
- **L'identifiant externe d'une boîte Gmail est son adresse**, en minuscules : c'est ce que la
  notification Pub/Sub porte (`emailAddress`), unique par construction, et c'est ce qui résout le
  tenant dans `/api/webhooks/gmail`. Le compte Unipile gardait un identifiant opaque ; une boîte
  migrée change d'identifiant externe mais garde **son canal et ses conversations** (M24.9).
- **La réception est incrémentale par `historyId`.** La notification ne porte rien d'autre que
  l'adresse et un numéro d'historique ; le webhook répond aussitôt et travaille après sa réponse
  (`after`, comme la route de tranche), relit `users.history.list` depuis le dernier numéro
  retenu, puis chaque message ajouté. Une notification perdue ne perd rien : la suivante reprend
  au dernier numéro. Un numéro trop ancien (Google n'en garde qu'une semaine) **rouvre une
  lecture par tranches** sur la boîte — le mécanisme de M7.19, jamais un chemin à part.
- **L'abonnement aux changements (`users.watch`) expire en sept jours** et se renouvelle au
  passage : par le webhook quand il reste moins de deux jours, et par le cron du matin pour toute
  boîte Gmail — **pas de troisième cron**. L'échéance et le dernier numéro d'historique vivent
  dans `connectionData`.
- **La notification Pub/Sub est authentifiée** par le jeton OIDC que Google signe pour le compte
  de service de l'abonnement (en-tête `Authorization: Bearer`), vérifié contre les clés publiques
  de Google avec notre adresse de webhook pour audience — jamais un secret dans l'URL. Les jetons
  OAuth de la boîte (rafraîchissement, accès) sont **chiffrés** en base (AES-256-GCM, clé en
  variable d'environnement), jamais journalisés.
- **Périmètres demandés** : lecture (`gmail.readonly`), envoi (`gmail.send`), et l'adresse
  (`email`). Rien d'autre : pas de modification, pas de suppression. Les deux premiers sont
  « restreints » chez Google : c'est ce qui déclenche la vérification de M24.7.
- **Pas de SDK Google** : l'API Gmail et le point d'entrée OAuth s'appellent en `fetch`, le
  message à envoyer se construit en MIME à la main (texte et HTML, objet encodé, `In-Reply-To`,
  `References`, `threadId`) — testable sans réseau, et rien de lourd dans le bundle. La
  vérification du jeton OIDC passe par `jose`, déjà présent sous Auth.js.
- **Dix boîtes e-mail, un seul WhatsApp.** La règle « un canal par type » tombe pour l'e-mail
  et devient un plafond de dix par compte, dans le domaine ; WhatsApp garde sa place unique.
- **L'ancienne adresse redirige vers la nouvelle**, et le changement d'origine a un prix que les
  testeurs paieront une fois : la PWA installée et l'abonnement aux notifications sont liés à
  l'origine — il faudra **réinstaller** l'application et réactiver les notifications. Les
  anciens abonnements continuent de recevoir jusqu'à ce qu'ils meurent, puis sont retirés.

**Le découpage**, en tranches verticales, chacune livrée, documentée et poussée. La tranche 0
est administrative et court sur tout le chantier ; la tranche 1 passe avant toute ligne de code
métier, parce que Google veut l'adresse.

0. **« Se déclarer »** — M24.7, dès le premier jour, en parallèle de tout : le projet Google
   Cloud de l'organisation, l'écran de consentement (nom, logo, adresse de confidentialité et de
   conditions, domaine autorisé), les API Gmail et Pub/Sub activées, l'identifiant OAuth, les
   utilisateurs de test ; puis la demande de vérification des périmètres restreints (page
   d'accueil qui dit l'usage de Gmail, vidéo du parcours, évaluation de sécurité). Ce que je
   livre : la liste exacte des gestes et des textes, les pages publiques (tranche 1), le script de
   la vidéo. Ce que ça attend du dirigeant : les comptes et la console.
1. **« L'adresse »** — M24.10 : le domaine de Relvo sur le projet Vercel de l'organisation, DNS,
   `AUTH_URL`, `VAPID_SUBJECT`, `UNIPILE_PUBLIC_URL` basculées, les webhooks de l'agrégateur
   réenregistrés sur la nouvelle adresse, les pages `/confidentialite` et `/conditions` dans
   `(public)`, l'ancienne adresse redirigée, le domaine vérifié chez Google, `README`,
   `PITFALLS` (#25) et `CLAUDE.md` relus. Observable : l'application répond à son adresse, un
   lien de réinitialisation de mot de passe la porte, l'ancienne adresse renvoie dessus.
2. **« Le fournisseur derrière le canal »** — M24.1 et la règle des dix : `server/courrier/`,
   l'agrégateur rangé derrière le contrat, `provider` typé, le plafond de dix boîtes e-mail dans
   le domaine (WhatsApp reste unique), la page Canaux en liste de boîtes, le backoffice qui dit
   le fournisseur et compte les boîtes. Observable : rien ne change pour l'utilisateur, sauf
   qu'une deuxième boîte peut se connecter ; tests du domaine et de l'application.
3. **« Se connecter à Gmail »** — M24.2 : le consentement OAuth de Relvo (départ, retour, jetons
   chiffrés), la boîte créée ou reprise comme aujourd'hui (#70), son adresse pour identifiant,
   depuis Canaux **et** depuis l'étape « première boîte » de la prise en main, retour dans
   l'échange ; **plus de choix de fournisseur** : un bouton, un avertissement (la boîte se lit
   dans Gmail, une adresse pro aussi), Google. Observable : une boîte Gmail « Connectée » avec
   son adresse, sans passer par l'agrégateur ; la lecture reste « en attente » jusqu'à la
   tranche 5.
4. **« Recevoir »** — M24.3 et M24.6 : `users.watch` à la connexion, `/api/webhooks/gmail`,
   lecture incrémentale, nature du courrier par étiquettes, pièces jointes relues par l'API et
   rangées par la fonction de M5, renouvellement au passage et au cron du matin. Observable : un
   e-mail envoyé à la boîte apparaît dans Relvo en quelques secondes, avec sa pièce jointe ; un
   e-mail envoyé depuis Gmail entre comme un envoi et relit le sujet.
5. **« Lire les quatorze jours »** — M24.4 : la lecture à la connexion par le contrat
   (`messages.list` sur la fenêtre, puis chaque message), versée dans les mêmes tranches ; la
   carte vivante ne change pas. Observable : connecter une boîte Gmail ouvre les premiers sujets
   comme avec l'agrégateur.
6. **« Répondre »** — M24.5 : l'envoi par l'API dans le fil ; l'écho de notre envoi, qui revient
   par l'historique sous l'étiquette `SENT`, reconnu et jamais dupliqué. Observable : une réponse
   depuis Relvo arrive dans le fil Gmail de l'interlocuteur ; la conversation ne la montre qu'une
   fois.
7. **« Dix boîtes dans l'interface »** — M24.8 : le choix de la boîte d'envoi dans le composer
   quand plusieurs peuvent répondre, « une autre boîte ? » après la première dans la prise en
   main, le compte des boîtes par compte au backoffice. Observable : rendu headless.
8. **« Migrer »** — M24.9 : le script `boites:migrer <e-mail>`, journalisé — une boîte Gmail
   de l'agrégateur passe `provider: gmail` sans perdre son canal ni ses conversations, « Se
   reconnecter » rouvre le consentement Google, puis le compte s'efface chez l'agrégateur.
   Observable : la boîte du dirigeant, puis celles des testeurs, lues par le relais ; la facture
   de l'agrégateur ne compte plus que WhatsApp.

**Méthode.** Chaque écran est rendu en headless (390 × 844, clair et sombre émulé, #51, port 3100
avec `AUTH_URL`) avant d'être montré ; typage, lint, tests (`packages/db/test` pour ce qui touche
la base) verts avant chaque commit ; doc et code dans le même commit ; pied `Client:` à la
deuxième personne sur chaque `feat`/`fix` ; `pnpm changelog` puis `node
scripts/generate-suivi.mjs` avant chaque push (#57) ; push sur `main` ; `vercel ls` jusqu'à
Ready. Vocabulaire : « sujet », « dossier », « boîte » pour un canal e-mail. Registre shadcn
d'abord ; Prisma 7 avec adaptateur ; `db:migrate` puis `db:generate` après toute migration (#33,
#61) ; jamais de SQL direct, tout changement d'état journalisé.

## Ce que le chantier attend du dirigeant, avant la première ligne de code

- **Le nom de domaine.** `relvo.fr`, `.app`, `.io`, `.com`, `.eu`, `.ai` et `getrelvo.com` sont
  **tous pris**. Il faut un nom ; je vérifie la disponibilité des candidats. L'achat se fait sur
  l'équipe Vercel de l'organisation (`vercel domains buy`, le DNS vit alors chez Vercel) ou chez
  un registrar au nom de l'organisation (alors les enregistrements DNS à poser me reviennent).
- **Les valeurs actuelles de `AUTH_URL` et `UNIPILE_PUBLIC_URL` en production** — je ne peux pas
  les lire — et le droit de poser les nouvelles variables par `vercel env` : `AUTH_URL`,
  `VAPID_SUBJECT`, `UNIPILE_PUBLIC_URL`, puis `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`,
  `GMAIL_PUBSUB_TOPIC`, `GMAIL_PUSH_SERVICE_ACCOUNT`, `RELVO_CHIFFREMENT_CLE`.
- **Un compte Google de l'organisation** pour le projet Google Cloud `relvo` — jamais un compte
  personnel. Soit le dirigeant fait les gestes dans la console sur ma liste, soit il installe
  `gcloud` et s'y authentifie pour que je les fasse en commandes.
- **Les textes légaux** de la politique de confidentialité et des conditions : raison sociale,
  adresse, SIREN, adresse de contact ; je rédige, il relit. La politique doit nommer les
  sous-traitants (Vercel, Neon, Cloudflare, Unipile, OpenAI) et porter la clause « usage limité »
  des données Gmail que Google exige.
- **Un domaine d'envoi chez Resend** sur le nouveau nom (facultatif, mais cohérent pour Google) :
  trois enregistrements DNS à poser.
- **Plus tard, pour la tranche 8** : la liste des boîtes Gmail à migrer, et le feu vert, parce que
  la migration supprime des comptes chez l'agrégateur.

## Tranche 1 — « L'adresse » (M24.10)

**Livré.**
- **Deux hôtes, un déployable** (`ecarts`, « Deux hôtes, un déployable ») : `src/lib/hotes.ts`
  nomme le site (`relvo.net`), l'application (`app.relvo.net`) et l'ancienne adresse ;
  `next.config.ts` route par l'en-tête d'hôte — la racine du site réécrite vers
  `(public)/site`, tout autre chemin du site renvoyé à l'application, les pages du site
  demandées à l'application renvoyées au site, l'ancienne adresse renvoyée à l'application
  sauf `/api` (un webhook ou un cron qui arrive encore là est servi) ; `auth.config.ts` n'ouvre
  la racine que sur l'hôte du site, et `test/auth-deny-by-default.test.ts` le tient.
- **Le site** : la page de présentation (ce que Relvo fait, ce qu'il fait d'une boîte Gmail —
  ce que Google lit —, l'accès sur demande), la **politique de confidentialité** (le
  responsable, ce qui est traité, les bases, l'usage de Gmail avec la clause d'usage limité
  des API Google en français et en anglais, les sous-traitants et leur lieu, la conservation,
  les droits, la sécurité) et les **conditions d'utilisation** (bêta, accès sur validation,
  aide et non décision, prix communiqué à la souscription, responsabilité bornée, droit
  français). Une feuille scopée avec son mode sombre (`site.module.css`, exception durable du
  test des tokens, comme le suivi), le chrome commun (`components/site/page-publique.tsx`).
  Les textes se datent en pied ; le dirigeant les relit.
- **La bascule** : `AUTH_URL`, `VAPID_SUBJECT`, `UNIPILE_PUBLIC_URL` sur `https://app.relvo.net`
  en production ; `GMAIL_CLIENT_ID` et `GMAIL_CLIENT_SECRET` posés ; les webhooks de
  l'agrégateur réenregistrés sur la nouvelle adresse et les anciens supprimés ;
  `.env.example`, `README`, `CLAUDE.md`, `PITFALLS` (#25 ✅, #72) à jour.

**Vérification.** Typage, lint, les 216 tests de l'application (dont le refus par défaut avec
l'hôte) ; le routage vérifié en local au `curl -H Host:` sur les quatre hôtes ; rendu headless
des trois pages en clair et en sombre émulé ; en production, les trois adresses répondent et
l'ancienne redirige.

**Piège vu.** #72 : en développement, `nextUrl.hostname` ignore l'en-tête `Host` que les règles
`has: host` lisent — l'hôte se lit dans l'en-tête d'abord.

## Tranche 2 — « Le fournisseur derrière le canal » (M24.1)

**Livré.**
- **Le domaine** : `CHANNEL_PROVIDERS` (`unipile`, `gmail`) et `ChannelProvider` typent
  `ChannelConfig.provider`, tenu en base par la contrainte `channel_configs_provider_check`
  (migration `20261028150000_m24_channel_provider_check`, cataloguée dans `02`) ;
  `prepareChannelConnection` prend le fournisseur et applique **dix boîtes e-mail par compte,
  un seul WhatsApp** (`MAX_EMAIL_CHANNELS`) — un orphelin se reprend même à côté de boîtes
  connectées ; `deleteChannel` rend le fournisseur avec l'identifiant externe ; le port
  d'envoi `OutboundEmail` porte `provider`, posé par `sendEmailReply` ; la ligne de rattrapage
  et le backoffice (`AdminChannel.provider`) lisent le fournisseur. Tests :
  `channel-connection.test.ts` (seconde boîte, onzième refusée, contrainte en base).
- **La frontière** `apps/web/src/server/courrier/` (`ecarts`, « Un contrat de courrier
  entrant… ») : `types.ts` (le contrat `FournisseurCourrier`, la forme pivot `CourrierEntrant`,
  `Boite`, `ResumeCourrier`), `fournisseur.ts` (`fournisseurDe`, chargement à la demande, le
  relais Gmail déclaré et « pas encore disponible »), `reception.ts` (`rangerCourrier`,
  `recevoirCourrier` — ce qui suit la réception, extrait du webhook de l'agrégateur),
  `pieces-jointes.ts` (le stockage dans R2 par le fournisseur), `envoi.ts`
  (`courrierEmailSender`, le port d'envoi qui choisit). L'agrégateur l'implémente
  (`server/unipile/fournisseur.ts`) et traduit sa matière (`server/unipile/courrier.ts`) ;
  `unipile/attachments.ts` n'est plus qu'une traduction pour `pj:rattraper`.
- **Les consommateurs** parlent au contrat : le webhook de l'agrégateur (le courrier passe par
  `courrierDepuisUnipile` puis `recevoirCourrier` ; WhatsApp inchangé), la lecture par
  tranches (`importerUnePasse` lit par `lireRecents` et range par `rangerCourrier`), l'envoi
  (`courrierEmailSender`), la suppression d'un canal et d'un compte (`supprimerCompte`), le
  statut réconcilié de la page Canaux (`etatDuCompte`). Reconnecter une boîte `gmail` dit que
  c'est pour la tranche 3.
- **L'interface** : la page Canaux garde son bouton tant qu'il reste de la place — « Relier
  une autre boîte e-mail » dès la deuxième —, WhatsApp jusqu'à un ; la fiche de compte du
  backoffice dit le fournisseur de chaque canal (« agrégateur », « relais Gmail »), la liste
  comptait déjà les canaux.
- `CLAUDE.md` (la frontière), `02-modele-donnees.md` (le fournisseur, dix boîtes, la
  contrainte), tests web `courrier.test.ts` (le choix par le nom, le port d'envoi qui choisit,
  la traduction de l'agrégateur).

**Vérification.** Typage, lint, les 223 tests de l'application et les 238 du domaine (dont le
catalogue du schéma, dans les deux sens) ; rendu headless de la page Canaux (quatre canaux de
démonstration, le bouton « Relier une autre boîte e-mail ») en clair et en sombre, et de la
fiche de compte du backoffice. Rien ne change pour l'utilisateur sauf la place pour une
seconde boîte : la réception réelle se vérifie en production au prochain e-mail reçu.

## Tranche 3 — « Se connecter à Gmail » (M24.2)

**Livré.**
- **Le domaine** : `completeChannelConnection` finalise un canal préparé quand le fournisseur a
  dit oui — compte externe, adresse pour nom et identifiant, statut connecté, données de
  connexion remplacées entières, journalisé ; une boîte déjà reliée (ce compte ou un autre,
  l'unicité du compte externe tranche la course) est un **conflit** et le canal reste à
  reprendre (#70) ; reconnecter un canal exige la même boîte. `deleteChannel` rend aussi les
  données de connexion (le relais y lit le jeton à révoquer). `prepareChannelConnection` ne
  retient plus de « fournisseur de messagerie » (il n'y en a plus qu'un). La prise en main ne
  propose plus qu'**une** boîte (`BOITES_PROPOSEES` : « Relier ma boîte Gmail — une adresse pro
  lue dans Gmail aussi »), et l'étape « première boîte » se lit **vivante** (texte et
  proposition du script d'aujourd'hui, pas ceux enregistrés). Tests : `channel-connection`
  (finaliser, conflits, reconnexion), `questions` (la seule proposition).
- **Le relais** `apps/web/src/server/gmail/` : `chiffrement.ts` (AES-256-GCM,
  `RELVO_CHIFFREMENT_CLE`, forme versionnée `v1.iv.tag.texte`), `oauth.ts` (sans SDK : l'URL du
  consentement — `gmail.readonly`, `gmail.send`, `userinfo.email`, hors ligne, consentement
  forcé pour le jeton de rafraîchissement, `login_hint` à la reconnexion —, l'échange du code,
  le rafraîchissement, la révocation, l'adresse de la boîte, les périmètres manquants),
  `jetons.ts` (la forme de `connectionData` pour un canal `gmail` : jetons chiffrés, échéance,
  périmètres — la reconnexion garde le reste), `etat.ts` (l'état du départ dans un cookie
  HttpOnly de dix minutes, le nonce qui est le `state`), `connexion.ts` (le départ depuis une
  Server Action), `fournisseur.ts` (`fournisseurGmail` : connexion, reconnexion, révocation à la
  suppression ; lire, pièces jointes, envoyer **disent** qu'ils arrivent ; l'état d'une boîte
  n'est pas demandé à Google à chaque affichage). `/api/gmail/retour` : hors du proxy, la
  session se lit là, l'état doit répondre dans le cookie, puis le code contre les jetons, les
  périmètres vérifiés, l'adresse, le canal finalisé par le domaine, l'étape de la prise en main
  fermée, la page de retour. `server/courrier/retour.ts` : la page de retour (Canaux ou
  l'échange) et les **motifs** d'un échec (`refus`, `perimetres`, `deja-reliee`, `autre-boite`,
  `google`, `perdu`, `fournisseur`), les mêmes pour l'agrégateur ; `ErreurDeConnexion` les dit en
  toast, une fois, et retire le paramètre. `supprimerCompte` du contrat reçoit les données de
  connexion de la ligne supprimée.
- **Les actions** : `connectEmailChannelAction(retour)` prépare un canal `gmail` et part vers
  Google ; `reconnectChannelAction` rouvre le consentement sur la même adresse pour un canal
  `gmail`, l'agrégateur comme avant pour les autres ; `reprendreConnexionAction` d'un orphelin
  e-mail repart par Gmail (WhatsApp chez l'agrégateur) ; `connecterBoiteDepuisEchangeAction`
  n'a plus de fournisseur à choisir. Le lien de connexion e-mail de l'agrégateur
  (`createEmailHostedAuthLink`, `MailProvider`) est retiré.
- **L'interface** : la feuille de Canaux n'est plus un choix mais un **avertissement** —
  « Relier une boîte Gmail », « Relvo lit les boîtes gérées par Google : une adresse Gmail, ou
  votre adresse professionnelle si vous la consultez dans Gmail », ce que Google demandera,
  « Continuer avec Google » ; la page Canaux ne se rafraîchit plus passé le délai de mise en
  route d'une boîte sans lecture.
- `@relvo/db/erreurs` : un sous-chemin du paquet sans Prisma, pour qu'un module testé sans base
  importe `DomainError` (#73). `RELVO_CHIFFREMENT_CLE` posée en local et en production.
  `README`, `.env.example`, `CLAUDE.md`, `02-modele-donnees.md` (les données de connexion
  d'une boîte Gmail, la connexion en deux temps), l'épique, `ecarts` (« L'e-mail, c'est
  Gmail »), `PITFALLS` #73. Tests web : `gmail.test.ts` (le chiffrement et son refus de
  l'altération, la clé absente ou mal taillée, les jetons chiffrés dans les données du canal,
  l'URL du consentement, les périmètres décochés, l'état du départ, la page de retour),
  `courrier.test.ts` (le relais se charge et dit ce qu'il ne sait pas encore).

**Vérification.** Typage, lint, 230 tests de l'application et 239 du domaine ; rendu headless
de la feuille d'avertissement (clair et sombre), du départ vers Google (le navigateur part sur
`accounts.google.com` avec notre client et notre adresse de retour), de l'étape « première
boîte » de la prise en main avec sa seule proposition, du toast d'un retour en échec ; la route
de retour sans état répond `303` vers Canaux avec le motif `perdu`, anonyme vers la connexion.
**Pas vérifié en local** : le retour réel de Google (il faut un compte Google ; le dirigeant le
fait en production avec sa boîte). D'ici la tranche 5, une boîte Gmail connectée reste « en
attente » : rien n'est lu — c'est dit à la livraison.

## Où on en est

**Chantier ouvert le 2026-10-28.** Découpage validé ; tranches 1 à 3 livrées en production le
jour même. **Ce que la tranche 3 attend du dirigeant** : passer l'écran de consentement de
**Test** à **Production** (les pages légales existent, leurs liens sont posés) — ou, en
attendant, ajouter chaque testeur comme utilisateur de test ; puis relier sa propre boîte par
Google depuis Canaux pour vérifier le retour réel.

**L'infrastructure posée le 2026-10-28, avec le dirigeant** (tranche 0 et le socle de la
tranche 1) : le domaine `relvo.net` acheté chez Ionos, au nom de l'organisation ; `relvo.net`,
`www.relvo.net` (308 vers la racine) et `app.relvo.net` ajoutés au projet Vercel `relvo` de
l'équipe `vcc-impact-labs`, DNS posé chez Ionos, certificats émis ; le domaine prouvé dans la
Search Console avec le compte Workspace de l'organisation. Le projet Google Cloud est celui de la
connexion Google (`Relvo`, identifiant `relvo-498914`, organisation `vccimpact.fr`) : Gmail API
et Pub/Sub activées, écran de consentement « Relvo » sur `relvo.net` en état **Test** (les liens
de confidentialité et de conditions se posent quand les pages existent), périmètres
`gmail.readonly`, `gmail.send`, `userinfo.email`. Le client OAuth est `Relvo Web`
(`885986354227-uomp09k5e85kn39vd7uh5u4tibbl128d.apps.googleusercontent.com`), avec les retours
`https://app.relvo.net/api/gmail/retour` et `http://localhost:3100/api/gmail/retour` ; son
secret se pose sous `GMAIL_CLIENT_SECRET`, jamais sous `AUTH_GOOGLE_SECRET`, qui allumerait la
connexion Google à l'application. **Le passage en production de l'écran de consentement** se
fait à la livraison de la tranche 3 : en état Test, les jetons expirent en sept jours ; en
production non vérifiée, Google avertit et plafonne à cent utilisateurs, sans expiration.

- [ ] Tranche 0 — « Se déclarer » (M24.7, en continu)
- [x] Tranche 1 — « L'adresse » (M24.10)
- [x] Tranche 2 — « Le fournisseur derrière le canal » (M24.1)
- [x] Tranche 3 — « Se connecter à Gmail » (M24.2)
- [ ] Tranche 4 — « Recevoir » (M24.3, M24.6)
- [ ] Tranche 5 — « Lire les quatorze jours » (M24.4)
- [ ] Tranche 6 — « Répondre » (M24.5)
- [ ] Tranche 7 — « Dix boîtes dans l'interface » (M24.8)
- [ ] Tranche 8 — « Migrer » (M24.9)
