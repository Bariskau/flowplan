import type { Card, CardSummary, HistoryDiff, HistoryEntry } from "../types";

function areStringArraysEqual(prev: string[], current: string[]) {
  if (prev === current) return true;
  if (prev.length !== current.length) return false;
  return prev.every((value, index) => value === current[index]);
}

function areFileChangesEqual(prev: Card["fileChanges"], current: Card["fileChanges"]) {
  const prevEntries = Object.entries(prev ?? {});
  const currentEntries = Object.entries(current ?? {});
  if (prevEntries.length !== currentEntries.length) return false;
  return prevEntries.every(([path, change]) => {
    const currentChange = current?.[path];
    return (
      !!currentChange &&
      change.content === currentChange.content &&
      change.language === currentChange.language &&
      change.changeType === currentChange.changeType
    );
  });
}

function areCardSummariesEqual(prev: CardSummary, current: CardSummary) {
  return (
    prev.title === current.title &&
    prev.type === current.type &&
    prev.descriptionLen === current.descriptionLen &&
    prev.filesCount === current.filesCount &&
    areStringArraysEqual(prev.files, current.files) &&
    areStringArraysEqual(prev.dependencies, current.dependencies)
  );
}

function cardToSummary(card: Card): CardSummary {
  return {
    id: card.id,
    title: card.title,
    type: card.type,
    descriptionLen: card.description.length,
    filesCount: card.files.length,
    files: card.files,
    dependencies: card.dependencies,
  };
}

function areCardsEqual(prev: Card, current: Card) {
  return (
    prev.title === current.title &&
    prev.type === current.type &&
    prev.description === current.description &&
    prev.repo === current.repo &&
    (prev.order ?? 0) === (current.order ?? 0) &&
    areStringArraysEqual(prev.files, current.files) &&
    areStringArraysEqual(prev.dependencies, current.dependencies) &&
    areFileChangesEqual(prev.fileChanges, current.fileChanges)
  );
}

export function hasFullHistoryEntryCards(entry: HistoryEntry | null | undefined) {
  return !!entry?.fullCards && entry.fullCards.length === entry.cards.length;
}

export function hasPreviousFullHistoryEntryCards(entry: HistoryEntry | null | undefined) {
  if (!entry?.previousFullCards) return false;
  const expectedLength = entry.previousCards?.length ?? entry.previousFullCards.length;
  return entry.previousFullCards.length === expectedLength;
}

export function computeDiff(prev: CardSummary[], current: CardSummary[]): HistoryDiff {
  const prevMap = new Map(prev.map((c) => [c.id, c]));
  const currMap = new Map(current.map((c) => [c.id, c]));

  const added: CardSummary[] = [];
  const removed: CardSummary[] = [];
  const modified: { before: CardSummary; after: CardSummary }[] = [];

  for (const c of current) {
    const p = prevMap.get(c.id);
    if (!p) {
      added.push(c);
    } else if (!areCardSummariesEqual(p, c)) {
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

export function computeCardDiff(prev: Card[], current: Card[]): HistoryDiff {
  const prevMap = new Map(prev.map((card) => [card.id, card]));
  const currMap = new Map(current.map((card) => [card.id, card]));

  const added: CardSummary[] = [];
  const removed: CardSummary[] = [];
  const modified: { before: CardSummary; after: CardSummary }[] = [];

  for (const card of current) {
    const prevCard = prevMap.get(card.id);
    if (!prevCard) {
      added.push(cardToSummary(card));
    } else if (!areCardsEqual(prevCard, card)) {
      modified.push({ before: cardToSummary(prevCard), after: cardToSummary(card) });
    }
  }

  for (const card of prev) {
    if (!currMap.has(card.id)) {
      removed.push(cardToSummary(card));
    }
  }

  return { added, removed, modified };
}

export function computeHistoryEntryDiff(prevEntry: HistoryEntry | null, currentEntry: HistoryEntry): HistoryDiff {
  if (hasPreviousFullHistoryEntryCards(currentEntry) && hasFullHistoryEntryCards(currentEntry)) {
    return computeCardDiff(currentEntry.previousFullCards ?? [], currentEntry.fullCards ?? []);
  }
  if (currentEntry.previousCards?.length) {
    return computeDiff(currentEntry.previousCards, currentEntry.cards);
  }
  if (prevEntry && hasFullHistoryEntryCards(prevEntry) && hasFullHistoryEntryCards(currentEntry)) {
    return computeCardDiff(prevEntry.fullCards ?? [], currentEntry.fullCards ?? []);
  }
  if (!prevEntry && hasFullHistoryEntryCards(currentEntry)) {
    return computeCardDiff([], currentEntry.fullCards ?? []);
  }
  return computeDiff(prevEntry?.cards ?? [], currentEntry.cards);
}
