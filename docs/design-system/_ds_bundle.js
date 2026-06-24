/* @ds-bundle: {"format":3,"namespace":"RelvoDesignSystem_ad3a3c","components":[{"name":"KpiTile","sourcePath":"components/cards/KpiTile.jsx"},{"name":"SubjectCard","sourcePath":"components/cards/SubjectCard.jsx"},{"name":"TaskCard","sourcePath":"components/cards/TaskCard.jsx"},{"name":"MessageBubble","sourcePath":"components/conversation/MessageBubble.jsx"},{"name":"RelvoComposer","sourcePath":"components/conversation/RelvoComposer.jsx"},{"name":"RelvoOrb","sourcePath":"components/conversation/RelvoOrb.jsx"},{"name":"ActorPill","sourcePath":"components/core/ActorPill.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Sparkles","sourcePath":"components/icons/icons.jsx"},{"name":"Flag","sourcePath":"components/icons/icons.jsx"},{"name":"Hourglass","sourcePath":"components/icons/icons.jsx"},{"name":"SquareCheck","sourcePath":"components/icons/icons.jsx"},{"name":"Check","sourcePath":"components/icons/icons.jsx"},{"name":"User","sourcePath":"components/icons/icons.jsx"},{"name":"Paperclip","sourcePath":"components/icons/icons.jsx"},{"name":"Clock","sourcePath":"components/icons/icons.jsx"},{"name":"Camera","sourcePath":"components/icons/icons.jsx"},{"name":"Mic","sourcePath":"components/icons/icons.jsx"},{"name":"Send","sourcePath":"components/icons/icons.jsx"},{"name":"FileText","sourcePath":"components/icons/icons.jsx"},{"name":"ArrowLeft","sourcePath":"components/icons/icons.jsx"},{"name":"StatusBadge","sourcePath":"components/markers/SubjectMarkers.jsx"},{"name":"UrgentFlag","sourcePath":"components/markers/SubjectMarkers.jsx"},{"name":"TodoBadge","sourcePath":"components/markers/SubjectMarkers.jsx"},{"name":"WaitingBadge","sourcePath":"components/markers/SubjectMarkers.jsx"},{"name":"SuggestBadge","sourcePath":"components/markers/SubjectMarkers.jsx"},{"name":"UnreadCount","sourcePath":"components/markers/SubjectMarkers.jsx"},{"name":"ChatBubble","sourcePath":"components/relvo-b/ChatBubble.jsx"},{"name":"ConvListItem","sourcePath":"components/relvo-b/ConvListItem.jsx"},{"name":"FolderRow","sourcePath":"components/relvo-b/FolderRow.jsx"},{"name":"GlassTabBar","sourcePath":"components/relvo-b/GlassTabBar.jsx"},{"name":"JournalTimeline","sourcePath":"components/relvo-b/JournalTimeline.jsx"},{"name":"MetricsCard","sourcePath":"components/relvo-b/MetricsCard.jsx"},{"name":"RecipientComposer","sourcePath":"components/relvo-b/RecipientComposer.jsx"},{"name":"RelvoHeader","sourcePath":"components/relvo-b/RelvoHeader.jsx"},{"name":"SegTabs","sourcePath":"components/relvo-b/SegTabs.jsx"},{"name":"SubjectRow","sourcePath":"components/relvo-b/SubjectRow.jsx"},{"name":"SwipeRow","sourcePath":"components/relvo-b/SwipeRow.jsx"},{"name":"TaskRow","sourcePath":"components/relvo-b/TaskRow.jsx"}],"sourceHashes":{"components/cards/KpiTile.jsx":"b357a8acfef5","components/cards/SubjectCard.jsx":"0871f42c83ba","components/cards/TaskCard.jsx":"70cc5f9ac26e","components/conversation/MessageBubble.jsx":"5056e01dcfb4","components/conversation/RelvoComposer.jsx":"871316bb4f89","components/conversation/RelvoOrb.jsx":"90703a9ab618","components/core/ActorPill.jsx":"a32aeb49a149","components/core/Badge.jsx":"c06e2411f33f","components/core/Button.jsx":"2a79c322bc98","components/core/IconButton.jsx":"83927e0a4934","components/icons/icons.jsx":"7c4e157ac469","components/markers/SubjectMarkers.jsx":"553384e3dc7a","components/relvo-b/ChatBubble.jsx":"851928d430a5","components/relvo-b/ConvListItem.jsx":"e7b9196e7ade","components/relvo-b/FolderRow.jsx":"6a2a69143a0a","components/relvo-b/GlassTabBar.jsx":"9afdab870582","components/relvo-b/JournalTimeline.jsx":"c2e59ce192c0","components/relvo-b/MetricsCard.jsx":"86d9f38b835a","components/relvo-b/RecipientComposer.jsx":"82417dd9dbc9","components/relvo-b/RelvoHeader.jsx":"d5b871b6026b","components/relvo-b/SegTabs.jsx":"c187866f42ec","components/relvo-b/SubjectRow.jsx":"905b1b945509","components/relvo-b/SwipeRow.jsx":"c0c525d9529e","components/relvo-b/TaskRow.jsx":"05956161b8f0","ui_kits/relvo-app/app.jsx":"86179737b437","ui_kits/relvo-app/data.js":"a8ba9981c1b1","ui_kits/relvo-mobile/data.js":"0a64dcdde969","ui_kits/relvo-mobile/screens.jsx":"5b45ea01c863"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.RelvoDesignSystem_ad3a3c = window.RelvoDesignSystem_ad3a3c || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/cards/KpiTile.jsx
try { (() => {
// KpiTile — the « Vue du jour » tiles on Home (2×2 grid). `tone="urgent"`
// turns the tile red while value > 0 (rare signal), neutral at 0.
// `tone="relvo"` is the pride KPI « % d'aide Relvo » (violet).
// `icon` is any 26px glyph element.

function KpiTile({
  value,
  label,
  meta,
  icon,
  tone = "default",
  style
}) {
  const urgent = tone === "urgent" && Number(value) > 0;
  const relvo = tone === "relvo";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      background: urgent ? "var(--red-50)" : relvo ? "var(--relvo-bg)" : "var(--bg-primary)",
      border: `1px solid ${urgent ? "var(--red-200)" : relvo ? "var(--purple-100)" : "var(--border-light)"}`,
      borderRadius: "var(--radius-lg)",
      padding: "12px 14px",
      boxShadow: "var(--shadow-card)",
      fontFamily: "var(--font-body)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "8px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-numeric)",
      fontSize: "30px",
      fontWeight: 700,
      letterSpacing: "-1.2px",
      lineHeight: 1,
      color: urgent ? "var(--red-600)" : relvo ? "var(--relvo)" : "var(--text-primary)"
    }
  }, value), icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 26,
      height: 26,
      color: relvo ? "var(--relvo)" : "var(--text-secondary)",
      display: "inline-flex"
    }
  }, icon) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "6px",
      fontSize: "13px",
      color: "var(--text-secondary)"
    }
  }, label), meta ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "2px",
      fontSize: "11px",
      color: "var(--text-tertiary)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, meta) : null);
}
Object.assign(__ds_scope, { KpiTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/cards/KpiTile.jsx", error: String((e && e.message) || e) }); }

// components/core/ActorPill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// The actor triptych (product invariant): Moi=blue, Relvo=violet, Externe=amber.
// A pill with an initialed avatar dot. `actor` is one of me | relvo | ext.

const CONFIG = {
  me: {
    letter: "M",
    label: "Moi",
    pill: {
      background: "var(--blue-50)",
      color: "var(--blue-800)"
    },
    avatar: "var(--brand)"
  },
  relvo: {
    letter: "R",
    label: "Relvo",
    pill: {
      background: "var(--relvo-bg)",
      color: "var(--relvo)"
    },
    avatar: "var(--relvo)"
  },
  ext: {
    letter: "E",
    label: "Externe",
    pill: {
      background: "var(--amber-50)",
      color: "var(--amber-800)"
    },
    avatar: "var(--amber-600)"
  }
};
function ActorPill({
  actor = "relvo",
  label,
  style,
  ...rest
}) {
  const cfg = CONFIG[actor] || CONFIG.relvo;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      fontFamily: "var(--font-body)",
      fontSize: "11px",
      fontWeight: 650,
      padding: "2px 7px",
      borderRadius: "var(--radius-pill)",
      ...cfg.pill,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 15,
      height: 15,
      borderRadius: "50%",
      display: "grid",
      placeItems: "center",
      fontSize: "9px",
      fontWeight: 800,
      color: "#fff",
      background: cfg.avatar
    }
  }, cfg.letter), label ?? cfg.label);
}
Object.assign(__ds_scope, { ActorPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ActorPill.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Generic pill badge. The Relvo marker badges (StatusBadge, TodoBadge, …) are
// thin wrappers over this — see components/markers/SubjectMarkers.jsx.

const TONES = {
  blue: {
    background: "var(--blue-50)",
    color: "var(--blue-800)"
  },
  amber: {
    background: "var(--amber-50)",
    color: "var(--amber-800)"
  },
  purple: {
    background: "var(--purple-50)",
    color: "var(--purple-800)"
  },
  red: {
    background: "var(--red-50)",
    color: "var(--red-600)"
  },
  green: {
    background: "var(--green-50)",
    color: "var(--green-600)"
  },
  relvo: {
    background: "var(--relvo-bg)",
    color: "var(--relvo)"
  },
  neutral: {
    background: "var(--bg-tertiary)",
    color: "var(--text-secondary)"
  }
};
function Badge({
  children,
  tone = "neutral",
  icon,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      fontFamily: "var(--font-body)",
      fontSize: "11.5px",
      fontWeight: 650,
      lineHeight: 1,
      padding: "3px 9px",
      borderRadius: "var(--radius-pill)",
      whiteSpace: "nowrap",
      ...TONES[tone],
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      width: 13,
      height: 13
    }
  }, icon) : null, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Relvo button. Pill-ish radius, generous tap target (mobile-first).
// Variants map to the mockup's .btn family: primary (brand blue),
// ghost (neutral outline), relvo (violet — agent actions), danger, success.

const VARIANTS = {
  primary: {
    background: "var(--brand)",
    color: "#fff",
    border: "1px solid transparent"
  },
  ghost: {
    background: "var(--bg-secondary)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border)"
  },
  relvo: {
    background: "var(--relvo-bg)",
    color: "var(--relvo)",
    border: "1px solid var(--purple-100)"
  },
  danger: {
    background: "var(--red-50)",
    color: "var(--red-600)",
    border: "1px solid transparent"
  },
  success: {
    background: "var(--green-50)",
    color: "var(--green-600)",
    border: "1px solid transparent"
  }
};
const SIZES = {
  sm: {
    fontSize: "13px",
    padding: "7px 12px"
  },
  md: {
    fontSize: "13.5px",
    padding: "9px 14px"
  },
  lg: {
    fontSize: "15px",
    padding: "12px 18px"
  }
};
function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  block = false,
  disabled = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    style: {
      display: block ? "flex" : "inline-flex",
      width: block ? "100%" : undefined,
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      fontFamily: "var(--font-body)",
      fontWeight: 650,
      lineHeight: 1.1,
      borderRadius: "var(--radius)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      transition: "filter var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-standard)",
      ...VARIANTS[variant],
      ...SIZES[size],
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      width: 16,
      height: 16
    }
  }, icon) : null, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Circular / squircle icon button used across the chrome (app bar action,
// composer mic/camera/spark, calendar nav). `tone` sets the fill.

const TONES = {
  neutral: {
    background: "var(--bg-secondary)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border)"
  },
  brand: {
    background: "var(--brand)",
    color: "#fff",
    border: "1px solid transparent"
  },
  relvo: {
    background: "var(--relvo)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "var(--shadow-relvo)"
  },
  relvoSoft: {
    background: "var(--relvo-bg)",
    color: "var(--relvo)",
    border: "1px solid transparent"
  },
  ghost: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid transparent"
  }
};
function IconButton({
  children,
  tone = "neutral",
  size = 38,
  round = true,
  label,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    title: label,
    style: {
      width: size,
      height: size,
      flex: `0 0 ${size}px`,
      borderRadius: round ? "var(--radius-pill)" : "var(--radius-md)",
      display: "grid",
      placeItems: "center",
      cursor: "pointer",
      transition: "transform var(--dur-fast) var(--ease-standard)",
      ...TONES[tone],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/icons/icons.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Inline icon set mirroring the Lucide glyphs the Relvo app uses
// (lucide-react in the codebase). Stroke 2, round caps/joins — Lucide defaults.
// Kept inline so bundled components stay dependency-free.

function Svg({
  size = 16,
  stroke = 2,
  fill = "none",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("svg", _extends({
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: fill,
    stroke: fill === "none" ? "currentColor" : "none",
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, rest), children);
}
const Sparkles = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M9.94 4.66 11 8.5l3.84 1.06a.5.5 0 0 1 0 .96L11 11.5l-1.06 3.84a.5.5 0 0 1-.96 0L7.92 11.5 4.08 10.44a.5.5 0 0 1 0-.96L7.92 8.5l1.06-3.84a.5.5 0 0 1 .96 0Z"
}), /*#__PURE__*/React.createElement("path", {
  d: "M18 5h.01M19 12h.01"
}));
const Flag = p => /*#__PURE__*/React.createElement(Svg, _extends({
  fill: "currentColor",
  stroke: 0
}, p), /*#__PURE__*/React.createElement("path", {
  d: "M5 2a1 1 0 0 1 1 1v18a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1z"
}), /*#__PURE__*/React.createElement("path", {
  d: "M7 3.5h11.5a1 1 0 0 1 .8 1.6L17 8l2.3 2.9a1 1 0 0 1-.8 1.6H7z"
}));
const Hourglass = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M6 2h12M6 22h12M6 2c0 4.5 3 6 6 8 3-2 6-3.5 6-8M6 22c0-4.5 3-6 6-8 3 2 6 3.5 6 8"
}));
const SquareCheck = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M9 11l3 3L22 4"
}), /*#__PURE__*/React.createElement("path", {
  d: "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
}));
const Check = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M20 6 9 17l-5-5"
}));
const User = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "7",
  r: "4"
}));
const Paperclip = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"
}));
const Clock = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "9"
}), /*#__PURE__*/React.createElement("path", {
  d: "M12 7v5l3 2"
}));
const Camera = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "13",
  r: "3.2"
}));
const Mic = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("rect", {
  x: "9",
  y: "3",
  width: "6",
  height: "11",
  rx: "3"
}), /*#__PURE__*/React.createElement("path", {
  d: "M5 11a7 7 0 0 0 14 0"
}), /*#__PURE__*/React.createElement("path", {
  d: "M12 18v3"
}));
const Send = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M22 2 11 13"
}), /*#__PURE__*/React.createElement("path", {
  d: "M22 2 15 22l-4-9-9-4Z"
}));
const FileText = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
}), /*#__PURE__*/React.createElement("path", {
  d: "M14 2v6h6M16 13H8M16 17H8M10 9H8"
}));
const ArrowLeft = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "m12 19-7-7 7-7M19 12H5"
}));
Object.assign(__ds_scope, { Sparkles, Flag, Hourglass, SquareCheck, Check, User, Paperclip, Clock, Camera, Mic, Send, FileText, ArrowLeft });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/icons/icons.jsx", error: String((e && e.message) || e) }); }

