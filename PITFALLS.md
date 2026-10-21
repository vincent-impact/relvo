# PITFALLS.md — Registre des pièges

> **Ce fichier reste dans le dépôt.** Il n'est jamais recopié dans `CLAUDE.md` : `CLAUDE.md` y
> renvoie. Une copie diverge de son original en quelques semaines.
>
> **Chaque piège a coûté une session de débogage réelle.** Ce ne sont pas des bonnes pratiques :
> ce sont des symptômes observés, avec leur cause.
>
> **Un numéro n'est jamais réattribué**, même si un piège devient faux — on le marque périmé, on
> ne recycle pas son numéro. Même convention que les identifiants de backlog.

**Registre de référence : `~/Desktop/SCAFFOLD/PITFALLS.md` (génération `2026.08.28`).**

> ⚠️ **Ce registre n'est pas versionné, et c'est un problème connu.** Tant que le kit vit dans un
> dossier local, la remontée d'un piège dépend d'une copie manuelle vers une machine — ce qui,
> par construction, ne survit pas à un changement de poste et ne se relit pas en équipe.
> **Versionner le kit est la première correction à lui apporter.** En attendant, la remontée se
> fait à la main, dans la même session, comme l'exige la
> [Definition of Done](backlog/definition-of-done.md).

**Portée.** Ce registre est écrit contre **Next 16 · React 19 · Tailwind 4 · Base UI · Prisma 7 ·
Auth.js v5 · Zod 4 · AWS SDK v3 · pnpm 9 · Node 22**. Voir le tableau d'adhérence en fin de
fichier avant de s'y fier après une montée de version.

**Origine.** Les pièges **#8 à #13, #19, #22, #23 et #45 à #48** ont été payés **sur ce projet**.
Les autres viennent du kit et sont conservés ici parce qu'ils s'appliquent à cette stack.

---

## Base de données et migrations

| # | Piège | Règle |
|---|---|---|
| 1 | **Prisma 7 ≠ le Prisma des docs** | Driver adapter obligatoire + config CLI dans `prisma.config.ts`, plus dans le bloc `datasource`. La majorité des tutoriels décrivent Prisma 5/6. |
| 2 | **Pooler ≠ migrations** | Runtime sur l'URL **poolée**, CLI sur l'URL **directe**. Le pooler casse les migrations (verrous de session). |
| 3 | **Région** | Fonctions épinglées sur la région de la base, sinon des erreurs de latence en transaction. Corollaire : mutations à **nombre de requêtes constant**. |
| 4 | **Pool serverless** | Pool borné, délai d'inactivité court, singleton global — sinon le rechargement à chaud épuise le pool. |
| 19 | **Cascades et fichiers** | L'ORM est **structurellement aveugle aux cascades**, exécutées par la base. Toute table portant une clé d'objet reçoit son **trigger vers l'outbox de suppression dans la même migration**. |
| 33 | **Client périmé après une migration** | Le symptôme est **inversé et trompeur** : « la colonne X n'existe pas » alors que la base est juste et que c'est le **client** qui est décalé. Réflexe : régénérer après **toute** migration, avant de relancer les tests. |
| 35 | **Commenter une migration déjà appliquée casse sa somme de contrôle** | L'outil enregistre le hachage du fichier. Ajouter un commentaire après coup fait échouer la migration suivante, et l'outil propose un **reset** — c'est-à-dire de vider la base. Écrire les commentaires **avant** d'appliquer. |
| 36 | **Contraintes que l'ORM ne sait pas exprimer** | Vérifications, unicité partielle, exclusions s'écrivent **à la main dans la migration**. Une règle qui ne vit que dans le code applicatif est contournée par le premier script d'import venu. |
| **37** | **Une clé étrangère composite écrite à la main DÉRIVE ; un trigger, non** | Le complément du #36, et il **inverse la conclusion**. L'ORM ignore les vérifications et les triggers, mais il **modélise** les clés étrangères et les index : une clé composite ajoutée à la main lui apparaît comme une **dérive**, et la migration suivante propose de la **SUPPRIMER**. Le garde-fou disparaît alors dans un changement sans rapport apparent. Pour une règle qui croise deux tables : **trigger de contrainte**, jamais clé composite. ✅ **Contrôlé en CI.** |
| 44 | **Une migration de données rejouée sur une base qui les contient déjà** | Échoue sur une contrainte d'unicité, et l'outil propose un **reset**. Remède : déclarer la migration déjà jouée, jamais un reset. |

> ⚠️ **Une migration de données ne se vérifie pas par relecture.** Le seul contrôle qui ne ment
> pas est de **rejouer toute la chaîne sur une base vierge et de recompter**. C'est ce qui a été
> fait pour la migration qui a créé les conversations — la première du projet à **créer** de la
> donnée plutôt qu'à déplacer des colonnes.

## Authentification et routes

| # | Piège | Règle |
|---|---|---|
| 5 | **Le fichier de middleware a changé de nom** | En Next 16 il s'appelle **`proxy.ts`**. |
| **5b** | **Emplacement du `proxy.ts`** | Avec un dossier `src/`, il va **dans `src/`**, au même niveau que `app/`. Posé à la racine de l'application, il n'est **jamais compilé** : aucune erreur, aucun avertissement, et le gating ne s'applique plus. Deux contrôles fiables : la ligne `ƒ Proxy (Middleware)` en fin de build, et la redirection vers la connexion qui porte le **paramètre de retour**. ⚠️ **Le manifeste de middleware n'est PAS un indicateur** — il reste vide même quand le proxy fonctionne. ✅ **Contrôlé en CI.** |
| **5c** | **Forme de l'export du `proxy.ts`** | Un export issu d'une **déstructuration** marche en développement mais fait échouer le build : l'analyse statique ne le reconnaît pas. Écrire une constante intermédiaire, puis un export par défaut. ✅ **CONFIRMÉ sur Next 16.2.7** (le doute est levé) : `export const { auth: proxy } = NextAuth(config)` fait échouer le build avec « *must export a function, either as a default export or as a named "proxy" export* ». ⚠️ **Le piège ne se voit QUE si #5b est déjà corrigé** — un fichier au mauvais endroit n'est pas compilé, donc son export n'est jamais analysé : les deux se réparent dans le même geste, jamais l'un sans l'autre. |
| 6 | **La config d'authentification du proxy doit être edge-safe** | Aucun import Node — ni ORM, ni bibliothèque de hachage. Un seul suffit à casser le proxy à l'exécution. |
| 7 | **Provider conditionnel** | Le fournisseur externe n'est branché que si **les deux** clés sont présentes, sinon le premier démarrage d'un poste non configuré explose. |
| 21 | **Un fournisseur externe est une inscription publique déguisée** | Hors mode public, le callback de connexion doit **refuser** une adresse inconnue. Le montage par défaut fait entrer n'importe qui. |
| 30 | **Une Server Action n'est pas protégée par le proxy** | Le proxy raisonne sur des **chemins** ; une action n'en a pas. Toute action sensible revérifie la session **elle-même**, en première ligne. |
| **64** | **Le proxy ne voit que les callbacks de la configuration edge** | Le callback `session` (jeton → session, pur) vit dans `auth.config.ts`, sinon `auth.user.role` est vide dans `authorized` et la zone d'administration renvoie tout le monde. |

