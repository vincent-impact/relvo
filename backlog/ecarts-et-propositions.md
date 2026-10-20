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
3. **Le sous-typage** — l'e-mail porte un _set_ de destinataires, la messagerie un interlocuteur.

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
réception que le dirigeant a déjà ailleurs — on lui _ajouterait_ du travail au lieu de lui en
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

### Une page de suivi client alimentée par le dépôt

**`tranché`** · Le client veut savoir où en est le projet et ce qui a changé dans son
application. Trois contraintes : aucune base de données, les fichiers du dépôt comme source, et
**aucun effort de rédaction récurrent**.

**Le piège identifié d'emblée** : brancher la page sur le backlog tel quel exposerait des risques
assumés, des décisions renversées, des périodes d'arrêt et des coûts de fournisseurs. La valeur
interne de ces documents et leur toxicité externe sont **la même propriété**. Pire : une fois le
backlog lu par le client, on commencerait à l'écrire pour lui — et le registre honnête mourrait.

**Solution retenue : une liste blanche par champ structuré.** Le générateur lit le frontmatter et
le journal des versions, jamais le corps d'un fichier. La garantie est **mécanique** : une phrase
écrite dans un corps ne peut pas fuir. Une liste noire à base de marqueurs aurait échoué au
premier oubli de balise.

**Le journal vient des commits**, filtrés sur `feat` et `fix`, avec un pied de message `Client:`
facultatif. **Rédigé par Claude Code**, donc à coût marginal nul — c'est ce qui rend le dispositif
réellement automatique.

> ⚠️ **Point de vigilance retenu contre le précédent le plus proche.** PostHog, dont tout le
> manuel interne est du markdown versionné et public, a **quand même** construit une application
> séparée pour son roadmap public. La séparation entre registre interne et vue client n'est pas
> une précaution excessive : c'est la pratique de ceux qui sont allés le plus loin en
> transparence.

### Aucune date au jour sur un chantier non commencé

**`tranché`** · La frise client positionne le futur **au mois**, jamais au jour, et le dit
explicitement au lecteur.

**Ce qui a tranché** : le calendrier de planification tenu dans un outil tiers plaçait le pipeline
IA en juin-juillet ; début septembre, il n'avait pas commencé. Une frise datée branchée dessus
aurait affiché un retard de deux mois en permanence. **Une roadmap datée devient un engagement
dans la tête du client**, et elle se paie au premier décalage.

Corollaire : la frise est alimentée par le **réel** — dates de clôture effectives — et non par la
planification.

### Deux systèmes d'identifiants pour les mêmes épiques

**`tranché`** · Le dépôt disait `M1…M14`, l'outil de suivi personnel disait `RVO-1…RVO-14`.
Le dépôt l'emporte : c'est la source la plus crédible, celle que le code cite. **Le client, lui,
ne voit aucun identifiant** — un chantier est identifié par son titre métier. Le `M-n` reste dans
le frontmatter comme clé de jointure.

---

### Le choix des modèles est un choix de gamme, pas de fournisseur

**`tranché`** · Le benchmark des fournisseurs IAG ([`benchmark-iag.md`](benchmark-iag.md))
concluait d'abord à un écart de 6 entre une pile Anthropic et une pile DeepSeek. C'était une
erreur de lecture : l'affectation par tiers de `conception/05-ia.md` §10.5 est une hiérarchie
**Anthropic**, et elle avait été transposée telle quelle chez OpenAI en prenant les modèles
moyens et hauts comme équivalents. Or le modèle d'entrée de gamme d'OpenAI n'a pas d'équivalent
dans la gamme Anthropic : il est moins cher que le plus petit Claude tout en obtenant un meilleur
index.

À gamme comparable, l'écart entre fournisseurs occidentaux et fournisseurs à bas coût se referme
presque entièrement. **La décision porte donc sur le tier, et le fournisseur se choisit ensuite
sur les caractéristiques techniques**, pas sur le prix.

**Retenu** : le tier d'entrée de gamme sur toute la chaîne, avec une seule exception —
l'analyse de document, où le PDF natif texte+image justifie un modèle supérieur.

### La sortie structurée ne tourne jamais sur un modèle sans schéma strict

**`tranché`** · A2–A6 et A7 écrivent en base sans revue humaine. Un fournisseur qui ne garantit
pas la conformité au schéma impose une boucle de validation et de reprise.

**Le chiffrage montre que cette boucle coûte plus cher que l'écart de prix avec un modèle qui
garantit le schéma** : une pile qui réserve l'extraction structurée à un modèle à schéma strict
est moins chère qu'une pile homogène à bas coût. Le résultat tient tant que le taux de reprise
dépasse environ 4 %.

Ce n'est donc pas un arbitrage entre qualité et prix : les deux vont dans le même sens.

### La conformité RGPD n'est pas un critère de sélection du fournisseur

**`tranché`** · Le prix et la qualité de service priment. Les fournisseurs ne sont plus écartés
sur ce motif ; l'analyse reste consignée dans [`benchmark-iag.md`](benchmark-iag.md) §1 et §9 à
titre d'information.

**Ce que la décision n'annule pas** : la couche d'abstraction par tier reste exigée, parce
qu'elle est ce qui rend la décision réversible sans refonte.

**Constaté à l'ouverture du compte (2026-09-14)** : la résidence européenne chez OpenAI n'est
**pas en libre-service**. Le sélecteur de région n'apparaît qu'aux organisations qu'OpenAI a
rendues éligibles après une demande commerciale, une approbation de surveillance des abus et un
avenant de rétention. Le projet Relvo est donc « Global », et c'est conforme à cette décision.
Le point d'entrée de l'API est en configuration : si l'éligibilité est accordée un jour, le
projet se recrée avec la région (elle ne s'ajoute pas après coup) et une variable change.

### Un disjoncteur de consommation par compte, avant la mise en production

**`tranché`** · Aucun compte ne doit pouvoir faire exploser la facture, ni par usage atypique, ni
par bug, ni par boucle d'outils dans l'échange avec Relvo.

Mesure en **euros** et non en tokens — une table de tarifs versionnée convertit les tokens à
l'enregistrement, ce qui survit à un changement de modèle. Trois seuils par compte et par mois :
alerte, dégradation de gamme, puis coupure des sollicitations automatiques. Plus une garde en
**vitesse** (consommation journalière anormale), des plafonds par appel et par tour, et un
plafond de dépense sur la clé du fournisseur — seul garde-fou qui tienne si le compteur
applicatif est lui-même en cause.

**Ce qui rend la coupure peu coûteuse à construire** : elle ne crée aucun mode de défaillance
nouveau. Le rangement d'un message entrant étant déterministe et sans IA, la coupure laisse
simplement les conversations orphelines — état déjà prévu, déjà compté dans le KPI « Sans sujet »,
déjà traitable à la main. **Le mode dégradé du disjoncteur est le mode nominal de la V1.**

**Conséquence commerciale** : suppose un forfait de messages inclus par siège, annoncé au client.

**Cadre arrêté pour la bêta** (dirigeant, 2026-09-20) : abonnement à 59 € TTC par mois et par
siège (49 € HT) ; l'agrégateur coûte environ 5 € par compte connecté (e-mail et messagerie) —
poste à remplacer un jour pour la marge, facile pour l'e-mail, bien plus difficile pour
WhatsApp ; **l'inférence est plafonnée à 20 € par mois et par compte**. C'est la valeur que
M14.5 posera en seuil de coupure, avec l'alerte et la dégradation en deçà. Le plafond de
dépense sur la clé du fournisseur est posé à 100 € par mois pour toute l'organisation. À
l'usage mesuré (`benchmark-iag.md` §6), un compte ordinaire reste très loin des 20 € : le
seuil protège contre l'anormal, pas contre l'usage.

### Pile IAG : un seul fournisseur, son entrée de gamme

**`tranché`** · GPT-5.6 Luna sur la classification, l'extraction structurée et la rédaction ;
GPT-5.6 Terra sur l'échange avec Relvo complexe et l'analyse de document. **Un seul fournisseur.**

**Ce qui a porté la décision** : une seule API, un seul format d'outils, un seul SDK à apprendre
sur une V1 développée seul — et un modèle d'entrée de gamme qui garantit le schéma JSON et
accepte les fichiers en entrée, ce qui ôte le besoin d'une exception sur un second fournisseur
pour les pièces jointes.

**Ce qui est assumé** : le modèle retenu est l'entrée de gamme du fournisseur. Son score
d'intelligence publié est mesuré à un niveau de raisonnement maximal, qui ne sera pas celui de la
production. Aucune donnée publique n'existe sur sa qualité en français. **C'est le pari de cette
décision**, et il se tranche par le jeu d'évaluation maison, pas par un classement. Le recours
est peu coûteux : basculer le seul tier d'extraction structurée vers le modèle supérieur coûte
quelques euros par mois et par compte, pas dix fois le prix.

### Pas de passerelle d'inférence : l'API du fournisseur est appelée en direct

**`tranché`** · La conception prévoyait une passerelle d'inférence hébergée par la plateforme de
déploiement, pour l'observabilité par appel et la bascule de fournisseur sans toucher au code.
Écartée : avec un seul fournisseur, elle n'apporte que ce que son tableau de bord offre déjà
(usage par clé, plafond de dépense), elle exige un moyen de paiement supplémentaire sur la
plateforme, et surtout elle **ne permet pas de choisir le point d'entrée du fournisseur** — or la
résidence européenne d'un projet, si elle est accordée un jour, ne vaut que si les requêtes
partent vers le point d'entrée européen. Le seul coût d'inférence accepté est la facture du
fournisseur ; la plateforme n'est payée que pour l'hébergement.

**Ce que la décision conserve** : la couche d'abstraction par tier, qui reste ce qui rend un
changement de fournisseur possible sans refonte — le fournisseur est instancié en un seul
endroit. Et l'observabilité par sollicitation, qui vient du journal de Relvo, pas d'un
intermédiaire.

### Le niveau de raisonnement se pose explicitement à chaque site d'appel

**`tranché`** · Les jetons de raisonnement sont facturés au tarif de **sortie**, et le défaut de
l'API est un niveau intermédiaire. Laisser ce défaut **multiplie la facture par 2,2** et dégrade
la latence dans des proportions incompatibles avec une conversation.

**Règle** : aucun appel ne part sans un niveau de raisonnement explicite. Classification :
aucun raisonnement — une classification de domaine se reconnaît, elle ne se raisonne pas.
Extraction structurée et rédaction : minimal. Échange complexe et analyse de document :
intermédiaire.

**Conséquence pour le disjoncteur** : les jetons de raisonnement sont comptés **séparément** des
jetons de sortie. Un site d'appel dont le niveau a dérivé se voit dans ce compteur avant de se
voir sur la facture.

### Le tri tourne sur l'entrée de gamme sans raisonnement — provisoire

**`proposé`** · Premier passage du jeu d'évaluation (`benchmark-iag.md` §6.6), sur le jeu de
démonstration : sur le tri, le modèle d'entrée de gamme sans raisonnement rend les mêmes verdicts
que le même modèle avec raisonnement faible, et que le modèle supérieur, pour dix fois moins cher
que ce dernier. L'écart observé sur les domaines tient à des domaines sans description, pas au
tier.

**Retenu, à titre provisoire** : tri sur l'entrée de gamme à effort `none`. Le niveau retenu de
la conception (`05 §10.5`, extraction à effort minimal) reste la valeur de configuration tant que
le jeu réel n'a pas confirmé ; la bascule se fait par la configuration du tier, sans code. Ce qui
tranchera : le même passage sur trente à cinquante e-mails réels anonymisés.

### L'assistant s'active par un réglage du compte ; l'administration viendra avec le backoffice

**`tranché`** · Le pipeline ne tourne que pour les comptes où l'assistant est activé. La
première version de cet interrupteur était une colonne sans écran, à basculer en base. Écarté :
**on ne touche jamais à la base directement** — tout changement d'état passe par une méthode
du domaine, journalisée, que l'interface comme les outils d'exploitation appellent.

**Retenu** : un champ unique sur le compte, `assistant_enabled`, qui gouverne **tout** ce que
Relvo fait de lui-même — pas seulement le tri —, réglé par l'utilisateur dans Réglages ›
Préférences (« Assistant Relvo »). Un administrateur doit pouvoir **couper l'usage d'un compte
à tout moment** : ce sera la même méthode, depuis un backoffice qui n'est pas encore construit
— faute de temps, pas de doute sur le besoin. En attendant, le plafond de dépense sur la clé du
fournisseur reste la garde de dernier recours.

### Frontières de confiance et verdict « incertain » — réglées par défaut, à confirmer en usage

**`proposé`** · `05 §1.1` place la frontière « entre moyenne et basse » et la fait régler sur le
jeu d'évaluation. Le jeu de démonstration ne la règle pas : sur les 22 fils, le tri rend **22
verdicts en confiance haute, 0 moyenne, 0 basse, 0 incertain** — les cas synthétiques sont
trop nets pour faire hésiter le modèle. Aucun chiffre ne justifie donc de placer la frontière
ailleurs que là où la conception la met.

**Retenu, à titre provisoire** : un sujet s'ouvre (ou se rattache) quand le verdict est
« affaire » **et** la confiance est **haute ou moyenne** ; en confiance basse, seul le verdict
est écrit sur la conversation, raison visible dans la liste à trier. Le verdict « incertain »
est traité comme une confiance basse : verdict écrit, rien d'autre — c'est le renvoi au
dirigeant, pas un échec.

**Tranché le jour même, à l'essai sur le premier e-mail réel** : un verdict « bruit » en confiance
**haute** met la source en sourdine — la conversation passe en ignorée, catégorie pour raison,
phrase pour note, acteur Relvo, réversible d'un appui. La première version laissait tout bruit
dans « Sans sujet » avec sa pastille ; le produit a tranché l'inverse : « trier, c'est aussi faire
disparaître ce qui n'a pas à être là ». En confiance moyenne ou basse, le verdict seul est écrit.
Le seuil d'ignorance est une seconde constante, au même endroit que la première.

**Ce qui tranchera** : le journal des premiers usages réels — verdicts rendus, confiance,
gestes de confirmation ou de contradiction — relu après quelques semaines. Deux signaux à
surveiller : des sujets ouverts en confiance moyenne que l'utilisateur ferme aussitôt
(frontière à relever à « haute »), ou des « incertain » nombreux qui finissent tous en sujet
(les traiter comme une affaire en confiance moyenne). La frontière est une constante du code,
en un seul endroit, testée.

### Un seul résumé sur la fiche, plus court que le message

**`tranché`** · Le premier sujet structuré en production portait un résumé plus long que
l'e-mail, avec un bouton « voir plus », qui répétait les tâches ; à côté, un « Descriptif » vide
attendait l'utilisateur ; le domaine venait après. Le dirigeant a demandé un résumé qui
accélère la lecture, pas qui la remplace.

**Retenu** : un résumé est **une phrase, deux au plus**, qui dit de quoi il s'agit et jamais ce
qu'il y a à faire — les tâches vivent dans leur onglet. La fiche n'a qu'**un** champ « Résumé »
: la description de l'utilisateur, sinon le résumé de Relvo avec sa pastille ; corriger reprend
le texte affiché, et la version de l'utilisateur l'emporte. La **prochaine étape** et son
échéance s'affichent dessous ; « où on en est » et « on attend » restent des champs que Relvo
relit, sans écran. Domaine et urgence passent en tête : de quoi on parle, avant tout.

**Écarté** : deux blocs (Relvo et utilisateur) côte à côte, et un résumé en quatre lignes
étiquetées — l'étiquette à gauche perdait la largeur d'un téléphone.

### La fiche du sujet, c'est le résumé et les tâches ; l'avis de tri s'efface quand un sujet suit le fil

**`tranché`** · Deuxième relecture en production, le même jour. Les tâches vivaient dans un
onglet : pour voir ce qu'il reste à faire, il fallait un geste de plus, et la « prochaine
étape » de Relvo sur la page principale répétait la première tâche. Dans le fil, l'avis de tri
restait en tête d'une conversation déjà suivie, et se lisait comme un résumé figé, portant
sur le premier message seulement, redondant avec celui du sujet.

**Retenu** : la page principale du sujet porte le domaine et l'urgence, le résumé, puis **les
tâches** ; la prochaine étape n'est plus affichée (Relvo la garde pour la relecture et la
relance) ; le journal devient le dernier onglet. L'**avis de tri** n'est pas un résumé : c'est
un verdict daté, rendu à l'arrivée du fil, qui sert à confirmer ou contredire Relvo. Il ne
s'affiche que sur un fil **sans sujet** ou **ignoré**, dans la liste comme en tête du fil ; un
fil suivi n'a que son bloc « Suivi dans » — sa mémoire vivante est le résumé du sujet, et
l'avis reste dans le journal.

