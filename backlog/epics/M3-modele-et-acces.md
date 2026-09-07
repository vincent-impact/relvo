# M3 — Modèle de données et couche d'accès

**Objectif** — implémenter le modèle décrit dans `../../conception/02-modele-donnees.md` et
exposer les opérations métier. **Dépendances** : M2 — tous les accès sont conscients du tenant.

| # | Item | État |
|---|---|---|
| M3.1 | Schéma Prisma des entités | ✅ |
| M3.2 | Jeu de démonstration idempotent | ✅ |
| M3.3 | Conventions d'accès : validation colocalisée, erreurs de domaine typées, résultat d'action normalisé, pagination par curseur, mutation par identifiant sûre du point de vue du tenant | ✅ |
| M3.4 → M3.11 | Domaines : domaines, contacts, canaux, sujets, messages, tâches, pièces jointes, actions | ✅ |
| M3.12 | Journal écrit **dans la transaction** de chaque mutation, par un helper explicite | ✅ |
| M3.13 | Requêtes d'agrégation : indicateurs, fil, conversations à trier | ✅ |
| M3.14 | Tests d'invariants sur une base dédiée | ✅ |

> **Le choix d'un helper explicite plutôt qu'une extension générique** est ce qui rend le journal
> **lisible** plutôt qu'exhaustif. Un journal exhaustif que personne ne lit ne vaut rien.
