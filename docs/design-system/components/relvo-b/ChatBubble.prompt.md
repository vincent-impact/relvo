ChatBubble — conversation bubbles in Direction B.

```jsx
<ChatBubble direction="out">Où en est la sauce blanche ?</ChatBubble>
<ChatBubble actor="relvo" name="Relvo" channel="à l'instant">J'ai préparé une réponse et 2 tâches sur SUB-0142.</ChatBubble>
<ChatBubble actor="ext" name="Karim Benali" channel="WhatsApp"
  attachment={{ name: "BL-2291.pdf", label: "Bon de livraison" }}>Voici le bon de livraison.</ChatBubble>
```

Outgoing = Moi (blue, right). Incoming Relvo = violet-tinted with ✦ logo avatar; Externe = white with amber initials. Wrap a column of bubbles in a flex container with gap.