// components/cards/TaskCard.jsx
try { (() => {
// TaskCard — a checkable task. Carries a source pill (✦ Relvo / Moi) and an
// optional due date. Checked tasks strike through and dim.

function TaskCard({
  title,
  done = false,
  source = "me",
  due,
  onToggle,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "11px",
      alignItems: "flex-start",
      background: "var(--bg-primary)",
      border: "1px solid var(--border-light)",
      borderRadius: "var(--radius)",
      padding: "12px",
      boxShadow: "var(--shadow-card)",
      fontFamily: "var(--font-body)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onToggle,
    "aria-pressed": done,
    style: {
      width: 22,
      height: 22,
      flex: "0 0 22px",
      marginTop: 1,
      borderRadius: "var(--radius-sm)",
      border: `2px solid ${done ? "var(--green-600)" : "var(--border)"}`,
      background: done ? "var(--green-600)" : "transparent",
      color: done ? "#fff" : "transparent",
      display: "grid",
      placeItems: "center",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Check, {
    size: 13,
    stroke: 3
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "14.5px",
      fontWeight: 600,
      color: done ? "var(--text-tertiary)" : "var(--text-primary)",
      textDecoration: done ? "line-through" : "none"
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "8px",
      alignItems: "center",
      marginTop: "6px",
      flexWrap: "wrap",
      fontSize: "11.5px",
      color: "var(--text-tertiary)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.ActorPill, {
    actor: source,
    label: source === "relvo" ? "Relvo" : "Moi"
  }), due ? /*#__PURE__*/React.createElement("span", null, due) : null)));
}
Object.assign(__ds_scope, { TaskCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/cards/TaskCard.jsx", error: String((e && e.message) || e) }); }

// components/conversation/MessageBubble.jsx
try { (() => {
// MessageBubble — outgoing (Moi) right-aligned blue; incoming (Externe/Relvo)
// left-aligned with an actor header + channel label. Optional attachment chip.

function MessageBubble({
  direction = "incoming",
  actor = "ext",
  senderName,
  channel,
  content,
  attachment,
  style
}) {
  const outgoing = direction === "outgoing";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "86%",
      alignSelf: outgoing ? "flex-end" : "flex-start",
      width: outgoing ? undefined : "100%",
      fontFamily: "var(--font-body)",
      ...style
    }
  }, !outgoing ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: "5px",
      display: "flex",
      alignItems: "center",
      gap: "6px"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.ActorPill, {
    actor: actor,
    label: senderName
  }), channel ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "11px",
      color: "var(--text-tertiary)"
    }
  }, channel) : null) : null, /*#__PURE__*/React.createElement("div", {
    style: outgoing ? {
      padding: "10px 13px",
      fontSize: "14.5px",
      borderRadius: "16px 16px 4px 16px",
      background: "var(--brand)",
      color: "#fff"
    } : {
      padding: "10px 13px",
      fontSize: "14.5px",
      borderRadius: "4px 16px 16px 16px",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      border: "1px solid var(--border-light)",
      boxShadow: "var(--shadow-card)"
    }
  }, content), attachment ? /*#__PURE__*/React.createElement("span", {
    style: {
      marginTop: "6px",
      display: "inline-flex",
      alignItems: "center",
      gap: "9px",
      background: "var(--bg-primary)",
      border: "1px solid var(--border-light)",
      borderRadius: "var(--radius)",
      padding: "8px 10px",
      boxShadow: "var(--shadow-card)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 30,
      height: 30,
      flex: "0 0 30px",
      display: "grid",
      placeItems: "center",
      borderRadius: 7,
      background: "var(--bg-tertiary)",
      color: "var(--text-secondary)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.FileText, {
    size: 16
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontSize: "13px",
      fontWeight: 600
    }
  }, attachment.name), attachment.label ? /*#__PURE__*/React.createElement("span", {
    style: {
      marginTop: "3px",
      display: "inline-block",
      fontSize: "11px",
      color: "var(--amber-800)",
      background: "var(--amber-50)",
      padding: "1px 7px",
      borderRadius: "var(--radius-pill)"
    }
  }, attachment.label) : null)) : null);
}
Object.assign(__ds_scope, { MessageBubble });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/conversation/MessageBubble.jsx", error: String((e && e.message) || e) }); }

// components/conversation/RelvoComposer.jsx
try { (() => {
// RelvoComposer — the SIGNATURE persistent bar « Demander à Relvo… », fixed
// above the bottom nav. ✦ spark = conversation history, field = new conversation
// scoped to the page context, 📷 = photo (delivery note / quote), 🎙 = voice.
// When `typing`, camera + mic collapse to a single Send button (voice-first).

function RelvoComposer({
  placeholder = "Demander à Relvo…",
  typing = false,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "9px",
      padding: "9px 12px",
      background: "var(--bg-primary)",
      borderTop: "1px solid var(--border)",
      boxShadow: "var(--shadow-up)",
      fontFamily: "var(--font-body)",
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    tone: "relvo",
    size: 38,
    label: "Mes conversations",
    style: {
      fontSize: "17px"
    }
  }, "\u2726"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      gap: "8px",
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-pill)",
      padding: "9px 14px",
      fontSize: "14px",
      color: "var(--text-tertiary)"
    }
  }, placeholder), typing ? /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    tone: "brand",
    size: 38,
    label: "Envoyer"
  }, /*#__PURE__*/React.createElement(__ds_scope.Send, {
    size: 18
  })) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    tone: "neutral",
    size: 38,
    label: "Prendre une photo"
  }, /*#__PURE__*/React.createElement(__ds_scope.Camera, {
    size: 18
  })), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    tone: "relvo",
    size: 42,
    label: "Dicter \u2014 maintenir pour parler"
  }, /*#__PURE__*/React.createElement(__ds_scope.Mic, {
    size: 20
  }))));
}
Object.assign(__ds_scope, { RelvoComposer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/conversation/RelvoComposer.jsx", error: String((e && e.message) || e) }); }

// components/conversation/RelvoOrb.jsx
try { (() => {
// RelvoOrb — the agent's identity mark (✦). Used as the conversation empty-state
// avatar and as the spark on the persistent composer. A solid violet disc with
// the sparkle glyph; `size` scales it.

function RelvoOrb({
  size = 52,
  glow = true,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      flex: `0 0 ${size}px`,
      borderRadius: "50%",
      background: "var(--relvo)",
      color: "#fff",
      display: "grid",
      placeItems: "center",
      boxShadow: glow ? "var(--shadow-relvo)" : "none",
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Sparkles, {
    size: Math.round(size * 0.46)
  }));
}
Object.assign(__ds_scope, { RelvoOrb });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/conversation/RelvoOrb.jsx", error: String((e && e.message) || e) }); }

// components/markers/SubjectMarkers.jsx
try { (() => {
// Subject markers — two DISTINCT families (product invariant 5):
//   • StatusBadge = lifecycle. Only `new` (Nouveau) and `resolved` (Terminé)
//     render; `acknowledged`/`archived` render nothing.
//   • Cumulative markers (Urgent flag, À faire, En attente, suggestions,
//     unread count) — independent of status, several may show at once.

/** Lifecycle badge — renders only for `new` and `resolved`. */
function StatusBadge({
  status
}) {
  if (status === "new") return /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "blue"
  }, "Nouveau");
  if (status === "resolved") return /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "green"
  }, "Termin\xE9");
  return null;
}

/** Urgent flag — icon only, red, ONLY for priority `critical` (rarity = signal). */
function UrgentFlag({
  size = 15
}) {
  return /*#__PURE__*/React.createElement("span", {
    title: "Urgent",
    "aria-label": "Urgent",
    style: {
      display: "inline-flex",
      alignItems: "center",
      color: "var(--red-600)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Flag, {
    size: size
  }));
}

/** « À faire » — derived from open tasks > 0. */
function TodoBadge() {
  return /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "amber",
    icon: /*#__PURE__*/React.createElement(__ds_scope.SquareCheck, {
      size: 13,
      stroke: 2.4
    })
  }, "\xC0 faire");
}

/** « En attente » — Relvo is waiting on a third party. */
function WaitingBadge() {
  return /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "neutral",
    icon: /*#__PURE__*/React.createElement(__ds_scope.Hourglass, {
      size: 12
    })
  }, "En attente");
}

/** « ✦ N suggérées » — unacknowledged Relvo suggestions (violet). */
function SuggestBadge({
  count = 0
}) {
  if (count <= 0) return null;
  return /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "relvo",
    icon: /*#__PURE__*/React.createElement(__ds_scope.Sparkles, {
      size: 13
    })
  }, count, " sugg\xE9r\xE9e", count > 1 ? "s" : "");
}

/** Unread message count (WhatsApp-style). `corner` anchors it to a card. */
function UnreadCount({
  count = 0,
  corner = false
}) {
  if (count <= 0) return null;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 18,
      height: 18,
      padding: "0 5px",
      borderRadius: 9,
      background: "var(--brand)",
      color: "#fff",
      fontFamily: "var(--font-body)",
      fontSize: "11px",
      fontWeight: 700,
      lineHeight: 1,
      ...(corner ? {
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 1
      } : null)
    }
  }, count);
}
Object.assign(__ds_scope, { StatusBadge, UrgentFlag, TodoBadge, WaitingBadge, SuggestBadge, UnreadCount });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/markers/SubjectMarkers.jsx", error: String((e && e.message) || e) }); }

// components/cards/SubjectCard.jsx
try { (() => {
// SubjectCard — the most important component in the product. A Subject is a
// business workspace (messages + tasks + events around one situation). The
// card surfaces reference, status, cumulative markers, contact/attachment/last
// activity meta, Relvo suggestion count, unread pip and a progress bar.

function SubjectCard({
  reference,
  title,
  summary,
  priority = "low",
  status = "acknowledged",
  waitingForReply = false,
  openTaskCount = 0,
  suggestionCount = 0,
  unreadCount = 0,
  contactName,
  attachmentCount = 0,
  lastActivityLabel,
  progress = null,
  showSummary = true,
  tone = "default",
  onClick,
  style
}) {
  const urgent = priority === "critical";
  const done = tone === "done";
  return /*#__PURE__*/React.createElement("article", {
    onClick: onClick,
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: "9px",
      background: done ? "var(--bg-secondary)" : "var(--bg-primary)",
      border: "1px solid var(--border-light)",
      borderRadius: "var(--radius-lg)",
      padding: "13px",
      boxShadow: "var(--shadow-card)",
      fontFamily: "var(--font-body)",
      cursor: onClick ? "pointer" : "default",
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.UnreadCount, {
    count: unreadCount,
    corner: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "7px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "11.5px",
      fontWeight: 700,
      letterSpacing: "0.3px",
      color: "var(--text-tertiary)",
      fontFamily: "var(--font-numeric)"
    }
  }, reference), urgent ? /*#__PURE__*/React.createElement(__ds_scope.UrgentFlag, null) : null, /*#__PURE__*/React.createElement(__ds_scope.StatusBadge, {
    status: status
  }), !done && openTaskCount > 0 ? /*#__PURE__*/React.createElement(__ds_scope.TodoBadge, null) : null, !done && waitingForReply ? /*#__PURE__*/React.createElement(__ds_scope.WaitingBadge, null) : null), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: "15.5px",
      lineHeight: "var(--leading-snug)",
      fontWeight: 700,
      letterSpacing: "-0.2px",
      color: "var(--text-primary)",
      margin: 0
    }
  }, title), showSummary && summary ? /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: "13.5px",
      color: "var(--text-secondary)",
      margin: 0
    }
  }, summary) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "10px",
      fontSize: "12px",
      color: "var(--text-tertiary)"
    }
  }, contactName ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.User, {
    size: 14
  }), " ", contactName) : null, attachmentCount > 0 ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Paperclip, {
    size: 14
  }), " ", attachmentCount) : null, lastActivityLabel ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Clock, {
    size: 14
  }), " ", lastActivityLabel) : null, /*#__PURE__*/React.createElement(__ds_scope.SuggestBadge, {
    count: suggestionCount
  })), typeof progress === "number" ? /*#__PURE__*/React.createElement("div", {
    style: {
      height: 5,
      overflow: "hidden",
      borderRadius: 3,
      background: "var(--bg-tertiary)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      width: `${Math.round(progress * 100)}%`,
      background: "var(--brand)"
    }
  })) : null);
}
Object.assign(__ds_scope, { SubjectCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/cards/SubjectCard.jsx", error: String((e && e.message) || e) }); }

// components/relvo-b/ChatBubble.jsx
try { (() => {
// ChatBubble — Direction B. Outgoing (Moi) = blue, right. Incoming = left with
// an actor header: Relvo (violet-tinted bubble + ✦ logo avatar) or Externe
// (white bubble + amber initials). Optional attachment chip.

const SPARK = "M11.1 3.2 12.5 8l4.8 1.4c.6.2.6 1 0 1.2L12.5 12l-1.4 4.8c-.2.6-1 .6-1.2 0L8.5 12l-4.8-1.4c-.6-.2-.6-1 0-1.2L8.5 8 9.9 3.2c.2-.6 1-.6 1.2 0Z";
function ChatBubble({
  direction = "in",
  actor = "ext",
  name,
  channel,
  children,
  attachment,
  logoSrc = "../../assets/relvo-icon-256.png",
  style
}) {
  const out = direction === "out";
  const relvo = actor === "relvo";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "86%",
      alignSelf: out ? "flex-end" : "flex-start",
      width: out ? undefined : "100%",
      fontFamily: "var(--font-body)",
      ...style
    }
  }, !out ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      marginBottom: 6
    }
  }, relvo ? /*#__PURE__*/React.createElement("img", {
    src: logoSrc,
    alt: "",
    style: {
      width: 22,
      height: 22,
      borderRadius: "50%",
      objectFit: "cover"
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      height: 22,
      borderRadius: "50%",
      display: "grid",
      placeItems: "center",
      flex: "0 0 22px",
      color: "#fff",
      fontSize: 9,
      fontWeight: 800,
      background: "var(--amber-600)"
    }
  }, (name || "").slice(0, 2).toUpperCase() || "E"), name ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700
    }
  }, name) : null, channel ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "#a8a69d",
      whiteSpace: "nowrap"
    }
  }, channel) : null) : null, /*#__PURE__*/React.createElement("div", {
    style: out ? {
      fontSize: 14.5,
      lineHeight: 1.45,
      padding: "11px 14px",
      background: "var(--brand)",
      color: "#fff",
      borderRadius: "18px 18px 5px 18px"
    } : {
      fontSize: 14.5,
      lineHeight: 1.45,
      padding: "11px 14px",
      borderRadius: "5px 18px 18px 18px",
      background: relvo ? "var(--relvo-bg)" : "#fff",
      border: `1px solid ${relvo ? "var(--purple-100)" : "#ececea"}`,
      color: "var(--text-primary)",
      boxShadow: "0 1px 2px rgba(20,24,40,.05)"
    }
  }, children), attachment ? /*#__PURE__*/React.createElement("span", {
    style: {
      marginTop: 7,
      display: "inline-flex",
      alignItems: "center",
      gap: 9,
      background: "#fff",
      border: "1px solid #ececea",
      borderRadius: 12,
      padding: "8px 11px",
      boxShadow: "0 1px 2px rgba(20,24,40,.05)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 30,
      height: 30,
      flex: "0 0 30px",
      display: "grid",
      placeItems: "center",
      borderRadius: 8,
      background: "#f0eeea",
      color: "#86857d"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 2v6h6"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontSize: 13,
      fontWeight: 650
    }
  }, attachment.name), attachment.label ? /*#__PURE__*/React.createElement("span", {
    style: {
      marginTop: 2,
      display: "inline-block",
      fontSize: 11,
      color: "var(--amber-800)",
      background: "var(--amber-50)",
      padding: "1px 7px",
      borderRadius: "var(--radius-pill)"
    }
  }, attachment.label) : null)) : null);
}
Object.assign(__ds_scope, { ChatBubble });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/relvo-b/ChatBubble.jsx", error: String((e && e.message) || e) }); }

