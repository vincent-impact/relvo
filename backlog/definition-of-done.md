# Definition of Done

> **Un item n'est pas terminé tant que ces lignes ne sont pas vraies.** Elles ne sont
> négociables sur aucun item, et elles ne dépendent d'aucun réflexe : la CI en vérifie la
> plupart.

## Non négociable

- [ ] **Typage et lint à zéro erreur.**
- [ ] **Les tests passent.**
- [ ] **Le comportement livré est couvert par un test.** Pas « du code est testé » : *ce*
      comportement-là.
- [ ] **Une migration s'accompagne de la mise à jour de `conception/02-modele-donnees.md` DANS LE
      MÊME COMMIT.**
- [ ] **Une décision d'architecture met à jour `CLAUDE.md` et `README.md` de même**, et son
      raisonnement descend dans [`ecarts-et-propositions.md`](ecarts-et-propositions.md).
- [ ] **Aucun secret dans le diff.**
- [ ] **La CI est verte.**
- [ ] **Tout composant graphique passe par le registre avant d'être écrit.** Écrire à la main une
      primitive que le registre fournit est une erreur de process, pas un choix esthétique.
- [ ] **Tout piège rencontré remonte à `PITFALLS.md` ET au registre du kit, dans la même
      session.**
- [ ] **Tout commit `feat` ou `fix` porte un pied de message `Client:`** — une phrase d'effet
      observable, ou `Client: -` quand il ne concerne pas le client. **Sans pied, l'entrée
      n'existe pas dans le journal** : le sujet du commit n'est plus publié en repli.
      Cf. [`suivi-client.md`](suivi-client.md).
- [ ] **Quand une épique change d'état, son frontmatter est mis à jour DANS LE MÊME COMMIT**
      (`statut`, `debut`, `fin`). C'est ce qui alimente la page de suivi du client.

## Pourquoi ces deux dernières lignes existent

Elles ont été ajoutées parce que leur absence a coûté, sur ce projet précisément.

**Le registre de composants.** Sans la ligne, on écrit une primitive à la main un jour de
fatigue, et elle diverge du reste du produit pour toujours.

**La remontée des pièges.** Sans la ligne, la remontée dépend d'un réflexe — et un réflexe ne
tient pas deux jours de débogage. Ce projet a payé plusieurs pièges qui ne sont remontés au kit
que des jours plus tard, par une relecture.

> ⚠️ **Ces deux dernières lignes ne reposent pas que sur la discipline.** Le script qui génère
> la page de suivi **valide la cohérence du frontmatter et fait échouer le build** si elle casse
> — deux épiques publiques ouvertes en même temps, un résumé client manquant, une date de fin
> avant la date de début. Une page de suivi fausse est pire qu'une page absente : elle est lue,
> et elle est crue.

## Ce que la Definition of Done ne dit pas

Elle ne dit pas « la documentation est à jour ». C'est trop vague pour être vérifiable, et
l'expérience de ce dépôt le prouve : la règle « doc et code dans le même commit » a été
respectée à la lettre tout en laissant quatre documents décrire une conception abandonnée.

⚠️ **La discipline protège l'INTENTION ; l'INVENTAIRE demande un test.** C'est pourquoi la ligne
sur la migration nomme un fichier précis, et pourquoi la liste des contraintes de
`02-modele-donnees.md` est tenue par un test qui échoue **dans les deux sens**.
