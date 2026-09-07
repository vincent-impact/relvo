---
id: M6
public: true
ordre_public: 7
titre_client: Réception WhatsApp
resume_client: >
  Faire entrer WhatsApp par le même chemin que l'e-mail : vos messages, vos photos et vos
  documents arrivent dans Relvo, et vous répondez sans changer d'application.
statut: partiel
debut: 2026-07-18
fin: 2026-07-20
---

# M6 — Ingestion messagerie

**Objectif** — recevoir et envoyer des messages de messagerie, par le **même** chemin que
l'e-mail. **Dépendances** : M3, M4, **M5** (client, route de webhook, résolution du tenant).

**Aucune migration** : le modèle était déjà agnostique du canal.

| # | Item | État |
|---|---|---|
| M6.1 | ~~Runtime maison~~ | **abandonné** — réutilise le client et la route de M5 |
| M6.2 | ~~Session persistante~~ | **sans objet** — gérée côté fournisseur |
| M6.3 | Connexion par code visuel depuis les réglages | ✅ |
| M6.4 | Réception, idempotente, avec rattachement par fil | ✅ |
| M6.5 | Envoi dans un fil existant | ✅ |
| M6.6 | Médias vers le stockage, au premier passage | ✅ |
| M6.7 | Santé de la connexion | ✅ — déjà couverte génériquement par M5.8 |
| M6.8 | Avertissement sur le risque lié aux conditions d'utilisation | ✅ |

**Écrire à un numéro sans échange préalable** est reporté après la V1.

## ⚠️ Ce qui bloque la clôture

- [ ] **Déclarer le webhook de messagerie** côté fournisseur.
- [ ] **Valider de bout en bout en production** : connexion sur un appareil réel, réception d'un
      message et d'un média, réponse depuis l'app.
- [ ] **Confirmer l'anti-boucle de l'écho de nos propres envois** contre un vrai payload — la
      leçon de M5 est que cette vérification ne se fait pas de tête.

C'est **le seul reste de travail sur les épiques livrées**, et il bloque la confiance dans tout
le canal.