// components/relvo-b/ConvListItem.jsx
try { (() => {
// ConvListItem — a row in the « Mes conversations » list (Direction B). ✦ avatar,
// title, preview, timestamp right; optional context chip when tied to a Subject.

function ConvListItem({
  title,
  preview,
  when,
  context,
  onClick,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 13,
      padding: "14px 18px",
      margin: "0 14px",
      borderBottom: "1px solid #f1efeb",
      cursor: onClick ? "pointer" : "default",
      fontFamily: "var(--font-body)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 40,
      height: 40,
      borderRadius: "50%",
      background: "var(--relvo-bg)",
      display: "grid",
      placeItems: "center",
      flex: "0 0 40px"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "19",
    height: "19",
    viewBox: "0 0 24 24",
    fill: "var(--relvo)"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M11.1 3.2 12.5 8l4.8 1.4c.6.2.6 1 0 1.2L12.5 12l-1.4 4.8c-.2.6-1 .6-1.2 0L8.5 12l-4.8-1.4c-.6-.2-.6-1 0-1.2L8.5 8 9.9 3.2c.2-.6 1-.6 1.2 0Z"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontSize: 14.5,
      fontWeight: 700,
      letterSpacing: "-.2px",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, title), preview ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontSize: 12.5,
      color: "#86857d",
      marginTop: 2,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, preview) : null, context ? /*#__PURE__*/React.createElement("span", {
    style: {
      alignSelf: "flex-start",
      display: "inline-flex",
      alignItems: "center",
      fontSize: 10.5,
      fontWeight: 700,
      padding: "2px 7px",
      borderRadius: "var(--radius-pill)",
      background: "var(--blue-50)",
      color: "var(--blue-800)",
      marginTop: 5,
      whiteSpace: "nowrap"
    }
  }, context) : null), when ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: "#b3b1ab",
      flex: "0 0 auto",
      alignSelf: "flex-start",
      marginTop: 3,
      paddingLeft: 8
    }
  }, when) : null);
}
Object.assign(__ds_scope, { ConvListItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/relvo-b/ConvListItem.jsx", error: String((e && e.message) || e) }); }

// components/relvo-b/FolderRow.jsx
try { (() => {
// FolderRow — a memory « dossier » as a list row (Direction B). Colour-coded
// square icon by domain, name, sub-line (n sujets · n documents), chevron.

function FolderRow({
  name,
  sub,
  icon,
  color = "var(--blue-600)",
  onClick,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 13,
      padding: "14px 18px",
      margin: "0 14px",
      borderBottom: "1px solid #f1efeb",
      cursor: onClick ? "pointer" : "default",
      fontFamily: "var(--font-body)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 13,
      display: "grid",
      placeItems: "center",
      flex: "0 0 42px",
      color: "#fff",
      background: color
    }
  }, icon), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15.5,
      fontWeight: 700,
      letterSpacing: "-.2px"
    }
  }, name), sub ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "#86857d",
      marginTop: 2
    }
  }, sub) : null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#cfcdc7",
      flex: "0 0 auto"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "m9 6 6 6-6 6"
  }))));
}
Object.assign(__ds_scope, { FolderRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/relvo-b/FolderRow.jsx", error: String((e && e.message) || e) }); }

// components/relvo-b/GlassTabBar.jsx
try { (() => {
// GlassTabBar — bottom navigation in « Liquid Glass » (Direction B): frosted
// translucent white, specular top edge, content frosts through. Pairs with the
// violet RecipientComposer below it (violet-top / violet-bottom framing).
// Hides on scroll-down when `hidden` is true (drive from your scroll handler).

const ICONS = {
  accueil: /*#__PURE__*/React.createElement("path", {
    d: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5"
  }),
  fil: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "5",
    width: "18",
    height: "14",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m3 7 9 6 9-6"
  })),
  memoire: /*#__PURE__*/React.createElement("path", {
    d: "M12 5a3 3 0 1 0-5.99.1A4 4 0 0 0 3.5 11a4 4 0 0 0 .5 6.6A4 4 0 1 0 12 18Zm0 0a3 3 0 1 0 5.99.1A4 4 0 0 1 20.5 11a4 4 0 0 1-.5 6.6A4 4 0 1 1 12 18Z"
  }),
  reglages: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2A1.6 1.6 0 0 0 6.6 19.7l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15"
  }))
};
const DEFAULT_TABS = [{
  key: "accueil",
  label: "Accueil"
}, {
  key: "fil",
  label: "Mon fil"
}, {
  key: "memoire",
  label: "Mémoire"
}, {
  key: "reglages",
  label: "Réglages"
}];
function GlassTabBar({
  tabs = DEFAULT_TABS,
  value = "accueil",
  onChange,
  hidden = false,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      overflow: "hidden",
      background: "var(--glass-tab)",
      backdropFilter: "blur(var(--blur-glass)) saturate(var(--sat-glass))",
      WebkitBackdropFilter: "blur(var(--blur-glass)) saturate(var(--sat-glass))",
      borderTop: "1px solid var(--glass-stroke)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,.75)",
      maxHeight: hidden ? 0 : 64,
      opacity: hidden ? 0 : 1,
      transition: "max-height .3s var(--ease-standard), opacity .2s ease",
      fontFamily: "var(--font-body)",
      ...style
    }
  }, tabs.map(t => {
    const on = t.key === value;
    return /*#__PURE__*/React.createElement("button", {
      key: t.key,
      type: "button",
      onClick: () => onChange && onChange(t.key),
      style: {
        flex: 1,
        background: "none",
        border: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "8px 0 9px",
        fontSize: 10.5,
        fontWeight: 600,
        cursor: "pointer",
        color: on ? "var(--relvo)" : "#b3b1ab"
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: "22",
      height: "22",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, ICONS[t.key]), t.label);
  }));
}
Object.assign(__ds_scope, { GlassTabBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/relvo-b/GlassTabBar.jsx", error: String((e && e.message) || e) }); }

// components/relvo-b/JournalTimeline.jsx
try { (() => {
// JournalTimeline — a Subject's activity log as a connected timeline (Direction B).
// Dots are actor-coloured: Moi blue, Relvo violet, Externe amber.
// items: [{ actor: "me"|"relvo"|"ext", text, time }]  (text may be a node)

const DOT = {
  me: "var(--brand)",
  relvo: "var(--relvo)",
  ext: "var(--amber-600)"
};
function JournalTimeline({
  items = [],
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "8px 20px 4px",
      fontFamily: "var(--font-body)",
      ...style
    }
  }, items.map((it, i) => {
    const last = i === items.length - 1;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        gap: 13,
        paddingBottom: 17,
        position: "relative"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 11,
        height: 11,
        borderRadius: "50%",
        marginTop: 3,
        flex: "0 0 11px",
        border: "2px solid #fff",
        position: "relative",
        zIndex: 1,
        background: DOT[it.actor] || DOT.relvo
      }
    }), !last ? /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        left: 5,
        top: 13,
        bottom: -4,
        width: 2,
        background: "#ece9e3"
      }
    }) : null, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        color: "#3a3833",
        lineHeight: 1.4
      }
    }, it.text), it.time ? /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: "#a8a69d",
        marginTop: 3
      }
    }, it.time) : null));
  }));
}
Object.assign(__ds_scope, { JournalTimeline });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/relvo-b/JournalTimeline.jsx", error: String((e && e.message) || e) }); }

