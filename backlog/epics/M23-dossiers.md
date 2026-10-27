---
id: M23
public: true
ordre_public: 20
titre_client: Vos dossiers, rangés comme sur votre ordinateur
resume_client: >
  Vous créez vos propres dossiers, et des dossiers dans ces dossiers, et vous y rangez vos
  sujets. Une consigne donnée à un dossier vaut pour tout ce qu'il contient. Les domaines
  d'aujourd'hui deviennent vos premiers dossiers.
statut: termine
debut: 2026-10-27
fin: 2026-10-27
---

# M23 — Les dossiers

**Objectif** — remplacer la liste plate des domaines par une **arborescence de dossiers** que
le dirigeant configure lui-même, comme sur son ordinateur : des dossiers dans des dossiers, et
des affaires dedans. **Dépendances** : M3 (le modèle), M10 (les outils de l'échange), M17.10
(les domaines proposés par le courrier). **Touche** M7 (le classement), M11 (les documents d'un
dossier), M12.8 (les pastilles de domaine).

**Pourquoi.** Les testeurs n'ont pas adopté les domaines : ils veulent **ranger**, et ranger
veut dire des dossiers qu'on nomme soi-même, qu'on emboîte, qu'on déplace. C'est un réflexe
forgé par des années de bureautique ; le produit ne le combat pas, il s'y plie (`ecarts`, « Les
domaines deviennent des dossiers »).

**Ce qui ne change pas.** Le modèle de contexte (`05 §10.1`) : une affaire lit toujours la
couche Domaine. Ce qui change, c'est **comment cette couche s'assemble** : par la **chaîne des
dossiers** de la racine jusqu'au dossier de l'affaire. Les domaines d'aujourd'hui restent, posés
**à plat sous Général**, qui devient la racine. Le code garde `Folder` — il disait déjà
« dossier » ; c'est l'utilisateur qui lisait « domaine ».

> **La conséquence de l'arbre, à tenir partout.** Une instruction ou un document donné à un
> dossier **père** s'applique à tous ses dossiers **fils** et donc à toutes les affaires qu'ils
> contiennent. Ce n'est pas une option : c'est ce qu'un dossier veut dire. L'ordre d'empilement
> est celui de la chaîne, du plus général au plus précis, le plus précis en dernier — une
> instruction de fils précise celle du père, elle ne l'efface pas.

| #     | Item                                                                                                                                                                                                                                                              |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M23.1 | **Le modèle** : un dossier a un **père** (nul pour la racine Général) ; profondeur bornée par un test, pas par la vigilance ; `slug` unique par père, plus par compte. Migration : les domaines existants deviennent des fils de Général, rien ne bouge pour l'utilisateur |
| M23.2 | **L'héritage** : la couche Domaine assemble instructions **et** documents de la chaîne, racine en premier ; une affaire rangée dans un fils lit tout ce qu'ont ses pères. Test sur une chaîne à trois niveaux. Les étiquettes (M17.4) restent **transversales** : l'arbre range, l'étiquette qualifie |
| M23.3 | **La Mémoire en arborescence** : on entre dans un dossier, on y crée un dossier, on renomme, on **déplace** un dossier avec tout ce qu'il contient, on supprime — ce qu'il contenait remonte chez le père, jamais perdu. Le logo et la couleur restent au dossier     |
| M23.4 | **Ranger une affaire** : la fiche choisit un dossier à n'importe quelle profondeur (chemin lisible, « Clients › Franchises › Narbonne ») ; la page Affaires filtre par dossier **en incluant ses fils** ; le Calendrier et ses pastilles lisent le dossier de premier niveau |
| M23.5 | **Relvo range dans l'arbre** : le classement d'un message et la proposition de domaine (`05 §1.1 ter`, §1.5, M17.10) parlent en **chemins** ; Relvo propose un dossier, l'utilisateur le crée — Relvo **ne crée jamais un dossier seul**. Les domaines typiques de la prise en main deviennent des dossiers de premier niveau |
| M23.6 | **Le mot** : « dossier » partout pour l'utilisateur — Mémoire, filtres, fiche, script de la prise en main (« je range vos affaires dans des dossiers »), consignes de l'IA (`05`, socle de vocabulaire) ; la conception se récrit en place, jamais en surcharge                 |
| M23.7 | **Les outils de l'échange** : lister, créer, déplacer un dossier et ranger une affaire par critères (« mets Narbonne dans Franchises ») — par les mêmes fonctions du domaine que la Mémoire (M10, règle des outils par critères)                                       |

**Ce qu'il faut trancher avant M23.1.** La profondeur maximale (trois niveaux suffisent à un
dirigeant ; au-delà, c'est une arborescence de serveur). Le sort du dossier par défaut d'un
contact et des `folder_ids` d'un canal : un dossier à n'importe quel niveau, ou seulement un
dossier de premier niveau. La portée d'une question de Relvo sur un dossier : le dossier seul.

⚠️ **Les invariants cités dans le code restent numérotés** (`01 §14`) ; si l'un d'eux parle de
« domaine », il se récrit avec « dossier » sous le **même numéro**.
