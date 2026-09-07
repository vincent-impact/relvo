# Écarts et propositions

> **Le seul endroit du dépôt où l'historique d'une décision est à sa place.** `conception/`
> décrit l'état actuel et n'a le droit de porter ni date, ni « décision du… », ni concept mort.
> Tout cela vit ici.
>
> Chaque entrée porte un **statut** : `tranché` · `proposé` · `bloqué`. Une entrée tranchée ne
> se supprime pas — c'est sa raison d'être.

---

## Décisions tranchées

### Pas de backend découplé
**`tranché`** · Le plan initial prévoyait un second déployable avec sa propre couche
d'authentification entre services. Écarté : pour un produit où un compte correspond à un humain,
sans besoin d'API publique ni de montée en charge indépendante, le découplage n'ajoute qu'un
runtime, un déploiement et de la plomberie d'authentification — sans bénéfice.

Toute mention d'un backend séparé ou d'une authentification entre services dans un document
ancien est caduque.

### Un agrégateur managé pour l'e-mail et la messagerie
**`tranché`** · Remplace à la fois un montage de redirection e-mail et un **processus permanent**
maison pour la messagerie.

Trois exigences ont porté la décision : l'envoi **depuis la vraie adresse de l'utilisateur**
(non négociable, et ce que ne permet pas une simple redirection), le **multi-fournisseur** sans
audit de sécurité lourd, et une **connexion en un clic**. Un seul fournisseur unifie les deux
canaux, ce qui fait partager l'intégration entre deux épiques.

**Conséquence structurante** : la messagerie devient un webhook serverless comme l'e-mail. **Le
processus permanent disparaît**, et avec lui le second déployable — d'où la suppression de
`apps/worker` et la perte de justification de `packages/`.

**Ce qui a été retenu contre l'alternative crédible** : elle ne couvrait pas la messagerie.

⚠️ **Ce que le fournisseur n'ôte pas** : le **risque lié aux conditions d'utilisation** de la
messagerie. Il ôte la charge opérationnelle, pas le risque de blocage d'un numéro. Documenté
dans l'interface.

**Reste contractuel** : c'est un sous-traitant à contractualiser (hébergement UE, engagement de
protection des données).

### Stockage objet compatible S3, en juridiction UE
**`tranché`** · Comparé à trois alternatives.

Ce qui a départagé : **l'API compatible S3** — un client générique, un outillage connu, et une
sortie possible sans réécrire les appelants —, une **offre gratuite permanente** qui couvre toute
la bêta sans imposer un abonnement, et une mise en place en un bucket et un jeton.

⚠️ **Le coût n'a pas départagé** : les trois options étaient sous quelques euros par mois à
l'échelle V1. C'est une remarque utile pour les décisions suivantes du même genre.

**Pas de cache en frontal** : les fichiers sont privés et cloisonnés par compte, consultés par
une poignée d'utilisateurs. Un cache n'apporte rien et, chez ce fournisseur, il est **mutuellement
exclusif** avec les URL pré-signées. À rouvrir seulement si un usage public apparaît.

### Une application installable, pas une application native
**`tranché`** · Le produit vise des utilisateurs qui vivent sur téléphone.

« Mobile d'abord » est une affaire de mise en page, pas de framework : une application web
installée tourne en plein écran, sans chrome de navigateur, avec un rendu quasi natif — et
**zéro réécriture**, puisque tout le serveur est réutilisé. La distribution se fait par un simple
lien.

**La seule vraie faiblesse** : la friction d'installation sur iOS, où le geste est manuel. Elle
s'atténue par un accompagnement des premiers utilisateurs.

**Porte de sortie** : si la présence en magasin d'applications ou les notifications deviennent
bloquantes, on emballe le frontend dans une coque native. **Le serveur ne bouge pas** — c'est
purement une question de coque.

### La refonte du modèle de conversation, en trois temps
**`tranché`** · La séquence mérite d'être relue, parce que chaque étape a corrigé la précédente.

1. **L'entité `Conversation`** — le tri quitte le moment « création de sujet » pour le moment
   « réception », et devient déterministe.
2. **La divergence par canal** — on cesse de forcer une interface unique sur deux canaux qui
   n'ont ni la même forme de message ni le même système d'objet. Le vocabulaire « fenêtre »
   devient « **écoute** » : une action du sujet, pas une plage subie. **Aucune colonne renommée.**
3. **Le sous-typage** — l'e-mail porte un *set* de destinataires, la messagerie un interlocuteur.

**Ce qui a été supprimé en route, et pourquoi** : un dispositif visuel d'appartenance message par
message, une poignée de borne glissante, un défaut de borne calculé, et le menu contextuel sur
un message. Tous tombaient pour la même raison : une conversation est désormais **écoutée ou
pas** — un signal qui ne varie pas n'est pas un signal.

