# Benchmark IAG — fournisseurs, barème de coût, garde-fous

> **Ce document porte des dates et des chiffres. Il n'a donc pas sa place dans `conception/`**
> (cf. `CLAUDE.md`, règle d'écriture non négociable). Il vit ici, avec l'historique des
> décisions. Ce qui devait en ressortir de façon intemporelle est **appliqué** dans
> [`conception/05-ia.md`](../conception/05-ia.md) : les tiers et le niveau de raisonnement en
> §10.5, le disjoncteur en §10.6, les citations portées par le schéma de sortie en §10.4, la pile
> en §11.8. Ce document-là ne nomme aucun modèle et ne porte aucun chiffre — c'est ici que vivent
> les deux. La décision est tracée dans [`ecarts-et-propositions.md`](ecarts-et-propositions.md).
>
> **Relevé effectué le 13/09/2026** sur les pages officielles des fournisseurs, citées au §9.
> ⚠️ **Aucun chiffre d'ici ne doit être figé dans du code ou dans un devis sans revalidation** —
> les contradictions entre sources publiques sont documentées au §8.
>
> Modèle de coût reproductible : [`scripts/cout-iag.py`](../scripts/cout-iag.py).

---

## 0. Les cinq conclusions

0. **Décision, 13/09/2026 : pile 100 % OpenAI — GPT-5.6 Luna sur la classification, l'extraction structurée et la rédaction ; GPT-5.6 Terra sur le chat complexe et l'analyse de document. Budget retenu : 14,63 €/mois pour 5 000 messages**, soit 7,1 % du revenu à 3 sièges. Voir §6.
1. **L'écart de prix entre fournisseurs est très inférieur à l'écart entre tiers de modèles.** La pile retenue coûte 14,63 €/mois là où la pile OpenAI que j'avais d'abord recommandée coûte 66 € et la pile Anthropic 78 €. **Le facteur 5 ne venait pas du fournisseur, il venait du tier.** Voir §5.
2. **DeepSeek coûte 10,65 €/mois** en heures pleines, tout compris — soit 4 € de moins que la pile retenue, pour un modèle sans JSON strict et sans PDF natif. Voir §4.
3. **Une pile mixte « DeepSeek sauf la sortie structurée » coûte moins cher que DeepSeek intégral** (9,62 € contre 10,65 €) : le surcoût de reprise sur les réponses JSON non conformes dépasse le prix du modèle qui, lui, les garantit. **Le fournisseur à JSON strict se paie tout seul.** Voir §4.4.
4. **Le vrai gisement d'économie est architectural, pas tarifaire.** A10 (message sortant) pèse 20 % du coût IA pour une décision quasi déterministe. Le corriger économise 22 % du total, quel que soit le fournisseur. Voir §6.2.
5. **`reasoning.effort` est le paramètre le plus sensible du modèle de coût** : laissé à son défaut (`medium`), il multiplie la facture par 2,2. Il doit être posé explicitement à chaque site d'appel. Voir §6.1 bis.
6. **Il faut un disjoncteur par compte avant la mise en production**, et l'architecture de Relvo en offre déjà le mode dégradé gratuitement : la coupure de l'IA laisse les conversations orphelines, état déjà prévu et déjà affiché. Voir §7.

---

## 1. Position retenue sur la conformité

**Décision de Vincent, 13/09/2026 : le prix et la qualité de service priment sur la confidentialité ; la conformité RGPD n'est pas une priorité des clients actuels.** Le présent document en prend acte et ne fait plus de la conformité un critère d'élimination.

Trois faits à conserver malgré tout, parce qu'ils ne dépendent pas de la préférence des clients :

- **L'exposition est la vôtre, pas la leur.** Vis-à-vis de Tasty Crousty vous êtes sous-traitant ; c'est le responsable de traitement qui est exposé en premier, mais l'article 28 fait remonter la responsabilité au sous-traitant qui agit hors instructions ou sans garanties. Un client peut ne pas poser la question ; il ne peut pas vous en décharger.
- **Le coût de la marche arrière est asymétrique.** Changer de fournisseur avant la V1 coûte une journée. Le faire après le premier client grand compte qui exige une DPIA coûte une refonte du pipeline et une migration de l'historique. C'est exactement ce que la couche d'abstraction du §6.4 rend indolore — c'est sa principale justification, désormais.
- **Le risque opérationnel DeepSeek n'est pas un risque de conformité.** Voir §4.3 : les arguments qui pèsent contre DeepSeek dans Relvo sont des arguments de qualité de service, et ils tiennent indépendamment de toute considération RGPD.

Le §3 est conservé comme information, plus comme filtre.

---

## 2. Tarifs relevés — USD par million de tokens

Prix catalogue, hors remises d'engagement. « Cache » = lecture d'un bloc déjà en cache.

| Fournisseur | Modèle | Input | Cache | Output | Notes |
|---|---|---|---|---|---|
| **Anthropic** | Haiku 4.5 | 1,00 | 0,10 | 5,00 | écriture cache ×1,25 ; **cache min. 4 096 tok** |
| | Sonnet 5 | 2,00 | 0,20 | 10,00 | cache min. 1 024 |
| | Opus 5 | 5,00 | 0,50 | 25,00 | cache min. 512 |
| **OpenAI** | GPT-5.6 Luna | **0,20** | 0,02 | **1,20** | cache implicite, écriture gratuite |
| | GPT-5.6 Terra | 2,00 | 0,20 | 12,00 | ⚠️ ×2 in / ×1,5 out au-delà de 272 K |
| | GPT-5.6 Sol | 4,00 | 0,40 | 20,00 | |
| | GPT-6 Astra | 10,00 | 1,00 | 50,00 | |
| **Google** | 3.5 Flash-Lite | 0,30 | 0,03 | 2,50 | + stockage cache 1,00 /M/h |
| | 3.7 / 3.8 Flash | 0,75 * | 0,075 * | 3,75 * | + stockage 0,50 /M/h |
| | 3.1 Pro (preview) | 2,00 | 0,20 | 12,00 | + stockage 4,50 /M/h |
| **Mistral** | Ministral 3 8B | 0,15 | 0,015 | 0,15 | cache explicite, blocs 64 tok |
| | Small 4 | 0,15 | 0,015 | 0,60 | |
| | Large 3 | 0,50 | 0,05 | 1,50 | |
| | Medium 3.5 | 1,50 | 0,15 | 7,50 | |
| **DeepSeek** | deepseek-flash | 0,30 † | **0,006** † | 1,20 † | vision ✓, **pas de PDF**, **pas de JSON strict** |
| | deepseek-v4-pro | 1,32 † | 0,044 † | 3,96 † | **aucune vision** |
| **Qwen** | 3.7 Flash | 0,028 | 0,003 | 0,165 | pas de PDF |
| | 3.5 Plus | 0,115 | 0,012 | 0,688 | |
| | 3.8-Max | 2,00 | 0,20 | 6,00 | Singapour ; τ³-Banking n°1 |
| **Meta** | — | — | — | — | **API retirée le 06/07/2026** |

\* **Tarif promotionnel jusqu'au 31/12/2026. Au 01/01/2027 : 1,50 / 0,15 / 7,50.** Daté et écrit dans la documentation tarifaire.
† heures pleines. Heures creuses = moitié. Heures pleines = 01:00–04:00 et 06:00–10:00 UTC en semaine, soit **08:00–12:00 heure de Paris** — vos heures de bureau.

**Le fait tarifaire le plus important du tableau : GPT-5.6 Luna est moins cher que deepseek-flash en entrée** (0,20 contre 0,30) et à égalité en sortie. DeepSeek ne conserve un avantage que sur la lecture de cache (0,006 contre 0,02). C'est ce qui rend le §5 possible.

---

## 3. Qualité — ce que les benchmarks disent et ne disent pas

### 3.1 Avertissement sur l'Intelligence Index

L'index d'Artificial Analysis (v4.3) agrège 10 évaluations pondérées en quatre catégories à 25 % : **agents, code, capacité générale, raisonnement scientifique**. **Aucune composante multilingue, aucune classification courte, aucune rédaction professionnelle.** Un score de 51 sur Opus 5 ne dit rien de sa capacité à rédiger une relance fournisseur en français.

⚠️ **Piège de source** : l'agrégateur `benchlm.ai` publie sous le nom « Artificial Analysis Intelligence Index » des chiffres qui n'en sont pas (GPT-5.6 Sol à 58,9 % contre 47 sur la page officielle). À ne pas utiliser.

### 3.2 Tableau comparatif

| Modèle | AA Index | JSON strict | AutomationBench-AA | PDF natif | Cache min. |
|---|---|---|---|---|---|
| Claude Haiku 4.5 | 15 | ✓ « most cases » | non publié | **✓ texte+image** | 4 096 |
| Claude Sonnet 5 | 38 | ✓ « most cases » | 37 % | **✓ texte+image** | 1 024 |
| Claude Opus 5 | **51** | ✓ « most cases » | 57 % (Terminal-Bench 49 %) | **✓ texte+image** | 512 |
| **GPT-5.6 Luna** | **38** | **✓✓ garanti** | **50 %** | ✓ | 1 024 |
| GPT-5.6 Terra | 42 | **✓✓ garanti** | non trouvé | ✓ | 1 024 |
| GPT-5.6 Sol | 47 | **✓✓ garanti** | **60 %** | ✓ | 1 024 |
| GPT-6 Astra | **53** | **✓✓ garanti** | non trouvé | ✓ | 1 024 |
| Gemini 3.5 Flash-Lite | 23 | ⚠ sous-ensemble | 25 % (**Omniscience +5**) | **✓** | 4 096 |
| Gemini 3.8 Flash | 41 | ⚠ sous-ensemble | **60 %** | **✓** | 4 096 |
| Gemini 3.1 Pro (preview) | 30 | ⚠ sous-ensemble | 35 % (Briefcase **459**) | **✓** | 4 096 |
| Mistral Small 4 | 11 | ⚠ par prompt | **1 %** (Omniscience **−30**) | image seule | 64 |
| Mistral Medium 3.5 | 15 | ⚠ par prompt | non trouvé | ✓ | 64 |
| **deepseek-flash** | **40** | ✗ `json_object` seul | **69 %** (meilleur du panel) | image, **pas de PDF** | — |
| deepseek-v4-pro | 36 | ✗ `json_object` seul | non trouvé | ✗ **aucune vision** | — |
| Qwen3.8-Max | 40 | ✓ annoncé | τ³-Banking n°1 : 51,3 % | **pas de PDF** | — |

### 3.3 Les constats qui décident

**a) La fiabilité du JSON est le cœur de A2–A6 et de A7.** Trois niveaux nets. OpenAI : « will *always* generate responses that adhere to your supplied JSON Schema », sans hallucination de clé ni d'enum. Anthropic : garantit avec **trois exceptions nommées** — refus, `max_tokens` atteint, casse des enums. Google : « Not all JSON Schema features are supported », validez vous-même. Mistral : pilotage par prompt. **DeepSeek : `json_object` seulement, avec un avertissement officiel — « the API may occasionally return empty content ».**