// components/relvo-b/MetricsCard.jsx
try { (() => {
// MetricsCard — the « carte à cheval » dashboard strip (Direction B). One white
// surface that overlaps the violet header bottom; cells divided by hairlines.
// Colour is reserved for signal: tone "urgent" → red, "relvo" → violet. A cell
// of type "gauge" renders a circular saturation ring (green→amber→red).

function gaugeColor(p) {
  if (p >= 80) return "var(--red-600)";
  if (p >= 50) return "#e8902b";
  return "var(--green-600)";
}
function Cell({
  m
}) {
  if (m.type === "gauge") {
    const p = Math.max(0, Math.min(100, m.percent || 0));
    return /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 7,
        padding: "0 4px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        width: 42,
        height: 42,
        display: "grid",
        placeItems: "center"
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: "42",
      height: "42",
      viewBox: "0 0 36 36"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "18",
      cy: "18",
      r: "15.9",
      fill: "none",
      stroke: "#efedea",
      strokeWidth: "3.6"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "18",
      cy: "18",
      r: "15.9",
      fill: "none",
      stroke: gaugeColor(p),
      strokeWidth: "3.6",
      strokeLinecap: "round",
      pathLength: "100",
      strokeDasharray: `${p} 100`,
      transform: "rotate(-90 18 18)"
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        fontFamily: "var(--font-numeric)",
        fontSize: 10.5,
        fontWeight: 700,
        color: "#1c1a22"
      }
    }, p, "%")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: "#9a988f",
        fontWeight: 600,
        textAlign: "center",
        lineHeight: 1.2
      }
    }, m.label));
  }
  const color = m.tone === "urgent" ? "var(--red-600)" : m.tone === "relvo" ? "var(--relvo)" : "#1c1a22";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 7,
      padding: "0 4px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-numeric)",
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: "-1px",
      lineHeight: 1,
      color,
      height: 42,
      display: "flex",
      alignItems: "center"
    }
  }, m.value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: "#9a988f",
      fontWeight: 600,
      textAlign: "center",
      lineHeight: 1.2
    }
  }, m.label));
}
function MetricsCard({
  metrics = [],
  overlap = true,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      zIndex: 3,
      margin: overlap ? "-30px 16px 0" : "0 16px",
      background: "#fff",
      borderRadius: 22,
      boxShadow: "var(--shadow-metrics)",
      display: "flex",
      padding: "14px 4px",
      fontFamily: "var(--font-body)",
      ...style
    }
  }, metrics.map((m, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      alignSelf: "stretch",
      margin: "6px 0",
      background: "#f1efeb"
    }
  }) : null, /*#__PURE__*/React.createElement(Cell, {
    m: m
  }))));
}
Object.assign(__ds_scope, { MetricsCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/relvo-b/MetricsCard.jsx", error: String((e && e.message) || e) }); }

// components/relvo-b/RecipientComposer.jsx
try { (() => {
// RecipientComposer — the signature Direction-B composer that removes the
// "who am I writing to?" ambiguity. A recipient selector (avatar) sits left;
// the whole bar is BLUE when writing to a human (Moi), VIOLET when talking to
// Relvo. Mic when empty (voice-first), paper-plane once typing. Optional 📎.
//
// recipients: [{ key, name, kind: "human"|"relvo", initials?, sublabel? }]
// When only one recipient is passed, the selector is non-interactive (no menu).

const SPARK = "M11.1 3.2 12.5 8l4.8 1.4c.6.2.6 1 0 1.2L12.5 12l-1.4 4.8c-.2.6-1 .6-1.2 0L8.5 12l-4.8-1.4c-.6-.2-.6-1 0-1.2L8.5 8 9.9 3.2c.2-.6 1-.6 1.2 0Z";
function Avatar({
  r,
  size = 41
}) {
  if (r.kind === "relvo") {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        width: size,
        height: size,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        background: "rgba(255,255,255,.2)"
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: "19",
      height: "19",
      viewBox: "0 0 24 24",
      fill: "#fff"
    }, /*#__PURE__*/React.createElement("path", {
      d: SPARK
    })));
  }
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      borderRadius: "50%",
      display: "grid",
      placeItems: "center",
      background: "var(--amber-600)",
      color: "#fff",
      fontWeight: 800,
      fontSize: 13.5,
      boxShadow: "0 0 0 2px rgba(255,255,255,.35)"
    }
  }, r.initials || r.name.slice(0, 2).toUpperCase());
}
function RecipientComposer({
  recipients = [{
    key: "relvo",
    name: "Relvo",
    kind: "relvo"
  }],
  value,
  defaultValue,
  onChange,
  placeholder,
  attach = true,
  onSend,
  style
}) {
  const [cur, setCur] = React.useState(value || defaultValue || recipients[0].key);
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const active = cur != null ? cur : recipients[0].key;
  const r = recipients.find(x => x.key === active) || recipients[0];
  const human = r.kind === "human";
  const typing = text.trim().length > 0;
  const multi = recipients.length > 1;
  const ph = placeholder || (human ? `Répondre à ${r.name}…` : "Demander à Relvo…");
  const accent = human ? "var(--brand)" : "var(--relvo)";
  const pick = k => {
    setCur(k);
    setOpen(false);
    onChange && onChange(k);
  };
  const send = () => {
    if (!typing) return;
    onSend && onSend(text, active);
    setText("");
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      fontFamily: "var(--font-body)",
      ...style
    }
  }, open && multi ? /*#__PURE__*/React.createElement("div", {
    onClick: () => setOpen(false),
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 8
    }
  }) : null, open && multi ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 76,
      left: 12,
      width: 238,
      background: "#fff",
      borderRadius: 18,
      boxShadow: "0 16px 38px rgba(20,18,40,.26)",
      padding: 7,
      zIndex: 9
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: ".4px",
      textTransform: "uppercase",
      color: "#a8a69d",
      padding: "7px 10px 6px"
    }
  }, "R\xE9pondre \xE0"), recipients.map(x => /*#__PURE__*/React.createElement("div", {
    key: x.key,
    onClick: () => pick(x.key),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 11,
      padding: "9px 10px",
      borderRadius: 12,
      cursor: "pointer",
      background: x.key === active ? "var(--bg-secondary)" : "transparent"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: "0 0 32px"
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    r: x,
    size: 32
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700
    }
  }, x.name), x.sublabel ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "#9a988f"
    }
  }, x.sublabel) : null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--relvo)",
      opacity: x.key === active ? 1 : 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "17",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 6 9 17l-5-5"
  })))))) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9,
      padding: "11px 14px 20px",
      position: "relative",
      background: human ? "linear-gradient(180deg, rgba(53,123,232,.9), rgba(33,99,205,.93))" : "linear-gradient(180deg, var(--glass-relvo-1), var(--glass-relvo-2))",
      backdropFilter: "blur(28px) saturate(170%)",
      WebkitBackdropFilter: "blur(28px) saturate(170%)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,.34)"
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => multi && setOpen(o => !o),
    "aria-label": "Destinataire",
    style: {
      position: "relative",
      width: 44,
      height: 44,
      flex: "0 0 44px",
      borderRadius: "50%",
      border: "none",
      background: "none",
      padding: 0,
      cursor: multi ? "pointer" : "default"
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    r: r
  }), multi ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      right: -1,
      bottom: -1,
      width: 17,
      height: 17,
      borderRadius: "50%",
      background: "#fff",
      display: "grid",
      placeItems: "center",
      boxShadow: "0 1px 3px rgba(0,0,0,.2)"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "10",
    height: "10",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#6b6b6b",
    strokeWidth: "3",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "m6 15 6-6 6 6"
  }))) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      alignItems: "center",
      gap: 7,
      background: "rgba(255,255,255,.18)",
      border: "1px solid rgba(255,255,255,.3)",
      borderRadius: "var(--radius-pill)",
      padding: "5px 8px 5px 13px",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,.18)"
    }
  }, attach ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Joindre un fichier",
    style: {
      border: "none",
      background: "none",
      cursor: "pointer",
      display: "grid",
      placeItems: "center",
      color: "rgba(255,255,255,.85)",
      flex: "0 0 auto",
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "21",
    height: "21",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"
  }))) : null, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: text,
    onChange: e => setText(e.target.value),
    placeholder: ph,
    onKeyDown: e => {
      if (e.key === "Enter") send();
    },
    style: {
      flex: 1,
      minWidth: 0,
      border: "none",
      background: "none",
      outline: "none",
      fontFamily: "inherit",
      fontSize: 14.5,
      color: "#fff",
      padding: "6px 0"
    }
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: send,
    "aria-label": typing ? "Envoyer" : "Dicter",
    style: {
      width: 45,
      height: 45,
      flex: "0 0 45px",
      borderRadius: "50%",
      border: "none",
      cursor: "pointer",
      background: "#fff",
      color: accent,
      display: "grid",
      placeItems: "center",
      boxShadow: "0 5px 16px rgba(0,0,0,.22)"
    }
  }, typing ? /*#__PURE__*/React.createElement("svg", {
    width: "19",
    height: "19",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: accent,
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M22 2 11 13M22 2 15 22l-4-9-9-4Z"
  })) : /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: accent,
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "9",
    y: "3",
    width: "6",
    height: "11",
    rx: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 11a7 7 0 0 0 14 0M12 18v3"
  })))));
}
Object.assign(__ds_scope, { RecipientComposer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/relvo-b/RecipientComposer.jsx", error: String((e && e.message) || e) }); }

// components/relvo-b/RelvoHeader.jsx
try { (() => {
// RelvoHeader — la « zone agent » violette en tête de chaque écran (Direction B).
// Deux modes : page principale (grand titre + bouton logo) ou écran poussé
// (flèche retour + titre + bouton logo). Le bouton logo ouvre les conversations.
// `children` permet d'y loger le brief, la carte métriques, un segmented, etc.

const SB = /*#__PURE__*/React.createElement("div", {
  style: {
    height: 54,
    flex: "0 0 54px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 30px 0 36px",
    fontSize: 15,
    fontWeight: 650,
    color: "#fff"
  }
}, /*#__PURE__*/React.createElement("span", null, "9:41"), /*#__PURE__*/React.createElement("span", {
  style: {
    display: "inline-flex",
    gap: 7,
    alignItems: "center"
  }
}, /*#__PURE__*/React.createElement("svg", {
  width: "18",
  height: "12",
  viewBox: "0 0 18 12",
  fill: "currentColor"
}, /*#__PURE__*/React.createElement("rect", {
  x: "0",
  y: "7",
  width: "3",
  height: "5",
  rx: "1"
}), /*#__PURE__*/React.createElement("rect", {
  x: "5",
  y: "4",
  width: "3",
  height: "8",
  rx: "1"
}), /*#__PURE__*/React.createElement("rect", {
  x: "10",
  y: "1.5",
  width: "3",
  height: "10.5",
  rx: "1"
}), /*#__PURE__*/React.createElement("rect", {
  x: "15",
  y: "0",
  width: "3",
  height: "12",
  rx: "1",
  opacity: ".4"
})), /*#__PURE__*/React.createElement("svg", {
  width: "22",
  height: "12",
  viewBox: "0 0 24 12",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.4"
}, /*#__PURE__*/React.createElement("rect", {
  x: "1",
  y: "1",
  width: "19",
  height: "10",
  rx: "2.6"
}), /*#__PURE__*/React.createElement("rect", {
  x: "2.6",
  y: "2.6",
  width: "13",
  height: "6.8",
  rx: "1.4",
  fill: "currentColor",
  stroke: "none"
}), /*#__PURE__*/React.createElement("rect", {
  x: "21",
  y: "4",
  width: "2",
  height: "4",
  rx: "1",
  fill: "currentColor",
  stroke: "none"
}))));
function LogoBtn({
  logoSrc,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    "aria-label": "Mes conversations Relvo",
    style: {
      width: 42,
      height: 42,
      flex: "0 0 42px",
      borderRadius: "50%",
      display: "grid",
      placeItems: "center",
      cursor: "pointer",
      border: "none",
      padding: 0,
      background: "rgba(255,255,255,.15)",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,.3)"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: logoSrc,
    alt: "Relvo",
    style: {
      width: 33,
      height: 33,
      filter: "drop-shadow(0 2px 6px rgba(0,0,0,.28))"
    }
  }));
}
function RelvoHeader({
  title,
  subtitle,
  logoSrc = "../../assets/relvo-icon-256.png",
  onLogoClick,
  onBack,
  rounded = true,
  statusBar = true,
  paddingBottom = 24,
  children,
  style
}) {
  const detail = typeof onBack === "function";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      background: "var(--relvo)",
      color: "#fff",
      overflow: "hidden",
      borderRadius: rounded ? `0 0 var(--hero-round) var(--hero-round)` : 0,
      paddingBottom,
      fontFamily: "var(--font-body)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    "aria-hidden": true,
    style: {
      position: "absolute",
      top: -70,
      right: -50,
      width: 240,
      height: 240,
      background: "radial-gradient(circle, rgba(255,255,255,.18), transparent 70%)",
      pointerEvents: "none"
    }
  }), statusBar ? SB : null, detail ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "2px 14px 4px",
      position: "relative",
      zIndex: 1
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onBack,
    "aria-label": "Retour",
    style: {
      width: 38,
      height: 38,
      flex: "0 0 38px",
      borderRadius: "50%",
      display: "grid",
      placeItems: "center",
      background: "rgba(255,255,255,.16)",
      color: "#fff",
      border: "none",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "m15 18-6-6 6-6"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-heading)",
      fontSize: 18,
      fontWeight: 800,
      letterSpacing: "-.3px",
      margin: 0,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, title), subtitle ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--on-violet)",
      marginTop: 1,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, subtitle) : null), /*#__PURE__*/React.createElement(LogoBtn, {
    logoSrc: logoSrc,
    onClick: onLogoClick
  })) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 13,
      padding: "0 22px",
      justifyContent: "space-between",
      position: "relative",
      zIndex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--font-heading)",
      fontSize: 25,
      fontWeight: 800,
      letterSpacing: "-.6px",
      margin: 0
    }
  }, title), subtitle ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--on-violet)",
      marginTop: 2
    }
  }, subtitle) : null), /*#__PURE__*/React.createElement(LogoBtn, {
    logoSrc: logoSrc,
    onClick: onLogoClick
  })), children ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      zIndex: 1
    }
  }, children) : null);
}
Object.assign(__ds_scope, { RelvoHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/relvo-b/RelvoHeader.jsx", error: String((e && e.message) || e) }); }

// components/relvo-b/SegTabs.jsx
try { (() => {
// SegTabs — segmented control (Direction B). Used overlapping the violet header
// (Mon fil filters, Sujet tabs, Réglages tabs). Each tab may carry a small round
// count badge. Controlled via `value` + `onChange`.
//   tabs: [{ key, label, count? }]

function SegTabs({
  tabs = [],
  value,
  onChange,
  overlap = false,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 5,
      background: "#fff",
      borderRadius: "var(--radius-pill)",
      padding: 5,
      boxShadow: "0 8px 24px rgb(28 22 60 / 0.14)",
      ...(overlap ? {
        position: "relative",
        zIndex: 3,
        margin: "-25px 16px 0"
      } : null),
      fontFamily: "var(--font-body)",
      ...style
    }
  }, tabs.map(t => {
    const on = t.key === value;
    return /*#__PURE__*/React.createElement("button", {
      key: t.key,
      type: "button",
      onClick: () => onChange && onChange(t.key),
      style: {
        flex: 1,
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        whiteSpace: "nowrap",
        fontFamily: "inherit",
        fontSize: 13,
        fontWeight: 700,
        padding: "9px 8px",
        borderRadius: "var(--radius-pill)",
        background: on ? "var(--relvo)" : "transparent",
        color: on ? "#fff" : "#8a8980"
      }
    }, t.label, typeof t.count === "number" ? /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        borderRadius: "var(--radius-pill)",
        fontSize: 10.5,
        fontWeight: 800,
        background: on ? "rgba(255,255,255,.28)" : "#eceae6",
        color: on ? "#fff" : "#8a8980"
      }
    }, t.count) : null);
  }));
}
Object.assign(__ds_scope, { SegTabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/relvo-b/SegTabs.jsx", error: String((e && e.message) || e) }); }

// components/relvo-b/SubjectRow.jsx
try { (() => {
// SubjectRow — a Subject rendered as a LINE (Direction B), not a floating card.
// Domain colour rail + tinted icon, reference, optional urgent flag, title,
// summary, marker tags, and a blue unread pip top-right. The `urgent` variant
// washes the whole row red (rare = signal).

const TONES = {
  amber: {
    background: "var(--amber-50)",
    color: "var(--amber-800)"
  },
  relvo: {
    background: "var(--relvo-bg)",
    color: "var(--relvo)"
  },
  blue: {
    background: "var(--brand)",
    color: "#fff"
  },
  red: {
    background: "var(--red-600)",
    color: "#fff"
  },
  green: {
    background: "var(--green-50)",
    color: "var(--green-600)"
  },
  grey: {
    background: "#f0eeea",
    color: "#86857d"
  }
};
function Tag({
  tone = "grey",
  children
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      fontSize: 10.5,
      fontWeight: 700,
      padding: "3px 9px",
      borderRadius: "var(--radius-pill)",
      whiteSpace: "nowrap",
      ...TONES[tone]
    }
  }, children);
}
function SubjectRow({
  reference,
  title,
  summary,
  icon,
  railColor = "var(--blue-600)",
  iconBg,
  urgent = false,
  done = false,
  tags = [],
  unread = 0,
  onClick,
  style
}) {
  return /*#__PURE__*/React.createElement("article", {
    onClick: onClick,
    style: {
      position: "relative",
      display: "flex",
      gap: 13,
      padding: 14,
      margin: urgent ? "0 12px" : "0 14px",
      borderBottom: urgent ? "none" : "1px solid #f1efeb",
      borderRadius: urgent ? 16 : 0,
      background: urgent ? "#fdf1f1" : "transparent",
      opacity: done ? 0.62 : 1,
      cursor: onClick ? "pointer" : "default",
      fontFamily: "var(--font-body)",
      ...style
    }
  }, unread > 0 ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 13,
      right: 15,
      minWidth: 20,
      height: 20,
      padding: "0 6px",
      borderRadius: "var(--radius-pill)",
      background: "var(--brand)",
      color: "#fff",
      fontSize: 11,
      fontWeight: 700,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, unread) : null, !urgent && railColor ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 4,
      borderRadius: "var(--radius-pill)",
      flex: "0 0 4px",
      alignSelf: "stretch",
      background: railColor
    }
  }) : null, icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 12,
      display: "grid",
      placeItems: "center",
      flex: "0 0 40px",
      color: "#fff",
      alignSelf: "flex-start",
      background: iconBg || railColor
    }
  }, icon) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, reference ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-numeric)",
      fontSize: 10.5,
      fontWeight: 600,
      letterSpacing: ".3px",
      color: "#b3b1ab"
    }
  }, reference) : null, urgent ? /*#__PURE__*/React.createElement(Tag, {
    tone: "red"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "10",
    height: "10",
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 2a1 1 0 0 1 1 1v18a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 3.5h11.5a1 1 0 0 1 .8 1.6L17 8l2.3 2.9a1 1 0 0 1-.8 1.6H7z"
  })), "Urgent") : null), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15.5,
      fontWeight: 700,
      letterSpacing: "-.2px",
      margin: "4px 0 0",
      textDecoration: done ? "line-through" : "none"
    }
  }, title), summary ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "#86857d",
      marginTop: 4,
      lineHeight: 1.4
    }
  }, summary) : null, tags.length ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 7,
      alignItems: "center",
      marginTop: 9,
      flexWrap: "wrap"
    }
  }, tags.map((t, i) => /*#__PURE__*/React.createElement(Tag, {
    key: i,
    tone: t.tone
  }, t.label))) : null));
}
Object.assign(__ds_scope, { SubjectRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/relvo-b/SubjectRow.jsx", error: String((e && e.message) || e) }); }

// components/relvo-b/SwipeRow.jsx
try { (() => {
// SwipeRow — swipe a Subject row to act (Direction B, lifted from the product):
// swipe RIGHT → Terminer (green), swipe LEFT → Ignorer (red). Low-priority rows
// (allowIgnore=false) only allow the right swipe. Commits past an 80px threshold,
// else snaps back. Wrap any row (e.g. <SubjectRow/>) as the child.

const CHECK = /*#__PURE__*/React.createElement("svg", {
  width: "22",
  height: "22",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.4",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M20 6 9 17l-5-5"
}));
const EYE = /*#__PURE__*/React.createElement("svg", {
  width: "22",
  height: "22",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M2 10c3.5 4.5 16.5 4.5 20 0"
}), /*#__PURE__*/React.createElement("path", {
  d: "M5 13l-1.2 2M9 14.3l-.6 2.1M12 14.6v2.2M15 14.3l.6 2.1M19 13l1.2 2"
}));
function SwipeRow({
  children,
  allowIgnore = true,
  onComplete,
  onIgnore,
  threshold = 80,
  style
}) {
  const [dx, setDx] = React.useState(0);
  const [anim, setAnim] = React.useState(false);
  const st = React.useRef({
    sx: 0,
    sy: 0,
    active: false,
    decided: false,
    horiz: false
  });
  const down = e => {
    st.current = {
      sx: e.clientX,
      sy: e.clientY,
      active: true,
      decided: false,
      horiz: false
    };
    setAnim(false);
  };
  const move = e => {
    const s = st.current;
    if (!s.active) return;
    const mx = e.clientX - s.sx,
      my = e.clientY - s.sy;
    if (!s.decided && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      s.decided = true;
      s.horiz = Math.abs(mx) > Math.abs(my);
    }
    if (s.decided && s.horiz) {
      let d = mx;
      if (!allowIgnore && d < 0) d = 0;
      setDx(d);
    }
  };
  const up = () => {
    const s = st.current;
    if (!s.active) return;
    s.active = false;
    setAnim(true);
    if (s.horiz && dx > threshold) {
      setDx(700);
      setTimeout(() => onComplete && onComplete(), 200);
    } else if (allowIgnore && s.horiz && dx < -threshold) {
      setDx(-700);
      setTimeout(() => onIgnore && onIgnore(), 200);
    } else setDx(0);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      overflow: "hidden",
      touchAction: "pan-y",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      color: "#fff",
      fontFamily: "var(--font-body)",
      fontWeight: 700,
      fontSize: 13,
      background: "linear-gradient(90deg, var(--green-600) 50%, var(--brand-accent) 50%)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "0 20px"
    }
  }, CHECK, "Terminer"), allowIgnore ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "0 20px"
    }
  }, "Ignorer", EYE) : null), /*#__PURE__*/React.createElement("div", {
    onPointerDown: down,
    onPointerMove: move,
    onPointerUp: up,
    onPointerCancel: up,
    style: {
      position: "relative",
      background: "#fff",
      transform: `translateX(${dx}px)`,
      transition: anim ? "transform .2s ease" : "none"
    }
  }, children));
}
Object.assign(__ds_scope, { SwipeRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/relvo-b/SwipeRow.jsx", error: String((e && e.message) || e) }); }

// components/relvo-b/TaskRow.jsx
try { (() => {
// TaskRow — checkable task (Direction B). Source pill (✦ Relvo / Moi), optional
// due date. Controlled via `done` + `onToggle`.

function ActorPill({
  source
}) {
  const relvo = source === "relvo";
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      fontSize: 11,
      fontWeight: 650,
      padding: "2px 8px",
      borderRadius: "var(--radius-pill)",
      background: relvo ? "var(--relvo-bg)" : "var(--blue-50)",
      color: relvo ? "var(--relvo)" : "var(--blue-800)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 14,
      borderRadius: "50%",
      display: "grid",
      placeItems: "center",
      fontSize: 8,
      fontWeight: 800,
      color: "#fff",
      background: relvo ? "var(--relvo)" : "var(--brand)"
    }
  }, relvo ? "R" : "M"), relvo ? "Relvo" : "Moi");
}
function TaskRow({
  title,
  done = false,
  source = "me",
  due,
  onToggle,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      alignItems: "flex-start",
      padding: "13px 18px",
      margin: "0 14px",
      borderBottom: "1px solid #f1efeb",
      fontFamily: "var(--font-body)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onToggle,
    "aria-pressed": done,
    style: {
      width: 22,
      height: 22,
      flex: "0 0 22px",
      marginTop: 1,
      borderRadius: "var(--radius-sm)",
      border: `2px solid ${done ? "var(--green-600)" : "var(--border)"}`,
      background: done ? "var(--green-600)" : "transparent",
      color: done ? "#fff" : "transparent",
      display: "grid",
      placeItems: "center",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "3",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 6 9 17l-5-5"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      fontWeight: 600,
      color: done ? "#a8a69d" : "#1c1a22",
      textDecoration: done ? "line-through" : "none"
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      marginTop: 6,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(ActorPill, {
    source: source
  }), due ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: "#a8a69d"
    }
  }, due) : null)));
}
Object.assign(__ds_scope, { TaskRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/relvo-b/TaskRow.jsx", error: String((e && e.message) || e) }); }

// ui_kits/relvo-app/app.jsx
try { (() => {
// Relvo app (Direction B) — clickable React kit composing the relvo-b components.
const NS = window.RelvoDesignSystem_ad3a3c;
const {
  RelvoHeader,
  MetricsCard,
  SegTabs,
  SubjectRow,
  RecipientComposer,
  GlassTabBar,
  ChatBubble,
  ConvListItem,
  JournalTimeline,
  TaskRow,
  SwipeRow
} = NS;
const D = window.RELVO_B;
const LOGO = "../../assets/relvo-icon-256.png";

// ---- domain glyphs ----
function gl(k) {
  const p = {
    box: /*#__PURE__*/React.createElement("path", {
      d: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Zm-9 14V12m-9-4 9 5 9-5"
    }),
    snow: /*#__PURE__*/React.createElement("path", {
      d: "M2 12h20M12 2v20m7-15-14 10M5 7l14 10"
    }),
    users: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
      d: "M16 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "9",
      cy: "7",
      r: "4"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M22 19v-2a4 4 0 0 0-3-3.9"
    })),
    doc: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
      d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M14 2v6h6M9 13h6M9 17h4"
    })),
    bag: /*#__PURE__*/React.createElement("path", {
      d: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"
    }),
    flame: /*#__PURE__*/React.createElement("path", {
      d: "M12 2C8 6 6 9 6 13a6 6 0 0 0 12 0c0-2.5-1-4.5-3-6.5.4 2.2-1 3.5-2 3.5 0-2.2-.5-4.5-1-8Z"
    }),
    check: /*#__PURE__*/React.createElement("path", {
      d: "M20 6 9 17l-5-5"
    })
  }[k] || null;
  return /*#__PURE__*/React.createElement("svg", {
    width: "19",
    height: "19",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "1.9",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p);
}
const SPARK = /*#__PURE__*/React.createElement("svg", {
  width: "16",
  height: "16",
  viewBox: "0 0 24 24",
  fill: "currentColor"
}, /*#__PURE__*/React.createElement("path", {
  d: "M11.1 3.2 12.5 8l4.8 1.4c.6.2.6 1 0 1.2L12.5 12l-1.4 4.8c-.2.6-1 .6-1.2 0L8.5 12l-4.8-1.4c-.6-.2-.6-1 0-1.2L8.5 8 9.9 3.2c.2-.6 1-.6 1.2 0Z"
}));
function useScrollHide() {
  const ref = React.useRef(null);
  const [hidden, setHidden] = React.useState(false);
  const last = React.useRef(0);
  const onScroll = e => {
    const y = e.target.scrollTop;
    if (y > last.current && y > 50) setHidden(true);else if (y < last.current) setHidden(false);
    last.current = y;
  };
  return {
    onScroll,
    hidden
  };
}

