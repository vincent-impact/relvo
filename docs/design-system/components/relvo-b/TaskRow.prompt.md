TaskRow — a checkable task in Direction B. Source pill marks who created it (✦ Relvo / Moi); optional due date. Drive `done`/`onToggle` from state.

```jsx
<TaskRow title="Valider la sauce de substitution" source="relvo" due="Aujourd'hui · 11:00"
  done={d} onToggle={() => setD(!d)} />
```

Pair with an "+ Ajouter une tâche" affordance below the list (inline input) — the reusable add-pattern for any user-completable list.
