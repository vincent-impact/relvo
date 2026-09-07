---
id: M15
public: false
ordre_public: 0
titre_client: Suivi de projet
resume_client: La page qui vous dit où en est votre projet.
statut: termine
debut: 2026-09-08
fin: 2026-09-08
---

# M15 — Le suivi de projet

**Objectif** — donner au client une page qui répond à « où en est mon projet ? » et
« qu'est-ce qui a changé dans mon application ? », alimentée par le dépôt, **sans base de
données et sans effort de rédaction récurrent**.

**Dépendances** : aucune. **Spécification** : [`../suivi-client.md`](../suivi-client.md).
**Maquette** : [`../../conception/mockup/suivi/index.html`](../../conception/mockup/suivi/index.html).

⚠️ **Cette épique porte `public: false`** — le client n'a pas à voir sur sa page de suivi le
chantier qui fabrique sa page de suivi.

---

## Les items

| # | Item |
|---|---|
| M15.1 | **Frontmatter** sur les épiques : `id`, `public`, `ordre_public`, `titre_client`, `resume_client`, `statut`, `debut`, `fin`. ✅ *posé* |
| M15.2 ✅ | **Script de génération** — lit le frontmatter des épiques + `CHANGELOG.md`, écrit un JSON typé dans l'application. Branché en `prebuild` **et** `predev`. |
| M15.3 ✅ | **Validation bloquante** dans ce script — les cinq règles de cohérence de la spécification. Le build échoue si l'une casse. |
| M15.4 ✅ | **Route `/suivi/[token]`**, entièrement statique via `generateStaticParams` à partir d'une variable d'environnement. Deux onglets, `<details>` par chantier. |
| M15.5 ✅ | **`robots.ts`** avec `noindex` sur `/suivi`, et ajout de la route aux routes publiques de l'authentification. |
| M15.6 ✅ | **Test du refus par défaut** — une route protégée sans session est refusée, une route publique passe. ⚠️ **Dans le même commit que M15.5.** |
| M15.7 ✅ | **Génération du `CHANGELOG.md`** depuis les commits `feat`/`fix`. Le pied `Client:` est **obligatoire** — sans lui, pas d'entrée. La période antérieure à la convention est reprise une fois à la main dans `journal-client.md`, fichier **figé par une borne bloquante**. |
| M15.8 | **Definition of Done** — la ligne `Client:` et la mise à jour du frontmatter à chaque changement d'état. ✅ *posé* |

---

## Critères d'acceptation

- [x] `pnpm build` régénère le JSON, et la page reflète l'état réel du backlog.
- [x] **Le build échoue** si deux épiques sont `en-cours`, si une épique publique n'a pas de
      `resume_client`, ou si `fin < debut`.
- [x] `/suivi/<bon-token>` répond 200 **sans session**. `/suivi/nimportequoi` répond 404.
- [x] Le corps d'un fichier d'épique **n'apparaît nulle part** dans le JSON généré.
      *(Le vérifier en écrivant une phrase absurde dans un corps et en relisant le JSON.)*
- [x] Un commit `chore:` **n'apparaît pas** dans le journal ; un commit `feat:` avec
      `Client: -` non plus ; un commit `feat:` **sans aucun pied `Client:`** non plus.
      *(Vérifié sur les 148 commits réels : 143 sans pied → 0 publié.)*
- [x] Le journal ne contient **aucune phrase écrite pour l'équipe**. La reprise manuelle couvre
      l'avant-convention, et une date qui atteint la reprise **fait échouer** la génération.
- [x] Le test du refus par défaut passe, et **il échoue** si l'on retire temporairement une route
      de la liste publique. *(C'est la seule façon de savoir qu'il teste quelque chose.)*
- [x] Aucun `fs` au **runtime** — cf. le piège ci-dessous.
- [ ] La page est lisible à 390 px de large. ⚠️ **Non coché volontairement** : la mise en page
      est fluide (aucune largeur fixe, `max-width` de 720 px et de 44/56 ch) et reprend une
      maquette pensée pour le mobile, mais **personne ne l'a encore REGARDÉE** à cette largeur.
      Un critère de lisibilité se constate à l'œil ; le cocher sur un raisonnement serait
      exactement le genre d'affirmation non vérifiée que cette épique cherche à rendre impossible.

---

## ⚠️ Le piège à ne pas repayer

Lire les fichiers du backlog avec `fs` **au runtime** referait une erreur que ce dépôt a déjà
payée, et **elle ne se voit qu'en production**.

Le commentaire de `next.config.ts` la documente déjà, à propos des fixtures de démonstration :

> *Le traceur analyse les `import`/`require`/`fs` **statiquement** : il ne peut pas voir ce chemin
> construit à l'exécution, donc il n'embarque pas les fichiers. En local ça marche (le monorepo
> est sur le disque) ; en production, `readFile` lève `ENOENT`.*

D'où **M15.2 : la lecture se fait au build**, dans un script Node autonome, et l'application ne
consomme qu'un JSON importé statiquement. C'est aussi ce qui rend la page entièrement statique.

## Le compromis assumé

Le `CHANGELOG.md` est **généré et commité** — c'est un fichier dérivé versionné, ce qui est
normalement à éviter. On l'accepte pour une raison : la plateforme de déploiement clone en
profondeur limitée, donc l'historique git n'est pas fiable au moment du build. Le fichier
commité est la seule source stable.
