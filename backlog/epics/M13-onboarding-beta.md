---
id: M13
public: true
ordre_public: 16
titre_client: Ouverture de la bêta
resume_client: >
  Préparer l'arrivée des autres utilisateurs : parcours de première connexion, guide d'usage
  court, et mise en service élargie au sein de Tasty Crousty.
statut: a-faire
debut: 2026-11-30
fin: 2026-12-08
---

# M13 — Onboarding et bêta

**Objectif** — préparer le produit à accueillir ses premiers utilisateurs.
**Dépendances** : M2, M5, M6, M7 (M7.19), M10, M11.

**Cible** : bêta privée gratuite, quelques comptes provisionnés à la main. Pas de facturation à
ce stade.

| #     | Item                                                                                                                                                                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M13.1 | Provisionnement d'un compte, en ligne de commande ou page protégée                                                                                                                                                                  |
| M13.2 | ✅ **Livré par la tranche 10 de M7** (sprint `2026-10-m7-tranche10-rattrapage.md`). Prise en main par le **premier échange avec Relvo** (`05` §11.11) : scripté, pendant que Relvo lit le courrier récent (M7.19) ; carte vivante d'avancement ; questions sous forme de formulaires, réponses vers les objets du compte ou les instructions ; secteurs, domaines proposés par le courrier (M17.10), première instruction, fin de lecture — jamais un formulaire vide, jamais bloquant. **Précisé en recette** (`ecarts`, « La prise en main commence à la sortie des diapositives ») : l'échange s'ouvre depuis la dernière diapositive, « un autre métier » s'écrit, la boîte se demande en dernier et la lecture se voit d'où qu'on soit |
| M13.3 | Pages d'erreur et de maintenance                                                                                                                                                                                                    |
| M13.4 | Documentation utilisateur courte                                                                                                                                                                                                    |
| M13.5 | Retour d'expérience depuis l'application                                                                                                                                                                                            |

⚠️ **M13.2 conditionne la valeur de tout le reste.** Un dirigeant qui n'a connecté aucun canal
et déposé aucune instruction verra un produit vide et le jugera sur ce vide.

⚠️ **Le provisionnement d'un premier compte passe par une migration ou par le build, jamais
depuis un poste.** Aucun secret de production ne descend sur une machine de développement.
