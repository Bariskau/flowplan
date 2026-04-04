import { useState, useCallback, useEffect, useRef } from "react";
import type { Card, Plan, Feedback } from "../types";
import type { PlanPositions } from "../lib/planUtils";
import { arePositionsEqual, buildPlanSignature, cloneValue, EMPTY_PLAN_POSITIONS } from "../lib/planUtils";
import * as api from "../lib/api";

const UI_UNDO_STACK_LIMIT = 10;

type BaseUiUndoAction = {
  planId: string;
  beforePlan: Plan;
  afterPlan: Plan;
  beforePositions: PlanPositions;
  afterPositions: PlanPositions;
  beforeSelectedCardId: string | null;
  afterSelectedCardId: string | null;
  collabRoomId?: string | null;
  collabRevision?: number | null;
};

export type UiUndoAction =
  | (BaseUiUndoAction & { kind: "card_add"; card: Card })
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

export type UndoStackBehavior = "preserve" | "invalidate" | "ignore";

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

function keepLastUndoActions(actions: UiUndoAction[], nextAction: UiUndoAction) {
  return [...actions.slice(-(UI_UNDO_STACK_LIMIT - 1)), nextAction];
}

interface UseUndoRedoArgs {
  plansRef: { current: Plan[] };
  positionsRef: { current: Record<string, PlanPositions> };
  collabSessionsRef: { current: Record<string, { planId: string; roomId: string }> };
  collabRevisionsRef: { current: Record<string, number> };
  apiBaseForPlan: (planId: string | null | undefined) => string;
  sessionIdForPlan: (planId: string | null | undefined) => string | undefined;
  currentActorId: string;
  currentActorAvatarSeed: string;
  showToast: (text: string, file: string, error?: boolean) => void;
  historySnapshot: unknown;
  applyLocalPlanSnapshot: (
    planId: string,
    nextPlan: Plan,
    nextPositions: PlanPositions,
    nextSelectedCardId: string | null,
    stackBehavior?: UndoStackBehavior,
  ) => void;
  syncLocalSnapshotToCollab: (planId: string, nextPlan: Plan, nextPositions: PlanPositions, nextFeedbacks?: Feedback[]) => void;
  markPendingPlanMutation: (planId: string, nextPlan: Plan, nextPositions: PlanPositions) => void;
  clearPendingPlanMutation: (planId: string, expectedSignature?: string | null) => void;
}