> ✅ **#5b et #5c corrigés le 2026-09-07** : `proxy.ts` déplacé dans `src/` et son export passé
> en `export default`. Le build affiche `ƒ Proxy (Middleware)`, et la redirection vers la
> connexion porte de nouveau `callbackUrl` — la destination n'est plus perdue.
>
> ⚠️ **Ce que la garde explicite ne couvre toujours pas** : le proxy raisonne sur des CHEMINS.
> Les Server Actions n'en ont pas (#30), et le `matcher` exclut `/api`. La protection par
> ricochet — toute lecture passe par le client conscient du tenant — reste donc la ligne qui
> compte pour tout ce qui n'est pas une navigation de page. Ne pas la relâcher sous prétexte
> que le proxy tourne enfin.

## Fichiers et stockage

| # | Piège | Règle |
|---|---|---|
| **8** | **Deux réglages du SDK, non négociables** | **(a)** Sans contrainte explicite sur l'en-tête de type de contenu, la signature ne contraint **rien** : un dépôt en HTML sur une URL signée pour un PDF renvoyait **200**, et le mauvais type était stocké. L'allowlist ne servait à rien. **(b)** Sans passer les sommes de contrôle en « à la demande », le SDK signe le CRC du **corps vide** — le fournisseur les ignore aujourd'hui, mais nos dépôts passaient **par chance**. ⚠️ Ces deux propriétés dépendent de **défauts du SDK qui ont déjà changé une fois** et cassent en silence : l'envoi continue de marcher, seule la garantie disparaît. **Verrouillées par un test.** |
| **9** | **Juridiction du bucket figée** | Elle change l'endpoint et **ne se change plus** après création. Se tromper donne des erreurs opaques, pas un message explicite. |
| **10** | **Afficher un fichier = une URL stable, jamais signée** | Route de téléchargement → **redirection** vers le stockage. Jamais d'URL signée dans l'optimiseur d'images : la clé de cache inclut la chaîne de requête, donc une signature qui tourne = manque de cache + transformation **facturée** à chaque rendu. Cas documenté : dix images, plus de cent cinquante transformations en douze heures. |
| **11** | **Jamais de fichier streamé par une fonction** | Redirection, pas proxy. Le corps d'une réponse est plafonné, et une fonction serverless est « une couche d'API légère, pas un serveur de médias ». |
| **12** | **Cache CDN et cookies** | Toute route servant de la donnée d'un compte envoie un cache **privé** et interdit le cache CDN. La clé de cache d'un CDN est méthode + URL, **sans aucun en-tête de requête** : une route authentifiée par cookie a donc la **même clé pour tous les utilisateurs**. Incident public documenté : un cache activé par accident a servi les requêtes d'un utilisateur à un autre ; seules les applications qui envoyaient explicitement un cache privé ont été épargnées. |
| 13 | **Tâche périodique publique** | La route vérifie un secret et répond 401 sinon. Sans ça, elle est ouverte. |

## Outillage

| # | Piège | Règle |
|---|---|---|
| 14 | **Racine de traçage des fichiers** | Posée dès le départ dans un workspace, sinon des fichiers manquants **en production seulement** : le traçage part du dossier de l'app et rate tout ce qui vit à la racine. |
| 15 | **Tailwind v4** | Pas de fichier de configuration. Un rayon depuis une variable s'écrit avec des **parenthèses** ; avec des crochets, il ne produit rien, silencieusement. |
| 16 | **Le registre de composants, et son répertoire de travail** | Interroger le registre **avant** de créer le moindre composant. ⚠️ « Aucun registre configuré » ne veut **pas** dire qu'il manque une déclaration : le serveur lit sa configuration **dans son répertoire de travail**, qui n'est pas la racine d'un monorepo — d'où l'option de répertoire dans la déclaration du serveur. **Ne pas déclarer le registre intégré pour autant** : le redéclarer rend le fichier invalide. |
| **29** | **Un filtre de workspace sans `exec` devant un binaire** | Il cherche un **script** du même nom, n'en trouve pas, **ne fait rien**, et **sort en code 0** : l'étape passe au vert sans avoir rien migré. Le piège le plus insidieux du registre. |
| 40 | **Les primitives enveloppent Base UI, pas Radix** | La propriété de composition a changé de nom, et un bouton qui rend un lien exige **en plus** de déclarer qu'il n'est pas un bouton natif. ⚠️ Cette seconde moitié **compile, passe le lint, passe les tests et rend un 200** : l'erreur n'existe que dans la console du navigateur. |
| 41 | **Un type structurel n'arrête pas ce qui ne doit pas traverser la frontière client** | Un composant client déclare un type de props étroit, on lui passe l'objet complet, et **le typage l'accepte** — un objet plus riche satisfait le type. L'erreur ne se voit ni au typage, ni au lint, ni dans un test : seulement au rendu. Remède : **projection explicite champ par champ**, jamais l'objet entier. |
| **65** | **Un `filter: drop-shadow` CSS sur une barre aux enfants animés** | Sur iOS, la couche du filtre est redessinée entière à chaque changement d'un descendant et montre un rectangle blanc qui scintille. Une ombre qui suit une silhouette se dessine dans un SVG statique (`feDropShadow`), le contenu animé au-dessus. |
| 42 | **Un défaut posé sous un « optionnel » ne court-circuite rien** | Le défaut s'applique quand même quand la clé est absente. Conséquence sur une fiche faite de blocs qui s'enregistrent séparément : enregistrer une section **efface** les autres. ⚠️ **Le vrai piège est le TEST** : une suite qui poste toujours *tous* les champs ne peut pas le voir. |

