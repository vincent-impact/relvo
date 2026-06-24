JournalTimeline — a Subject's activity log (the Journal tab) as a connected timeline with actor-coloured dots.

```jsx
<JournalTimeline items={[
  { actor: "relvo", text: <><b>Relvo</b> a préparé une réponse et créé 2 tâches.</>, time: "il y a 35 min" },
  { actor: "ext",   text: <><b>Karim Benali</b> a envoyé la fiche produit.</>, time: "WhatsApp · il y a 1 h" },
  { actor: "me",    text: <><b>Vous</b> avez ouvert le sujet.</>, time: "il y a 2 h" },
]} />
```

Most recent first. Dots: Moi blue, Relvo violet, Externe amber — same triptych as everywhere.