// ---- HOME ----
function Home({
  go,
  openSubject,
  openConvos
}) {
  const [bi, setBi] = React.useState(0);
  const [gone, setGone] = React.useState(() => new Set());
  const mark = id => setGone(g => {
    const n = new Set(g);
    n.add(id);
    return n;
  });
  const {
    onScroll,
    hidden
  } = useScrollHide();
  React.useEffect(() => {
    const t = setInterval(() => setBi(i => (i + 1) % D.brief.length), 4200);
    return () => clearInterval(t);
  }, []);
  const b = D.brief[bi];
  return /*#__PURE__*/React.createElement("div", {
    className: "screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scroll",
    onScroll: onScroll,
    style: {
      paddingBottom: 188
    }
  }, /*#__PURE__*/React.createElement(RelvoHeader, {
    title: "Bonjour " + D.user.name,
    subtitle: D.user.date + " · " + D.user.org,
    logoSrc: LOGO,
    onLogoClick: openConvos,
    paddingBottom: 42
  }, /*#__PURE__*/React.createElement("div", {
    className: "brief-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, SPARK, " ", b.lbl), /*#__PURE__*/React.createElement("p", null, b.text)), /*#__PURE__*/React.createElement("div", {
    className: "dots"
  }, D.brief.map((_, i) => /*#__PURE__*/React.createElement("i", {
    key: i,
    className: i === bi ? "on" : ""
  })))), /*#__PURE__*/React.createElement(MetricsCard, {
    metrics: D.metrics
  }), /*#__PURE__*/React.createElement("div", {
    className: "sect"
  }, /*#__PURE__*/React.createElement("span", {
    className: "h"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ph",
    style: {
      background: "var(--brand)"
    }
  }), "Sujets prioritaires"), /*#__PURE__*/React.createElement("span", {
    className: "a",
    onClick: () => go("fil")
  }, "Tout voir")), D.subjects.slice(0, 3).filter(s => !gone.has(s.id)).map(s => /*#__PURE__*/React.createElement(SwipeRow, {
    key: s.id,
    allowIgnore: !s.done,
    onComplete: () => mark(s.id),
    onIgnore: () => mark(s.id)
  }, /*#__PURE__*/React.createElement(SubjectRow, {
    reference: s.id,
    urgent: s.urgent,
    unread: s.unread,
    icon: gl(s.icon),
    railColor: s.rail,
    title: s.title,
    summary: s.summary,
    tags: s.tags,
    onClick: () => openSubject(s.id)
  })))), /*#__PURE__*/React.createElement("div", {
    className: "dock"
  }, /*#__PURE__*/React.createElement(GlassTabBar, {
    value: "accueil",
    onChange: go,
    hidden: hidden
  }), /*#__PURE__*/React.createElement(RecipientComposer, {
    recipients: [{
      key: "relvo",
      name: "Relvo",
      kind: "relvo"
    }]
  })));
}

// ---- FEED (Mon fil) ----
function Feed({
  go,
  openSubject,
  openConvos
}) {
  const [tab, setTab] = React.useState("priorite");
  const [gone, setGone] = React.useState(() => new Set());
  const mark = id => setGone(g => {
    const n = new Set(g);
    n.add(id);
    return n;
  });
  const {
    onScroll,
    hidden
  } = useScrollHide();
  let list = D.subjects;
  if (tab === "ouverts") list = D.subjects.filter(s => !s.done);
  if (tab === "termines") list = D.subjects.filter(s => s.done);
  return /*#__PURE__*/React.createElement("div", {
    className: "screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scroll",
    onScroll: onScroll,
    style: {
      paddingBottom: 188
    }
  }, /*#__PURE__*/React.createElement(RelvoHeader, {
    title: "Mon fil",
    subtitle: "18 sujets \xB7 tri\xE9s par Relvo",
    logoSrc: LOGO,
    onLogoClick: openConvos,
    paddingBottom: 42
  }, /*#__PURE__*/React.createElement("div", {
    className: "glass-field"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "17",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "rgba(255,255,255,.85)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m21 21-4.3-4.3"
  })), "Rechercher un sujet, un contact\u2026")), /*#__PURE__*/React.createElement(SegTabs, {
    overlap: true,
    value: tab,
    onChange: setTab,
    tabs: [{
      key: "priorite",
      label: "Priorité",
      count: 3
    }, {
      key: "ouverts",
      label: "Ouverts",
      count: 13
    }, {
      key: "termines",
      label: "Terminés",
      count: 5
    }]
  }), /*#__PURE__*/React.createElement("div", {
    className: "agent-note"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sp"
  }, SPARK), /*#__PURE__*/React.createElement("p", null, "J'ai tri\xE9 ", /*#__PURE__*/React.createElement("b", null, "12 nouveaux messages"), " en 5 sujets ce matin.")), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 2
    }
  }, list.filter(s => !gone.has(s.id)).map(s => /*#__PURE__*/React.createElement(SwipeRow, {
    key: s.id,
    allowIgnore: !s.done,
    onComplete: () => mark(s.id),
    onIgnore: () => mark(s.id)
  }, /*#__PURE__*/React.createElement(SubjectRow, {
    reference: s.id,
    urgent: s.urgent,
    unread: s.unread,
    done: s.done,
    icon: gl(s.icon),
    railColor: s.rail,
    title: s.title,
    summary: s.summary,
    tags: s.tags,
    onClick: () => openSubject(s.id)
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "dock"
  }, /*#__PURE__*/React.createElement(GlassTabBar, {
    value: "fil",
    onChange: go,
    hidden: hidden
  }), /*#__PURE__*/React.createElement(RecipientComposer, {
    recipients: [{
      key: "relvo",
      name: "Relvo",
      kind: "relvo"
    }]
  })));
}

// ---- MEMOIRE ----
function Memoire({
  go,
  openConvos
}) {
  const {
    onScroll,
    hidden
  } = useScrollHide();
  return /*#__PURE__*/React.createElement("div", {
    className: "screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scroll",
    onScroll: onScroll,
    style: {
      paddingBottom: 188
    }
  }, /*#__PURE__*/React.createElement(RelvoHeader, {
    title: "M\xE9moire",
    subtitle: "Ce que Relvo sait de votre activit\xE9",
    logoSrc: LOGO,
    onLogoClick: openConvos,
    paddingBottom: 42
  }), /*#__PURE__*/React.createElement(MetricsCard, {
    metrics: [{
      value: 18,
      label: "Sujets suivis"
    }, {
      value: 7,
      label: "Instructions"
    }, {
      value: 29,
      label: "Documents"
    }, {
      type: "gauge",
      percent: 64,
      label: "Saturation"
    }]
  }), /*#__PURE__*/React.createElement("div", {
    className: "agent-note"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sp"
  }, SPARK), /*#__PURE__*/React.createElement("p", null, "C'est ici que vous enrichissez la m\xE9moire de Relvo et affinez son comportement.")), /*#__PURE__*/React.createElement("div", {
    className: "sect"
  }, /*#__PURE__*/React.createElement("span", {
    className: "h"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ph",
    style: {
      background: "var(--brand)"
    }
  }), "Dossiers"), /*#__PURE__*/React.createElement("span", {
    className: "a"
  }, "Tout voir")), D.folders.map((f, i) => /*#__PURE__*/React.createElement(NS.FolderRow, {
    key: i,
    name: f.name,
    sub: f.sub,
    color: f.color,
    icon: gl(f.icon)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "dock"
  }, /*#__PURE__*/React.createElement(GlassTabBar, {
    value: "memoire",
    onChange: go,
    hidden: hidden
  }), /*#__PURE__*/React.createElement(RecipientComposer, {
    recipients: [{
      key: "relvo",
      name: "Relvo",
      kind: "relvo"
    }]
  })));
}

// ---- REGLAGES ----
function Reglages({
  go,
  openConvos
}) {
  const [tab, setTab] = React.useState("profil");
  const [prefs, setPrefs] = React.useState([true, true, true, false]);
  const tg = i => setPrefs(p => p.map((v, j) => j === i ? !v : v));
  return /*#__PURE__*/React.createElement("div", {
    className: "screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scroll",
    style: {
      paddingBottom: 188
    }
  }, /*#__PURE__*/React.createElement(RelvoHeader, {
    title: "R\xE9glages",
    subtitle: "Tasty Crousty \xB7 Vincent",
    logoSrc: LOGO,
    onLogoClick: openConvos,
    paddingBottom: 42
  }), /*#__PURE__*/React.createElement(SegTabs, {
    overlap: true,
    value: tab,
    onChange: setTab,
    tabs: [{
      key: "profil",
      label: "Profil"
    }, {
      key: "canaux",
      label: "Canaux"
    }, {
      key: "prefs",
      label: "Préférences"
    }]
  }), tab === "profil" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "card-s"
  }, /*#__PURE__*/React.createElement("div", {
    className: "formrow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "Nom"), /*#__PURE__*/React.createElement("span", {
    className: "val"
  }, "Vincent")), /*#__PURE__*/React.createElement("div", {
    className: "formrow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "Email"), /*#__PURE__*/React.createElement("span", {
    className: "val"
  }, "vincent@vccimpact.fr")), /*#__PURE__*/React.createElement("div", {
    className: "formrow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "Entreprise"), /*#__PURE__*/React.createElement("span", {
    className: "val"
  }, "Tasty Crousty")), /*#__PURE__*/React.createElement("div", {
    className: "formrow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "Mot de passe"), /*#__PURE__*/React.createElement("span", {
    className: "val"
  }, "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"))), /*#__PURE__*/React.createElement("div", {
    className: "card-s"
  }, /*#__PURE__*/React.createElement("div", {
    className: "logout"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m16 17 5-5-5-5M21 12H9"
  })), " Se d\xE9connecter"))) : tab === "canaux" ? /*#__PURE__*/React.createElement("div", {
    className: "card-s"
  }, /*#__PURE__*/React.createElement("div", {
    className: "srow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic",
    style: {
      background: "var(--green-50)",
      color: "var(--green-600)"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 20.5l1.7-5.6A8.4 8.4 0 1 1 21 11.5Z"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "bd"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nm"
  }, "WhatsApp Business"), /*#__PURE__*/React.createElement("div", {
    className: "ds"
  }, "+33 6 12 34 56 78")), /*#__PURE__*/React.createElement("span", {
    className: "status-dot"
  }, "Connect\xE9")), /*#__PURE__*/React.createElement("div", {
    className: "srow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic",
    style: {
      background: "var(--blue-50)",
      color: "var(--blue-800)"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "5",
    width: "18",
    height: "14",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m3 7 9 6 9-6"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "bd"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nm"
  }, "Email professionnel"), /*#__PURE__*/React.createElement("div", {
    className: "ds"
  }, "tasty-crousty-a1b2@inbound.relvo.io")), /*#__PURE__*/React.createElement("span", {
    className: "status-dot"
  }, "Connect\xE9"))) : /*#__PURE__*/React.createElement("div", {
    className: "card-s"
  }, ["Brief quotidien", "Suggestions automatiques", "Notifications push", "Lecture vocale des réponses"].map((t, i) => /*#__PURE__*/React.createElement("div", {
    className: "srow",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "bd"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nm"
  }, t)), /*#__PURE__*/React.createElement("div", {
    className: "toggle" + (prefs[i] ? " on" : ""),
    onClick: () => tg(i)
  }, /*#__PURE__*/React.createElement("i", null)))))), /*#__PURE__*/React.createElement("div", {
    className: "dock"
  }, /*#__PURE__*/React.createElement(GlassTabBar, {
    value: "reglages",
    onChange: go
  }), /*#__PURE__*/React.createElement(RecipientComposer, {
    recipients: [{
      key: "relvo",
      name: "Relvo",
      kind: "relvo"
    }]
  })));
}