## Tests

| # | Piège | Règle |
|---|---|---|
| **22** | **Tests d'intégration en parallèle** | Parallélisme entre fichiers **désactivé**. Des tests qui écrivent dans la même base en parallèle échouent **par intermittence** — la pire façon de perdre confiance dans une suite. |
| **23** | **Base de test ≠ base de dev** | Le nom de la base de test est **dérivé** de celle de développement, jamais égal. Les tests **tronquent des tables** : trois lignes qui évitent d'effacer sa base de travail un vendredi soir. |
| 26 | **La CI n'est pas un garde-fou de déploiement** | La CI et la plateforme de déploiement sont deux systèmes indépendants : elle déploie même si les tests échouent. Acceptable tant qu'il n'y a pas d'utilisateurs réels. |
| 34 | **Le garde-fou « serveur uniquement » rend le code serveur intestable** | Le paquet **lève à l'import** dès que le résolveur retient sa condition navigateur — ce que fait l'outil de test. Le message parle de composant client et n'a rien à voir avec le test. Remède : aliaser vers un stub vide **dans le projet de test uniquement**. |

## Hygiène

| # | Piège | Règle |
|---|---|---|
| 17 | **Un seul build concurrent sur les offres d'entrée** | Ne pas cumuler un déploiement en ligne de commande et un déploiement automatique : le second s'empile et paraît figé. |
| **20** | **Doc et code dans le même commit — nécessaire, PAS suffisant** | ⚠️ **Cette règle a été respectée à la lettre tout en laissant passer quatre documents faux.** Le commit qui a remplacé la fiche sujet a modifié **six lignes** de la carte du projet, pour près de huit cents lignes de code supprimées — et quatre documents de conception ont continué à décrire l'ancienne conception. **L'auteur met à jour ce à quoi il pense, c'est-à-dire le récit ; il n'a aucune raison de relire une liste.** La discipline protège l'**intention** ; l'**inventaire** demande un test. |
| 24 | **Une preview qui migre la production** | Le build exécute les migrations, previews comprises. Sans isolation par branche, pousser une branche de travail applique ses migrations à la **production**. À vérifier **avant** le premier push de branche. |
| 25 | **URL d'authentification sur le domaine de déploiement** | Liens d'e-mail cassés, découverts à la première réinitialisation de mot de passe — c'est-à-dire au pire moment. Basculer en même temps que le domaine. |
| 27 | **Secrets** | Les fichiers d'environnement sont ignorés sauf l'exemple, vérifié **avant** le premier commit. Un secret poussé, même sur un dépôt privé, même supprimé ensuite, est un secret à **révoquer**. |
| 28 | **Port de la base locale** | Exposer un port **dédié**, pas celui par défaut : il est presque toujours déjà pris, et le symptôme — une connexion qui aboutit sur la **mauvaise base** — est bien plus long à diagnostiquer qu'un port refusé. ⚠️ **Non appliqué sur ce projet**, cf. `backlog/ecarts-et-propositions.md`. |

---

## Pièges appris sur ce projet et absents du kit

### #45 — Un webhook qui écrit en base doit INVALIDER LE CACHE DE DONNÉES

**Symptôme** : un message arrive, il est bien écrit en base, et **l'interface ne le voit pas** —
quel que soit le réglage de fréquence de rafraîchissement. Augmenter la fréquence ne change rien,
ce qui envoie chercher le problème du mauvais côté.

**Cause** : les lectures passent par un cache de données à durée de vie longue. Le
rafraîchissement re-demande la page, mais le cache resert du contenu périmé. Le rafraîchissement
n'a jamais été en cause.

**Règle** : **toute écriture venue d'un webhook invalide explicitement le cache du tenant**, au
moment de l'écriture. Et le cache de navigation côté client doit être borné en conséquence.

⚠️ **C'est un piège d'architecture, pas de version.** Il ressort dès qu'on combine un cache de
données côté serveur et une source d'écriture qui n'est pas une action utilisateur.

### #46 — Un script de workspace « récursif si présent » SORT EN 0 quand il disparaît

**Symptôme** : la CI est verte et rien n'a été vérifié.

**Cause** : la forme récursive « si présent » n'échoue pas quand aucun paquet ne porte le script.
Le jour où le script est renommé ou retiré du paquet cible, l'étape passe au vert **sans rien
exécuter**.

**Règle** : à la racine, des **filtres explicites**, jamais la forme récursive conditionnelle sur
un déployable unique. Même famille que **#29** : une commande qui ne fait rien et sort en 0 est
pire qu'une commande qui échoue.

### #47 — Le contrôle de dérive de schéma a une option dédiée : ne pas grepper une chaîne

**Symptôme** : un contrôle de CI qui cherche une phrase dans la sortie d'une commande casse à la
première montée de version — ou au premier changement de langue de l'outil.

**Règle** : la commande de comparaison de schéma expose un **code de sortie dédié** (diff vide,
erreur, diff non vide). L'utiliser, et ne grepper **aucune chaîne**.

⚠️ **Correction à remonter au kit** : le kit décrit ce contrôle sous forme de `grep`. Il expose
aussi une invocation obsolète — les options d'URL directe ont été retirées en Prisma 7 au profit
d'une option lisant la configuration.

---

### #48 — Une page qui défile par le document ne peut PAS vivre sous le layout racine de l'application

**Symptôme** : une page « hors de l'application » (le suivi client) **ne défile plus sur
mobile** — le doigt glisse, rien ne bouge. Sur ordinateur, tout va bien.

**Cause** : le layout racine de l'application porte un **garde anti-rebond iOS** : un écouteur
`touchmove` non passif qui **annule tout geste vertical** dès qu'aucun ancêtre `overflow: auto`
ne peut l'absorber. Dans l'application, chaque écran défile dans un cadre interne, donc le garde
ne voit jamais un geste orphelin. Une page qui défile **par le document** n'a pas de tel ancêtre :
chacun de ses gestes est annulé. Le même layout impose aussi le verrou portrait, le blocage du
zoom et les métadonnées PWA — autant de contraintes qu'un lecteur externe n'a pas à subir.

