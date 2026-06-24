// Relvo app (Direction B) — clickable React kit composing the relvo-b components.
const NS = window.RelvoDesignSystem_ad3a3c;
const { RelvoHeader, MetricsCard, SegTabs, SubjectRow, RecipientComposer, GlassTabBar,
        ChatBubble, ConvListItem, JournalTimeline, TaskRow, SwipeRow } = NS;
const D = window.RELVO_B;
const LOGO = "../../assets/relvo-icon-256.png";

// ---- domain glyphs ----
function gl(k) {
  const p = {
    box: <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Zm-9 14V12m-9-4 9 5 9-5" />,
    snow: <path d="M2 12h20M12 2v20m7-15-14 10M5 7l14 10" />,
    users: <g><path d="M16 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 19v-2a4 4 0 0 0-3-3.9" /></g>,
    doc: <g><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></g>,
    bag: <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />,
    flame: <path d="M12 2C8 6 6 9 6 13a6 6 0 0 0 12 0c0-2.5-1-4.5-3-6.5.4 2.2-1 3.5-2 3.5 0-2.2-.5-4.5-1-8Z" />,
    check: <path d="M20 6 9 17l-5-5" />,
  }[k] || null;
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{p}</svg>;
}
const SPARK = <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.1 3.2 12.5 8l4.8 1.4c.6.2.6 1 0 1.2L12.5 12l-1.4 4.8c-.2.6-1 .6-1.2 0L8.5 12l-4.8-1.4c-.6-.2-.6-1 0-1.2L8.5 8 9.9 3.2c.2-.6 1-.6 1.2 0Z" /></svg>;

function useScrollHide() {
  const ref = React.useRef(null);
  const [hidden, setHidden] = React.useState(false);
  const last = React.useRef(0);
  const onScroll = (e) => {
    const y = e.target.scrollTop;
    if (y > last.current && y > 50) setHidden(true);
    else if (y < last.current) setHidden(false);
    last.current = y;
  };
  return { onScroll, hidden };
}

// ---- HOME ----
function Home({ go, openSubject, openConvos }) {
  const [bi, setBi] = React.useState(0);
  const [gone, setGone] = React.useState(() => new Set());
  const mark = (id) => setGone((g) => { const n = new Set(g); n.add(id); return n; });
  const { onScroll, hidden } = useScrollHide();
  React.useEffect(() => { const t = setInterval(() => setBi((i) => (i + 1) % D.brief.length), 4200); return () => clearInterval(t); }, []);
  const b = D.brief[bi];
  return (
    <div className="screen">
      <div className="scroll" onScroll={onScroll} style={{ paddingBottom: 188 }}>
        <RelvoHeader title={"Bonjour " + D.user.name} subtitle={D.user.date + " · " + D.user.org} logoSrc={LOGO} onLogoClick={openConvos} paddingBottom={42}>
          <div className="brief-card">
            <div className="lbl">{SPARK} {b.lbl}</div>
            <p>{b.text}</p>
          </div>
          <div className="dots">{D.brief.map((_, i) => <i key={i} className={i === bi ? "on" : ""} />)}</div>
        </RelvoHeader>
        <MetricsCard metrics={D.metrics} />
        <div className="sect"><span className="h"><span className="ph" style={{ background: "var(--brand)" }} />Sujets prioritaires</span><span className="a" onClick={() => go("fil")}>Tout voir</span></div>
        {D.subjects.slice(0, 3).filter((s) => !gone.has(s.id)).map((s) => (
          <SwipeRow key={s.id} allowIgnore={!s.done} onComplete={() => mark(s.id)} onIgnore={() => mark(s.id)}>
            <SubjectRow reference={s.id} urgent={s.urgent} unread={s.unread} icon={gl(s.icon)} railColor={s.rail}
              title={s.title} summary={s.summary} tags={s.tags} onClick={() => openSubject(s.id)} />
          </SwipeRow>
        ))}
      </div>
      <div className="dock">
        <GlassTabBar value="accueil" onChange={go} hidden={hidden} />
        <RecipientComposer recipients={[{ key: "relvo", name: "Relvo", kind: "relvo" }]} />
      </div>
    </div>
  );
}