C'est la seule caractéristique de ce benchmark qui a un coût chiffrable, et elle est chiffrée au §4.4.

**b) Luna fait jeu égal avec Sonnet 5 sur l'index, et mieux sur l'agentique.** AA Index 38 pour les deux ; AutomationBench 50 % pour Luna contre 37 % pour Sonnet 5. Pour un cinquième du prix. **C'est le résultat le plus contre-intuitif du relevé, et c'est ce qui invalide ma première recommandation.** Réserve à garder : l'index est mesuré à effort `max`, et rien ne dit que la parité tient au niveau d'effort qu'on utilisera en production.

**c) Le tool calling multi-tours n'est résolu par personne.** τ³-Banking — le benchmark le plus proche du chatbot C1 — est dominé par Qwen3.8-Max à 51,3 %, avec une note d'AA rappelant que « even frontier models with high reasoning budgets achieve only ~25,5 % pass@1 ». **Concevez C1 en supposant que le modèle se trompera d'outil une fois sur deux** : outils idempotents, confirmation avant toute écriture, aucune action destructive exposée en outil.

**d) Attention aux latences à effort maximum.** AA relève un time-to-first-token de **162 s sur GPT-5.6 Terra** et **323 s sur GPT-6 Astra**, contre une médiane de 3,65 s. Inutilisables en conversation à ce réglage. Les six niveaux d'effort d'OpenAI sont le vrai levier produit sur C1.

