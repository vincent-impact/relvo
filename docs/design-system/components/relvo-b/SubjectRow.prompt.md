SubjectRow renders a Subject as a **line**, not a floating card — the core Direction-B list element (Accueil priorities, Mon fil). The domain colour lives in the rail + icon; markers ride along; unread shows as a blue pip top-right; `urgent` washes the whole row red.

```jsx
<SubjectRow
  reference="SUB-0142" urgent unread={2}
  icon={<Package />} railColor="var(--blue-600)"
  title="Remplacement sauce blanche"
  summary="Karim propose une substitution. Réponse et 2 tâches prêtes."
  tags={[{label:"À faire · 2",tone:"amber"},{label:"✦ 2 suggérées",tone:"relvo"}]}
  onClick={open}
/>
<SubjectRow reference="SUB-0117" railColor="var(--blue-600)" icon={<Snowflake/>}
  title="Congélateur HS — Narbonne" tags={[{label:"⏳ En attente",tone:"grey"}]} />
```

Domain colours: Fournisseurs blue, RH purple, Juridique amber, Clients accent-red, Production green. Use `done` for resolved (dim + strike).
