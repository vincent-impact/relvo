SwipeRow adds the product's feed gesture to any row: **swipe right → Terminer** (green reveal), **swipe left → Ignorer** (red reveal). Pass `allowIgnore={false}` for low-priority subjects (right-swipe only). Commits past ~80px, else snaps back.

```jsx
<SwipeRow onComplete={() => resolve(s.id)} onIgnore={() => ignore(s.id)}>
  <SubjectRow reference={s.id} title={s.title} … />
</SwipeRow>
```

Wrap each `SubjectRow` in the feed/home lists. Keep `onClick` on the inner row for tap-to-open; the swipe and tap don't conflict (movement cancels the click).
