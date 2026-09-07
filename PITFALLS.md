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

**Origine.** Les pièges **#8 à #13, #19, #22, #23 et #45 à #47** ont été payés **sur ce projet**.
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

## Si une MAJEURE a bougé

| Majeure | Revérifier |
|---|---|
| **Next** | #5, #5b, #5c, #14, #45 |
| **Prisma** | #1, #2, #4, #19, #33, #35, #36, #37, #47 |
| **Auth.js** | #5c, #6, #7, #21 |
| **Tailwind** | #15 |
| **AWS SDK** | #8, #9, #10, #11 |
| **pnpm** | #29, #46 |
| **Registre de composants** | #16, #40 |
| **Vitest / Vite** | #22, #34 |
| **Base UI** | #40 |
| **Zod** | #42 |
| **React** | #41 |

Les pièges **#3, #12, #13, #17, #24, #25, #26** relèvent de la **plateforme de déploiement**, pas
d'un paquet : ils changent sans qu'aucun numéro de version ne bouge. Les revérifier dans la
documentation de la plateforme, jamais de mémoire.

Les pièges **#18, #20, #23, #27, #28, #30, #45** sont des **règles de conception ou d'hygiène** :
ils ne se périment pas.

> **Quand un piège devient faux, le corriger ici au moment où on s'en aperçoit** — et
> **supprimer l'ancienne formulation** plutôt que de la surcharger d'un avertissement daté. Ce
> fichier décrit ce qui est vrai, pas ce qui l'a été.