**Écarté** : un résumé de conversation entretenu par Relvo. Deux mémoires au même endroit
divergent ; la situation du sujet est la seule que Relvo relit (05 §1.6).

**Au passage** : la structuration ne complétait pas le contact automatique, pour deux raisons
cumulées — la fiche passée au modèle le présentait comme connu, et l'hygiène du message avait
retiré la signature, là où sont le nom et l'entreprise. La fiche dit désormais qu'elle est
automatique, et porte la signature du dernier message, extraite avant l'hygiène.

### « Répondre » sur une tâche : le brouillon se rédige à l'appui, l'envoi coche la tâche

**`tranché`** · Le dirigeant a demandé que les tâches qui appellent une réponse proposent une
action directe : un appui qui mène à la conversation avec le brouillon déjà rédigé. C'est M7.7
et M7.10 reliés à un geste, et la tranche 7 est passée avant la 6 pour cela.

**Retenu** :

- **Une tâche « se répond »** quand elle s'accomplit par un message au contact — réponse ou
  décision à communiquer — et qu'un fil sait la porter : celui du message qui l'a fait naître,
  sinon celui que le sujet écoute. Elle porte alors un bouton « Répondre », qui ouvre ce fil,
  seule surface de réponse, avec la zone de rédaction.
- **Le brouillon se rédige à l'appui**, pas à la création de la tâche : on ne paie que ce qu'on
  ouvre. Un brouillon ouvert est repris ; « régénérer » l'annule et en rédige un autre ;
  « effacer » l'annule. Il se pose dans le champ, étiqueté comme une suggestion modifiable,
  et n'est jamais envoyé seul.
- **Une décision non prise ne bloque pas** : le brouillon pose le cadre et laisse le choix
  entre crochets. Relvo ne décide jamais à la place du dirigeant.
- **L'envoi règle les tâches, sans appel** : dans la transaction du message sortant, la tâche
  dont le brouillon est parti est cochée quel que soit son type, et toute tâche de réponse
  ouverte du sujet l'est aussi ; le brouillon passe « exécuté » ; « En attente » se pose s'il
  ne reste aucune tâche, et se lève au message entrant suivant. C'est le seul endroit où ces
  règles vivent, pour tous les points d'entrée.

**Écarté** : un brouillon préparé à la structuration, d'avance, pour toutes les tâches de
réponse — la majorité ne serait jamais ouverte ; et une complétion des tâches de décision sur
n'importe quel envoi — seul le message parti de leur brouillon les règle.

### Trancher un choix d'un appui, relire la situation, lire les tâches comme un fil

**`tranché`** · Second essai réel de la relecture, sur le scénario complet — devis, imprévu,
décision, clôture. Trois retours du dirigeant.

- **Le pire moment du parcours était le crochet** : « [recommander la bonne pièce / remplacer
  la friteuse par le modèle neuf] » à réécrire au clavier, sur téléphone. Poser la question
  avant d'ouvrir le brouillon ne convient pas : il faut avoir lu le message pour comprendre ce
  qu'on demande. **Retenu** : le choix se tranche dans le texte, d'un appui — le curseur posé
  dans un crochet fait apparaître ses options en puces au-dessus du champ, plus « Réécrire »
  qui retire le crochet ; un appui sur « N choix à trancher » sélectionne le suivant. Le champ
  reste un textarea natif : on ne réimplémente pas un éditeur pour un menu.
- **Sur un sujet long, le résumé ne suffit plus**, et « En attente » ne disait pas de quoi.
  **Retenu** : la situation structurée revient sur la fiche, sous le résumé, en trois lignes
  sourdes — où on en est, prochaine étape, ce qu'on attend et pour quand. Elle avait été
  retirée quand la prochaine étape répétait la première tâche ; sur un sujet qui a vécu, elle
  est ce qui permet de reprendre le fil. C'est la mémoire que Relvo relit, montrée telle
  quelle.
- **Les tâches se lisent comme un fil** : la plus récente en tête — par échéance, sinon par
  date de création —, terminées comprises. Relire les tâches doit aider à s'y retrouver.

**`tranché`** (le lendemain) · Comment présenter les choix à faire, et faut-il les retenir ?
Le choix dans le texte n'a pas tenu un essai de plus : voir « Les décisions d'un message
deviennent un formulaire ».

### Le choix figé, et la dernière tâche cochée règle le sujet

**`tranché`** · Le même jour, après le second essai.

- **Le rappel d'un choix en une coche et un libellé « flottait »** dans le fil. La représentation
  était trop simple : le rappel redevient **la carte du formulaire, figée** — fond Relvo, la
  question, les options telles qu'elles avaient été proposées, celle retenue pleine avec sa
  coche, rien de tapable. On défilera un fil pour retrouver ce qui a été décidé, et avec quoi on
  l'a comparé. L'état replié avant l'envoi est la même carte, avec « Changer ».
- **Cocher à la main la dernière tâche d'un sujet en attente ne changeait rien** : ni l'attente
  levée, ni la clôture proposée. C'est mécanique, sans appel au modèle : la tâche est reliée au
  statut (`conception/04-design-domaine.md` §10). La limite est dite : si la tâche cochée n'avait
  rien à voir avec l'attente, « pas encore » retire la suggestion d'un tap. Relvo qui coche en
  relecture ne déclenche pas la mécanique, sa relecture décide.

### Le rattrapage du courrier récent : trente jours, en lot, sous plafond

**`tranché`** · Tranche 9 du sprint M7 (M7.19), avec le dirigeant.

- **L'historique est synchronisé à la connexion d'un canal e-mail.** L'arbitrage antérieur
  « nouveau courrier seulement » — une option passée à l'agrégateur, jamais consignée ici —
  est levé : sans historique, il n'y a rien à rattraper, et le rattrapage est la démonstration
  que les clients réclament. Le rattrapage borne lui-même sa fenêtre : **trente jours**, assez
  pour voir les affaires en cours et proposer des domaines.
- **Un plafond dur par rattrapage : trois cents messages et deux euros**, au-delà desquels Relvo
  s'arrête et le dit. Tient dans les vingt euros mensuels d'un compte même à plusieurs canaux ;
  c'est le cas « import massif » du disjoncteur, borné avant qu'il n'existe (M14.5). Trois nuits
  au plus sur un même rattrapage ; ce qui reste ensuite se trie à la main ou au fil de l'eau.
  **Révisé par la tranche 10** : voir « La première lecture est large ».
- **Le niveau de service « flex » plutôt que la file de lots du fournisseur.** Même remise de
  moitié, mais zéro mécanisme nouveau : un message rattrapé suit exactement le chemin d'un
  message reçu, tri puis structuration, avec une seule option de plus sur l'appel. Le compteur
  applique la remise (`benchmark-iag.md` §6.11).
- **Exécuté la nuit par un cron**, pas à la volée : la connexion demande, la nuit exécute, le
  matin montre — une ligne sous le canal dans Réglages. Un message d'historique qui arrive par
  le webhook pendant la synchronisation est rangé mais laissé à la nuit : jamais trié plein
  tarif à contretemps. **Révisé le jour même** : voir « Le rattrapage commence à la connexion,
  pas la nuit ».
- **E-mail seulement.** Le tri de WhatsApp message par message n'existe pas encore (A8) ; le
  rattrapage de la messagerie viendra avec lui.
- **Ce que la tranche ne fait pas** : la suggestion de créer un domaine quand plusieurs sujets
  partagent la même proposition (M17.10) — les propositions existent dès le matin, l'encart qui
  les regroupe est M17.

### Le rattrapage commence à la connexion, pas la nuit

**`tranché`** · Avec le dirigeant, le jour même de la livraison de la tranche 9. Révise
l'exécution nocturne consignée dans « Le rattrapage du courrier récent : trente jours, en lot,
sous plafond » ; les plafonds, la fenêtre, le niveau « flex » et le périmètre e-mail ne bougent
pas.

- **Le moment juste est la connexion.** Un dirigeant qui vient d'installer Relvo veut voir ses
  sujets dans les minutes qui suivent ; attendre la nuit rate la première impression, qui est
  aussi la démonstration attendue. La nuit avait deux motifs : le niveau « flex » tolère une
  latence libre — vrai à toute heure — et l'agrégateur met quelques minutes à synchroniser
  l'historique — ce que la reprise par tranches rend inoffensif.
- **Un travail de fond par tranches, pas un appel synchrone.** Une fonction serverless vit
  quelques minutes ; trois cents messages en lot en demandent vingt. La connexion lance la
  première tranche ; chaque tranche importe ce qui est synchronisé, trie du plus récent au plus
  ancien et enchaîne la suivante ; deux tranches vides de suite closent la ligne. Le compteur de
  nuits devient un compteur de tranches.
- **Le courrier vivant reste temps réel.** Le webhook trie chaque e-mail à réception, comme
  avant ; la règle qui laissait à la nuit un message d'historique disparaît — la tranche en
  cours le ramasse, ou le fil de l'eau le trie s'il n'y a plus de rattrapage ouvert.
- **Le cron devient un filet.** Un passage quotidien reprend une ligne restée ouverte parce
  qu'une tranche est morte sans relancer la suivante ; il ne fait rien dans le cas normal. Le
  dirigeant le jugeait inutile comme mécanisme principal — il l'est ; comme filet, il coûte trois
  fichiers déjà écrits.
- **La messagerie héritera de la mécanique.** WhatsApp, au flux bien plus dense, se lira par
  paquets plutôt que message par message ; ce sont ces tranches en lot qui y serviront.
- **Pas avant la présentation du produit** du jour : la tranche 9 reste en production telle que
  livrée, nocturne ; la révision est la tranche 10 du sprint M7.

### La première lecture est large : quatorze jours, le garde-fou loin au-dessus d'une boîte

**`tranché`** · Tranche 10 du sprint M7 (M7.19), avec le dirigeant. Révise les plafonds
consignés dans « Le rattrapage du courrier récent : trente jours, en lot, sous plafond » ; le
mécanisme par tranches de « Le rattrapage commence à la connexion, pas la nuit » est livré ici.

- **La première lecture convainc au premier usage : on ne la bride pas, on la mesure.** Les
  trois plafonds de la tranche 9 — trois cents messages, deux euros, trois nuits — arrêtaient une
  boîte réelle avant la fin. Le garde-fou devient **cinq mille messages et dix euros** par
  rattrapage, plus cent vingt tranches comme coupe-circuit de boucle : aux coûts mesurés au
  niveau standard, cinq mille messages lus en entier coûtent deux à quatre euros ; un rattrapage
  qui atteint dix euros est un emballement, pas une boîte. Le journal d'inférence mesure ce que
  la première lecture coûte sur le compte du dirigeant — la première mesure réelle que le dépôt
  attend (« Mesurer le compte réel du premier utilisateur »).
