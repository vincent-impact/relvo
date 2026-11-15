---
id: M28
public: true
ordre_public: 25
titre_client: Vos sujets et vos dossiers sur une seule page
resume_client: >
  La page Sujets montre désormais deux vues de la même matière : la liste, comme avant, et
  l'arborescence de vos dossiers avec leurs sujets dedans. Une pastille sur un dossier vous dit
  combien de ses sujets ont bougé depuis votre dernier passage. Vos instructions générales se
  donnent maintenant directement à Relvo.
statut: partiel
debut: 2026-11-15
---

# M28 — Sujets : une page, deux vues

**Objectif** — une seule porte vers les sujets et les dossiers. La page Sujets garde sa liste à
plat et reçoit une seconde vue, l'arbre complet, dossiers et sujets ensemble. **Dépendances** :
M23 (l'arbre), M27 (le mot, la fiche d'un dossier, la feuille « Ranger dans… »).

**Pourquoi.** Les testeurs de l'alpha trouvent l'application complexe — la navigation, le
sentiment de contrôle — et saluent l'arborescence des dossiers. Deux portes menaient à la même
matière : l'onglet Sujets et la page Dossiers du menu. Décision et débat : `ecarts`, « Sujets :
une page, deux vues ».

**Ce qui ne change pas.** Le modèle (`Folder`, `Subject`), la fiche d'un dossier
(`/memoire/[id]`), la fiche d'un sujet, les balayages de la liste à plat, la feuille « Ranger
dans… », les invariants sous leurs numéros.

| #     | Item | État |
| ----- | ---- | ---- |
| M28.1 | **L'arbre en lecture** : l'interrupteur Sujets / Dossiers dans le ciel, retenu sur l'appareil ; la vue Sujets sans puces de dossier ; la vue Dossiers en cartes (plier, entrer, pastille de ce qui a bougé, « Tout replier ») ; tous les sujets chargés ; « nouveau » borné à sept jours et « a bougé » dérivé des tâches ; « Urgent · » en gras ; « Dossiers » retiré du menu, `/memoire` redirigée ; les instructions générales dans l'échange avec Relvo | ✅ |
| M28.2 | **L'ajout en fin de branche** : la dernière ligne de chaque branche dépliée est « Ajouter dans <dossier> », à tous les niveaux ; elle ouvre une feuille tirée du bas — Un sujet / Un dossier, un nom, Créer ; un dossier vide se déplie | ⬜ |
| M28.3 | **Le glisser-déposer** : un sujet ou un dossier se dépose dans un autre dossier — maintien au doigt, tirer à la souris, cible surlignée, dossier replié qui s'ouvre, défilement aux bords, interdits non surlignés, toast avec Annuler | ⬜ |
