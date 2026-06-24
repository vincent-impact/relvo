Frosted « Liquid Glass » bottom navigation (Direction B). Sits directly above the violet `RecipientComposer` so the app is framed violet-top / violet-bottom. Content frosts through it; it hides on scroll-down.

```jsx
const [tab, setTab] = React.useState("accueil");
<GlassTabBar value={tab} onChange={setTab} hidden={scrollingDown} />
```

Built-in tabs (Accueil / Mon fil / Mémoire / Réglages) with Lucide icons; pass `tabs` to customize. Requires content behind it to show the frosting — place it over a scroll area.