- **Quatorze jours, pas trente.** Les tranches trient du plus récent au plus ancien : la
  première impression est la même, la fenêtre ne décide que de la queue, et la queue de la
  troisième et quatrième semaine est plus souvent réglée qu'en cours — ouverte par Relvo, elle
  ressemble à du bruit au moment où le dirigeant juge le produit. Ce qu'il manquerait (un devis
  de trois semaines sans réponse, en bâtiment) passe par une porte, la réponse « Lisez deux
  semaines de plus » de la question de fin de lecture (M13.2), qui ouvre un second rattrapage sur
  les jours quatorze à vingt-huit.
- **Standard en direct, « flex » la nuit.** Le dirigeant regarde : les tranches lancées par la
  connexion trient au niveau de service standard, deux fois plus vite. La nuit reste pour ce qui
  dépasse le garde-fou : le cron reprend une ligne arrêtée au plafond au niveau « flex », à
  moitié prix, avec le même garde-fou compté par nuit, trois nuits au plus.
- **L'historique se reconnaît à la date de la demande.** La règle des six heures du webhook
  disparaît : un message daté d'avant la demande d'un rattrapage ouvert est laissé à la tranche ;
  tout autre message est trié à réception. Le courrier vivant n'attend jamais.
- **Une tranche à la fois par ligne**, par un verrou en base pris en une mise à jour
  conditionnelle ; une tranche morte expire et la suivante la reprend. Une page qui voit une
  ligne en panne la relance ; le cron n'est qu'un filet. La clôture « courrier épuisé » attend
  deux passes d'import vides espacées d'au moins dix minutes, parce qu'on ignore en combien de
  temps l'agrégateur synchronise l'historique.
- **Le cache se chauffe avant le parallélisme** (`PITFALLS.md` #49) : la première conversation
  d'une tranche se trie seule, les suivantes trois par trois.

### Le fil WhatsApp direct se trie à réception, par salve ; les groupes attendent

**`tranché`** · Tranche 11 du sprint M7 (M7.4 côté messagerie), avec le dirigeant. Lève la
réserve « e-mail seulement (A8) » des entrées précédentes pour les conversations WhatsApp
**directes** ; les mentions qui la portent restent, elles datent une décision.

- **Les conversations directes seulement.** Un groupe WhatsApp n'est jamais trié
  automatiquement : c'est le « groupe bavard », l'écoute s'y pose à la main depuis la fiche. Au
  client, c'est un choix à présenter, pas un manque.
- **La salve se laisse arriver.** WhatsApp envoie trois messages en trente secondes ; un tri sur
  le premier ne verrait qu'une ligne et le suivant coûterait un tour pour « ok merci ». Le tri
  d'un message attend **quarante-cinq secondes** après la réponse du webhook, puis ne se joue que
  si ce message est toujours le dernier entrant de la conversation — sinon il s'efface, à zéro
  jeton, et le webhook du message suivant porte le tri. Une salve, un tour. Le webhook de
  messagerie passe à deux minutes de budget.
- **L'affaire écoute depuis le début de la salve.** L'ancre est le plus ancien message orphelin
  parmi ceux que le modèle a lus, daté de moins de **deux heures** avant le déclencheur — jamais
  un bavardage d'il y a dix jours que le tri avait laissé sans affaire. Rattacher à une affaire
  existante ouvre une écoute sur elle, par la fonction de la fiche, avec la même ancre — jamais le
  rattachement permanent de l'e-mail.
- **Sur la messagerie, « rien à faire » ne fait pas taire un interlocuteur.** La règle « un
  rien à faire sûr met la source en sourdine » vaut pour les newsletters ; sur un fil direct,
  seules la publicité et l'automatique en confiance haute mettent en sourdine ; le professionnel
  et le personnel n'écrivent que l'avis. La règle de l'expéditeur déjà écarté reste telle quelle.
- **Un message d'historique n'est pas trié.** On ignore si l'agrégateur rejoue, à la connexion
  d'un numéro, des messages anciens par le webhook. Un message daté d'avant la date de connexion
  du canal (`ChannelConfig.lastSyncAt`, reposée à chaque reconnexion ou guérison du canal : ce
  qui est arrivé pendant la coupure est de l'historique) est rangé et laissé à la future lecture
  de la messagerie ; sans date connue, rien n'est trié. Pas de colonne nouvelle.
- **Ce que la tranche ne fait pas, et pourquoi** : la relecture d'une affaire qui écoute déjà, à
  chaque message capté (reportée pour mesurer d'abord ce que coûte le tri seul sur un vrai
  numéro) ; la lecture de l'historique de la messagerie à la connexion (import des chats par
  l'agrégateur, sur la mécanique par tranches de la tranche 10 — la tranche d'après) ; les
  groupes ; l'entrelacement de deux affaires dans un même fil direct (une seule écoute ouverte à
  la fois).

### La prise en main est une conversation avec Relvo

**`tranché`** · Avec le dirigeant. Remplace les « trois écrans » de M13.2 par le **premier
échange** avec Relvo, dans la surface de M10. L'idée a été confrontée avant d'être retenue ; ce
qui suit est ce qui a tenu.

- **Pourquoi l'échange plutôt que des écrans.** C'est la posture même du produit (`01` §11) :
  le public dialogue chaque jour avec un assistant et n'apprend pas une interface. La lecture du
  courrier récent et la prise en main durent le même temps ; l'une occupe l'autre, et à la fin
  l'application n'est pas vide. Une barre de progression bloquante avait été envisagée :
  écartée — vingt minutes devant une barre perdent celui qui vient d'installer l'application ;
  occuper le temps, oui, le confisquer, non.
- **Scripté, jamais généré.** Le fil est une suite d'étapes écrites, en texte fixe. Le modèle ne
  mène pas la conversation : coût (le tour d'échange est le poste le plus élastique, `05`
  §11.9), prévisibilité (la même prise en main pour tous), testabilité (un script se rejoue).
  Zéro jeton pour le script ; les jetons vont au courrier.
- **Les questions sont les formulaires déjà livrés** — ceux des décisions d'une tâche de
  réponse —, dans la couleur de Relvo. Chaque réponse a une destination : un objet du compte
  par la fonction métier de l'écran, ou une instruction en couche Compte ou Domaine, jamais
  Produit. Elles sont peu nombreuses et jamais bloquantes. À rapprocher des questions de Relvo
  (M17.6) : une seule mécanique de question, pas deux.
- **L'état vit dans le domaine.** Les échanges sont éphémères côté client ; l'étape atteinte et
  les réponses sont persistées, le rattrapage porte son avancement. On reprend où on en était,
  et le script rejoue à chaque connexion de canal.
- **Une carte vivante dans le fil**, une seule, qui se met à jour ; pas un message par message
  lu. C'est une primitive nouvelle de l'échange.
- **Ce que ça impose à M10.** L'échange devient le premier écran que voit un nouvel
  utilisateur ; M13.2 dépend donc de M10, qui reçoit un item « échange scripté ». Et un échange
  qui montre l'interface se remplir pendant qu'il parle pose la question de sa place — plein
  écran ou non —, rouverte dans « Rouvrir la disposition générale ».
