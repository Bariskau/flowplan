export const T = {
  border: "rgba(255,255,255,0.06)",
  text: "#fafafa",
  sec: "#a1a1aa",
  ter: "#616161",
  accent: "#10b981",
  green: "#34a853",
  orange: "#fb923c",
  purple: "#a855f7",
  f: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  m: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
};

export const TC: Record<string, { l: string; c: string; bg: string }> = {
  research: { l: "Research", c: "#4285f4", bg: "rgba(66,133,244,0.10)" },
  planning: { l: "Planning", c: "#a855f7", bg: "rgba(168,85,247,0.10)" },
  create: { l: "Create", c: "#34a853", bg: "rgba(52,168,83,0.10)" },
  edit: { l: "Edit", c: "#fbbc04", bg: "rgba(251,188,4,0.10)" },
  test: { l: "Test", c: "#ea4335", bg: "rgba(234,67,53,0.10)" },
};

export const FB: Record<string, { label: string; color: string; bg: string; border: string }> = {
  question: { label: "Question", color: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.20)" },
  directive: { label: "Directive", color: "#fb923c", bg: "rgba(251,146,60,0.08)", border: "rgba(251,146,60,0.20)" },
  issue: { label: "Issue", color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.20)" },
};
