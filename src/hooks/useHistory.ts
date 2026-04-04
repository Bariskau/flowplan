import { useState, useCallback, useMemo, useEffect } from "react";
import type { Card, HistoryEntry } from "../types";
import * as api from "../lib/api";

const HISTORY_PAGE_LIMIT = 100;

export function useHistory(activePlanId: string | null, apiBase: string) {
  const [histOpen, setHistOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedHistoryEntryId, setSelectedHistoryEntryId] = useState<string | null>(null);
  const [oldCard, setOldCard] = useState<Card | null>(null);
  const [histCard, setHistCard] = useState<Card | null>(null);

  useEffect(() => {
    if (!histOpen || !activePlanId) {
      setHistory([]);
      setSelectedHistoryEntryId(null);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const h = await api.fetchHistory(activePlanId, { limit: HISTORY_PAGE_LIMIT, base: apiBase });
        if (!alive) return;
        setHistory(h.entries || []);
        setSelectedHistoryEntryId((prev) =>
          prev && !(h.entries || []).some((entry) => entry.id === prev) ? null : prev,
        );
      } catch {
        if (alive) {
          setHistory([]);
          setSelectedHistoryEntryId(null);
        }
      }
    };
    load();
    const iv = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [histOpen, activePlanId, apiBase]);

  const activeHistoryEntry = useMemo(
    () => (histOpen && selectedHistoryEntryId ? history.find((entry) => entry.id === selectedHistoryEntryId) ?? null : null),
    [histOpen, history, selectedHistoryEntryId],
  );

  const historySnapshot = activeHistoryEntry?.snapshot ?? null;

  useEffect(() => {
    if (selectedHistoryEntryId && activeHistoryEntry) return;
    setOldCard(null);
    setHistCard(null);
  }, [activeHistoryEntry, selectedHistoryEntryId]);

  const highlightMap = useMemo<Record<string, "added" | "modified">>(() => {
    if (!activeHistoryEntry) return {};
    const m: Record<string, "added" | "modified"> = {};
    activeHistoryEntry.changes.forEach((change) => {
      const cardId = change.after?.id || change.cardId || null;
      if (!cardId) return;
      if (change.kind === "card_added") m[cardId] = "added";
      else if (change.kind === "card_updated") m[cardId] = "modified";
    });
    return m;
  }, [activeHistoryEntry]);

  const handleToggleHistory = useCallback(() => {
    setHistOpen((h) => !h);
    setSelectedHistoryEntryId(null);
    setOldCard(null);
    setHistCard(null);
  }, []);

  const handleHistorySelect = useCallback((entryId: string | null) => {
    setSelectedHistoryEntryId(entryId);
    setOldCard(null);
    setHistCard(null);
  }, []);

  const selectHistoryCard = useCallback(
    (id: string | null) => {
      if (!historySnapshot) {
        setHistCard(null);
        return;
      }
      setOldCard(null);
      setHistCard(id ? historySnapshot.cards.find((card) => card.id === id) ?? null : null);
    },
    [historySnapshot],
  );

  const reset = useCallback(() => {
    setHistOpen(false);
    setSelectedHistoryEntryId(null);
    setOldCard(null);
    setHistCard(null);
  }, []);

  const historyDetailLabel = activeHistoryEntry
    ? `History change · r${activeHistoryEntry.revision}`
    : "History change";

  const historyBeforeLabel = activeHistoryEntry
    ? `History before · r${activeHistoryEntry.revision}`
    : "History before";

  return {
    histOpen,
    history,
    selectedHistoryEntryId,
    oldCard,
    histCard,
    activeHistoryEntry,
    historySnapshot,
    highlightMap,
    historyDetailLabel,
    historyBeforeLabel,
    pageLimit: HISTORY_PAGE_LIMIT,
    handleToggleHistory,
    handleHistorySelect,
    selectHistoryCard,
    setOldCard,
    setHistCard,
    setHistory,
    setSelectedHistoryEntryId,
    reset,
  };
}
