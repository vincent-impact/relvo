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

## Le cadre : violet en haut, violet en bas

Chaque écran est encadré par la **zone agent** — un header violet en haut, la barre d'onglets
violette en bas. Ce qui se trouve entre les deux appartient à l'utilisateur.

L'accès à Relvo vit **en haut à droite du header**, à la même place sur toutes les pages. Les
boutons propres à la page se posent **à sa gauche**. La barre d'onglets est **fixe** : elle ne
se masque pas au défilement — un élément de navigation qui disparaît est un élément qu'on
cherche.

Une carte peut **chevaucher le bas du header** pour lier les deux zones ; le header réserve
alors la place par un rembourrage bas.

## Cibles tactiles et zones sûres

Cible tactile minimale : **44 px**. Les zones sûres iOS (`env(safe-area-inset-*)`) sont
respectées sous la barre d'onglets et au-dessus de la status bar.

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
  bandeau violet fixe de la hauteur de l'inset haut remplit la zone derrière elle — invisible
  hors mode installé, où l'inset vaut zéro. `viewport-fit: cover` active les insets.
- ⚠️ **L'icône PWA exige un fond opaque.** Avec de la transparence, iOS compose l'icône sur du
  noir au lieu de la respecter.

## Ce qui n'est pas encore tranché

Le repli desktop des surfaces refondues (l'écran de conversation en particulier) n'a pas été
dessiné : il fonctionne en colonne unique élargie, sans enrichissement. C'est un manque assumé,
pas un oubli — le produit se vérifie d'abord sur téléphone.