**L'erreur à ne pas refaire** : la réouverture d'un sujet e-mail à la réception a été **retirée
puis rétablie le même jour**, sur une lecture trop rapide d'une phrase écrite dans une section
« arrêt des écoutes » — laquelle ne concerne que la messagerie. La règle était écrite à deux
endroits ; c'est exactement ce que la règle « un fait, un domicile » existe pour empêcher.

### La fiche du sujet n'affiche plus les messages
**`tranché`** · Remplace les deux onglets par canal, livrés puis jugés flottants à l'usage.

La fiche liste les fils ; l'écran de conversation devient la **seule** surface d'affichage et de
réponse. On gagne un onglet, et on **cesse de dupliquer le rendu d'un fil** — deux endroits pour
lire un même échange, c'est deux rendus à maintenir et deux occasions de diverger.

### Une seule maquette de référence
**`tranché`** · Le dépôt portait **deux** références visuelles concurrentes : la maquette
statique, citée par la carte du projet et reproduite écran par écran par le code, et un bundle
de haute fidélité qui n'était **cité par aucun document**.

Retenue : la **maquette**, au rang 4. Les tokens du bundle rejoignent le design system —
vérifiés contre la feuille de styles réelle, ils étaient à jour. Ses écrans et son bundle
interactif sont **archivés hors dépôt** : ils précèdent plusieurs refontes et décrivent une
navigation qui n'existe plus.

### La liste des conversations n'est pas une entrée de navigation permanente
**`tranché`** · Exposer en permanence tous les fils reviendrait à réafficher une boîte de
réception que le dirigeant a déjà ailleurs — on lui *ajouterait* du travail au lieu de lui en
retirer.

⚠️ **Cette décision a été partiellement renversée** : les conversations ont rejoint la barre
d'onglets, au motif qu'elles comptent **tant qu'aucune IA ne fait le tri**, et que la barre rend
visible la chaîne Actions ← Sujets ← Conversations. **C'est une décision à rouvrir quand M7
livrera** : le motif qui l'a justifiée disparaîtra avec le tri manuel.

### Aucune conservation de données requise sur les migrations de la refonte
**`tranché`** · Seul le compte de test existait en production. Cela a permis de réécrire des
migrations plutôt que d'écrire des reprises de données complexes.

⚠️ **Cette liberté disparaît au premier utilisateur réel.** Toute migration ultérieure devra être
rejouable et vérifiée sur une copie de la production.

---

## Écarts constatés

### Le plan de réalignement documentaire n'a jamais été exécuté
**`tranché` — traité** · Un document de spécification listait explicitement les passages rendus
caducs par un virage produit, à mettre à jour « après validation ». La liste n'a jamais été
traitée, et les passages en question sont restés faux pendant des mois.

**Leçon retenue, et inscrite dans la Definition of Done** : une liste de corrections
documentaires reportée est une liste qui ne sera pas faite. La correction se fait **dans le
commit qui crée l'écart**, ou elle ne se fait pas.

### La documentation a décroché du code sur quatre fichiers
**`tranché` — traité** · Le remplacement de la fiche sujet a modifié six lignes de la carte du
projet et rien d'autre côté documentation, pour près de huit cents lignes de code supprimées.
Quatre documents ont continué à décrire la conception abandonnée.

Cause mécanique : **aucune Definition of Done** n'existait, et les règles vivaient comme des
intentions dans la carte du projet plutôt que comme des conditions de clôture.

### Le worker était supprimé dans la documentation, présent sur le disque
**`tranché` — traité** · La carte du projet annonçait qu'il n'existait plus ; il était toujours
là, avec son manifeste, son entrée de workspace, son script de lancement, et un README qui
demandait de le configurer puis annonçait trente lignes plus bas qu'il n'existait pas.

### Les décomptes écrits dans la documentation étaient faux
**`tranché` — traité** · Le backlog annonçait un nombre d'entités inférieur à la réalité, et
plusieurs entités n'étaient pas documentées.

**Leçon** : un décompte est juste le jour où on l'écrit, faux à la migration suivante, et **rien
n'échoue quand il est faux**. Les décomptes sont retirés ; la liste des contraintes est tenue par
un test qui échoue **dans les deux sens**.

### Le backlog portait l'ordre et la définition dans le même fichier
**`tranché` — traité** · Six cent trente-sept lignes mêlant le résumé produit, le périmètre, la
définition de chaque tâche, l'ordre, l'état d'avancement et la justification technique d'un choix
d'infrastructure.

Symptôme : le tableau d'état portait une date de mise à jour antérieure de neuf jours au dernier
commit, trois notations d'avancement cohabitaient, et une tâche était marquée « à faire » alors
qu'elle avait été livrée **puis remplacée**.

---

