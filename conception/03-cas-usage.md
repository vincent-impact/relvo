# 3. Cas d'usage

> **Ce document RACONTE, il ne TRANCHE pas.** Il décrit le **vécu** de l'utilisateur : ce qu'il
> ouvre, ce qu'il fait à la main, ce qui le surprendrait. Il n'est pas de rang 1.
>
> ⚠️ **Aucune machine à états n'est recopiée ici.** Les règles font foi dans
> [`04-design-domaine.md`](04-design-domaine.md), et **un désaccord se règle toujours en faveur
> de `04`**. Un cas d'usage qui redit une règle en plus court garantit la divergence.
>
> Les cas sont nommés par une lettre pour se citer en un mot. ⚠️ **Une lettre n'est jamais
> réattribuée**, même quand le cas disparaît.

---

## Cas A — Un message arrive

Karim écrit sur WhatsApp : *« Bonjour, la sauce blanche est en rupture chez notre
fournisseur. »*

**Ce que voit l'utilisateur.** Rien d'urgent. Le message est rangé dans la conversation « Karim
Benali », qui remonte en tête de la liste, avec une pastille de non-lu. Aucun sujet n'existe
encore.

**Ce qui pourrait le surprendre.** Rien ne s'est passé. C'est délibéré : le produit ne devine pas
qu'une affaire commence, et il ne fabrique pas un dossier pour chaque bonjour. Le rangement est
mécanique, l'interprétation viendra de lui — ou, plus tard, du pipeline.

---

## Cas B — Il décide que ça mérite un sujet

C'est **le geste fondateur du produit en V1**, et il porte à un endroit différent selon le canal.

### B1 — Sur une messagerie : le geste porte sur LE MESSAGE

L'utilisateur ouvre la conversation de Karim, remonte au message de la rupture — pas au dernier,
à **celui qui lance l'affaire** — et le fait glisser vers la droite.

Un sujet s'ouvre : « Remplacement sauce blanche ». À partir de ce message, tout ce que Karim
écrira dans ce fil alimentera l'affaire.

**Ce qu'il fait à la main.** Il choisit le message. C'est tout le travail, et c'est un travail
qu'il fait naturellement : il sait où l'histoire commence.

### B2 — Sur un e-mail : le geste porte sur LA CONVERSATION

Six e-mails ont déjà été échangés sur « Contrat maintenance climatisation ». L'utilisateur fait
glisser **la ligne de la conversation** vers la droite et choisit d'ouvrir un sujet.

Le sujet porte les **six** messages, pas seulement le dernier.

**Ce qui le surprendrait — et qu'il faut éviter.** Qu'un sujet ouvert sur un échange déjà nourri
n'en récupère que la dernière ligne. Il ouvre un sujet *parce que* l'échange a une histoire ; la
lui amputer serait absurde.

**Pourquoi il n'y a pas de geste équivalent sur une ligne de conversation de messagerie.** Le
proposer reviendrait à demander « veux-tu faire de ce groupe une affaire ? » — or un groupe n'est
jamais une affaire, c'est un collectif qui en charrie plusieurs.

---

## Cas C — Un message arrive pendant que le sujet est ouvert

Karim précise : *« Je peux te proposer une sauce algérienne en substitution. »*

Le message rejoint le sujet tout seul. L'utilisateur ne fait rien.

---

## Cas D — Deux affaires entrelacées dans le même fil

Karim alterne, dans la même conversation : la sauce blanche, puis la facture des emballages, puis
de nouveau la sauce.

**Ce qui se passe en V1.** Le sujet « Remplacement sauce blanche » récupère **tout** ce qui passe
dans la plage écoutée — y compris les messages sur la facture. Il y a du bruit.

**Ce que peut faire l'utilisateur.** Arrêter l'écoute, ouvrir un second sujet à partir du message
sur la facture, ou simplement vivre avec.

**Pourquoi ce renoncement est assumé.** Séparer des affaires entrelacées est exactement le
travail du pipeline IA. En attendant, **un peu de bruit dans un sujet vaut mieux qu'une interface
que personne ne comprend** — et on ne construit pas une mécanique manuelle sophistiquée pour six
mois en sachant qu'une machine la remplacera.

> C'est le cas le plus important de ce document, parce que c'est le seul qui décrit une
> **limite** plutôt qu'un chemin heureux. Il reviendra sur la table ; la réponse est dans
> `04 §13`.

---

## Cas E — Un message compréhensible, mais rien à faire

Le comptable écrit : *« La TVA du trimestre a bien été déclarée. »*

Un sujet peut s'ouvrir — l'utilisateur veut garder la trace — mais **aucune tâche n'est
proposée**. Relvo ne fabrique pas de travail pour justifier sa présence.

**Ce qui le surprendrait.** Une tâche « Prendre connaissance de la déclaration ». C'est le genre
de suggestion qui apprend à l'utilisateur à ignorer les suggestions.

---

## Cas F — Un message avec du travail dedans

Karim propose la substitution.

Relvo propose : « Confirmer ou refuser le remplacement », et prépare un brouillon de réponse.

