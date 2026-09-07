# M7 — Pipeline IA d'arrivée

**Objectif** — le cœur du produit : transformer un message entrant en sujet structuré, avec ses
tâches, son brouillon et son journal.

**Dépendances** : M3, M5, M6, M11. **Débloque** M8 et M10.

> **C'est le verrou du projet.** C'est aussi ce qui fera **tomber les échafaudages** documentés
> dans `../../conception/04-design-domaine.md` §13 : l'écoute et la règle « au plus un sujet
> ouvert par conversation » n'existent que parce qu'aucune machine ne sait encore découper un
> flux par le sens.

| # | Item |
|---|---|
| M7.1 | Orchestrateur en **exécution de fond serverless** — le choix de l'orchestration se tranche ici |
| M7.2 | Prompt système : rôle, ton, **règles de non-création**, format de sortie |
| M7.3 | Construction du contexte : domaine, connaissances du domaine, connaissances transversales, historique du contact |
| M7.4 | Appel au modèle : comprendre, classer, rattacher ou ouvrir, créer le contact si nécessaire |
| M7.5 | Titre et résumé du sujet |
| M7.6 | Tâches déductibles + extraction de date |
| M7.7 | Brouillon de réponse quand une tâche de réponse est créée |
| M7.8 | ~~Indice de tri~~ — **sans objet** : le rangement ne peut plus échouer |
| M7.9 | Transitions de statut, dans les limites de `../../conception/05-ia.md` §5 |
| M7.10 | Complétion automatique d'une tâche de réponse à l'envoi |
| M7.11 | Suggestion de validation quand le sujet semble stabilisé |
| M7.12 | Stockage des citations retournées par le modèle |
| M7.13 | Mise en cache du prompt |
| M7.14 | Journal pour chaque sous-action du pipeline |
| M7.15 | Gestion d'erreur : un échec **laisse la conversation orpheline**, il n'invente rien |
| M7.16 | Observabilité : jetons consommés par message |

## Découpage proposé, en tranches verticales

Plutôt que d'implémenter les seize items en couche, ouvrir des sprints qui livrent chacun un
**résultat utilisateur observable** :

1. **« Un e-mail entrant devient un sujet titré et classé »** — M7.1 à M7.5, sans tâche.
   C'est la tranche qui valide l'orchestration, le contexte et le coût réel.
2. **« Le sujet arrive avec ses tâches et sa date »** — M7.6, M7.14.
3. **« Le sujet arrive avec un brouillon prêt »** — M7.7, M7.10.
4. **« Relvo suggère que c'est terminé »** — M7.11, M7.9.
5. **Durcissement** — M7.12, M7.13, M7.15, M7.16.

⚠️ **La tranche 1 doit répondre à une question avant tout code** : combien coûte un message
traité, et à quelle latence ? Si la réponse est mauvaise, tout le découpage change.
