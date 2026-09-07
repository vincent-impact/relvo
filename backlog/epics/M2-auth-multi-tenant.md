# M2 — Authentification et multi-tenant

**Objectif** — sécuriser l'accès et garantir l'isolation par compte. **Dépendances** : M1.

| # | Item | État |
|---|---|---|
| M2.1 | Fournisseur identifiant / mot de passe | ✅ |
| M2.2 | Fournisseur Google, **câblé conditionnellement** (sans les deux clés, il n'apparaît pas) | ✅ |
| M2.3 | Sessions par jeton en cookie + proxy de protection des routes, config dédoublée edge-safe / Node | ✅ |
| M2.4 | Helpers serveur : le compte est **toujours dérivé de la session** | ✅ |
| M2.5 | Pages du tunnel d'authentification, en français | ✅ |
| M2.6 | Création de compte réutilisable, en transaction (compte + domaine « Général » + journal) | ✅ |
| M2.7 | Vérification d'adresse et réinitialisation de mot de passe | ✅ |
| M2.8 | Client de base **conscient du tenant**, injection automatique du compte | ✅ |
| M2.9 | Page de profil, dont le changement de mot de passe | ✅ |

⚠️ **Réserve documentée sur M2.8** : les mises à jour et suppressions **par clé unique** ne sont
pas portées par l'extension de tenant — elles passent par les variantes multiples. C'est une
limite de l'outil, pas un oubli.

## Ce qui manque, et que le kit exige

- [ ] **Un test qui verrouille le refus par défaut.** Aucun test ne vérifie aujourd'hui qu'une
      route protégée refuse une session absente et qu'une route publique passe. C'est le test qui
      a le plus de valeur du socle : il verrouille un comportement qu'une modification distraite
      de la liste des routes publiques casserait **sans bruit**.
      ⚠️ **S'il casse un jour, c'est la route qu'il faut retirer, pas le test qu'il faut
      corriger.**
- [ ] **Vérifier l'emplacement du `proxy.ts`** — cf. `../../PITFALLS.md` #5b.