// ---- SUBJECT detail ----
function Subject({
  id,
  back,
  openConvos
}) {
  const s = D.subjects.find(x => x.id === id) || D.subjects[0];
  const [tab, setTab] = React.useState("messages");
  const [tasks, setTasks] = React.useState(D.tasks);
  const [adding, setAdding] = React.useState(false);
  const [nt, setNt] = React.useState("");
  const toggle = i => setTasks(ts => ts.map((t, j) => j === i ? {
    ...t,
    done: !t.done
  } : t));
  const add = () => {
    if (!nt.trim()) return;
    setTasks(ts => [...ts, {
      title: nt,
      source: "me",
      done: false
    }]);
    setNt("");
    setAdding(false);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scroll",
    style: {
      paddingBottom: 110
    }
  }, /*#__PURE__*/React.createElement(RelvoHeader, {
    title: s.title,
    subtitle: s.id + " · " + s.contact,
    logoSrc: LOGO,
    onBack: back,
    onLogoClick: openConvos,
    paddingBottom: 40
  }, /*#__PURE__*/React.createElement("div", {
    className: "strip"
  }, s.urgent ? /*#__PURE__*/React.createElement("span", {
    className: "tag",
    style: {
      background: "var(--red-600)",
      color: "#fff"
    }
  }, "\u2691 Urgent") : null, /*#__PURE__*/React.createElement("span", {
    className: "tag",
    style: {
      background: "rgba(255,255,255,.18)",
      color: "#fff"
    }
  }, "Nouveau"), /*#__PURE__*/React.createElement("span", {
    className: "tag",
    style: {
      background: "rgba(255,255,255,.18)",
      color: "#fff"
    }
  }, "\xC0 faire \xB7 2")), /*#__PURE__*/React.createElement("div", {
    className: "summary-v"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rh"
  }, SPARK, " R\xE9sum\xE9 de Relvo"), /*#__PURE__*/React.createElement("p", null, s.summary, " J'attends votre validation avant de r\xE9pondre."))), /*#__PURE__*/React.createElement(SegTabs, {
    overlap: true,
    value: tab,
    onChange: setTab,
    tabs: [{
      key: "messages",
      label: "Messages"
    }, {
      key: "taches",
      label: "Tâches",
      count: tasks.length
    }, {
      key: "journal",
      label: "Journal"
    }]
  }), tab === "messages" ? /*#__PURE__*/React.createElement("div", {
    className: "chat"
  }, /*#__PURE__*/React.createElement(ChatBubble, {
    actor: "ext",
    name: "Karim Benali",
    channel: "WhatsApp \xB7 35 min",
    logoSrc: LOGO
  }, "Rupture sur la sauce blanche. Je peux vous proposer une substitution \xE9quivalente."), /*#__PURE__*/React.createElement(ChatBubble, {
    actor: "ext",
    name: "Karim Benali",
    channel: "WhatsApp",
    logoSrc: LOGO,
    attachment: {
      name: "Sauce-Subst-2291.pdf",
      label: "Fiche produit"
    }
  }, "Voici la fiche produit."), /*#__PURE__*/React.createElement(ChatBubble, {
    direction: "out"
  }, "Merci Karim, je regarde \xE7a aujourd'hui."), /*#__PURE__*/React.createElement("div", {
    className: "action-block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ah"
  }, SPARK, " Brouillon pr\xE9par\xE9 par Relvo"), /*#__PURE__*/React.createElement("div", {
    className: "ab"
  }, "\xAB Merci Karim. La substitution nous convient, envoyez-nous la fiche allerg\xE8nes \xE0 jour et nous validons la commande. \xBB"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn primary"
  }, "Envoyer"), /*#__PURE__*/React.createElement("button", {
    className: "btn ghost"
  }, "Modifier")))) : tab === "taches" ? /*#__PURE__*/React.createElement("div", null, tasks.map((t, i) => /*#__PURE__*/React.createElement(TaskRow, {
    key: i,
    title: t.title,
    source: t.source,
    due: t.due,
    done: t.done,
    onToggle: () => toggle(i)
  })), adding ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      padding: "8px 18px",
      margin: "0 14px"
    }
  }, /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    value: nt,
    onChange: e => setNt(e.target.value),
    onKeyDown: e => e.key === "Enter" && add(),
    placeholder: "Nouvelle t\xE2che\u2026",
    style: {
      flex: 1,
      border: "1px solid var(--border)",
      borderRadius: 11,
      padding: "11px 13px",
      font: "inherit",
      fontSize: 14,
      outline: "none"
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    onClick: add
  }, "Ajouter")) : /*#__PURE__*/React.createElement("div", {
    className: "addtask",
    onClick: () => setAdding(true)
  }, /*#__PURE__*/React.createElement("span", {
    className: "plus"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--relvo)",
    strokeWidth: "2.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 5v14M5 12h14"
  }))), " Ajouter une t\xE2che")) : /*#__PURE__*/React.createElement(JournalTimeline, {
    items: D.journal
  })), /*#__PURE__*/React.createElement("div", {
    className: "dock"
  }, /*#__PURE__*/React.createElement(RecipientComposer, {
    recipients: [{
      key: "karim",
      name: "Karim",
      kind: "human",
      initials: "KB",
      sublabel: s.org + " · WhatsApp"
    }, {
      key: "relvo",
      name: "Relvo",
      kind: "relvo",
      sublabel: "Votre assistant"
    }],
    defaultValue: "karim"
  })));
}

// ---- CONVERSATION ----
function Conversation({
  back,
  openConvos
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scroll",
    style: {
      paddingBottom: 110,
      background: "var(--bg-secondary)"
    }
  }, /*#__PURE__*/React.createElement(RelvoHeader, {
    title: "Relvo",
    subtitle: "Votre assistant \u2014 toujours l\xE0",
    logoSrc: LOGO,
    onBack: back,
    onLogoClick: openConvos,
    rounded: false,
    paddingBottom: 14
  }), /*#__PURE__*/React.createElement("div", {
    className: "chat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "daysep"
  }, "Aujourd'hui"), /*#__PURE__*/React.createElement(ChatBubble, {
    direction: "out"
  }, "O\xF9 en est le remplacement de la sauce blanche ?"), /*#__PURE__*/React.createElement(ChatBubble, {
    actor: "relvo",
    name: "Relvo",
    channel: "\xE0 l'instant",
    logoSrc: LOGO
  }, "Karim propose une substitution. J'ai pr\xE9par\xE9 une r\xE9ponse et 2 t\xE2ches sur ", /*#__PURE__*/React.createElement("b", null, "SUB-0142"), ". J'attends votre validation pour r\xE9pondre."), /*#__PURE__*/React.createElement(ChatBubble, {
    direction: "out"
  }, "Parfait, envoie la r\xE9ponse."), /*#__PURE__*/React.createElement(ChatBubble, {
    actor: "relvo",
    name: "Relvo",
    channel: "\xE0 l'instant",
    logoSrc: LOGO
  }, "C'est envoy\xE9 \u2726. Je vous pr\xE9viens d\xE8s que Karim confirme."))), /*#__PURE__*/React.createElement("div", {
    className: "dock"
  }, /*#__PURE__*/React.createElement(RecipientComposer, {
    recipients: [{
      key: "relvo",
      name: "Relvo",
      kind: "relvo"
    }]
  })));
}

// ---- CONVERSATIONS list ----
function Conversations({
  back,
  openConversation
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scroll",
    style: {
      background: "var(--bg-secondary)",
      paddingBottom: 30
    }
  }, /*#__PURE__*/React.createElement(RelvoHeader, {
    title: "Mes conversations",
    subtitle: "avec Relvo",
    logoSrc: LOGO,
    onBack: back,
    rounded: false,
    paddingBottom: 14
  }), /*#__PURE__*/React.createElement("div", {
    className: "conv-new",
    onClick: openConversation
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 5v14M5 12h14"
  }))), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "t"
  }, "Nouvelle conversation"), /*#__PURE__*/React.createElement("span", {
    className: "s"
  }, "Discussion g\xE9n\xE9rale, sans contexte de page"))), /*#__PURE__*/React.createElement("div", {
    className: "csec"
  }, "R\xE9centes"), D.conversations.map((c, i) => /*#__PURE__*/React.createElement(ConvListItem, {
    key: i,
    title: c.title,
    preview: c.preview,
    when: c.when,
    context: c.context,
    onClick: openConversation
  }))));
}

