The violet « agent zone » header that tops every Direction-B screen. The Relvo logo sits top-right (always same place) and opens the conversations list.

```jsx
// Page principale
<RelvoHeader title="Bonjour Vincent" subtitle="Lundi 16 juin · Tasty Crousty" onLogoClick={openConvos} />

// Écran poussé (retour)
<RelvoHeader title="Remplacement sauce blanche" subtitle="SUB-0142 · Karim Benali" onBack={goBack} onLogoClick={openConvos} />
```

Pass `children` to host the brief carousel, the overlapping metrics card, or a segmented control inside the violet zone. Use `paddingBottom` to leave room for an element that overlaps the header's bottom edge (the « carte à cheval » pattern). Pair with `GlassTabBar` + `RecipientComposer` at the bottom for the violet-top / violet-bottom framing.