**e) Gemini 3.1 Pro ne tient pas son nom** — Briefcase 459, Terminal-Bench 4 %, toujours en preview. Si vous partez chez Google, le tier haut doit être 3.8 Flash.

**f) Le seuil minimum de cache annule le caching sur A1.** Haiku 4.5 et tous les Gemini Flash exigent 4 096 tokens. Un prompt de classification de domaine ne l'atteindra jamais. Sans gravité (A1 pèse 5 %), mais ne comptez pas dessus.

### 3.4 Le point aveugle : le français

**Aucun fournisseur ne publie de score par langue par modèle.** Le seul point d'ancrage est Global-MMLU-Lite, dont le classement global est mené par Gemini 3.1 Pro (93,2 %) et Gemini 3 Flash (92,7 %), mais dont le détail français n'a pas pu être extrait. Mistral est le seul à revendiquer explicitement le multilingue, sans preuve indépendante.

**Sur A1 (classification), A3 (titre + résumé) et A6 (brouillon), aucun benchmark public ne peut décider à votre place.** Voir §6.5.

---

## 4. DeepSeek — chiffrage détaillé

### 4.1 Trois contraintes techniques à intégrer avant de chiffrer

1. **`deepseek-v4-pro` n'a aucune vision.** B3 (analyse approfondie d'une pièce jointe) ne peut pas y tourner. Le tier haut doit retomber sur `deepseek-flash` pour tout ce qui touche un document.
2. **Aucun PDF natif, chez aucun des deux modèles.** Anthropic et OpenAI extraient texte **et** image de chaque page. Chez DeepSeek, il faut rasteriser côté application et envoyer des images — plus de tokens pour moins d'information. **Surcoût retenu : ×1,6 sur A9, B2 et B3.**
3. **Pas de JSON Schema strict.** `json_object` seul, plus l'avertissement officiel sur les réponses vides. Il faut une boucle validation + reprise sur tous les postes qui écrivent en base. **Taux de reprise retenu : 12 %** sur A2–A6, A7, A10, B1, B4. C'est une hypothèse — à mesurer, elle peut aussi bien être 5 % que 25 %.

