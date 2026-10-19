---
id: M20
public: true
ordre_public: 18
titre_client: La messagerie au quotidien
resume_client: >
  Dicter un message plutôt que le taper, envoyer une photo ou un fichier, écouter et lire les
  messages vocaux reçus, en laisser un à votre tour, mettre un visage sur un contact. Tout ce qui
  rend la messagerie de Relvo aussi naturelle que celle de votre téléphone.
statut: a-faire
---

# M20 — Les usages de la messagerie

**Objectif** — rendre à la messagerie de Relvo les gestes qu'un dirigeant a déjà sur son
téléphone : la voix, l'image, le fichier, le visage. **Dépendances** : M4 (le stockage), M5 et
M6 (les canaux), M8.7 (la transcription des messages vocaux, côté pipeline), M14.5 (le
disjoncteur de coût). **Après** le cœur IA (M7, M10) : ces gestes enrichissent une messagerie qui
doit d'abord trier et répondre.

> **Un bouton sans effet se retire.** Le micro, le trombone et le portrait cliquable ont été
> retirés de l'interface tant que le geste n'existait pas ; chacun revient **avec sa fonction**,
> jamais avant. C'est la règle de `02-composants.md`, et elle vaut pour chaque item ci-dessous.

| #     | Item                                                                                                                                                                  |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M20.1 | **La dictée** dans le composer — le disque de dictée du brief — vers le texte du message, relu avant l'envoi comme tout texte ; **sur le socle de M22** (enregistrement, route de transcription, vocabulaire du compte), sans seconde implémentation |
| M20.2 | **L'envoi de pièces jointes** depuis le composer : une photo prise ou choisie, un fichier ; par le paquet de stockage, dans la limite du canal                           |
| M20.3 | **Écouter et lire un message vocal reçu** : un lecteur dans le fil, la transcription (M8.7) affichée comme contenu du message, l'audio gardé en pièce jointe          |
| M20.4 | **Laisser un message vocal** : enregistrer, envoyer par le canal, transcrire dans le contenu pour que Relvo le lise comme les autres                                   |
| M20.5 | **La photo d'un contact** : une colonne sur le contact, le dépôt par le paquet de stockage, le geste sur le portrait de la carte de visite (prendre ou choisir)       |
| M20.6 | **Le coût d'abord** : benchmark de la reconnaissance vocale et de la vision, tiers figés, les deux postes inscrits au script de coût et au disjoncteur, garde par minute d'audio et par image |

**Pourquoi la voix pèse autant.** En cuisine ou sur un chantier, on n'écrit pas, on dicte (`05-ia.md`).
Un dirigeant qui reçoit des vocaux et ne peut ni les écouter ni les lire dans Relvo retourne sur
WhatsApp — et Relvo cesse d'être la surface où il agit.

**Ce qui ne bouge pas.** Un message vocal **est** un message (`02-modele-donnees.md`) : son
rangement n'attend pas la transcription, et le modèle ne lit jamais l'audio lui-même.
