MetricsCard is the « carte à cheval » — one white dashboard surface that overlaps the violet header's bottom edge, replacing 4 colourful patchwork tiles. Cells are divided by hairlines; colour is reserved for signal (urgent red, Relvo violet). A `gauge` cell draws a circular saturation ring (green→amber→red).

```jsx
// Accueil — 4 KPI sur une ligne
<MetricsCard metrics={[
  { value: 1, label: "Urgents", tone: "urgent" },
  { value: 3, label: "Tâches" },
  { value: 1, label: "RDV" },
  { value: 2, label: "Nouveaux" },
]} />

// Mémoire — avec jauge de saturation
<MetricsCard metrics={[
  { value: 18, label: "Sujets suivis" },
  { value: 7,  label: "Instructions" },
  { value: 29, label: "Documents" },
  { type: "gauge", percent: 64, label: "Saturation" },
]} />
```

Place it right after `<RelvoHeader paddingBottom={42}>` so it straddles the violet zone.