- **Le script, écrit et livré avec la tranche 10 de M7** (M13.2 y est livré, parce que le script
  ne peut naître qu'avec la lecture dès la connexion) : le métier, les domaines typiques du
  secteur, les domaines proposés par le courrier (M17.10), la première règle — avec pour exemple
  « Crée automatiquement une affaire urgente quand un client demande la réalisation d'un
  devis » —, et la fin de lecture, qui porte le badge et la notification et offre de lire deux
  semaines de plus. Les explications (affaire, domaine, tâche) sont du texte fixe au fil de la
  carte. Le script naît au webhook de connexion, avant même que l'échange ne s'ouvre ; quitter
  l'échange laisse sur l'accueil la ligne « Je lis encore votre courrier ». Ce que l'agrégateur
  synchronise, en combien de temps, se mesure sur le compte du dirigeant.

### Le durcissement : un appel raté coûte, un cache s'adresse, un brouillon cite

**`tranché`** · Tranche 8 du sprint M7.

- **Le coût d'un appel raté était perdu.** Une sortie tronquée au plafond ou non conforme au
  schéma faisait échouer le pipeline sans que le journal en garde la mesure : le compteur mentait
  par omission, précisément dans le cas qui coûte. L'échec est désormais une erreur nommée —
  entrée trop longue, plafond de sortie, sortie non conforme — qui porte la mesure de l'appel ;
  le pipeline la consigne comme une sollicitation ordinaire, puis l'échec avec son motif. Une
  sortie tronquée n'est **jamais** exploitée : une structuration coupée n'écrit rien, un
  brouillon coupé n'est pas posé.
- **L'entrée est bornée avant l'appel.** Les budgets par couche sont tenus par un test sur une
  fixture, pas au runtime ; un compte aux instructions démesurées les déborderait en silence. Un
  plafond d'entrée par tier, vérifié avant l'appel, refuse à zéro jeton ; les instructions et
  les documents poussés sont plafonnés avec un marqueur, dans un ordre stable pour que le cache
  tienne.
- **Le cache est adressé et mesuré.** Une clé de cache par compte et la rétention longue du
  fournisseur, au lieu d'un routage au hasard et d'un cache qui expire entre deux e-mails ;
  chaque mesure consigne le préfixe stable attendu, et `ia:journal` nomme les silencieux.
  Mesuré (`benchmark-iag.md` §6.10) : sur un message jamais vu, tout le préfixe partagé est
  relu, le tri coûte un quart de moins qu'au premier banc. La rétention se surcharge par
  l'environnement si le fournisseur venait à la refuser.
- **Le brouillon cite ses sources par le schéma de sortie** (M7.12), comme une tâche cite sa
  provenance : texte et sources dans la même sortie structurée, résolues contre ce que le modèle
  a lu — une source inconnue n'est pas une citation —, stockées dans le payload de l'Action,
  affichées en une ligne « Basé sur : … » sous la barre du brouillon. Le tier de rédaction rend
  donc un objet quand on lui donne un schéma ; le texte seul reste possible.
- **Ce que la tranche ne fait pas** : le disjoncteur (seuils par compte, garde en vitesse) est
  M14.5 ; le plafond de dépense sur la clé du fournisseur reste un geste de la tranche 0, à la
  main de l'organisation.

### Quatre retours du second essai du formulaire de décisions

**`tranché`** · Le même jour, sur le scénario du devis de friteuse joué jusqu'à la livraison.
Tous retenus, séparément :

- **Le hero d'une conversation, fixé, couvrait un tiers de l'écran.** Il tient sur moitié
  moins : plus de libellés « Interlocuteur » et « Suivi dans », le canal et les interlocuteurs
  en puces sur une ligne, les sujets suivis en lignes fines dessous. Dans un **groupe**, les
  membres restent repliés : la puce « WhatsApp · N membres » porte un chevron et les déplie,
  avec « Enregistrer » — un groupe de vingt personnes ne surcharge jamais le hero.
- **Le formulaire de décisions prend toute la largeur** d'un message du fil, au lieu d'une
  marge en plus.
- **Le rappel d'un choix fait est une coche violette et le libellé du choix**, rien d'autre :
  ni panneau, ni « Décidé avec Relvo », ni la question — elle est dans le message juste
  au-dessus. Le fil ne se sature pas de texte.
- **« Bien reçu, tout fonctionne » ne cochait pas la livraison** ni ne suggérait la clôture :
  la relecture savait ajouter et retirer des tâches, pas en cocher. Elle nomme désormais les
  tâches de la fiche que le message montre **accomplies**, le code les coche — celles du
  dirigeant comprises, c'est le geste réversible — et une tâche cochée ne compte plus dans ce
  qui reste. La consigne dit aussi que la parole du dirigeant l'emporte sur le planning :
  « reçu » vaut reçu, même si la date annoncée n'est pas passée (`conception/05-ia.md` §4.2).
  Une suite du jeu d'évaluation le vérifie.

### Huit retours du premier essai du formulaire de décisions

**`tranché`** · Le lendemain de la livraison du formulaire, sur le scénario complet du devis
de friteuse. Tous retenus, séparément :

- **La pop-up de fermeture d'un sujet** sortait en texte clair sur fond blanc sur le
  téléphone. Ce n'était pas la modale de confirmation mais le toast « Sujet fermé » qui propose
  d'ignorer le fil : le composant de notifications résolvait son thème contre le réglage sombre
  du téléphone alors que l'application est claire seulement. Il est désormais fixé en clair,
  et sa description prend nos couleurs (`PITFALLS.md` #51).
- **Le hero d'un groupe WhatsApp** listait tous les membres et prenait deux écrans : deux
  membres visibles, les autres sur « Voir les N autres ».
- **Le fil s'ouvre en bas**, sur le dernier message reçu — c'est ce qu'on vient lire.
- **Le hero reste visible** : il sort du défilement, le retour et les sujets suivis sont
  toujours à portée.
- **Un contact au nom d'adresse.** Sans nom d'affichage, l'adresse tenait lieu de nom sans
  même remplir l'e-mail, et Relvo ne complétait pas une fiche « vérifiée ». Désormais l'adresse
  est aussi l'e-mail de la fiche, une fiche dont le nom est une adresse ou un numéro reste à
  compléter quel que soit son statut, et la structuration lit aussi téléphone et e-mail dans la
  signature (posés seulement là où la fiche est vide).
- **Le formulaire de décisions se confondait avec un message** : même fond blanc. Il est
  teinté Relvo (violet clair, liseré violet), comme tout ce que Relvo pose dans le fil.
- **Ce qui a été décidé disparaissait** une fois la réponse envoyée. Le formulaire et la
  décision prise se posent désormais sous le message qui a posé la question, et une tâche
  close garde sa ligne « Décidé avec Relvo » dans le fil.
- **Les tâches devenues sans objet n'étaient pas retirées** : la relecture ne savait
  qu'ajouter. Elle nomme désormais les tâches ouvertes qu'un message rend sans objet (titre
  exact de la fiche, raison), le code ne retire que celles que Relvo avait proposées, et le
  journal dit lesquelles et pourquoi — `05 §4.2`, qui était noté V2, devient V1.

### Les décisions d'un message deviennent un formulaire, plus un choix dans le texte

**`tranché`** · Quatrième retour sur le brouillon, le même jour : « la mécanique de l'option
dans l'e-mail ne va vraiment pas ». Les puces au-dessus du champ, le crochet en relief, la
note conditionnelle à garder ou retirer — trois couches pour sauver un principe qui ne
fonctionnait pas : un choix ne se prend pas DANS le texte d'une réponse. Trois maquettes ont
été comparées sur le scénario réel du devis (fiche de décision entre le message et le
composer ; question dans le fil comme un message de Relvo ; décision portée par la tâche
dès l'Accueil). **La première est retenue**, et quatre points ont été tranchés :

- **Au plus simple.** Oui / non, un choix parmi deux à quatre, « Autre… » pour une réponse
  libre. Si les questions ne conviennent pas, le dirigeant écrit son e-mail lui-même — le
  composer reste libre à tout moment.
- **La réponse reste dans le fil**, comme sur la maquette (le formulaire se replie en une ligne
  vérifiable, « Changer » le rouvre), **sur la tâche** (« Décidé : oui »), et **au journal** —
  même si le dirigeant n'y va jamais, il sera précieux plus tard.
- **Les questions d'un message et l'envoi de la réponse sont une seule tâche.** Le dirigeant
  peut répondre sans les aides de Relvo ; c'est l'envoi qui coche la tâche par correspondance,
  décisions répondues ou non.
- **« Répondre » garde son comportement** : sur une tâche sans décision, le brouillon se rédige
  à l'appui. Sur une tâche à décisions, il attend que tout soit répondu.

Ce que ça retire : le surlignage, le comptage et le blocage des crochets dans le composer,
ainsi que la consigne qui les demandait au modèle — remplacée par « jamais de crochets, ni
d'alternative, ni de blanc à compléter ». Les décisions vivent dans les métadonnées de la
tâche, sans migration ; la structuration et la relecture les proposent, la retenue les borne
(trois par tâche, deux à quatre options), une méthode du domaine les répond et journalise.

### La fiche décrit, un envoi se relit, une note conditionnelle n'est pas un choix

**`tranché`** · Troisième essai réel, sur le premier e-mail du scénario du devis. Sept retours
du dirigeant, tous retenus.

- **La description est un panneau**, comme les tâches : sur la pierre, le texte flottait. Elle
  s'appelle « Description », et le résumé en est une ligne comme « Où on en est » et
  « Prochaine étape » — des sous-titres, pas des sections. Le bouton « Modifier » en tête est
  retiré : il ne modifiait que le résumé, et personne n'allait l'appuyer ; un crayon discret sur
  la ligne du résumé suffit.
- **La prochaine étape est une ligne, jamais deux.** « On attend » disparaît : quand rien ne
  revient au dirigeant, la prochaine étape dit « En attente : … » et porte l'échéance. La
  consigne des deux profils et le schéma le disent au modèle.
- **Un envoi relit le sujet.** La tâche se cochait mécaniquement à l'envoi (M7.10), mais la
  fiche disait encore « valider le devis » une fois le devis validé. Un envoi depuis Relvo —
  e-mail ou messagerie — déclenche désormais une relecture après la réponse à l'écran, avec une
  consigne d'envoi : ce qui est fait est fait, aucune tâche pour ce que le dirigeant demande à
  l'autre, la prochaine étape est le plus souvent la réponse qu'on attend. La correspondance
  tâche ↔ envoi et le marqueur restent mécaniques ; **l'appel ne sert qu'à réécrire la
  situation** — c'est un appel par message sortant, que le modèle de coût avait écarté quand
  il ne s'agissait que de cocher une tâche (`benchmark-iag.md` §6.2). **Arbitrage du
  dirigeant : on garde, même au prix de cet appel** — une réponse peut porter des
  informations qui comptent, à commencer par des tâches que le dirigeant s'engage à faire
  (« je passe jeudi à 14 h », « je vous rappelle lundi ») ; ne pas les lire, c'est les
  oublier. Le jeu d'évaluation compte deux suites d'envoi : une réponse qui met en attente
  (suite-010), une réponse qui engage le dirigeant et doit créer une tâche datée (suite-011).
- **Une note conditionnelle n'est pas un choix.** Le brouillon écrivait « [validons / ne
  validons pas] » puis « [Si validé : vous pouvez lancer la commande.] » : le second crochet
  dépend du premier et ne se choisit pas. Consigne au modèle : un crochet est une décision, et
  chaque option est complète — la conséquence va dans l'option. Filet dans le composer : un
  crochet qui commence par « Si » se présente sourd, se garde (la phrase, sans sa condition)
  ou se retire, et retient l'envoi comme un choix.
- **Un choix se lit comme un bouton** — fond clair, liseré, souligné en tirets ; celui où le
  curseur se trouve en relief plus fort. Le surlignage jaune ne disait pas qu'on pouvait
  appuyer.
- **Le fil reste lisible derrière le composer** : le composer, ancré, grandit avec le
  brouillon et recouvrait les messages ; le fil se réserve désormais sa hauteur mesurée, et se
  fait défiler jusqu'au dernier message.
- **Le hero respire** : de l'air entre le titre sur deux lignes et sa référence, et entre la
  référence et ses marqueurs.

### Un événement annoncé devient une tâche datée, et la fiche dit avec qui

**`tranché`** · Premier essai réel de la relecture, le jour de sa livraison, sur un scénario de
dépannage. Le premier e-mail a ouvert le sujet et sa tâche de validation du devis, la réponse a
fonctionné. Le second — « pièce commandée, intervention mardi matin à 8 h, rien à faire de votre
côté » — n'a produit **aucune tâche** : la consigne demandait une tâche par action *demandée*
au dirigeant, et rien n'était demandé. Le dirigeant a arrêté l'essai là : « sinon mon
utilisateur va oublier ».

**Retenu** :

- **Un événement annoncé à une date — intervention, visite, livraison, rendez-vous — est
  toujours une tâche datée**, avec l'heure si elle est donnée, même si le message dit « rien à
  faire de votre côté ». Consigne ajoutée à la structuration et à la relecture, règle écrite
  dans `05 §2.2`. Le banc le rejoue (`suites.jsonl`, suite-009, l'e-mail du dirigeant) : la
  tâche « Réception du riz basmati (mardi 8 h) » sort aux deux niveaux.
- **Les marqueurs du sujet s'affichent sur sa fiche** — « En attente », « À valider ? », le
  statut terminal — en petits chips sur la ligne de la référence, dans le hero. La liste les
  portait, la fiche non ; une fiche ne doit pas en savoir moins qu'une ligne de liste.
- **La fiche dit avec qui on dialogue**, et le contexte tient en **une ligne de puces** sous
  les onglets : le domaine (tap → sélecteur), l'interlocuteur (tap → sa fiche), l'urgence (tap
  → bascule). Une première version empilait un chip d'attente pleine largeur dans le hero, une
  carte Domaine + interrupteur, une carte « Avec » : le dirigeant a vu un patchwork sans
  hiérarchie. La hiérarchie retenue : le hero dit **quoi** (titre, référence, marqueurs) ; la
  ligne de puces dit **le contexte**, petit ; le Résumé et les Tâches — avec leur progression
  dans le titre de la section, retirée du hero — sont l'information principale, celle qu'on
  lit à chaque visite.

**Ce qui reste ouvert** : une tâche d'événement déjà posée qui change de date — « livraison
décalée à mardi » — est aujourd'hui écartée comme doublon par la retenue, et la nouvelle date
est perdue. Reprogrammer la tâche existante plutôt que d'en écarter une nouvelle est le
prochain pas, à faire quand le journal montrera le cas.

### La relecture suit l'affaire sans piloter le statut

**`tranché`** · Le message entrant sur un sujet suivi est le poste le plus fréquent du pipeline,
et le seul appel qui touche à un sujet que l'utilisateur a déjà en main. Ce qu'il a le droit de
changer est donc borné en un seul endroit, un module pur (`pipeline/proposition.ts`,
`retenirRelecture`), avant le domaine — et il ne touche jamais au statut.

**Retenu** :

- **La fiche et ce qui vient d'arriver sont séparés.** La relecture relit la situation
  structurée — la mémoire de Relvo, jamais l'historique — et les deux derniers messages
  antérieurs ; le message nouveau est poussé à part, en entier. Une seule fiche de précédent,
  pas trois : c'est le poste dont le budget est le plus surveillé.
- **La clôture n'est suggérée que sans tâche ouverte** — ni ancienne, ni ajoutée à l'instant.
  Le modèle peut dire « terminé » ; le code ne suggère que si rien ne reste à faire. Une
  suggestion en cours est **retirée** dès que le modèle ne conclut plus à la fin ; re-suggérer
  met l'horodatage à jour et fait revenir la pastille. La pastille dit « À valider ? » : le
  geste reste au swipe de la liste, dans les mots de l'utilisateur.
- **« En attente » se pose avec son objet, et ne se lève jamais ici.** Relvo ne le pose qu'en
  nommant de qui on attend quoi — un marqueur sans objet n'aide personne — et le message entrant
  l'a déjà levé mécaniquement avant l'appel (04 §9).
- **Une tâche qui répète une tâche ouverte est écartée**, sans accent ni casse : le modèle les
  répète même quand la fiche les montre. Plafond de quatre tâches par relecture.
- **La réouverture est constatée, jamais décidée.** Un message sur un sujet validé le rouvre
  avant l'appel (`createMessage`) ; la relecture l'apprend du journal et le dit au modèle — « le
  sujet était terminé, il repart ».
- **Un fil rattaché par le tri est relu dans la foulée** — par le modèle ou par la règle de
  l'expéditeur : le sujet qui attendait ce message doit lire ce qu'il dit. Une relecture par
  message, jamais deux ; un échec laisse le sujet tel qu'il était.

**Écarté** : lever « En attente » sur décision du modèle (la mécanique le fait mieux et sans
appel) ; cocher une tâche devenue obsolète sur un message reçu (05 §4.2, V2) ; la note de Relvo
sur le contact au fil des relectures (05 §1.3) — utile, mais c'est un champ de plus à écrire à
chaque message, à mesurer sur le jeu réel d'abord ; WhatsApp, qui attend l'e-mail stable (A8).

**Ce qui tranchera** : le journal — suggestions de clôture suivies d'un « Valider » ou d'un
message qui les retire, tâches de relecture supprimées, priorités remises à « normal » par
l'utilisateur après une montée de Relvo (le banc montre qu'il monte sur l'échéance d'un tiers).

### La structuration retient moins qu'elle ne propose

**`tranché`** · Le second appel — situation, résumé, tâches, contact — écrit en base sans revue
humaine, comme le tri. Ce qu'il a le droit d'écrire est donc décidé en un seul endroit, un module
pur (`pipeline/proposition.ts`), avant le domaine, et le banc d'essai a servi à régler la
consigne plutôt que le tier.

**Retenu** :

- **Un plafond de six tâches, sans doublon, aux dates conformes** : la deadline vit dans le début
  ; une heure sans date, une fin avant le début, une heure de fin sans heure de début sont
  retirées, et dites. Le modèle mettait la date d'un créneau dans le titre ; la consigne le lui
  interdit désormais, et lui demande une tâche par action explicitement demandée.
- **Une provenance se résout, elle ne s'invente pas.** Une tâche ne cite un précédent, une
  instruction ou un document que si le modèle les a eus sous les yeux ; une référence inconnue
  reste une source libre. C'est ce qui rend « d'après SUB-0042 » digne de confiance.
- **Un contact vérifié n'est jamais réécrit.** Relvo complète la fiche qu'il a lui-même créée
  (statut automatique) ; sur une fiche que l'utilisateur a vérifiée, il ne pose que le rôle, et
  seulement s'il est vide. La correction l'emporte toujours.
- **L'étiquette nouvelle et les questions vont au journal, pas en base.** Le registre, sa
  promotion et l'encart des questions sont M17 ; la proposition intégrale est conservée pour
  qu'il n'y ait rien à recalculer ce jour-là.
- **Seuls les sujets ouverts par Relvo sont structurés.** Un sujet ouvert à la main par
  l'utilisateur ne déclenche pas d'appel : il a déjà décidé, et le coût d'un appel se justifie
  d'abord là où Relvo décide seul. Étendre au geste manuel est un réglage de l'orchestration,
  pas du modèle — à décider sur l'usage.
- **Les précédents viennent du même domaine ou d'une étiquette partagée**, classés par
  recherche plein texte de la base sur le titre ; sans domaine ni étiquette, aucun précédent.
  Une recherche sur tout le compte serait le filet suivant, si le journal montre que les sujets
  sans domaine en manquent.

**Écarté** : un troisième appel pour les tâches seules, ou une tâche « lire le message » quand
le message est informatif. Le banc montre que le modèle sait rendre zéro tâche ; il faut le
laisser faire.

**Ce qui tranchera** : le journal, par les tâches de Relvo supprimées (conservées telles que
proposées) et par les sujets structurés sans tâche que l'utilisateur complète à la main — c'est
la part d'aide de M17.12.

### Le profil de l'expéditeur décide avant le modèle

**`tranché`** · Après la règle du rattachement, le dirigeant s'est inquiété du socle qui grossit
et a posé l'objectif : faire passer un maximum de traitement dans nos algorithmes plutôt que
dans l'IA, pour délester l'API et le contexte. Les chiffres du jeu d'évaluation disent que le
socle, servi depuis le cache, ne pèse pas dans le coût par message ; mais le principe reste le
bon pour une autre raison : chaque décision confiée au modèle est une décision qu'il peut rater.

**Retenu** : notre meilleure information n'est pas dans le message, elle est dans ce que la
base sait de qui l'envoie. Un **profil de l'expéditeur** est calculé sans appel à chaque fil à
trier — contact connu ou non, sujets nés de ses fils, domaine habituel, ignorances par raison,
sujets ouverts avec lui et leur attente — et sert à trois choses :

- **Décider sans appel quand il le peut.** Une source écartée trois fois pour la même raison se
  tait ; un contact connu dont le seul sujet ouvert attend sa réponse, actif depuis moins de
  trente jours, est rattaché. Deux règles prudentes, seuil et fenêtre en constantes testées.
- **Rétrécir le contexte au lieu de le grossir.** La liste des sujets poussée au tri est
  choisie autour de l'expéditeur — les siens, puis ceux en attente, puis les récents —, plafond
  ramené de quarante à vingt titres. C'est ce qui manquait sur la démonstration pour rattacher
  au bon sujet.
- **Peser dans l'avis** en trois lignes, sans règle écrite : « contact connu, fournisseur ; ses
  fils ont ouvert quatre sujets ; jamais ignoré ».

**Écarté** : une « importance » chiffrée du message, évaluée par le modèle. Ce serait un
quatrième axe à lire, et bruyant. L'importance est dérivée de faits que nous détenons — le
contact est connu, un sujet l'attend, la priorité est urgente —, jamais une note.

**Ce qui tranchera** : le journal, par la règle qui a conclu (`source-deja-ecartee`,
`sujet-en-attente`) — un rattachement sans appel contredit par la relecture, ou une source
écartée que l'utilisateur réactive, feront relever le seuil ou resserrer la fenêtre.

### L'avis de Relvo parle en deux parts — une action, une nature — et le rattachement prime

**`tranché`** · Le second e-mail réel trié a exposé trois défauts d'un coup. À l'écran, la
ligne disait « Relvo · bruit · autre » : les énumérés du modèle passés tels quels, un terme de
traitement du signal et une catégorie qui ne dit rien. Le fil — une demande de devis reçue
d'une adresse personnelle portant le nom du dirigeant — a été mis en sourdine : le contexte
présentait le dirigeant comme « Entreprise : Vincent Chollet », le message arrivait « De :
Vincent Chollet », et le modèle en a conclu un message sortant, où l'action attendue était
chez l'autre. Enfin, un accusé de réception qu'un sujet attendait, arrivé comme un e-mail
neuf, aurait été ignoré au lieu de rejoindre ce sujet.

**Retenu, à la proposition du dirigeant** :

- **Une action, dans ses mots** : à traiter (Relvo ouvre ou rattache, à l'utilisateur de
  traiter le sujet), à considérer (le fil reste à trier avec l'avis), rien à faire (en
  confiance haute, mis en sourdine). Les énumérés internes restent ; l'écran ne les montre plus.
- **Une nature, toujours posée, quatre valeurs** : professionnel, publicité (démarchage
  compris), automatique, personnel. « Autre » disparaît — c'est la catégorie qui avait
  englouti le devis. Le domaine ne se pose que sur le professionnel.
- **Le cadre du message reçu**, en une phrase du contexte : l'expéditeur est un tiers, homonyme
  ou pas, et l'avis se rend sur ce que le message demande. Le dirigeant est nommé
  « Dirigeant », sa messagerie est donnée.
- **Le rattachement prime sur l'action** : un fil qui prolonge un sujet ouvert le rejoint même
  sans rien à faire. Corollaire : le filtre déterministe ne conclut plus sur les signaux
  d'automate — un accusé est souvent attendu —, il ne conclut que sur la publicité. Chaque sujet
  ouvert poussé au tri porte son marqueur « en attente d'une réponse ».

**Ce qui tranchera** : le jeu d'évaluation, qui porte désormais les deux cas — le devis reçu
d'une adresse personnelle au nom du dirigeant, l'accusé qu'un sujet attendait — et les avis
réels des semaines qui viennent. Première mesure sur la démonstration : le devis est reconnu « à
traiter · professionnel », l'accusé « rien à faire · automatique » et rattaché ; mais entre le
sujet précis marqué « en attente » et un sujet général du même thème (« Réceptions & livraisons
fournisseurs »), le modèle choisit le général deux fois sur trois. Le lanceur compte désormais
les rattachements non attendus. Un compte réel n'a pas de sujets parapluie ; si les usages en
font apparaître, la consigne de rattachement est le levier. Le socle Produit a grossi d'un bloc pour porter la nature et
le cadre ; son budget a été relevé d'autant, une fois, avec ce motif.

### Trois pastilles, deux natures — ce que Relvo a fait en mon absence

**`tranché`** · Au premier e-mail réel trié, le dirigeant a demandé à voir « ce que Relvo a fait
en mon absence » : combien de fils lus, rangés en ignorés, en suivis, laissés à trier. Une
première réponse posait une carte de bilan en tête de Conversations, sur une fenêtre de sept
jours — faute d'horodatage de visite, la fenêtre était arbitraire.

**Retenu, à la proposition du dirigeant** : pas de carte, des **pastilles sur le sélecteur**
Sans sujet / Suivies / Ignorées. Elles ne sont pas de même nature, et c'est voulu :

- « Sans sujet » compte un **stock** — toutes les conversations à trier, lues par Relvo ou
  non. C'est le résidu de l'assistant, le seul endroit où l'interface réclame un geste. Le
  chiffre ne tombe qu'en triant à la main.
- « Suivies » et « Ignorées » comptent un **flux** — ce que Relvo y a rangé depuis le dernier
  passage. Un appui sur l'onglet marque le passage, le chiffre tombe. Un geste de l'utilisateur
  n'y compte jamais : ces pastilles ne disent que ce que Relvo a fait.

Une seule règle de lecture réconcilie les trois : **le chiffre dit ce qui attend l'utilisateur
ici** — un travail sur le premier onglet, un regard sur les deux autres. Une seule couleur, la
violette de Relvo : le libellé de l'onglet porte le sens, et le rouge reste au retard des
tâches. Les deux horodatages vivent sur le compte, pas dans le navigateur — téléphone et
ordinateur voient la même chose.

**Ce qui tranchera** : l'usage. Si la nuance stock/flux se lit mal, la couleur est le levier ;
si le sous-titre du header (« N conversations à trier ») fait doublon avec la pastille, c'est le
sous-titre qui part.

### Le personnel, la publicité et l'automatique sont des raisons, pas des domaines

**`tranché`** · Le besoin exprimé à l'ouverture du pipeline : trier par défaut, sans rien
configurer, ce qui est personnel, ce qui est publicitaire, ce qui vient d'une machine — et laisser
le reste aux domaines de l'utilisateur. Le réflexe serait d'en faire trois domaines pré-créés.

**Écarté** : un domaine est un périmètre de mémoire — des sujets et des connaissances — et ces
fils n'en produisent jamais. Ils vivent déjà dans la conception comme **raisons d'ignorance**
d'une conversation. Le tri les pose donc comme **catégorie de son verdict « bruit »**, dans le
même vocabulaire, pour que la liste à trier se regroupe dessus et qu'une confirmation d'un geste
devienne la raison d'ignorance. Aucune configuration, aucun domaine parasite dans les sujets.

### Suggérer les domaines à la prise en main

**`tranché`** · Livré par la tranche 10 de M7 (M17.10 y est livré, parce que les propositions
naissent de la lecture dès la connexion). Deux voies, dans le premier échange avec Relvo :

- **Les domaines typiques des secteurs**, à cocher, pendant la lecture — cinq par secteur, avec
  une description d'une ligne et un logo curé, dans le **domaine** (`prise-en-main.ts`), pas dans
  les socles de la couche Produit : c'est une donnée de création, jamais une consigne au modèle.
  La question ne se pose qu'un métier connu et tant que le compte n'a que Général ; chaque
  domaine coché naît par la fonction de la Mémoire. « Aucun pour l'instant » ne crée rien.
- **Les domaines proposés par le courrier** : dès que deux affaires sans domaine partagent la
  même proposition — groupées par slug, casse et accents confondus —, une question se pose dans
  l'échange, par la lecture après chaque salve et à l'ouverture de l'échange. « Oui » crée le
  domaine (ou reprend celui qui porte ce slug) et y range les affaires par la fonction de la
  fiche ; « Non » n'est jamais reproposé. La proposition reste sur l'affaire : supprimer le
  domaine la fait réapparaître. Aucun encart nouveau dans la Mémoire : la question et le badge
  suffisent, la Mémoire montre le résultat.

### Le contexte du modèle est assemblé en cinq couches

**`tranché`** · Un appel n'a pas de mémoire et chaque mot envoyé se paie. Le contexte est donc
assemblé par empilement, de la couche la plus stable (le produit, partagée entre tous les comptes
qui ont les mêmes secteurs — un compte peut en avoir plusieurs) à la plus volatile (l'instant), et chaque sollicitation a son **profil** — le tri ne
charge pas le domaine, l'étiquette d'une pièce jointe ne charge presque rien.

**Ce qui a tranché** : le cache de prompt est un préfixe. Ordonner les couches du stable au volatile
est ce qui le rend efficace ; et un profil par sollicitation est ce qui évite de payer un contexte
complet pour une classification. La couche Situation est la seule payée plein tarif : c'est là que
porte tout l'effort de compacité, par des fiches que Relvo rédige lui-même — la situation
structurée d'un sujet est la mémoire que le prochain appel relit, jamais l'historique.

### Le tri et la structuration d'un sujet nouveau sont deux appels

**`tranché`** · Le tri découvre le domaine ; la structuration a besoin des instructions et des
précédents de ce domaine. Ils ne peuvent pas tenir dans un seul appel. Un message sur un sujet
existant reste un seul appel, la relecture. En contrepartie, la classification de domaine n'est
plus un appel séparé mais un champ de la sortie du tri, et la mise à jour d'une tâche de réponse
à l'envoi devient déterministe. Les deux effets se compensent sur le budget.

### Les étiquettes sont attribuées par Relvo seul

**`tranché`** · Un marqueur thématique qui traverse les domaines, choisi dans un registre par
compte amorcé par les secteurs du compte ; une étiquette nouvelle reste candidate tant qu'un second sujet ne
la reprend pas.

**Ce qui a tranché** : un vocabulaire libre se dégrade en quelques semaines — synonymes, pluriels,
étiquettes à un seul sujet qui ne relient rien. Le registre garantit la convergence, et réserver
l'écriture à Relvo évite le vocabulaire à deux mains. L'utilisateur filtre, il ne saisit pas.

### L'apprentissage n'attend pas la V2 : c'est une boucle sur le journal

**`tranché`** · Le journal conserve, pour tout geste sur une proposition de Relvo, la proposition
d'origine et le geste ; le geste d'ignorer porte une raison choisie en un appui ; le tri dépose son
verdict, sa confiance et sa raison. Ce brut est distillé — préférences observées calculées par
agrégation, instructions nées d'une correction, fiches de contact et de clôture — dans les couches
du prochain appel. Aucun réentraînement.

**Ce qui a tranché** : le premier obstacle du produit est le bruit — un Relvo qui ouvre des sujets
sur des newsletters ne survit pas une semaine — et le raisonnement de l'utilisateur doit être
capturé sans qu'il l'écrive. Une raison en un appui et des accords ou désaccords journalisés le
font ; un écran de paramétrage ne le ferait pas.

### Les questions de Relvo ne sont jamais des tâches

**`tranché`** · Ce que Relvo ne sait pas devient une question posée sur la fiche du contact, du
domaine ou du sujet, avec la réponse saisie sur place. Une question dans l'agenda serait la tâche
artificielle que le produit refuse, et diluerait le signal du calendrier.

### Le brouillon se prépare à la première ouverture de la zone de rédaction

**`tranché`** · L'épique disait « quand une tâche de réponse est créée ». Beaucoup de brouillons
ne seraient jamais lus ; les préparer à l'ouverture de la zone de rédaction économise ces appels
sans que rien de visible ne change. L'épique est alignée.

### Les domaines émergent du courrier

**`tranché`** · Au premier jour, aucun domaine. Relvo n'en crée jamais ; il pose un domaine
proposé sur les sujets qu'aucun domaine n'accueille, et l'interface suggère la création dès que
plusieurs sujets partagent la proposition. Les socles des secteurs proposent des domaines typiques à la
prise en main. Le rattrapage du courrier récent, en lot, produit ces propositions dans les minutes
qui suivent la connexion — c'est aussi la démonstration attendue par les clients.

### Sept extensions de l'IA, retenues sans écran de paramétrage

**`tranché`** · Transcription des messages vocaux, étiquette par vision sur les images, relance
dérivée de la situation structurée, raison affichée d'un appui sur chaque proposition, titres des
sujets ouverts récents dans le contexte du tri, part d'aide de Relvo comme unique indicateur, et
brief du matin en notification. Chacune passe par un geste ou une surface qui existe déjà ;
aucune n'ajoute un réglage.

**Ce qui a tranché** : le public dicte plus qu'il n'écrit et photographie plus qu'il ne scanne —
sans la voix et l'image, une part du courrier reste invisible au pipeline. Les autres extensions
sont des dérivés gratuits de ce qui est déjà stocké : la situation structurée, le journal, les
titres des sujets.

### Parler à Relvo : maintenir, parler, relâcher — le vocabulaire du compte, le coût à la minute

**`tranché`** · La voix entre dans l'échange (M22) par la **transcription de fichier**
d'OpenAI, sur le socle de l'AI SDK déjà installé : on enregistre dans le navigateur avec le
format que le téléphone donne, on envoie à la fin, le texte revient. **Le geste est celui des
messageries** : on **maintient** le micro pour parler, on **relâche** pour envoyer — la
transcription part à Relvo comme un message tapé, **sans relecture**. L'audio ne quitte
l'appareil que pour être transcrit et n'est conservé nulle part.

- **Revu après le premier essai du dirigeant** : la première version posait la transcription
  dans le composer comme un brouillon à relire, avec un appui pour parler et un appui pour
  finir. À l'usage, l'étape de relecture n'apportait rien — une dictée à Relvo n'engage rien
  d'irréversible, ses gestes s'annulent (`05 §11.6`) — et le double appui était un geste de
  plus. **Écartés** avec elle : le micro gardé dans le champ quand on a commencé à taper (la
  dictée « s'ajoutait » au texte) ; dès qu'on tape, le disque est l'avion, c'est tout. Ce
  qui est **conservé** : un message dicté à un **contact** (M20.1) se relira avant de partir,
  parce qu'il sort du compte (`05 §7.4`).
- **Une minute par dictée**, pas deux : une dictée à Relvo est une demande, pas un mémo.
  L'appareil s'arrête au plafond et envoie ce qu'il a ; l'écran qui s'éteint ou l'app qui
  passe en arrière-plan valent un relâcher — jamais de reprise sans geste.
- **Un tier « transcription »** à part des quatre tiers au jeton : pas de niveau de
  raisonnement, pas de plafond de jetons, un **coût à la minute** dans une table dédiée, et
  une ligne de journal par dictée qui porte les **secondes d'audio**. Le backoffice et
  `ia:journal` les lisent ; aucun compteur, aucune clé, aucun projet OpenAI à part.
- **Le vocabulaire du compte** — contacts complets d'abord, affaires ouvertes, un court
  lexique par secteur — part en prompt de transcription, en prose bornée. C'est le vrai gain
  sur la dictée du clavier : les noms s'écrivent juste. Son revers : sur un silence, le
  modèle **recopie le prompt** ; un texte contenu dans le prompt n'est donc jamais une dictée
  (`PITFALLS.md` #66).
- **Le modèle** : le plus petit qui écrit juste les noms du compte, validé par le dirigeant
  sur l'iPhone depuis la page d'essai du backoffice (`/admin/dictee`), qui porte le même
  crochet et la même route que le composer. Le benchmark comparatif (`eval:dictee`, dictées
  hors dépôt) reste disponible, il n'a pas été nécessaire pour trancher.
- **Écartés** : la Web Speech API (inégale en PWA installée, audio chez un tiers) ; la
  transcription en direct (Realtime), gardée en réserve si l'attente du mode fichier gênait à
  l'usage — une dictée de dix secondes revient en deux.

**Ce qui a tranché** : le public dicte plus qu'il n'écrit, et une alpha sans voix teste un
produit que personne n'utilisera ainsi.

### Les outils de lecture de l'échange prennent les critères que le dirigeant dit

**`tranché`** · Un outil de lecture de l'échange accepte **ce que le dirigeant dit
naturellement** — un jour ou une plage de jours en heure française, une personne, un domaine,
un canal, un état, un type —, jamais seulement un mot-clé ni une poignée de périodes figées.
Sans critère, il rend les derniers éléments plutôt que rien. Un nom qui désigne plusieurs
contacts est rendu **en candidats**, jamais tranché en silence.

- **Le constat** : « ai-je reçu un e-mail aujourd'hui ? » répondu « non » alors qu'un message
  venait d'arriver — la recherche de messages ne prenait qu'un mot, le modèle y avait mis la
  date. Même défaut sur les tâches (quatre périodes figées, les tâches sans date invisibles,
  « cette semaine » qui valait sept jours glissants), sur les affaires (ni domaine, ni contact,
  ni état, ni mots), sur la Mémoire (aucun outil de lecture : le contexte n'en porte qu'une
  partie, plafonnée) et sur les conversations (« à trier » rendait un compte, pas une liste).
- **L'alternative écartée** : laisser le modèle ramener large et trier dans sa fenêtre — c'est
  ce qui fait exploser les jetons, et ce qui ferme des questions. Chaque critère **réduit** ce
  qui remonte ; les plafonds par appel restent.
- **Ce que ça change** : `list_tasks` (période ou jours explicites, sans date, type, mots,
  faites), `list_subjects` (état, urgence, attente, domaine, contact, mots, jours d'activité),
  `search_messages` (canal, non lus, affaire en plus des jours, de l'expéditeur et du sens),
  `get_contact` (nom, adresse ou entreprise ; candidats rendus), deux outils nouveaux
  `list_conversations` et `search_knowledge`. « Cette semaine » finit dimanche. Chaque
  critère est entré dans le jeu d'évaluation avec la question qui l'a motivé (`PITFALLS.md`
  #68).

**Ce qui a tranché** : la capture d'écran du dirigeant — Relvo qui affirme qu'il n'y a pas
d'e-mail alors qu'il y en a un — et le coût en jetons de l'alternative.

### Le mini backoffice : l'écran des méthodes du domaine, une suppression sans corbeille, une inscription qui attend sa validation

**`tranché`** · Le backoffice (M21) n'ajoute aucune règle au produit : c'est l'écran des méthodes
qui existaient — `setAssistantEnabled`, `countOpenQuestions`, `listAiSolicitations`,
`listPushSubscriptions` — et de trois méthodes nouvelles, toutes journalisées : changer un rôle,
marquer un compte « test », supprimer un compte. **Aucun compteur parallèle** : le coût d'un
compte est la somme du journal des sollicitations relu compte par compte, une page d'exploitation
pour une poignée de comptes acceptant des requêtes en nombre de comptes, jamais en nombre
d'affaires.

- **La zone `/admin` vit dans `(shell)`, hors de `(app)`** : pas de dock, pas de menu ; le menu
  de l'application y mène pour les administrateurs, la zone propose le retour. Gardée deux fois :
  le proxy lit le rôle dans le jeton — ce qui oblige le callback `session` à vivre dans la
  configuration edge (`PITFALLS.md` #64) —, le layout et chaque action le relisent en base. Le
  rôle `admin` est celui de l'énuméré existant ; il se donne **par script**, journalisé, jamais
  par la base, et n'entre dans le jeton qu'à la connexion suivante.
- **La suppression d'un compte est définitive.** Pas de corbeille, pas de « soft delete » : le
  backoffice sert à maîtriser l'espace et la donnée, un compte de test supprimé n'existe plus.
  L'agrégateur est déconnecté **d'abord** (best-effort, bilan consigné) ; la base cascade, les
  triggers enfilent les clés dans l'outbox. Le journal du compte disparaît avec lui : la trace
  s'écrit **sur le compte de l'administrateur**. Deux comptes ne se suppriment pas d'ici : le sien,
  et la démonstration, que le build recrée. La confirmation fait **retaper l'adresse**.
- **L'inscription reste libre, l'accès attend la validation.** Écarté : une liste d'adresses
  invitées à tenir avant l'inscription — une table de plus pour un geste de plus. Retenu : le
  compte créé par l'inscription porte une date d'ouverture nulle, ne se connecte pas (la
  connexion le lui dit en clair, Google compris) et voit une page d'attente ; le backoffice le
  liste « À ouvrir » et l'ouvre d'un appui, ce qui lui envoie un e-mail. **Le compte en attente
  est la demande.** Les comptes existants sont ouverts par la migration. Pas d'interrupteur de
  configuration : la porte est du code, elle se retire par un commit quand l'alpha se ferme.
- **Le motif d'une coupure** voyage en métadonnée de l'entrée que `setAssistantEnabled` écrit
  déjà, acteur `system` — pas de nouvelle entrée, pas de nouvelle table.

**Ce qui a tranché** : l'alpha ouvre avec des comptes de test créés et détruits au fil des essais,
et la première règle du dépôt — jamais de SQL direct — ne tient que si chaque geste a son écran.

### L'alpha dans deux jours : le mini backoffice et la voix passent devant le rattrapage

**`tranché`** · Le produit entre en alpha deux jours après la livraison du push. Deux épiques
sont enregistrées et passent **devant** la tranche 10 de M7 et la prise en main (M13) :

- **M21 — Mini backoffice.** Voir les comptes et ce que chacun coûte en inférence, couper
  l'assistant d'un compte, **supprimer un compte de test**, choisir qui entre pendant l'alpha.
  Tout par les méthodes du domaine, journalisées — le backoffice est l'écran de ces méthodes,
  jamais une console SQL (« L'assistant s'active par un réglage du compte ; l'administration
  viendra avec le backoffice » tenait ce besoin pour acquis ; le voici daté).
- **M22 — Parler à Relvo.** La voix comme entrée de l'échange : disque de dictée, transcription
  posée dans le composer, **relue et corrigée** avant l'envoi. **Retenu** : la transcription de
  fichier d'OpenAI (`gpt-transcribe` ou sa famille), parce qu'elle accepte un vocabulaire — les
  noms des contacts et des affaires — et coûte quelques millièmes par minute. **Écartées** : la
  Web Speech API du navigateur (inégale en PWA installée, audio chez un tiers) ; la transcription
  en direct par session Realtime reste en réserve si l'attente gêne. La dictée du clavier reste
  disponible, elle n'est pas le geste du produit.

**Ce qui a tranché** : un compte de test qu'on ne peut pas supprimer proprement finit supprimé en
base, et c'est la première règle du dépôt qui tombe ; une alpha sans voix, pour un public qui
dicte, teste un produit que personne n'utilisera ainsi.

### Relvo vous prévient : Web Push, un réglage par appareil, deux notifications et pas une de plus

**`tranché`** · Le socle des notifications (M12.7, M12.9) est le **Web Push standard** avec des
clés VAPID et la bibliothèque `web-push` : aucun service tiers, le serveur parle directement aux
services de push des navigateurs. Deux événements seulement font vibrer le téléphone : le **brief
du matin**, un calcul des compteurs du jour sans génération, et **une question de Relvo qui
s'ouvre hors écran** — née du tri ou du rattrapage, jamais de la prise en main posée pendant que
l'échange est ouvert. Pas de notification de message ni d'alerte de tâche.

- **L'abonnement est le réglage.** Une ligne « Notifications sur cet appareil » dans
  Préférences ; l'autorisation se demande sur ce geste, jamais au chargement ; l'activer envoie
  une notification de bienvenue — la preuve immédiate que la chaîne marche. Pas d'interrupteur
  par nature de notification (cf. « Sept extensions de l'IA » : aucune n'ajoute un réglage).
- **L'heure du brief est fixe** : `0 6 * * *` UTC, 7 h en hiver et 8 h en été. Un champ « heure
  d'ouverture » aurait été un réglage de plus pour un gain incertain. Le silence est une règle :
  tout à zéro, rien ne part ; un brief par jour, le journal fait foi.
- **Deux crons au plus** (plan Hobby) : le drainage des suppressions de fichiers rejoint le cron
  du matin ; le rattrapage garde le sien, la nuit.
- **Sur iPhone**, le push n'existe que pour l'application installée depuis Safari : la ligne de
  Préférences l'explique au lieu de montrer un interrupteur mort.
- **Le service worker ne fait que le push** — pas de cache, pas de hors-ligne.

**Retenu contre** une notification par message reçu, qui transformerait Relvo en boîte de
réception de plus, et contre la conservation du raisonnement du modèle côté client pour les
notifications (sans objet : le brief est un calcul).

### La disposition générale : quatre vues, Relvo au centre, un menu pour le reste

**`tranché`** · Réponse aux trois questions de « Rouvrir la disposition générale », construite
sur planches — sept écrans au format téléphone, dans les tokens du produit — puis tranchée. Les
planches de référence sont citées dans le sprint qui les met en œuvre.

- **La navigation.** La barre d'onglets porte cinq places : **Accueil · Calendrier · Relvo ·
  Sujets · Conversations**, Relvo au centre, plus gros, sans libellé. Le bouton d'accès à Relvo
  quitte le header : il est **sous le pouce**, et il est le centre de gravité que `01 §11`
  réclame. L'invariant 22 reste vrai, le bouton est au même endroit sur toutes les pages. Tout ce
  qu'on ouvre moins d'une fois par jour va dans un **menu latéral** (burger, à gauche du header) :
  Bilan, Mémoire, Contacts, puis Canaux, Profil, Préférences, Usage, et Rechercher en dernier,
  comme une action. Les cinq onglets et le header saturé sont écartés ; Contacts et Réglages,
  jamais visités, sortent du dock. **Retenu contre** un bouton Relvo gardé dans le header avec
  quatre onglets : le bouton le plus important y était le moins visible, en haut à droite, là où
  le pouce ne va pas.
- **Conversations restent dans le dock**, faute de pouvoir trancher aujourd'hui : c'est l'usage
  après M7 qui décidera. « Rouvrir la place des conversations » reste ouverte.
- **L'accueil est un brief en quatre zones**, dans cet ordre : **Dernières nouvelles** (ce que
  Relvo a fait depuis la dernière visite, et ce qu'il attend de l'utilisateur), **Activité**
  (trois chiffres sur sept jours), **Aujourd'hui** (les tâches du jour), **En attente de vous**
  (les sujets qui attendent une réponse ou une décision). Chaque zone est une porte vers une vue
  ou vers l'échange ; l'accueil ne duplique aucune vue et ne porte pas de barre d'indicateurs.
  La page des tâches devient **Calendrier**, qui absorbe la semaine et le mois ; « À trier »
  quitte l'accueil et devient un filtre de Sujets et de Conversations. L'invariant 30 est
  périmé, remplacé par 34.
- **Les nouvelles vivent dans le header**, sur un panneau translucide dans la zone violette,
  avec le logo en tête. **Retenu contre** un bloc violet plein sur la pierre : deux aplats
  violets se suivaient, séparés d'une bande de pierre sans rôle. Le titre est « Dernières
  nouvelles », jamais « Relvo vous parle ». Le bloc porte le résumé calculé et **au plus deux
  suggestions**, qui ouvrent l'échange ; jamais de raccourcis vers les sujets, qui finiraient
  par saturer. Le header prend alors jusqu'à un tiers de l'écran : c'est le prix accepté, et
  c'est pour ça que les suggestions sont plafonnées.
- **Deux familles de chiffres, deux domiciles.** « Ce que Relvo a fait pour vous » est
  cumulatif et justifie le produit : messages lus, sujets ouverts, tâches créées, brouillons
  préparés, contacts reconnus, sources en sourdine. « Où en êtes-vous » est un flux et parle de
  productivité : messages reçus par jour, sujets ouverts contre fermés, tâches faites, délai
  médian de réponse, retards. Le **Bilan**, page du menu, porte les deux, séparées ; l'accueil
  porte la seconde en trois chiffres. **Jamais de « temps gagné »** : c'est un chiffre inventé,
  et le public le sentira. Le Bilan est **V1**.
- **L'usage se lit en pourcentage, jamais en euros.** L'utilisateur n'a pas à savoir ce qu'on
  lui alloue. La page Usage montre la part du plafond consommée dans le mois, et rien d'autre.
  Le plafond est celui de M14.5 : la ligne du menu est une promesse sur le disjoncteur, à tenir
  dans le même chantier.
- **« Domaines » devient « Mémoire »**, page du menu : les instructions du compte en tête, les
  domaines en lignes dessous, et une zone « Ce que Relvo a appris » réservée à M17, qui donnera
  à cette page une raison d'être visitée.
- **Relvo parle en premier.** Ce qui a besoin de l'utilisateur — une question, une étape de la
  prise en main ou du rattrapage — est un objet persisté du compte, la `RelvoQuestion` élargie,
  et c'est lui qui porte le badge du bouton Relvo, la notification, et la ligne « Une question
  pour vous » de l'accueil. Le dialogue reste éphémère (invariant 23) ; ce sont les questions et
  leurs réponses qui persistent. Une question se répond dans l'échange, par le formulaire de la
  prise en main, ou sur la fiche concernée : même fonction métier.
- **Le bouton Relvo est un objet, pas un aplat** : disque nacré, reflet, anneau, étoiles en
  relief avec ombre portée. C'est la seule exception à la charte des surfaces plates, et elle
  reste unique : si le relief s'étend aux tuiles ou aux panneaux, on perd « ce qui brille, c'est
  Relvo ». Les étoiles sont légèrement réduites dans le disque et le badge est repoussé hors du
  bord, pour que les deux petites étoiles restent visibles : masquées, la grande étoile seule se
  lit comme un orifice.

**Mis en œuvre par** l'épique M18, avant la tranche 10 de M7 et avant M10.

---

### Le Bilan et l'Usage naissent en maquette annoncée

**`tranché`** · Les pages Bilan et Usage sont livrées avec M18 sans être reliées au journal ni
au compteur d'inférence : leurs chiffres sont de démonstration, tenus dans un seul module
(`lib/demo-bilan.ts`), et **chaque page le dit en tête**. Ce qui est fixé, c'est la disposition
et le vocabulaire — deux familles de chiffres séparées, jamais de « temps gagné », un
pourcentage et jamais d'euros (invariants 37 et 38). **Retenu contre** attendre le branchement
pour livrer les pages : le dirigeant voit la forme, la critique, et le Bilan a une place dans le
menu dès maintenant. **Retenu contre** des chiffres réels partiels : un Bilan à moitié vrai
serait lu comme vrai. Le branchement suit le plafond par compte (M14.5) et la lecture du
journal ; le module de démonstration disparaît à ce moment-là.

### Une direction artistique choisie parmi quatre, avant de construire l'échange

**`tranché`** · La disposition générale est tranchée et livrée ; ce qui reste perçu comme
« lourd » n'est pas la place des choses mais leur **matière** — densité, contrastes, ce que
chaque écran porte en trop — et l'absence d'**accompagnement** : un dirigeant qui arrive sur un
produit vide n'est pris par la main nulle part.

La proposition : **habiller et alléger avant M10**, pour la raison qui a placé M18 avant M10 —
la surface de l'échange est celle qui compte, on ne la construit pas dans une apparence qu'on
sait vouloir changer. Quatre directions visuelles comparées sur planches (Accueil, Sujets,
Échange), dont la DA actuelle poussée au bout comme témoin ; une seule survit dans
`conception/`. Puis un allègement écran par écran, et un langage de mouvement réservé à ce qui
guide — le mouvement courant reste court. Trois outils d'assistance au design sont mobilisés,
chacun sur une tranche ; leurs fichiers de travail ne deviennent pas un second domicile de
conception.

**Ce qui n'est pas rouvert** : la disposition (invariants 34–38), les rôles sémantiques de
couleur, le relief réservé au bouton Relvo. Une direction peut les contester, mais par une entrée
ici, jamais par une planche qui les contourne.

**Retenu contre** reprendre l'UX et l'UI d'un seul tenant : la disposition venait d'être tranchée
sur planches, et M9 a montré ce que coûte un écran dessiné deux fois. **Retenu contre** animer la
prise en main maintenant : elle dépend de l'échange scripté (M10.16), pas construit ; on livre le
langage de mouvement et les surfaces de premiers pas qui existent, la prise en main les
consommera. **Retenu contre** fermer la tranche 5 de M18 avant d'ouvrir ce chantier : elle est
du domaine, et M10 en est le consommateur — elle se livre avec M10, M18 passe `partiel`.

**Mis en œuvre par** l'épique M19, entre M18 et la tranche 10 de M7.

---

### Une direction artistique : « Lettrage d'artisan », violet en livrée, ciel étoilé

**`tranché`** · Réponse à « Une direction artistique choisie parmi quatre ». Trois tentatives
ont été nécessaires, et les deux premières sont instructives. Avec ui-ux-pro-max, la première
série de planches ne faisait varier que couleur et typographie ; la seconde, « structurelle »,
donnait quatre aplats d'informations sans zones ni hiérarchie. **Cet outil est un dictionnaire
(styles, palettes, polices, règles en une phrase) interrogé en plein texte ; il ne contient aucun
exemple d'écran et ne produit aucune direction.** La troisième tentative, avec impeccable, a
suivi sa méthode : sept mondes tirés de l'univers du public (jamais des outils qu'il manie), un
tirage qui assigne la direction à construire et oppose des challengers de catalogue illustrés,
une page de décision dans le navigateur, un contrat de direction en six blocs. Les planches de
référence sont citées dans le sprint qui les met en œuvre ; le contrat vit dans le dossier
d'impeccable de l'application.

Avant le tirage, le dirigeant a verrouillé un **socle** à partir de quatre applications qu'il
apprécie : header en dégradé qui fond vers le blanc de l'écran de travail, zones en cartes
délimitées, dock noir flottant à bouton central, police fine, icônes pleines, couleur assumée,
l'assistant dans des blocs à part. Toutes les directions le portaient ; elles ne variaient que
la typographie, la palette, la densité et un geste signature.

- **Retenue : « Lettrage d'artisan »**, le monde du camion lettré et de la vitrine de l'artisan,
  assignée par le tirage. L'entreprise se reconnaît à sa **bande de couleur** et à ses **gros
  chiffres**. Chaque carte et chaque ligne porte sur sa tranche la bande de son domaine ; les
  chiffres et les titres sont en condensé (Barlow Semi Condensed), le texte en Barlow fine.
  **Retenu contre** « Code couleur de cuisine » (l'étiquette de jour HACCP sur chaque échéance :
  parlant pour la moitié food du public, muet pour le bâtiment), « Tableau des départs »
  (challenger de catalogue, les attentes classées par échéance et la ligne changée qui reste
  allumée : juste sur le brief, mais le dirigeant food ou bâtiment ne se reconnaît pas dans un
  aéroport) et le standard de la catégorie (ce que les quatre références font, exécuté sans
  idée propre). Cinq autres challengers de catalogue ont été écartés ; chacun a cédé une
  discipline à la direction retenue : l'état se lit à la forme et pas seulement à la couleur
  (plein, cerclé, barré) ; chaque phrase de Relvo pointe sa preuve ; une palette comptée ; une
  seule famille de caractères ; la sélection se montre par un cerclage, jamais par un
  remplissage.
- **Le violet devient la livrée, et reste la voix.** La direction proposait une livrée bleu de
  travail ; le dirigeant l'a écartée : la livrée est violette, en plusieurs dégradés. Le violet
  habille donc le chrome (le ciel du header, le bouton central, l'action principale, les jauges)
  **et** marque ce qui émane de Relvo par un **bloc violet pâle signé des étoiles**. La
  convention « un élément violet vient de Relvo » n'est plus vraie telle quelle ; ce qui la
  remplace : **un bloc violet pâle avec le signe, c'est Relvo qui parle.** Moi bleu et Externe
  ambre ne bougent pas. `01-tokens.md` est récrit en conséquence.
- **Le header est un ciel étoilé à la tombée de la nuit**, demandé par le dirigeant à la place
  d'un ruban oblique : violet nuit en haut, violet de Relvo, puis le blanc. Quelques points et
  trois étoiles à quatre branches, celles du signe, qui s'effacent vers le bas. C'est du CSS,
  jamais une image. Sur la connexion, le ciel prend près de la moitié de l'écran.
- **Le bouton Relvo n'est plus un objet en relief** : c'est un disque en dégradé de violet qui
  **déborde** du dock noir, sans nacre, sans reflet, sans anneau. Le dirigeant a jugé le relief
  nacré sans rapport avec le reste. Ce qui le désigne, c'est la couleur et le débordement : il
  reste le seul objet coloré du dock. **Retenu contre** le disque gardé tel quel. Les icônes du
  dock sont pleines et gardées, l'onglet actif se lit au blanc plein et à la graisse, jamais à
  un cerclage.
- **Le burger passe à droite du header**, discret, à la place prévue à gauche : c'est ce que les
  références du dirigeant font, et ce qui laisse la gauche à l'avatar sur l'accueil et à la
  flèche retour sur les écrans poussés. Les boutons de page restent à droite, avant lui.
- **Le fond est blanc, les surfaces sont des cartes** à coins de 18 px et ombre portée douce, et
  non plus des panneaux sur pierre à trois niveaux d'élévation ; il n'y a plus de verre, plus de
  grain. Une liste reste une suite de lignes dans **une** carte, jamais une carte par ligne.
  « En attente de vous » est la seule exception, voulue : des cartes à faire défiler, une par
  sujet, parce qu'elles portent le contact, l'enjeu et le geste.
- **Les indicateurs sélectionnent par cerclage** : sur Sujets, Calendrier, Conversations et
  Contacts, l'indicateur actif est un chiffre cerclé, à distance de son libellé.
- **Pas de relance.** Le dirigeant a demandé une relance du tirage puis a confirmé la direction
  retenue ; la relance n'a pas été servie.
- **Le retour du téléphone, une fois la direction posée dans l'application.** Le dirigeant l'a
  regardée sur son compte et a tranché : le bouton Relvo est **réaxé** sur le dock, abaissé, et
  déborde **des deux côtés**, la pilule se **soulevant autour de lui** en courbe douce, comme un
  tissu tendu — il est dans la barre, pas dessus (retenu contre un disque sans débord, qui
  semblait posé sur la barre, puis contre un anneau noir, trop circulaire) ; le ciel tient sur
  **une seule rangée** — titre, actions,
  burger — et respire sous la barre d'état du téléphone, où les boutons se collaient ; l'avatar
  de l'accueil est retiré, il ne menait nulle part ; un indicateur à zéro écrit « 0 », pas un
  tiret. « Un compteur à zéro ne s'affiche pas » reste vrai pour les badges et les pastilles,
  pas pour une cellule fixe.
- **Les icônes pleines, partout.** La revue de finition a relevé que seul le dock tenait le socle
  « icônes pleines » : le menu, les avatars de canal, les onglets de la fiche et les corbeilles
  restaient en trait. Le dirigeant a tranché pour le socle : tout pictogramme est plein
  (Phosphor, graisse « fill », par un module unique), lucide ne garde que les glyphes qui sont
  un trait. **Retenu contre** l'exception écrite dans `DESIGN.md`. Les suggestions de l'échange
  quittent le pointillé violet, réservé à « vide / à compléter », pour la puce blanche à filet.

**Ce que la direction laisse au chantier qui l'habille** : les tokens dans le code, tenus par un
test ; les règles de composition et les patterns récrits dans la même matière ; le fichier de
design d'impeccable, avec ses exceptions assumées (la bande de domaine sur la tranche des cartes
est le geste signature, pas un tic d'interface générée) ; les captures du point zéro rejouées
dans la direction.

### La première connexion s'ouvre sur des diapositives, avant l'invitation à connecter une adresse

**`tranché`** · Avec le dirigeant, en reprise de la tranche 3 de M19. Précise « La prise en main
est une conversation avec Relvo » sans la rouvrir : l'échange scripté reste la prise en main,
mais il ne commence qu'à la connexion du premier canal — et avant ce canal, un nouvel
utilisateur ne voit qu'un accueil vide et un dock dont il ne sait rien.

- **Ce qui est retenu.** À la première connexion, une série de **cinq ou six diapositives à
  glisser**, une phrase courte par diapositive, qui disent ce que Relvo fait : du contexte, pas
  un mode d'emploi. Vues une seule fois ; on peut les passer. Elles débouchent sur le
  **guidage** : l'invitation à connecter sa première adresse e-mail. De là, l'échange scripté
  (M10.16) prend le relais, comme tranché.
- **Pourquoi ce n'est pas le tutoriel écarté.** Le tutoriel écarté apprenait une interface par
  des écrans et des infobulles ; les diapositives n'expliquent aucun écran, elles disent la
  promesse — ce que Relvo fera du courrier — pour que l'invitation à connecter une adresse ait
  un sens. Ce qui s'apprend, sujet, domaine, tâche, s'apprend toujours dans l'échange.
- **Retenu contre** envoyer directement le nouvel utilisateur sur la page des canaux : il y
  arriverait sans savoir pourquoi confier son courrier. **Retenu contre** faire porter ce
  contexte par le premier échange : Relvo n'a rien à lire tant qu'aucun canal n'est connecté,
  et une conversation qui commence par « connectez une adresse » est un formulaire déguisé.
- **La trace « diapositives vues » vit sur le compte** : une colonne horodatée, sur le modèle
  de `home_seen_at`, par une migration additive — la seule que M19 s'accorde, en exception
  écrite dans l'épique. **Retenu contre** le stockage du navigateur, qui se vide, et contre la
  dérivation « aucun canal connecté », qui remontrerait les diapositives à chaque connexion
  tant que l'adresse n'est pas branchée.

**Mis en œuvre par** M19.9, tranche 4 « Guider » ; `01-principes.md` §11 et `05-ia.md` §11.11
disent la séquence.

### L'échange avec Relvo : le dirigeant est l'acteur, l'annulation est un geste de l'écran, le tier se décide par règles

**`tranché`** · Avec le dirigeant, à l'ouverture de M10, puis en construisant.

- **L'acteur d'une action demandée dans l'échange est le dirigeant (`user`)**, avec sa
  provenance `source: "chat"` dans le journal (`05 §11.6`). La tâche qu'il dicte est la sienne,
  Relvo n'est que la main ; `05 §7.2` (Relvo ne valide ni ne ferme jamais une affaire) reste
  vrai, et l'invariant 6 garde son sens — « source Relvo » veut dire « Relvo l'a proposée ».
  **Retenu contre** l'acteur `ai`, qui aurait compté les gestes du dirigeant dans ce que Relvo
  fait pour lui (Bilan, invariant 37).
- **La provenance est un paramètre optionnel des fonctions d'écriture du domaine**, fusionné
  dans la métadonnée de l'entrée de journal qu'elles écrivent déjà. Aucun schéma, aucune
  signature de l'écran ne change. **Retenu contre** une entrée de journal à part, qui aurait
  séparé le geste de sa trace.
- **La fenêtre d'annulation est tenue par l'écran seulement** : cinq minutes pendant lesquelles
  « Annuler » reste actif sur le bloc, puis le geste se défait par les écrans habituels. Chaque
  bloc porte un descripteur, et une seule fonction du domaine défait par la fonction de
  l'écran — une tâche supprimée se recrée depuis son instantané. **Retenu contre** une garde
  serveur de la fenêtre : elle protégerait une chose qui reste de toute façon réversible.
- **Le tier d'un tour se décide par des règles écrites**, jamais par un appel de plus : une
  question de lecture courte sans geste passe en extraction, tout le reste en raisonnement. Les
  règles sont tenues par un test et mesurées au journal avant d'être affinées.
- **La mémoire des échanges est celle de l'appareil** (IndexedDB), comme `05 §11.3` le dit ; le
  titre d'un échange est un appel de classification à la fin du premier tour. **La notification
  push d'une question** (M18.11) glisse vers M12 (M12.9) : aucun socle push n'existe.
- **Le message système de l'échange porte le socle commun ET un socle de l'échange** —
  comment Relvo parle au dirigeant et agit —, identique pour tous les comptes d'un même secteur.
  Il diffère de celui du pipeline de ce seul bloc ; les consignes stables n'ont rien à faire
  dans le message utilisateur (`PITFALLS.md` #49).

**Mis en œuvre par** M10, tranches 1 à 5 ; `05-ia.md` §11 reste la conception, le sprint
`2026-10-m10-echange-relvo.md` l'histoire de la construction.

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
Règle générale : _un geste retiré d'une surface doit exister sur l'autre avant de disparaître._

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

### Un choix laissé par Relvo se voit, et retient l'envoi

**`tranché`** · Premier brouillon réel envoyé depuis une tâche. Le brouillon laissait, comme
prévu, la décision non prise entre crochets — « nous retenons le modèle [8 m³ / 12 m³] ». Le
dirigeant a fait le constat lui-même : pressé, il ne relit pas le brouillon, il fait confiance,
et le crochet serait parti tel quel au fournisseur.

Décisions : les choix entre crochets d'un brouillon de Relvo sont **surlignés** dans la zone de
rédaction, la barre du brouillon en **compte** le reste, et **l'envoi est retenu** tant qu'il en
reste un. Trancher, c'est remplacer le segment ; effacer le brouillon lève la retenue. Le
surlignage se fait par un calque aux mêmes métriques que le champ — jamais par du gras ni de
l'italique, qui décaleraient le curseur de saisie sous le texte affiché. Des crochets tapés à la
main, hors brouillon, ne retiennent rien.

**Ce qui n'a PAS été fait.** L'idéal exprimé — une conversation avec Relvo qui pose les choix
un à un, puis remplit le brouillon — est une proposition ci-dessous, pas un correctif. La
retenue à l'envoi en est le filet de sécurité en attendant.

### Le composer s'élargit quand on rédige un e-mail

**`tranché`** · Même essai. Le champ de rédaction, rogné à droite par le bouton d'envoi et le
trombone, ne laissait qu'une colonne étroite pour relire un e-mail de plusieurs lignes.

Le composer a désormais **deux dispositions** : compacte sur une ligne (le champ, le trombone,
le bouton rond à côté — la réponse courte de messagerie), élargie dès que le texte dépasse une
ligne ou qu'un brouillon arrive : le champ prend toute la largeur et les boutons descendent sur
une rangée sous le texte. On revient en compact quand le champ est vide. Pendant la rédaction
par Relvo, le champ montre des lignes qui respirent, pas un vide figé.

---

## Propositions

### « Affaire » plutôt que « sujet »

**`tranché`** · Par le dirigeant, à la lecture des diapositives de première connexion (M19.9),
qui disent déjà « une affaire mérite votre attention », « les affaires en cours ». « Sujet »
est impersonnel ; une affaire parle à tout le monde — on *traite* des affaires, et c'est
exactement ce qu'on fait avec Relvo. Le mot est tranché pour les diapositives ; pour le reste
du produit, la proposition est de remplacer le **mot de l'utilisateur** partout où il le lit
ou l'entend : les libellés (l'onglet « Sujets », « Nouveau sujet », les états vides, les
toasts), les phrases de Relvo (les nouvelles, le brief, les blocs, le journal), les
diapositives, la page de suivi. **Ce qui ne bouge pas** : l'entité `Subject`, les routes
(`/sujets`, `/fil`), les identifiants, les tests — un nom de code n'est pas un mot du client —,
ni les invariants numérotés, cités dans le code. **Ce qui demande une décision à part** : les
consignes du modèle (`server/ia`, deux cents occurrences) parlent de « sujet » à Relvo ; les
changer touche le tri, la structuration et la relecture, et s'évalue avec les jeux
d'évaluation, pas à l'œil. Et la documentation de conception (`01` à `05`, quatre cents
occurrences) nomme le concept « sujet » : si le mot du client change, elle se récrit en place,
dans le même chantier, jamais par une note « on dit maintenant affaire ».

**Tranché et livré dans la foulée** : l'interface, les phrases de Relvo, les titres du journal
et les messages d'erreur du domaine, les champs client des épiques, `CLAUDE.md`, et la
conception récrite en place (`01` à `05`, le design system, `uml.mermaid` pour ses libellés).
Le code garde `Subject` et ses routes. Les consignes du modèle gardent « sujet » comme nom de
concept et reçoivent une règle de vocabulaire dans le socle : tout texte destiné au dirigeant
dit « affaire » — à confirmer par les jeux d'évaluation à leur prochaine passe. L'historique
(sprints, journal du client, ce registre) n'est pas récrit.

### La maquette ne fait plus foi sur le rendu

**`tranché`** · Après l'habillage, l'application ne ressemble plus à la maquette, et la maquette
n'est jamais rebuildée. Elle reste la référence des **flux et des libellés** — ce qu'un écran
permet, et avec quels mots ; le **rendu** fait foi au rang 3, dans `design-system/`, tenu par
`globals.css` et le test des tokens. L'alternative — remettre la maquette au niveau de
l'application — aurait coûté une seconde implémentation de chaque écran, pour une référence que
personne ne regarde plus en construisant.

### La photo d'un contact

**`proposé`** · Exprimé par le dirigeant à la reprise de la fiche contact (M19.10). La carte de
visite porte un portrait — les initiales, ou la silhouette d'un visage — qui appelle une photo.
Elle demande une colonne sur le contact (la clé du fichier), le paquet de stockage pour la
déposer, et un geste sur le portrait (prendre ou choisir une photo). Aucun bouton n'est posé
tant que le geste n'existe pas : un bouton sans effet se retire. Portée par **M20**, avec les
autres gestes de la messagerie.

### La vue Mois est une grille à pastilles, pas un mur de puces

**`tranché`** · La vue Mois rendait chaque tâche datée en puce de texte tronqué sur l'aplat de
son domaine — soixante-neuf puces sur un mois chargé, illisibles. Retenu, parmi trois formes
(borner les puces ; retirer la vue ; la grille) : **la grille en carte**, chaque case un chiffre
et jusqu'à trois pastilles de domaine, le tap qui sélectionne le jour et pose sa liste sous la
grille, le glissé depuis cette liste vers une case. C'est la grammaire de la semaine réutilisée :
le mois sert à naviguer et à replanifier, pas à lire. L'invariant 15 reste tenu ; ce qui change,
c'est ce qu'on glisse. Item **M12.8**.

### Le compte des nouveaux messages se lit sur l'affaire aussi

**`tranché`** · Le brief réservait la pastille de non-lus à la conversation. Le dirigeant a tranché
l'inverse : une affaire qui a reçu trois messages **a bougé**, et il faut le lui dire là où il
regarde l'affaire — le chiffre est pertinent sur l'élément « affaire » lui-même, pas seulement
sur la page Affaires. Le brief est amendé : le non-lu se compte sur la conversation **et** sur
l'affaire, partout où elle se rend en ligne ou en carte. Le code le faisait déjà ; c'est la règle
qui rejoint le code.

### Les usages de la messagerie forment une épique à part, après le cœur IA

**`tranché`** · La dictée, l'envoi de pièces jointes et la photo d'un contact ne sont pas trois
items isolés : avec l'écoute et la lecture des messages vocaux reçus, la possibilité d'en laisser
un et la transcription, ils forment **tout ce qui rend la messagerie de Relvo aussi naturelle que
celle du téléphone**. Retenu : une épique dédiée, **M20**, après M7 et M10 — plutôt que de les
disperser dans M10 ou de les reporter sans adresse. Le benchmark des coûts proportionnels (voix,
vision) en est le premier item, pas un préalable extérieur.

### Trancher les choix d'un brouillon avec Relvo, avant de remplir l'e-mail

**`proposé`** · Exprimé par le dirigeant au premier brouillon réel. Quand un brouillon laisse des
choix entre crochets, l'appui sur « Répondre » pourrait d'abord ouvrir un court échange avec
Relvo — une question par choix, dans les mots du sujet — et ne poser le brouillon qu'une fois les
choix tranchés, sans crochet. C'est la suite naturelle du surlignage et de la retenue à l'envoi,
qui restent le filet de sécurité. À reprendre avec l'échange avec Relvo (M10), qui en est le
support ; le brouillon est alors rédigé après l'échange, pas avant.

### Benchmarker la transcription vocale et la vision avant de figer leurs tiers

**`proposé`** · Les deux extensions dont le coût est proportionnel à la durée ou à l'image, pas au
nombre de messages. Le modèle de coût ne les chiffre pas encore ; les tarifs de reconnaissance
vocale et de vision des fournisseurs retenus sont à relever, et les deux postes à ajouter au
script de coût et au disjoncteur, avec une garde par minute d'audio et par image.

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
dans la barre d'onglets disparaît avec le tri manuel. **Gardées dans le dock** à la disposition
générale (« La disposition générale : quatre vues, Relvo au centre ») : le dirigeant ne peut pas
trancher aujourd'hui, c'est l'usage après M7 qui décidera.

### Rouvrir la disposition générale : menus, place de l'échange, page d'accueil

**`proposé` — tranché** · Les trois questions — la position des menus et l'intérêt d'un menu
« burger », la place de l'échange avec Relvo, la page d'accueil — sont tranchées dans « La
disposition générale : quatre vues, Relvo au centre, un menu pour le reste », plus haut.
