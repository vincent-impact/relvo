---
id: M6quater
public: false
statut: termine
debut: 2026-07-25
fin: 2026-07-29
---

# M6quater — Sous-typage de la conversation

**Objectif** — l'interface unifiée de M6ter produisait des dispositifs complexes qui égaraient
l'utilisateur. On **sépare** en deux sous-types de conversation, et l'on tire les conséquences
sur le rattachement.

**Dépendances** : M6ter. Le modèle fait foi dans `../../conception/02-modele-donnees.md`, le
comportement dans `../../conception/04-design-domaine.md`.

| # | Item | État |
|---|---|---|
| M6quater.0 | Schéma : discriminant de sous-type, **set de destinataires** pour l'e-mail, clé par set trié | ✅ |
| M6quater.1 | Domaine : routage à la réception **par set**, et **rattachement automatique in-set** | ✅ |
| M6quater.2 | Domaine : **détachement d'un fil e-mail** — rattrapage d'erreur, sans borne de fin, distinct de l'arrêt d'écoute | ✅ |
| M6quater.3 | Fiche sujet à deux onglets par canal | ✅ livré, puis **remplacé** — voir ci-dessous |
| M6quater.4 | Rendu de l'onglet e-mail | ✅ — absorbé par le remplacement |
| M6quater.5 | Tests du sous-typage | ✅ |
| M6quater.6 | Régénération du jeu de démonstration au nouveau formalisme | ✅ |

## ⚠️ M6quater.3 et .4 ont été livrés puis remplacés

La fiche du sujet **n'affiche plus les messages**. Un **onglet unique** liste les fils, et
l'écran de conversation devient la **seule surface d'affichage et de réponse**.

**Pourquoi** : les deux onglets par canal se sont révélés flottants à l'usage, et ils
**dupliquaient le rendu d'un fil** — deux endroits pour lire un même échange, donc deux rendus à
maintenir et deux occasions de diverger.

**Les identifiants ne sont pas réattribués** : M6quater.3 et .4 restent leurs numéros, marqués
remplacés. La conception à jour vit dans `../../conception/03-cas-usage.md` (Cas U).

> **Ce que ce remplacement a coûté au projet, et qui a motivé sa remise à plat.** Le commit qui
> l'a livré a modifié six lignes de `CLAUDE.md` et rien d'autre côté documentation, pour près de
> huit cents lignes de code supprimées. Quatre documents ont continué pendant des semaines à
> décrire les deux onglets comme la conception courante.
