import { useCallback } from "react";
import type { Card, Plan, Feedback } from "../types";
import type { PlanPositions } from "../lib/planUtils";
import type { UiUndoAction, UndoStackBehavior } from "./useUndoRedo";
import { arePositionsEqual, cloneValue, feedbacksForPlan, EMPTY_PLAN_POSITIONS } from "../lib/planUtils";
import * as api from "../lib/api";

interface UsePlanMutationsArgs {
  activePlanIdRef: { current: string | null };
  selectedCardIdRef: { current: string | null };
  plansRef: { current: Plan[] };
  feedbacksRef: { current: Feedback[] };
  positionsRef: { current: Record<string, PlanPositions> };
  setPlans: React.Dispatch<React.SetStateAction<Plan[]>>;
  setFeedbacks: React.Dispatch<React.SetStateAction<Feedback[]>>;
  setPositions: React.Dispatch<React.SetStateAction<Record<string, PlanPositions>>>;
  setActivePlanId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedCardId: React.Dispatch<React.SetStateAction<string | null>>;
  apiBaseForPlan: (planId: string | null | undefined) => string;
  sessionIdForPlan: (planId: string | null | undefined) => string | undefined;
  currentActorId: string;
  currentActorAvatarSeed: string;
  showToast: (text: string, file: string, error?: boolean) => void;
  applyLocalPlanSnapshot: (planId: string, nextPlan: Plan, nextPositions: PlanPositions, nextSelectedCardId: string | null, stackBehavior?: UndoStackBehavior) => void;
  markPendingPlanMutation: (planId: string, nextPlan: Plan, nextPositions: PlanPositions) => void;
  clearPendingPlanMutation: (planId: string, expectedSignature?: string | null) => void;
  invalidateUndoRedoStacks: () => void;
  buildUndoGuardContext: (planId: string) => { collabRoomId: string | null; collabRevision: number | null };
  pushUndoAction: (action: UiUndoAction) => void;
  setUndoStack: React.Dispatch<React.SetStateAction<UiUndoAction[]>>;
  syncLocalSnapshotToCollab: (planId: string, nextPlan: Plan, nextPositions: PlanPositions, nextFeedbacks?: Feedback[]) => void;
  destroyCollabRoom: (roomId: string) => void;
  setCollabSessions: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  profile: { userId: string; username: string; avatarSeed: string };
}

