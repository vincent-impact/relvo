---
id: M6ter
public: false
statut: termine
debut: 2026-07-20
fin: 2026-07-22
---

# M6ter — Divergence par canal

**Objectif** — cesser de forcer une **interface unique** sur deux canaux qui n'ont ni la même
forme de message ni le même système d'objet. La divergence porte sur le **rendu** et les
**gestes** ; **le domaine reste commun**.

**Dépendances** : M6bis. **Migration** : une colonne nullable pour la borne de fin, sans reprise.

Le modèle et les règles qui en résultent font foi dans `../../conception/04-design-domaine.md`.
**Ils ne sont pas recopiés ici.**

| # | Item | État |
|---|---|---|
| M6ter.0 | Schéma : borne de fin d'écoute, **désignant un message** | ✅ |
| M6ter.1 | Domaine : **une seule primitive d'ouverture, à ancre optionnelle** — elle teste l'ancre, jamais le canal | ✅ |
| M6ter.2 | Domaine : balayage du **fil entier** à l'ouverture d'un sujet e-mail, amont compris | ✅ |
| M6ter.3 | Rendu e-mail pleine largeur, fond blanc dans les deux sens | ✅ |
| M6ter.4 | Geste d'écartement habillé par canal, **même mécanisme dessous** | ✅ |
| M6ter.4bis | Confirmation qui **nomme** les sujets concernés | ✅ |
| M6ter.5 | Geste d'ouverture porté par la **conversation**, côté e-mail | ✅ |
| M6ter.5bis | **« Rattacher à un sujet existant » à parité** avec « Ouvrir un sujet » | ✅ |
| M6ter.6 | Geste d'ouverture porté par le **message**, côté messagerie — **un seul geste qui crée ET qui étend** | ✅ |
| M6ter.6bis | Le tap est réservé aux pièces jointes, sur les deux canaux | ✅ |
| M6ter.6ter | Arrêt des écoutes — donc, structurellement, la messagerie | ✅ |
| M6ter.6quater | **Réouverture d'un sujet e-mail à la réception** | ✅ |
| M6ter.7 | « Fermer » est une suppression douce | ✅ |
| M6ter.8 | Bandeau d'appartenance sur les deux canaux, avec les écoutes passées | ✅ |
| M6ter.8bis | Sélecteur unique de conversation dans la fiche | **abandonné** — superséde par M6quater puis par la liste |
| M6ter.8ter | Le modèle porte des **références**, jamais des copies | ✅ |
| M6ter.9 | Tests | ✅ |

> **M6ter.6quater mérite d'être relu**, parce que la règle a été retirée puis rétablie le même
> jour, sur une lecture trop rapide d'une phrase écrite dans une section « arrêt des écoutes » —
> laquelle ne concerne que la messagerie. C'est le meilleur exemple, sur ce projet, de ce que
> coûte une règle recopiée à deux endroits.