### 4.2 Le chiffre

| Variante | €/mois |
|---|---|
| Naïf — chiffré comme les autres piles | 7,38 |
| + contrainte vision (B3 → flash) | 7,38 |
| + rastérisation des PJ (×1,6) | 7,71 |
| **+ reprise JSON 12 % = coût réel, heures pleines** | **8,22** |
| Même chose, heures creuses uniquement | 4,11 |
| Mélange réaliste 55 % pleines / 45 % creuses | 6,37 |

**Réponse à la question posée : ≈ 8,22 €/mois pour 5 000 messages**, soit **1,64 € par tranche de 1 000 messages**. Contre 48,25 € pour la pile OpenAI de référence et 60,65 € pour la pile Anthropic.

Décomposition (heures pleines, coût réel) :

| Poste | Modèle | €/mois | Part |
|---|---|---|---|
| A7 relecture sujet suivi | deepseek-flash | 2,66 | 32,3 % |
| C1 chat (tier haut) | deepseek-v4-pro | 1,28 | 15,6 % |
| A10 message sortant | deepseek-flash | 0,88 | 10,7 % |
| A2–A6 ouverture/rattachement | deepseek-flash | 0,85 | 10,3 % |
| C1 chat (tier moyen) | deepseek-flash | 0,66 | 8,0 % |
| B2 résumé PJ | deepseek-flash | 0,54 | 6,5 % |
| A1 classification domaine | deepseek-flash | 0,44 | 5,4 % |
| B1 régénération brouillon | deepseek-flash | 0,41 | 5,0 % |
| B3 analyse PJ approfondie | deepseek-flash | 0,30 | 3,6 % |
| A9 étiquetage PJ | deepseek-flash | 0,15 | 1,9 % |
| B4 · C2 | deepseek-flash | 0,05 | 0,7 % |
| **Total** | | **8,22** | |

Sensibilité au volume, strictement linéaire :

| Messages/mois | 1 000 | **5 000** | 10 000 | 25 000 | 50 000 | 100 000 |
|---|---|---|---|---|---|---|
| €/mois | 1,64 | **8,22** | 16,45 | 41,12 | 82,24 | 164,49 |

### 4.3 Ce qui plaide contre, sans invoquer le RGPD

- **La sortie structurée est le cœur de Relvo, et c'est la faiblesse de DeepSeek.** A2–A6 et A7 écrivent en base sans revue humaine. Un `json_object` non conforme, ou une réponse vide que le fournisseur documente lui-même comme possible, produit un sujet mal titré, une tâche fantôme ou un rattachement erroné — c'est-à-dire exactement ce que l'utilisateur verra et ce qui détruira sa confiance.
- **Les pièces jointes sont un usage de premier plan chez un dirigeant food** (factures, bons de livraison, devis), et c'est le second angle mort : pas de PDF natif, et le modèle « pro » aveugle.
- **Les heures pleines recouvrent vos heures de bureau.** Le tarif affiché de 0,15 $ ne sera pas le vôtre ; comptez 0,30 $.
- **À l'inverse, le point fort est réel** : 69 % sur AutomationBench-AA, meilleur score agentique de tout le panel, devant Sol (60 %) et Opus 5 (57 %), et un cache à −98 %. Sur les tâches de lecture et de raisonnement libre — le chat, les résumés — DeepSeek est excellent. Ce n'est pas un mauvais modèle ; c'est un modèle mal apparié à la partie la plus sensible de Relvo.

### 4.4 Le résultat qui tranche

Une pile **« DeepSeek partout sauf la sortie structurée »** — `deepseek-flash` sur A1, A9, B2, B3, C1 et les brouillons, **GPT-5.6 Luna sur A2–A6, A7, A10, B1, B4** :

| Pile | €/mois |
|---|---|
| **Hybride — DeepSeek sauf la structure** | **7,30** |
| DeepSeek intégral | 8,22 |

