# Sprint « Bijou » — M19, à partir du 12 octobre 2026

## Démarrage à froid — à lire en premier

**Où on en est.** M18 a livré la disposition générale (dock à cinq places, menu latéral, accueil
en brief, Calendrier, Bilan et Usage en maquette annoncée, Mémoire) et a été fermée en `partiel`
le 2026-10-12 : sa tranche 5 (`RelvoQuestion` élargie, badge, notification — M18.9, M18.11) se
livre avec M10, qui en est le consommateur. Le dirigeant trouve l'application **lourde** et
**sans accompagnement** : ce n'est pas la place des choses, c'est leur matière, et l'absence de
prise par la main. La décision vit dans
[`../ecarts-et-propositions.md`](../ecarts-et-propositions.md), « Une direction artistique
choisie parmi quatre, avant de construire l'échange » ; le découpage dans
[`../epics/M19-direction-artistique.md`](../epics/M19-direction-artistique.md).

**Ce que ce sprint livre**, dans l'ordre des tranches : **Voir** (le brief au présent, le point
zéro, quatre directions sur planches, une décision), **Habiller** (tokens et composants
signature), **Alléger** (écran par écran), **Guider** (langage de mouvement, premiers pas),
**Clore**. **M7 tranche 10 et M10 passent après.**

### Avant la première ligne

- [x] Installer les trois skills **au niveau utilisateur**, jamais dans le dépôt (M19.11) :
      `npx ui-ux-pro-max-cli init --ai claude --global` · `npx impeccable install --global
      --providers=claude -y` · `npx skills@latest add emilkowalski/skills -g -a claude-code`
      avec **un `-s` par skill** (douze retenues : ni `animate-expo`, ni `write-swift`, ni
      `pick-ui-library`). ⚠️ Ce que les installeurs font en plus est dans `PITFALLS.md` #56 :
      extras de ui-ux-pro-max mis à la corbeille, hook d'impeccable fusionné dans
      `.claude/settings.local.json` du projet.
- [ ] Relire `PITFALLS.md` #40 (Base UI, pas Radix), #51 (l'app est claire seulement, l'iPhone
      du dirigeant est en mode sombre), #54 (barre Android), et `conception/design-system/`
      en entier : c'est ce que les directions ont le droit de contester, pas d'ignorer.
- [ ] **Registre de composants d'abord**, comme toujours.

### Quatre règles pour toute la durée du sprint

- **La disposition ne rouvre pas** (invariants 34–38). Une envie de changer un flux se note
  dans le registre des écarts et se tranche à part.
- **Les outils interviennent chacun sur une tranche**, dans l'ordre des tranches. Le mouvement
  arrive en dernier : on n'anime pas ce qu'on va encore retirer.
- **Les fichiers des outils ne sont pas de la conception** : `PRODUCT.md` et `DESIGN.md` sont
  des pointeurs, `design-system/` est ignoré par git, les directions écartées ne survivent que
  dans l'artefact des planches.
- **Doc et code dans le même commit**, pied `Client:` sur chaque `feat` et `fix`, un commit
  par écran dans la tranche « Alléger ».

### Ce qui reste ouvert, à trancher en cours de sprint

- **La bibliothèque de mouvement** : CSS et View Transitions d'abord ; `motion` seulement si
  une tranche le réclame, et alors pour tout le produit.
- **Le témoin** : si la direction retenue est la DA actuelle poussée au bout, les tranches
  « Alléger » et « Guider » se livrent quand même.
- **Ce que `mobile-native` a le droit de dire** : relecteur, jamais correcteur du viewport.

---

## Où on en est

- [ ] Tranche 1 — « Voir » : M19.1 brief au présent · M19.2 point zéro · M19.3 quatre
      directions sur planches (Accueil, Sujets, Échange) · M19.4 décision écrite
- [ ] Tranche 2 — « Habiller » : M19.11 outillage · M19.5 tokens, tenus par un test · M19.7
      composants signature
- [ ] Tranche 3 — « Alléger » : M19.6 écran par écran · M19.10 robustesse
- [ ] Tranche 4 — « Guider » : M19.8 langage de mouvement · M19.9 premiers pas
- [ ] Tranche 5 — « Clore » : M19.12
