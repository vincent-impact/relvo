# Chantier « La maîtrise des médias, et ce qu'ignorer veut dire » — M25, 24 novembre 2026

## Démarrage à froid — à lire en premier

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

**Ce que la tranche 1 ne fait pas, et qu'il ne faut pas croire fait.**

- **Rien ne montre encore le compte** : la ligne d'une conversation ignorée ne dit pas « douze
  messages depuis le 3 novembre ». C'est la tranche 2.
- **Rien ne relit le trou au retour** : réactiver ou rattacher remet à recevoir à partir de
  maintenant ; ce qui s'est dit entre-temps reste chez le fournisseur. C'est la tranche 2.
- **La lecture à la connexion relit chez le fournisseur les courriers d'une conversation
  ignorée à chaque tranche** (ils ne sont jamais « connus ») : du réseau gaspillé, pas une
  erreur. À regarder si une lecture traîne.
- **Le filet d'un faux verdict n'est pas posé** (tranche 3) alors que la règle est en
  production : jusque-là, une conversation que Relvo ignore à tort perd ses messages suivants
  sans que rien ne le signale. C'est la raison de faire les tranches 2 et 3 sans attendre.

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
- [ ] Tranche 2 — le compte montré, le trou relu au retour (M25.10)
- [ ] Tranche 3 — le filet (M25.11)
- [ ] Tranche 4 — le stock déjà ignoré (M25.12)
- [ ] Tranche 5 — mesurer (M25.1)
- [ ] Tranche 6 — décider avant de télécharger (M25.3, M25.5)
- [ ] Tranche 7 — les images, l'expiration, le quota (M25.4, M25.6, M25.7)
- [ ] M25.2 — sortir du palier gratuit, par le dirigeant