**L'hybride est moins cher que DeepSeek seul.** La reprise à 12 % sur les appels structurés coûte davantage que l'écart de prix avec un modèle qui garantit le schéma. Autrement dit : **le fournisseur à JSON strict ne coûte rien, il se rembourse.** Même en écartant toute considération de qualité, il n'y a pas d'argument économique pour faire tourner l'extraction structurée sur DeepSeek.

Ce résultat est robuste : il reste vrai tant que le taux de reprise dépasse ~4 %.

---

## 5. La correction : le facteur 6 ne venait pas du fournisseur

Le chiffrage initial comparait une pile **premium** (Haiku/Sonnet 5/Opus 5, 60,65 €) à une pile **économique** (DeepSeek, 8,22 €) et attribuait l'écart au fournisseur. C'était faux. À tier comparable, l'écart se referme presque entièrement.

Comparaison **à jetons de raisonnement inclus** (réglage du §6.1 bis), donc directement comparable
à la facture réelle :

| Pile | €/mois | €/1 000 msg | 1 siège | 3 sièges |
|---|---|---|---|---|
| Hybride — DeepSeek sauf la structure | 9,62 | 1,92 | 13,9 % | 4,6 % |
| DeepSeek intégral | 10,65 | 2,13 | 15,4 % | 5,1 % |
| **RETENU — 100 % OpenAI, Luna / Luna / Terra** | **14,63** | **2,93** | **21,2 %** | **7,1 %** |
| Google — Flash-Lite + 3.8 Flash | 23,15 | 4,63 | 33,5 % | 11,2 % |
| OpenAI premium — Luna/Terra/Sol (1re recommandation) | 66,05 | 13,21 | 95,7 % | 31,9 % |
| Anthropic premium — Haiku/Sonnet 5/Opus 5 (1re recommandation) | 78,42 | 15,68 | 113,7 % | 37,9 % |

Reproductible : `python3 scripts/cout-iag.py --piles`. Hors raisonnement, les mêmes piles
donnaient respectivement 7,30 · 8,22 · 9,32 · 18,15 · 48,25 · 60,65 €.

**Une pile intégralement OpenAI, avec JSON strict garanti partout, PDF natif et résidence UE disponible, coûte 14,63 €/mois — soit 4 € de plus que DeepSeek intégral.** Sur un compte facturé 69 € le siège, cet écart n'est pas un arbitrage, c'est du bruit.

**Pourquoi je m'étais trompé.** J'ai appliqué aux piles occidentales l'affectation de tiers de `05-ia.md` §10.5 (Haiku / Sonnet / Opus), qui est une hiérarchie **Anthropic**, et je l'ai transposée chez OpenAI en prenant Terra et Sol comme équivalents de Sonnet et Opus. Or Luna, à 0,20 $/1,20 $, n'a pas d'équivalent dans la gamme Anthropic : il est cinq fois moins cher que Haiku 4.5 en entrée tout en obtenant un meilleur index. La hiérarchie de `05-ia.md` est correcte **chez Anthropic** ; elle ne se transpose pas.

---

## 6. Recommandation

### 6.1 Affectation modèle ↔ tâche

| Tier | Sollicitations | Modèle | Pourquoi |
|---|---|---|---|
| **S** — classification courte | A1, A9, A10 *, C2 | **GPT-5.6 Luna** | 0,20 $/1,20 $, index 38, AutomationBench 50 %. Rien de moins cher n'est meilleur. |
| **M** — extraction structurée et rédaction | A2–A6, A7, B1, B2, B4, C1 simple | **GPT-5.6 Luna** | Le JSON strict garanti est la caractéristique qui compte ici, et elle est au même prix. |
| **L** — raisonnement, chat complexe | C1 complexe | **GPT-5.6 Terra** | Effort réglable ; à faire tourner à effort `low`/`medium`, jamais `max` (§3.3 d). |
| **Lv** — analyse de document | B3 | **GPT-5.6 Terra** | Luna et Terra acceptent les fichiers en entrée et en extraient texte **et** images de page. L'exception Sonnet 5 envisagée un temps n'est pas nécessaire : elle ne l'était que face à un fournisseur sans PDF natif. |

\* A10 passe en tier S après l'optimisation du §6.2, ou disparaît s'il devient déterministe.

**Pile 100 % OpenAI retenue le 13/09/2026.** Un seul SDK, un seul format d'outils, une seule
facture, un seul comportement à apprendre — sur une V1 développée seul, c'est du temps qui ne
part pas en réconciliation de deux APIs.

**Coût : 9,32 €/mois à effort `none`, 14,63 €/mois au réglage retenu (§6.1 bis).**

L'affectation concrète modèle ↔ tier est de la **configuration applicative** ; `conception/05-ia.md`
§10.5 définit les tiers sans nommer de modèle, précisément pour que ce tableau puisse changer sans
toucher à la conception.

