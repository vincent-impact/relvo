---
id: M13
public: true
ordre_public: 14
titre_client: Ouverture de la bêta
resume_client: >
  Préparer l'arrivée des autres utilisateurs : parcours de première connexion, guide d'usage
  court, et mise en service élargie au sein de Tasty Crousty.
statut: a-faire
debut: 2026-10-28
fin: 2026-11-05
---

# M13 — Onboarding et bêta

**Objectif** — préparer le produit à accueillir ses premiers utilisateurs.
**Dépendances** : M2, M5, M6, M11.

**Cible** : bêta privée gratuite, quelques comptes provisionnés à la main. Pas de facturation à
ce stade.

| # | Item |
|---|---|
| M13.1 | Provisionnement d'un compte, en ligne de commande ou page protégée |
| M13.2 | Prise en main en trois écrans : connecter ses canaux, créer un domaine, déposer sa première instruction |
| M13.3 | Pages d'erreur et de maintenance |
| M13.4 | Documentation utilisateur courte |
| M13.5 | Retour d'expérience depuis l'application |

⚠️ **M13.2 conditionne la valeur de tout le reste.** Un dirigeant qui n'a connecté aucun canal
et déposé aucune instruction verra un produit vide et le jugera sur ce vide.

⚠️ **Le provisionnement d'un premier compte passe par une migration ou par le build, jamais
depuis un poste.** Aucun secret de production ne descend sur une machine de développement.
