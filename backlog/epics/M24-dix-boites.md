---
id: M24
public: true
ordre_public: 21
titre_client: Dix boîtes e-mail par compte
resume_client: >
  Vous confiez à Relvo toutes vos boîtes — jusqu'à dix par compte — sans que chacune coûte
  un abonnement. Relvo lit vos boîtes Gmail en direct, et WhatsApp continue comme aujourd'hui.
statut: a-faire
---

# M24 — Dix boîtes par compte

**Objectif** — qu'un compte confie **au moins dix boîtes e-mail** à Relvo, exigence première
des testeurs, **sans que chaque boîte coûte l'abonnement de l'agrégateur**. **Dépendances** :
M5 (le rangement du courrier, inchangé), M7.19 (la lecture à la connexion, réutilisée telle
quelle), M21 (le backoffice voit le fournisseur de chaque canal).

**Pourquoi.** L'agrégateur facture environ cinq euros par compte connecté (`ecarts`, « Le
disjoncteur de coût ») : dix boîtes, c'est cinquante euros par siège, pour un abonnement vendu
cinquante-neuf. Toutes les boîtes des testeurs sont des **comptes Gmail**. Le relais e-mail
en propre, « facile pour l'e-mail, bien plus difficile pour WhatsApp », cesse d'être un poste à
remplacer un jour : il conditionne la marge. **Tranché** (`ecarts`, « Le relais Gmail se
construit, avec le nom de domaine de Relvo ») : Relvo construit son webhook, se déclare auprès de
Google, et prend son nom de domaine.

**Ce qui ne bouge pas.** Le courrier entre par un **webhook** et **aucun processus permanent**
n'apparaît ; tout ce qui suit la réception — rangement, tri, affaires, pièces jointes, lecture
à la connexion par tranches — est le code d'aujourd'hui, consommé par un second fournisseur
derrière la même frontière (`server/unipile/map.ts` fabrique un courrier entrant ; le relais
fabriquera le même). **Jamais de duplication** du domaine.

| #     | Item                                                                                                                                                                                                                                                                    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M24.1 | **Le fournisseur derrière le canal** : la configuration du canal porte son fournisseur (agrégateur ou relais Gmail) ; un seul contrat de courrier entrant, un seul contrat d'envoi, deux implémentations ; les pages Canaux, l'échange et le backoffice ne voient qu'un canal |
| M24.2 | **La connexion Gmail** : projet Google de l'organisation (jamais un compte personnel), consentement OAuth aux seuls périmètres lecture et envoi, jetons chiffrés en base, connexion depuis Canaux **et** depuis l'étape « première boîte » de la prise en main, retour dans l'échange comme aujourd'hui |
| M24.3 | **La réception par notification** : abonnement de la boîte aux changements (Pub/Sub), webhook `/api/webhooks/gmail`, lecture **incrémentale** depuis le dernier identifiant d'historique ; l'abonnement expire en sept jours et se **renouvelle au passage** (webhook, cron du matin) — pas de troisième cron (Hobby en tolère deux) |
| M24.4 | **La lecture à la connexion** : les quatorze derniers jours par la liste des messages, versés dans les mêmes tranches (`channel_catchups`) que M7.19 ; la carte vivante ne change pas                                                                                        |
| M24.5 | **L'envoi** : par l'API, dans le fil (`threadId`, `In-Reply-To`, `References`) ; l'e-mail envoyé depuis Gmail entre dans l'affaire comme aujourd'hui (`mail_sent` a son équivalent dans l'historique)                                                                      |
| M24.6 | **Les pièces jointes** : relues par l'API, rangées par la même fonction que M5 ; la politique de M25 s'applique                                                                                                                                                           |
| M24.7 | **La vérification Google** — chantier administratif, **à démarrer le premier jour** : écran de consentement au nom de l'organisation, politique de confidentialité, puis vérification des périmètres restreints (évaluation de sécurité annuelle) ; tant qu'elle n'est pas faite, Google avertit l'utilisateur et borne le nombre de comptes, de l'ordre de cent — suffisant pour la bêta, pas pour l'ouverture |
| M24.8 | **Dix boîtes dans l'interface** : Canaux en liste, choix de la boîte d'envoi dans le composer quand plusieurs peuvent répondre, la prise en main qui propose « une autre boîte ? » après la première, le backoffice qui compte les boîtes par compte                           |
| M24.10 | **Le nom de domaine et l'infrastructure publique** — **en premier**, parce que Google l'exige avant tout : le domaine de Relvo au nom de l'organisation (jamais un compte personnel, `CLAUDE.md`), l'application et les webhooks dessus, la page de politique de confidentialité et les conditions d'utilisation à l'adresse déclarée, le domaine vérifié chez Google, les variables d'environnement et `AUTH_URL` basculées, l'ancienne adresse redirigée ; `PITFALLS.md` relu pour tout ce qui cite l'adresse (proxy, routes publiques, push) |
| M24.9 | **La migration** : une boîte Gmail connectée par l'agrégateur se **reconnecte** par le relais sans perdre ses conversations (même identifiant de boîte, même canal), puis se supprime chez l'agrégateur ; script, journalisé                                                   |

**Ce qui reste à l'agrégateur** : WhatsApp, et les boîtes qui ne sont pas Gmail (Outlook, IMAP)
tant que personne n'en demande dix.

⚠️ **Le coût du relais n'est pas nul : il est en temps.** Deux semaines de construction, et une
vérification Google qui se compte en semaines et se renouvelle chaque année. C'est ce que
`ecarts` met en balance.