export function useUndoRedo(args: UseUndoRedoArgs) {
  const {
    plansRef,
    positionsRef,
    collabSessionsRef,
    collabRevisionsRef,
    apiBaseForPlan,
    sessionIdForPlan,
    currentActorId,
    currentActorAvatarSeed,
    showToast,
    historySnapshot,
    applyLocalPlanSnapshot,
    markPendingPlanMutation,
    clearPendingPlanMutation,
  } = args;

  const [undoStack, setUndoStack] = useState<UiUndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UiUndoAction[]>([]);
  const [undoRedoBusy, setUndoRedoBusy] = useState(false);

  const undoStackRef = useRef<UiUndoAction[]>([]);
  const redoStackRef = useRef<UiUndoAction[]>([]);
  const lastUndoPreservingSignatureRef = useRef<string | null>(null);
  const pendingPlanMutationSignaturesRef = useRef<Record<string, string>>({});

  useEffect(() => { undoStackRef.current = undoStack; }, [undoStack]);
  useEffect(() => { redoStackRef.current = redoStack; }, [redoStack]);

  const invalidateUndoRedoStacks = useCallback(() => {
    lastUndoPreservingSignatureRef.current = null;
    if (undoStackRef.current.length === 0 && redoStackRef.current.length === 0) return;
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  const invalidateUndoRedoIfExternalPlanChange = useCallback((
    nextPlanId: string | null | undefined,
    nextPlan: Plan | null,
    nextPositions: PlanPositions,
  ) => {
    if (!nextPlanId) return;
    const currentPlan = plansRef.current.find((c) => c.id === nextPlanId) ?? null;
    const currentPositions = positionsRef.current[nextPlanId] ?? EMPTY_PLAN_POSITIONS;
    const currentSignature = buildPlanSignature(currentPlan, currentPositions);
    const nextSignature = buildPlanSignature(nextPlan, nextPositions);
    if (!currentSignature || !nextSignature || currentSignature === nextSignature) return;
    const pendingSignature = pendingPlanMutationSignaturesRef.current[nextPlanId];
    if (pendingSignature) {
      if (nextSignature === pendingSignature) {
        delete pendingPlanMutationSignaturesRef.current[nextPlanId];
      }
      return;
    }
    if (nextSignature === lastUndoPreservingSignatureRef.current) return;
    invalidateUndoRedoStacks();
  }, [invalidateUndoRedoStacks, plansRef, positionsRef]);

  const buildUndoGuardContext = useCallback((planId: string) => {
    const session = Object.values(collabSessionsRef.current).find((c) => c.planId === planId) ?? null;
    if (!session) return { collabRoomId: null, collabRevision: null };
    return {
      collabRoomId: session.roomId,
      collabRevision: collabRevisionsRef.current[session.roomId] ?? 0,
    };
  }, [collabSessionsRef, collabRevisionsRef]);

  const isUndoActionSafe = useCallback((action?: UiUndoAction | null) => {
    if (!action) return false;
    if (!action.collabRoomId) return true;
    const session = collabSessionsRef.current[action.collabRoomId];
    if (!session) return true;
    if (session.planId && session.planId !== action.planId) return false;
    const currentRevision = collabRevisionsRef.current[action.collabRoomId] ?? 0;
    const actionRevision = action.collabRevision ?? 0;
    return currentRevision === actionRevision;
  }, [collabSessionsRef, collabRevisionsRef]);

  const pushUndoAction = useCallback((action: UiUndoAction) => {
    setUndoStack((prev) => keepLastUndoActions(prev, action));
    setRedoStack([]);
  }, []);

  const persistUndoableAction = useCallback(async (action: UiUndoAction, direction: "undo" | "redo") => {
    const source = direction;
    const base = apiBaseForPlan(action.planId);
    const sessionId = sessionIdForPlan(action.planId);
    const currentPositions = cloneValue(positionsRef.current[action.planId] ?? EMPTY_PLAN_POSITIONS);
    const mergedPositions = mergeUndoPositions(action, direction, currentPositions);

    switch (action.kind) {
      case "card_add":
        if (direction === "undo") {
          await api.deleteCard(action.planId, action.card.id, source, base, sessionId, currentActorId, currentActorAvatarSeed);
        } else {
          await api.addCard(action.planId, cardToAddPayload(action.card), source, base, sessionId, currentActorId, currentActorAvatarSeed);
          if (!arePositionsEqual(currentPositions, mergedPositions)) {
            await api.savePositions(action.planId, mergedPositions, base, sessionId);
          }
        }
        return;
      case "card_delete":
        if (direction === "undo") {
          await api.addCard(action.planId, cardToAddPayload(action.card), source, base, sessionId, currentActorId, currentActorAvatarSeed);
          for (const dep of action.restoredDependencies) {
            await api.updateCard(action.planId, dep.cardId, { dependencies: dep.dependencies }, source, base, sessionId, currentActorId, currentActorAvatarSeed);
          }
          if (!arePositionsEqual(currentPositions, mergedPositions)) {
            await api.savePositions(action.planId, mergedPositions, base, sessionId);
          }
        } else {
          await api.deleteCard(action.planId, action.card.id, source, base, sessionId, currentActorId, currentActorAvatarSeed);
        }
        return;
      case "dependency_add":
      case "dependency_remove":
        await api.updateCard(
          action.planId,
          action.targetId,
          { dependencies: direction === "undo" ? action.beforeDependencies : action.afterDependencies },
          source, base, sessionId, currentActorId, currentActorAvatarSeed,
        );
        return;
    }
  }, [apiBaseForPlan, currentActorAvatarSeed, currentActorId, positionsRef, sessionIdForPlan]);

  const applyUndoableSnapshot = useCallback((action: UiUndoAction, direction: "undo" | "redo") => {
    const nextPlan = cloneValue(direction === "undo" ? action.beforePlan : action.afterPlan);
    const currentPositions = cloneValue(positionsRef.current[action.planId] ?? EMPTY_PLAN_POSITIONS);
    const nextPositions = mergeUndoPositions(action, direction, currentPositions);
    const nextSelectedCardId = direction === "undo" ? action.beforeSelectedCardId : action.afterSelectedCardId;
    markPendingPlanMutation(action.planId, nextPlan, nextPositions);
    applyLocalPlanSnapshot(action.planId, nextPlan, nextPositions, nextSelectedCardId, "preserve");
  }, [applyLocalPlanSnapshot, markPendingPlanMutation, positionsRef]);

  const handleUndo = useCallback(async () => {
    if (historySnapshot || undoRedoBusy) return;
    const action = undoStackRef.current[undoStackRef.current.length - 1];
    if (!action) return;
    if (!isUndoActionSafe(action)) {
      invalidateUndoRedoStacks();
      showToast("Undo unavailable", "Remote collaboration changed this plan", true);
      return;
    }
    setUndoRedoBusy(true);
    applyUndoableSnapshot(action, "undo");
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => keepLastUndoActions(prev, action));
    try {
      await persistUndoableAction(action, "undo");
      clearPendingPlanMutation(action.planId);
    } catch {
      clearPendingPlanMutation(action.planId);
      applyUndoableSnapshot(action, "redo");
      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => keepLastUndoActions(prev, action));
      showToast("Undo failed", action.kind.replace("_", " "), true);
    } finally {
      setUndoRedoBusy(false);
    }
  }, [applyUndoableSnapshot, clearPendingPlanMutation, historySnapshot, invalidateUndoRedoStacks, isUndoActionSafe, persistUndoableAction, showToast, undoRedoBusy]);

  const handleRedo = useCallback(async () => {
    if (historySnapshot || undoRedoBusy) return;
    const action = redoStackRef.current[redoStackRef.current.length - 1];
    if (!action) return;
    if (!isUndoActionSafe(action)) {
      invalidateUndoRedoStacks();
      showToast("Redo unavailable", "Remote collaboration changed this plan", true);
      return;
    }
    setUndoRedoBusy(true);
    applyUndoableSnapshot(action, "redo");
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => keepLastUndoActions(prev, action));
    try {
      await persistUndoableAction(action, "redo");
      clearPendingPlanMutation(action.planId);
    } catch {
      clearPendingPlanMutation(action.planId);
      applyUndoableSnapshot(action, "undo");
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => keepLastUndoActions(prev, action));
      showToast("Redo failed", action.kind.replace("_", " "), true);
    } finally {
      setUndoRedoBusy(false);
    }
  }, [applyUndoableSnapshot, clearPendingPlanMutation, historySnapshot, invalidateUndoRedoStacks, isUndoActionSafe, persistUndoableAction, showToast, undoRedoBusy]);

  const resetStacks = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
    lastUndoPreservingSignatureRef.current = null;
  }, []);

  const trackSignature = useCallback((plan: Plan | null, positions: PlanPositions) => {
    const signature = buildPlanSignature(plan, positions);
    if (!signature) return;
    if (signature === lastUndoPreservingSignatureRef.current) {
      lastUndoPreservingSignatureRef.current = null;
    }
  }, []);

  const markPreservingSignature = useCallback((plan: Plan, positions: PlanPositions) => {
    const signature = buildPlanSignature(plan, positions);
    if (signature) lastUndoPreservingSignatureRef.current = signature;
  }, []);

  return {
    undoStack,
    redoStack,
    undoRedoBusy,
    setUndoStack,
    pendingPlanMutationSignaturesRef,
    invalidateUndoRedoStacks,
    invalidateUndoRedoIfExternalPlanChange,
    buildUndoGuardContext,
    isUndoActionSafe,
    pushUndoAction,
    handleUndo,
    handleRedo,
    resetStacks,
    trackSignature,
    markPreservingSignature,
  };
}