**Ce que vaut Luna, honnêtement.** La fiche OpenAI le positionne sur « cost-sensitive,
high-volume workloads » et le rattache explicitement au **tier `nano`** des familles GPT-5
antérieures : c'est le plus petit modèle de la gamme. Son index AA de 38 — à parité avec Sonnet 5
— est mesuré **à effort `max`**, soit un réglage que vous n'utiliserez jamais en production. À
effort `low`, il est plus faible que ce que ce chiffre laisse croire, et personne ne publie de
quoi dire combien. **C'est le pari de cette décision, et c'est le §6.5 qui le tranche.** Le
recours est peu coûteux : basculer le seul tier Ms vers Terra coûte de l'ordre de 5 à 8 €/mois de
plus, pas 50.

**Le choix n'est plus « quel fournisseur » mais « quel tier ».** L'écart entre 9 € et 61 € est entièrement un choix de gamme, et il reste à valider par le benchmark maison du §6.5 : si Luna se révèle insuffisant en rédaction française, le surcoût de bascule vers Terra ou Sonnet 5 sur le seul poste de rédaction est de l'ordre de 3 à 5 €/mois — pas de 50 €.

### 6.1 bis Les jetons de raisonnement — le paramètre qui décide vraiment de la facture

**Les modèles GPT-5.6 émettent des jetons de raisonnement, facturés au tarif de sortie.** Le
niveau se règle par appel via `reasoning.effort` : `none`, `low`, `medium` (**défaut**), `high`,
`xhigh`, `max`. Le chiffrage du §5 supposait implicitement `none`. Ce n'est pas le défaut.

| Réglage appliqué à toute la chaîne | Jetons de raisonnement par appel | €/mois | Facteur |
|---|---|---|---|
| `none` | aucun | **9,32** | ×1,0 |
| `low` | ~300 sur M, ~600 sur L | 13,63 | ×1,5 |
| **`medium` — défaut de l'API** | ~800 / ~1 600 | **20,81** | **×2,2** |
| `high` | ~2 000 / ~4 000 | 38,05 | ×4,1 |

Reproductible : `python3 scripts/cout-iag.py --effort`.

**Laisser le défaut multiplie la facture par 2,2 et dégrade la latence** — AA mesure un
time-to-first-token de 162 s sur Terra à effort `max`, contre une médiane de 3,65 s.
`reasoning.effort` doit donc être **posé explicitement à chaque site d'appel**, jamais laissé au
défaut.

**Réglage retenu par poste :**

| Tier | Sollicitations | `reasoning.effort` | Pourquoi |
|---|---|---|---|
| S | A1, A9, A10, C2 | **`none`** | Une classification de domaine ne se raisonne pas, elle se reconnaît. |
| Ms | A2–A6, A7, B1, B4 | **`low`** | Assez pour arbitrer « bruit / affaire nouvelle / affaire suivie », pas plus. |
| Ml | B2, C1 simple | **`low`** | Résumé et rédaction : le raisonnement long n'améliore pas le français. |
| L | C1 complexe, B3 | **`medium`** | Le seul endroit où un raisonnement explicite paie. |

**Budget retenu : 14,63 €/mois pour 5 000 messages**, soit 2,93 € par tranche de 1 000 — 21,2 %
du revenu à 1 siège, **7,1 % à 3 sièges**.

**Les trois chiffres à retenir pour le business plan :** plancher 9,32 € (tout en `none`),
**hypothèse de travail 14,63 €** (réglage retenu ci-dessus), plafond de dérapage 38,05 € (tout en
`high`). C'est cet intervalle qui doit alimenter le disjoncteur du §7, pas le plancher.

Corollaire pour le §7 : **le disjoncteur doit surveiller les jetons de raisonnement séparément**.
Un poste dont l'effort a dérivé se voit dans ce compteur avant de se voir sur la facture.

