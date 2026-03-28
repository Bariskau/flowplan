export const T = {
  bg: "#09090b",
  sidebar: "rgba(9,9,11,0.80)",
  sH: "#18181b",
  sA: "#27272a",
  surface: "rgba(24,24,27,0.6)",
  surfaceSolid: "#18181b",
  raised: "#27272a",
  border: "rgba(255,255,255,0.06)",
  borderGlass: "rgba(255,255,255,0.06)",
  text: "#fafafa",
  sec: "#a1a1aa",
  ter: "#71717a",
  accent: "#10b981",
  aD: "rgba(16,185,129,0.12)",
  green: "#34d399",
  gD: "rgba(52,211,153,0.12)",
  orange: "#fb923c",
  oD: "rgba(251,146,60,0.12)",
  red: "#f87171",
  rD: "rgba(248,113,113,0.12)",
  purple: "#a78bfa",
  pD: "rgba(167,139,250,0.12)",
  teal: "#2dd4bf",
  tD: "rgba(45,212,191,0.12)",
  f: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  m: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
};

export const TC: Record<string, { l: string; c: string; bg: string }> = {
  research: { l: "Research", c: "#10b981", bg: "rgba(16,185,129,0.10)" },
  planning: { l: "Planning", c: "#a78bfa", bg: "rgba(167,139,250,0.10)" },
  create: { l: "Create", c: "#38bdf8", bg: "rgba(56,189,248,0.10)" },
  edit: { l: "Edit", c: "#fbbf24", bg: "rgba(251,191,36,0.10)" },
  test: { l: "Test", c: "#22d3ee", bg: "rgba(34,211,238,0.10)" },
};

export const FB: Record<string, { label: string; color: string; bg: string; border: string }> = {
  question: { label: "Question", color: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.20)" },
  directive: { label: "Directive", color: "#fb923c", bg: "rgba(251,146,60,0.08)", border: "rgba(251,146,60,0.20)" },
  issue: { label: "Issue", color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.20)" },
};
