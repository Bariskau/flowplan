import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { Card, Plan, Feedback, FileChange, HistoryEntry } from "./types";
import * as api from "./lib/api";
import { X } from "@phosphor-icons/react";

import Sidebar from "./components/Sidebar";
import Toolbar from "./components/Toolbar";
import FlowCanvas from "./components/FlowCanvas";
import DetailDrawer from "./components/DetailDrawer";
import HistoryPanel from "./components/HistoryPanel";
import CodeViewer from "./components/CodeViewer";
import NewPlanModal from "./components/NewPlanModal";
import NewCardModal from "./components/NewCardModal";
import Button from "./components/ui/Button";

const EMPTY_STEPS: Card[] = [];
const EMPTY_PLAN_POSITIONS: Record<string, { x: number; y: number }> = {};
const EMPTY_FEEDBACK_COUNTS: Record<string, number> = {};
const EMPTY_FEEDBACK_TYPES: Record<string, string[]> = {};
const HISTORY_PAGE_LIMIT = 100;

type PlanPositions = Record<string, { x: number; y: number }>;

type BaseUiUndoAction = {
  planId: string;
  beforePlan: Plan;
  afterPlan: Plan;
  beforePositions: PlanPositions;
  afterPositions: PlanPositions;
  beforeSelectedCardId: string | null;
  afterSelectedCardId: string | null;
};

type UiUndoAction =
  | (BaseUiUndoAction & {
      kind: "card_add";
      card: Card;
    })
  | (BaseUiUndoAction & {
      kind: "card_delete";
      card: Card;
      restoredDependencies: Array<{ cardId: string; dependencies: string[] }>;
    })
  | (BaseUiUndoAction & {
      kind: "dependency_add" | "dependency_remove";
      sourceId: string;
      targetId: string;
      beforeDependencies: string[];
      afterDependencies: string[];
    });

function arePositionsEqual(
  prev: Record<string, { x: number; y: number }>,
  next: Record<string, { x: number; y: number }>,
) {
  const prevIds = Object.keys(prev);
  const nextIds = Object.keys(next);
  if (prevIds.length !== nextIds.length) return false;
  return prevIds.every((id) => {
    const prevPos = prev[id];
    const nextPos = next[id];
    return !!nextPos && prevPos.x === nextPos.x && prevPos.y === nextPos.y;
  });
}

