---
id: M25
public: true
ordre_public: 22
titre_client: Les photos et vidéos reçues, sans encombrer
resume_client: >
  Relvo garde ce qui sert à une affaire et va rechercher le reste à la source quand vous le
  demandez. Les conversations en sourdine ne pèsent rien, et l'espace de chaque compte est
  surveillé.
statut: a-faire
---

# M25 — La maîtrise des médias

**Objectif** — que les photos et vidéos reçues par la messagerie **ne saturent pas le
stockage**, sans que personne ait à vider quoi que ce soit à la main. **Dépendances** : M4 (le
paquet de stockage, seule voie d'accès), M6 (la messagerie), M21 (le backoffice). **Précède**
M8.6 (vision sur image) et M20.3 (les vocaux), qui décideront quoi stocker avec cette politique.

**Constat.** Les fils WhatsApp des testeurs charrient des photos et des vidéos ; le webhook les
télécharge **toutes** au premier passage, et le stockage se remplit en quelques jours. Le
dirigeant ne veut **ni tout garder, ni purger à la main** — et il est délicat de dire ce qui est
« utile ». D'où le **menu** ci-dessous : chaque solution se tranche séparément, avec lui.

**Ce que le code fait aujourd'hui, mesuré sur le dépôt.** Le webhook de messagerie télécharge
**tout** média d'un message nouveau — image, vidéo, audio, fichier — jusqu'à **64 Mo** la
pièce, en pleine résolution, sans recompression, et le pose sous `accounts/<id>/attachments/`
avec le même préfixe que les pièces d'e-mail ; l'agrégateur annonce pourtant le **type et la
taille** avant tout téléchargement. L'interface affiche l'image plein format réduite par le
navigateur. Le modèle **ne lit jamais** une image, une vidéo ni un audio lui-même (`05 §6`,
§6.6) : aujourd'hui, un média stocké ne sert qu'à être **regardé** par le dirigeant, et demain à
être étiqueté (M8.6) ou transcrit (M8.7). La suppression d'un message, d'une conversation ou
d'un compte passe par l'outbox de suppression (M4) — à vérifier drainée en production. Ce qui
contraint est le **palier gratuit de 10 Go** du fournisseur (`packages/storage/src/validation.ts`),
pas son prix : au-delà, le stockage coûte de l'ordre de 0,015 $ par Go et par mois, sans frais
de sortie.

## Le menu des solutions — à trancher une par une avec le dirigeant

Chaque ligne est indépendante ; plusieurs se cumulent. « Pertinence » dit ce que Relvo ou le
dirigeant **perdrait**. **Tranché par le dirigeant le 2026-10-27** : toutes les recommandations positives s'implémentent ;
S5 s'éprouve avant de choisir ; S10 et S17 sont écartées.

| #   | Solution | Ce qu'elle économise | Ce qu'elle coûte en pertinence | Recommandation | Décision |
| --- | -------- | -------------------- | ------------------------------ | -------------- | -------- |
| S0  | **Sortir du palier gratuit** : accepter de payer le stockage au-delà de 10 Go | Rien — elle supprime la **saturation**, pas le volume | Aucune | **Oui**, dès maintenant : un service qui s'arrête parce qu'un palier gratuit est atteint n'est pas une politique ; les lignes suivantes gardent la facture basse | ✅ |
| S1  | **Mesurer** : poids par compte, par canal, par type ; état du bucket ; au backoffice, avec un seuil d'alerte | Rien directement — elle dit **où** part l'espace | Aucune | **Oui**, en premier : plusieurs lignes ci-dessous ne se décident qu'avec la mesure (S9, S10) | ✅ |
| S2  | **Décider avant de télécharger** : plafond par **type** pour la messagerie (le webhook connaît type et taille) — par exemple image 10 Mo, audio 5 Mo, fichier 20 Mo, vidéo voir S3 — bien sous les 64 Mo actuels | Les pièces hors norme, les plus lourdes | Quasi nulle : au-delà de ces tailles, c'est une vidéo ou un fichier qu'on ne regarde pas dans Relvo | **Oui** | ✅ |
| S3  | **La vidéo jamais stockée à la réception** : une référence ; lue au tap depuis l'agrégateur ; gardée seulement si le dirigeant la garde ou si une affaire la porte | **La plus grosse part** du volume, très probablement | Nulle pour le tri (le modèle ne lit pas la vidéo) ; une vidéo ancienne peut ne plus être servie par l'agrégateur (à éprouver, S5) | **Oui** | ✅ |
| S4  | **Recompresser les images à l'entrée** : 1 600 px de grand côté, JPEG ou WebP de qualité raisonnable ; l'original n'est pas gardé | De l'ordre de 5 à 10 fois sur chaque photo de téléphone | Un plan ou un document photographié perd le zoom fin ; la vision (M8.6) travaille mieux sur une image réduite | **Oui**, avec S5 pour l'original si l'agrégateur le sert encore | ✅ |
| S5  | **Vignette seule, original au tap** : quelques kilo-octets à la réception, l'original va se chercher chez l'agrégateur quand on l'ouvre, puis se garde | Presque tout sur les images | Dépend entièrement de **combien de temps l'agrégateur sert encore un média** — inconnu aujourd'hui, **à éprouver** sur le compte du dirigeant avant de choisir entre S4 et S5 | **À éprouver d'abord** ; S4 en attendant | 🔬 à éprouver |
| S6  | **Garder en plein format seulement ce qu'une affaire porte** : un message hors affaire (bruit, fil non trié, groupe non écouté) ne reçoit que vignette ou référence ; quand le message rejoint une affaire, le média se complète | Tout ce que le tri écarte — en volume, la majorité des photos de groupe | Nulle pour le tri, c'est lui qui décide ; le dirigeant qui ouvre un fil non trié voit des vignettes | **Oui** | ✅ |
| S7  | **La sourdine, les canaux désactivés et les groupes non écoutés ne téléchargent rien**, pas même la vignette ; les reprendre ne rapatrie pas le passé | Tout ce que le dirigeant a dit ne pas vouloir | Nulle | **Oui** | ✅ |
| S8  | **La lecture de l'historique de la messagerie à la connexion** (reliquat de M7, pas encore construite) ne télécharge **aucun** média : références seules | Le pic du premier jour — quatorze jours de groupes d'un coup | Nulle pour le tri ; décision à prendre **avant** de la construire | **Oui** | ✅ |
| S9  | **L'expiration** : règles de cycle de vie du bucket par préfixe de clé — les médias **non rattachés** expirent après un délai (trente jours proposés) ; ce qu'une affaire porte et ce que le dirigeant a gardé vivent sous un autre préfixe ; la base reflète l'expiration | Le volume qui dort | Une photo d'un fil non trié, jamais ouverte, disparaît ; elle reste chez l'agrégateur | **Oui**, le délai à fixer avec S1 | ✅ |
| S10 | **La purge à la clôture d'une affaire** : quelques mois après la clôture, ses médias redeviennent des références ; les documents (PDF) restent | Les affaires closes, à terme | **Réelle** : une affaire close sert de précédent (M17, fiche de clôture) et l'on rouvre une photo de chantier un an après pour un litige | **Non, pas maintenant** — à revoir avec la mesure | ❌ écartée |
| S11 | **La déduplication** : un même média transféré dans plusieurs fils ou groupes (empreinte du contenu) n'est stocké qu'une fois par compte | Variable — WhatsApp transfère beaucoup | Nulle | **Oui si S1 montre des doublons** ; sinon c'est de la complexité pour rien | ✅ si doublons |
| S12 | **Les types sans valeur** : autocollants, GIF, images de réaction — jamais stockés | Peu en octets, beaucoup en nombre | Nulle | **Oui** | ✅ |
| S13 | **Les vocaux** : gardés (petits, et M8.7 les transcrira), plafonnés par S2 | Rien | — | **Garder** | ✅ garder |
| S14 | **Les images incorporées des e-mails** (logos de signature, pixels de suivi, repérables par leur identifiant de contenu et leur taille) : jamais stockées comme pièces jointes | Petites, mais sur **chaque** e-mail | Nulle | **Oui** — c'est de l'e-mail, mais c'est du bruit pur | ✅ |
| S15 | **Le quota par compte** : une garde en méga-octets lue d'une configuration ; au quota, références seules, et Relvo le dit ; part consommée dans l'Usage (M26) en pourcentage | Borne le pire cas | Au quota, plus de média plein format | **Oui**, large, comme filet | ✅ |
| S16 | **La suppression effective** : vérifier en production que l'outbox de suppression (M4) vide bien le bucket quand une conversation, un canal ou un compte s'efface | Ce qui aurait dû disparaître | Aucune | **Oui**, c'est une vérification, pas une construction | ✅ |
| S17 | **La classe de stockage à accès peu fréquent** du fournisseur | Un tiers du prix au Go, contre des frais de lecture | Aucune | **Non** : gain marginal, complexité réelle | ❌ écartée |

**Le principe retenu.** *Relvo garde ce qui sert à une affaire ; le reste se relit à la
source.* Un média n'est stocké que s'il est rattaché à une affaire, demandé par l'utilisateur,
ou nécessaire à Relvo (une image à étiqueter, M8.6). Tout le reste est une **référence** chez
l'agrégateur, qu'on va chercher au tap.

| #     | Item                                                                                                                                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M25.1 | **Mesurer et vérifier** (S1, S16) : le poids stocké par compte, par canal et par type (la taille des pièces est en base) et l'état du bucket lu chez le fournisseur, sur la vue d'ensemble et la fiche d'un compte du backoffice, avec un seuil d'alerte ; et la preuve en production que l'outbox de suppression vide le bucket quand une conversation, un canal ou un compte s'efface |
| M25.2 | **Sortir du palier gratuit** (S0) — par le dirigeant, chez le fournisseur, au nom de l'organisation : la saturation cesse d'être possible, le reste tient la facture basse                                                                               |
| M25.3 | **Décider avant de télécharger** (S2, S3, S7, S8, S12, S14) : plafonds par **type** pour la messagerie, lus d'une configuration ; la **vidéo** n'est qu'une référence, lue au tap chez l'agrégateur ; autocollants, GIF et réactions jamais stockés ; les images incorporées des e-mails (identifiant de contenu, petite taille) jamais stockées ; une conversation ignorée, un canal désactivé, un groupe non écouté et **la lecture de l'historique de la messagerie** ne téléchargent rien ; les vocaux restent (S13), plafonnés |
| M25.4 | **Les images** (S4, S5) : recompressées à l'entrée (1 600 px de grand côté), l'original non gardé ; **et d'abord l'épreuve** sur le compte du dirigeant de la durée pendant laquelle l'agrégateur sert encore un média — si elle suffit, la vignette seule à la réception et l'original au tap, qui se garde alors ; sinon la recompression seule                                            |
| M25.5 | **Le plein format pour ce qu'une affaire porte** (S6) : un message hors affaire ne reçoit que vignette ou référence ; quand il rejoint une affaire, le média se complète chez l'agrégateur ; le tri décide, jamais une règle de plus                                                                  |
| M25.6 | **L'expiration par cycle de vie** (S9) : le paquet de stockage pose les médias de messagerie non rattachés sous un **préfixe** qui expire (trente jours), ce qu'une affaire porte et ce que le dirigeant garde sous un préfixe qui ne meurt pas ; la base reflète l'expiration (la pièce redevient une référence) ; le préfixe **est** la politique, tenu par un test                              |
| M25.7 | **Le quota par compte** (S15) : une garde en méga-octets lue d'une configuration ; au quota, références seules, et Relvo le dit ; la part consommée se lit dans l'Usage (M26) en pourcentage, jamais en octets ni en euros                                                                                     |
| M25.8 | **La déduplication** (S11) : seulement si M25.1 montre des transferts en double — empreinte du contenu, un objet par compte                                                                                                                                                                   |

**Écarté** : la purge à la clôture d'une affaire (S10 — une affaire close est un précédent, et
l'on rouvre une photo de chantier un an après pour un litige) et la classe de stockage à accès
peu fréquent (S17). **L'e-mail garde ses pièces jointes** : une pièce d'e-mail est un document,
M8 en a besoin ; seules ses images incorporées sont du bruit.

⚠️ **Aucun accès direct au stockage** (`CLAUDE.md`, `PITFALLS.md` #8) : la mesure, la purge et
le préfixe passent par le paquet, jamais par un client instancié à la main.
