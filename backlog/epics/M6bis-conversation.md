---
id: M6bis
public: true
ordre_public: 8
titre_client: Regroupement en conversations
resume_client: >
  Ranger chaque message dans le bon fil dès sa réception, sans jamais se tromper — par objet pour
  un e-mail, par interlocuteur pour WhatsApp. C'est ce rangement qui permet ensuite d'ouvrir un
  sujet d'un seul geste.
statut: termine
debut: 2026-07-20
fin: 2026-07-29
---

# M6bis — L'entité Conversation

**Objectif** — introduire la `Conversation` entre le message et le sujet, et déplacer le tri du
moment « création de sujet » au moment « **réception** », où il devient déterministe et sans IA.

**Dépendances** : M3, M5, M6. **Bloquait M7.**

**Pourquoi** — le mur rencontré en usage réel : une messagerie n'a pas d'objet, un fil direct
**entrelace** les affaires, et aucune règle de plage temporelle ne sait les séparer. Il fallait
que la **granularité sémantique soit plus fine que la granularité de transport**. Le modèle qui
en résulte fait foi dans `../../conception/04-design-domaine.md`.

| # | Item | État |
|---|---|---|
| M6bis.1 | Schéma : entité `Conversation`, table de liaison, `Message.conversation_id` non nul | ✅ |
| M6bis.2 | Schéma : statut du sujet à trois valeurs | ✅ |
| M6bis.3 | Domaine : résolution de la conversation par clé canonique, branchée sur les deux canaux | ✅ |
| M6bis.4 | Domaine : règle de rattachement à la réception | ✅ |
| M6bis.5 | Domaine : ouvrir un sujet, le valider, le fermer, ignorer et réactiver une conversation | ✅ |
| M6bis.6 | Domaine : glissement de borne | ✅ — **retiré de l'interface** par M6ter |
| M6bis.7 | Capter le nom et le type d'un fil de groupe, **une seule fois** à la création | ✅ |
| M6bis.8 | Écran des conversations : tri, filtres, geste d'écartement | ✅ |
| M6bis.9 | Détail d'une conversation | ✅ — le dispositif visuel initial a été **remplacé** par le bandeau d'appartenance |
| M6bis.10 | Menu contextuel sur un message | ✅ — **retiré** par M6ter |
| M6bis.11 | Gestes de la liste des sujets, proposition d'ignorance enchaînée à la fermeture | ✅ |
| M6bis.12 | Étendre un sujet à une seconde conversation | ✅ |
| M6bis.13 | Tests : clés, idempotence, rattachement, bornes, orphelines | ✅ |

## La migration de données

**C'est la première migration du projet qui CRÉE de la donnée** plutôt que de déplacer des
colonnes : il fallait *inventer* une conversation pour chaque message existant.

Elle a été **rejouée sur une base jetable** avec un jeu d'essai couvrant les préfixes de réponse,
les sortants, les groupes, les objets nuls et les anciens statuts. Résultat vérifié : aucun
message sans conversation.

> ⚠️ **Le seul contrôle qui ne ment pas est de rejouer toute la chaîne sur une base vierge et de
> recompter** — jamais une relecture du fichier de migration.

## Ce que cette épique a rendu caduc

Les pages de messages orphelins, l'assignation d'un message à un sujet, le balayage des messages
frères, l'indice de tri, l'ignorance portée par le sujet, les statuts d'archivage, et la purge
après quinze jours.

⚠️ **La purge ne doit jamais être réintroduite** sur le statut « fermé » : cf.
`../../conception/04-design-domaine.md` §9.
