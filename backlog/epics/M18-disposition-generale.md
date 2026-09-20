---
id: M18
public: true
ordre_public: 11
titre_client: Nouvel accueil et navigation simplifiée
resume_client: >
  Une page d'accueil qui dit ce que Relvo a fait depuis votre dernière visite, ce qui vous attend
  aujourd'hui et ce qui attend votre réponse. Relvo au centre de la barre du bas, un menu pour le
  reste, et une page Bilan pour voir ce que Relvo fait pour vous.
statut: a-faire
debut: 2026-09-22
fin: 2026-10-03
---

# M18 — Disposition générale

**Objectif** — mettre l'interface au diapason de la posture produit : **quatre vues, Relvo au
centre, un menu pour le reste**, et un accueil qui est un brief. La décision et ses motifs
vivent dans [`../ecarts-et-propositions.md`](../ecarts-et-propositions.md), « La disposition
générale : quatre vues, Relvo au centre, un menu pour le reste » ; l'état cible dans
[`../../conception/01-principes.md`](../../conception/01-principes.md) §11 et invariants 34–38.

**Dépendances** : M9, M7 (le journal alimente les nouvelles et le Bilan). **Débloque** M10 (la
surface de l'échange se construit sur le bouton central et les questions de Relvo) et M13.2.

> **Pourquoi avant M10 et avant la tranche 10 de M7.** L'échange est la surface la plus
> importante du produit et la prise en main s'y joue ; les construire sur une disposition qu'on
> sait déjà vouloir changer, c'est les réécrire dans six semaines. M9 a livré sept écrans d'un
> coup et trois ont été réécrits en profondeur : on ne recommence pas.

| #      | Item                                                                                                                                                                                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M18.1  | **Barre d'onglets** à cinq places : Accueil · Calendrier · **Relvo** · Sujets · Conversations. Le bouton Relvo au centre, plus gros, sans libellé, **en relief** (seule exception à la charte plate), badge quand une question attend. Contacts et Réglages sortent du dock |
| M18.2  | **Menu latéral** ouvert depuis la gauche du header : Bilan · Mémoire · Contacts · Canaux · Profil · Préférences · Usage · Rechercher (en dernier, comme une action) ; déconnexion en pied                                                                    |
| M18.3  | **Header** : bouton menu à gauche, boutons de page à droite ; le bouton Relvo quitte le header                                                                                                                                                             |
| M18.4  | **Accueil** en quatre zones : Dernières nouvelles (dans le header ; résumé **calculé** depuis le dernier passage, ≤ 2 suggestions **par règles**, question en attente comprise) · Activité (7 jours, 3 chiffres) · Aujourd'hui · En attente de vous. Horodatage du dernier passage sur le compte. Aucune barre d'indicateurs |
| M18.5  | **Calendrier** : la page des tâches (ex-accueil) et la vue mois (ex-`/planning`) sous un segmented Semaine / Mois, avec la barre d'indicateurs des tâches. « À trier » devient un filtre de Sujets et de Conversations                                       |
| M18.6  | **Bilan** : « Ce que Relvo a fait pour vous » (cumulatif, depuis le début du mois et depuis toujours) et « Où en êtes-vous » (flux sur 7 jours, dont messages reçus par jour), **séparés** ; chaque chiffre lu du journal, un tap ouvre la liste derrière ; jamais de « temps gagné » |
| M18.7  | **Mémoire** remplace l'onglet Domaines : instructions du compte en tête, domaines en lignes avec leur rail, zone « Ce que Relvo a appris » réservée à M17                                                                                                    |
| M18.8  | **Usage** : la part du plafond mensuel consommée, en **pourcentage** — jamais d'euros. Le plafond est provisoire jusqu'à M14.5 (seuil par compte) ; le lire depuis une configuration, pas une constante                                                     |
| M18.9  | **`RelvoQuestion` élargie** : portée « compte », naissance depuis une étape de script, réponses proposées, réponse depuis l'échange par formulaire (même fonction métier que la fiche) ; **badge** du bouton Relvo et ligne de l'accueil                      |
| M18.10 | **Retrait des routes mortes** : `/messages`, `/planning`, `/dossiers` (redirections vers Conversations, Calendrier, Mémoire) ; registre de composants à jour                                                                                                |
| M18.11 | **Notification push** quand une question de Relvo s'ouvre (PWA). Peut glisser vers M12 si le socle push n'existe pas encore                                                                                                                                |

## Découpage proposé, en tranches verticales

1. **« La nouvelle navigation, avec les pages d'aujourd'hui »** — M18.1, M18.2, M18.3, M18.10.
   Le dock, le menu et le header changent ; chaque page existante est reroutée. Vérifié sur
   l'iPhone du dirigeant, en mode sombre (`PITFALLS.md` #51).
2. **« Le Calendrier et l'accueil en brief »** — M18.5, puis M18.4 sans les suggestions, puis
   les suggestions par règles.
3. **« Le Bilan et l'Usage »** — M18.6, M18.8.
4. **« La Mémoire »** — M18.7.
5. **« Relvo parle en premier »** — M18.9, M18.11. C'est la tranche que M10 attend.

⚠️ **Aucune suggestion n'est générée par le modèle sur l'accueil.** Le brief est un calcul ; le
modèle ne travaille qu'une fois l'échange ouvert. Une suggestion générée à chaque ouverture de
l'accueil serait le poste de coût le plus élastique du produit, multiplié par trente ouvertures
par jour.

⚠️ **Le relief ne s'étend pas.** Le bouton Relvo est le seul objet en relief. Si une tuile ou un
panneau en hérite « pour l'harmonie », on perd « ce qui brille, c'est Relvo ».
