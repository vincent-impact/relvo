---
id: M8
public: true
ordre_public: 13
titre_client: Lecture des pièces jointes
resume_client: >
  Relvo reconnaît chaque document reçu — facture, devis, bon de livraison — et l'étiquette
  automatiquement, pour que vous le retrouviez sans avoir à l'ouvrir.
statut: a-faire
debut: 2026-10-22
fin: 2026-10-28
---

# M8 — Pièces jointes analysées

**Objectif** — étiqueter et exploiter les pièces jointes. **Dépendances** : M3, M5, M6.

**V1 = le premier niveau seulement.** Les deux autres sont reportés.

| # | Item |
|---|---|
| M8.1 | **Niveau 1** — étiquette automatique à la réception, par un modèle rapide |
| M8.2 | *(reporté)* Niveau 2 — résumé au premier accès |
| M8.3 | *(reporté)* Niveau 3 — analyse approfondie, à la demande explicite |
| M8.4 | Stratégie de cache : l'horodatage **est** le drapeau — jamais deux appels pour un même document au même niveau |
| M8.5 | Badge d'étiquette à côté du nom du fichier |

**Pourquoi l'étiquette a de la valeur alors que le résumé peut attendre.** Un nom de fichier est
souvent illisible — un scan numéroté, un export automatique. L'étiquette rend la pièce jointe
retrouvable pour un coût quasi nul. Le résumé, lui, coûte à chaque document et ne sert que si on
l'ouvre.
