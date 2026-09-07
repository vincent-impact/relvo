# Product backlog — Relvo V1

> **Ce fichier porte l'ORDRE, jamais la définition.** La définition de chaque item vit **une
> seule fois**, dans [`epics/`](epics/). Redécrire une tâche ici produirait deux vérités qui
> divergent en une semaine.
>
> Le **périmètre V1** fait foi dans
> [`../conception/04-design-domaine.md`](../conception/04-design-domaine.md) §12 — il n'est pas
> recopié ici.

## Convention d'identifiants

`M<n>[bis|ter|quater].<ordre>`. **Un identifiant n'est jamais réattribué**, même quand l'item est
éclaté, superséde ou abandonné.

## L'ordre

| Épique | État | Ce qu'elle débloque |
|---|---|---|
| [M1 — Fondations](epics/M1-fondations.md) | ✅ | tout |
| [M2 — Authentification et multi-tenant](epics/M2-auth-multi-tenant.md) | ✅ | M3 |
| [M3 — Modèle de données et accès](epics/M3-modele-et-acces.md) | ✅ | M4, M5, M6, M9 |
| [M4 — Stockage fichiers](epics/M4-stockage-fichiers.md) | ✅ | M11 |
| [M5 — Ingestion e-mail](epics/M5-ingestion-email.md) | ✅ | M6 |
| [M6 — Ingestion messagerie](epics/M6-ingestion-messagerie.md) | 🟡 code livré, **validation production à faire** | M7 |
| [M6bis — Entité Conversation](epics/M6bis-conversation.md) | ✅ | M6ter |
| [M6ter — Divergence par canal](epics/M6ter-divergence-par-canal.md) | ✅ | M6quater |
| [M6quater — Sous-typage de la conversation](epics/M6quater-sous-typage.md) | ✅ | M7 |
| [M9 — Pages applicatives](epics/M9-pages-applicatives.md) | ✅ | démo client |
| **[M7 — Pipeline IA d'arrivée](epics/M7-pipeline-ia.md)** | ⬜ **prochaine épique** | M8, M10 |
| [M11 — Connaissances](epics/M11-connaissances.md) | ⬜ | M7, M10 |
| [M10 — Échange avec Relvo](epics/M10-echange-relvo.md) | ⬜ | — |
| [M8 — Pièces jointes IA](epics/M8-pieces-jointes-ia.md) | ⬜ | — |
| [M12 — Mécanismes transverses](epics/M12-transverses.md) | 🟡 partiellement livré au fil de l'eau | — |
| [M13 — Onboarding et bêta](epics/M13-onboarding-beta.md) | ⬜ | mise en service |
| [M14 — Qualité et exploitation](epics/M14-qualite-exploitation.md) | ⬜ | — |

## Le chemin critique

```
M1 → M2 → M3 ─┬─→ M4 ──────────────→ M11 ─┐
              ├─→ M5 → M6 → M6bis        ├─→ M7 ─┬─→ M10
              │        → M6ter → M6quater ┘       ├─→ M8
              └─→ M9                              └─→ M13 → M14
```

**M7 est le verrou.** Tout ce qui reste d'ambitieux dans le produit en dépend, et c'est aussi ce
qui fera tomber les échafaudages documentés dans `04 §13`.

## Ce qui reste manuel jusqu'à M7

Le **tri**. Aucun sujet ne s'ouvre tout seul : l'utilisateur désigne ce qui mérite d'en devenir
un. Tout le produit fonctionne, mais l'utilisateur fait le travail que Relvo est censé lui
retirer.

## Où on en est

> Voir le dernier fichier de [`sprints/`](sprints/). **Lire son démarrage à froid en premier.**