**Ce que l'utilisateur ajoute lui-même.** « Appeler le shop de Montpellier », « Vérifier les
stocks de Béziers ». Relvo ne pouvait pas les deviner — il ne sait ni quels magasins sont
impactés, ni comment l'organisation est structurée.

**C'est le partage de travail typique du produit** : Relvo prend ce qui est déductible du texte,
l'utilisateur ajoute ce qui vient du terrain.

---

## Cas G — Relvo prépare une réponse

Le brouillon apparaît **dans la zone de rédaction**, identifié comme une suggestion. Il peut être
modifié, régénéré, effacé.

**Ce qui n'arrive jamais.** Qu'il parte tout seul. Le brouillon n'est pas un message tant qu'il
n'a pas été envoyé.

---

## Cas H — L'utilisateur envoie

Il modifie le brouillon et envoie. Le message part depuis **sa vraie adresse** et atterrit dans
ses envoyés ; il rejoint la conversation et le sujet ; la tâche de réponse se coche toute seule.

**Ce qui le surprendrait — et qui n'arrive pas.** Que le message parte d'une adresse générique
inconnue de son interlocuteur.

---

## Cas I — Il attend un retour

Une fois la réponse partie, le sujet passe « En attente ». Ce n'est pas un statut : l'affaire est
toujours ouverte, c'est simplement une information utile quand on parcourt sa liste.

---

## Cas J — Le tiers répond

Le marqueur « En attente » tombe, le sujet remonte, une pastille de non-lu apparaît sur la
conversation.

---

## Cas K — Il valide

Le travail est fait. L'utilisateur fait glisser le sujet vers la droite.

Relvo propose alors : « Souhaitez-vous aussi ignorer la conversation ? »

**Pourquoi cette question.** Sur une messagerie, valider suffit à faire taire le fil. Sur un
e-mail, non : le fil rouvrira le sujet au prochain message (cas W). Ignorer la conversation est
**le seul geste qui fasse taire un fil e-mail**, et l'utilisateur n'a aucune raison de le savoir
— d'où la proposition, au moment exact où elle est utile.

---

## Cas L — *supprimé*

L'archivage automatique après inactivité n'existe plus. La lettre n'est pas réattribuée.

---

## Cas M — Rattacher un fil à un sujet qui existe déjà

Le fournisseur répond, mais en changeant l'objet : « Re: Devis substitution » au lieu de
« Rupture sauce blanche ». Une nouvelle conversation apparaît, orpheline.

L'utilisateur la fait glisser vers la droite et choisit **« Rattacher à un sujet existant »**.

**Ce que ça résout.** Sans ce geste, un changement d'objet couperait l'affaire en deux dossiers,
et il n'y aurait aucun moyen de les recoller.

---

## Cas N — Écarter une conversation

Un groupe bavard, un démarcheur, un fil traité. L'utilisateur fait glisser la ligne vers la
gauche.

**Ce qu'il croit faire.** Sur un e-mail, il lit « Supprimer » et croit supprimer.

**Ce qui se passe vraiment.** Rien n'est détruit : la source est mise en pause, réversiblement.
L'e-mail est toujours dans sa boîte — Relvo n'en a qu'une copie — et tout ce qui a été construit
dessus reste.

**Pourquoi deux mots pour un seul mécanisme.** On « ignore » un groupe de messagerie qui continue
de parler ; on « supprime » un e-mail traité, parce que c'est le geste attendu de toute boîte
mail. Le mot juste n'est pas le même ; l'effet, si.

**Ce qui arrive avant, si le fil est suivi.** Une confirmation qui **nomme le sujet concerné**.
Jamais « un ou plusieurs sujets » : une confirmation qui n'apporte pas l'information qu'elle
réclame de valider se clique sans être lue.

---

## Cas O — *supprimé*

Le rattachement et le détachement message par message ont quitté l'interface. La lettre n'est pas
réattribuée.

---

## Cas P — Compléter une fiche contact

Un sujet s'ouvre sur un expéditeur inconnu : le contact est créé automatiquement, avec ce qu'on a
pu déduire — souvent un nom et une adresse. Il apparaît « à compléter » dans l'annuaire.

L'utilisateur y ajoute l'entreprise, un second numéro, l'adresse professionnelle. À partir de là,
**un message venu de ces coordonnées secondaires retrouve le bon contact**.

---

## Cas Q — Fermer un sujet

L'affaire n'avait pas lieu d'être, ou elle n'intéresse plus. Glissement vers la gauche.

Le sujet sort de la vue. Il n'est **pas** détruit, il n'est **jamais** purgé, et il se retrouve
dans les sujets fermés.

**Pourquoi le vocabulaire compte ici plus qu'ailleurs.** Un message supprimé par erreur existe
encore dans Gmail. Une **tâche** supprimée par erreur n'existe **nulle part ailleurs** — un sujet
est le seul endroit où vivent les tâches et les décisions.

---

## Cas R — Réactiver une conversation écartée

L'utilisateur va chercher le filtre « Ignorées », rouvre le fil, le réactive. Relvo recommence à
le traiter, à partir de maintenant.