function mergePositions(
  prev: Record<string, Record<string, { x: number; y: number }>>,
  next: Record<string, Record<string, { x: number; y: number }>>,
) {
  const nextPlanIds = Object.keys(next);
  let changed = nextPlanIds.length !== Object.keys(prev).length;
  const merged: Record<string, Record<string, { x: number; y: number }>> = {};

  nextPlanIds.forEach((planId) => {
    const prevPlanPositions = prev[planId];
    const nextPlanPositions = next[planId] ?? EMPTY_PLAN_POSITIONS;
    if (prevPlanPositions && arePositionsEqual(prevPlanPositions, nextPlanPositions)) {
      merged[planId] = prevPlanPositions;
      return;
    }
    merged[planId] = nextPlanPositions;
    changed = true;
  });

  return changed ? merged : prev;
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function normalizePlan(plan: Plan | null) {
  if (!plan) return null;
  return {
    id: plan.id,
    title: plan.title,
    description: plan.description,
    createdAt: plan.createdAt,
    pinned: !!plan.pinned,
    steps: plan.steps.map((card) => ({
      id: card.id,
      title: card.title,
      description: card.description,
      type: card.type,
      repo: card.repo,
      files: [...card.files],
      dependencies: [...card.dependencies],
      order: card.order ?? 0,
      fileChanges: Object.keys(card.fileChanges ?? {})
        .sort()
        .map((path) => {
          const change = card.fileChanges?.[path];
          return [path, change ? { content: change.content, language: change.language, changeType: change.changeType } : null];
        }),
    })),
  };
}

function normalizePositions(positions: PlanPositions) {
  return Object.keys(positions)
    .sort()
    .map((id) => [id, { x: positions[id].x, y: positions[id].y }]);
}

function buildPlanSignature(plan: Plan | null, positions: PlanPositions) {
  if (!plan) return null;
  return JSON.stringify({
    plan: normalizePlan(plan),
    positions: normalizePositions(positions),
  });
}

function cardToAddPayload(card: Card) {
  return {
    id: card.id,
    title: card.title,
    description: card.description,
    type: card.type,
    repo: card.repo,
    files: card.files,
    dependencies: card.dependencies,
    fileChanges: card.fileChanges ?? {},
    order: card.order,
  };
}

function mergeUndoPositions(
  action: UiUndoAction,
  direction: "undo" | "redo",
  currentPositions: PlanPositions,
): PlanPositions {
  const nextPositions = cloneValue(currentPositions);

  switch (action.kind) {
    case "dependency_add":
    case "dependency_remove":
      return nextPositions;

    case "card_add":
      if (direction === "undo") {
        delete nextPositions[action.card.id];
        return nextPositions;
      }
      if (action.afterPositions[action.card.id]) {
        nextPositions[action.card.id] = cloneValue(action.afterPositions[action.card.id]);
      }
      return nextPositions;

    case "card_delete":
      if (direction === "undo") {
        const restoredPosition = action.beforePositions[action.card.id];
        if (restoredPosition) {
          nextPositions[action.card.id] = cloneValue(restoredPosition);
        }
        return nextPositions;
      }
      delete nextPositions[action.card.id];
      return nextPositions;
  }
}

export default function App() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [positions, setPositions] = useState<Record<string, Record<string, { x: number; y: number }>>>({});
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [codeViewer, setCodeViewer] = useState<{ path: string; change: FileChange; cardId: string } | null>(null);
  const [histOpen, setHistOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedHistoryEntryId, setSelectedHistoryEntryId] = useState<string | null>(null);
  const [oldCard, setOldCard] = useState<Card | null>(null);
  const [histCard, setHistCard] = useState<Card | null>(null);
  const [undoStack, setUndoStack] = useState<UiUndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UiUndoAction[]>([]);
  const [undoRedoBusy, setUndoRedoBusy] = useState(false);
  const [newPlanModal, setNewPlanModal] = useState(false);
  const [newCardModal, setNewCardModal] = useState(false);
  const [toast, setToast] = useState<{ text: string; file: string; error?: boolean } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const exportSvgRef = useRef<(() => Promise<Blob | null>) | null>(null);
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(null);

  // Listen for Tauri dialog events via CustomEvent
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.title || detail?.message) setDialog(detail);
    };
    window.addEventListener("fp-dialog", handler);
    return () => window.removeEventListener("fp-dialog", handler);
  }, []);

  // Disable right-click
  useEffect(() => {
    const prevent = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", prevent);
    return () => document.removeEventListener("contextmenu", prevent);
  }, []);

  const activePlanIdRef = useRef(activePlanId);
  activePlanIdRef.current = activePlanId;
  const selectedCardIdRef = useRef(selectedCardId);
  selectedCardIdRef.current = selectedCardId;
  const plansRef = useRef(plans);
  plansRef.current = plans;
  const feedbacksRef = useRef(feedbacks);
  feedbacksRef.current = feedbacks;
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const lastPlanSignatureRef = useRef<string | null>(null);
  const lastLocalPlanSignatureRef = useRef<string | null>(null);
  const undoStackRef = useRef<UiUndoAction[]>([]);
  const redoStackRef = useRef<UiUndoAction[]>([]);

  useEffect(() => {
    undoStackRef.current = undoStack;
  }, [undoStack]);

  useEffect(() => {
    redoStackRef.current = redoStack;
  }, [redoStack]);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const s = await api.fetchState();
        if (!alive) return;

        setPlans((prev) => {
          const prevMap = new Map(prev.map((p) => [p.id, p]));
          const merged = s.plans.map((nextPlan) => {
            const prevPlan = prevMap.get(nextPlan.id);
            return prevPlan && JSON.stringify(prevPlan) === JSON.stringify(nextPlan) ? prevPlan : nextPlan;
          });
          if (merged.length === prev.length && merged.every((plan, index) => plan === prev[index])) return prev;
          return merged;
        });

        setFeedbacks((prev) => (JSON.stringify(prev) === JSON.stringify(s.feedbacks) ? prev : s.feedbacks));
        setPositions((prev) => mergePositions(prev, s.positions));

        setConnected(true);
        const currentId = activePlanIdRef.current;
        if (s.plans.length) {
          if (!currentId || !s.plans.some((p) => p.id === currentId)) setActivePlanId(s.plans[0].id);
        } else {
          setActivePlanId(null);
        }
      } catch {
        if (alive) setConnected(false);
      }
    };
    poll();
    const iv = setInterval(poll, 1500);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  // Reset on plan change
  useEffect(() => {
    setSelectedCardId(null);
    setHistOpen(false);
    setSelectedHistoryEntryId(null);
    setOldCard(null);
    setHistCard(null);
    setUndoStack([]);
    setRedoStack([]);
    lastPlanSignatureRef.current = null;
    lastLocalPlanSignatureRef.current = null;
  }, [activePlanId]);

  // Poll history
  useEffect(() => {
    if (!histOpen || !activePlanId) {
      setHistory([]);
      setSelectedHistoryEntryId(null);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const h = await api.fetchHistory(activePlanId, { limit: HISTORY_PAGE_LIMIT });
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
  }, [histOpen, activePlanId]);

  const plan = useMemo(() => plans.find((p) => p.id === activePlanId) ?? null, [plans, activePlanId]);
  const steps = plan?.steps ?? EMPTY_STEPS;
  const selectedCard = useMemo(
    () => steps.find((s) => s.id === selectedCardId) ?? null,
    [steps, selectedCardId],
  );

  const [feedbackCountMap, feedbackTypeMap] = useMemo(() => {
    const counts: Record<string, number> = {};
    const types: Record<string, string[]> = {};
    feedbacks.forEach((f) => {
      counts[f.cardId] = (counts[f.cardId] || 0) + 1;
      if (!types[f.cardId]) types[f.cardId] = [];
      if (!types[f.cardId].includes(f.type)) types[f.cardId].push(f.type);
    });
    return [counts, types] as const;
  }, [feedbacks]);

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
      if (change.kind === "card_added") {
        m[cardId] = "added";
      } else if (change.kind === "card_updated") {
        m[cardId] = "modified";
      }
    });
    return m;
  }, [activeHistoryEntry]);

  const savedPositions = useMemo(
    () => (activePlanId && positions[activePlanId] ? positions[activePlanId] : EMPTY_PLAN_POSITIONS),
    [activePlanId, positions],
  );
  useEffect(() => {
    const signature = buildPlanSignature(plan, savedPositions);
    if (!signature) {
      lastPlanSignatureRef.current = null;
      return;
    }

    if (
      lastPlanSignatureRef.current &&
      signature !== lastPlanSignatureRef.current &&
      signature !== lastLocalPlanSignatureRef.current &&
      (undoStack.length > 0 || redoStack.length > 0)
    ) {
      setUndoStack([]);
      setRedoStack([]);
    }

    lastPlanSignatureRef.current = signature;
    if (signature === lastLocalPlanSignatureRef.current) {
      lastLocalPlanSignatureRef.current = null;
    }
  }, [plan, redoStack.length, savedPositions, undoStack.length]);

  const applyLocalPlanSnapshot = useCallback(
    (planId: string, nextPlan: Plan, nextPositions: PlanPositions, nextSelectedCardId: string | null) => {
      lastLocalPlanSignatureRef.current = buildPlanSignature(nextPlan, nextPositions);
      setPlans((prev) => prev.map((candidate) => (candidate.id === planId ? nextPlan : candidate)));
      setPositions((prev) => {
        const prevPlanPositions = prev[planId] ?? EMPTY_PLAN_POSITIONS;
        if (arePositionsEqual(prevPlanPositions, nextPositions)) return prev;
        return { ...prev, [planId]: nextPositions };
      });
      setSelectedCardId(nextSelectedCardId);
    },
    [],
  );

  const pushUndoAction = useCallback((action: UiUndoAction) => {
    setUndoStack((prev) => [...prev.slice(-9), action]);
    setRedoStack([]);
  }, []);

  const onFileClick = useCallback(
    (path: string, change: FileChange, cardId?: string) =>
      setCodeViewer({ path, change, cardId: cardId || selectedCardIdRef.current || "" }),
    [],
  );

  const selectCard = useCallback((id: string | null) => {
    setSelectedCardId(id);
    setHistOpen(false);
    setSelectedHistoryEntryId(null);
    if (!id) setOldCard(null);
  }, []);

  const selectHistoryCard = useCallback(
    (id: string | null) => {
      if (!historySnapshot) {
        setHistCard(null);
        return;
      }
      setSelectedCardId(null);
      setOldCard(null);
      setHistCard(id ? historySnapshot.cards.find((card) => card.id === id) ?? null : null);
    },
    [historySnapshot],
  );

  const onPositionsChange = useCallback(
    (positions: Record<string, { x: number; y: number }>) => {
      const currentPlanId = activePlanIdRef.current;
      if (!currentPlanId) return;
      const currentPlan = plansRef.current.find((candidate) => candidate.id === currentPlanId) ?? null;
      if (currentPlan) {
        lastLocalPlanSignatureRef.current = buildPlanSignature(currentPlan, positions);
      }
      setPositions((prev) => {
        const prevPlanPositions = prev[currentPlanId];
        if (prevPlanPositions && arePositionsEqual(prevPlanPositions, positions)) return prev;
        return { ...prev, [currentPlanId]: positions };
      });
      api.savePositions(currentPlanId, positions).catch(() => {});
    },
    [],
  );

  const importPlan = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.title || !Array.isArray(data.steps)) throw new Error("invalid");
        const result = await api.importPlan(data);
        if (!activePlanIdRef.current) setActivePlanId(result.id);
        showToast("Imported", data.title);
      } catch {
        showToast("Could not import plan", file.name, true);
      }
    };
    input.click();
  }, []);

  const showToast = useCallback((text: string, file: string, error = false) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ text, file, error });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const exportJson = useCallback(() => {
    if (!plan) return;
    const fileName = `${
      plan.title
        .replace(/[^a-zA-Z0-9-_ ]/g, "")
        .replace(/\s+/g, "-")
        .toLowerCase() || "flowplan"
    }.json`;
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Exported", `~/Downloads/${fileName}`);
  }, [plan]);

  const exportSvg = useCallback(async () => {
    if (!plan || !exportSvgRef.current) {
      showToast("SVG export failed", "", true);
      return;
    }
    try {
      const svgBlob = await exportSvgRef.current();
      if (!svgBlob) throw new Error("svg export failed");
      const a = document.createElement("a");
      const fileName = `${
        plan.title
          .replace(/[^a-zA-Z0-9-_ ]/g, "")
          .replace(/\s+/g, "-")
          .toLowerCase() || "flowplan"
      }.svg`;
      const url = URL.createObjectURL(svgBlob);
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Exported SVG", `~/Downloads/${fileName}`);
    } catch {
      showToast("SVG export failed", "", true);
    }
  }, [plan, showToast]);

  const handleExportSvgReady = useCallback((exporter: (() => Promise<Blob | null>) | null) => {
    exportSvgRef.current = exporter;
  }, []);

  const handleDeletePlan = useCallback(async (id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
    setActivePlanId((prev) => (prev === id ? null : prev));
    api.deletePlan(id).catch(() => {});
  }, []);

  const handleTogglePin = useCallback(async (id: string) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p)));
    api.togglePin(id).catch(() => {});
  }, []);

  const handleNewPlan = useCallback(() => setNewPlanModal(true), []);
  const handleNewCard = useCallback(() => setNewCardModal(true), []);

  const persistUndoableAction = useCallback(async (action: UiUndoAction, direction: "undo" | "redo") => {
    const source = direction;
    const currentPositions = cloneValue(positionsRef.current[action.planId] ?? EMPTY_PLAN_POSITIONS);
    const mergedPositions = mergeUndoPositions(action, direction, currentPositions);

    switch (action.kind) {
      case "card_add":
        if (direction === "undo") {
          await api.deleteCard(action.planId, action.card.id, source);
        } else {
          await api.addCard(action.planId, cardToAddPayload(action.card), source);
          if (!arePositionsEqual(currentPositions, mergedPositions)) {
            await api.savePositions(action.planId, mergedPositions);
          }
        }
        return;

      case "card_delete":
        if (direction === "undo") {
          await api.addCard(action.planId, cardToAddPayload(action.card), source);
          for (const dependencyRestore of action.restoredDependencies) {
            await api.updateCard(
              action.planId,
              dependencyRestore.cardId,
              { dependencies: dependencyRestore.dependencies },
              source,
            );
          }
          if (!arePositionsEqual(currentPositions, mergedPositions)) {
            await api.savePositions(action.planId, mergedPositions);
          }
        } else {
          await api.deleteCard(action.planId, action.card.id, source);
        }
        return;

      case "dependency_add":
      case "dependency_remove":
        await api.updateCard(
          action.planId,
          action.targetId,
          {
            dependencies: direction === "undo" ? action.beforeDependencies : action.afterDependencies,
          },
          source,
        );
        return;
    }
  }, []);

  const applyUndoableSnapshot = useCallback(
    (action: UiUndoAction, direction: "undo" | "redo") => {
      const nextPlan = cloneValue(direction === "undo" ? action.beforePlan : action.afterPlan);
      const currentPositions = cloneValue(positionsRef.current[action.planId] ?? EMPTY_PLAN_POSITIONS);
      const nextPositions = mergeUndoPositions(action, direction, currentPositions);
      const nextSelectedCardId = direction === "undo" ? action.beforeSelectedCardId : action.afterSelectedCardId;
      applyLocalPlanSnapshot(action.planId, nextPlan, nextPositions, nextSelectedCardId);
    },
    [applyLocalPlanSnapshot],
  );

  const handleUndo = useCallback(async () => {
    if (historySnapshot || undoRedoBusy) return;
    const action = undoStackRef.current[undoStackRef.current.length - 1];
    if (!action) return;
    setUndoRedoBusy(true);
    applyUndoableSnapshot(action, "undo");
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev.slice(-9), action]);
    try {
      await persistUndoableAction(action, "undo");
    } catch {
      applyUndoableSnapshot(action, "redo");
      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev.slice(-9), action]);
      showToast("Undo failed", action.kind.replace("_", " "), true);
    } finally {
      setUndoRedoBusy(false);
    }
  }, [applyUndoableSnapshot, historySnapshot, persistUndoableAction, showToast, undoRedoBusy]);

  const handleRedo = useCallback(async () => {
    if (historySnapshot || undoRedoBusy) return;
    const action = redoStackRef.current[redoStackRef.current.length - 1];
    if (!action) return;
    setUndoRedoBusy(true);
    applyUndoableSnapshot(action, "redo");
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev.slice(-9), action]);
    try {
      await persistUndoableAction(action, "redo");
    } catch {
      applyUndoableSnapshot(action, "undo");
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev.slice(-9), action]);
      showToast("Redo failed", action.kind.replace("_", " "), true);
    } finally {
      setUndoRedoBusy(false);
    }
  }, [applyUndoableSnapshot, historySnapshot, persistUndoableAction, showToast, undoRedoBusy]);

  const handleToggleHistory = useCallback(() => {
    setHistOpen((h) => !h);
    setSelectedCardId(null);
    setSelectedHistoryEntryId(null);
    setOldCard(null);
    setHistCard(null);
  }, []);

  const handleHistorySelect = useCallback(
    (entryId: string | null) => {
      setSelectedHistoryEntryId(entryId);
      setOldCard(null);
      setHistCard(null);
      setSelectedCardId(null);
      if (entryId === null) return;
    },
    [],
  );
  const handleEditCard = useCallback((cardId: string) => setSelectedCardId(cardId), []);

  const handleDeleteCard = useCallback(async (cardId: string) => {
    const currentAId = activePlanIdRef.current;
    if (!currentAId) return;

    const currentPlan = plansRef.current.find((candidate) => candidate.id === currentAId);
    if (!currentPlan) return;
    const removedCard = currentPlan.steps.find((card) => card.id === cardId);
    if (!removedCard) return;

    const beforePlan = cloneValue(currentPlan);
    const beforePositions = cloneValue(positionsRef.current[currentAId] ?? EMPTY_PLAN_POSITIONS);
    const afterPlan: Plan = {
      ...cloneValue(beforePlan),
      steps: beforePlan.steps
        .filter((card) => card.id !== cardId)
        .map((card) =>
          card.dependencies.includes(cardId)
            ? { ...card, dependencies: card.dependencies.filter((dependency) => dependency !== cardId) }
            : cloneValue(card),
        ),
    };
    const { [cardId]: _removedPosition, ...remainingPositions } = beforePositions;
    const afterPositions = remainingPositions;
    const removedFeedbacks = feedbacksRef.current.filter((feedback) => feedback.cardId === cardId);
    const action: UiUndoAction = {
      kind: "card_delete",
      planId: currentAId,
      card: cloneValue(removedCard),
      restoredDependencies: beforePlan.steps
        .filter((card) => card.dependencies.includes(cardId))
        .map((card) => ({ cardId: card.id, dependencies: cloneValue(card.dependencies) })),
      beforePlan,
      afterPlan,
      beforePositions,
      afterPositions,
      beforeSelectedCardId: selectedCardIdRef.current,
      afterSelectedCardId: selectedCardIdRef.current === cardId ? null : selectedCardIdRef.current,
    };

    applyLocalPlanSnapshot(currentAId, cloneValue(afterPlan), cloneValue(afterPositions), action.afterSelectedCardId);
    setFeedbacks((prev) => prev.filter((feedback) => feedback.cardId !== cardId));
    pushUndoAction(action);
    try {
      await api.deleteCard(currentAId, cardId);
    } catch {
      applyLocalPlanSnapshot(currentAId, cloneValue(beforePlan), cloneValue(beforePositions), action.beforeSelectedCardId);
      setFeedbacks((prev) => [...prev, ...removedFeedbacks]);
      setUndoStack((prev) => prev.slice(0, -1));
      showToast("Delete failed", removedCard.title, true);
    }
  }, [applyLocalPlanSnapshot, pushUndoAction, showToast]);

  const handleConnectCards = useCallback(async (sourceId: string, targetId: string) => {
    const currentAId = activePlanIdRef.current;
    if (!currentAId) return;
    const currentPlan = plansRef.current.find((candidate) => candidate.id === currentAId);
    if (!currentPlan) return;
    const targetCard = currentPlan.steps.find((card) => card.id === targetId);
    if (!targetCard || targetCard.dependencies.includes(sourceId)) return;

    const beforePlan = cloneValue(currentPlan);
    const beforePositions = cloneValue(positionsRef.current[currentAId] ?? EMPTY_PLAN_POSITIONS);
    const afterDependencies = [...new Set([...targetCard.dependencies, sourceId])];
    const afterPlan: Plan = {
      ...cloneValue(beforePlan),
      steps: beforePlan.steps.map((card) =>
        card.id === targetId ? { ...card, dependencies: cloneValue(afterDependencies) } : cloneValue(card),
      ),
    };
    const action: UiUndoAction = {
      kind: "dependency_add",
      planId: currentAId,
      sourceId,
      targetId,
      beforeDependencies: cloneValue(targetCard.dependencies),
      afterDependencies: cloneValue(afterDependencies),
      beforePlan,
      afterPlan,
      beforePositions,
      afterPositions: beforePositions,
      beforeSelectedCardId: selectedCardIdRef.current,
      afterSelectedCardId: selectedCardIdRef.current,
    };

    applyLocalPlanSnapshot(currentAId, cloneValue(afterPlan), cloneValue(beforePositions), action.afterSelectedCardId);
    pushUndoAction(action);
    try {
      await api.updateCard(currentAId, targetId, { dependencies: afterDependencies });
    } catch {
      applyLocalPlanSnapshot(currentAId, cloneValue(beforePlan), cloneValue(beforePositions), action.beforeSelectedCardId);
      setUndoStack((prev) => prev.slice(0, -1));
      showToast("Dependency add failed", targetCard.title, true);
    }
  }, [applyLocalPlanSnapshot, pushUndoAction, showToast]);

  const handleDisconnectCards = useCallback(async (sourceId: string, targetId: string) => {
    const currentAId = activePlanIdRef.current;
    if (!currentAId) return;
    const currentPlan = plansRef.current.find((candidate) => candidate.id === currentAId);
    if (!currentPlan) return;
    const targetCard = currentPlan.steps.find((card) => card.id === targetId);
    if (!targetCard || !targetCard.dependencies.includes(sourceId)) return;

    const beforePlan = cloneValue(currentPlan);
    const beforePositions = cloneValue(positionsRef.current[currentAId] ?? EMPTY_PLAN_POSITIONS);
    const afterDependencies = targetCard.dependencies.filter((dependency) => dependency !== sourceId);
    const afterPlan: Plan = {
      ...cloneValue(beforePlan),
      steps: beforePlan.steps.map((card) =>
        card.id === targetId ? { ...card, dependencies: cloneValue(afterDependencies) } : cloneValue(card),
      ),
    };
    const action: UiUndoAction = {
      kind: "dependency_remove",
      planId: currentAId,
      sourceId,
      targetId,
      beforeDependencies: cloneValue(targetCard.dependencies),
      afterDependencies: cloneValue(afterDependencies),
      beforePlan,
      afterPlan,
      beforePositions,
      afterPositions: beforePositions,
      beforeSelectedCardId: selectedCardIdRef.current,
      afterSelectedCardId: selectedCardIdRef.current,
    };

    applyLocalPlanSnapshot(currentAId, cloneValue(afterPlan), cloneValue(beforePositions), action.afterSelectedCardId);
    pushUndoAction(action);
    try {
      await api.updateCard(currentAId, targetId, { dependencies: afterDependencies });
    } catch {
      applyLocalPlanSnapshot(currentAId, cloneValue(beforePlan), cloneValue(beforePositions), action.beforeSelectedCardId);
      setUndoStack((prev) => prev.slice(0, -1));
      showToast("Dependency remove failed", targetCard.title, true);
    }
  }, [applyLocalPlanSnapshot, pushUndoAction, showToast]);

  const canvasCards = historySnapshot?.cards ?? steps;
  const canvasFeedbackCounts = historySnapshot ? EMPTY_FEEDBACK_COUNTS : feedbackCountMap;
  const canvasFeedbackTypes = historySnapshot ? EMPTY_FEEDBACK_TYPES : feedbackTypeMap;
  const canvasPositions = historySnapshot?.positions ?? savedPositions;
  const canvasPlanTitle = historySnapshot?.title ?? plan?.title ?? "";
  const canvasPlanId = historySnapshot?.id ?? plan?.id ?? "";
  const canvasReadOnly = !!historySnapshot;
  const canvasReadOnlyLabel =
    historySnapshot && activeHistoryEntry ? `History snapshot · r${activeHistoryEntry.revision}` : undefined;
  const historyDetailLabel =
    activeHistoryEntry ? `History change · r${activeHistoryEntry.revision}` : "History change";
  const historyBeforeLabel =
    activeHistoryEntry ? `History before · r${activeHistoryEntry.revision}` : "History before";
  const canToolbarUndo = !canvasReadOnly && !undoRedoBusy && undoStack.length > 0;
  const canToolbarRedo = !canvasReadOnly && !undoRedoBusy && redoStack.length > 0;

  return (
    <div className="w-full h-screen bg-fp-bg font-sans text-fp-text overflow-hidden relative">
      <div className="absolute inset-0 z-[1]">
        {!plan ? (
          <div className="flex items-center justify-center h-full flex-col gap-3">
            <div className="text-[13px] text-fp-dim text-center">
              {connected ? "Select a plan or create a new one" : "Waiting for MCP..."}
            </div>
          </div>
        ) : (
          <div className="absolute inset-0">
            <FlowCanvas
              cards={canvasCards}
              onSelectCard={canvasReadOnly ? selectHistoryCard : selectCard}
              feedbackCounts={canvasFeedbackCounts}
              feedbackTypes={canvasFeedbackTypes}
              planTitle={canvasPlanTitle}
              planId={canvasPlanId}
              onFileClick={onFileClick}
              highlightMap={highlightMap}
              savedPositions={canvasPositions}
              onPositionsChange={canvasReadOnly ? () => {} : onPositionsChange}
              onAddCard={handleNewCard}
              onEditCard={canvasReadOnly ? undefined : handleEditCard}
              onDeleteCard={canvasReadOnly ? undefined : handleDeleteCard}
              onConnectCards={canvasReadOnly ? undefined : handleConnectCards}
              onDisconnectCards={canvasReadOnly ? undefined : handleDisconnectCards}
              onExportSvgReady={handleExportSvgReady}
              readOnly={canvasReadOnly}
              readOnlyLabel={canvasReadOnlyLabel}
            />
          </div>
        )}
      </div>

      <div
        className="fixed z-10"
        style={{ top: "var(--spacing-fp-gap)", left: "var(--spacing-fp-gap)", bottom: "var(--spacing-fp-gap)" }}
      >
        <Sidebar
          plans={plans}
          activeId={activePlanId}
          onSelect={setActivePlanId}
          onDelete={handleDeletePlan}
          onTogglePin={handleTogglePin}
          onImport={importPlan}
          onNewPlan={handleNewPlan}
          connected={connected}
        />
      </div>

      {plan && (
        <div
          className="fixed z-10 flex justify-start"
          style={{ top: "var(--spacing-fp-gap)", left: "calc(var(--spacing-fp-sidebar) + var(--spacing-fp-gap) * 2)" }}
        >
          <Toolbar
            plan={plan}
            onToggleHistory={handleToggleHistory}
            historyOpen={histOpen}
            onExportSvg={exportSvg}
            onExportJson={exportJson}
            onAddCard={handleNewCard}
            canUndo={canToolbarUndo}
            canRedo={canToolbarRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            planTitle={plan.title}
            planId={plan.id}
          />
        </div>
      )}

      {histOpen && oldCard && (
        <div
          className="fixed border border-white/8 bg-[rgba(32,33,36,0.58)] backdrop-blur-[28px] supports-[backdrop-filter]:backdrop-saturate-150 rounded-2xl z-[51] flex flex-col overflow-hidden animate-drawer-in"
          style={{
            top: "var(--spacing-fp-gap)",
            bottom: "var(--spacing-fp-gap)",
            right: "calc(var(--spacing-fp-history) + var(--spacing-fp-drawer) + var(--spacing-fp-gap) * 3)",
            width: "var(--spacing-fp-drawer)",
          }}
        >
          <DetailDrawer
            card={oldCard}
            feedbacks={[]}
            onClose={() => setOldCard(null)}
            onAddFeedback={async () => {}}
            onDeleteFeedback={async () => {}}
            planTitle={historyBeforeLabel}
            planId=""
            onFileClick={onFileClick}
            allCards={historySnapshot?.cards ?? steps}
            onSelectCard={() => {}}
            readOnly
          />
        </div>
      )}

      {histOpen && histCard && (
        <div
          className="fixed border border-white/8 bg-[rgba(32,33,36,0.58)] backdrop-blur-[28px] supports-[backdrop-filter]:backdrop-saturate-150 rounded-2xl z-50 flex flex-col overflow-hidden animate-drawer-in w-[var(--spacing-fp-drawer)]"
          style={{
            top: "var(--spacing-fp-gap)",
            bottom: "var(--spacing-fp-gap)",
            right: "calc(var(--spacing-fp-history) + var(--spacing-fp-gap) * 2)",
          }}
        >
          <DetailDrawer
            card={histCard}
            feedbacks={[]}
            onClose={() => {
              setHistCard(null);
              setOldCard(null);
            }}
            readOnly
            onAddFeedback={() => {}}
            onDeleteFeedback={() => {}}
            planTitle={historyDetailLabel}
            planId={historySnapshot?.id || plan?.id || ""}
            onFileClick={onFileClick}
            allCards={historySnapshot?.cards ?? [histCard]}
            onSelectCard={() => {}}
          />
        </div>
      )}

      {histOpen && (
        <div
          className="fixed border border-white/8 bg-[rgba(32,33,36,0.58)] backdrop-blur-[28px] supports-[backdrop-filter]:backdrop-saturate-150 rounded-2xl z-50 flex flex-col overflow-hidden animate-drawer-in w-[var(--spacing-fp-history)]"
          style={{ top: "var(--spacing-fp-gap)", bottom: "var(--spacing-fp-gap)", right: "var(--spacing-fp-gap)" }}
        >
          <HistoryPanel
            entries={history}
            pageLimit={HISTORY_PAGE_LIMIT}
            selectedEntryId={selectedHistoryEntryId}
            onSelect={handleHistorySelect}
            onCardClick={(change) => {
              setSelectedCardId(null);
              setHistCard(change.after || change.before || null);
              setOldCard(change.before && change.after ? change.before : null);
            }}
            onClose={() => {
              setHistOpen(false);
              setSelectedHistoryEntryId(null);
              setOldCard(null);
              setHistCard(null);
            }}
            onClear={async () => {
              if (activePlanId) {
                await api.clearHistory(activePlanId);
                setHistory([]);
                setSelectedHistoryEntryId(null);
                setOldCard(null);
                setHistCard(null);
              }
            }}
          />
        </div>
      )}

      {!histOpen && selectedCard && (
        <div
          className="fixed border border-white/8 bg-[rgba(32,33,36,0.58)] backdrop-blur-[28px] supports-[backdrop-filter]:backdrop-saturate-150 rounded-2xl z-50 flex flex-col overflow-hidden animate-drawer-in w-[var(--spacing-fp-drawer)]"
          style={{ top: "var(--spacing-fp-gap)", bottom: "var(--spacing-fp-gap)", right: "var(--spacing-fp-gap)" }}
        >
          <DetailDrawer
            card={selectedCard}
            feedbacks={feedbacks.filter((f) => f.cardId === selectedCard.id)}
            onClose={() => setSelectedCardId(null)}
            onAddFeedback={async (c, t, x) => {
              try {
                await api.addFeedback(c, t as any, x);
              } catch {}
            }}
            onDeleteFeedback={async (id) => {
              try {
                await api.deleteFeedback(id);
              } catch {}
            }}
            planTitle={plan?.title || ""}
            planId={plan?.id || ""}
            onFileClick={onFileClick}
            allCards={steps}
            onSelectCard={(id) => {
              setSelectedCardId(id);
            }}
            onEditCard={async (pid, cid, updates) => {
              try {
                await api.updateCard(pid, cid, updates);
              } catch {}
            }}
          />
        </div>
      )}

      {codeViewer && (
        <CodeViewer
          path={codeViewer.path}
          change={codeViewer.change}
          onClose={() => setCodeViewer(null)}
          onSave={async (filePath, newContent) => {
            if (!activePlanId || !codeViewer.cardId) throw new Error("Missing active plan");
            const card = steps.find((s) => s.id === codeViewer.cardId);
            if (!card) throw new Error("Card not found");
            const updatedFileChanges = {
              ...card.fileChanges,
              [filePath]: { ...codeViewer.change, content: newContent },
            };
            try {
              await api.updateCard(activePlanId, codeViewer.cardId, { fileChanges: updatedFileChanges });
              showToast("Saved", filePath);
            } catch (error) {
              showToast("Save failed", filePath, true);
              throw error;
            }
          }}
        />
      )}

      {newPlanModal && (
        <NewPlanModal
          onClose={() => setNewPlanModal(false)}
          onCreated={(id) => {
            if (!activePlanIdRef.current) setActivePlanId(id);
            setNewPlanModal(false);
            showToast("Plan created", "");
          }}
        />
      )}

      {newCardModal && plan && (
        <NewCardModal
          planId={plan.id}
          existingCards={steps}
          onClose={() => setNewCardModal(false)}
          onCreated={(card) => {
            const currentPlan = plansRef.current.find((candidate) => candidate.id === plan.id);
            if (currentPlan) {
              const beforePlan = cloneValue(currentPlan);
              const beforePositions = cloneValue(positionsRef.current[plan.id] ?? EMPTY_PLAN_POSITIONS);
              const afterPlan: Plan = {
                ...cloneValue(beforePlan),
                steps: [...beforePlan.steps.map((step) => cloneValue(step)), cloneValue(card)],
              };
              const action: UiUndoAction = {
                kind: "card_add",
                planId: plan.id,
                card: cloneValue(card),
                beforePlan,
                afterPlan,
                beforePositions,
                afterPositions: beforePositions,
                beforeSelectedCardId: selectedCardIdRef.current,
                afterSelectedCardId: card.id,
              };
              applyLocalPlanSnapshot(plan.id, cloneValue(afterPlan), cloneValue(beforePositions), card.id);
              pushUndoAction(action);
            } else {
              setSelectedCardId(card.id);
            }
            setNewCardModal(false);
            showToast("Card added", "");
          }}
        />
      )}

      {dialog && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[1200] flex items-center justify-center animate-modal-overlay"
          onClick={() => setDialog(null)}
        >
          <div
            className="relative w-[380px] flex flex-col animate-modal-in rounded-xl overflow-hidden border border-white/[0.08] bg-[rgba(32,33,36,0.95)] p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h1 className="text-[16px] font-semibold text-fp-text mb-3">{dialog.title}</h1>
            <p className="text-[13px] text-white/50 leading-relaxed whitespace-pre-line mb-5">{dialog.message}</p>
            <Button variant="glassy" size="md" onClick={() => setDialog(null)} className="w-full">
              OK
            </Button>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`animate-toast fixed bottom-4 right-4 z-[1100] max-w-[300px] rounded-2xl border backdrop-blur-[20px] py-2.5 px-3.5 flex items-center gap-2.5 ${
            toast.error
              ? "bg-[rgba(234,67,53,0.08)] border-fp-danger/20 text-fp-danger"
              : "bg-[rgba(32,33,36,0.72)] border-white/8 text-white/80"
          }`}
        >
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium">{toast.text}</div>
            {toast.file && <div className="text-[10px] text-white/30 font-mono mt-0.5 truncate">{toast.file}</div>}
          </div>
          <button
            onClick={() => setToast(null)}
            className="shrink-0 bg-transparent border-none text-white/25 hover:text-white/50 cursor-pointer p-0 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
