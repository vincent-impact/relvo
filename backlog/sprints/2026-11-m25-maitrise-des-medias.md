# Chantier « La maîtrise des médias, et ce qu'ignorer veut dire » — M25, 24 novembre 2026

## Démarrage à froid — à lire en premier

> ▶ **Repris le 2026-11-25**, après les quatre tranches de M29 (`ecarts`, « Les mentions
> d'abord » ; `2026-11-m29-groupes-et-mentions.md`, dont il ne reste que M29.7, après l'usage).
> **C'est de nouveau le chantier en cours** : la tranche 5 est livrée, la suite est la tranche 6.
> Il reste au dirigeant à lancer la purge et à sortir du palier gratuit.

**Où on en est.** La recette de l'alpha est close et M28 terminée. M24 n'attend plus que la
vérification Google, entre les mains du dirigeant : son épique est passée à `partiel` pour
laisser la place d'épique en cours à celle-ci (la page de suivi n'en admet qu'une). Le dirigeant
a tranché le 2026-11-24 (`ecarts`, « Ignorer veut dire ne plus importer ; un groupe se lit sur
mention et deux fois par jour », puis « La salve partout, et une minute » pour le détour et ce
qui en reste) : **M25 d'abord**, augmentée de la règle d'ignorance (M25.9 à M25.12), **puis
M29**, les groupes et les mentions. L'épique est `M25-maitrise-des-medias.md` ; le menu des
solutions S0 à S17 y est tranché ligne à ligne et ne se rouvre pas.

**Pourquoi maintenant.** Mesuré en production le 2026-11-24 : 8 Go stockés pour un palier
gratuit de 10 ; 79 % du poids vient de médias de messages rattachés à aucun sujet ; les
conversations ignorées reçoivent 27 % des messages et 21 % du poids. **Le dirigeant sort du
palier gratuit de son côté** (M25.2) : à vérifier avec lui avant de compter dessus.

**Ce qui existe après la tranche 1, et ne se refait pas.**

- `packages/db/src/domain/reception.ts` : `recevoirEmailEntrant`, `recevoirEmailSortant`,
  `recevoirWhatsAppEntrant`, `recevoirWhatsAppSortant`. La garde cherche la conversation
  ignorée que le message désigne — par sa clé pour l'e-mail (`emailParticipants`, le même
  calcul que `createMessage`), par son fil pour la messagerie (`conversationDuFil`) — et, si
  elle existe, compte le message sans l'importer (`unimportedCount`, `unimportedSince`,
  `unimportedLastAt`, `unimportedLastExternalId` sur `Conversation`). Un message déjà en base
  passe à l'ingestion, qui répond par son idempotence. Test : `packages/db/test/reception.test.ts`.
- Les **deux** points d'entrée de l'application appellent la garde : `server/courrier/reception.ts`
  (tout e-mail, webhook comme lecture à la connexion, agrégateur comme relais Gmail) et le
  webhook de messagerie. `apps/web/test/reception-garde.test.ts` interdit à tout fichier de
  l'application d'appeler une primitive `ingest…`.
- `reactivateConversation` et `attachConversationToSubject` rendent la conversation au
  travail et remettent le compte à zéro ; le journal garde le compte d'avant.

**Ce qui existe après la tranche 2.**

- **Le trou reste écrit jusqu'à sa relecture.** Réactiver ou rattacher ne remet plus le compte
  à zéro : `getUnimportedGap` le rend pour une conversation active, `closeUnimportedGap` le
  solde et journalise attendu et retrouvé (`conversation_gap_reread`).
  `emailConversationKey` dit la clé d'un courrier sans rien écrire.
