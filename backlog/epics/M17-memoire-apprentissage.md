---
id: M17
public: true
ordre_public: 15
titre_client: Relvo apprend de vos gestes
resume_client: >
  Ce que vous ignorez, ce que vous corrigez, ce que vous gardez : Relvo s'en souvient et trie
  mieux la semaine suivante. Il retrouve les affaires passées qui ressemblent à celle du jour,
  et vous pose ses questions là où vous pouvez y répondre en un geste.
statut: a-faire
debut: 2026-11-05
fin: 2026-11-20
---

# M17 — Mémoire et apprentissage

**Objectif** — que Relvo s'améliore avec l'usage, sans réentraînement et sans écran de
paramétrage : chaque geste de l'utilisateur est conservé avec ce que Relvo avait proposé, puis
distillé dans le contexte du prochain appel. **M7 produit ; M17 apprend.**

**Dépendances** : M7, M11. **Renforce** M10 et M13.

> **C'est ici que se joue la confiance dans la durée.** Un Relvo qui ouvre des sujets sur des
> newsletters ne survit pas une semaine ; un Relvo qui repropose une tâche qu'on a supprimée trois
> fois apprend à l'utilisateur à ignorer ses suggestions. Le comportement fait foi dans
> `../../conception/05-ia.md` §9 ; le persisté dans `../../conception/02-modele-donnees.md`.

| #      | Item                                                                                                                                                                                     |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M17.1  | Raison d'ignorance en un appui sur le geste « Ignorer », note libre optionnelle                                                                                                          |
| M17.2  | Verdict de tri visible dans « à trier » : pastille de raison, confirmation ou ouverture d'un sujet d'un geste, accord ou désaccord journalisé                                            |
| M17.3  | Journal brut : toute mutation d'un objet proposé par Relvo conserve la proposition d'origine — tâche, domaine, brouillon                                                                 |
| M17.4  | Registre des étiquettes par compte, amorcé par les socles de secteur ; attribution à la structuration et à la relecture ; promotion candidate → active ; filtre dans Sujets et Recherche |
| M17.5  | Précédents par étiquettes, en plus du domaine — étend M7.18 hors du domaine                                                                                                              |
| M17.6  | Questions de Relvo : entité, encart sur les fiches contact, domaine et sujet, réponse sur place, compteur sur l'Accueil                                                                  |
| M17.7  | « Dire pourquoi à Relvo » sur un reclassement, la suppression d'une tâche **ou la réactivation d'un fil que Relvo avait écarté** : une question d'un appui, optionnelle, jamais bloquante (trois ou quatre réponses, un champ libre) ; instruction du domaine ou préférence de tri, avec le sujet ou le fil d'origine |
| M17.8  | Préférences observées : agrégation déterministe du journal, injectée dans la couche Compte                                                                                               |
| M17.9  | Ignorance automatique d'un expéditeur après plusieurs accords sur le même motif, réversible depuis la fiche                                                                              |
| M17.10 | Domaines proposés : suggestion de création dès que plusieurs sujets partagent la proposition, reclassement en un geste ; domaines typiques des secteurs à la prise en main               |
| M17.11 | Fiche contact enrichie : rôle et note de Relvo, corrigeables, la correction l'emporte                                                                                                    |
| M17.12 | Mesure : jeu d'évaluation alimenté par les verdicts et accords journalisés ; **part d'aide de Relvo** — propositions conservées sur propositions faites — affichée sur l'Accueil         |
| M17.13 | Relance dérivée de la situation structurée quand une attente est dépassée, sans appel au modèle                                                                                          |
| M17.14 | Titres des sujets ouverts récents du compte dans le contexte du tri, pour rattacher une même affaire arrivée par un second contact                                                       |

## Découpage proposé, en tranches verticales

1. **« Le bruit s'apprend »** — M17.1, M17.2, M17.3, M17.9. La première semaine d'un compte se
   joue ici : c'est ce qui empêche Relvo d'être jugé sur ses newsletters. La contradiction
   inverse compte autant que l'accord : réactiver un fil que Relvo avait écarté est déjà
   journalisé avec sa décision d'origine (M7) ; cette tranche le fait peser — cas d'évaluation,
   part d'aide, antécédent de l'expéditeur — et M17.7 y greffe le « pourquoi » optionnel.
2. **« Relvo se souvient »** — M17.4, M17.5, M17.11. Les étiquettes et les précédents hors du
   domaine ; la fiche contact comme mémoire des relations.
3. **« Relvo demande et retient »** — M17.6, M17.7, M17.8, M17.10. Les questions, les
   corrections comme instructions, les préférences observées, les domaines qui émergent.
4. **« Relvo relance et dédouble »** — M17.13, M17.14. Deux gains de la situation structurée
   et du contexte du tri, sans appel supplémentaire.
5. **« On sait si ça marche »** — M17.12. Sans mesure, chaque tranche précédente reste une
   croyance.

⚠️ **Aucun écran de paramétrage de l'IA.** Pas de curseur de confiance, pas d'éditeur
d'étiquettes, pas de liste de règles. Tout ce que Relvo apprend passe par des gestes que
l'utilisateur fait déjà — ignorer, corriger, supprimer, répondre — et par les instructions qu'il
rédige quand il en a envie. Un réglage qui demande un écran est un réglage que le dirigeant ne
fera pas.
