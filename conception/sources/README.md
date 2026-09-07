# Sources du client

Ce dossier accueille les **fichiers bruts** fournis par le client ou extraits du système en
place : exports, tableurs, documents de cadrage. Ils sont de **rang 2** — ils font foi sur les
**données réelles** (volumes, champs réellement collectés, cas vraiment pratiqués), et sur rien
d'autre.

**Il est vide, et c'est un manque.** Relvo remplace une boîte mail et un WhatsApp : la source la
plus fiable sur les données réelles est le compte du premier utilisateur, et elle n'a pas encore
été mesurée. Tant qu'elle manque, tout dimensionnement s'appuie sur le jeu de démonstration —
qui n'a jamais été calibré sur autre chose que la lisibilité d'un écran.

## Avant de déposer un fichier ici

⚠️ **Un fichier client contient des données personnelles.** Commité, il entre dans l'historique
git — qui est immuable — et dans toute branche de preview. Un effacement RGPD y devient alors
impossible. **Trancher où vit le fichier avant de le committer, jamais après.**

⚠️ **Le lire est déjà un chantier.** Trois pièges y attendent et aucun ne lève d'erreur : une
cellule de tableur n'est pas une chaîne, un `pg_dump` ne se colle pas tel quel dans une
migration, et une migration de données ne se relit pas ligne par ligne. Cf. `PITFALLS.md`
#38, #39, #43. Le seul contrôle qui ne ment pas est de **rejouer toute la chaîne sur une base
vierge et de recompter** — jamais une relecture du fichier.
