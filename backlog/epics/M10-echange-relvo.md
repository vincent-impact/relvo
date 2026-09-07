# M10 — L'échange avec Relvo

**Objectif** — la **surface d'action principale du produit** : un échange conscient de la page,
capable d'agir, accessible partout, avec une palette d'outils **symétrique à l'interface**.

**Dépendances** : M3, M7, M11.

> **C'est ici que se joue la posture produit.** « L'UI sert à accéder à l'info, Relvo sert à
> agir » n'est vrai que si cette épique est livrée. Tant qu'elle ne l'est pas, Relvo est un outil
> de consultation avec de l'IA dedans.

| # | Item |
|---|---|
| M10.1 | Surface **plein écran**, ouverte depuis le bouton du header, consciente de la page d'origine |
| M10.2 | Stockage local des échanges, côté client |
| M10.3 | Sessions implicites : reprise en deçà d'un court délai |
| M10.4 | Historique des derniers échanges, titrés automatiquement |
| M10.5 | Bandeau de contexte, avec bascule en discussion générale |
| M10.6 | État vide : exemples contextuels à la page, en texte discret — **pas de fausses bulles** |
| M10.7 | Route d'échange orchestrant le SDK et la passerelle |
| M10.8 | **Outils symétriques à l'interface** — chaque opération de l'UI a son outil, qui appelle **la même fonction métier** |
| M10.9 | Actions rendues en **blocs visuels** dans le fil |
| M10.10 | **Annulation** d'une action, dans une courte fenêtre |
| M10.11 | Choix du modèle selon la complexité |
| M10.12 | Mise en cache du prompt |
| M10.13 | Traçabilité de la provenance dans le journal |
| M10.14 | Diffusion en continu des réponses |
| M10.15 | Gestion d'erreur explicite dans le fil |

⚠️ **M10.8 est la ligne qui décide de tout le reste.** Si un outil réimplémente une règle métier
au lieu d'appeler la fonction existante, on obtient deux comportements pour une même opération —
et c'est l'utilisateur qui découvre lequel s'applique.

⚠️ **Le brouillon ne s'envoie jamais.** Il atterrit dans la zone de rédaction. Cette limite ne
bouge pas : un envoi à tort engage la parole de l'utilisateur auprès d'un tiers, et aucune
annulation ne rattrape ça.