**Règle** : le dépôt a **deux layouts racine**, par groupes de routes — `(shell)` pour
l'application et sa coquille, `(public)` pour ce qui se lit hors d'elle. Une page publique se
crée dans `(public)`, **jamais** à la racine de `app/` : il n'y a plus de layout à cet endroit,
elle serait orpheline. ⚠️ Ne pas « corriger » en assouplissant le garde : sa condition a été
payée par la saga du viewport (#5 bis dans le kit) et se casse à la première exception.

### #49 — Un caractère modifié DANS le message système annule TOUT son cache de prompt

**Symptôme** : la couche Produit (près de deux mille jetons, identique pour tous les appels) n'est
**jamais** relue depuis le cache, alors que le fournisseur annonce un cache implicite sur le
préfixe. Le compteur `cache_read` reste à zéro d'un appel à l'autre, et la facture d'entrée est
pleine sur chaque message.

**Cause** : la liste des sujets ouverts du compte — qui change à chaque sujet — était concaténée
**à la fin du même message système** que la couche Produit. Mesuré sur le fournisseur retenu :
un message système qui diffère de quelques dizaines de jetons à sa fin obtient **zéro** jeton en
cache, pas « le préfixe commun » ; alors qu'un message système strictement identique suivi d'un
message utilisateur différent obtient tout le message système en cache. Le cache n'est pas
« le plus long préfixe commun », il s'arrête à la frontière des messages.

**Règle** : **le message système ne porte que ce qui est identique pour tous les comptes d'un
même secteur** — la couche Produit. Tout ce qui varie par compte ou par appel (domaines, sujets
ouverts, date, fil) va dans le message utilisateur, dans l'ordre du plus stable au plus volatil.
Un test tient l'invariant (`test/ia-produit.test.ts`) ; le jeu d'évaluation affiche `cache_read`
pour que la régression se voie.

### #50 — Une réponse e-mail porte l'objet du FIL, jamais le titre du sujet

**Symptôme** : l'utilisateur répond depuis une conversation, le toast dit « E-mail envoyé »,
l'e-mail part bien… et n'apparaît pas dans la conversation. Il a atterri dans une conversation
**fantôme**, rattachée au même sujet, avec un autre objet.

**Cause** : la clé d'une conversation e-mail est `email:<objet normalisé>:<set de
destinataires>`. Le composer construisait l'objet de la réponse à partir du **titre du sujet**
(« Re: Remplacement de la chambre froide »), qui diffère de l'objet du fil (« Devis n° 2026-418 —
remplacement de la chambre froide ») dès que le titre a été retouché — par l'utilisateur, ou par
le tri qui nomme le sujet dans les mots du dirigeant. Les tests ne l'attrapaient pas : ils
passaient un objet **égal** à celui du fil.

**Règle** : le domaine dérive l'objet de la réponse **de la conversation** (`replySubjectLine`,
appelée par `sendEmailReply` quand on lui passe `conversationId`) ; l'interface ne fabrique
jamais un objet d'e-mail. Un test envoie une réponse depuis un sujet dont le titre diffère de
l'objet et vérifie que la conversation reste unique (`packages/db/test/brouillon.test.ts`).

---

### #51 — Le composant de notifications résout « system » contre le TÉLÉPHONE, pas contre l'app

**Symptôme** : sur un iPhone en mode sombre, le toast « Sujet fermé » proposait d'ignorer le fil
en texte gris clair sur fond blanc — illisible. Sur le poste de développement, tout est lisible.

**Cause** : le wrapper du registre lit le thème via `next-themes` — que l'application n'installe
pas : `useTheme()` répond donc `system`, et Sonner résout « system » contre
`prefers-color-scheme`. Le téléphone est sombre → Sonner passe en thème sombre et colore sa
description en gris clair, pendant que notre surcharge de `--normal-bg` garde le fond blanc de
l'app. Relvo est **clair seulement** : la classe `.dark` n'est jamais posée, aucun fournisseur
de thème ne tourne. Tout composant qui déduit son thème du système au lieu de l'app dérive de
la même façon.

**Règle** : `theme="light"` sur le Toaster, description sur nos jetons. Un composant qui propose
un thème `system` reçoit **toujours** le thème de l'application, jamais celui de l'appareil.

---

### #52 — La CLI du registre ajoute un paquet `cn` fantôme et importe `cn` depuis lui

**Symptôme** : après `shadcn add`, le composant généré commence par `import { cn } from "cn"`
et `package.json` a gagné une dépendance `"cn"` — un paquet npm sans rapport avec notre
`cn()` de `lib/utils`. Tout compile, le lint passe, la page rend : seules les classes
conditionnelles se comportent autrement.

**Cause** : le style `base-maia` du registre déclare l'alias `cn` d'une façon que la CLI ne
résout pas contre `components.json` ; elle prend le nom pour un paquet et l'installe. La même
commande propose au passage d'**écraser** `button.tsx`.

**Règle** : après chaque `shadcn add`, relire le diff de `package.json` et la ligne d'import
du fichier généré ; retirer le paquet (`pnpm remove cn`), pointer l'import sur `@/lib/utils`,
refuser l'écrasement des primitives déjà adaptées au thème.

---

### #53 — Le statut de connexion stocké n'est PAS la vérité — un message reçu la prouve, le fournisseur la dit

**Symptôme** : la page Canaux affiche « En attente » sur une boîte e-mail qui livre tout son
courrier. Remonté par un bêta-testeur, sur un compte connecté depuis des jours.

**Cause** : le badge ne lisait que `ChannelConfig.status`, un **souvenir** de ce que le
fournisseur avait dit un jour. Or l'action Reconnecter passait le canal « en attente » **avant**
même que l'utilisateur ait vu la page du fournisseur ; l'icône ⟳ ressemble à un « rafraîchir »,
on la touche, on referme — et le canal reste « En attente » pour toujours, courrier livré ou
pas. Rien ne le corrigeait : ni les messages qui arrivaient, ni l'affichage.

**Règle** : un statut stocké se **répare par les faits**, il ne se croit jamais sur parole.
(1) **Recevoir prouve la connexion** : l'ingestion passe un canal « en attente » ou « en
erreur » à « connecté » (`confirmChannelConnected`, testé dans
`packages/db/test/channel-status.test.ts`) ; un canal désactivé ne se rallume pas. (2) **Seul
le fournisseur dit l'état d'un compte** : l'action Reconnecter ne touche plus au statut, c'est
le `notify`, le webhook d'état ou la page qui l'écrivent. (3) La page Canaux **réconcilie** le
badge avec l'état des sources du compte, à chaque affichage, best-effort et bornée dans le
temps. (4) Une **seule table** traduit le vocabulaire du fournisseur
(`server/unipile/status.ts`, testée) — et un libellé inconnu **ne change rien** : un statut
deviné est pire qu'un statut inchangé. (5) Le bouton Reconnecter **n'apparaît que sur un canal
qui n'est pas connecté** : sur un canal qui marche, il n'a pas de sens et il invite au faux pas.

---

### #54 — Sur Android, la barre de navigation système d'une PWA installée n'obéit PAS à la page

**Symptôme** : sous le dock violet, une bande gris clair (`#f6f6f6`) qui porte le trait d'accueil
d'Android. Rien de tel sur iPhone. Remonté par un bêta-testeur, sur une app installée.

**Cause** : ce n'est pas notre pixel. La bande est la **barre de navigation système**, hors du
viewport, peinte par le navigateur. Le manifest n'a pas de champ pour elle, et jusqu'à Chrome
**152**, une app installée (WebAPK) la laissait à la couleur par défaut de la plateforme — la
barre d'état prenait `theme_color`, la barre de navigation non. Chrome **153** (août 2026)
réutilise `theme_color` pour les deux (`WebappIntentDataProvider.getNavigationBarColor`,
drapeau `WebAppNavigationBarThemeColor`, actif par défaut). Le mode bord à bord des apps
installées (`WebAppShortEdgesCutoutMode`), qui rendrait la barre transparente sur notre dock,
reste désactivé par défaut.

**Règle** : ne **rien** changer côté page — `theme_color` violet, `viewport-fit=cover` et le
dock qui respecte `safe-area-inset-bottom` sont déjà ce qu'attend Chrome, aujourd'hui et le
jour du bord à bord. Une bande claire sous le dock sur Android = **Chrome à mettre à jour**
(≥ 153), pas un bug à chercher dans le CSS. Vérifier la version de Chrome du téléphone avant
toute autre hypothèse.

---

### #55 — Le serveur est à Greenwich, le dirigeant est en France — et le modèle lit l'horloge qu'on lui donne

**Symptôme** : un interlocuteur écrit « j'arrive dans 1h » à 19h31. Relvo pose le rendez-vous à
**18h**. Remonté par un bêta-testeur.

**Cause** : deux manques qui se cumulent. Le modèle n'avait **aucune horloge** — la couche
Instant lui donnait la date, jamais l'heure — et le seul repère horaire qu'il voyait était
l'horodatage du message, rendu **en UTC** (`recuLe.slice(0, 16)`). À 19h31 à Paris, il lisait
17h31, ajoutait une heure, et écrivait 18h. Deux heures d'écart l'été, une l'hiver. La même
racine décalait le jour civil : jusqu'à deux heures après minuit, `toISOString().slice(0, 10)`
rend encore **la veille** — « aujourd'hui », « en retard », le rail du Calendrier et le mois
affiché basculaient tous à minuit UTC.

**Règle** : **l'heure de Relvo est l'heure française**, et elle a un domicile unique —
`packages/db/src/domain/temps.ts`, importé dans l'application par `@relvo/db/temps` (le barrel
instancie Prisma : inutilisable côté client et sous vitest). Trois lignes à tenir :

