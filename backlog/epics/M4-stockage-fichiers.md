# M4 — Stockage fichiers

**Objectif** — stocker et diffuser les fichiers de façon sûre. **Dépendances** : M2.
**Débloque** M11.

| # | Item | État |
|---|---|---|
| M4.1 | Bucket en juridiction UE, jeton de compte scopé au bucket | ✅ |
| M4.2 | Paquet isolant le fournisseur — le domaine ne connaît qu'une clé d'objet opaque | ✅ |
| M4.3 | Dépôt **navigateur → stockage** par URL pré-signée | ✅ |
| M4.4 | Lecture avec contrôle d'accès : **URL stable, redirection vers une URL signée courte** | ✅ |
| M4.5 | Cascade et intégrité | ✅ |
| M4.6 | **Suppression par outbox alimentée par trigger**, drainée hors transaction | ✅ |
| M4.7 | Dépôts abandonnés : préfixe dédié + cycle de vie côté fournisseur | ⏸️ attend M11 (il lui faut l'UI de dépôt pour avoir un sens) |
| M4.8 | Balayage de rattrapage | ⏸️ à n'ajouter **que sur preuve de dérive** |
| M4.9 | Bucket unique développement / production | ⚠️ **risque connu et assumé**, reporté explicitement |

⚠️ **Deux réglages du SDK sont verrouillés par un test**, parce qu'ils dépendent de défauts qui
ont déjà changé une fois et qui cassent **en silence** : l'envoi continue de marcher, seule la
garantie disparaît. Voir `../../PITFALLS.md` #8.

## Avant la mise en service de M11

- [ ] Poser les variables de stockage et le secret de tâche périodique sur la plateforme. Sans
      elles, le drainage de l'outbox échoue chaque nuit — sans impact visible aujourd'hui, puisque
      aucune interface ne les appelle.