// ---- App shell ----
function App() {
  const [tab, setTab] = React.useState("accueil");
  const [view, setView] = React.useState({
    name: "tabs"
  });
  const go = k => {
    setTab(k);
    setView({
      name: "tabs"
    });
  };
  const openSubject = id => setView({
    name: "subject",
    id
  });
  const openConvos = () => setView({
    name: "convos"
  });
  const openConversation = () => setView({
    name: "conversation"
  });
  const back = () => setView({
    name: "tabs"
  });
  let body;
  if (view.name === "subject") body = /*#__PURE__*/React.createElement(Subject, {
    id: view.id,
    back: back,
    openConvos: openConvos
  });else if (view.name === "conversation") body = /*#__PURE__*/React.createElement(Conversation, {
    back: back,
    openConvos: openConvos
  });else if (view.name === "convos") body = /*#__PURE__*/React.createElement(Conversations, {
    back: back,
    openConversation: openConversation
  });else if (tab === "fil") body = /*#__PURE__*/React.createElement(Feed, {
    go: go,
    openSubject: openSubject,
    openConvos: openConvos
  });else if (tab === "memoire") body = /*#__PURE__*/React.createElement(Memoire, {
    go: go,
    openConvos: openConvos
  });else if (tab === "reglages") body = /*#__PURE__*/React.createElement(Reglages, {
    go: go,
    openConvos: openConvos
  });else body = /*#__PURE__*/React.createElement(Home, {
    go: go,
    openSubject: openSubject,
    openConvos: openConvos
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "phone"
  }, body);
}
window.RelvoAppB = App;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/relvo-app/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/relvo-app/data.js
try { (() => {
// Relvo app (Direction B) — sample data (Tasty Crousty case).
window.RELVO_B = {
  user: {
    name: "Vincent",
    org: "Tasty Crousty",
    date: "Lundi 16 juin"
  },
  brief: [{
    lbl: "Votre brief du jour",
    text: "1 sujet urgent et 3 tâches pour aujourd'hui. J'ai préparé 2 brouillons de réponse, prêts à envoyer."
  }, {
    lbl: "À surveiller",
    text: "Congélateur Narbonne : FroidExpert intervient mercredi 14:30. J'attends la confirmation du créneau."
  }, {
    lbl: "Bonne nouvelle",
    text: "78% de vos sujets gérés avec mon aide cette semaine — +12% par rapport à la semaine dernière."
  }],
  metrics: [{
    value: 1,
    label: "Urgents",
    tone: "urgent"
  }, {
    value: 3,
    label: "Tâches"
  }, {
    value: 1,
    label: "RDV"
  }, {
    value: 2,
    label: "Nouveaux"
  }],
  subjects: [{
    id: "SUB-0142",
    icon: "box",
    rail: "var(--blue-600)",
    urgent: true,
    unread: 2,
    title: "Remplacement sauce blanche",
    contact: "Karim Benali",
    org: "SoGood",
    summary: "Karim (SoGood) propose une substitution. Réponse et 2 tâches prêtes pour votre validation.",
    tags: [{
      label: "À faire · 2",
      tone: "amber"
    }, {
      label: "✦ 2 suggérées",
      tone: "relvo"
    }]
  }, {
    id: "SUB-0117",
    icon: "snow",
    rail: "var(--blue-600)",
    title: "Congélateur HS — Narbonne",
    contact: "FroidExpert SA",
    summary: "Intervention FroidExpert planifiée mercredi 14:30. En attente de confirmation.",
    tags: [{
      label: "⏳ En attente",
      tone: "grey"
    }]
  }, {
    id: "SUB-0098",
    icon: "users",
    rail: "var(--purple-600)",
    title: "Congé maternité — Sophie",
    contact: "Sophie Blanchard",
    summary: "Dossier RH rassemblé, courrier préparé par Relvo.",
    tags: [{
      label: "✦ 1 suggérée",
      tone: "relvo"
    }]
  }, {
    id: "SUB-0071",
    icon: "doc",
    rail: "var(--blue-600)",
    unread: 1,
    title: "Devis emballage PackPlus",
    contact: "PackPlus SARL",
    summary: "Nouveau devis reçu, 4 % plus cher. À arbitrer avant vendredi.",
    tags: [{
      label: "À faire · 1",
      tone: "amber"
    }]
  }, {
    id: "SUB-0054",
    icon: "check",
    rail: "var(--green-600)",
    done: true,
    title: "Virement Restaurant Le Palais",
    contact: "Le Palais",
    summary: "Paiement reçu et rapproché. Rien à faire de votre côté.",
    tags: [{
      label: "Terminé",
      tone: "green"
    }]
  }],
  tasks: [{
    title: "Valider la sauce de substitution proposée",
    source: "relvo",
    due: "Aujourd'hui · 11:00",
    done: false
  }, {
    title: "Demander une fiche allergènes à jour",
    source: "relvo",
    due: "Demain",
    done: false
  }, {
    title: "Prévenir l'équipe cuisine du changement",
    source: "me",
    done: true
  }],
  journal: [{
    actor: "relvo",
    text: "Relvo a préparé une réponse et créé 2 tâches.",
    time: "il y a 35 min"
  }, {
    actor: "ext",
    text: "Karim Benali a envoyé la fiche produit.",
    time: "WhatsApp · il y a 1 h"
  }, {
    actor: "me",
    text: "Vous avez ouvert le sujet.",
    time: "il y a 2 h"
  }, {
    actor: "relvo",
    text: "Relvo a créé ce sujet à partir d'un message WhatsApp.",
    time: "il y a 2 h"
  }],
  folders: [{
    name: "Fournisseurs",
    sub: "8 sujets · 12 documents",
    color: "var(--blue-600)",
    icon: "box"
  }, {
    name: "Ressources humaines",
    sub: "3 sujets · 5 documents",
    color: "var(--purple-600)",
    icon: "users"
  }, {
    name: "Juridique",
    sub: "2 sujets · 9 documents",
    color: "var(--amber-600)",
    icon: "doc"
  }, {
    name: "Clients",
    sub: "5 sujets · 3 documents",
    color: "var(--brand-accent)",
    icon: "bag"
  }, {
    name: "Production",
    sub: "4 sujets · 2 documents",
    color: "var(--green-600)",
    icon: "flame"
  }],
  conversations: [{
    title: "Réponse à Karim — sauce blanche",
    preview: "Vous pourrez lui proposer la substitution…",
    when: "5 min",
    context: "SUB-0142"
  }, {
    title: "Planning de la semaine",
    preview: "3 tâches mercredi, dont l'intervention FroidExpert…",
    when: "hier"
  }, {
    title: "Devis PackPlus — papier emballage",
    preview: "Comparaison avec le tarif précédent…",
    when: "ven.",
    context: "SUB-0071"
  }, {
    title: "Combien de sujets résolus ce mois ?",
    preview: "14 sujets résolus, délai moyen 2,3 jours…",
    when: "3 juin"
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/relvo-app/data.js", error: String((e && e.message) || e) }); }

// ui_kits/relvo-mobile/data.js
try { (() => {
// Sample data — the "Tasty Crousty" reference case from the Relvo brief.
window.RELVO_DATA = {
  user: {
    name: "Vincent",
    org: "Tasty Crousty",
    date: "Lundi 16 juin"
  },
  kpis: [{
    value: 1,
    label: "Sujets urgents",
    meta: "6 sujets ouverts",
    tone: "urgent",
    icon: "flag"
  }, {
    value: 3,
    label: "Tâches aujourd'hui",
    meta: "23 tâches à faire",
    tone: "default",
    icon: "check"
  }, {
    value: 1,
    label: "Rendez-vous",
    meta: "3 dans la semaine",
    tone: "default",
    icon: "calendar"
  }, {
    value: "78%",
    label: "Aide de Relvo",
    meta: "cette semaine",
    tone: "relvo",
    icon: "sparkles"
  }],
  agenda: [{
    d: "16",
    m: "Lun",
    today: true,
    items: [{
      dot: "var(--brand)",
      text: "Rappeler Karim — sauce blanche",
      time: "11:00"
    }, {
      dot: "var(--amber-600)",
      text: "Valider devis PackPlus",
      time: "—"
    }]
  }, {
    d: "17",
    m: "Mar",
    items: [{
      dot: "var(--purple-600)",
      text: "Réponse RH — congé maternité",
      time: "—"
    }]
  }, {
    d: "18",
    m: "Mer",
    items: [{
      dot: "var(--green-600)",
      text: "Intervention FroidExpert (Narbonne)",
      time: "14:30"
    }]
  }],
  subjects: [{
    id: "SUB-0142",
    reference: "SUB-0142",
    title: "Remplacement sauce blanche",
    summary: "Karim (SoGood) propose une sauce de substitution. Relvo a préparé une réponse et 2 tâches.",
    priority: "critical",
    status: "new",
    openTaskCount: 2,
    suggestionCount: 2,
    unreadCount: 2,
    contactName: "Karim Benali",
    attachmentCount: 1,
    lastActivityLabel: "35 min",
    progress: 0.25,
    tasks: [{
      title: "Valider la sauce de substitution proposée",
      source: "relvo",
      due: "Aujourd'hui · 11:00",
      done: false
    }, {
      title: "Demander une fiche allergènes à jour",
      source: "relvo",
      due: "Demain",
      done: false
    }, {
      title: "Prévenir l'équipe cuisine du changement",
      source: "me",
      due: "—",
      done: true
    }],
    messages: [{
      direction: "incoming",
      actor: "ext",
      senderName: "Karim Benali",
      channel: "WhatsApp",
      content: "Bonjour Vincent, rupture sur la sauce blanche habituelle. Je peux vous proposer une substitution équivalente."
    }, {
      direction: "incoming",
      actor: "ext",
      senderName: "Karim Benali",
      channel: "WhatsApp",
      content: "Voici la fiche produit.",
      attachment: {
        name: "Sauce-Subst-2291.pdf",
        label: "Fiche produit"
      }
    }, {
      direction: "outgoing",
      actor: "me",
      content: "Merci Karim, je regarde ça aujourd'hui."
    }]
  }, {
    id: "SUB-0117",
    reference: "SUB-0117",
    title: "Congélateur HS — Narbonne",
    summary: "Intervention FroidExpert planifiée mercredi 14:30. En attente de confirmation du créneau.",
    priority: "high",
    status: "acknowledged",
    waitingForReply: true,
    openTaskCount: 0,
    suggestionCount: 0,
    unreadCount: 0,
    contactName: "FroidExpert SA",
    attachmentCount: 0,
    lastActivityLabel: "il y a 2 h",
    progress: 0.66,
    tasks: [],
    messages: []
  }, {
    id: "SUB-0098",
    reference: "SUB-0098",
    title: "Congé maternité — Sophie Blanchard",
    summary: "Dossier RH à compléter. Relvo a rassemblé les pièces et préparé le courrier.",
    priority: "low",
    status: "new",
    openTaskCount: 1,
    suggestionCount: 1,
    unreadCount: 0,
    contactName: "Sophie Blanchard",
    attachmentCount: 2,
    lastActivityLabel: "hier",
    progress: 0.4,
    tasks: [],
    messages: []
  }, {
    id: "SUB-0071",
    reference: "SUB-0071",
    title: "Devis emballage PackPlus",
    summary: "Nouveau devis reçu, 4 % plus cher. À arbitrer avant vendredi.",
    priority: "low",
    status: "acknowledged",
    openTaskCount: 1,
    suggestionCount: 0,
    unreadCount: 1,
    contactName: "PackPlus SARL",
    attachmentCount: 1,
    lastActivityLabel: "hier",
    progress: 0.1,
    tasks: [],
    messages: []
  }, {
    id: "SUB-0054",
    reference: "SUB-0054",
    title: "Virement Restaurant Le Palais",
    summary: "Paiement reçu et rapproché. Rien à faire de votre côté.",
    priority: "low",
    status: "resolved",
    openTaskCount: 0,
    suggestionCount: 0,
    unreadCount: 0,
    contactName: "Le Palais",
    attachmentCount: 0,
    lastActivityLabel: "lun.",
    progress: 1
  }],
  prompts: ["Où en est le remplacement de la sauce blanche ?", "Prépare une réponse à FroidExpert pour confirmer mercredi", "Quelles sont mes tâches urgentes aujourd'hui ?"]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/relvo-mobile/data.js", error: String((e && e.message) || e) }); }

// ui_kits/relvo-mobile/screens.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Relvo mobile UI kit — interactive click-through. Composes the design-system
// components (SubjectCard, KpiTile, TaskCard, MessageBubble, RelvoComposer,
// RelvoOrb, markers) with product chrome (app bar, bottom tabs). French UI.

const NS = window.RelvoDesignSystem_ad3a3c;
const {
  SubjectCard,
  KpiTile,
  TaskCard,
  MessageBubble,
  RelvoComposer,
  RelvoOrb,
  ActorPill,
  Button,
  IconButton,
  Badge,
  StatusBadge,
  UrgentFlag,
  TodoBadge,
  WaitingBadge,
  SuggestBadge,
  Flag,
  Check,
  Sparkles,
  ArrowLeft,
  Send,
  Camera,
  Mic,
  Paperclip
} = NS;
const D = window.RELVO_DATA;

// ---- chrome icons (Lucide geometry) ----
const ic = {
  calendar: /*#__PURE__*/React.createElement("svg", {
    width: "26",
    height: "26",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "18",
    height: "17",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 9h18M8 2v4M16 2v4"
  })),
  home: /*#__PURE__*/React.createElement("svg", {
    width: "23",
    height: "23",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 10.5 12 3l9 7.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 9.5V21h14V9.5"
  })),
  mail: /*#__PURE__*/React.createElement("svg", {
    width: "23",
    height: "23",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "5",
    width: "18",
    height: "14",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m3 7 9 6 9-6"
  })),
  brain: /*#__PURE__*/React.createElement("svg", {
    width: "23",
    height: "23",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 5a3 3 0 1 0-5.997.142 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 5a3 3 0 1 1 5.997.142 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"
  })),
  cog: /*#__PURE__*/React.createElement("svg", {
    width: "23",
    height: "23",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19.7l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15M21 12a1.6 1.6 0 0 0-1.1-1.5"
  }))
};
function kpiIcon(name) {
  if (name === "flag") return /*#__PURE__*/React.createElement(Flag, {
    size: 26
  });
  if (name === "check") return /*#__PURE__*/React.createElement("svg", {
    width: "26",
    height: "26",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "18",
    height: "18",
    rx: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m8 12 3 3 5-6"
  }));
  if (name === "calendar") return ic.calendar;
  if (name === "sparkles") return /*#__PURE__*/React.createElement(Sparkles, {
    size: 26
  });
  return null;
}

// ---- shared chrome ----
function StatusBar() {
  return /*#__PURE__*/React.createElement("div", {
    className: "statusbar"
  }, /*#__PURE__*/React.createElement("span", null, "9:41"), /*#__PURE__*/React.createElement("span", {
    className: "dots"
  }, "\u25CF\u25CF\u25CF \u25D7 \uD83D\uDD0B"));
}
function AppBar({
  title,
  sub,
  back,
  onBack,
  action
}) {
  return /*#__PURE__*/React.createElement("header", {
    className: "appbar"
  }, back ? /*#__PURE__*/React.createElement("button", {
    className: "back",
    onClick: onBack,
    "aria-label": "Retour"
  }, /*#__PURE__*/React.createElement(ArrowLeft, {
    size: 22
  })) : null, /*#__PURE__*/React.createElement("div", {
    className: "titles"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hello"
  }, title), sub ? /*#__PURE__*/React.createElement("div", {
    className: "sub"
  }, sub) : null), action);
}
function TabBar({
  tab,
  go
}) {
  const items = [{
    k: "home",
    label: "Accueil",
    icon: ic.home
  }, {
    k: "feed",
    label: "Mon fil",
    icon: ic.mail
  }, {
    k: "memory",
    label: "Mémoire",
    icon: ic.brain
  }, {
    k: "settings",
    label: "Réglages",
    icon: ic.cog
  }];
  return /*#__PURE__*/React.createElement("nav", {
    className: "tabbar"
  }, items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.k,
    className: tab === it.k ? "active" : "",
    onClick: () => go(it.k)
  }, it.icon, it.label)));
}
function SectionLabel({
  children,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "section-label"
  }, /*#__PURE__*/React.createElement("h2", null, children), action ? /*#__PURE__*/React.createElement("a", null, action) : null);
}

// ---- Home (Accueil) ----
function HomeScreen({
  openSubject
}) {
  return /*#__PURE__*/React.createElement("main", {
    className: "scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scroll-pad"
  }, /*#__PURE__*/React.createElement("div", {
    className: "relvo-greet"
  }, /*#__PURE__*/React.createElement("span", {
    className: "spark"
  }, /*#__PURE__*/React.createElement(Sparkles, {
    size: 16
  })), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("strong", null, "1 sujet urgent"), " et 3 t\xE2ches pour aujourd'hui. J'ai pr\xE9par\xE9 2 brouillons de r\xE9ponse \u2014 voulez-vous les voir\xA0?")), /*#__PURE__*/React.createElement(SectionLabel, null, "Vue du jour"), /*#__PURE__*/React.createElement("div", {
    className: "kpi-grid"
  }, D.kpis.map((k, i) => /*#__PURE__*/React.createElement(KpiTile, {
    key: i,
    value: k.value,
    label: k.label,
    meta: k.meta,
    tone: k.tone,
    icon: kpiIcon(k.icon)
  }))), /*#__PURE__*/React.createElement(SectionLabel, {
    action: "Voir le mois \u2192"
  }, "Agenda"), /*#__PURE__*/React.createElement("div", {
    className: "agenda"
  }, D.agenda.map((day, i) => /*#__PURE__*/React.createElement("div", {
    className: "day",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "date" + (day.today ? " today" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "d"
  }, day.d), /*#__PURE__*/React.createElement("div", {
    className: "m"
  }, day.m)), /*#__PURE__*/React.createElement("div", {
    className: "items"
  }, day.items.map((ev, j) => /*#__PURE__*/React.createElement("div", {
    className: "ev",
    key: j
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot",
    style: {
      background: ev.dot
    }
  }), ev.text, /*#__PURE__*/React.createElement("span", {
    className: "time"
  }, ev.time))))))), /*#__PURE__*/React.createElement(SectionLabel, {
    action: "Voir tout \u2192"
  }, "Sujets prioritaires"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    }
  }, D.subjects.slice(0, 2).map(s => /*#__PURE__*/React.createElement(SubjectCard, _extends({
    key: s.id
  }, s, {
    onClick: () => openSubject(s.id)
  }))))));
}

// ---- Feed (Mon fil) ----
function FeedScreen({
  openSubject
}) {
  const [filter, setFilter] = React.useState("priority");
  const tabs = [{
    k: "priority",
    label: "Priorité"
  }, {
    k: "open",
    label: "Ouverts"
  }, {
    k: "done",
    label: "Terminés"
  }];
  let list = D.subjects;
  if (filter === "open") list = D.subjects.filter(s => s.status !== "resolved");
  if (filter === "done") list = D.subjects.filter(s => s.status === "resolved");
  if (filter === "priority") list = [...D.subjects].sort((a, b) => (b.priority === "critical") - (a.priority === "critical"));
  return /*#__PURE__*/React.createElement("main", {
    className: "scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scroll-pad"
  }, /*#__PURE__*/React.createElement("div", {
    className: "relvo-banner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "spark"
  }, /*#__PURE__*/React.createElement(Sparkles, {
    size: 15
  })), /*#__PURE__*/React.createElement("p", null, "J'ai tri\xE9 12 nouveaux messages en 5 sujets ce matin."), /*#__PURE__*/React.createElement("a", null, "D\xE9tails")), /*#__PURE__*/React.createElement("div", {
    className: "segmented",
    style: {
      margin: "12px 0"
    }
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.k,
    className: filter === t.k ? "active" : "",
    onClick: () => setFilter(t.k)
  }, t.label))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    }
  }, list.map(s => /*#__PURE__*/React.createElement(SubjectCard, _extends({
    key: s.id
  }, s, {
    tone: s.status === "resolved" ? "done" : "default",
    onClick: () => openSubject(s.id)
  }))))));
}

