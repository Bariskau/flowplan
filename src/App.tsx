import { useState, useCallback, useEffect, useMemo } from "react";
import type { AppState, Card, Feedback, FileChange, HistoryEntry } from "./types";
import * as api from "./lib/api";
import { computeDiff } from "./lib/diff";
import { T } from "./lib/theme";

import Sidebar from "./components/Sidebar";
import Toolbar from "./components/Toolbar";
import FlowCanvas from "./components/FlowCanvas";
import DetailDrawer from "./components/DetailDrawer";
import HistoryPanel from "./components/HistoryPanel";
import CodeViewer from "./components/CodeViewer";
import NewPlanModal from "./components/NewPlanModal";
import NewCardModal from "./components/NewCardModal";
import DotGrid from "./components/DotGrid";

export default function App() {
  const [st, setSt] = useState<AppState>({ plans: [], feedbacks: [], positions: {} });
  const [aId, setAId] = useState<string | null>(null);
  const [sId, setSId] = useState<string | null>(null);
  const [vm, setVm] = useState<"flow" | "list">("flow");
  const [conn, setConn] = useState(false);
  const [cv, setCv] = useState<{ path: string; change: FileChange } | null>(null);
  const [histOpen, setHistOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const [oldCard, setOldCard] = useState<Card | null>(null);
  const [newPlanModal, setNewPlanModal] = useState(false);
  const [newCardModal, setNewCardModal] = useState(false);
  const [toast, setToast] = useState<{ text: string; file: string; error?: boolean } | null>(null);

  // Disable right-click
  useEffect(() => {
    const prevent = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", prevent);
    return () => document.removeEventListener("contextmenu", prevent);
  }, []);

  // Poll state
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const s = await api.fetchState();
        if (alive) {
          setSt(s);
          setConn(true);
          if (s.plans.length) {
            if (!aId || !s.plans.some(p => p.id === aId)) setAId(s.plans[0].id);
          } else {
            setAId(null);
          }
        }
      } catch {
        if (alive) setConn(false);
      }
    };
    poll();
    const iv = setInterval(poll, 1500);
    return () => { alive = false; clearInterval(iv); };
  }, [aId]);

  // Reset on plan change
  useEffect(() => {
    setSId(null);
    setHistOpen(false);
    setHistIdx(null);
    setOldCard(null);
  }, [aId]);

  // Poll history
  useEffect(() => {
    if (!histOpen || !aId) { setHistory([]); setHistIdx(null); return; }
    let alive = true;
    const load = async () => {
      try {
        const h = await api.fetchHistory(aId);
        if (alive) setHistory(h.entries || []);
      } catch { if (alive) setHistory([]); }
    };
    load();
    const iv = setInterval(load, 3000);
    return () => { alive = false; clearInterval(iv); };
  }, [histOpen, aId]);

  const plan = st.plans.find(p => p.id === aId);
  const steps = plan?.steps || [];
  const sortedSteps = useMemo(() => [...steps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [steps]);
  const ss = steps.find(s => s.id === sId);

  // Feedback counts/types per card
  const [fcm, ftm] = useMemo(() => {
    const counts: Record<string, number> = {};
    const types: Record<string, string[]> = {};
    st.feedbacks.forEach(f => {
      counts[f.cardId] = (counts[f.cardId] || 0) + 1;
      if (!types[f.cardId]) types[f.cardId] = [];
      if (!types[f.cardId].includes(f.type)) types[f.cardId].push(f.type);
    });
    return [counts, types] as const;
  }, [st.feedbacks]);

  // Feedback count per plan
  const fbp = useMemo(() => {
    const c2p: Record<string, string> = {};
    st.plans.forEach(p => p.steps.forEach(s => { c2p[s.id] = p.id; }));
    const m: Record<string, number> = {};
    st.feedbacks.forEach(f => { const pid = c2p[f.cardId]; if (pid) m[pid] = (m[pid] || 0) + 1; });
    return m;
  }, [st]);

  // Highlight map from history diff
  const hlMap = useMemo<Record<string, "added" | "modified">>(() => {
    if (!histOpen || histIdx === null || histIdx >= history.length) return {};
    const current = history[histIdx].cards;
    const prev = histIdx > 0 ? history[histIdx - 1].cards : [];
    const diff = computeDiff(prev, current);
    const m: Record<string, "added" | "modified"> = {};
    diff.added.forEach(c => { m[c.id] = "added"; });
    diff.modified.forEach(c => { m[c.after.id] = "modified"; });
    return m;
  }, [histOpen, histIdx, history]);

  const savedPositions = useMemo(() => aId && st.positions[aId] ? st.positions[aId] : {}, [aId, st.positions]);

  // Callbacks
  const onFileClick = useCallback((path: string, change: FileChange) => setCv({ path, change }), []);

  const selectCard = useCallback((id: string | null) => {
    setSId(id);
    if (id) { setHistOpen(false); setHistIdx(null); }
  }, []);

  const onPositionsChange = useCallback((positions: Record<string, { x: number; y: number }>) => {
    if (aId) api.savePositions(aId, positions).catch(() => {});
  }, [aId]);

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
        setAId(result.id);
        showToast("Imported", data.title);
      } catch {
        showToast("Could not import plan", file.name, true);
      }
    };
    input.click();
  }, []);

  const exportJson = useCallback(() => {
    if (!plan) return;
    const fileName = `${plan.title.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase() || "flowplan"}.json`;
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Exported", `~/Downloads/${fileName}`);
  }, [plan]);

  const exportSvg = useCallback(() => {
    // Simplified SVG export - just trigger JSON for now
    exportJson();
  }, [exportJson]);

  const showToast = (text: string, file: string, error = false) => {
    setToast({ text, file, error });
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="w-full h-screen bg-[#09090b] font-sans text-[#fafafa] overflow-hidden relative">

      {/* Layer 0: Full-screen gradient + dot grid background */}
      <DotGrid />

      {/* Layer 1: Full-window canvas (FlowCanvas or list view or empty state) */}
      <div className="absolute inset-0 z-[1]">
        {!plan ? (
          <div className="flex items-center justify-center h-full flex-col gap-3">
            <div className="text-[13px] text-[#71717a] text-center">{conn ? "Select a plan or create a new one" : "Waiting for MCP..."}</div>
          </div>
        ) : vm === "flow" ? (
          <FlowCanvas
            cards={steps}
            selectedId={sId}
            onSelectCard={selectCard}
            feedbackCounts={fcm}
            feedbackTypes={ftm}
            planTitle={plan.title}
            planId={plan.id}
            onFileClick={onFileClick}
            highlightMap={hlMap}
            savedPositions={savedPositions}
            onPositionsChange={onPositionsChange}
            onAddCard={() => setNewCardModal(true)}
          />
        ) : (
          <div className="pt-[60px] pr-4 pb-4 pl-[240px] overflow-auto h-full">
            <div className="max-w-[440px] mx-auto">
              {sortedSteps.map(s => (
                <div key={s.id} onClick={() => selectCard(s.id)}
                  className="bg-[rgba(255,255,255,0.03)] backdrop-blur-[16px] rounded-[10px] py-3 px-[14px] cursor-pointer flex flex-col gap-[5px] mb-2"
                  style={{ border: `1px solid ${sId === s.id ? T.accent : "rgba(255,255,255,0.06)"}` }}>
                  <div className="text-[13px] font-semibold text-[#fafafa]">{s.title}</div>
                  <div className="text-[11px] text-[#a1a1aa] leading-[1.5] max-h-[40px] overflow-hidden">{s.description.slice(0, 150)}</div>
                  <div className="text-[10px] text-[#71717a] font-mono">{s.repo}</div>
                </div>
              ))}
              {steps.length === 0 && (
                <div className="text-center p-10 text-[#71717a] text-xs">
                  <div>No cards yet</div>
                  <button onClick={() => setNewCardModal(true)} className="mt-3 bg-[rgba(16,185,129,0.15)] border border-[rgba(16,185,129,0.25)] rounded-lg py-[7px] px-4 text-xs font-medium text-[#34d399] cursor-pointer backdrop-blur-[12px]">Add Card</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Layer 2: Sidebar overlay (left, glassy) */}
      <div className="fixed top-0 left-0 h-screen z-10">
        <Sidebar
          plans={st.plans}
          activeId={aId}
          onSelect={setAId}
          onDelete={async (id) => {
            setSt(prev => ({ ...prev, plans: prev.plans.filter(p => p.id !== id) }));
            if (aId === id) setAId(null);
            api.deletePlan(id).catch(() => {});
          }}
          onTogglePin={async (id) => {
            setSt(prev => ({ ...prev, plans: prev.plans.map(p => p.id === id ? { ...p, pinned: !p.pinned } : p) }));
            api.togglePin(id).catch(() => {});
          }}
          onImport={importPlan}
          onNewPlan={() => setNewPlanModal(true)}
          connected={conn}
          feedbackPerPlan={fbp}
        />
      </div>

      {/* Layer 3: Toolbar overlay (top, glassy) */}
      {plan && (
        <div className="fixed top-0 left-[220px] right-0 z-10">
          <Toolbar
            plan={plan}
            viewMode={vm}
            onViewModeChange={setVm}
            onToggleHistory={() => { setHistOpen(h => !h); setSId(null); setHistIdx(null); setOldCard(null); }}
            historyOpen={histOpen}
            onExportSvg={exportSvg}
            onExportJson={exportJson}
            planTitle={plan.title}
            planId={plan.id}
          />
        </div>
      )}

        {/* Old card drawer (history) */}
        {histOpen && oldCard && (
          <div className="fixed top-0 right-[380px] w-[380px] h-screen bg-[rgba(255,255,255,0.03)] backdrop-blur-[40px] border-l border-[rgba(255,255,255,0.06)] z-[51] flex flex-col overflow-hidden">
            <DetailDrawer card={oldCard} feedbacks={st.feedbacks} onClose={() => setOldCard(null)}
              onAddFeedback={async () => {}} onDeleteFeedback={async () => {}}
              planTitle="Old Version" planId="" onFileClick={onFileClick}
              allCards={steps} onSelectCard={() => {}} readOnly />
          </div>
        )}

        {/* Right drawer */}
        {(histOpen || (!histOpen && sId && ss)) && (
          <div className="fixed top-0 right-0 w-[380px] h-screen bg-[rgba(255,255,255,0.03)] backdrop-blur-[40px] border-l border-[rgba(255,255,255,0.06)] z-50 flex flex-col overflow-hidden">
            {histOpen ? (
              <HistoryPanel entries={history} selectedIdx={histIdx}
                onSelect={(idx) => {
                  setHistIdx(idx);
                  setOldCard(null);
                  if (idx !== null && idx > 0) {
                    const current = history[idx].cards;
                    const prev = history[idx - 1];
                    const prevFull = prev.fullCards || [];
                    const prevCards = prev.cards;
                    for (const c of current) {
                      const p = prevCards.find(pc => pc.id === c.id);
                      if (p && (p.title !== c.title || p.type !== c.type || p.descriptionLen !== c.descriptionLen)) {
                        const old = prevFull.find(fc => fc.id === c.id);
                        if (old) setOldCard(old);
                        if (steps.find(s => s.id === c.id)) setSId(c.id);
                        break;
                      }
                    }
                  }
                }}
                onClose={() => { setHistOpen(false); setHistIdx(null); setOldCard(null); }}
                onClear={async () => { if (aId) { await api.clearHistory(aId); setHistory([]); setHistIdx(null); setOldCard(null); } }} />
            ) : ss ? (
              <DetailDrawer card={ss} feedbacks={st.feedbacks} onClose={() => setSId(null)}
                onAddFeedback={async (c, t, x) => { try { await api.addFeedback(c, t as any, x); } catch {} }}
                onDeleteFeedback={async (id) => { try { await api.deleteFeedback(id); } catch {} }}
                planTitle={plan?.title || ""} planId={plan?.id || ""} onFileClick={onFileClick}
                allCards={steps} onSelectCard={(id) => { setSId(id); }}
                onEditCard={async (pid, cid, updates) => { try { await api.updateCard(pid, cid, updates); } catch {} }} />
            ) : null}
          </div>
        )}

      {cv && <CodeViewer path={cv.path} change={cv.change} onClose={() => setCv(null)} />}

      {newPlanModal && (
        <NewPlanModal
          onClose={() => setNewPlanModal(false)}
          onCreated={(id) => { setAId(id); setNewPlanModal(false); showToast("Plan created", ""); }}
        />
      )}

      {newCardModal && plan && (
        <NewCardModal
          planId={plan.id}
          existingCards={steps}
          onClose={() => setNewCardModal(false)}
          onCreated={(id) => { setSId(id); setNewCardModal(false); showToast("Card added", ""); }}
        />
      )}

      {toast && (
        <div
          className="toast-enter fixed bottom-5 right-5 bg-[#18181b] rounded-[10px] py-[10px] px-[14px] flex items-center gap-[10px] z-[1100] shadow-[0_8px_24px_rgba(0,0,0,0.3)] max-w-[320px]"
          style={{ border: `1px solid ${toast.error ? T.red : T.border}` }}
        >
          <div className="flex-1">
            <div
              className="text-[11px] font-semibold"
              style={{ color: toast.error ? T.red : T.text }}
            >
              {toast.text}
            </div>
            {toast.file && <div className="text-[10px] text-[#a1a1aa] font-mono">{toast.file}</div>}
          </div>
          <button onClick={() => setToast(null)} className="bg-none border-none text-[#71717a] cursor-pointer text-xs py-[2px] px-1">{"\u2715"}</button>
        </div>
      )}
    </div>
  );
}
