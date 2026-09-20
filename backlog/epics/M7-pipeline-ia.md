---
id: M7
public: true
ordre_public: 10
titre_client: Tri automatique des messages
resume_client: >
  Le cœur de Relvo. Il lit les messages qui arrivent, comprend de quoi ils parlent, ouvre le sujet
  correspondant, propose les tâches à faire et prépare un brouillon de réponse. C'est la fin du
  tri à la main.
statut: en-cours
debut: 2026-09-15
fin: 2026-10-05
---

# M7 — Pipeline IA d'arrivée

**Objectif** — le cœur du produit : transformer un message entrant en sujet structuré, avec ses
tâches, son brouillon et son journal.

**Dépendances** : M3, M5, M6, M11. **Débloque** M8 et M10.

> **C'est le verrou du projet.** C'est aussi ce qui fera **tomber les échafaudages** documentés
> dans `../../conception/04-design-domaine.md` §13 : l'écoute et la règle « au plus un sujet
> ouvert par conversation » n'existent que parce qu'aucune machine ne sait encore découper un
> flux par le sens.

| #     | Item                                                                                                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M7.1  | Orchestrateur en **exécution de fond serverless** — le choix de l'orchestration se tranche ici                                                                         |
| M7.2  | Prompt système : rôle, ton, **règles de non-création**, format de sortie                                                                                               |
| M7.3  | Assemblage du contexte en cinq couches — secteurs du compte et socles métier pour la couche Produit —, un profil par sollicitation, budget par couche tenu par un test |
| M7.4  | Appel au modèle : comprendre, classer, rattacher ou ouvrir, créer le contact si nécessaire                                                                             |
| M7.5  | Titre et résumé du sujet                                                                                                                                               |
| M7.6  | Tâches déductibles + extraction de date                                                                                                                                |
| M7.7  | Brouillon de réponse à la première ouverture de la zone de rédaction sur une tâche de réponse                                                                          |
| M7.8  | ~~Indice de tri~~ — **sans objet** : le rangement ne peut plus échouer                                                                                                 |
| M7.9  | Transitions de statut, dans les limites de `../../conception/05-ia.md` §5                                                                                              |
| M7.10 | Complétion automatique d'une tâche de réponse à l'envoi                                                                                                                |
| M7.11 | Suggestion de validation quand le sujet semble stabilisé                                                                                                               |
| M7.12 | Stockage des citations retournées par le modèle                                                                                                                        |
| M7.13 | Mise en cache du prompt                                                                                                                                                |
| M7.14 | Journal pour chaque sous-action du pipeline                                                                                                                            |
| M7.15 | Gestion d'erreur : un échec **laisse la conversation orpheline**, il n'invente rien                                                                                    |
| M7.16 | Observabilité : jetons consommés par message                                                                                                                           |
| M7.17 | Banc d'essai hors application et jeu d'évaluation constitué du tri manuel existant — **prérequis** de la première tranche                                              |
| M7.18 | Précédents : fiche de clôture d'un sujet validé, sélection par domaine et proximité de titre, poussée dans la structuration                                            |
| M7.19 | Rattrapage du courrier récent en lot à la connexion d'un canal — **débloque** M13.2 et M17.10                                                                          |
| M7.20 | Raison et provenance de chaque proposition, affichées d'un appui sur la pastille Relvo                                                                                 |

## Découpage proposé, en tranches verticales

Plutôt que d'implémenter les seize items en couche, ouvrir des sprints qui livrent chacun un
**résultat utilisateur observable** :

1. **« Un e-mail entrant devient un sujet titré et classé »** — M7.17 d'abord, puis M7.1 à
   M7.5, sans tâche. C'est la tranche qui valide l'orchestration, le contexte et le coût réel.
2. **« Le sujet arrive avec ses tâches et sa date »** — M7.6, M7.14, M7.18.
3. **« Le sujet arrive avec un brouillon prêt »** — M7.7, M7.10.
4. **« Relvo suggère que c'est terminé »** — M7.11, M7.9.
5. **Durcissement** — M7.12, M7.13, M7.15, M7.16.
6. **« Relvo lit le courrier récent dès la connexion »** — M7.19. C'est la démonstration
   que les clients réclament, sur leur propre courrier, sans rien configurer.

Ce qui nourrit Relvo en retour — étiquettes, raisons, questions, préférences — est une épique à
part : [`M17-memoire-apprentissage.md`](M17-memoire-apprentissage.md). M7 produit ; M17 apprend.

⚠️ **La tranche 1 doit répondre à une question avant tout code** : combien coûte un message
traité, et à quelle latence ? Si la réponse est mauvaise, tout le découpage change.