- `apps/web/src/server/retour-conversation.ts`, `relireLeTrou` : la relecture chez le
  fournisseur, bornée à vingt secondes et cinq pages, puis le tri ou la relecture du sujet
  après la réponse. Messagerie : `listChatMessages` et `listChatAttendees`
  (`server/unipile/client.ts`), traduits par `messageRelu` et `annuaireDuFil`
  (`server/unipile/map.ts`) — **l'annuaire d'un fil, identifiant interne → numéro et nom, est
  la première pierre de M29.1**. E-mail : `lireRecents` prend `avec`, une adresse qui borne la
  liste (`any_email` chez l'agrégateur, `{from: to: cc:}` chez Gmail), et seul le courrier dont
  la clé est celle de la conversation entre.
- Les quatre gestes qui rendent une conversation au travail appellent `relireLeTrou` :
  réactiver, rattacher un fil, rattacher depuis un message, ouvrir un sujet sur la conversation.
- L'écran : le compte sur la ligne et en tête du fil d'une conversation ignorée
  (`RelvoVerdictLine`), le bilan dans le toast de la réactivation, et le trou non relu en tête
  d'un fil actif avec « Les relire » (`trou-a-relire.tsx`). Les phrases sont dans `lib/trou.ts`.

**Ce qui existe après la tranche 3 — le filet.**

- **Le seuil.** `Conversation.noiseStreak` compte les avis « rien à faire » sûrs consécutifs ;
  `recordTriageVerdict` la tient et la rend, la réactivation la remet à zéro.
  `assezDAvisPourIgnorer` (`pipeline/messagerie-regles.ts`) et
  `MESSAGERIE.verdictsAvantIgnorance` (trois) retiennent le tri d'ignorer une conversation de
  messagerie avant la troisième salve concordante, sur ses trois chemins (publicité repérée
  sans modèle, source déjà écartée, verdict du modèle). L'e-mail n'a pas de seuil.
- **Le relevé hebdomadaire.** `domain/releve-ignorees.ts` : `releveDesIgnorees` (ce que Relvo a
  ignoré depuis une date et qui l'est encore, par raison), `phraseDuReleve`,
  `poserReleveIgnorees` (rien quand il n'y a rien, jamais deux dans la même semaine),
  `listAssistantAccounts`. Le cron du matin le pose **le lundi** et le pousse. Sa question vit
  dans un seul échange de Relvo, clé `ignorees` (`CLE_ECHANGE_IGNOREES`), « Ce que j'ai mis de
  côté » ; « Voir la liste » rend l'issue `ignorees-a-revoir`, et l'écran mène à
  `/conversations?filtre=ignorees`.
- **L'avis en deux badges** (essai de la tranche 3 par le dirigeant, `ecarts`, « Deux badges
  plutôt qu'une phrase »). `components/conversations/avis-badges.tsx` : `AvisBadges` sur une
  ligne de la liste — le **conseil** d'abord, coloré (« À traiter » vert, « À ignorer » rouge,
  « Sans avis » cerclé de violet), puis la **nature** en violet plein ; dans « Ignorées », la
  nature seule, précédée de « Ignorée par vous » (bleu) quand c'est le dirigeant. `AvisDuFil`
  en tête du fil : les mêmes badges, la phrase de Relvo, et le compte non importé — qui ne se
  lisent plus que là. Les mots sont dans `lib/conversation-row.ts` (`NATURE_LABELS`,
  `CONSEIL_LABELS`). **Le filtre par raison de la tranche 3 est retiré** — la rangée de
  puces, `?raison=`, et l'option `ignored` de `listConversationItems`.
- **Cinq natures** : professionnel, personnel, publicité, automatique, **indésirable**
  (`unwanted` dans `TriageNature` et `IgnoreReason`, migration
  `20261124220000_nature_indesirable`). La consigne est dans `ia/produit/socle.ts`, la garde
  dans `pipeline/decision.ts` (un indésirable n'ouvre jamais de sujet) et
  `messagerie-regles.ts` (il met en sourdine sur WhatsApp). Les avis déjà rendus gardent leur
  nature.

**Ce qui existe après la tranche 4.**

- **La purge du stock déjà ignoré** (M25.12). `domain/stock-ignore.ts` : `stockIgnoreDuCompte`
  (la simulation, par conversation), `totalDuStock`, `purgerConversationIgnoree` (une
  transaction et une entrée de journal `conversation_stock_purged` par conversation ; l'état
  « ignorée » se relit dans la transaction). Elle retire les pièces et le HTML, garde le
  texte, ce qu'un sujet porte, et le HTML d'un message sans texte. Test :
  `packages/db/test/stock-ignore.test.ts`.
- **Le script** : `pnpm --filter web medias:purger [<e-mail>] [--executer]` — simulation sans
  `--executer`. **Simulé en production le 2026-11-24** (lecture seule) : 2 067 conversations,
  3 982 pièces, 2,28 Go — 28 % du stockage —, et le HTML de 2 549 messages, 95 Mo de base,
  sur dix comptes. ⚠️ **La purge réelle n'est pas lancée** : elle attend l'accord du dirigeant,
  et c'est lui qui la lance (l'accès de l'assistant à la production est en lecture seule).
- **La file de suppression se vide enfin** (`PITFALLS` #80). Mesuré le même jour : 1 124 clés
  en file depuis le 2026-10-21, sans erreur — le drainage ne prenait que cent clés par jour.
  `drainFileDeletions` travaille maintenant dans un budget de temps (vingt secondes au cron du
  matin, quatre minutes sur `/api/cron/drain-file-deletions`), par lots, huit suppressions de
  front, les entrées déjà échouées en dernier.

**Ce qui existe après la tranche 5 — la mesure.**

- **Le bucket se liste** : `StorageProvider.list()` (`packages/storage`), clés et poids, sans
  rien télécharger ; `ownerOfObjectKey` lit le compte dans une clé. Aucun autre accès au
  stockage (`PITFALLS` #8).
- **La base se mesure** : `domain/mesure-stockage.ts` — `mesurerLesPieces` (par compte, canal,
  famille de type, et ce qui tient la pièce), `mesurerLesConnaissances`, `listClesDuStockage`
  (les clés connues, et celles que la file attend). Test : `packages/db/test/mesure-stockage.test.ts`.
- **Les deux se rapprochent** : `apps/web/src/lib/stockage.ts`, pur — `resumerLesPieces`,
  `rapprocherLeBucket` (sans propriétaire, en attente, absents, hors comptes),
  `niveauDuStockage` (alerte à 80 % du repère), `octets`. Test : `apps/web/test/stockage.test.ts`.
  `server/stockage-mesure.ts` assemble, et garde la lecture du bucket un quart d'heure
  (`TAG_BUCKET`, « Relire le bucket » la périme).
- **Au backoffice** : une carte « Stockage » sur la vue d'ensemble (le poids du bucket contre
  le repère, rouge à 80 %), la page `/admin/stockage` (le bucket rapproché de la base, ce qui
  tient les pièces, par type, par canal, par compte), et une section sur la fiche de chaque
  compte. Sur la vue d'ensemble et la fiche, le stockage arrive après le reste de la page
  (`Suspense`) : lister le bucket prend quelques secondes à froid.
- **Le repère** est une configuration, `STOCKAGE_REPERE_GO` (dix par défaut, le palier offert).
- **La preuve de S16, faite le 2026-11-25** en lecture seule, par le même code : le bucket de
  production porte 15 536 fichiers, 7,59 Go ; la base en connaît 15 536 (15 533 pièces, 3
  connaissances) ; **aucun fichier sans propriétaire, aucun absent, aucun hors compte**. Le
  cron du matin a vidé la file (1 124 clés en attente la veille, zéro le matin) et les
  fichiers ont bien quitté le bucket.
- **Ce que la mesure dit** (production, même jour) : la vidéo pèse 53 % du stockage (812
  fichiers), le PDF 22 %, l'image 18 % ; WhatsApp 91 % ; **82 % du poids n'est porté par aucun
  sujet**, dont 29 % dans des conversations ignorées — ce que la purge retire. Quatre comptes
  portent 88 % du poids. Aucune pièce sans taille. C'est ce qui ordonne la tranche 6 : la
  vidéo d'abord.

- **Les doublons se mesurent aussi** : le listing donne l'empreinte de chaque fichier, et le
  même contenu stocké plusieurs fois dans un compte se compte (`EtatDuBucket.doublons`).
  Mesuré le 2026-11-25 : 4 099 fichiers en double, 773 Mo, 9,9 % du stockage. **La condition
  de M25.8 est remplie** — la déduplication a de quoi rendre, à peser contre la vidéo, qui
  pèse cinq fois plus.

**Ce que la tranche 5 ne fait pas, et qu'il ne faut pas croire fait.**

- **L'alerte ne se voit qu'en ouvrant le backoffice** : rien n'est poussé à l'administrateur.
- **Le temps de listing en production n'est pas mesuré** : treize secondes depuis un poste,
  moins attendu depuis la fonction ; il croît avec le nombre de fichiers.
- Les écrans n'ont été rendus qu'en local, où la base est celle de démonstration et le bucket
  celui de production : les chiffres vrais se liront au backoffice après le déploiement.

**Ce que les tranches 1 à 3 ne font pas, et qu'il ne faut pas croire fait.**

- **Le relevé n'a jamais tourné en production** : il se pose au prochain lundi où le cron du
  matin passe. Sa phrase, son échange et sa réponse sont testés ; le rendu de l'échange
  `ignorees` n'a pas été regardé à l'écran.
- **Le seuil ne vaut que pour la suite** : les conversations de messagerie déjà ignorées par
  Relvo le restent. Leur série part de zéro si elles sont réactivées.

- **La relecture n'a pas été jouée contre un vrai fournisseur de bout en bout.** Les formes de
  l'API de messagerie sont vérifiées sur un fil réel (identifiants, ordre, `is_event`,
  participants) et la traduction est testée ; `any_email` est dans les types du SDK mais n'a
  pas été éprouvé, pas plus que la requête Gmail bornée. **À essayer par le dirigeant** :
  ignorer une conversation, laisser passer deux messages, la réactiver.
- **Un message de messagerie sans texte ne revient pas** (photo, vocal) : compté comme non
  retrouvé, et dit. Les envois du dirigeant depuis son client de messagerie non plus — la
  liste est celle de la boîte de réception.
- **Dans un groupe, un expéditeur absent de la liste des participants est laissé** (il a
  quitté le groupe) : son message n'entre pas sous un identifiant illisible.
- **Rattacher depuis l'échange avec Relvo** ne relit pas le trou : il reste écrit, et le fil
  propose « Les relire ».
- **La lecture à la connexion relit chez le fournisseur les courriers d'une conversation
  ignorée à chaque tranche** (ils ne sont jamais « connus ») : du réseau gaspillé, pas une
  erreur. À regarder si une lecture traîne.

## Le découpage

Chaque tranche est livrée, testée, documentée et poussée.

1. **« Ignorer, c'est ne plus importer »** — M25.9, et le compteur de M25.10. Observable : une
   conversation ignorée ne reçoit plus rien, e-mail ou WhatsApp ; la réactiver ou la rattacher à
   un sujet la remet à recevoir.
2. **« Ce qu'on ne lit plus se compte, et se relit au retour »** — le reste de M25.10 : le
   compte sur la ligne et en tête du fil d'une conversation ignorée ; au retour, la relecture
   du trou chez le fournisseur du canal (la frontière `server/courrier/` pour l'e-mail,
   l'agrégateur pour la messagerie), texte seul, et Relvo dit ce qu'il n'a pas pu retrouver.
3. **« Le filet »** — M25.11 : la raison en étiquette et en filtre dans « Ignorées » ; le
   relevé hebdomadaire de ce que Relvo a ignoré, dans un échange de Relvo ; le seuil de
   plusieurs verdicts concordants avant que Relvo n'ignore un interlocuteur de messagerie.
4. **« Le stock »** — M25.12 : la purge unique des pièces et du HTML des conversations déjà
   ignorées, par le domaine et la file de suppression, d'abord en simulation.
5. **« Mesurer »** — M25.1 : le poids par compte, par canal et par type au backoffice, l'état
   du bucket, le seuil d'alerte ; la preuve que la file de suppression vide le bucket.
6. **« Décider avant de télécharger »** — M25.3, M25.5 : plafonds par type, vidéo en
   référence, autocollants et images incorporées jamais stockés, plein format pour ce qu'un
   sujet porte.
7. **« Les images, l'expiration, le quota »** — M25.4, M25.6, M25.7 ; M25.8 seulement si la
   mesure montre des doublons.

## Où on en est

- [x] Tranche 1 — « Ignorer, c'est ne plus importer » (M25.9, compteur de M25.10) — livrée le
      2026-11-24.
- [x] Tranche 2 — le compte montré, le trou relu au retour (M25.10) — livrée le 2026-11-24 ;
      la relecture reste à essayer par le dirigeant sur une vraie conversation.
- [x] Tranche 3 — le filet (M25.11) — livrée le 2026-11-24 ; le relevé se verra au premier
      lundi.
- [x] Tranche 4 — le stock déjà ignoré (M25.12) — l'outil livré et simulé le 2026-11-24 ;
      **la purge réelle reste à lancer par le dirigeant**, puis la file à drainer.
- [x] Tranche 5 — mesurer (M25.1) — livrée le 2026-11-25 ; la file de suppression est prouvée
      vide et le bucket sans fichier perdu.
- [ ] Tranche 6 — décider avant de télécharger (M25.3, M25.5)
- [ ] Tranche 7 — les images, l'expiration, le quota (M25.4, M25.6, M25.7)
- [ ] M25.2 — sortir du palier gratuit, par le dirigeant