// ---- FEED (Mon fil) ----
function Feed({ go, openSubject, openConvos }) {
  const [tab, setTab] = React.useState("priorite");
  const [gone, setGone] = React.useState(() => new Set());
  const mark = (id) => setGone((g) => { const n = new Set(g); n.add(id); return n; });
  const { onScroll, hidden } = useScrollHide();
  let list = D.subjects;
  if (tab === "ouverts") list = D.subjects.filter((s) => !s.done);
  if (tab === "termines") list = D.subjects.filter((s) => s.done);
  return (
    <div className="screen">
      <div className="scroll" onScroll={onScroll} style={{ paddingBottom: 188 }}>
        <RelvoHeader title="Mon fil" subtitle="18 sujets · triés par Relvo" logoSrc={LOGO} onLogoClick={openConvos} paddingBottom={42}>
          <div className="glass-field">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            Rechercher un sujet, un contact…
          </div>
        </RelvoHeader>
        <SegTabs overlap value={tab} onChange={setTab} tabs={[
          { key: "priorite", label: "Priorité", count: 3 },
          { key: "ouverts", label: "Ouverts", count: 13 },
          { key: "termines", label: "Terminés", count: 5 },
        ]} />
        <div className="agent-note"><span className="sp">{SPARK}</span><p>J'ai trié <b>12 nouveaux messages</b> en 5 sujets ce matin.</p></div>
        <div style={{ paddingTop: 2 }}>
          {list.filter((s) => !gone.has(s.id)).map((s) => (
            <SwipeRow key={s.id} allowIgnore={!s.done} onComplete={() => mark(s.id)} onIgnore={() => mark(s.id)}>
              <SubjectRow reference={s.id} urgent={s.urgent} unread={s.unread} done={s.done} icon={gl(s.icon)} railColor={s.rail}
                title={s.title} summary={s.summary} tags={s.tags} onClick={() => openSubject(s.id)} />
            </SwipeRow>
          ))}
        </div>
      </div>
      <div className="dock">
        <GlassTabBar value="fil" onChange={go} hidden={hidden} />
        <RecipientComposer recipients={[{ key: "relvo", name: "Relvo", kind: "relvo" }]} />
      </div>
    </div>
  );
}

// ---- MEMOIRE ----
function Memoire({ go, openConvos }) {
  const { onScroll, hidden } = useScrollHide();
  return (
    <div className="screen">
      <div className="scroll" onScroll={onScroll} style={{ paddingBottom: 188 }}>
        <RelvoHeader title="Mémoire" subtitle="Ce que Relvo sait de votre activité" logoSrc={LOGO} onLogoClick={openConvos} paddingBottom={42} />
        <MetricsCard metrics={[
          { value: 18, label: "Sujets suivis" }, { value: 7, label: "Instructions" },
          { value: 29, label: "Documents" }, { type: "gauge", percent: 64, label: "Saturation" },
        ]} />
        <div className="agent-note"><span className="sp">{SPARK}</span><p>C'est ici que vous enrichissez la mémoire de Relvo et affinez son comportement.</p></div>
        <div className="sect"><span className="h"><span className="ph" style={{ background: "var(--brand)" }} />Dossiers</span><span className="a">Tout voir</span></div>
        {D.folders.map((f, i) => (
          <NS.FolderRow key={i} name={f.name} sub={f.sub} color={f.color} icon={gl(f.icon)} />
        ))}
      </div>
      <div className="dock">
        <GlassTabBar value="memoire" onChange={go} hidden={hidden} />
        <RecipientComposer recipients={[{ key: "relvo", name: "Relvo", kind: "relvo" }]} />
      </div>
    </div>
  );
}