1. **Un instant ne se lit jamais avec `getUTC*` ni `toISOString()`.** Un jour civil, une heure,
   un horodatage passent par ce module — qui passe lui-même par `Intl`, seul moyen correct :
   l'heure d'été n'est pas un décalage constant, et la coder à la main est le bug qu'on croit
   avoir évité.
2. **Le modèle reçoit une horloge et le nom de son fuseau**, et l'horodatage de chaque message
   est dans ce même fuseau. La même heure entre et sort.
3. **Une heure de calendrier reste nue.** `start_date` et `start_time` sont ce que le dirigeant
   écrirait sur son agenda, stockés sans fuseau et affichés tels quels (`timeZone: "UTC"` sur
   une valeur nue = la rendre inchangée). Ne jamais « convertir » une heure nue : elle EST déjà
   l'heure française.

Les bascules d'heure et le créneau d'après minuit sont tenus par un test
(`packages/db/test/temps.test.ts`) — ils ne se vérifient pas à la lecture.

---

### #56 — Les installeurs de skills de design n'installent PAS ce qu'ils annoncent, ni là où ils le disent

**Symptôme** : après `uipro init --ai claude --global`, **six** skills apparaissent dans
`~/.claude/skills` au lieu d'une — dont `ui-styling`, qui enseigne shadcn **sur Radix**
(`asChild`), exactement le piège #40 que ce projet a payé. Après `impeccable install --global`,
le hook (`SessionStart`, `PostToolUse`, `Stop`) est écrit dans `.claude/settings.local.json`
**du dossier courant**, pas au niveau utilisateur : lancé depuis un dossier temporaire, il
n'existe nulle part. Et `skills add … -s a,b,c` ne retient qu'un nom : il faut **un `-s` par
skill**.

**Règle** : après toute installation de skill, **lister** `~/.claude/skills` et `git status`,
et vérifier le hook dans le fichier qu'on croit. Les extras de ui-ux-pro-max vivent dans
`~/.claude/skills/.trash/` ; seuls `ui-ux-pro-max` et `design-system` restent. Le hook
d'impeccable vit dans `.claude/settings.local.json` **du projet** (ignoré par git), avec les
réglages locaux existants fusionnés — jamais remplacés. Son moteur de recherche a un biais
« page de vente » : une requête non dirigée rend un pattern de storytelling au défilement ; les
directions de M19.3 se demandent avec le vocabulaire du brief, jamais en une phrase.

---

### #57 — Le journal du client régresse en silence si `CHANGELOG.md` n'est pas régénéré après chaque commit `feat`/`fix`

