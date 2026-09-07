# Sprint « Reprise » — septembre 2026

## Démarrage à froid — à lire en premier

**Le projet a été à l'arrêt six semaines** (dernier commit de développement : fin juillet). Ce
sprint n'écrit pas de code produit : il remet le dépôt en état d'être repris, puis rouvre le
chantier au bon endroit.

### Où en était le produit

**Tout le socle fonctionne, sauf le cœur.** L'authentification, le modèle, le stockage,
l'ingestion e-mail et messagerie, les écrans : livrés. Ce qui manque, c'est **M7** — le pipeline
qui transforme un message entrant en sujet.

Conséquence concrète : **le tri est entièrement manuel**. L'utilisateur fait aujourd'hui le
travail que Relvo est censé lui retirer. Le produit est démontrable, il n'est pas encore ce
qu'il promet.

### Ce qui a été fait dans ce sprint

Une **remise à niveau documentaire**, motivée par un audit. Le constat qui l'a déclenchée :
quatre documents de conception décrivaient encore une conception abandonnée fin juillet, et le
commit qui l'avait abandonnée n'avait mis à jour que six lignes de `CLAUDE.md`.

| # | Ce qui a été fait |
|---|---|
| 1 | Arborescence alignée sur le kit : `conception/` et `backlog/` à la racine, une seule maquette de référence |
| 2 | `conception/00-sources.md` créé — la hiérarchie des sources et **le bord mou tranché** |
| 3 | `apps/worker` supprimé, `README.md` récrit **en place** |
| 4 | CI posée, avec les contrôles des pièges **#5b** et **#37** |
| 5 | `conception/04-design-domaine.md` et `uml.mermaid` créés — le comportement avait **six domiciles, aucun légitime** |
| 6 | `01`, `02`, `03` récrits au présent — **zéro date** dans `conception/` |
| 7 | Backlog éclaté, **Definition of Done** écrite, registre des écarts ouvert |
| 8 | `PITFALLS.md` créé, `CLAUDE.md` réduit de 43 Ko à 10 Ko |

### ⚠️ Ce qu'il faut faire avant de reprendre le code

- [ ] **`pnpm install`** — `node_modules` a été vidé pendant la remise à niveau du lockfile.
- [ ] **Vérifier localement** : `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test`.
      Ils n'ont **pas** pu être exécutés pendant ce sprint.
- [ ] **Pousser la branche et regarder la CI.** ⚠️ **Le contrôle du proxy peut rougir au premier
      run** — c'est le constat, pas un faux positif. Voir ci-dessous.
- [ ] **Protéger la branche principale** — après, il y a toujours une bonne raison de ne pas le
      faire.

### Les trois points de code laissés ouverts

Ils relèvent d'une lecture du code, hors du périmètre de ce sprint.

1. **Piège #5b — emplacement du `proxy.ts`.** Il vit à la racine de l'application alors que le
   projet utilise un dossier `src/`. Contrôle : la ligne `ƒ Proxy (Middleware)` doit apparaître
   en fin de build, et la redirection vers la connexion doit porter le paramètre de retour.
   ⚠️ **L'application n'est pas ouverte pour autant** : toute lecture passe par le client
   conscient du tenant. Le symptôme serait la **perte de la destination après connexion**.
2. **Piège #5c — forme de l'export.** L'export est issu d'une déstructuration, exactement la
   forme que le registre signale. Si le build passe, noter que le piège ne s'applique plus à
   cette version — **et le corriger dans le kit**.
3. **Le test qui manque le plus.** Aucun test ne verrouille le refus par défaut des routes
   protégées. C'est le plus rentable des trois tests d'amorçage.

Un quatrième point, plus simple : **`/messages` et `/messages/[id]` existent encore dans le
code** alors que la conception les a remplacées par `/conversations`.

---

## Ce que fait le sprint suivant

**M6 d'abord — il est à un cheveu de la clôture**, et c'est la seule épique livrée qui traîne un
reste :

- déclarer le webhook de messagerie côté fournisseur ;
- valider de bout en bout en production, sur un appareil réel ;
- confirmer l'anti-boucle de l'écho de nos propres envois **contre un vrai payload**.

**Puis M7, en tranches verticales.** Le découpage proposé est dans
[`../epics/M7-pipeline-ia.md`](../epics/M7-pipeline-ia.md). La première tranche — « un e-mail
entrant devient un sujet titré et classé » — doit répondre à une question **avant tout code** :
combien coûte un message traité, et à quelle latence ? Si la réponse est mauvaise, tout le
découpage change.

⚠️ **Ne pas rouvrir un sprint par couche technique.** M9 a livré sept écrans d'un coup, et trois
ont été réécrits en profondeur dans les six semaines qui ont suivi. Une tranche verticale aurait
fait remonter la question du sous-typage **avant** que sept écrans soient construits dessus.
