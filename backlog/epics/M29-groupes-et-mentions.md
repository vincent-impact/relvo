---
id: M29
public: true
ordre_public: 26
titre_client: Les groupes WhatsApp, et quand on vous y interpelle
resume_client: >
  Dans un groupe WhatsApp, une mention affiche enfin le nom de la personne, et Relvo réagit
  quand c'est vous qu'on interpelle : il lit ce qui précède, ouvre un sujet s'il le faut et vous
  pose la tâche. Les groupes que vous gardez sont lus deux fois par jour ; ceux qui ne sont pas
  professionnels sont écartés d'eux-mêmes.
statut: a-faire
---

# M29 — Les groupes et les mentions

**Objectif** — que les groupes WhatsApp cessent d'être un angle mort, sans que Relvo embarque
tout le bavardage d'une équipe. **Dépendances** : M6 (la messagerie), M7 (le tri, la relecture),
M25.9 (ignorer n'importe plus rien — c'est ce qui rend supportable de lire les groupes gardés).

**Pourquoi.** Les testeurs le remontent sans cesse : une mention s'affiche en identifiant à
quinze chiffres et ne pèse sur rien. Mesuré sur trente jours : 21 392 messages dans 588 groupes
actifs, dont 3 portent un sujet ; 1 848 messages mentionnent quelqu'un. Or on mentionne
quelqu'un pour lui demander quelque chose. Décision et mesures : `ecarts`, « Ignorer veut dire
ne plus importer ; un groupe se lit sur mention et deux fois par jour ».

**Ce qui ne change pas.** Un groupe ne crée jamais de contact et n'a pas d'interlocuteur
(`05`). Son nom ne fait pas un sujet (`04`). Une conversation ignorée n'est ni lue ni importée,
mention ou pas. Un sujet validé ou fermé libère la conversation. Aucun média de groupe n'est
téléchargé hors de ce qu'un sujet porte (M25).

**Ce que l'agrégateur donne, vérifié sur un groupe du dirigeant.** Le texte porte la mention
sous la forme `@<LID>` (parfois `@<numéro>`) ; le webhook n'a aucun champ de mention et le champ
`mentions` de l'API revient vide ; la liste des participants d'un groupe donne pour chacun le
LID, le numéro, le nom et `is_self` ; un message qui en cite un autre porte l'auteur du message
cité (`quoted.sender_id`). La forme d'une mention « à tout le groupe » n'a pas été observée.

| #     | Item | État |
| ----- | ---- | ---- |
| M29.1 | **L'annuaire des identifiants** : par canal de messagerie, « identifiant interne → numéro, nom, c'est moi », nourri par l'expéditeur de chaque message reçu (le webhook porte déjà les deux) et complété par la liste des participants du groupe à la première mention inconnue ; le texte stocké ne change pas, la mention se résout à la lecture — les messages déjà en base s'affichent juste sans reprise | ⬜ |
| M29.2 | **La mention se lit** : « @Dahmani Eya » au lieu des chiffres dans le fil, « @vous » en violet ; un message de groupe sait à la réception s'il mentionne le dirigeant (déterministe, sans modèle) ; la liste des conversations marque un groupe où il est mentionné sans l'avoir lu | ⬜ |
| M29.3 | **Le groupe se juge à sa découverte** : un appel, sur le titre, le nombre de membres et les premiers messages — personnel, publicité, automatique : ignoré avec sa raison ; sinon à traiter. Les groupes déjà connus sont jugés une fois, par lot, au tarif différé | ⬜ |
| M29.4 | **Le tri sur mention** : une mention du dirigeant dans un groupe à traiter déclenche aussitôt la lecture du contexte proche (les messages qui précèdent, le message cité). Si le groupe n'est attaché à aucun sujet, le modèle dit si un sujet s'ouvre ou se rattache ; s'il s'ouvre, il porte **une tâche pour le dirigeant**. Si un sujet écoute déjà le groupe, on ajoute seulement la tâche. Le modèle rédige la tâche ; qu'il puisse répondre « rien n'est attendu » sur une mention de politesse est **proposé, à confirmer** | ⬜ |
| M29.5 | **La lecture deux fois par jour** : les groupes à traiter qui ont reçu des messages sans sujet depuis la dernière lecture sont lus par lot, au tarif différé — ouvrir, rattacher, ne rien faire, ou ignorer le groupe. ⚠️ Deux crons au plus (`vercel.json` en porte déjà deux, à 2 h et 6 h UTC) : la lecture se greffe sur eux, et l'horaire de l'un se déplace vers la mi-journée — jamais un troisième | ⬜ |
| M29.6 | **L'écoute d'un groupe** : un sujet ouvert sur un groupe l'écoute comme un fil direct, jusqu'à sa validation ou sa fermeture, qui libère le groupe ; la relecture reçoit le signal « le dirigeant est mentionné » | ⬜ |
| M29.7 | **La réponse qui cite un message du dirigeant** vaut mention — seconde tranche, après l'usage des premières | ⬜ |

**Écarté** : la salve pour les groupes (les membres se relaient, elle ne se termine pas) ;
« mention = urgent » (l'urgence se juge au contenu) ; réveiller un groupe ignoré sur une mention.

**À mesurer en livrant** : la part des mentions qui visent le dirigeant (inconnue tant que son
identifiant n'est pas dans l'annuaire) et le coût mensuel des deux lectures par compte, contre
le plafond d'inférence.