**Symptôme** : au démarrage du serveur, `git status` montre `apps/web/src/generated/suivi.json`
modifié — et le diff **supprime** des jours entiers du journal client. Rien n'a cassé : `predev`
et `prebuild` régénèrent `suivi.json` depuis `CHANGELOG.md`, et ce dernier, lui, n'est produit
que par `pnpm changelog` depuis le `git log`. Si les derniers commits `feat`/`fix` ont été
poussés sans relancer `pnpm changelog`, le `CHANGELOG.md` commité est en retard d'autant, et
le build de production publie une page de suivi **amputée** des dernières livraisons — alors
que le `suivi.json` commité, lui, les avait, parce qu'il avait été généré depuis un
`CHANGELOG.md` local jamais commité.

**Règle** : `pnpm changelog` puis `node scripts/generate-suivi.mjs` après **chaque** commit
`feat`/`fix`, et les deux fichiers générés partent dans ce commit (amend, le dépôt est tenu
seul) ou dans le suivant — **jamais après le push**. Un `suivi.json` qui bouge au `pnpm dev`
sans qu'on ait rien changé est le signal qu'un commit a été oublié : régénérer le CHANGELOG
d'abord, regarder le diff ensuite.

### #58 — Une icône Phosphor passée en ENFANT d'un composant client depuis un composant serveur déclenche « Each child in a list should have a unique key »

**Symptôme** : un avertissement React de clé manquante, attribué à un composant qui n'a aucune
liste (« Check the render method of `SubjectBody` »), reproductible à chaque rendu d'un seul
onglet. Rien dans le `map()` en cause : toutes les clés sont là.

**Cause** : un pictogramme Phosphor (`shared/picto.tsx`, entrée SSR) rendu dans la page
**serveur**, puis passé via `children` à un composant **client** (`AttachmentViewer`). Le
rendu serveur de l'icône est une `<svg>` dont les chemins forment un tableau sans clés ; ce
tableau traverse la frontière serveur/client sérialisé, et le client le reçoit comme une liste
d'enfants dynamique. Le même pictogramme rendu directement dans un composant client, ou dans
un composant serveur sans traverser de frontière, ne pose rien.

**Règle** : un pictogramme destiné à l'intérieur d'un composant client se rend **dans** un
composant client — faire de la ligne un composant client (`DocumentRow`) plutôt que de passer
l'icône en enfant depuis la page. Pour trouver le coupable d'un avertissement de clé sans
liste : retirer le composant client suspect du rendu et recapturer, l'avertissement tombe.

### #59 — Un composant du registre qui formate un nombre selon la locale rend un texte ARIA différent entre le serveur et le téléphone

**Symptôme** : une erreur d'hydratation reproductible à chaque chargement d'une page qui ne
contient ni date, ni `Math.random`, ni `window` — ici l'Usage. React montre
`aria-valuetext="32%"` côté serveur et `aria-valuetext="32 %"` côté client.

**Cause** : la jauge du registre (`Progress`, Base UI) écrit son `aria-valuetext` avec
`Intl.NumberFormat` **sans locale** : sur le serveur, c'est la locale du processus Node
(`en-US` sur Vercel comme en `pnpm dev`, « 32% »), sur le téléphone celle du navigateur
(`fr-FR`, « 32 % » avec une espace fine). Le chiffre visible, lui, est une chaîne à nous et ne
bouge pas : la divergence est invisible à l'œil et bruyante en console.

**Règle** : tout composant du registre qui formate une valeur (jauge, compteur, date) reçoit
sa `locale` explicitement (`locale="fr-FR"`), jamais celle du processus. Devant une erreur
d'hydratation sans cause évidente, lire l'attribut que React nomme et chercher qui le
formate.

### #60 — Une `redirect()` dans une Server Action retombe sur le cache du routeur, qui a mémorisé la page cible comme une REDIRECTION

**Symptôme** : l'action pose bien son état (la trace est en base), mais le navigateur ne bouge
pas — ou l'URL change et l'écran reste l'ancien. Reproductible à la première connexion : le
compte arrive sur `/`, le layout le renvoie sur `/bienvenue` ; « Plus tard » fait
`redirect("/")`… et l'on reste sur les diapositives.

**Cause** : le cache du routeur de Next (`staleTimes.dynamic`, 30 s) a gardé `/` tel qu'il a
été servi la première fois — **une redirection vers `/bienvenue`**. La navigation déclenchée
par l'action resserre cette entrée au lieu de redemander la page au serveur, qui l'aurait
rendue normalement maintenant que la trace existe.

**Règle** : quand une action change ce qui décide d'une redirection de layout (une garde
d'onboarding, un droit, un état de compte), elle ne redirige pas elle-même : elle rend la
main, et le client fait une **navigation complète** (`window.location.replace`), qui repart
de zéro. Le même réflexe que pour l'OAuth d'un canal (`window.location.href = url`).

### #61 — Un `next dev` déjà lancé garde l'ANCIEN client Prisma après `pnpm db:generate`

**Symptôme** : la migration est appliquée, `pnpm db:generate` a tourné, `tsc` passe — et
l'application rend une 500 : `PrismaClientValidationError … Unknown argument
\`welcomeSeenAt\``, sur une colonne qui existe.

**Cause** : le serveur de développement a chargé le client généré au démarrage ; Turbopack
ne recharge pas le moteur Prisma quand `src/generated/` change sous lui. Le code applicatif
est à jour, le client qui valide les requêtes ne l'est pas.

**Règle** : après **toute** migration (`#33`), relancer `next dev` — pas seulement
`db:generate`. En local, Relvo se lance avec `PORT=3100 AUTH_URL=http://localhost:3100` :
sans l'override d'`AUTH_URL`, l'inscription redirige vers le port du `.env.local`, qui n'écoute
pas.

### #62 — Les identifiants ARIA de dnd-kit sortent d'un compteur, qui ne compte pas pareil sur le serveur et sur le téléphone

**Symptôme** : une erreur d'hydratation reproductible à chaque chargement d'une page qui porte un
glissé — le Calendrier, en semaine comme en mois — sans date, ni `Math.random`, ni `window` en
cause. React montre `aria-describedby="DndDescribedBy-0"` d'un côté et un autre rang de l'autre.

**Cause** : `DndContext` fabrique les identifiants de ses nœuds d'accessibilité à partir d'un
**compteur de module**, incrémenté à chaque contexte monté. Le serveur et le navigateur ne
montent pas les contextes dans le même ordre ni le même nombre de fois (deux vues sur la même
page, un remontage en développement) : le rang diverge, l'attribut aussi. Le compteur repart de
zéro par processus, donc l'erreur peut n'apparaître que sur la seconde vue, ou après une
navigation.

