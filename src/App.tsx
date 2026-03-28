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
    <div style={{ width: "100%", height: "100vh", background: T.bg, fontFamily: T.f, color: T.text, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      {/* Full-screen gradient background — sits behind everything including sidebar/drawers */}
      <DotGrid />
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative", zIndex: 1 }}>
        {/* Sidebar */}
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

        {/* Main */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {plan && (
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
          )}

          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            {!plan ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 12, color: T.ter, textAlign: "center" }}>{conn ? "Select a plan or create a new one" : "Waiting for MCP..."}</div>
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
              <div style={{ padding: 16, overflow: "auto", height: "100%" }}>
                <div style={{ maxWidth: 440, margin: "0 auto" }}>
                  {sortedSteps.map(s => (
                    <div key={s.id} onClick={() => selectCard(s.id)}
                      style={{ background: T.surface, backdropFilter: "blur(12px)", border: `1.5px solid ${sId === s.id ? T.accent : T.borderGlass}`, borderRadius: 8, padding: "11px 13px", cursor: "default", fontFamily: T.f, display: "flex", flexDirection: "column", gap: 5, marginBottom: 6 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>{s.title}</div>
                      <div style={{ fontSize: 10.5, color: T.sec, lineHeight: 1.5, maxHeight: 40, overflow: "hidden" }}>{s.description.slice(0, 150)}</div>
                      <div style={{ fontSize: 9, color: T.ter, fontFamily: T.m }}>{s.repo}</div>
                    </div>
                  ))}
                  {steps.length === 0 && (
                    <div style={{ textAlign: "center", padding: 40, color: T.ter, fontSize: 12 }}>
                      <div>No cards yet</div>
                      <button onClick={() => setNewCardModal(true)} style={{ marginTop: 12, background: T.accent, border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 11, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Add Card</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Old card drawer (history) */}
        {histOpen && oldCard && (
          <div style={{ position: "fixed", top: 0, right: 320, width: 320, height: "100vh", background: "rgba(26,26,26,0.8)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderLeft: `0.5px solid ${T.borderGlass}`, zIndex: 51, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <DetailDrawer card={oldCard} feedbacks={st.feedbacks} onClose={() => setOldCard(null)}
              onAddFeedback={async () => {}} onDeleteFeedback={async () => {}}
              planTitle="Old Version" planId="" onFileClick={onFileClick}
              allCards={steps} onSelectCard={() => {}} readOnly />
          </div>
        )}

        {/* Right drawer */}
        {(histOpen || (!histOpen && sId && ss)) && (
          <div style={{ position: "fixed", top: 0, right: 0, width: 320, height: "100vh", background: "rgba(26,26,26,0.8)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderLeft: `0.5px solid ${T.borderGlass}`, zIndex: 50, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
      </div>

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
        <div className="toast-enter" style={{ position: "fixed", bottom: 20, right: 20, background: T.surfaceSolid, border: `1px solid ${toast.error ? T.red : T.border}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, zIndex: 1100, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", maxWidth: 320 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: toast.error ? T.red : T.text }}>{toast.text}</div>
            {toast.file && <div style={{ fontSize: 10, color: T.sec, fontFamily: T.m }}>{toast.file}</div>}
          </div>
          <button onClick={() => setToast(null)} style={{ background: "none", border: "none", color: T.ter, cursor: "pointer", fontSize: 12, padding: "2px 4px" }}>{"\u2715"}</button>
        </div>
      )}
    </div>
  );
}
