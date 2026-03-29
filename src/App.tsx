import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { Card, Plan, Feedback, FileChange, HistoryEntry } from "./types";
import * as api from "./lib/api";
import { computeHistoryEntryDiff } from "./lib/diff";
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
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const [oldCard, setOldCard] = useState<Card | null>(null);
  const [histCard, setHistCard] = useState<Card | null>(null);
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
    setHistIdx(null);
    setOldCard(null);
    setHistCard(null);
  }, [activePlanId]);

  // Poll history
  useEffect(() => {
    if (!histOpen || !activePlanId) {
      setHistory([]);
      setHistIdx(null);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const h = await api.fetchHistory(activePlanId);
        if (alive) setHistory(h.entries || []);
      } catch {
        if (alive) setHistory([]);
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

  const highlightMap = useMemo<Record<string, "added" | "modified">>(() => {
    if (!histOpen || histIdx === null || histIdx >= history.length) return {};
    const diff = computeHistoryEntryDiff(histIdx > 0 ? history[histIdx - 1] : null, history[histIdx]);
    const m: Record<string, "added" | "modified"> = {};
    diff.added.forEach((c) => {
      m[c.id] = "added";
    });
    diff.modified.forEach((c) => {
      m[c.after.id] = "modified";
    });
    return m;
  }, [histOpen, histIdx, history]);

  const savedPositions = useMemo(
    () => (activePlanId && positions[activePlanId] ? positions[activePlanId] : EMPTY_PLAN_POSITIONS),
    [activePlanId, positions],
  );

  const onFileClick = useCallback(
    (path: string, change: FileChange, cardId?: string) =>
      setCodeViewer({ path, change, cardId: cardId || selectedCardIdRef.current || "" }),
    [],
  );

  const selectCard = useCallback((id: string | null) => {
    setSelectedCardId(id);
    setHistOpen(false);
    setHistIdx(null);
    if (!id) setOldCard(null);
  }, []);

  const onPositionsChange = useCallback(
    (positions: Record<string, { x: number; y: number }>) => {
      const currentPlanId = activePlanIdRef.current;
      if (!currentPlanId) return;
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

  const handleToggleHistory = useCallback(() => {
    setHistOpen((h) => !h);
    setSelectedCardId(null);
    setHistIdx(null);
    setOldCard(null);
  }, []);

  const handleHistorySelect = useCallback(
    (idx: number | null) => {
      setHistIdx(idx);
      setOldCard(null);
      setHistCard(null);
      if (idx === null) return;
      const currentEntry = history[idx];
      const prevEntry = idx > 0 ? history[idx - 1] : null;
      const diff = computeHistoryEntryDiff(prevEntry, currentEntry);

      const firstCurrentCardId = diff.modified[0]?.after.id ?? diff.added[0]?.id ?? null;
      if (firstCurrentCardId && steps.find((step) => step.id === firstCurrentCardId)) {
        setSelectedCardId(firstCurrentCardId);
      }
    },
    [history, steps],
  );
  const handleEditCard = useCallback((cardId: string) => setSelectedCardId(cardId), []);

  const handleDeleteCard = useCallback(async (cardId: string) => {
    const currentAId = activePlanIdRef.current;
    if (!currentAId) return;
    setPlans((prev) =>
      prev.map((p) =>
        p.id !== currentAId
          ? p
          : {
              ...p,
              steps: p.steps
                .filter((s) => s.id !== cardId)
                .map((s) =>
                  s.dependencies.includes(cardId)
                    ? { ...s, dependencies: s.dependencies.filter((dep) => dep !== cardId) }
                    : s,
                ),
            },
      ),
    );
    setPositions((prev) => {
      const planPositions = prev[currentAId];
      if (!planPositions || !planPositions[cardId]) return prev;
      const { [cardId]: _removed, ...rest } = planPositions;
      return { ...prev, [currentAId]: rest };
    });
    setFeedbacks((prev) => prev.filter((feedback) => feedback.cardId !== cardId));
    if (selectedCardIdRef.current === cardId) setSelectedCardId(null);
    try {
      await api.deleteCard(currentAId, cardId);
    } catch {}
  }, []);

  const handleConnectCards = useCallback(async (sourceId: string, targetId: string) => {
    const currentAId = activePlanIdRef.current;
    if (!currentAId) return;
    let newDeps: string[] = [];
    setPlans((prev) =>
      prev.map((p) =>
        p.id !== currentAId
          ? p
          : {
              ...p,
              steps: p.steps.map((s) => {
                if (s.id !== targetId) return s;
                newDeps = [...new Set([...s.dependencies, sourceId])];
                return { ...s, dependencies: newDeps };
              }),
            },
      ),
    );
    try {
      await api.updateCard(currentAId, targetId, { dependencies: newDeps });
    } catch {}
  }, []);

  const handleDisconnectCards = useCallback(async (sourceId: string, targetId: string) => {
    const currentAId = activePlanIdRef.current;
    if (!currentAId) return;
    let newDeps: string[] = [];
    setPlans((prev) =>
      prev.map((p) =>
        p.id !== currentAId
          ? p
          : {
              ...p,
              steps: p.steps.map((s) => {
                if (s.id !== targetId) return s;
                newDeps = s.dependencies.filter((d) => d !== sourceId);
                return { ...s, dependencies: newDeps };
              }),
            },
      ),
    );
    try {
      await api.updateCard(currentAId, targetId, { dependencies: newDeps });
    } catch {}
  }, []);

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
              cards={steps}
              onSelectCard={selectCard}
              feedbackCounts={feedbackCountMap}
              feedbackTypes={feedbackTypeMap}
              planTitle={plan.title}
              planId={plan.id}
              onFileClick={onFileClick}
              highlightMap={highlightMap}
              savedPositions={savedPositions}
              onPositionsChange={onPositionsChange}
              onAddCard={handleNewCard}
              onEditCard={handleEditCard}
              onDeleteCard={handleDeleteCard}
              onConnectCards={handleConnectCards}
            onDisconnectCards={handleDisconnectCards}
            onExportSvgReady={handleExportSvgReady}
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
            planTitle={plan.title}
            planId={plan.id}
          />
        </div>
      )}

      {histOpen && oldCard && (
        <div
          className="fixed border border-white/8 bg-[rgba(32,33,36,0.72)] backdrop-blur-[20px] rounded-2xl z-[51] flex flex-col overflow-hidden animate-drawer-in"
          style={{
            top: "var(--spacing-fp-gap)",
            bottom: "var(--spacing-fp-gap)",
            right: "calc(var(--spacing-fp-history) + var(--spacing-fp-gap) + var(--spacing-fp-gap))",
            width: "var(--spacing-fp-drawer)",
          }}
        >
          <DetailDrawer
            card={oldCard}
            feedbacks={feedbacks.filter((f) => f.cardId === oldCard.id)}
            onClose={() => setOldCard(null)}
            onAddFeedback={async () => {}}
            onDeleteFeedback={async () => {}}
            planTitle="Old Version"
            planId=""
            onFileClick={onFileClick}
            allCards={steps}
            onSelectCard={() => {}}
            readOnly
          />
        </div>
      )}

      {(histOpen || histCard || (selectedCardId && selectedCard)) && (
        <div
          className={`fixed border border-white/8 bg-[rgba(32,33,36,0.72)] backdrop-blur-[20px] rounded-2xl z-50 flex flex-col overflow-hidden animate-drawer-in ${histOpen && !histCard ? "w-[var(--spacing-fp-history)]" : "w-[var(--spacing-fp-drawer)]"}`}
          style={{ top: "var(--spacing-fp-gap)", bottom: "var(--spacing-fp-gap)", right: "var(--spacing-fp-gap)" }}
        >
          {histCard ? (
            <DetailDrawer
              card={histCard}
              feedbacks={[]}
              onClose={() => setHistCard(null)}
              readOnly
              onAddFeedback={() => {}}
              onDeleteFeedback={() => {}}
              planTitle={plan?.title || ""}
              planId={plan?.id || ""}
              onFileClick={onFileClick}
              allCards={histCard ? [histCard] : []}
              onSelectCard={() => {}}
            />
          ) : histOpen ? (
            <HistoryPanel
              entries={history}
              selectedIdx={histIdx}
              onSelect={handleHistorySelect}
              onCardClick={(card) => {
                setSelectedCardId(null);
                setHistCard(null);
                setOldCard(card);
              }}
              onClose={() => {
                setHistOpen(false);
                setHistIdx(null);
                setOldCard(null);
              }}
              onClear={async () => {
                if (activePlanId) {
                  await api.clearHistory(activePlanId);
                  setHistory([]);
                  setHistIdx(null);
                  setOldCard(null);
                }
              }}
            />
          ) : selectedCard ? (
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
          ) : null}
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
          onCreated={(id) => {
            setSelectedCardId(id);
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