**Règle** : tout `DndContext` reçoit un `id` stable et unique par surface (`agenda-semaine`,
`planning-mois`) ; dnd-kit en dérive alors des identifiants déterministes. Même réflexe que le
#59 : devant une hydratation qui casse sur un attribut ARIA, chercher qui le génère, pas ce
qu'il affiche.

### #63 — Un tour de Relvo rejoué avec ses identifiants OpenAI exige un raisonnement que le téléphone n'a jamais reçu

**Symptôme** : l'échange avec Relvo fonctionne, puis, après quelques tours, chaque message revient
avec « Je n'ai pas pu répondre. Réessayez dans un instant » — et réessayer ne change rien, ni
dans la minute ni une heure plus tard. Le journal de Vercel montre un `400` de l'API Responses :
`Item 'msg_…' of type 'message' was provided without its required 'reasoning' item: 'rs_…'`. En
local, deux tours courts passent ; le défaut ne se montre que lorsqu'un tour s'est terminé par une
réponse **raisonnée** (un item de raisonnement juste devant le texte final).

**Cause** : le fournisseur OpenAI du SDK pose sur chaque partie de réponse l'identifiant de son
item (`providerMetadata.openai.itemId`). Le téléphone garde ces métadonnées dans l'échange et les
renvoie au tour suivant. Avec `store` à vrai (le défaut), le fournisseur ne renvoie alors **pas**
le texte d'un tour précédent : il le **référence** (`item_reference`) — et OpenAI exige, pour un
message référencé, l'item de raisonnement qui l'a précédé dans la même réponse. Or la route ne
transmet pas le raisonnement au client (`sendReasoning: false`) : la référence est orpheline, le
tour est refusé, et comme l'historique est rejoué à l'identique, il le reste. Garder le
raisonnement côté client ne vaudrait guère mieux : la référence pointe sur un état conservé chez
OpenAI, borné dans le temps — un échange repris plus tard retomberait sur le même mur.

**Règle** : l'historique rejoué repart **en clair**. Avant l'appel, `sansAncresFournisseur`
(`server/ia/echange/conversions.ts`) retire `itemId` des parties assistant et écarte les parties de
raisonnement ; le texte et les appels d'outils sont renvoyés tels quels, sans référence à un état
distant. Le préfixe caché ne change pas (#49) : les jetons sont les mêmes, seule la forme de l'envoi
diffère. Le test `ia-echange.test.ts` capture le corps réellement envoyé à l'API et vérifie qu'il
ne contient aucun `item_reference` — c'est lui qui tient la règle, pas la relecture du fournisseur
à chaque montée de version.

### #64 — Le proxy ne voit que les callbacks de la configuration edge : un rôle posé dans `auth.ts` n'existe pas dans `authorized`

**Symptôme** : la zone d'administration renvoie **tout le monde** à l'accueil, l'administrateur
compris. `/api/auth/session` montre pourtant `"role": "admin"`, le script de promotion a bien
écrit en base, la session côté page est juste.

**Cause** : `proxy.ts` instancie Auth.js avec `auth.config.ts` seul — la configuration
**edge-safe**, sans Prisma. Le `auth` reçu par le callback `authorized` est construit avec **les
callbacks de cette configuration-là**. Le callback `session`, qui recopie `role` et `accountId`
du jeton vers `session.user`, vivait dans `auth.ts` : le proxy ne l'exécutait jamais, et
`auth.user.role` y était `undefined`. Les pages, elles, passent par `auth.ts` et voyaient le rôle.
Rien ne casse au typage : la session est déclarée avec `role`, le proxy la croit remplie.

**Règle** : tout callback **pur** dont le proxy a besoin — `session` en tête — vit dans
`auth.config.ts` ; `auth.ts` le reprend par `...authConfig.callbacks`. Seuls les callbacks qui
touchent la base (`jwt` pour Google, `signIn`) restent dans `auth.ts`. Le test
`auth-deny-by-default.test.ts` appelle `authorized` avec une session qui porte déjà le rôle : il
protège la décision, **pas** le remplissage de la session — c'est le `curl` de `/admin` avec un
vrai cookie qui a attrapé celui-ci.

### #65 — Un `filter: drop-shadow` CSS sur une barre dont les enfants s'animent fait scintiller un rectangle sous elle, sur iOS

**Symptôme** : sous le dock, une zone **rectangulaire** blanche ou grise, de la taille de la
barre et de son ombre, apparaît par moments ; parfois elle **scintille**, alternant blanc et
ombré très vite. Jamais en headless sur ordinateur, seulement sur le téléphone.

**Cause** : le dock portait `filter: drop-shadow(…)` pour que l'ombre suive la silhouette de la
pilule soulevée autour du disque. Sur WebKit, un filtre crée une **couche de rendu
rectangulaire** qui englobe l'élément et son ombre, et cette couche est **redessinée entière**
dès qu'un descendant change — l'opacité des onglets en transition, le disque qui se contracte
au toucher, le repli au défilement. Pendant ce redessin, WebKit affiche le rectangle de la
couche avant d'avoir peint son contenu.

**Règle** : pas de filtre CSS sur un conteneur dont les enfants s'animent. Une ombre qui doit
suivre une silhouette se dessine **dans un SVG statique** (`feDropShadow` sur le groupe des
formes), posé sous le contenu ; les onglets et le disque vivent au-dessus, hors de toute couche
filtrée. Une ombre rectangulaire reste un `box-shadow`.

### #66 — Sur un silence, un modèle de transcription aligné sur un prompt RECOPIE le prompt au lieu de rendre une chaîne vide

**Symptôme** : une dictée muette (micro coupé, enregistrement vide, bruit) revient avec un
texte propre et plausible — « Dictée en français de Admin Local. » — posé dans le composer
comme un brouillon. Aucune erreur, un coût normal, et un mensonge au dirigeant.

**Cause** : le `prompt` d'une transcription n'est pas une consigne mais un **amorçage** : le
modèle continue le texte qu'on lui donne en s'alignant sur l'audio. Sans audio, il n'a que
l'amorce — et la rend. C'est le prix du vocabulaire du compte dans le prompt (M22.4), qui
est par ailleurs le vrai gain de la dictée.

**Règle** : un texte **entièrement contenu dans le prompt** n'est jamais une dictée
(`estEchoDuPrompt`, `server/ia/client.ts`) : c'est un échec `audio-vide`, qui porte sa
mesure — les secondes ont été facturées — et le composer dit « Je n'ai pas compris ». Le
test `ia-dictee.test.ts` tient la garde. Même réflexe pour tout modèle amorcé par un texte :
vérifier que la sortie n'est pas l'entrée.

### #67 — Le micro simulé de Chrome headless rend du SILENCE, même avec un fichier WAV en entrée

**Symptôme** : `--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<wav>`
donne bien une piste, `MediaRecorder` enregistre, mais le fichier produit pèse quelques
kilo-octets pour dix secondes et la transcription n'entend rien (cf. #66). Rien ne signale
que le WAV n'est pas joué.

**Cause** : en `--headless=new`, le périphérique audio simulé ne lit pas le fichier (ou pas
dans le format attendu) ; il produit des trames vides. Le diagnostic « le micro marche »
(`getUserMedia` résout, `isTypeSupported` répond vrai) est juste et ne dit rien du contenu.

**Règle** : pour rejouer une dictée en headless, **injecter le micro dans la page** : un
script posé par CDP avant la navigation (`Page.addScriptToEvaluateOnNewDocument`) remplace
`navigator.mediaDevices.getUserMedia` par un `AudioContext` qui décode le WAV et rend
`createMediaStreamDestination().stream` ; Chrome lancé avec
`--autoplay-policy=no-user-gesture-required`, sinon `AudioContext.resume()` ne rend jamais la
main et le geste reste au repos. Vérifier la **taille** de l'enregistrement produit avant de
conclure quoi que ce soit sur la transcription.

### #68 — Un outil de lecture à filtres figés fait INVENTER un mot-clé au modèle, qui conclut qu'il n'y a rien

**Symptôme** : « Est-ce que j'ai reçu un e-mail aujourd'hui ? » → « Non, aucun » alors qu'un
message est arrivé une heure plus tôt. Le journal montre l'appel : `search_messages` avec
`recherche: "2026-10-19"` — une date cherchée comme un mot, qu'aucun e-mail ne contient. Même
famille : « qu'est-ce que j'ai lundi ? » répondu avec les tâches de la semaine, « mes affaires
avec Karim » impossible, les tâches sans date invisibles à tout filtre sur l'échéance.

**Cause** : l'outil ne prenait qu'un mot-clé (ou quatre périodes figées). Le modèle ne refuse
pas une question qu'un outil ne sait pas poser : il la **traduit** dans ce que l'outil accepte,
et le résultat vide devient une réponse. L'alternative — ramener large et trier dans le
contexte — explose les jetons.

**Règle** : un outil de lecture prend **les critères que le dirigeant dit** — un jour ou une
plage de jours en heure française, une personne, un domaine, un canal, un état, un type —, et
sa description dit au modèle ce qu'il ne faut **pas** mettre dans le mot-clé (une date,
« email »). Sans critère, l'outil rend les derniers éléments plutôt que rien. Un nom qui
désigne plusieurs contacts est rendu en candidats, jamais tranché en silence. Chaque critère
nouveau entre dans le jeu d'évaluation (`eval:echange`) avec la question qui l'a motivé :
c'est le jeu, pas la vigilance, qui tient la palette (`05 §10.3`, §11.6).

