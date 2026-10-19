---
id: M22
public: true
ordre_public: 19
titre_client: Parler à Relvo
resume_client: >
  Dicter votre demande à Relvo plutôt que la taper : un appui sur le micro, vous parlez, le texte
  s'écrit et se corrige avant l'envoi. Pour la cuisine et le chantier, où l'on n'écrit pas.
statut: en-cours
debut: 2026-10-19
---

# M22 — Parler à Relvo

**Objectif** — la **voix comme entrée de l'échange** : on appuie sur le disque de dictée du
composer, on parle, la transcription se pose dans le champ, **on la relit et on la corrige**, on
envoie par le geste habituel. Le public dicte plus qu'il n'écrit (`05 §6.6`) ; l'échange est la
surface où Relvo agit : l'un sans l'autre laisse le téléphone dans la poche.
**Dépendances** : M10 (l'échange), M14.5 (la garde de coût, par minute d'audio).

> **Ce que « éditer un message vocal » veut dire ici.** La transcription est un **brouillon de
> texte**, pas un message : elle n'est envoyée que quand le dirigeant appuie sur Envoyer, après
> l'avoir lue. L'audio ne quitte pas l'appareil autrement que pour être transcrit, et n'est pas
> conservé — l'échange est éphémère (`05 §11.3`), sa voix aussi.

## Les possibilités de reconnaissance vocale

| Voie | Ce qu'elle donne | Ce qu'elle coûte | Verdict |
| ---- | ---------------- | ---------------- | ------- |
| **La dictée du clavier** (iOS, Android) | Déjà là : le micro du clavier écrit dans le champ, le texte se corrige. Pas de vocabulaire métier, qualité variable, rien à construire | 0 | **Reste disponible**, ne suffit pas comme geste du produit : il n'y a pas de disque de dictée, et le clavier doit être ouvert |
| **Web Speech API** du navigateur | Reconnaissance continue, gratuite ; Safari iOS la propose | 0, mais l'audio part chez Apple ou Google, et le comportement en PWA installée est inégal | Écartée : on ne construit pas un geste sur une API que l'un des deux téléphones cibles honore à moitié |
| **OpenAI, transcription de fichier** — `gpt-transcribe` (ou `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`) sur `/v1/audio/transcriptions` | On enregistre dans le navigateur, on envoie le fichier à la fin, le texte revient (en flux si on veut). **Un `prompt`, des mots-clés et la langue** (`fr`) : les noms des contacts et des affaires du compte s'y glissent, et la transcription les écrit juste | de l'ordre de 0,005 $ la minute, selon le modèle | **Retenue.** Simple, robuste, le vocabulaire métier est le vrai gain. La diarisation (`gpt-4o-transcribe-diarize`) est sans objet : un seul locuteur |
| **OpenAI, transcription en direct** — sessions Realtime (`gpt-live-transcribe`, ou `gpt-transcribe` en tours), WebSocket ou WebRTC | Le texte apparaît pendant qu'on parle | Plus cher, jeton éphémère par session, WebRTC à tenir sur iOS | **En réserve** : si la latence du mode fichier gêne à l'usage — une phrase de dix secondes se transcrit en une ou deux secondes, ce qui n'est pas une attente |

| #     | Item                                                                                                                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M22.1 | **Le coût et la qualité d'abord** : benchmark des modèles de transcription sur dix dictées en français avec et sans vocabulaire, coût par minute inscrit aux tarifs (`config.ts`), **tier « transcription »** du client d'inférence, mesure en secondes d'audio dans le journal (`ia:journal`) |
| M22.2 | **L'enregistrement dans le composer** : le disque de dictée de la direction artistique (`00-brief-da`), un appui pour parler, un appui pour finir, la durée qui s'affiche, la permission micro demandée **sur ce geste** ; `MediaRecorder` avec le format que le téléphone donne (iOS : `audio/mp4`) |
| M22.3 | **La transcription vers le champ** : une route de l'échange qui reçoit l'audio et rend le texte ; le texte **se pose dans le composer**, se corrige, et part par Envoyer — jamais envoyé seul ; l'échec se dit dans le composer (« je n'ai pas compris, réessayez ») |
| M22.4 | **Le vocabulaire du compte** : prénoms et entreprises des contacts, titres des affaires ouvertes, mots du secteur, passés en `prompt` et mots-clés — la couche Compte déjà assemblée, rien de nouveau à stocker |
| M22.5 | **La garde** : durée maximale d'une dictée, coût par minute au disjoncteur (M14.5), aucune transcription si l'assistant est coupé                                                                                                             |
| M22.6 | **Le même socle pour la messagerie** : M20.1 (dicter un message à un contact) réutilise l'enregistrement et la route, sans seconde implémentation                                                                                            |
| M22.7 | **En réserve — la transcription en direct** par une session Realtime, si l'attente du mode fichier se révèle gênante en usage                                                                                                                 |

⚠️ **Le micro en PWA installée sur iPhone est à éprouver le premier jour** : `getUserMedia` et
`MediaRecorder` s'y comportent autrement que dans Safari (permission redemandée, format figé,
enregistrement coupé quand l'écran s'éteint). Le benchmark de M22.1 se fait depuis le téléphone,
pas depuis un Mac.

⚠️ **Un bouton sans effet se retire** (`02-composants.md`) : le disque de dictée ne revient dans le
composer qu'avec M22.3 livré, pas avant.