**Ce qui le surprendrait.** Que « Réactiver » ne fasse rien de visible. C'est pourquoi écarter ne
pose jamais de borne de fin : sinon le bouton serait décoratif.

---

## Cas S — Étendre une affaire à un second canal

L'affaire a commencé sur WhatsApp. L'utilisateur veut envoyer un e-mail formel au même
fournisseur, sur le même dossier.

Depuis la fiche du sujet, il ajoute une conversation et écrit son e-mail : l'objet est
pré-rempli avec le titre du sujet.

Le sujet porte maintenant **deux** conversations — une écoute d'un côté, un fil entier de
l'autre. **C'est ici, et nulle part ailleurs, que se fait la réunification entre canaux.**

---

## Cas T — Remonter une écoute

L'utilisateur se rend compte que l'affaire avait commencé trois messages plus haut. Il fait
glisser **ce message-là** vers la droite.

L'écoute remonte jusqu'à lui ; les messages traversés entrent dans le sujet.

**Pourquoi c'est le même geste que l'ouverture.** Il n'a qu'une intention à exprimer,
« l'affaire commence ici », et elle ne change pas selon qu'un sujet existe déjà ou non. Une règle
au lieu de deux, et aucun dispositif de rattrapage à apprendre.

---

## Cas U — Reprendre la main sur les fils d'un sujet

Depuis la fiche du sujet, l'utilisateur voit la **liste** de ses conversations : icône du canal,
objet ou nom, extrait du dernier message, non-lus.

Il clique une ligne : la conversation s'ouvre dans son écran, **la seule surface où l'on lit et
où l'on répond**. Le bandeau d'en-tête rappelle dans quel sujet ce fil est suivi, et c'est là
qu'il peut le détacher, ou arrêter de l'écouter.

**Ce qui a été délibérément retiré.** Le fil ne s'affiche plus *dans* la fiche du sujet. Deux
endroits pour lire un même échange, c'est deux rendus à maintenir et deux occasions de diverger.

---

## Cas V — Remettre un sujet fermé

L'utilisateur retrouve le sujet dans les fermés et le remet.

**Ce qui ne se produit pas — et c'est important.** L'écoute ne redémarre pas toute seule. Un
sujet de messagerie remis après trois semaines **avalerait d'un bloc** tout ce que le fil a
charrié entre-temps.

« Remettre » dit *je reprends cette affaire*, pas *rattrape tout ce que j'ai manqué*. Pour
reprendre l'écoute, l'utilisateur désigne le message où il veut repartir — le geste du cas B1.

---

## Cas W — Un e-mail arrive sur un sujet déjà validé

Trois jours après avoir validé « Remplacement sauce blanche », Karim relance par e-mail sur le
même fil.

**Le sujet rouvre**, et il remonte dans la liste.

**Pourquoi c'est la bonne règle, concrètement.** L'alternative serait que le message se range en
silence dans un sujet validé — et l'utilisateur raterait exactement le message qu'il ne fallait
pas rater. Le statut dit ce qu'il *croyait* en le posant ; le message entrant dit ce qui *est*.
Quand les deux se contredisent, c'est le message qui a raison.

**Ce que ce cas n'est pas.** Ce n'est pas vrai sur une messagerie : là, la conversation n'est pas
l'affaire mais un flux qui charrie des affaires successives. Un message arrivé après l'arrêt
d'une écoute ne parle pas forcément de la même chose.

---

## Cas X — Une réponse depuis une autre adresse

Deux situations qui se ressemblent, et que l'utilisateur vit de façon opposée.

**Sophie répond « à nous seuls »** sur une affaire envoyée à Karim et Sophie. Elle est déjà
connue du sujet. Une nouvelle conversation apparaît — le cercle des destinataires a changé — et
elle est **rangée automatiquement dans le même sujet**. L'utilisateur ne fait rien et ne remarque
rien.

**Karim répond depuis une adresse jamais vue.** La conversation tombe **orpheline**.
L'utilisateur la rattache à la main, du geste du cas M.

**Ce qui pourrait sembler incohérent, et ne l'est pas.** Dans le premier cas, tout est vérifiable
sans deviner : l'objet est le même, et l'expéditeur est **déjà dans la liste**. Dans le second,
rapprocher les deux demanderait de parier sur une ressemblance — et un pari qui se trompe range
durablement un message au mauvais endroit, ce qui coûte bien plus cher qu'un rattachement manuel
de temps en temps.

---

## Ce que l'utilisateur ne fait jamais

Écrit ici parce que ce sont les gestes qu'on serait tenté d'ajouter.

- **Il ne trie pas message par message.** Il désigne un point de départ, ou un fil entier.
- **Il ne tape pas sur un message pour ouvrir un menu.** Le tap ouvre une pièce jointe, et rien
  d'autre. Un geste qui fait deux choses selon l'endroit exact où le doigt tombe est un geste
  qu'on n'ose plus faire.
- **Il ne valide pas les suggestions de Relvo.** Ouvrir le sujet suffit.
- **Il ne supprime rien.** Aucun geste courant du produit ne détruit de données.