### Un geste, une surface — les actions de statut quittent la fiche du sujet
**`tranché`** · Premiers retours de bêta-testeurs, produit en mode **manuel** (sans le pipeline
d'arrivée). Trois constats convergents, tous sur des actions offertes **deux fois**.

La fiche d'un sujet portait un dock de boutons — Fermer / Valider, ou Supprimer / Réouvrir selon
le statut — qui doublait exactement les swipes de la liste. Le bas de chaque conversation portait
de même **trois** actions de poids égal. Dans les deux cas, l'abondance ne rendait pas le produit
plus accessible : elle rendait le geste **incertain**.

Décisions : les transitions de statut vivent désormais **dans les seuls swipes** de la liste des
sujets ; le triage d'une conversation passe par **un bouton unique** qui ouvre une pop-up ; et la
liste des conversations retrouve un **geste d'entrée** (swipe droite) qui relaie l'intention à
l'écran de conversation.

⚠️ **Un piège a été évité de justesse, et il mérite d'être écrit.** Retirer les boutons de la
fiche revenait à supprimer le **seul** chemin de réouverture d'un sujet terminal : la liste ne
portait alors aucun swipe sur ses onglets terminaux. Appliquer le retour tel quel aurait enfermé
définitivement tout sujet validé. Le geste de remplacement a donc été posé **avant** le retrait.
Règle générale : *un geste retiré d'une surface doit exister sur l'autre avant de disparaître.*

**Ce qui n'a PAS été cédé.** Le geste de la liste ne tranche rien lui-même — il transmet une
intention à l'écran de conversation. Cela préserve l'objection qui avait fait retirer ce swipe
auparavant (« ne pas décider sans avoir lu ») et, surtout, cela laisse la messagerie faire
**désigner le message d'ancrage**, qu'aucune ligne de liste ne peut deviner. Le relais est ce qui
rend le retour applicable **sans** inventer une ancre par défaut.

### Avertir avant de terminer un sujet dont des tâches restent ouvertes
**`tranché`** · Même série de retours. Valider ou fermer un sujet retire ses tâches de la vue
sans rien dire, alors qu'un sujet est le seul endroit où ces tâches existent.

Une confirmation apparaît désormais — mais **seulement s'il reste des tâches ouvertes**, et elle
**annonce leur nombre**. Les deux conditions viennent de la même règle que la confirmation
d'ignorance : une confirmation systématique, ou sans information, se clique sans être lue. Le
reste du temps, le swipe garde son coût de zéro clic.

---

## Propositions

### Exposer la base locale sur un port dédié
**`proposé`** · Le port par défaut de PostgreSQL est presque toujours déjà pris par un autre
projet local, et le symptôme — une connexion qui aboutit sur la **mauvaise base** — est bien plus
long à diagnostiquer qu'un port refusé.

**Coût** : changer le port dans la composition de conteneurs et dans les fichiers
d'environnement locaux. **Non appliqué** parce que cela casse l'installation locale existante ; à
faire au prochain redémarrage propre.

### Monter la version de Node
**`proposé`** · Le dépôt cible une version antérieure à celle du kit de référence. Les deux
sources internes sont cohérentes entre elles, donc rien n'est cassé — c'est un simple retard.

**À faire avec un `pnpm install` complet**, pas isolément.

### Reprendre le port du proxy d'authentification
**`tranché` — corrigé** · Le contrôle de CI a rougi dès son premier passage, et c'était bien le
constat : le fichier vivait à la racine de l'application alors que le projet utilise un dossier
source, donc il n'était **jamais compilé**. Déplacé dans `src/`.

⚠️ **Un second piège se cachait derrière le premier** : une fois le fichier au bon endroit, le
build a échoué sur la **forme de l'export**. Une déstructuration (`export const { auth: proxy }`)
n'est pas reconnue par l'analyse statique de Next, qui exige une fonction exportée par défaut ou
sous le nom attendu. Le doute que le sprint de reprise laissait ouvert est donc **levé : le piège
s'applique bien à cette version**. Les deux défauts se réparent forcément ensemble — un fichier
au mauvais endroit n'est pas compilé, donc son export n'est jamais analysé, et le second reste
invisible tant que le premier n'est pas corrigé.

Vérifié après correction : la redirection vers la connexion porte de nouveau le paramètre de
retour, les routes publiques et les routes d'API restent accessibles, et une session valide
traverse toutes les routes protégées.

⚠️ **La protection par ricochet reste la ligne qui compte** hors navigation de page : le proxy
raisonne sur des chemins, or une Server Action n'en a pas et le filtre exclut les routes d'API.

### Mesurer le compte réel du premier utilisateur
**`proposé`** · La source la plus fiable sur les données réelles — volumes, proportion de
messages qui méritent un sujet, longueur des fils — n'a jamais été mesurée. Tout dimensionnement
repose aujourd'hui sur un jeu de démonstration calibré pour la lisibilité d'un écran.

C'est le **rang 2** de la hiérarchie des sources, et il est vide.

### Rouvrir la place des conversations dans la navigation, à la livraison de M7
**`proposé`** · Voir la décision correspondante plus haut. Le motif qui a justifié leur entrée
dans la barre d'onglets disparaît avec le tri manuel.
