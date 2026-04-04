import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { Card, Plan, Feedback, FileChange } from "./types";
import * as api from "./lib/api";
import useEscapeClose from "./hooks/useEscapeClose";
import { useToast } from "./hooks/useToast";
import { useHistory } from "./hooks/useHistory";
import { useUndoRedo, type UiUndoAction, type UndoStackBehavior } from "./hooks/useUndoRedo";
import { usePlanPolling } from "./hooks/usePlanPolling";
import { useCollaboration } from "./hooks/useCollaboration";
import { usePlanMutations } from "./hooks/usePlanMutations";
import {
  arePositionsEqual,
  buildPlanSignature,
  buildSharedSnapshotSignature,
  feedbacksForPlan,
  cloneValue,
  EMPTY_PLAN_POSITIONS,
  EMPTY_FEEDBACK_COUNTS,
  EMPTY_FEEDBACK_TYPES,
  type PlanPositions,
} from "./lib/planUtils";

import Sidebar from "./components/Sidebar";
import Toolbar from "./components/Toolbar";
import FlowCanvas from "./components/FlowCanvas";
import DetailDrawer from "./components/DetailDrawer";
import HistoryPanel from "./components/HistoryPanel";
import CodeViewer from "./components/CodeViewer";
import NewPlanModal from "./components/NewPlanModal";
import NewCardModal from "./components/NewCardModal";
import SettingsModal from "./components/SettingsModal";
import ConnectPlanModal from "./components/ConnectPlanModal";
import CollabCursorLayer from "./components/CollabCursorLayer";
import PresenceBar from "./components/PresenceBar";
import RejoinPromptModal from "./components/RejoinPromptModal";
import DialogModal from "./components/DialogModal";
import ToastNotification from "./components/ToastNotification";

const EMPTY_STEPS: Card[] = [];

