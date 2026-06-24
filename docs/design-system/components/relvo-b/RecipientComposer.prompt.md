The signature Direction-B composer. A recipient selector (avatar, left) removes the "am I writing to Relvo or to the contact?" ambiguity: the whole bar turns **blue** for a human (Moi) and **violet** for Relvo, the verb + send icon follow, and the avatar identifies who. Mic when empty (voice-first — WhatsApp habit), paper-plane once typing. Paperclip lives inside the field.

```jsx
<RecipientComposer
  recipients={[
    { key: "karim", name: "Karim", kind: "human", initials: "KB", sublabel: "SoGood · WhatsApp" },
    { key: "relvo", name: "Relvo", kind: "relvo", sublabel: "Votre assistant" },
  ]}
  defaultValue="karim"
  onSend={(text, to) => sendReply(to, text)}
/>
```

Single recipient (e.g. the global Relvo composer) → pass one entry; the selector becomes a static avatar. On no-ambiguity screens (Accueil, Conversation) use just `[{key:'relvo',name:'Relvo',kind:'relvo'}]`. It stays on the last chosen recipient. Place it at the very bottom, under `GlassTabBar`.
