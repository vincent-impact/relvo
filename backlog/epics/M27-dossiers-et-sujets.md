---
id: M27
public: true
ordre_public: 24
titre_client: Vos dossiers, vos sujets — comme sur votre ordinateur
resume_client: >
  Ce qu'on appelait une affaire s'appelle désormais un sujet, et un sujet se range dans un
  dossier, comme un fichier. La page Dossiers montre toute l'arborescence d'un coup, Général en tête ; un dossier
  s'ouvre sur sa description, ses dossiers, ses sujets, ses instructions et ses connaissances,
  avec un bouton pour ajouter chacun ; un sujet se range d'un glissement.
statut: termine
debut: 2026-10-27
fin: 2026-10-27
---

# M27 — Dossiers et sujets

**Objectif** — faire lire l'arbre des dossiers tel qu'il est (M23 l'a construit, l'écran le
montrait à plat), et aligner le vocabulaire du produit sur celui que les clients maîtrisent : la
gestion de fichiers. **Un sujet se range dans un dossier.** **Dépendances** : M23 (l'arbre), M19
(la direction, les onglets à icône de la fiche d'un sujet). **Touche** M11 (le dépôt d'une
connaissance), M10 (les outils et les phrases de l'échange).

**Pourquoi.** Sur la page Mémoire, rien ne disait qu'on avait un arbre sous les yeux : des
lignes à plat, Général en dernier comme un dossier parmi d'autres. Le dirigeant a tranché sur
maquettes (`ecarts`, « Un sujet se range dans un dossier ») : la structure « arbre déplié »,
une fiche de dossier en quatre onglets, et le mot « sujet » à la place d'« affaire », parce que
« fichier dans un dossier » est le modèle mental de ses clients.

**Ce qui ne change pas.** Le modèle (`Folder`, `Subject`, `KnowledgeDocument`), les routes
(`/memoire`, `/sujets`, `/fil`), la portée d'un dossier (la chaîne des pères), la couleur du
premier niveau, les invariants sous leurs numéros. Un nom de code n'est pas un mot du client.

| #     | Item                                                                                                                                                                                                                                                                                                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M27.1 | **Le mot** : « sujet » partout où le dirigeant lit ou entend « affaire » (interface, phrases de Relvo, journal, erreurs, diapositives, suivi) ; « Dossiers » à la place de « Mémoire » (menu, titre) ; « connaissance » à la place de « document » pour les fichiers d'un dossier ; l'onglet du dock « Sujets » avec sa propre icône, le dossier restant le dessin des dossiers. Le socle des consignes ne force plus « affaire ». La conception se récrit en place |
| M27.2 | **La page Dossiers en arbre** : une carte, tout l'arbre, Général en tête (« la racine — tout est dedans »), un triangle à gauche qui déplie ou replie une branche (son état retenu sur l'appareil), la ligne qui entre ; le compte de sujets au bout de chaque ligne, « Sans dossier » au pied, l'ajout en bas  |
| M27.3 | **La fiche d'un dossier** : sa description en première carte (« Relvo s'en sert pour ranger les sujets ici », invite en pointillé quand elle manque), puis quatre onglets à icône — Dossiers (l'arbre du dossier, même mécanique), Sujets (les siens et ceux de ses fils), Instructions, Connaissances — et **un ajout en première ligne de chaque onglet** |
| M27.4 | **Ranger dans…** : une feuille qui monte du bas avec le même arbre (Général grisé, « Sans dossier » possible), ouverte en glissant une ligne de sujet vers la droite dans un dossier, ou en tapant le dossier dans le ciel de la fiche d'un sujet ; un tap range, un toast annule. La même feuille déplace un dossier |
| M27.5 | **Déposer une connaissance** : l'ajout de l'onglet Connaissances envoie un fichier au stockage (M4.3) et l'inscrit dans le dossier ; sa lecture par Relvo reste M11                                                                                                                                                  |

> **La règle du mot.** Le dirigeant lit « sujet », « dossier », « connaissance ». Le code garde
> `Subject`, `Folder`, `KnowledgeDocument` et leurs routes ; les consignes du modèle parlent déjà
> de « sujet ». Ce qui change de mot se récrit **en place**, jamais par une note « on dit
> maintenant sujet ».