export default function App() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [positions, setPositions] = useState<Record<string, PlanPositions>>({});
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [codeViewer, setCodeViewer] = useState<{ path: string; change: FileChange; cardId: string } | null>(null);
  const [newPlanModal, setNewPlanModal] = useState(false);
  const [newCardModal, setNewCardModal] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const exportSvgRef = useRef<(() => Promise<Blob | null>) | null>(null);

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
  const collabRevisionsRef = useRef<Record<string, number>>({});

  const { toast, dialog, showToast, showCollabDialog, dismissToast, dismissDialog } = useToast();

  useEffect(() => {
    const prevent = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", prevent);
    return () => document.removeEventListener("contextmenu", prevent);
  }, []);

  const apiBaseForPlan = useCallback((_planId: string | null | undefined) => api.LOCAL_API_BASE, []);
  const sessionIdForPlan = useCallback((_planId: string | null | undefined) => undefined, []);

  const invalidateUndoRedoRef = useRef<(planId: string | null | undefined, plan: Plan | null, positions: PlanPositions) => void>(() => {});
  const markPendingRef = useRef<(planId: string, nextPlan: Plan, nextPositions: PlanPositions) => void>(() => {});
  const clearPendingRef = useRef<(planId: string, expectedSignature?: string | null) => void>(() => {});

  const collab = useCollaboration({
    activePlanIdRef, plansRef, feedbacksRef, positionsRef,
    setPlans, setFeedbacks, setPositions, setActivePlanId,
    showToast, showCollabDialog,
    invalidateUndoRedoIfExternalPlanChangeRef: invalidateUndoRedoRef,
    collabRevisionsRef,
  });

  const plan = useMemo(() => plans.find((p) => p.id === activePlanId) ?? null, [plans, activePlanId]);
  const steps = plan?.steps ?? EMPTY_STEPS;
  const selectedCard = useMemo(() => steps.find((s) => s.id === selectedCardId) ?? null, [steps, selectedCardId]);
  const savedPositions = useMemo(
    () => (activePlanId && positions[activePlanId] ? positions[activePlanId] : EMPTY_PLAN_POSITIONS),
    [activePlanId, positions],
  );
  const currentPlanFeedbacks = useMemo(() => feedbacksForPlan(plan, feedbacks), [feedbacks, plan]);
  const historyHook = useHistory(activePlanId, apiBaseForPlan(activePlanId));

  const applyLocalPlanSnapshot = useCallback(
    (planId: string, nextPlan: Plan, nextPositions: PlanPositions, nextSelectedCardId: string | null, stackBehavior: UndoStackBehavior = "ignore") => {
      if (stackBehavior === "preserve") undoRedoHook.markPreservingSignature(nextPlan, nextPositions);
      else if (stackBehavior === "invalidate") undoRedoHook.invalidateUndoRedoStacks();
      setPlans((prev) => prev.map((c) => (c.id === planId ? nextPlan : c)));
      setPositions((prev) => {
        const prevPlanPositions = prev[planId] ?? EMPTY_PLAN_POSITIONS;
        if (arePositionsEqual(prevPlanPositions, nextPositions)) return prev;
        return { ...prev, [planId]: nextPositions };
      });
      setSelectedCardId(nextSelectedCardId);
      collab.syncLocalSnapshotToCollab(planId, nextPlan, nextPositions);
    },
    [collab],
  );

  const undoRedoHook = useUndoRedo({
    plansRef, positionsRef,
    collabSessionsRef: collab.collabSessionsRef as any,
    collabRevisionsRef, apiBaseForPlan, sessionIdForPlan,
    currentActorId: collab.currentActorId, currentActorAvatarSeed: collab.currentActorAvatarSeed,
    showToast, historySnapshot: historyHook.historySnapshot, applyLocalPlanSnapshot,
    syncLocalSnapshotToCollab: collab.syncLocalSnapshotToCollab,
    markPendingPlanMutationRef: markPendingRef,
    clearPendingPlanMutationRef: clearPendingRef,
  });

  invalidateUndoRedoRef.current = undoRedoHook.invalidateUndoRedoIfExternalPlanChange;

  const markPendingPlanMutation = useCallback((planId: string, nextPlan: Plan, nextPositions: PlanPositions) => {
    const signature = buildPlanSignature(nextPlan, nextPositions);
    if (signature) undoRedoHook.pendingPlanMutationSignaturesRef.current[planId] = signature;
  }, [undoRedoHook.pendingPlanMutationSignaturesRef]);

  const clearPendingPlanMutation = useCallback((planId: string, expectedSignature?: string | null) => {
    const sig = undoRedoHook.pendingPlanMutationSignaturesRef.current[planId];
    if (!sig) return;
    if (expectedSignature && sig !== expectedSignature) return;
    delete undoRedoHook.pendingPlanMutationSignaturesRef.current[planId];
  }, [undoRedoHook.pendingPlanMutationSignaturesRef]);

  markPendingRef.current = markPendingPlanMutation;
  clearPendingRef.current = clearPendingPlanMutation;

  const mutations = usePlanMutations({
    activePlanIdRef, selectedCardIdRef, plansRef, feedbacksRef, positionsRef,
    setPlans, setFeedbacks, setPositions, setActivePlanId, setSelectedCardId,
    apiBaseForPlan, sessionIdForPlan,
    currentActorId: collab.currentActorId, currentActorAvatarSeed: collab.currentActorAvatarSeed,
    showToast, applyLocalPlanSnapshot, markPendingPlanMutation, clearPendingPlanMutation,
    invalidateUndoRedoStacks: undoRedoHook.invalidateUndoRedoStacks,
    buildUndoGuardContext: undoRedoHook.buildUndoGuardContext,
    pushUndoAction: undoRedoHook.pushUndoAction,
    setUndoStack: undoRedoHook.setUndoStack,
    syncLocalSnapshotToCollab: collab.syncLocalSnapshotToCollab,
    destroyCollabRoom: collab.destroyCollabRoom,
    setCollabSessions: collab.setCollabSessions,
    profile: collab.profile,
  });

  const { connected } = usePlanPolling({
    activePlanIdRef, plansRef, positionsRef,
    pendingPlanMutationSignaturesRef: undoRedoHook.pendingPlanMutationSignaturesRef,
    getCollabSessionForPlanId: collab.getCollabSessionForPlanId,
    getCollabSnapshots: collab.getCollabSnapshots,
    invalidateUndoRedoIfExternalPlanChange: undoRedoHook.invalidateUndoRedoIfExternalPlanChange,
    setPlans, setFeedbacks, setPositions, setActivePlanId,
  });

  useEffect(() => { setSelectedCardId(null); historyHook.reset(); undoRedoHook.resetStacks(); }, [activePlanId]);
  useEffect(() => { undoRedoHook.trackSignature(plan, savedPositions); }, [plan, savedPositions]);
  useEscapeClose(() => collab.setRejoinPrompt(null), !!collab.rejoinPrompt);

  const collabSessionList = useMemo(() => Object.values(collab.collabSessions), [collab.collabSessions]);
  const collabStatusByPlan = useMemo(
    () => collabSessionList.reduce<Record<string, "hosting" | "joined">>((acc, s) => { if (s.planId) acc[s.planId] = s.status; return acc; }, {}),
    [collabSessionList],
  );
  const collabSessionForPlan = useMemo(() => (plan ? collabSessionList.find((s) => s.planId === plan.id) ?? null : null), [collabSessionList, plan]);
  const collabTransportForPlan = useMemo(() => (collabSessionForPlan ? collab.collabTransportStates[collabSessionForPlan.roomId] ?? null : null), [collabSessionForPlan, collab.collabTransportStates]);
  const pendingCollabSession = useMemo(() => collabSessionList.find((s) => !s.planId) ?? null, [collabSessionList]);
  const connectModalSession = collabSessionForPlan ?? pendingCollabSession;

  const activeUsers = useMemo(() => {
    if (!plan) return [];
    if (collabSessionForPlan) return collabSessionForPlan.participants;
    return [{ sessionId: `local-${collab.profile.userId}`, userId: collab.profile.userId, username: collab.profile.username, avatarSeed: collab.profile.avatarSeed, isSelf: true, status: "active" as const }];
  }, [collabSessionForPlan, plan, collab.profile]);

  const activeCollabCursors = useMemo(() => {
    if (!collabSessionForPlan) return [];
    const roomCursors = collab.cursorPresences[collabSessionForPlan.roomId] ?? {};
    return collabSessionForPlan.participants
      .filter((p) => !p.isSelf)
      .map((p) => { const c = roomCursors[p.sessionId]; return c?.active ? { sessionId: p.sessionId, username: p.username, avatarSeed: p.avatarSeed, x: c.x, y: c.y, lastUpdated: c.lastUpdated } : null; })
      .filter((c): c is NonNullable<typeof c> => !!c)
      .sort((a, b) => a.lastUpdated - b.lastUpdated)
      .map(({ lastUpdated: _, ...c }) => c);
  }, [collabSessionForPlan, collab.cursorPresences]);

  const [feedbackCountMap, feedbackTypeMap] = useMemo(() => {
    const counts: Record<string, number> = {};
    const types: Record<string, string[]> = {};
    feedbacks.forEach((f) => { counts[f.cardId] = (counts[f.cardId] || 0) + 1; if (!types[f.cardId]) types[f.cardId] = []; if (!types[f.cardId].includes(f.type)) types[f.cardId].push(f.type); });
    return [counts, types] as const;
  }, [feedbacks]);

  const collabPlanSignature = useMemo(
    () => collabSessionForPlan && plan ? buildSharedSnapshotSignature({ plan, positions: savedPositions, feedbacks: currentPlanFeedbacks }) : null,
    [collabSessionForPlan, currentPlanFeedbacks, plan, savedPositions],
  );

  useEffect(() => {
    if (!collabSessionForPlan || !plan || !collabPlanSignature) return;
    const roomId = collabSessionForPlan.roomId;
    if (collab.collabSyncRefs.applyingPeerSnapshotRoomsRef.current[roomId]) return;
    if (collab.collabSyncRefs.lastPeerSnapshotSignaturesRef.current[roomId] === collabPlanSignature) return;
    if (collab.collabSyncRefs.lastLocalCollabSyncSignaturesRef.current[roomId] === collabPlanSignature) {
      delete collab.collabSyncRefs.lastLocalCollabSyncSignaturesRef.current[roomId];
      return;
    }
    const snapshot = { plan: cloneValue(plan), positions: cloneValue(savedPositions), feedbacks: cloneValue(currentPlanFeedbacks) };
    collab.collabSyncRefs.lastPeerSnapshotSignaturesRef.current[roomId] = collabPlanSignature;
    collab.setCollabSessions((prev) => prev[roomId] ? { ...prev, [roomId]: { ...prev[roomId], planId: snapshot.plan.id, planTitle: snapshot.plan.title, snapshot } } : prev);
    collab.collabSyncRefs.collabDocsRef.current[roomId]?.syncFromSnapshot(snapshot, { kind: "local-ui" });
  }, [collabPlanSignature, collabSessionForPlan, currentPlanFeedbacks, plan, savedPositions, collab]);

  const selectCard = useCallback((id: string | null) => { setSelectedCardId(id); historyHook.reset(); }, [historyHook]);
  const onFileClick = useCallback((path: string, change: FileChange, cardId?: string) => setCodeViewer({ path, change, cardId: cardId || selectedCardIdRef.current || "" }), []);

  const exportJson = useCallback(() => {
    if (!plan) return;
    const fileName = `${plan.title.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase() || "flowplan"}.json`;
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Exported", `~/Downloads/${fileName}`);
  }, [plan, showToast]);

  const exportSvg = useCallback(async () => {
    if (!plan || !exportSvgRef.current) { showToast("SVG export failed", "", true); return; }
    try {
      const svgBlob = await exportSvgRef.current();
      if (!svgBlob) throw new Error("svg export failed");
      const fileName = `${plan.title.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase() || "flowplan"}.svg`;
      const url = URL.createObjectURL(svgBlob);
      const a = document.createElement("a"); a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Exported SVG", `~/Downloads/${fileName}`);
    } catch { showToast("SVG export failed", "", true); }
  }, [plan, showToast]);

  const canvasCards = historyHook.historySnapshot?.cards ?? steps;
  const canvasFeedbackCounts = historyHook.historySnapshot ? EMPTY_FEEDBACK_COUNTS : feedbackCountMap;
  const canvasFeedbackTypes = historyHook.historySnapshot ? EMPTY_FEEDBACK_TYPES : feedbackTypeMap;
  const canvasPositions = historyHook.historySnapshot?.positions ?? savedPositions;
  const canvasPlanTitle = historyHook.historySnapshot?.title ?? plan?.title ?? "";
  const canvasPlanId = historyHook.historySnapshot?.id ?? plan?.id ?? "";
  const canvasReadOnly = !!historyHook.historySnapshot;
  const canvasReadOnlyLabel = historyHook.historySnapshot && historyHook.activeHistoryEntry ? `History snapshot · r${historyHook.activeHistoryEntry.revision}` : undefined;
  const canToolbarUndo = !canvasReadOnly && !undoRedoHook.undoRedoBusy && undoRedoHook.isUndoActionSafe(undoRedoHook.undoStack[undoRedoHook.undoStack.length - 1]);
  const canToolbarRedo = !canvasReadOnly && !undoRedoHook.undoRedoBusy && undoRedoHook.isUndoActionSafe(undoRedoHook.redoStack[undoRedoHook.redoStack.length - 1]);
  const undoDisabledReason = !canvasReadOnly && !undoRedoHook.undoRedoBusy && undoRedoHook.undoStack.length > 0 && !canToolbarUndo ? "Remote changes invalidated your undo stack" : undefined;
  const redoDisabledReason = !canvasReadOnly && !undoRedoHook.undoRedoBusy && undoRedoHook.redoStack.length > 0 && !canToolbarRedo ? "Remote changes invalidated your undo stack" : undefined;
  const presenceRightOffset = historyHook.histOpen ? "calc(var(--spacing-fp-history) + var(--spacing-fp-gap) * 2)" : selectedCard ? "calc(var(--spacing-fp-drawer) + var(--spacing-fp-gap) * 2)" : "var(--spacing-fp-gap)";
  const presenceStatus = collabSessionForPlan ? collabSessionForPlan.status : "local" as const;

  return (
    <div className="w-full h-screen bg-fp-bg font-sans text-fp-text overflow-hidden relative">
      <div className="absolute inset-0 z-[1]">
        {!plan ? (
          <div className="flex items-center justify-center h-full flex-col gap-3">
            <div className="text-[13px] text-fp-dim text-center">{connected ? "Select a plan or create a new one" : "Waiting for MCP..."}</div>
          </div>
        ) : (
          <div className="absolute inset-0">
            <div className="absolute inset-0">
              <FlowCanvas
                cards={canvasCards}
                onSelectCard={canvasReadOnly ? historyHook.selectHistoryCard : selectCard}
                feedbackCounts={canvasFeedbackCounts}
                feedbackTypes={canvasFeedbackTypes}
                planTitle={canvasPlanTitle}
                planId={canvasPlanId}
                onFileClick={onFileClick}
                highlightMap={historyHook.highlightMap}
                savedPositions={canvasPositions}
                onPositionsChange={canvasReadOnly ? () => {} : mutations.onPositionsChange}
                onAddCard={() => setNewCardModal(true)}
                onEditCard={canvasReadOnly ? undefined : (cardId) => setSelectedCardId(cardId)}
                onDeleteCard={canvasReadOnly ? undefined : mutations.handleDeleteCard}
                onConnectCards={canvasReadOnly ? undefined : mutations.handleConnectCards}
                onDisconnectCards={canvasReadOnly ? undefined : mutations.handleDisconnectCards}
                onExportSvgReady={(exporter) => { exportSvgRef.current = exporter; }}
                readOnly={canvasReadOnly}
                readOnlyLabel={canvasReadOnlyLabel}
                onFrameChange={collab.setCanvasFrame}
                onViewportChange={collab.setCanvasViewport}
              />
            </div>
          </div>
        )}
      </div>

      <CollabCursorLayer cursors={activeCollabCursors} frame={collab.canvasFrame} viewport={collab.canvasViewport} />

      <div className="fixed z-10" style={{ top: "var(--spacing-fp-gap)", left: "var(--spacing-fp-gap)", bottom: "var(--spacing-fp-gap)" }}>
        <Sidebar
          plans={plans} activeId={activePlanId} onSelect={setActivePlanId}
          onDelete={mutations.handleDeletePlan} onTogglePin={mutations.handleTogglePin}
          onImport={mutations.importPlan} onNewPlan={() => setNewPlanModal(true)}
          onOpenSettings={() => setSettingsOpen(true)} connected={connected}
          onConnectPlan={() => setConnectModalOpen(true)}
          onDisconnectPlan={collabSessionForPlan ? () => void collab.handleDisconnectSession(collabSessionForPlan.roomId) : undefined}
          collabSession={collabSessionForPlan} collabTransportState={collabTransportForPlan}
          collabSessionCount={collabSessionList.length} collabStatusByPlan={collabStatusByPlan}
        />
      </div>

      {plan && (
        <div className="fixed z-10 flex justify-start" style={{ top: "var(--spacing-fp-gap)", left: "calc(var(--spacing-fp-sidebar) + var(--spacing-fp-gap) * 2)" }}>
          <Toolbar
            plan={plan} onToggleHistory={historyHook.handleToggleHistory} historyOpen={historyHook.histOpen}
            onExportSvg={exportSvg} onExportJson={exportJson} onAddCard={() => setNewCardModal(true)}
            canUndo={canToolbarUndo} canRedo={canToolbarRedo}
            onUndo={undoRedoHook.handleUndo} onRedo={undoRedoHook.handleRedo}
            undoDisabledReason={undoDisabledReason} redoDisabledReason={redoDisabledReason}
            planTitle={plan.title} planId={plan.id}
          />
        </div>
      )}

      {plan && <PresenceBar status={presenceStatus} roomId={collabSessionForPlan?.roomId} users={activeUsers} rightOffset={presenceRightOffset} />}

      {historyHook.histOpen && historyHook.oldCard && (
        <div className="fixed border border-white/8 bg-[rgba(32,33,36,0.58)] backdrop-blur-[28px] supports-[backdrop-filter]:backdrop-saturate-150 rounded-2xl z-[51] flex flex-col overflow-hidden animate-drawer-in" style={{ top: "var(--spacing-fp-gap)", bottom: "var(--spacing-fp-gap)", right: "calc(var(--spacing-fp-history) + var(--spacing-fp-drawer) + var(--spacing-fp-gap) * 3)", width: "var(--spacing-fp-drawer)" }}>
          <DetailDrawer card={historyHook.oldCard} feedbacks={[]} onClose={() => historyHook.setOldCard(null)} onAddFeedback={async () => {}} onDeleteFeedback={async () => {}} planTitle={historyHook.historyBeforeLabel} planId="" onFileClick={onFileClick} allCards={historyHook.historySnapshot?.cards ?? steps} onSelectCard={() => {}} readOnly />
        </div>
      )}

      {historyHook.histOpen && historyHook.histCard && (
        <div className="fixed border border-white/8 bg-[rgba(32,33,36,0.58)] backdrop-blur-[28px] supports-[backdrop-filter]:backdrop-saturate-150 rounded-2xl z-50 flex flex-col overflow-hidden animate-drawer-in w-[var(--spacing-fp-drawer)]" style={{ top: "var(--spacing-fp-gap)", bottom: "var(--spacing-fp-gap)", right: "calc(var(--spacing-fp-history) + var(--spacing-fp-gap) * 2)" }}>
          <DetailDrawer card={historyHook.histCard} feedbacks={[]} onClose={() => { historyHook.setHistCard(null); historyHook.setOldCard(null); }} readOnly onAddFeedback={() => {}} onDeleteFeedback={() => {}} planTitle={historyHook.historyDetailLabel} planId={historyHook.historySnapshot?.id || plan?.id || ""} onFileClick={onFileClick} allCards={historyHook.historySnapshot?.cards ?? [historyHook.histCard]} onSelectCard={() => {}} />
        </div>
      )}

      {historyHook.histOpen && (
        <div className="fixed border border-white/8 bg-[rgba(32,33,36,0.58)] backdrop-blur-[28px] supports-[backdrop-filter]:backdrop-saturate-150 rounded-2xl z-50 flex flex-col overflow-hidden animate-drawer-in w-[var(--spacing-fp-history)]" style={{ top: "var(--spacing-fp-gap)", bottom: "var(--spacing-fp-gap)", right: "var(--spacing-fp-gap)" }}>
          <HistoryPanel
            entries={historyHook.history} pageLimit={historyHook.pageLimit} selectedEntryId={historyHook.selectedHistoryEntryId} profile={collab.profile}
            onSelect={historyHook.handleHistorySelect}
            onCardClick={(change) => { setSelectedCardId(null); historyHook.setHistCard(change.after || change.before || null); historyHook.setOldCard(change.before && change.after ? change.before : null); }}
            onClose={() => historyHook.reset()}
            onClear={async () => { if (activePlanId) { await api.clearHistory(activePlanId, apiBaseForPlan(activePlanId), sessionIdForPlan(activePlanId)); historyHook.setHistory([]); historyHook.setSelectedHistoryEntryId(null); historyHook.setOldCard(null); historyHook.setHistCard(null); } }}
          />
        </div>
      )}

      {!historyHook.histOpen && selectedCard && (
        <div className="fixed border border-white/8 bg-[rgba(32,33,36,0.58)] backdrop-blur-[28px] supports-[backdrop-filter]:backdrop-saturate-150 rounded-2xl z-50 flex flex-col overflow-hidden animate-drawer-in w-[var(--spacing-fp-drawer)]" style={{ top: "var(--spacing-fp-gap)", bottom: "var(--spacing-fp-gap)", right: "var(--spacing-fp-gap)" }}>
          <DetailDrawer
            key={[selectedCard.id, selectedCard.title, selectedCard.description, selectedCard.type, selectedCard.repo, selectedCard.files.join("|"), selectedCard.dependencies.join("|")].join("::")}
            card={selectedCard} feedbacks={feedbacks.filter((f) => f.cardId === selectedCard.id)} onClose={() => setSelectedCardId(null)}
            onAddFeedback={(c, t, x) => mutations.handleAddFeedback(c, t, x, plan)}
            onDeleteFeedback={(id) => mutations.handleDeleteFeedback(id, plan)}
            planTitle={plan?.title || ""} planId={plan?.id || ""} onFileClick={onFileClick} allCards={steps}
            onSelectCard={(id) => setSelectedCardId(id)} onEditCard={mutations.handleEditCard}
          />
        </div>
      )}

      {codeViewer && (
        <CodeViewer
          key={`${codeViewer.cardId}:${codeViewer.path}`} path={codeViewer.path} change={codeViewer.change} onClose={() => setCodeViewer(null)}
          onSave={(filePath, newContent) => {
            if (!activePlanId || !codeViewer.cardId) throw new Error("Missing active plan");
            return mutations.handleSaveFileContent(activePlanId, codeViewer.cardId, filePath, newContent, codeViewer.change);
          }}
        />
      )}

      {newPlanModal && (
        <NewPlanModal actorId={collab.currentActorId} actorAvatarSeed={collab.currentActorAvatarSeed} onClose={() => setNewPlanModal(false)}
          onCreated={(newPlan) => { setPlans((prev) => [newPlan, ...prev]); setPositions((prev) => ({ ...prev, [newPlan.id]: EMPTY_PLAN_POSITIONS })); setActivePlanId(newPlan.id); setNewPlanModal(false); showToast("Plan created", newPlan.title); }}
        />
      )}

      {newCardModal && plan && (
        <NewCardModal planId={plan.id} existingCards={steps} apiBase={apiBaseForPlan(plan.id)} sessionId={sessionIdForPlan(plan.id)} actorId={collab.currentActorId} actorAvatarSeed={collab.currentActorAvatarSeed} onClose={() => setNewCardModal(false)}
          onCreated={(card) => { mutations.handleCardCreated(card, plan.id); setNewCardModal(false); }}
        />
      )}

      {settingsOpen && <SettingsModal profile={collab.profile} onClose={() => setSettingsOpen(false)} onSave={(p) => { collab.handleSaveProfile(p); setSettingsOpen(false); }} />}
      {connectModalOpen && <ConnectPlanModal plan={plan} session={connectModalSession} onClose={() => setConnectModalOpen(false)} onConnect={collab.handleStartCollabSession} busy={collab.collabBusy} />}
      {collab.rejoinPrompt && <RejoinPromptModal roomId={collab.rejoinPrompt.fork.roomId} planTitle={collab.rejoinPrompt.fork.planTitle} busy={collab.collabBusy} onSyncToHost={() => void collab.handleResolveForkAndJoin("discard")} onDuplicate={() => void collab.handleResolveForkAndJoin("duplicate")} onCancel={() => collab.setRejoinPrompt(null)} />}
      {dialog && <DialogModal title={dialog.title} message={dialog.message} onClose={dismissDialog} />}
      {toast && <ToastNotification text={toast.text} file={toast.file} error={toast.error} onDismiss={dismissToast} />}
    </div>
  );
}
