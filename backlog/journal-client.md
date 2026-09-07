# Journal client — reprise de l'historique

> **Écrit à la main, une seule fois, et FIGÉ.** Ce fichier couvre la période antérieure à la
> convention du pied de message `Client:`. À partir de la date de reprise, le journal se
> construit **uniquement** depuis les commits — plus une ligne n'est ajoutée ici.

## Pourquoi ce fichier existe

Les commits antérieurs au 2026-09-08 sont écrits pour l'équipe : « pièges #5b ET #5c »,
« migration name → first_name/last_name », « M6quater ». Publiés tels quels, ils donnaient un
journal de 143 lignes que le client ne pouvait pas lire — et un journal illisible est pire
qu'un journal absent, parce qu'il occupe la place de celui qui aurait servi.

Trois options existaient. **Réécrire l'historique git** pour y greffer des pieds de message :
exclu, on ne récrit pas un historique livré. **Publier quand même** : exclu, c'est le problème.
**Reprendre l'historique une fois à la main** : retenu, parce que le coût est borné — il ne se
représentera jamais, la convention prenant le relais.

## Les règles de ce fichier

- **Une entrée décrit un effet observable par le client**, jamais une implémentation.
- **Rien après la date de reprise.** `scripts/generate-changelog.mjs` refuse de tourner si une
  date de ce fichier atteint la reprise — c'est ce qui empêche ce fichier de redevenir, mois
  après mois, la vraie façon d'écrire le journal.
- **Le regroupement est par date de livraison réelle**, pas par commit. Quinze commits d'un même
  après-midi produisent une entrée si l'utilisateur n'en voit qu'une chose.

---

## 2026-09-07

- **Nouveau** — Une conversation se classe ou s'ignore d'un simple glissement de doigt, directement depuis la liste.
- **Corrigé** — Sur Android, le clavier ne recouvre plus la zone de saisie d'un message.
- **Corrigé** — Au glissement, la couleur et le mot affichés correspondent enfin à l'action qui va se produire.

## 2026-07-29

- **Nouveau** — Une conversation e-mail suit désormais le groupe de personnes qui y participent : ajouter quelqu'un en copie ne crée plus un second fil en double.

## 2026-07-28

- **Nouveau** — La fiche d'un contact s'ouvre en plein écran, avec tous ses numéros et toutes ses adresses e-mail visibles d'un coup.
- **Nouveau** — Un message entrant reconnaît son expéditeur même s'il arrive d'un numéro ou d'une adresse secondaire.
- **Nouveau** — Les contacts prennent leur place dans le menu du bas, à côté des conversations.
- **Corrigé** — Un contact enregistré après coup est reconnu dans les conversations déjà ouvertes.
- **Corrigé** — Le fil de citation d'un e-mail n'apparaît plus au milieu du message reçu.

## 2026-07-27

- **Nouveau** — Un canal déconnecté se reconnecte sans perdre les messages déjà reçus.
- **Corrigé** — Un envoi ou une connexion qui échoue vous le dit clairement, au lieu d'échouer en silence.

## 2026-07-24

- **Nouveau** — Un sujet réunit ses conversations, ses documents et ses informations dans des onglets séparés.
- **Nouveau** — Vos sujets se trient par état : ouverts, validés, fermés.
- **Nouveau** — Votre journée s'ouvre sur trois vues : l'agenda, ce qui est en retard, ce qui reste à trier.

## 2026-07-22

- **Nouveau** — Un fil e-mail devient un sujet d'un seul geste.
- **Nouveau** — Un échange WhatsApp se suit à partir du message que vous désignez, et se referme quand l'affaire est close — le reste de la discussion ne vient pas s'y mêler.
- **Nouveau** — Les e-mails s'affichent avec leur mise en forme d'origine, images comprises.

## 2026-07-20

- **Nouveau** — Chaque message est rangé à son arrivée dans la conversation qui lui revient : par objet pour un e-mail, par interlocuteur pour WhatsApp.
- **Nouveau** — Les groupes WhatsApp sont reconnus comme tels, et affichés sous le nom du groupe.

## 2026-07-18

- **Nouveau** — WhatsApp entre dans Relvo par le même chemin que l'e-mail : vos messages, vos photos et vos documents y arrivent, et vous répondez sans changer d'application.
- **Nouveau** — Les photos reçues s'affichent directement dans le fil de la conversation.

## 2026-07-17

- **Nouveau** — Votre boîte e-mail entre dans Relvo, et vous y répondez depuis votre vraie adresse : vos interlocuteurs ne voient aucune différence, et vos réponses se retrouvent dans vos messages envoyés.
- **Nouveau** — Un e-mail entrant rejoint tout seul le sujet auquel il se rapporte, d'après son objet et son expéditeur.
- **Nouveau** — Les pièces jointes s'ouvrent sans quitter l'application : une image en plein écran, un PDF page à page.
- **Nouveau** — Un canal de messagerie se retire des réglages quand vous n'en voulez plus.

## 2026-07-15

- **Nouveau** — Les documents reçus — factures, devis, bons de livraison — sont conservés durablement et restent consultables depuis leur sujet, y compris après sa clôture. Ils sont stockés en Europe.

## 2026-06-28

- **Nouveau** — L'accueil devient votre page de tâches : ce qui est prévu, ce qui est en retard, ce qui reste à trier.
- **Nouveau** — Votre semaine s'affiche en agenda, et une tâche se déplace d'un jour à l'autre en la faisant glisser.
- **Nouveau** — Un sujet montre ses échanges séparés par interlocuteur, et vous répondez à la bonne personne depuis le sujet.
- **Corrigé** — Sur iPhone, l'application garde sa hauteur au démarrage, reste en portrait et ne se dézoome plus par accident.

## 2026-06-27

- **Nouveau** — Relvo s'ouvre depuis un bouton en haut de l'écran, présent sur toutes les pages.
- **Nouveau** — Votre fil se filtre d'un geste : urgents, nouveaux, ou par domaine d'activité.
- **Corrigé** — Sur iPhone, l'écran ne rebondit plus et ne laisse plus de bande blanche sous la barre du bas.

## 2026-06-26

- **Nouveau** — Vos contacts ont leur annuaire : recherche, classement alphabétique, création d'une fiche.
- **Nouveau** — Chaque domaine d'activité porte son logo et ses consignes, que vous modifiez vous-même.
- **Nouveau** — Une tâche se crée et se modifie sans quitter l'écran où vous êtes.

## 2026-06-24

- **Nouveau** — Relvo s'installe sur votre téléphone comme une véritable application, avec son icône sur l'écran d'accueil et son plein écran.
- **Nouveau** — Les écrans du quotidien sont en place : vos actions du jour, vos sujets, vos conversations, vos contacts.

## 2026-06-17

- **Nouveau** — La structure de votre espace de travail est posée : un sujet regroupe une affaire, ses échanges, ses tâches et les décisions prises.

## 2026-06-11

- **Nouveau** — Votre compte est protégé par un mot de passe, et vos données ne sont accessibles qu'à vous.
