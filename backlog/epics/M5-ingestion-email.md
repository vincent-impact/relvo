# M5 — Ingestion e-mail

**Objectif** — recevoir les e-mails entrants et envoyer **depuis la vraie adresse de
l'utilisateur**. **Dépendances** : M3, M4.

| # | Item | État |
|---|---|---|
| M5.1 | Client de l'agrégateur, configuration paresseuse et dégradation propre sans identifiants | ✅ |
| M5.2 | Route de webhook : vérification du secret, idempotence, routage par type d'événement | ✅ |
| M5.3 | Mapper pur événement → message | ✅ |
| M5.4 | Récupération des pièces jointes vers le stockage, au premier passage uniquement | ✅ |
| M5.5 | Anti-boucle : déduplication, on n'ingère jamais nos propres envois | ✅ |
| M5.6 | Envoi sortant depuis la vraie adresse, via un port injecté | ✅ |
| M5.7 | Connexion d'une boîte en un clic, multi-fournisseur | ✅ |
| M5.8 | Statut de connexion du canal | ✅ |
| M5.9 | Rattachement déterministe pré-IA : même interlocuteur **et** même objet normalisé | ✅ |
| M5.10 | Corps sortant en HTML ; corps entrant nettoyé du fil cité | ✅ |
| M5.11 | Suppression d'un canal, en effacement assumé — les sujets et tâches survivent | ✅ |
| M5.12 | Visualiseur de pièces jointes adapté au mobile | ✅ |
| M5.13 | Rafraîchissement périodique + **invalidation du cache de données par le webhook** | ✅ |

> **M5.13 mérite d'être relu.** Sans l'invalidation déclenchée par le webhook, le cache
> resservait du contenu périmé et le rafraîchissement **ne voyait rien** : le symptôme était un
> délai qu'aucun réglage de fréquence ne réduisait.

## Raffinements reportés, avec leur raison

- **Intégrer le parcours de connexion dans l'app** plutôt que de rediriger vers l'écran hébergé
  du fournisseur.
- **Marque « Relvo » sur l'écran de consentement** — nécessiterait notre propre application
  vérifiée, ce qui **réintroduirait un audit de sécurité** que l'application vérifiée du
  fournisseur nous épargne. Compromis assumé.