⚠️ Les volumes de jetons de raisonnement du tableau sont des **ordres de grandeur**, pas des
mesures : OpenAI ne publie pas de moyenne par niveau d'effort. À instrumenter dès les premiers
appels réels (`usage.output_tokens_details.reasoning_tokens` est renvoyé par l'API).

### 6.2 L'optimisation architecturale, valable quel que soit le fournisseur

**A10 pèse 20 % du coût pour cocher une case.** Cocher une tâche de réponse comme satisfaite et poser le marqueur « En attente » n'exige pas un modèle de raisonnement sur 8 000 tokens de contexte. Deux options :

- **Déterministe** — si un message sortant part sur un sujet portant une tâche ouverte de type `réponse`, cette tâche est satisfaite ; le marqueur « En attente » se déduit de l'état des tâches. Coût : zéro.
- **Tier S** — si un jugement reste nécessaire (« ce sortant répond-il vraiment à la tâche ? »), un appel court suffit.

**Gain : 22 % du coût total, à qualité inchangée.** À faire avant tout arbitrage de fournisseur.

**A7 pèse 35 % et c'est structurel** — c'est le poste le plus fréquent, comme prévu. Les deux leviers : borner le contexte frais aux trois derniers messages plutôt qu'au fil entier, et mettre la portion statique en cache 1 h plutôt que 5 min.

### 6.3 Résidence des données

Sans objet comme critère de sélection (§1). Pour mémoire, si la question revient : la résidence UE chez OpenAI **se décide à la création du projet et ne peut pas être ajoutée après** (« Existing Projects cannot be updated for European residency after creation »). **Créer le projet OpenAI avec ce réglage coûte zéro aujourd'hui et est irrattrapable demain.** À faire même si la conformité n'est pas une priorité — c'est une option gratuite.

### 6.4 Couche d'abstraction — mince

Pas un framework, pas un routeur dynamique. Une interface interne à quatre méthodes (`classify`, `extract`, `draft`, `chat`), le modèle en configuration par tier, les schémas de sortie définis une fois. Elle permet de basculer un tier sans toucher au pipeline, de faire tourner le benchmark maison, et d'encaisser un changement de tarif. **Un fournisseur par tier, changeable par configuration, suffit.**

### 6.5 Le benchmark maison — avant de figer les prompts

50 à 100 messages réels de Tasty Crousty, anonymisés, avec la sortie attendue pour A1, A3 et A6. À faire tourner sur **GPT-5.6 Luna, Gemini 3.5 Flash-Lite et deepseek-flash** pour le tier S, et sur **Luna, Terra, Gemini 3.8 Flash et Sonnet 5** pour le tier M. **C'est la seule donnée qui manque et que personne ne publiera jamais** (§3.4). Un après-midi de travail qui vaut tous les classements.

---

## 7. Disjoncteur de consommation

**Exigence** : aucun compte ne doit pouvoir faire exploser la facture, ni par usage atypique, ni par bug, ni par boucle d'outils dans le chat.

### 7.1 L'unité de mesure

**Le coût en euros, pas le nombre de tokens.** Chaque appel enregistre dans `EventLog` : sollicitation (A1, A7, C1…), modèle, tokens entrée / sortie / cache-hit, et **coût calculé**. Une table de tarifs versionnée convertit les tokens en euros. Mesurer en euros survit à un changement de modèle ; mesurer en tokens non.

### 7.2 Trois seuils par compte et par mois civil

Exprimés en pourcentage du **budget IA du compte** = sièges × forfait mensuel de messages inclus.

| Seuil | Déclenchement | Effet |
|---|---|---|
| **Alerte — 70 %** | notification interne | rien de visible pour l'utilisateur |
| **Dégradation — 100 %** | bascule de gamme | tier L → tier M ; tier M → tier S sur les postes non structurants ; chat en modèle économique. A2–A6 et A7 **ne sont jamais dégradés** : ce sont eux qui écrivent en base. Bandeau discret. |
| **Coupure — 150 %** | arrêt des sollicitations | A2–A9 et C1 s'arrêtent. |

### 7.3 Ce que la coupure ne casse pas — et c'est déjà dans l'architecture

`05-ia.md` §1.1 est formel : **le rangement d'un message entrant est déterministe et sans IA, il ne peut pas échouer.** La coupure ne crée donc aucun mode de défaillance nouveau : les messages continuent d'arriver, d'être rattachés à leur conversation et d'être lisibles. Ce qui s'arrête, c'est l'ouverture automatique de sujets — et les conversations concernées tombent dans l'état **« conversation orpheline »**, déjà prévu, déjà compté dans le KPI « Sans sujet », déjà traitable manuellement par l'utilisateur.

**Le mode dégradé du disjoncteur est le mode nominal de la V1.** C'est l'argument le plus fort pour implémenter la coupure tôt : elle ne coûte presque rien à construire.

### 7.4 Trois garde-fous complémentaires

- **Vitesse, pas seulement volume.** Un compte qui consomme en une journée plus de 3× sa moyenne quotidienne déclenche une alerte immédiate, sans attendre le seuil mensuel. C'est ce qui attrape une boucle, un import massif ou une erreur de configuration le jour même.
- **Plafond par appel et par tour de chat.** `max_tokens` borné ; nombre d'allers-retours d'outils borné par tour (6 suffit) ; taille de pièce jointe plafonnée avant B3. Sans cela, un seul tour de chat pathologique peut coûter davantage que le mois entier du compte.
- **Plafond de dépense au niveau du compte fournisseur.** Anthropic et OpenAI proposent un plafond sur la clé d'API. **C'est la seule protection qui tient si le compteur applicatif est lui-même en cause** — donc la seule qui protège vraiment votre compte bancaire. À régler le jour de la création de la clé.

### 7.5 Conséquence commerciale

Le disjoncteur suppose un **forfait de messages inclus par siège**, annoncé au client. À 2,93 €/1 000 messages sur la pile retenue, un forfait de 2 000 messages/siège/mois coûte 5,86 € sur 69 € de revenu — **8,5 %**. C'est confortable, et cela rend le disjoncteur explicable : ce n'est pas une restriction subie, c'est la contrepartie d'un prix par siège lisible.

---

## 8. Réserves sur les données de ce document

1. **Contradiction de prix chez OpenAI.** La page d'annonce GPT-5.6 affiche Sol 5/30, Terra 2,50/15, Luna 1/6. La documentation API affiche Sol 4/20, Terra 2/12, Luna 0,20/1,20. La réconciliation tombe juste pour Sol (−20 % in, −33 % out, annoncés) mais pas pour Luna (−80 %). **La recommandation du §6.1 repose sur le prix de Luna : c'est le chiffre à revalider en premier.** Si Luna est en réalité à 1 $/6 $, la pile recommandée passe d'environ 9 € à environ 30 €/mois — ce qui ne change pas le classement, mais change le discours commercial.
2. **Contradiction de contexte chez OpenAI.** Docs : 1,05 M tokens. Blog AWS Bedrock pour les mêmes modèles : 272 K. Multiplicateurs ×2 in / ×1,5 out au-delà de 272 K — contexte à deux régimes tarifaires.
3. **Quatre modèles Qwen sur cinq ne sont pas indexés par Artificial Analysis** (404 sur les pages modèles). Ne pas extrapoler depuis Qwen3.8-Max.
4. **Le taux de reprise JSON de 12 % chez DeepSeek est une hypothèse**, pas une mesure. C'est le paramètre qui décide du §4.4 ; il bascule sous ~4 %.
5. **Aucune donnée publique sur la qualité en français**, pour aucun modèle du panel.
6. **Les hypothèses volumétriques sont des hypothèses de conception** dérivées de `05-ia.md`, pas des mesures. Le coût réel peut varier d'un facteur 2 dans les deux sens.
7. **Taux de change** : 1 EUR = 1,1592 USD (BCE, 11/09/2026).
8. **Échéance datée** : Gemini 3.7/3.8 Flash doublent de prix le 01/01/2027.

---

## 9. Sources

**Tarifs** — [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) · [OpenAI](https://developers.openai.com/api/docs/pricing) · [Google](https://ai.google.dev/gemini-api/docs/pricing) · [Mistral](https://mistral.ai/pricing/api/) · [DeepSeek](https://api-docs.deepseek.com/quick_start/pricing/) · [Alibaba](https://www.alibabacloud.com/help/en/model-studio/qwen3-8-max)

**Capacités** — [Anthropic — sorties structurées](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) · [Anthropic — caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) · [Anthropic — PDF](https://platform.claude.com/docs/en/build-with-claude/pdf-support) · [OpenAI — structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) · [OpenAI — caching](https://developers.openai.com/api/docs/guides/prompt-caching) · [OpenAI — file inputs](https://developers.openai.com/api/docs/guides/file-inputs) · [Google — structured output](https://ai.google.dev/gemini-api/docs/structured-output) · [Mistral — structured output](https://docs.mistral.ai/studio-api/conversations/structured-output/custom) · [DeepSeek — JSON mode](https://api-docs.deepseek.com/guides/json_mode)

**Benchmarks** — [AA — composition de l'index v4.3](https://artificialanalysis.ai/evaluations/artificial-analysis-intelligence-index) · [τ³-Banking](https://artificialanalysis.ai/evaluations/tau3-banking) · [Global-MMLU-Lite](https://artificialanalysis.ai/evaluations/global-mmlu-lite)

**Conformité (information, §1)** — [OpenAI — résidence UE](https://openai.com/index/introducing-data-residency-in-europe/) · [OpenAI — réponse aux demandes NYT](https://openai.com/index/response-to-nyt-data-demands/) · [Anthropic — conformité régionale](https://claude.com/regional-compliance) · [DeepSeek — politique de confidentialité](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html) · [BlnBDI Berlin — 27/06/2025](https://www.datenschutz-berlin.de/fileadmin/user_upload/pdf/pressemitteilungen/2025/20250627-BlnBDI-Press-Release_DeepSeek.pdf)

**Meta** — [Promptfoo — retrait de l'API Llama](https://www.promptfoo.dev/docs/providers/llamaApi/) · [The New Stack](https://thenewstack.io/meta-abandons-llama-spark/)

**Change** — [BCE — EUR/USD](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html)
