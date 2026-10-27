---
id: M26
public: true
ordre_public: 23
titre_client: Le Bilan et l'Usage disent vrai
resume_client: >
  Les chiffres du Bilan et de l'Usage sont les vôtres : ce que Relvo a lu, ouvert, préparé pour
  vous, et la part de votre forfait consommée ce mois-ci.
statut: a-faire
---

# M26 — Des chiffres vrais

**Objectif** — relier le **Bilan** et l'**Usage** aux données du compte. Les deux pages
existent depuis M18 pour poser la disposition et le vocabulaire, et le disent en tête ; leurs
chiffres sont de démonstration (`lib/demo-bilan.ts`, seul domicile de ces chiffres, qui
**disparaît** avec cette épique). **Dépendances** : M18.6 et M18.8 (les pages), M7 (le journal
qui alimente le Bilan), M21 (le compteur d'inférence que le backoffice lit déjà), M14.5 (le
plafond par compte — l'Usage en lit la valeur, M14.5 pose la coupure).

| #     | Item                                                                                                                                                                                                                                      |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M26.1 | **« Ce que Relvo a fait pour vous »** lu du journal : messages lus, affaires ouvertes, tâches créées, brouillons préparés, contacts reconnus, sources en sourdine — depuis le début du mois et depuis toujours ; un tap ouvre la liste derrière (invariant 37) |
| M26.2 | **« Où en êtes-vous »** : le flux sur sept jours — messages reçus par jour, affaires validées, tâches cochées — par les fonctions du brief (`domain/brief.ts`), jamais mêlé au cumulatif                                                       |
| M26.3 | **L'Usage** : la part du plafond mensuel consommée par l'inférence, lue du même compteur que le backoffice, sur un plafond lu d'une configuration ; **plus la part du stockage** (M25.6) ; en pourcentage, jamais en euros (invariant 38)        |
| M26.4 | **Les fonctions sont partagées** : le backoffice et le produit lisent les mêmes fonctions du domaine, aucun compteur à lui (`CLAUDE.md`, Architecture) ; `DemoNotice` et `demo-bilan.ts` supprimés ; `CLAUDE.md` et la table des routes récrits |

⚠️ **Un chiffre vrai est un chiffre testé** : chaque compteur a un test d'intégration qui
fabrique le journal et relit la tuile. Un chiffre de Bilan faux est pire qu'un chiffre de
démonstration annoncé comme tel.