// ---- REGLAGES ----
function Reglages({ go, openConvos }) {
  const [tab, setTab] = React.useState("profil");
  const [prefs, setPrefs] = React.useState([true, true, true, false]);
  const tg = (i) => setPrefs((p) => p.map((v, j) => (j === i ? !v : v)));
  return (
    <div className="screen">
      <div className="scroll" style={{ paddingBottom: 188 }}>
        <RelvoHeader title="Réglages" subtitle="Tasty Crousty · Vincent" logoSrc={LOGO} onLogoClick={openConvos} paddingBottom={42} />
        <SegTabs overlap value={tab} onChange={setTab} tabs={[
          { key: "profil", label: "Profil" }, { key: "canaux", label: "Canaux" }, { key: "prefs", label: "Préférences" },
        ]} />
        {tab === "profil" ? (
          <React.Fragment>
            <div className="card-s">
              <div className="formrow"><span className="lab">Nom</span><span className="val">Vincent</span></div>
              <div className="formrow"><span className="lab">Email</span><span className="val">vincent@vccimpact.fr</span></div>
              <div className="formrow"><span className="lab">Entreprise</span><span className="val">Tasty Crousty</span></div>
              <div className="formrow"><span className="lab">Mot de passe</span><span className="val">••••••••</span></div>
            </div>
            <div className="card-s"><div className="logout"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></svg> Se déconnecter</div></div>
          </React.Fragment>
        ) : tab === "canaux" ? (
          <div className="card-s">
            <div className="srow"><span className="ic" style={{ background: "var(--green-50)", color: "var(--green-600)" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 20.5l1.7-5.6A8.4 8.4 0 1 1 21 11.5Z" /></svg></span><div className="bd"><div className="nm">WhatsApp Business</div><div className="ds">+33 6 12 34 56 78</div></div><span className="status-dot">Connecté</span></div>
            <div className="srow"><span className="ic" style={{ background: "var(--blue-50)", color: "var(--blue-800)" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg></span><div className="bd"><div className="nm">Email professionnel</div><div className="ds">tasty-crousty-a1b2@inbound.relvo.io</div></div><span className="status-dot">Connecté</span></div>
          </div>
        ) : (
          <div className="card-s">
            {["Brief quotidien", "Suggestions automatiques", "Notifications push", "Lecture vocale des réponses"].map((t, i) => (
              <div className="srow" key={i}><div className="bd"><div className="nm">{t}</div></div><div className={"toggle" + (prefs[i] ? " on" : "")} onClick={() => tg(i)}><i /></div></div>
            ))}
          </div>
        )}
      </div>
      <div className="dock">
        <GlassTabBar value="reglages" onChange={go} />
        <RecipientComposer recipients={[{ key: "relvo", name: "Relvo", kind: "relvo" }]} />
      </div>
    </div>
  );
}

// ---- SUBJECT detail ----
function Subject({ id, back, openConvos }) {
  const s = D.subjects.find((x) => x.id === id) || D.subjects[0];
  const [tab, setTab] = React.useState("messages");
  const [tasks, setTasks] = React.useState(D.tasks);
  const [adding, setAdding] = React.useState(false);
  const [nt, setNt] = React.useState("");
  const toggle = (i) => setTasks((ts) => ts.map((t, j) => (j === i ? { ...t, done: !t.done } : t)));
  const add = () => { if (!nt.trim()) return; setTasks((ts) => [...ts, { title: nt, source: "me", done: false }]); setNt(""); setAdding(false); };
  return (
    <div className="screen">
      <div className="scroll" style={{ paddingBottom: 110 }}>
        <RelvoHeader title={s.title} subtitle={s.id + " · " + s.contact} logoSrc={LOGO} onBack={back} onLogoClick={openConvos} paddingBottom={40}>
          <div className="strip">
            {s.urgent ? <span className="tag" style={{ background: "var(--red-600)", color: "#fff" }}>⚑ Urgent</span> : null}
            <span className="tag" style={{ background: "rgba(255,255,255,.18)", color: "#fff" }}>Nouveau</span>
            <span className="tag" style={{ background: "rgba(255,255,255,.18)", color: "#fff" }}>À faire · 2</span>
          </div>
          <div className="summary-v"><div className="rh">{SPARK} Résumé de Relvo</div><p>{s.summary} J'attends votre validation avant de répondre.</p></div>
        </RelvoHeader>
        <SegTabs overlap value={tab} onChange={setTab} tabs={[
          { key: "messages", label: "Messages" }, { key: "taches", label: "Tâches", count: tasks.length }, { key: "journal", label: "Journal" },
        ]} />

        {tab === "messages" ? (
          <div className="chat">
            <ChatBubble actor="ext" name="Karim Benali" channel="WhatsApp · 35 min" logoSrc={LOGO}>Rupture sur la sauce blanche. Je peux vous proposer une substitution équivalente.</ChatBubble>
            <ChatBubble actor="ext" name="Karim Benali" channel="WhatsApp" logoSrc={LOGO} attachment={{ name: "Sauce-Subst-2291.pdf", label: "Fiche produit" }}>Voici la fiche produit.</ChatBubble>
            <ChatBubble direction="out">Merci Karim, je regarde ça aujourd'hui.</ChatBubble>
            <div className="action-block">
              <div className="ah">{SPARK} Brouillon préparé par Relvo</div>
              <div className="ab">« Merci Karim. La substitution nous convient, envoyez-nous la fiche allergènes à jour et nous validons la commande. »</div>
              <div style={{ display: "flex", gap: 8 }}><button className="btn primary">Envoyer</button><button className="btn ghost">Modifier</button></div>
            </div>
          </div>
        ) : tab === "taches" ? (
          <div>
            {tasks.map((t, i) => <TaskRow key={i} title={t.title} source={t.source} due={t.due} done={t.done} onToggle={() => toggle(i)} />)}
            {adding ? (
              <div style={{ display: "flex", gap: 8, padding: "8px 18px", margin: "0 14px" }}>
                <input autoFocus value={nt} onChange={(e) => setNt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Nouvelle tâche…" style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 11, padding: "11px 13px", font: "inherit", fontSize: 14, outline: "none" }} />
                <button className="btn primary" onClick={add}>Ajouter</button>
              </div>
            ) : (
              <div className="addtask" onClick={() => setAdding(true)}><span className="plus"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--relvo)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg></span> Ajouter une tâche</div>
            )}
          </div>
        ) : (
          <JournalTimeline items={D.journal} />
        )}
      </div>
      <div className="dock">
        <RecipientComposer recipients={[
          { key: "karim", name: "Karim", kind: "human", initials: "KB", sublabel: s.org + " · WhatsApp" },
          { key: "relvo", name: "Relvo", kind: "relvo", sublabel: "Votre assistant" },
        ]} defaultValue="karim" />
      </div>
    </div>
  );
}

// ---- CONVERSATION ----
function Conversation({ back, openConvos }) {
  return (
    <div className="screen">
      <div className="scroll" style={{ paddingBottom: 110, background: "var(--bg-secondary)" }}>
        <RelvoHeader title="Relvo" subtitle="Votre assistant — toujours là" logoSrc={LOGO} onBack={back} onLogoClick={openConvos} rounded={false} paddingBottom={14} />
        <div className="chat">
          <div className="daysep">Aujourd'hui</div>
          <ChatBubble direction="out">Où en est le remplacement de la sauce blanche ?</ChatBubble>
          <ChatBubble actor="relvo" name="Relvo" channel="à l'instant" logoSrc={LOGO}>Karim propose une substitution. J'ai préparé une réponse et 2 tâches sur <b>SUB-0142</b>. J'attends votre validation pour répondre.</ChatBubble>
          <ChatBubble direction="out">Parfait, envoie la réponse.</ChatBubble>
          <ChatBubble actor="relvo" name="Relvo" channel="à l'instant" logoSrc={LOGO}>C'est envoyé ✦. Je vous préviens dès que Karim confirme.</ChatBubble>
        </div>
      </div>
      <div className="dock">
        <RecipientComposer recipients={[{ key: "relvo", name: "Relvo", kind: "relvo" }]} />
      </div>
    </div>
  );
}

// ---- CONVERSATIONS list ----
function Conversations({ back, openConversation }) {
  return (
    <div className="screen">
      <div className="scroll" style={{ background: "var(--bg-secondary)", paddingBottom: 30 }}>
        <RelvoHeader title="Mes conversations" subtitle="avec Relvo" logoSrc={LOGO} onBack={back} rounded={false} paddingBottom={14} />
        <div className="conv-new" onClick={openConversation}>
          <span className="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg></span>
          <span><span className="t">Nouvelle conversation</span><span className="s">Discussion générale, sans contexte de page</span></span>
        </div>
        <div className="csec">Récentes</div>
        {D.conversations.map((c, i) => <ConvListItem key={i} title={c.title} preview={c.preview} when={c.when} context={c.context} onClick={openConversation} />)}
      </div>
    </div>
  );
}

// ---- App shell ----
function App() {
  const [tab, setTab] = React.useState("accueil");
  const [view, setView] = React.useState({ name: "tabs" });
  const go = (k) => { setTab(k); setView({ name: "tabs" }); };
  const openSubject = (id) => setView({ name: "subject", id });
  const openConvos = () => setView({ name: "convos" });
  const openConversation = () => setView({ name: "conversation" });
  const back = () => setView({ name: "tabs" });

  let body;
  if (view.name === "subject") body = <Subject id={view.id} back={back} openConvos={openConvos} />;
  else if (view.name === "conversation") body = <Conversation back={back} openConvos={openConvos} />;
  else if (view.name === "convos") body = <Conversations back={back} openConversation={openConversation} />;
  else if (tab === "fil") body = <Feed go={go} openSubject={openSubject} openConvos={openConvos} />;
  else if (tab === "memoire") body = <Memoire go={go} openConvos={openConvos} />;
  else if (tab === "reglages") body = <Reglages go={go} openConvos={openConvos} />;
  else body = <Home go={go} openSubject={openSubject} openConvos={openConvos} />;

  return <div className="phone">{body}</div>;
}

window.RelvoAppB = App;
