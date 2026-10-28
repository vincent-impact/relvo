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
éclaté, superséde ou abandonné. Le numéro dit **quand l'épique a été enregistrée**, pas quand le
travail a eu lieu — M16 en est l'exemple.

## Le frontmatter des épiques

Chaque fichier de `epics/` porte un frontmatter qui alimente la **page de suivi du client**.
Il fait foi sur ce que le client voit ; sa spécification vit dans
[`suivi-client.md`](suivi-client.md). ⚠️ **Le corps d'une épique n'est jamais publié** — seul le
frontmatter l'est.

## L'ordre

| Épique                                                                     | État                                             | Ce qu'elle débloque             |
| -------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------- |
| [M1 — Fondations](epics/M1-fondations.md)                                  | ✅                                               | tout                            |
| [M2 — Authentification et multi-tenant](epics/M2-auth-multi-tenant.md)     | ✅                                               | M3                              |
| [M3 — Modèle de données et accès](epics/M3-modele-et-acces.md)             | ✅                                               | M4, M5, M6, M9                  |
| [M4 — Stockage fichiers](epics/M4-stockage-fichiers.md)                    | ✅                                               | M11                             |
| [M5 — Ingestion e-mail](epics/M5-ingestion-email.md)                       | ✅                                               | M6                              |
| [M6 — Ingestion messagerie](epics/M6-ingestion-messagerie.md)              | ✅                                               | M7                              |
| [M6bis — Entité Conversation](epics/M6bis-conversation.md)                 | ✅                                               | M6ter                           |
| [M6ter — Divergence par canal](epics/M6ter-divergence-par-canal.md)        | ✅                                               | M6quater                        |
| [M6quater — Sous-typage de la conversation](epics/M6quater-sous-typage.md) | ✅                                               | M7                              |
| [M9 — Pages applicatives](epics/M9-pages-applicatives.md)                  | ✅                                               | démo client                     |
| [M16 — Consolidation](epics/M16-consolidation.md)                          | ✅                                               | —                               |
| **[M21 — Mini backoffice](epics/M21-mini-backoffice.md)**                  | ✅ — accès, liste, gestes, porte de l'alpha, fiche, vue d'ensemble | l'alpha                         |
| **[M22 — Parler à Relvo](epics/M22-voix.md)**                              | ✅ socle livré — reste M22.8 (maintenir le bouton du dock pour parler) | M20.1                           |
| **[M7 — Pipeline IA d'arrivée](epics/M7-pipeline-ia.md)**                  | ✅ — vérifié en production par le dirigeant ; reste hors épique la lecture de l'historique de la messagerie à la connexion | M8, M10                         |
| **[M18 — Disposition générale](epics/M18-disposition-generale.md)**       | ✅ — M18.9 livré par M10 ; M18.11 glissé vers M12.9 (pas de socle push) | M19, M10, M13 |
| **[M19 — Direction artistique, allègement et prise en main](epics/M19-direction-artistique.md)** | ✅                                               | M10, M13.2                      |
| **[M23 — Les dossiers](epics/M23-dossiers.md)**                            | ✅ — l'arbre, la Mémoire en arborescence, Relvo range en chemins | M11, M17.4                      |
| **[M27 — Dossiers et sujets](epics/M27-dossiers-et-sujets.md)**            | ✅ — le mot, l'arbre, la fiche en quatre onglets, « Ranger dans… », le dépôt d'une connaissance | M24                             |
| **[M24 — Dix boîtes par compte](epics/M24-dix-boites.md)**                 | 🔶 **en cours** — ouvert le 2026-10-28, `sprints/2026-10-m24-dix-boites.md` ; M24.10 en premier | la marge                        |
| **[M25 — La maîtrise des médias](epics/M25-maitrise-des-medias.md)**       | ⬜ tranché solution par solution — après M24      | M8.6, M20.3                     |
| **[M26 — Des chiffres vrais](epics/M26-chiffres-vrais.md)**                | ⬜ recette de l'alpha                            | —                               |
| [M11 — Connaissances](epics/M11-connaissances.md)                          | ⬜                                               | M7, M10                         |
| **[M10 — Échange avec Relvo](epics/M10-echange-relvo.md)**                 | ✅ — le déclencheur du script à la connexion d'un canal est M7.19 | M13                             |
| [M8 — Pièces jointes IA](epics/M8-pieces-jointes-ia.md)                    | ⬜                                               | —                               |
| [M17 — Mémoire et apprentissage](epics/M17-memoire-apprentissage.md)       | ⬜                                               | la qualité du tri dans la durée |
| [M20 — Les usages de la messagerie](epics/M20-usages-messagerie.md)        | ⬜ après M7 et M10                               | —                               |
| [M12 — Mécanismes transverses](epics/M12-transverses.md)                   | 🟡 partiellement livré au fil de l'eau           | —                               |
| [M13 — Onboarding et bêta](epics/M13-onboarding-beta.md)                   | ⬜                                               | mise en service                 |
| [M14 — Qualité et exploitation](epics/M14-qualite-exploitation.md)         | ⬜                                               | —                               |
| [M15 — Suivi de projet](epics/M15-suivi-client.md)                         | ⬜                                               | la relation client              |

## Le chemin critique

```
M1 → M2 → M3 ─┬─→ M4 ──────────────→ M11 ─┐
              ├─→ M5 → M6 → M6bis        ├─→ M7 ─┬─→ M10 → M13 → M14
              │        → M6ter → M6quater ┘       ├─→ M8
              └─→ M9                              └─→ M17
```

**M7 est le verrou.** Tout ce qui reste d'ambitieux dans le produit en dépend, et c'est aussi ce
qui fera tomber les échafaudages documentés dans `04 §13`.

**M18 s'intercale entre M7 et M10** : l'échange se construit sur la nouvelle disposition — le
bouton central du dock, les questions de Relvo, l'accueil en brief — et la prise en main de M13
se joue dans cette surface. La tranche 10 de M7 passe après M19.

**M21 et M22 passent devant la tranche 10 de M7** (décision du 2026-10-19, `ecarts`, « L'alpha
dans deux jours ») : l'alpha ouvre avec des comptes de test, et personne ne peut les voir, les
couper ni les supprimer sans toucher à la base — ce que le dépôt interdit. La voix suit, parce que
le public dicte plus qu'il n'écrit et que l'échange est désormais la surface où Relvo agit. Le
rattrapage dès la connexion (M7.19) et la prise en main (M13) viennent après.

**La recette de l'alpha réordonne la suite** (décision du 2026-10-27, `ecarts`, « La deuxième
vague de la recette ») : avant M11, **M23 puis M24**, dans cet ordre, tranché par le
dirigeant — les dossiers d'abord, parce que c'est ce que les testeurs n'ont pas adopté ; le
relais Gmail ensuite, parce que dix boîtes par compte est leur exigence première et que
l'agrégateur en fait un poste à perte. **Tout le reste est moins urgent** : M25 attend ses
décisions solution par solution, M26 vient quand il vient. Les correctifs de la vague (R9,
M22.8, M12.10, M13.6) se glissent dans le sprint de recette.

**M19 suit M18, pour la même raison** : on habille et on allège **avant** de construire la
surface de l'échange, pas après. La disposition ne rouvre pas ; c'est l'apparence, la densité et
le mouvement qui changent. La tranche 10 de M7 et M10 passent après M19 ; M10 porte la tranche
5 de M18 (`RelvoQuestion` élargie, badge, notification), qui est du domaine et dont il est le
consommateur.

## Ce qui reste manuel jusqu'à M7

Le **tri**. Aucun sujet ne s'ouvre tout seul : l'utilisateur désigne ce qui mérite d'en devenir
un. Tout le produit fonctionne, mais l'utilisateur fait le travail que Relvo est censé lui
retirer.

## Où on en est

> Voir le dernier fichier de [`sprints/`](sprints/). **Lire son démarrage à froid en premier.**
