---
id: M21
public: false
statut: en-cours
debut: 2026-10-19
---

# M21 — Mini backoffice

**Objectif** — ce qu'il faut pour **ouvrir l'alpha** : voir qui utilise Relvo, ce que chaque compte
coûte en inférence, couper ou supprimer un compte, sans jamais toucher à la base à la main.
**Dépendances** : M2 (le rôle `admin` existe dans l'énuméré du compte et voyage dans la session),
M7 (le journal des sollicitations, lu aujourd'hui par `ia:journal`), M12 (les abonnements push).

> **Pourquoi maintenant.** L'alpha commence dans deux jours, avec des comptes de test créés et
> détruits au fil des essais. La règle du dépôt tient : **tout changement d'état passe par une
> méthode du domaine, journalisée** (`ecarts`, « L'assistant s'active par un réglage du compte ;
> l'administration viendra avec le backoffice »). Le backoffice est l'écran de ces méthodes, pas
> une console SQL.

| #     | Item                                                                                                                                                                                                                                      |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M21.1 | ✅ **L'accès** : le rôle `admin` du compte, gardé par le proxy et le layout de la zone (`/admin`, hors du groupe `(app)` : pas de dock) ; promotion et rétrogradation **par script** (`admin:role <e-mail> admin|ceo`), journalisées — jamais par la base ; l'entrée « Backoffice » du menu pour les administrateurs, le retour à l'application depuis la zone |
| M21.2 | ✅ **La liste des comptes** : nom, e-mail, date de création, dernière activité, secteurs, assistant actif ou non, canaux connectés et leur état, affaires ouvertes, questions ouvertes, appareils abonnés au push, **coût d'inférence sur 7 et 30 jours** |
| M21.3 | **La fiche d'un compte** : le journal de l'inférence rendu en page — par sollicitation et par tier, jetons, cache relu contre attendu, appels silencieux, **tours en échec** (aujourd'hui absents du journal, à consigner) — plus le journal de bord récent et les rattrapages |
| M21.4 | ✅ **Les gestes** : couper ou rétablir l'assistant (la méthode du domaine, acteur `system`, motif en métadonnée) ; **supprimer un compte** — déconnexion des canaux chez l'agrégateur, cascade en base, fichiers par l'outbox de suppression — derrière une confirmation qui fait retaper l'e-mail ; marquer un compte « test » pour le distinguer des vrais |
| M21.5 | **La vue d'ensemble** : coût d'inférence du mois en cours contre le plafond de la clé, appels et silencieux, comptes actifs sur 7 jours, échecs d'ingestion — les sondes que les routes logguent déjà, enfin lisibles sans `vercel logs` |
| M21.6 | ✅ **La porte de l'alpha** : l'inscription reste libre, mais le compte qui en naît **attend qu'un administrateur ouvre son accès** depuis le backoffice (« À ouvrir ») ; jusque-là il voit une page d'attente, pas une erreur, et la connexion le lui dit en clair ; l'ouverture lui envoie un e-mail. Google aussi ; les comptes existants ne sont pas touchés |

**L'ordre de livraison.** M21.1, M21.2, M21.4 et M21.6 d'abord — c'est ce qui manque le jour J :
voir les comptes, en couper un, en supprimer un, choisir qui entre. **Livrés** (tranche 1,
`backlog/sprints/2026-10-m21-mini-backoffice.md`). M21.3 et M21.5 ensuite, quand les premiers
vrais appels auront rempli le journal.

⚠️ **La suppression d'un compte est la seule opération irréversible du produit.** L'action
déconnecte d'abord les canaux chez l'agrégateur (sinon ils restent facturés et les webhooks
continuent d'arriver pour un compte mort), puis la méthode du domaine journalise la suppression
**sur le compte de l'administrateur** (celui du compte supprimé disparaît avec lui) et laisse la
base cascader et l'outbox nettoyer le stockage. Pas de « soft delete » : un compte de test
supprimé n'existe plus. Deux comptes ne se suppriment pas d'ici : le sien, et la démonstration
(recréée à chaque build).

⚠️ **Le backoffice lit les mêmes fonctions que le produit.** Le coût par compte vient du journal
des sollicitations (`EVENT_TYPES.iaSollicitation`), pas d'un compteur parallèle ; l'interrupteur
de l'assistant est `setAssistantEnabled` ; le décompte des questions est `countOpenQuestions`.
Une seconde implémentation d'une règle divergerait en une semaine (M10.8 dit la même chose pour
les outils de Relvo).

**Ce qui n'est pas ici.** Le disjoncteur par compte (M14.5), les chiffres réels de la page Usage
(M18.8), la supervision installée (M14.3) : le backoffice les **affichera** quand ils existeront.
