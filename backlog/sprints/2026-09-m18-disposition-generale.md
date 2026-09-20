# Sprint « Disposition » — M18, à partir du 22 septembre 2026

## Démarrage à froid — à lire en premier

**Où on en est.** La présentation du produit du 2026-09-20 a eu lieu. Le même jour, la session
sur la disposition générale a tranché — sur planches, puis en registre — ce que le dirigeant
constatait à l'usage : pas de vraie page d'accueil, un dock trop chargé dont deux onglets ne
servent jamais, aucun chiffre qui justifie Relvo, un chat qui devrait être le centre et qui est
un bouton de coin. Les décisions vivent dans
[`../ecarts-et-propositions.md`](../ecarts-et-propositions.md), « La disposition générale :
quatre vues, Relvo au centre, un menu pour le reste » ; l'état cible dans
[`../../conception/01-principes.md`](../../conception/01-principes.md) §11 et les invariants
34–38 ; le découpage dans [`../epics/M18-disposition-generale.md`](../epics/M18-disposition-generale.md).

**Les planches de référence** — sept écrans au format téléphone, dans les tokens du produit :
<https://claude.ai/artifact/8GotYyBCG2fhLiSXFNwJnD>. La planche retenue pour l'accueil est
**A1** (nouvelles dans le header). ⚠️ Ce sont des planches, pas la maquette : elles disent la
disposition et la matière, pas les données, et elles ne sont pas buildées.

**Ce que ce sprint livre**, dans l'ordre des tranches de l'épique : la navigation (dock à cinq
places, menu latéral, header), puis le Calendrier et l'accueil en brief, puis le Bilan et
l'Usage, puis la Mémoire, puis « Relvo parle en premier » (la `RelvoQuestion` élargie, le badge,
la notification). **M7 tranche 10 passe après**, et M10 se construit sur le résultat.

### Avant la première ligne de code

- [x] Relire `PITFALLS.md` #40 (Base UI, pas Radix), #48 (deux layouts racine, `(shell)` /
      `(public)`), #51 (thème sombre : l'app est claire seulement, l'iPhone du dirigeant est en
      mode sombre).
- [x] **Registre de composants d'abord** (`CLAUDE.md`, « Réflexe registre ») : le menu latéral
      est une feuille (`sheet`), le segmented Semaine / Mois existe, la jauge de l'Usage est un
      `progress`. Rien ne se réécrit à la main.
- [x] Le bouton Relvo en relief est le **seul** objet en relief : sa matière vit dans un
      composant unique, jamais recopiée.

### Trois règles pour toute la durée du sprint

- **Le brief est un calcul, jamais une génération.** Les nouvelles et les suggestions se
  comptent dans le journal et se déduisent de règles écrites dans le produit ; le modèle ne
  travaille qu'une fois l'échange ouvert.
- **Jamais d'euros devant l'utilisateur.** L'Usage est un pourcentage du plafond, le Bilan
  n'estime aucun « temps gagné ».
- **Doc et code dans le même commit**, pied `Client:` sur chaque `feat` et `fix`, frontmatter de
  l'épique mis à jour dans le commit qui change son état.

### Ce qui reste ouvert, à trancher en cours de sprint

- **Le plafond de l'Usage** avant M14.5 : une configuration par compte, avec une valeur par
  défaut, pour que le pourcentage existe dès maintenant.
- **Le socle push** (M18.11) : s'il n'existe pas, la tranche 5 livre le badge et la ligne de
  l'accueil, et la notification glisse vers M12.
- **La place de Conversations dans le dock** ne se rouvre pas ici : c'est l'usage après M7 qui
  tranche (`ecarts`, « Rouvrir la place des conversations »).
- **Le dock sur les écrans qui ont leur propre barre d'action** — le détail d'une conversation
  (« Ignorer » / « Ouvrir un sujet », composer) et la fiche d'un contact (« Modifier » /
  « Supprimer ») remplacent la barre d'onglets, donc le bouton Relvo n'y est pas. Sortir de
  l'exception demande de repenser ces barres ; à trancher avec la tranche 5, quand le badge
  donnera au bouton une raison d'être partout.

---

## Où on en est

- [x] Tranche 1 — la navigation, avec les pages d'aujourd'hui — code livré, à vérifier sur
      l'iPhone en mode sombre. `/` reste la page des tâches et `/calendrier` porte la vue mois
      seule jusqu'à la tranche 2 ; Bilan et Usage n'apparaissent pas encore dans le menu, et
      Mémoire y ouvre l'onglet Domaines des Réglages jusqu'aux tranches 3 et 4
- [ ] Tranche 2 — le Calendrier et l'accueil en brief
- [ ] Tranche 3 — le Bilan et l'Usage
- [ ] Tranche 4 — la Mémoire
- [ ] Tranche 5 — Relvo parle en premier