### #69 — Un `mail_received` de l'agrégateur n'est pas toujours une réception : les brouillons Gmail arrivent par là

**Symptôme** : le dirigeant écrit un e-mail dans Gmail ; dans Relvo, la conversation montre
quatre messages « reçus » de lui-même, de plus en plus longs (« Hello Carole, » puis « …Ce sont
des bonnes nouvelles » puis « …Alors »), rangés dans l'affaire, chacun relu par le modèle.

**Cause** : Gmail enregistre le brouillon à chaque pause de frappe, et chaque enregistrement
est un nouvel e-mail pour le fournisseur, poussé par le webhook `mail_received` — avec
`role: "drafts"` et le dossier des brouillons, que le webhook ne lisait pas. L'expéditeur est
notre propre adresse, retirée du set de la conversation : la clé retombe sur le fil de
l'interlocuteur, l'écoute de l'affaire capte, la relecture part. Un courrier du dossier des
envoyés peut arriver par le même chemin.

**Règle** : le courrier se range d'après **ce qu'il est**, lu dans `role` et `folders`, jamais
d'après le seul événement (`natureDuCourrier`, `server/unipile/map.ts`) : brouillon → jamais
rangé ; indésirable, corbeille → écartés ; dossier des envoyés, ou notre adresse hors boîte de
réception → un envoi (`ingestOutboundEmail`) ; le reste → reçu. Tout webhook de courrier passe
par là avant d'ingérer quoi que ce soit, et l'ignoré se lit dans la réponse du webhook
(`ignored: "brouillon"`).

## Si une MAJEURE a bougé

| Majeure | Revérifier |
|---|---|
| **Next** | #5, #5b, #5c, #14, #45, #48, #60 |
| **Prisma** | #1, #2, #4, #19, #33, #35, #36, #37, #47, #61 |
| **Auth.js** | #5c, #6, #7, #21 |
| **Tailwind** | #15 |
| **AWS SDK** | #8, #9, #10, #11 |
| **pnpm** | #29, #46 |
| **Registre de composants** | #16, #40, #51, #52 |
| **Vitest / Vite** | #22, #34 |
| **Base UI** | #40 |
| **Zod** | #42 |
| **React** | #41 |
| **WebKit (iOS)** | #65 |
| **Chrome headless** | #67 |

Les pièges **#3, #12, #13, #17, #24, #25, #26** relèvent de la **plateforme de déploiement**, pas
d'un paquet : ils changent sans qu'aucun numéro de version ne bouge. Les revérifier dans la
documentation de la plateforme, jamais de mémoire. Le piège **#54** relève du **navigateur du
téléphone** : il se périme avec la version de Chrome, dans le bon sens.

Les pièges **#18, #20, #23, #27, #28, #30, #45, #50, #53, #55, #57, #58, #59, #68** sont des **règles de conception ou d'hygiène** :
ils ne se périment pas.

> **Quand un piège devient faux, le corriger ici au moment où on s'en aperçoit** — et
> **supprimer l'ancienne formulation** plutôt que de la surcharger d'un avertissement daté. Ce
> fichier décrit ce qui est vrai, pas ce qui l'a été.