export function usePlanMutations(args: UsePlanMutationsArgs) {
  const {
    activePlanIdRef, selectedCardIdRef, plansRef, feedbacksRef, positionsRef,
    setPlans, setFeedbacks, setPositions, setActivePlanId, setSelectedCardId,
    apiBaseForPlan, sessionIdForPlan, currentActorId, currentActorAvatarSeed,
    showToast, applyLocalPlanSnapshot, markPendingPlanMutation, clearPendingPlanMutation,
    invalidateUndoRedoStacks, buildUndoGuardContext, pushUndoAction, setUndoStack,
    syncLocalSnapshotToCollab, destroyCollabRoom, setCollabSessions, profile,
  } = args;

  const onPositionsChange = useCallback((positions: PlanPositions) => {
    const currentPlanId = activePlanIdRef.current;
    if (!currentPlanId) return;
    const currentPlan = plansRef.current.find((c) => c.id === currentPlanId) ?? null;
    if (currentPlan) {
      invalidateUndoRedoStacks();
      markPendingPlanMutation(currentPlanId, currentPlan, positions);
      syncLocalSnapshotToCollab(currentPlanId, currentPlan, positions);
    }
    setPositions((prev) => {
      const prevPlanPositions = prev[currentPlanId];
      if (prevPlanPositions && arePositionsEqual(prevPlanPositions, positions)) return prev;
      return { ...prev, [currentPlanId]: positions };
    });
    api.savePositions(currentPlanId, positions, apiBaseForPlan(currentPlanId), sessionIdForPlan(currentPlanId))
      .then(() => clearPendingPlanMutation(currentPlanId))
      .catch(() => clearPendingPlanMutation(currentPlanId));
  }, [activePlanIdRef, apiBaseForPlan, clearPendingPlanMutation, invalidateUndoRedoStacks, markPendingPlanMutation, plansRef, sessionIdForPlan, setPositions, syncLocalSnapshotToCollab]);

  const handleDeletePlan = useCallback(async (id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
    setActivePlanId((prev) => (prev === id ? null : prev));
    setCollabSessions((prev: Record<string, any>) => {
      const next = { ...prev };
      Object.entries(prev).forEach(([roomId, session]) => {
        if (session.planId !== id) return;
        destroyCollabRoom(roomId);
        delete next[roomId];
      });
      return next;
    });
    api.deletePlan(id, apiBaseForPlan(id), sessionIdForPlan(id)).catch(() => {});
  }, [apiBaseForPlan, destroyCollabRoom, sessionIdForPlan, setActivePlanId, setCollabSessions, setPlans]);

  const handleTogglePin = useCallback(async (id: string) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p)));
    api.togglePin(id, apiBaseForPlan(id), sessionIdForPlan(id)).catch(() => {});
  }, [apiBaseForPlan, sessionIdForPlan, setPlans]);

  const handleDeleteCard = useCallback(async (cardId: string) => {
    const currentAId = activePlanIdRef.current;
    if (!currentAId) return;
    const currentPlan = plansRef.current.find((c) => c.id === currentAId);
    if (!currentPlan) return;
    const removedCard = currentPlan.steps.find((c) => c.id === cardId);
    if (!removedCard) return;

    const beforePlan = cloneValue(currentPlan);
    const beforePositions = cloneValue(positionsRef.current[currentAId] ?? EMPTY_PLAN_POSITIONS);
    const afterPlan: Plan = {
      ...cloneValue(beforePlan),
      steps: beforePlan.steps
        .filter((c) => c.id !== cardId)
        .map((c) => c.dependencies.includes(cardId) ? { ...c, dependencies: c.dependencies.filter((d) => d !== cardId) } : cloneValue(c)),
    };
    const { [cardId]: _removedPosition, ...afterPositions } = beforePositions;
    const removedFeedbacks = feedbacksRef.current.filter((f) => f.cardId === cardId);
    const action: UiUndoAction = {
      kind: "card_delete",
      planId: currentAId,
      card: cloneValue(removedCard),
      restoredDependencies: beforePlan.steps
        .filter((c) => c.dependencies.includes(cardId))
        .map((c) => ({ cardId: c.id, dependencies: cloneValue(c.dependencies) })),
      beforePlan, afterPlan, beforePositions, afterPositions,
      beforeSelectedCardId: selectedCardIdRef.current,
      afterSelectedCardId: selectedCardIdRef.current === cardId ? null : selectedCardIdRef.current,
      ...buildUndoGuardContext(currentAId),
    };

    markPendingPlanMutation(currentAId, afterPlan, afterPositions);
    applyLocalPlanSnapshot(currentAId, cloneValue(afterPlan), cloneValue(afterPositions), action.afterSelectedCardId, "preserve");
    setFeedbacks((prev) => prev.filter((f) => f.cardId !== cardId));
    pushUndoAction(action);
    try {
      await api.deleteCard(currentAId, cardId, "rest", apiBaseForPlan(currentAId), sessionIdForPlan(currentAId), currentActorId, currentActorAvatarSeed);
      clearPendingPlanMutation(currentAId);
    } catch {
      clearPendingPlanMutation(currentAId);
      applyLocalPlanSnapshot(currentAId, cloneValue(beforePlan), cloneValue(beforePositions), action.beforeSelectedCardId, "preserve");
      setFeedbacks((prev) => [...prev, ...removedFeedbacks]);
      setUndoStack((prev) => prev.slice(0, -1));
      showToast("Delete failed", removedCard.title, true);
    }
  }, [activePlanIdRef, apiBaseForPlan, applyLocalPlanSnapshot, buildUndoGuardContext, clearPendingPlanMutation, currentActorAvatarSeed, currentActorId, feedbacksRef, markPendingPlanMutation, plansRef, positionsRef, pushUndoAction, selectedCardIdRef, sessionIdForPlan, setFeedbacks, setUndoStack, showToast]);

  const handleConnectCards = useCallback(async (sourceId: string, targetId: string) => {
    const currentAId = activePlanIdRef.current;
    if (!currentAId) return;
    const currentPlan = plansRef.current.find((c) => c.id === currentAId);
    if (!currentPlan) return;
    const targetCard = currentPlan.steps.find((c) => c.id === targetId);
    if (!targetCard || targetCard.dependencies.includes(sourceId)) return;

    const beforePlan = cloneValue(currentPlan);
    const beforePositions = cloneValue(positionsRef.current[currentAId] ?? EMPTY_PLAN_POSITIONS);
    const afterDependencies = [...new Set([...targetCard.dependencies, sourceId])];
    const afterPlan: Plan = {
      ...cloneValue(beforePlan),
      steps: beforePlan.steps.map((c) => c.id === targetId ? { ...c, dependencies: cloneValue(afterDependencies) } : cloneValue(c)),
    };
    const action: UiUndoAction = {
      kind: "dependency_add", planId: currentAId, sourceId, targetId,
      beforeDependencies: cloneValue(targetCard.dependencies), afterDependencies: cloneValue(afterDependencies),
      beforePlan, afterPlan, beforePositions, afterPositions: beforePositions,
      beforeSelectedCardId: selectedCardIdRef.current, afterSelectedCardId: selectedCardIdRef.current,
      ...buildUndoGuardContext(currentAId),
    };

    markPendingPlanMutation(currentAId, afterPlan, beforePositions);
    applyLocalPlanSnapshot(currentAId, cloneValue(afterPlan), cloneValue(beforePositions), action.afterSelectedCardId, "preserve");
    pushUndoAction(action);
    try {
      await api.updateCard(currentAId, targetId, { dependencies: afterDependencies }, "rest", apiBaseForPlan(currentAId), sessionIdForPlan(currentAId), currentActorId, currentActorAvatarSeed);
      clearPendingPlanMutation(currentAId);
    } catch {
      clearPendingPlanMutation(currentAId);
      applyLocalPlanSnapshot(currentAId, cloneValue(beforePlan), cloneValue(beforePositions), action.beforeSelectedCardId, "preserve");
      setUndoStack((prev) => prev.slice(0, -1));
      showToast("Dependency add failed", targetCard.title, true);
    }
  }, [activePlanIdRef, apiBaseForPlan, applyLocalPlanSnapshot, buildUndoGuardContext, clearPendingPlanMutation, currentActorAvatarSeed, currentActorId, markPendingPlanMutation, plansRef, positionsRef, pushUndoAction, selectedCardIdRef, sessionIdForPlan, setUndoStack, showToast]);

  const handleDisconnectCards = useCallback(async (sourceId: string, targetId: string) => {
    const currentAId = activePlanIdRef.current;
    if (!currentAId) return;
    const currentPlan = plansRef.current.find((c) => c.id === currentAId);
    if (!currentPlan) return;
    const targetCard = currentPlan.steps.find((c) => c.id === targetId);
    if (!targetCard || !targetCard.dependencies.includes(sourceId)) return;

    const beforePlan = cloneValue(currentPlan);
    const beforePositions = cloneValue(positionsRef.current[currentAId] ?? EMPTY_PLAN_POSITIONS);
    const afterDependencies = targetCard.dependencies.filter((d) => d !== sourceId);
    const afterPlan: Plan = {
      ...cloneValue(beforePlan),
      steps: beforePlan.steps.map((c) => c.id === targetId ? { ...c, dependencies: cloneValue(afterDependencies) } : cloneValue(c)),
    };
    const action: UiUndoAction = {
      kind: "dependency_remove", planId: currentAId, sourceId, targetId,
      beforeDependencies: cloneValue(targetCard.dependencies), afterDependencies: cloneValue(afterDependencies),
      beforePlan, afterPlan, beforePositions, afterPositions: beforePositions,
      beforeSelectedCardId: selectedCardIdRef.current, afterSelectedCardId: selectedCardIdRef.current,
      ...buildUndoGuardContext(currentAId),
    };

    markPendingPlanMutation(currentAId, afterPlan, beforePositions);
    applyLocalPlanSnapshot(currentAId, cloneValue(afterPlan), cloneValue(beforePositions), action.afterSelectedCardId, "preserve");
    pushUndoAction(action);
    try {
      await api.updateCard(currentAId, targetId, { dependencies: afterDependencies }, "rest", apiBaseForPlan(currentAId), sessionIdForPlan(currentAId), currentActorId, currentActorAvatarSeed);
      clearPendingPlanMutation(currentAId);
    } catch {
      clearPendingPlanMutation(currentAId);
      applyLocalPlanSnapshot(currentAId, cloneValue(beforePlan), cloneValue(beforePositions), action.beforeSelectedCardId, "preserve");
      setUndoStack((prev) => prev.slice(0, -1));
      showToast("Dependency remove failed", targetCard.title, true);
    }
  }, [activePlanIdRef, apiBaseForPlan, applyLocalPlanSnapshot, buildUndoGuardContext, clearPendingPlanMutation, currentActorAvatarSeed, currentActorId, markPendingPlanMutation, plansRef, positionsRef, pushUndoAction, selectedCardIdRef, sessionIdForPlan, setUndoStack, showToast]);

  const handleEditCard = useCallback(async (pid: string, cid: string, updates: Partial<Card>) => {
    const currentPlan = plansRef.current.find((c) => c.id === pid);
    if (!currentPlan) return;
    const currentCard = currentPlan.steps.find((c) => c.id === cid);
    if (!currentCard) return;
    const beforePlan = cloneValue(currentPlan);
    const currentPositions = cloneValue(positionsRef.current[pid] ?? EMPTY_PLAN_POSITIONS);
    const nextCard: Card = {
      ...cloneValue(currentCard),
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.type !== undefined ? { type: updates.type } : {}),
      ...(updates.repo !== undefined ? { repo: updates.repo } : {}),
      ...(updates.files !== undefined ? { files: cloneValue(updates.files) } : {}),
      ...(updates.dependencies !== undefined ? { dependencies: cloneValue(updates.dependencies) } : {}),
    };
    const optimisticPlan: Plan = {
      ...cloneValue(beforePlan),
      steps: beforePlan.steps.map((c) => (c.id === cid ? nextCard : cloneValue(c))),
    };
    markPendingPlanMutation(pid, optimisticPlan, currentPositions);
    applyLocalPlanSnapshot(pid, optimisticPlan, currentPositions, cid, "invalidate");
    try {
      await api.updateCard(pid, cid, updates, "rest", apiBaseForPlan(pid), sessionIdForPlan(pid), currentActorId, currentActorAvatarSeed);
      clearPendingPlanMutation(pid);
    } catch {
      clearPendingPlanMutation(pid);
      applyLocalPlanSnapshot(pid, beforePlan, currentPositions, cid, "ignore");
    }
  }, [apiBaseForPlan, applyLocalPlanSnapshot, clearPendingPlanMutation, currentActorAvatarSeed, currentActorId, markPendingPlanMutation, plansRef, positionsRef, sessionIdForPlan]);

  const handleSaveFileContent = useCallback(async (planId: string, cardId: string, filePath: string, newContent: string, change: any) => {
    const currentPlan = plansRef.current.find((c) => c.id === planId);
    if (!currentPlan) throw new Error("Plan not found");
    const card = currentPlan.steps.find((s) => s.id === cardId);
    if (!card) throw new Error("Card not found");
    const updatedFileChanges = { ...card.fileChanges, [filePath]: { ...change, content: newContent } };
    const beforePlan = cloneValue(currentPlan);
    const currentPositions = cloneValue(positionsRef.current[planId] ?? EMPTY_PLAN_POSITIONS);
    const optimisticPlan: Plan = {
      ...cloneValue(beforePlan),
      steps: beforePlan.steps.map((step) => step.id === cardId ? { ...cloneValue(step), fileChanges: updatedFileChanges } : cloneValue(step)),
    };
    markPendingPlanMutation(planId, optimisticPlan, currentPositions);
    applyLocalPlanSnapshot(planId, optimisticPlan, currentPositions, cardId, "invalidate");
    try {
      await api.updateCard(planId, cardId, { fileChanges: updatedFileChanges }, "rest", apiBaseForPlan(planId), sessionIdForPlan(planId), currentActorId, currentActorAvatarSeed);
      clearPendingPlanMutation(planId);
      showToast("Saved", filePath);
    } catch (error) {
      clearPendingPlanMutation(planId);
      applyLocalPlanSnapshot(planId, beforePlan, currentPositions, cardId, "ignore");
      showToast("Save failed", filePath, true);
      throw error;
    }
  }, [apiBaseForPlan, applyLocalPlanSnapshot, clearPendingPlanMutation, currentActorAvatarSeed, currentActorId, markPendingPlanMutation, plansRef, positionsRef, sessionIdForPlan, showToast]);

  const handleAddFeedback = useCallback(async (cardId: string, type: string, text: string, plan: Plan | null) => {
    try {
      const result = await api.addFeedback(cardId, type as any, text, profile.userId, profile.username, profile.avatarSeed);
      const nextFeedback: Feedback = {
        id: result.id, cardId, type: type as Feedback["type"], text,
        answer: null, timestamp: Date.now(), read: false,
        ownerUserId: profile.userId, ownerUsername: profile.username, ownerAvatarSeed: profile.avatarSeed,
      };
      const nextFeedbacks = [...feedbacksRef.current, nextFeedback];
      setFeedbacks(nextFeedbacks);
      if (plan) {
        syncLocalSnapshotToCollab(plan.id, plan, positionsRef.current[plan.id] ?? EMPTY_PLAN_POSITIONS, feedbacksForPlan(plan, nextFeedbacks));
      }
    } catch {}
  }, [feedbacksRef, positionsRef, profile, setFeedbacks, syncLocalSnapshotToCollab]);

  const handleDeleteFeedback = useCallback(async (feedbackId: string, plan: Plan | null) => {
    try {
      await api.deleteFeedback(feedbackId);
      const nextFeedbacks = feedbacksRef.current.filter((f) => f.id !== feedbackId);
      setFeedbacks(nextFeedbacks);
      if (plan) {
        syncLocalSnapshotToCollab(plan.id, plan, positionsRef.current[plan.id] ?? EMPTY_PLAN_POSITIONS, feedbacksForPlan(plan, nextFeedbacks));
      }
    } catch {}
  }, [feedbacksRef, positionsRef, setFeedbacks, syncLocalSnapshotToCollab]);

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
        const result = await api.importPlan(data, undefined, currentActorId, currentActorAvatarSeed);
        if (!activePlanIdRef.current) setActivePlanId(result.id);
        showToast("Imported", data.title);
      } catch {
        showToast("Could not import plan", file.name, true);
      }
    };
    input.click();
  }, [activePlanIdRef, currentActorAvatarSeed, currentActorId, setActivePlanId, showToast]);

  const handleCardCreated = useCallback((card: Card, planId: string) => {
    const currentPlan = plansRef.current.find((c) => c.id === planId);
    if (currentPlan) {
      const beforePlan = cloneValue(currentPlan);
      const beforePositions = cloneValue(positionsRef.current[planId] ?? EMPTY_PLAN_POSITIONS);
      const afterPlan: Plan = {
        ...cloneValue(beforePlan),
        steps: [...beforePlan.steps.map((s) => cloneValue(s)), cloneValue(card)],
      };
      const action: UiUndoAction = {
        kind: "card_add", planId, card: cloneValue(card),
        beforePlan, afterPlan, beforePositions, afterPositions: beforePositions,
        beforeSelectedCardId: selectedCardIdRef.current, afterSelectedCardId: card.id,
        ...buildUndoGuardContext(planId),
      };
      applyLocalPlanSnapshot(planId, cloneValue(afterPlan), cloneValue(beforePositions), card.id, "preserve");
      pushUndoAction(action);
    } else {
      setSelectedCardId(card.id);
    }
    showToast("Card added", "");
  }, [applyLocalPlanSnapshot, buildUndoGuardContext, plansRef, positionsRef, pushUndoAction, selectedCardIdRef, setSelectedCardId, showToast]);

  return {
    onPositionsChange,
    handleDeletePlan,
    handleTogglePin,
    handleDeleteCard,
    handleConnectCards,
    handleDisconnectCards,
    handleEditCard,
    handleSaveFileContent,
    handleAddFeedback,
    handleDeleteFeedback,
    importPlan,
    handleCardCreated,
  };
}
