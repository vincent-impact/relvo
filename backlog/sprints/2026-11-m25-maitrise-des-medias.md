# Chantier « La maîtrise des médias, et ce qu'ignorer veut dire » — M25, 24 novembre 2026

## Démarrage à froid — à lire en premier

> ⏭ **La suite, notée par le dirigeant le 2026-11-25** : M25 et M29 sont construites en entier
> et attendent son jugement à l'usage. **Le prochain à construire est M12.11** — un envoi qui
> ouvre une conversation se trie comme un message reçu (« ça c'est grave ») —, puis
> **M12.12**, les trois sélecteurs de la page Conversations, puis **M8.7**, le message vocal
> transcrit à la réception pour qu'il participe au tri. Les trois décisions sont dans
> `ecarts`, en fin de « Décisions tranchées ».

> ▶ **Repris le 2026-11-25**, après les quatre tranches de M29 (`ecarts`, « Les mentions
> d'abord » ; `2026-11-m29-groupes-et-mentions.md`, dont il ne reste que M29.7, après l'usage).
> **C'est de nouveau le chantier en cours** : la tranche 5, **le nettoyage** (M25.13) et **la
> tranche 6** (« décider avant de télécharger », M25.3 et M25.5 — et M25.4, tranchée par
> l'épreuve) et **la tranche 7** (le quota par compte, M25.7 ; la déduplication, M25.8) sont
> livrés : **l'épique n'a plus de tranche à construire**. Il reste au dirigeant à sortir du
> palier gratuit (M25.2) et à juger à l'usage — **le stock est dédoublonné** depuis le
> 2026-11-25 (830 Mo libérés), et le filet passe désormais au cron du matin. ⚠️ De la tranche 6, la réception est vue en production (trois pièces entrées en
> référence le jour même) ; **l'ouverture réussie d'une référence et la complétion par un sujet
> ne le sont pas encore** (voir « Ce que la tranche 6 ne fait pas »). ⚠️ **Le nettoyage est ARMÉ depuis le 2026-11-25**, sur le
> mot du dirigeant (`NETTOYAGE_ACTIF`, `apps/web/src/lib/nettoyage.ts`) : son **premier passage
> réel est celui du cron du matin du 2026-11-26** — à relire ce matin-là (l'événement
> `nettoyage` de chaque compte, la file de suppression, le poids du bucket). La purge manuelle
> n'existe plus. Il reste au dirigeant à sortir du palier gratuit.

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

- **La purge du stock déjà ignoré** (M25.12) — livrée ce jour-là en script simulé
  (`medias:purger`, `domain/stock-ignore.ts`), **retirée le lendemain sans avoir été lancée** :
  le nettoyage (M25.13) efface à trente jours ce que les conversations ignorées portent, texte
  compris. Sa simulation du 2026-11-24 reste le repère : 2 067 conversations, 3 982 pièces,
  2,28 Go.
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

**Ce qui existe après le nettoyage** (M25.13 ; `ecarts`, « Le nettoyage : ce qui n'a pas de
sujet ne reste pas » ; `conception/04` §11).

- **Les règles** : `packages/db/src/domain/nettoyage.ts`. Trois filtres écrits une fois —
  `sujetAEffacer`, `messageExpire`, `conversationEmailVide` — et lus par les deux fonctions :
  `simulerLeNettoyage` (rien n'est écrit) et `nettoyerLeCompte` (sujets fermés, puis messages,
  puis conversations e-mail vidées, puis le dernier message de chaque conversation qui a perdu
  le sien ; un événement `nettoyage` par passage qui retire quelque chose). Test :
  `packages/db/test/nettoyage.test.ts`.
- **La garde de la réception** : `estTropAncienPourEntrer` — `recevoir…` rend
  `{ ecartee: true, motif: "trop-ancien" }` pour un message daté de plus de trente jours qui
  n'est pas déjà en base. ⚠️ **Active dès la livraison**, armement ou pas.
- **Le passage** : `apps/web/src/server/nettoyage.ts`, `passerLeNettoyage` — tous les comptes,
  sous un budget de temps ; le cron du matin le lance EN PREMIER (quatre-vingt-dix secondes),
  puis draine la file (une minute). `effacerLesFichiersSupprimes` lance le drainage aussitôt
  après la suppression d'un canal, d'un compte ou d'une pièce.
- **L'interrupteur** : `NETTOYAGE_ACTIF` (`lib/nettoyage.ts`), **vrai depuis le 2026-11-25**
  (livré faux le matin, basculé le jour même sur le mot du dirigeant). Il commande le passage
  réel **et** ce que l'écran en dit : la mention en tête d'un fil, « Fermé · effacé le … » sur
  la fiche, le toast de fermeture, le paragraphe « Combien de temps » de la politique de
  confidentialité.
- **Voir avant** : `pnpm --filter web nettoyage:simuler [<e-mail>]`, et la section « Le
  nettoyage » de `/admin/stockage`.
- **Retiré** : `domain/stock-ignore.ts`, `medias:purger`, l'événement `conversation_stock_purged`.
- **Simulé en production le 2026-11-25**, lecture seule : 8 487 messages, 2 262 pièces
  (1,51 Go), 670 conversations e-mail, 5 sujets fermés, neuf comptes touchés.

**Ce qui existe après la tranche 6 — décider avant de télécharger** (M25.3, M25.5, M25.4 ;
`ecarts`, « Les médias : une référence, complétée à l'ouverture ou par un sujet » ;
`conception/04` §11).

- **Une pièce n'est pas toujours stockée.** `attachments.storage_key` est nullable ; trois
  colonnes de plus, `external_id`, `thumbnail`, `unavailable_at` (migration
  `20261125140000_m25_pieces_en_reference`). `etatDePiece` (`domain/attachments.ts`) rend
  `stockee`, `reference`, `indisponible` ou `trace` ; `pieceDeFil` et `PIECE_DE_FIL_SELECT`
  sont la seule projection d'une pièce vers un fil — jamais sa clé.
- **La règle** : `apps/web/src/lib/medias.ts`, pur — `MEDIAS` (plafonds par famille, seuil des
  images incorporées), `deciderDeLaPiece` (stocker, référence, trace), `estUneImageIncorporee`.
  Test : `apps/web/test/medias.test.ts`.
- **Ce que l'agrégateur dit d'une pièce** : `getChatMessage` (`server/unipile/client.ts`) relit
  le message à l'unité ; `piecesDuMessage` et `vignetteDepuisOriginal` (`server/unipile/map.ts`)
  en tirent le type, le poids, autocollant / GIF / vocal, le nom d'un fichier, et la vignette
  que WhatsApp joint au message brut.
- **Les trois gestes** : `apps/web/src/server/medias.ts` — `recevoirLesPieces` (le webhook),
  `completerPiece` (à l'ouverture ; une seule lecture à la fois par pièce, et le domaine ne
  garde qu'un fichier si deux instances se croisent), `completerLesPiecesPortees` (ce qu'un
  sujet porte : après le tri, après les gestes de rattachement, à la fin d'une lecture des
  groupes, et aux deux crons).
- **Le domaine de la complétion** : `getPieceARelire`, `noterPieceStockee`,
  `noterPieceIndisponible`, `listPiecesACompleter` (les références qu'un sujet porte, sous le
  plafond de leur famille), `PAS_UNE_TRACE`. Deux événements : `attachment_stored`,
  `attachment_unavailable`. Test : `packages/db/test/pieces-reference.test.ts`.
- **Toute lecture d'une pièce complète une référence** : `resolveAttachmentFile`
  (`server/storage-access.ts`), que les trois routes `/download`, `/apercu`, `/contenu`
  appellent. Un refus dit pourquoi : 410 (la source ne la sert plus), 413 (trop lourde), 502.
- **L'écran** : `ImageEnReference` (la vignette floue, le poids, l'original au toucher),
  la mention sous le nom d'un fichier, le mot d'un autocollant ou d'un GIF
  (`attachment-preview.tsx`) ; la visionneuse attend l'image et dit quand elle ne viendra pas
  (`attachment-viewer.tsx`) ; l'écran d'un fichier a trois phrases de plus (`lib/pieces.ts`).
- **L'e-mail** : `PieceJointeRef.incorporee`, renseigné par l'agrégateur (`cid`) et par Gmail
  (l'en-tête `Content-ID`) ; `stockerPiecesJointes` laisse les images incorporées légères.
- **La mesure** compte les références à part (`PoidsDesPieces.references`, `octetsAnnonces`)
  et le dit sous « Ce qui tient les pièces » ; le nettoyage ne compte que ce qui est stocké.
- **L'épreuve du 2026-11-25**, lecture seule, compte du dirigeant : 43 médias sur 44 relus chez
  l'agrégateur, de 1 à 127 jours, en 0,2 à 3,5 secondes.

**Ce qui existe après la tranche 7 — le quota et la déduplication** (M25.7, M25.8 ; `ecarts`,
« Le quota et la déduplication : un filet, et un fichier par contenu » ; `conception/04` §11).

- **Un seul dépôt** : `apps/web/src/server/depot.ts` — `deposerUnePiece` (l'e-mail et la
  messagerie y passent), `quotaDuCompte` (`STOCKAGE_QUOTA_COMPTE_GO`, cinq par défaut),
  `espaceDuCompte` (la même lecture pour la garde, l'Usage et le backoffice).
- **L'empreinte** : `attachments.content_hash` (migration
  `20261125180000_m25_empreinte_des_pieces`), le MD5 du contenu — celui que le bucket rend
  dans son listing. Vérifié le 2026-11-25 sur quatre fichiers réels.
- **Le domaine** : `packages/db/src/domain/deduplication.ts` — `trouverCleDeMemeContenu` (à
  l'entrée), `planDeDeduplication` (pur) et `dedoublonnerLeCompte` (le filet : d'après les
  empreintes en base, doublons repointés sur le plus ancien, fichiers abandonnés mis en file —
  une transaction par compte, un événement `deduplication`). Test :
  `packages/db/test/deduplication.test.ts`.
- **Le filet** : `server/deduplication.ts` (`passerLaDeduplication`), que le cron du matin
  passe après le nettoyage et avant le drainage. Il ne lit que la base. **Aucun geste au
  backoffice** : le bouton « Dédoublonner… » livré d'abord a servi une fois, puis a été retiré
  (`ecarts`, « Le quota et la déduplication »).
- **Le quota** : `deciderDeLaPiece` prend `auQuota` ; `recevoirLesPieces` ne le mesure que si
  une pièce allait se stocker ; `completerLesPiecesPortees` laisse les comptes pleins.
  `poidsStockeDuCompte` (`domain/mesure-stockage.ts`) compte par clé distincte, connaissances
  comprises.
- **La mesure** : un fichier partagé ne pèse qu'une fois (`mesurerLesPieces`, compté chez la
  pièce qu'un sujet porte) ; `partagees` et `octetsPartages` disent ce que la déduplication
  épargne.
- **L'écran** : la carte « Espace » de `/usage`, réelle ; au backoffice, « Quota du compte »
  sur la fiche et « % du quota » dans la liste par compte.
- **Mesuré le 2026-11-25**, lecture seule : 4 107 fichiers en double, 830 Mo ; dont 2 522
  fichiers et 270 Mo dans des messages qu'un sujet porte. Le plus gros compte pèse 2,3 Go.

**Ce que la tranche 7 ne fait pas, et qu'il ne faut pas croire fait.**

- **Le filet du matin n'a jamais tourné en production** : seuls les tests l'exécutent. Son
  premier passage est celui du 2026-11-26 ; il ne devrait rien trouver, le stock ayant été
  dédoublonné la veille.
- **Deux fichiers identiques qui arrivent au même instant** se stockent deux fois : le
  second n'a pas encore vu le premier. Ils restent en double jusqu'au matin suivant.
- **Une pièce stockée sans empreinte ne serait jamais rapprochée** : le filet ne lit plus le
  bucket. Il n'y en a aucune aujourd'hui, et tout dépôt en note une ; la ligne « Doublons dans
  un même compte » du backoffice, lue du bucket, le dirait.
- **Le quota ne rationne pas l'e-mail**, ni ce que le dirigeant ouvre : un compte peut le
  dépasser. Il ne protège pas le palier gratuit non plus.
- **Personne n'est prévenu à l'approche du quota** : ni notification, ni question de Relvo. Il
  se lit dans l'Usage et au backoffice.
- **Le bilan du nettoyage est un majorant** depuis que des pièces partagent un fichier.
- **Les connaissances déposées ne se dédoublonnent pas** : elles partent du navigateur droit
  au stockage.

**Ce que la tranche 6 ne fait pas, et qu'il ne faut pas croire fait.**

- **Le chemin heureux n'a pas été joué de bout en bout.** Le stockage local est le bucket de
  production : compléter une vraie pièce en local y aurait écrit. Sont prouvés : la règle et
  la traduction (tests), le domaine (tests d'intégration), la relecture chez l'agrégateur
  (l'épreuve), le chemin d'échec, joué en local jusqu'à l'écran, et **la réception, vue en
  production le jour même** (un PDF, une photo avec sa vignette, un classeur : trois pièces
  sans clé, avec `external_id`). **Reste à lire en production** : à la première ouverture, un
  événement `attachment_stored` ; et la complétion quand un sujet prend un message.
- **La forme du webhook n'a pas été relue** : la décision s'appuie sur le message relu à
  l'unité, pas sur lui. Si cette relecture échoue, la pièce est décidée sur le type et le
  poids du webhook, sans vignette ni nom.
- **Le stock n'est pas touché** : ce qui était stocké le reste, jusqu'au nettoyage.
- **Les réponses écrites depuis le téléphone** n'ont jamais porté leurs pièces, et ne les
  portent toujours pas.
- **Une vidéo ne se lit pas dans Relvo** : elle s'ouvre comme un fichier (« Ouvrir avec… »,
  « Télécharger »), comme avant. Sa vignette sert d'affiche à sa carte.
- **Un PDF en référence s'ouvre dans l'onglet du navigateur après quelques secondes
  d'attente** — le temps d'aller le chercher —, sans rien montrer pendant ce temps.
- **Le relevé du trou** (`relireLeTrou`) ne ramène toujours que le texte.
- **« Un canal désactivé ne télécharge rien »** n'a pas de garde à lui : aucun geste ne
  désactive un canal aujourd'hui (on le supprime, ou on ignore ses conversations). Si
  `is_active` servait un jour, la réception n'en tient pas compte : le texte entrerait encore,
  et les pièces suivraient la règle commune.

**Ce que le nettoyage ne fait pas, et qu'il ne faut pas croire fait.**

- **Il n'a pas encore tourné pour de bon** : armé le 2026-11-25, son premier passage est celui
  du lendemain matin ; jusque-là seuls les tests d'intégration l'ont exécuté. Ce premier
  passage est le plus gros qu'il fera.
- **Le temps du premier passage n'est pas mesuré** : plusieurs milliers de lignes effacées par
  compte, dans le budget du cron ; un compte non atteint attend le lendemain.
- **Les fils affichés auront des trous** : dans une conversation de messagerie, ce qui précède
  l'ouverture d'un sujet n'est porté par rien et expire. La mention en tête du fil le dit.
- **176 conversations e-mail déjà vides ou datées de travers** ne partent pas au premier
  passage : leur dernier message est noté récent. Elles partiront quand cette date aura trente
  jours ; d'ici là elles sont hors des listes.
- **Le journal garde** les coûts d'inférence et les phrases d'avis de Relvo sur des messages
  expirés (`event_logs`, 56 Mo) : rien ne les fait expirer.
- **Prévenir les testeurs** est resté au dirigeant : l'armement n'envoie aucun message, seul
  l'écran le dit (en tête d'un fil, sur un sujet fermé, dans la politique de confidentialité).

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
7. **« Le quota, la déduplication »** — M25.7, M25.8 (la mesure a montré les doublons). Les
   images (M25.4) sont parties avec la tranche 6, l'expiration (M25.6) avec le nettoyage.

## Où on en est

- [x] Tranche 1 — « Ignorer, c'est ne plus importer » (M25.9, compteur de M25.10) — livrée le
      2026-11-24.
- [x] Tranche 2 — le compte montré, le trou relu au retour (M25.10) — livrée le 2026-11-24 ;
      la relecture reste à essayer par le dirigeant sur une vraie conversation.
- [x] Tranche 3 — le filet (M25.11) — livrée le 2026-11-24 ; le relevé se verra au premier
      lundi.
- [x] Tranche 4 — le stock déjà ignoré (M25.12) — l'outil livré et simulé le 2026-11-24,
      **retiré le 2026-11-25 sans avoir été lancé** : le nettoyage le remplace. Il en reste le
      drainage de la file par budget de temps.
- [x] Tranche 5 — mesurer (M25.1) — livrée le 2026-11-25 ; la file de suppression est prouvée
      vide et le bucket sans fichier perdu.
- [x] Le nettoyage (M25.13, qui remplace M25.6 et M25.12) — livré le 2026-11-25 à l'arrêt,
      **armé le même jour** sur le mot du dirigeant ; premier passage réel au cron du matin du
      2026-11-26, à relire.
- [x] Tranche 6 — décider avant de télécharger (M25.3, M25.5 ; M25.4 tranchée par l'épreuve)
      — livrée le 2026-11-25 ; le chemin heureux reste à lire en production.
- [x] Tranche 7 — le quota (M25.7) et la déduplication (M25.8), à l'entrée et sur le stock —
      livrée le 2026-11-25 ; le stock dédoublonné le jour même, le filet passé au cron du matin.
- [ ] M25.2 — sortir du palier gratuit, par le dirigeant
