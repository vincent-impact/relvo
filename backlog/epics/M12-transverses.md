---
id: M12
public: false
statut: partiel
debut: 2026-06-10
---

# M12 — Mécanismes transverses

**Objectif** — ce qui s'applique à plusieurs épiques à la fois. **Dépendances** : M3, M7, M9.

| #     | Item                                                                                          | État                          |
| ----- | --------------------------------------------------------------------------------------------- | ----------------------------- |
| M12.1 | Génération de la référence lisible d'un sujet                                                 | ✅                            |
| M12.2 | Notifications d'interface pour les actions et confirmations                                   | 🟡 partiel                    |
| M12.3 | Rafraîchissement périodique                                                                   | ✅ livré en avance avec M5.13 |
| M12.4 | Recalcul des indicateurs, en cache, invalidé à la mutation                                    | ✅                            |
| M12.5 | Invalidation d'une suggestion de validation quand une activité postérieure la contredit       | ✅ livré avec M7 (relecture, « pas encore », tâche rouverte) |
| M12.6 | Accès à la pile des tâches sans date depuis les surfaces calendaires                          | ⬜                            |
| M12.7 | Brief du matin en notification : les compteurs du jour à l'heure d'ouverture, sans génération | ✅ cron `/api/cron/matin`, `0 6 * * *` UTC, un calcul, silence quand tout est nul |
| M12.8 | La vue Mois du Calendrier en **grille à pastilles** : chaque case un chiffre et jusqu'à trois pastilles de domaine, le tap sélectionne le jour et sa liste se pose sous la grille, le glissé part de la liste vers une case (invariant 15 tenu) | ⬜                            |
| M12.9 | **Notification push** quand une question de Relvo s'ouvre (PWA) — glissée depuis M18 (ex-M18.11, l'identifiant d'origine reste cité) | ✅ socle Web Push (abonnement par appareil, Préférences) ; `notifierQuestion` appelée par les producteurs hors écran — le tri (M17) et le rattrapage (M7.19) quand ils naîtront |

> **M12 se livre au fil de l'eau**, en accompagnement des autres épiques. C'est la seule qui n'a
> pas vocation à faire l'objet d'un sprint dédié.
