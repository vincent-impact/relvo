---
id: M1
public: true
ordre_public: 1
titre_client: Fondations techniques
resume_client: >
  Mettre en place le socle sur lequel tout le reste repose : l'hébergement, la base de données,
  les outils de qualité et le déploiement automatique. Rien de visible à l'écran, mais tout en dépend.
statut: termine
debut: 2026-06-07
fin: 2026-06-10
---

# M1 — Fondations techniques

**Objectif** — poser le socle qui conditionne tout le reste. **Dépendances** : aucune.

| # | Item | État |
|---|---|---|
| M1.1 | Monorepo pnpm workspaces | ✅ |
| M1.2 | Schéma Prisma + Postgres local par conteneur + énumérés partagés | ✅ |
| M1.3 | Application Next.js : App Router, Tailwind, registre de composants, thème | ✅ |
| M1.4 | ~~Déployable worker~~ | **abandonné** — cf. `../ecarts-et-propositions.md` |
| M1.5 | Journalisation structurée et rapport d'erreurs | ⏸️ reporté |
| M1.6 | Formatage, lint, hook de pré-commit | ✅ |
| M1.7 | **Pipeline CI** | ✅ — livré hors jalon, avec les contrôles des pièges #5b et #37 |
| M1.8 | Déploiement, base de production, migrations au build | ✅ |
| M1.9 | Route de santé | ✅ (le volet UI de débogage reste reporté) |

> **M1.7 a été reporté depuis le premier jour du projet et livré très tard.** Coût : cent quatre-vingts
> commits en direct sur la branche principale, sans typage ni lint automatique, et deux pièges du
> registre dont le contrôle tient en une ligne de commande que personne ne lançait.
