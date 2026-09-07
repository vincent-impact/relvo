# M9 — Pages applicatives

**Objectif** — implémenter les écrans du produit à partir de la maquette.
**Dépendances** : M2, M3.

**Livrée**, avec une démonstration client validée. Le réalisé a **divergé du plan d'origine**,
et c'est la divergence qui est intéressante à retenir.

## Ce qui a changé en cours de route

| Plan d'origine | Réalisé |
|---|---|
| Navigation par barre latérale de bureau | **Barre d'onglets basse**, mobile d'abord |
| Zone de saisie permanente en bas d'écran | **Bouton dans le header**, à la même place partout |
| Accueil = brief | **Accueil = page des tâches** |
| Écran de messages orphelins | **Écran des conversations** |
| Cartes flottantes | **Lignes** pleine largeur |
| Statut à six valeurs, priorité à quatre | **Trois statuts, deux priorités** |
| Paire de boutons sur chaque carte | **Gestes de glissement** |
| — | **Application installable** |

## La leçon

**M9 a livré sept écrans d'un coup contre un jeu de démonstration.** Puis M6bis, M6ter,
M6quater et le remplacement de la fiche sujet en ont réécrit trois en profondeur.

Une **tranche verticale** — « une conversation e-mail devient un sujet, de bout en bout » —
aurait fait remonter la question du sous-typage **avant** que sept écrans soient construits
dessus.

⚠️ **C'est pourquoi les épiques suivantes se découpent par résultat utilisateur, pas par
couche.**

## Amélioration continue

Le travail restant sur l'interface se mène **au fil de l'usage**, hors jalon. Il ne bloque rien.
