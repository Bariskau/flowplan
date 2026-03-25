import type { CardSummary, HistoryDiff } from "../types";

export function computeDiff(prev: CardSummary[], current: CardSummary[]): HistoryDiff {
  const prevMap = new Map(prev.map(c => [c.id, c]));
  const currMap = new Map(current.map(c => [c.id, c]));

  const added: CardSummary[] = [];
  const removed: CardSummary[] = [];
  const modified: { before: CardSummary; after: CardSummary }[] = [];

  for (const c of current) {
    const p = prevMap.get(c.id);
    if (!p) {
      added.push(c);
    } else if (
      p.title !== c.title ||
      p.type !== c.type ||
      p.descriptionLen !== c.descriptionLen ||
      p.filesCount !== c.filesCount ||
      JSON.stringify(p.files) !== JSON.stringify(c.files) ||
      JSON.stringify(p.dependencies) !== JSON.stringify(c.dependencies)
    ) {
      modified.push({ before: p, after: c });
    }
  }

  for (const p of prev) {
    if (!currMap.has(p.id)) {
      removed.push(p);
    }
  }

  return { added, removed, modified };
}