// ---- Subject (Sujet) ----
function SubjectScreen({
  subject,
  onBack,
  openConversation
}) {
  const [tab, setTab] = React.useState("messages");
  const [tasks, setTasks] = React.useState(subject.tasks || []);
  const toggle = i => setTasks(ts => ts.map((t, j) => j === i ? {
    ...t,
    done: !t.done
  } : t));
  const tabs = [{
    k: "messages",
    label: "Messages"
  }, {
    k: "tasks",
    label: "Tâches"
  }, {
    k: "journal",
    label: "Journal"
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AppBar, {
    back: true,
    onBack: onBack,
    title: subject.title,
    sub: subject.reference + " · " + subject.contactName,
    action: /*#__PURE__*/React.createElement(IconButton, {
      tone: "relvoSoft",
      label: "Demander \xE0 Relvo",
      style: {
        fontSize: "17px"
      }
    }, "\u2726")
  }), /*#__PURE__*/React.createElement("main", {
    className: "scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scroll-pad"
  }, /*#__PURE__*/React.createElement("div", {
    className: "status-strip"
  }, subject.priority === "critical" ? /*#__PURE__*/React.createElement(UrgentFlag, null) : null, /*#__PURE__*/React.createElement(StatusBadge, {
    status: subject.status
  }), subject.openTaskCount > 0 ? /*#__PURE__*/React.createElement(TodoBadge, null) : null, subject.waitingForReply ? /*#__PURE__*/React.createElement(WaitingBadge, null) : null, /*#__PURE__*/React.createElement(SuggestBadge, {
    count: subject.suggestionCount
  })), /*#__PURE__*/React.createElement("div", {
    className: "relvo-summary"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rs-head"
  }, /*#__PURE__*/React.createElement(Sparkles, {
    size: 14
  }), " R\xE9sum\xE9 de Relvo"), /*#__PURE__*/React.createElement("p", null, subject.summary, " J'attends votre validation sur la sauce de substitution avant de r\xE9pondre \xE0 Karim.")), /*#__PURE__*/React.createElement("div", {
    className: "segmented",
    style: {
      margin: "14px 0 12px"
    }
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.k,
    className: tab === t.k ? "active" : "",
    onClick: () => setTab(t.k)
  }, t.label))), tab === "messages" ? /*#__PURE__*/React.createElement("div", {
    className: "chat",
    style: {
      padding: 0,
      gap: "14px"
    }
  }, subject.messages.map((m, i) => /*#__PURE__*/React.createElement(MessageBubble, _extends({
    key: i
  }, m))), /*#__PURE__*/React.createElement("div", {
    className: "action-block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ab-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "spark"
  }, /*#__PURE__*/React.createElement(Sparkles, {
    size: 14
  })), " Brouillon pr\xE9par\xE9 par Relvo"), /*#__PURE__*/React.createElement("div", {
    className: "ab-body"
  }, "\xAB Merci Karim. La substitution nous convient, envoyez-nous la fiche allerg\xE8nes \xE0 jour et nous validons la commande. \xBB"), /*#__PURE__*/React.createElement("div", {
    className: "ab-actions"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "relvo",
    size: "sm"
  }, "Envoyer"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm"
  }, "Modifier")))) : null, tab === "tasks" ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "8px"
    }
  }, tasks.map((t, i) => /*#__PURE__*/React.createElement(TaskCard, _extends({
    key: i
  }, t, {
    onToggle: () => toggle(i)
  })))) : null, tab === "journal" ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "13.5px",
      color: "var(--text-secondary)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "log-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lg-dot relvo"
  }), /*#__PURE__*/React.createElement("div", {
    className: "lg-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lg-text"
  }, "Relvo a cr\xE9\xE9 2 t\xE2ches et un brouillon de r\xE9ponse."), /*#__PURE__*/React.createElement("div", {
    className: "lg-time"
  }, "35 min")), /*#__PURE__*/React.createElement("span", {
    className: "lg-line"
  })), /*#__PURE__*/React.createElement("div", {
    className: "log-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lg-dot ext"
  }), /*#__PURE__*/React.createElement("div", {
    className: "lg-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lg-text"
  }, "Karim Benali a envoy\xE9 la fiche produit."), /*#__PURE__*/React.createElement("div", {
    className: "lg-time"
  }, "1 h")), /*#__PURE__*/React.createElement("span", {
    className: "lg-line"
  })), /*#__PURE__*/React.createElement("div", {
    className: "log-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lg-dot me"
  }), /*#__PURE__*/React.createElement("div", {
    className: "lg-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lg-text"
  }, "Vous avez ouvert le sujet."), /*#__PURE__*/React.createElement("div", {
    className: "lg-time"
  }, "2 h")))) : null)), /*#__PURE__*/React.createElement("div", {
    className: "sujet-actions"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "success",
    size: "sm",
    style: {
      flex: 1
    }
  }, "Terminer"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    style: {
      flex: 1
    },
    onClick: openConversation
  }, "Demander \xE0 Relvo")));
}

// ---- Conversation (agent surface) ----
function ConversationScreen({
  onBack,
  context
}) {
  const [msgs, setMsgs] = React.useState([]);
  const [val, setVal] = React.useState("");
  const send = text => {
    const t = (text ?? val).trim();
    if (!t) return;
    setMsgs(m => [...m, {
      direction: "outgoing",
      actor: "me",
      content: t
    }, {
      direction: "incoming",
      actor: "relvo",
      senderName: "Relvo",
      channel: "à l'instant",
      content: "C'est noté. Je m'en occupe et reviens vers vous dès que c'est prêt."
    }]);
    setVal("");
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AppBar, {
    back: true,
    onBack: onBack,
    title: "Relvo",
    sub: "Votre assistant"
  }), context ? /*#__PURE__*/React.createElement("div", {
    className: "ctx-chip"
  }, /*#__PURE__*/React.createElement("span", {
    className: "label"
  }, /*#__PURE__*/React.createElement(Sparkles, {
    size: 13
  }), " Contexte : ", context)) : null, /*#__PURE__*/React.createElement("main", {
    className: "scroll",
    style: {
      background: "var(--bg-secondary)"
    }
  }, msgs.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "chat-empty"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hi"
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/relvo-icon-256.png",
    width: "56",
    height: "56",
    alt: "Relvo",
    style: {
      filter: "drop-shadow(var(--shadow-relvo))"
    }
  }), /*#__PURE__*/React.createElement("h3", null, "Bonjour ", D.user.name), /*#__PURE__*/React.createElement("p", null, "Posez-moi une question, ou dictez. Je connais vos sujets.")), /*#__PURE__*/React.createElement("div", {
    className: "prompt-list"
  }, D.prompts.map((p, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "prompt",
    style: {
      textAlign: "left",
      width: "100%"
    },
    onClick: () => send(p)
  }, p)))) : /*#__PURE__*/React.createElement("div", {
    className: "chat"
  }, msgs.map((m, i) => /*#__PURE__*/React.createElement(MessageBubble, _extends({
    key: i
  }, m))))), /*#__PURE__*/React.createElement("div", {
    className: "relvo-bar",
    style: {
      alignItems: "flex-end"
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    tone: "relvo",
    label: "Historique",
    style: {
      fontSize: "17px"
    }
  }, "\u2726"), /*#__PURE__*/React.createElement("textarea", {
    className: "field",
    rows: 1,
    placeholder: "Demander \xE0 Relvo\u2026",
    value: val,
    onChange: e => setVal(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    }
  }), val.trim() ? /*#__PURE__*/React.createElement(IconButton, {
    tone: "brand",
    label: "Envoyer",
    onClick: () => send()
  }, /*#__PURE__*/React.createElement(Send, {
    size: 18
  })) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(IconButton, {
    tone: "neutral",
    label: "Photo"
  }, /*#__PURE__*/React.createElement(Camera, {
    size: 18
  })), /*#__PURE__*/React.createElement(IconButton, {
    tone: "relvo",
    size: 42,
    label: "Dicter"
  }, /*#__PURE__*/React.createElement(Mic, {
    size: 20
  })))));
}

// ---- App shell ----
function App() {
  const [tab, setTab] = React.useState("home");
  const [view, setView] = React.useState({
    name: "tabs"
  }); // tabs | subject | conversation
  const openSubject = id => setView({
    name: "subject",
    id
  });
  const openConversation = ctx => setView({
    name: "conversation",
    context: ctx
  });
  const subject = view.id ? D.subjects.find(s => s.id === view.id) : null;
  let body,
    showChrome = false,
    screenLabel = tab;
  if (view.name === "subject" && subject) {
    body = /*#__PURE__*/React.createElement(SubjectScreen, {
      subject: subject,
      onBack: () => setView({
        name: "tabs"
      }),
      openConversation: () => openConversation(subject.reference)
    });
    screenLabel = "subject";
  } else if (view.name === "conversation") {
    body = /*#__PURE__*/React.createElement(ConversationScreen, {
      onBack: () => setView({
        name: "tabs"
      }),
      context: view.context
    });
    screenLabel = "conversation";
  } else {
    showChrome = true;
    if (tab === "home") body = /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AppBar, {
      title: "Bonjour " + D.user.name,
      sub: D.user.date + " · " + D.user.org
    }), /*#__PURE__*/React.createElement(HomeScreen, {
      openSubject: openSubject
    }));else if (tab === "feed") body = /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AppBar, {
      title: "Mon fil",
      sub: "Vos sujets, tri\xE9s par Relvo"
    }), /*#__PURE__*/React.createElement(FeedScreen, {
      openSubject: openSubject
    }));else if (tab === "memory") body = /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AppBar, {
      title: "M\xE9moire",
      sub: "Ce que Relvo sait de votre activit\xE9"
    }), /*#__PURE__*/React.createElement(MemoryScreen, null));else body = /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AppBar, {
      title: "R\xE9glages",
      sub: D.user.org
    }), /*#__PURE__*/React.createElement(SettingsScreen, null));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "device",
    "data-screen-label": screenLabel
  }, /*#__PURE__*/React.createElement(StatusBar, null), body, showChrome ? /*#__PURE__*/React.createElement(RelvoComposer, null) : null, showChrome ? /*#__PURE__*/React.createElement(TabBar, {
    tab: tab,
    go: k => {
      setTab(k);
      setView({
        name: "tabs"
      });
    }
  }) : null);
}

// ---- Memory + Settings (lighter destinations) ----
function MemoryScreen() {
  const folders = [{
    name: "Fournisseurs",
    c: "c-blue",
    sub: "8 sujets · 12 documents",
    desc: "SoGood, PackPlus, FroidExpert…"
  }, {
    name: "RH",
    c: "c-purple",
    sub: "3 sujets · 5 documents",
    desc: "Contrats, congés, plannings."
  }, {
    name: "Juridique",
    c: "c-amber",
    sub: "2 sujets · 9 documents",
    desc: "ClimaPro, baux, assurances."
  }, {
    name: "Clients",
    c: "c-red",
    sub: "5 sujets · 3 documents",
    desc: "Le Palais, commandes, virements."
  }];
  return /*#__PURE__*/React.createElement("main", {
    className: "scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scroll-pad"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mem-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mc-head"
  }, /*#__PURE__*/React.createElement(Sparkles, {
    size: 15
  }), " Ce que je sais"), /*#__PURE__*/React.createElement("p", null, "Je suis votre m\xE9moire : 18 sujets suivis, 29 documents lus, 6 contacts. Demandez-moi n'importe quoi sur vos affaires en cours."), /*#__PURE__*/React.createElement("div", {
    className: "mem-stats"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ms"
  }, /*#__PURE__*/React.createElement("b", null, "18"), " sujets"), /*#__PURE__*/React.createElement("span", {
    className: "ms"
  }, /*#__PURE__*/React.createElement("b", null, "29"), " documents"), /*#__PURE__*/React.createElement("span", {
    className: "ms"
  }, /*#__PURE__*/React.createElement("b", null, "6"), " dossiers"))), /*#__PURE__*/React.createElement(SectionLabel, null, "Dossiers"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    }
  }, folders.map((f, i) => /*#__PURE__*/React.createElement("div", {
    className: "folder-card",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "fc-top"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fc-ic " + f.c
  }, "\uD83D\uDDC2"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "fc-name"
  }, f.name), /*#__PURE__*/React.createElement("div", {
    className: "fc-sub"
  }, f.sub))), /*#__PURE__*/React.createElement("div", {
    className: "fc-desc"
  }, f.desc))))));
}
function SettingsScreen() {
  return /*#__PURE__*/React.createElement("main", {
    className: "scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scroll-pad"
  }, /*#__PURE__*/React.createElement(SectionLabel, null, "Canaux connect\xE9s"), /*#__PURE__*/React.createElement("div", {
    className: "form-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "channel-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ch-ic wa"
  }, "\uD83D\uDCAC"), /*#__PURE__*/React.createElement("div", {
    className: "ch-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ch-name"
  }, "WhatsApp Business"), /*#__PURE__*/React.createElement("div", {
    className: "ch-meta"
  }, "+33 6 12 34 56 78")), /*#__PURE__*/React.createElement("span", {
    className: "dot-status"
  }, "Connect\xE9")), /*#__PURE__*/React.createElement("div", {
    className: "channel-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ch-ic mail"
  }, "\u2709\uFE0F"), /*#__PURE__*/React.createElement("div", {
    className: "ch-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ch-name"
  }, "Email \u2014 direction@tastycrousty.fr"), /*#__PURE__*/React.createElement("div", {
    className: "ch-meta"
  }, "Synchronis\xE9 il y a 5 min")), /*#__PURE__*/React.createElement("span", {
    className: "dot-status"
  }, "Connect\xE9"))), /*#__PURE__*/React.createElement(SectionLabel, null, "Pr\xE9f\xE9rences"), /*#__PURE__*/React.createElement("div", {
    className: "form-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "form-row toggle-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tl"
  }, "Brief quotidien", /*#__PURE__*/React.createElement("small", null, "R\xE9sum\xE9 de Relvo chaque matin \xE0 8h")), /*#__PURE__*/React.createElement("div", {
    className: "toggle on"
  }, /*#__PURE__*/React.createElement("i", null))), /*#__PURE__*/React.createElement("div", {
    className: "form-row toggle-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tl"
  }, "Suggestions automatiques", /*#__PURE__*/React.createElement("small", null, "Relvo pr\xE9pare des brouillons de r\xE9ponse")), /*#__PURE__*/React.createElement("div", {
    className: "toggle on"
  }, /*#__PURE__*/React.createElement("i", null))), /*#__PURE__*/React.createElement("div", {
    className: "form-row toggle-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tl"
  }, "Notifications urgentes", /*#__PURE__*/React.createElement("small", null, "Uniquement les sujets critiques")), /*#__PURE__*/React.createElement("div", {
    className: "toggle"
  }, /*#__PURE__*/React.createElement("i", null))))));
}
window.RelvoApp = App;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/relvo-mobile/screens.jsx", error: String((e && e.message) || e) }); }

__ds_ns.KpiTile = __ds_scope.KpiTile;

__ds_ns.SubjectCard = __ds_scope.SubjectCard;

__ds_ns.TaskCard = __ds_scope.TaskCard;

__ds_ns.MessageBubble = __ds_scope.MessageBubble;

__ds_ns.RelvoComposer = __ds_scope.RelvoComposer;

__ds_ns.RelvoOrb = __ds_scope.RelvoOrb;

__ds_ns.ActorPill = __ds_scope.ActorPill;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Sparkles = __ds_scope.Sparkles;

__ds_ns.Flag = __ds_scope.Flag;

__ds_ns.Hourglass = __ds_scope.Hourglass;

__ds_ns.SquareCheck = __ds_scope.SquareCheck;

__ds_ns.Check = __ds_scope.Check;

__ds_ns.User = __ds_scope.User;

__ds_ns.Paperclip = __ds_scope.Paperclip;

__ds_ns.Clock = __ds_scope.Clock;

__ds_ns.Camera = __ds_scope.Camera;

__ds_ns.Mic = __ds_scope.Mic;

__ds_ns.Send = __ds_scope.Send;

__ds_ns.FileText = __ds_scope.FileText;

__ds_ns.ArrowLeft = __ds_scope.ArrowLeft;

__ds_ns.StatusBadge = __ds_scope.StatusBadge;

__ds_ns.UrgentFlag = __ds_scope.UrgentFlag;

__ds_ns.TodoBadge = __ds_scope.TodoBadge;

__ds_ns.WaitingBadge = __ds_scope.WaitingBadge;

__ds_ns.SuggestBadge = __ds_scope.SuggestBadge;

__ds_ns.UnreadCount = __ds_scope.UnreadCount;

__ds_ns.ChatBubble = __ds_scope.ChatBubble;

__ds_ns.ConvListItem = __ds_scope.ConvListItem;

__ds_ns.FolderRow = __ds_scope.FolderRow;

__ds_ns.GlassTabBar = __ds_scope.GlassTabBar;

__ds_ns.JournalTimeline = __ds_scope.JournalTimeline;

__ds_ns.MetricsCard = __ds_scope.MetricsCard;

__ds_ns.RecipientComposer = __ds_scope.RecipientComposer;

__ds_ns.RelvoHeader = __ds_scope.RelvoHeader;

__ds_ns.SegTabs = __ds_scope.SegTabs;

__ds_ns.SubjectRow = __ds_scope.SubjectRow;

__ds_ns.SwipeRow = __ds_scope.SwipeRow;

__ds_ns.TaskRow = __ds_scope.TaskRow;

})();
