export const T = {
  bg: "#0e0e10",
  sidebar: "rgba(20,20,20,0.75)",
  sH: "#222",
  sA: "#2a2a2a",
  surface: "rgba(30,30,30,0.6)",
  surfaceSolid: "#1e1e1e",
  raised: "#252525",
  border: "#333",
  borderGlass: "rgba(255,255,255,0.06)",
  text: "#ececec",
  sec: "#999",
  ter: "#666",
  accent: "#0a84ff",
  aD: "rgba(10,132,255,0.12)",
  green: "#30d158",
  gD: "rgba(48,209,88,0.12)",
  orange: "#ff9f0a",
  oD: "rgba(255,159,10,0.15)",
  red: "#ff453a",
  rD: "rgba(255,69,58,0.12)",
  purple: "#bf5af2",
  pD: "rgba(191,90,242,0.12)",
  teal: "#64d2ff",
  tD: "rgba(100,210,255,0.12)",
  f: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
  m: "'SF Mono', 'JetBrains Mono', monospace",
};

export const TC: Record<string, { l: string; c: string; bg: string }> = {
  research: { l: "Research", c: T.accent, bg: T.aD },
  planning: { l: "Planning", c: T.purple, bg: T.pD },
  create: { l: "Create", c: T.green, bg: T.gD },
  edit: { l: "Edit", c: T.orange, bg: T.oD },
  test: { l: "Test", c: T.teal, bg: T.tD },
};

export const FB: Record<string, { label: string; color: string; bg: string; border: string }> = {
  question: { label: "Question", color: T.accent, bg: "rgba(10,132,255,0.08)", border: "rgba(10,132,255,0.2)" },
  directive: { label: "Directive", color: T.orange, bg: "rgba(255,159,10,0.08)", border: "rgba(255,159,10,0.2)" },
  issue: { label: "Issue", color: T.red, bg: "rgba(255,69,58,0.08)", border: "rgba(255,69,58,0.2)" },
};
