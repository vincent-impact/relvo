Segmented control for filters/tabs (Direction B). Each tab can show a small round count badge. Set `overlap` to make it straddle the violet header's bottom edge.

```jsx
const [tab, setTab] = React.useState("priorite");
<SegTabs overlap value={tab} onChange={setTab} tabs={[
  { key: "priorite", label: "Priorité", count: 3 },
  { key: "ouverts",  label: "Ouverts",  count: 13 },
  { key: "termines", label: "Terminés", count: 5 },
]} />
```

Used for Mon fil filters, Sujet (Messages/Tâches/Journal), Réglages (Profil/Canaux/Préférences).
