# Design system — 3. Patterns

> Les règles de **disposition** : ce qui vaut sur tous les écrans, et ce qui change avec la
> taille de l'appareil. Le *pourquoi* produit vit dans [`../01-principes.md`](../01-principes.md).

## Mobile d'abord, littéralement

On dessine **d'abord** pour un téléphone tenu à une main. Le desktop est un **enrichissement
progressif**, jamais le point de départ : une vue n'est finie que si elle fonctionne en colonne
unique, au pouce.

**Règle d'écriture** : aucune largeur fixe sans préfixe de palier, et toute disposition en
lignes ou en grille multi-colonnes a un repli en colonne au palier de base.

| Palier | Cible | Disposition |
|---|---|---|
| Base | Téléphone | Colonne unique. Nav = barre d'onglets basse. |
| `sm` | Grande tablette portrait | Colonne unique élargie, centrée à une largeur lisible. |
| `md` | Tablette paysage | Second volet optionnel (liste + détail). |
| `lg` | Desktop | Barre d'onglets → rail latéral ; vues à deux colonnes. |

Aucun comportement desktop n'est requis pour qu'une vue soit fonctionnelle. C'est du bonus.

## Le cadre : le ciel en haut, le dock en bas

Chaque écran est encadré par la **livrée** — le ciel en haut, qui fond vers le blanc de l'écran
de travail, et le dock noir flottant en bas. Ce qui se trouve entre les deux appartient à
l'utilisateur, sur fond blanc, en cartes.

Le **ciel** porte **une seule rangée** : le titre de la page, gros et condensé, et à sa droite
les boutons propres à la page, puis le burger, discret ; sur un écran poussé, la flèche retour
précède le titre. Le qualificatif se lit au-dessus (la date sur l'accueil, le domaine sur une
fiche) ou en dessous, en petites capitales. Seul un titre long — une fiche, une conversation —
descend sous la rangée. La rangée respire sous la barre d'état du téléphone : collée à l'heure
et à la batterie, elle étouffe. Le ciel est court sur une page de liste, un peu plus haut sur
l'accueil et sur une fiche dont il porte la bande de domaine et les onglets, et prend près de
la moitié de l'écran sur la connexion. **La première carte
chevauche toujours le bas du ciel** : c'est elle qui lie les deux zones, et le ciel réserve la
place par son dégradé, jamais par une bordure.

Le **dock** est une pilule noire décollée du bas et des bords, à cinq places, **fixe** : il ne
se masque pas au défilement — un élément de navigation qui disparaît est un élément qu'on
cherche. L'accès à Relvo vit **en son centre**, à la même place sur toutes les pages, un disque
violet cerclé de noir qui déborde du dock en haut et en bas, sans libellé ; il porte un badge
quand Relvo attend une réponse. Le
dock est présent sur les pages à onglet et les pages du menu, et sur la fiche d'un sujet ; il
**cède la place au composer** dans une conversation et dans l'échange, où l'on écrit.

Le **menu latéral** s'ouvre depuis le burger, à droite du header, et glisse depuis la gauche
par-dessus la page assombrie.

## Cibles tactiles et zones sûres

Cible tactile minimale : **44 px**. Les zones sûres iOS (`env(safe-area-inset-*)`) sont
respectées : le dock flotte au-dessus de l'inset bas, et le ciel passe derrière la status bar.

## PWA — installable, plein écran, sans store

`apps/web` est installable en PWA. C'est ce qui donne un rendu quasi-natif sans coût de store ni
seconde base de code.

- **Manifest** : `display: standalone`, `orientation: portrait`, icônes **192 et 512** —
  cette paire d'icônes est une **exigence d'installabilité** Chrome, pas une préférence.
- **Meta tags** : `apple-mobile-web-app-capable` **et** son équivalent générique
  `mobile-web-app-capable`. Les deux.
- ⚠️ **Sur iOS, le plein écran est accordé par la meta tag, pas par le navigateur.**
  L'installation « Sur l'écran d'accueil » fonctionne donc depuis Safari **comme** depuis
  Chrome iOS (tous deux WebKit). La seule friction réelle est l'absence d'invite automatique :
  le geste est manuel, et il s'accompagne.
- **Status bar** : en `black-translucent`, la vue occupe tout l'écran, status bar comprise. Un
  bandeau fixe, de la couleur du haut du ciel, de la hauteur de l'inset haut remplit la zone
  derrière elle — invisible hors mode installé, où l'inset vaut zéro. `viewport-fit: cover`
  active les insets.
- ⚠️ **L'icône PWA exige un fond opaque.** Avec de la transparence, iOS compose l'icône sur du
  noir au lieu de la respecter.

## Ce qui n'est pas encore tranché

Le repli desktop des surfaces refondues (l'écran de conversation en particulier) n'a pas été
dessiné : il fonctionne en colonne unique élargie, sans enrichissement. C'est un manque assumé,
pas un oubli — le produit se vérifie d'abord sur téléphone.
