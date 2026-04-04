import { useState, useEffect, useRef } from "react";
import type { Plan, Feedback } from "../types";
import type { SharedPlanSnapshot } from "../lib/p2p";
import type { PlanPositions } from "../lib/planUtils";
import {
  buildPlanSignature,
  mergePositions,
  EMPTY_PLAN_POSITIONS,
} from "../lib/planUtils";
import * as api from "../lib/api";

interface UsePlanPollingArgs {
  activePlanIdRef: { current: string | null };
  plansRef: { current: Plan[] };
  positionsRef: { current: Record<string, PlanPositions> };
  pendingPlanMutationSignaturesRef: { current: Record<string, string> };
  getCollabSessionForPlanId: (planId?: string | null) => { snapshot?: SharedPlanSnapshot | null } | null;
  getCollabSnapshots: () => SharedPlanSnapshot[];
  invalidateUndoRedoIfExternalPlanChange: (planId: string | null | undefined, plan: Plan | null, positions: PlanPositions) => void;
  setPlans: React.Dispatch<React.SetStateAction<Plan[]>>;
  setFeedbacks: React.Dispatch<React.SetStateAction<Feedback[]>>;
  setPositions: React.Dispatch<React.SetStateAction<Record<string, PlanPositions>>>;
  setActivePlanId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function usePlanPolling(args: UsePlanPollingArgs) {
  const {
    activePlanIdRef,
    plansRef,
    positionsRef,
    pendingPlanMutationSignaturesRef,
    getCollabSessionForPlanId,
    getCollabSnapshots,
    invalidateUndoRedoIfExternalPlanChange,
    setPlans,
    setFeedbacks,
    setPositions,
    setActivePlanId,
  } = args;

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const s = await api.fetchState();
        if (!alive) return;

        const remoteSnapshots = getCollabSnapshots();
        const snapshotPlanIds = new Set(remoteSnapshots.map((snap) => snap.plan.id));
        const collabCardIds = new Set(remoteSnapshots.flatMap((snap) => snap.plan.steps.map((card) => card.id)));

        const nextPlans = [
          ...s.plans.filter((c) => !snapshotPlanIds.has(c.id)),
          ...remoteSnapshots.map((snap) => snap.plan),
        ];
        const nextPositions = {
          ...s.positions,
          ...Object.fromEntries(remoteSnapshots.map((snap) => [snap.plan.id, snap.positions])),
        };
        const nextFeedbacks = [
          ...s.feedbacks.filter((f) => !collabCardIds.has(f.cardId)),
          ...remoteSnapshots.flatMap((snap) => snap.feedbacks ?? []),
        ];

        const adjustedPositions = { ...nextPositions };
        const adjustedPlans = nextPlans.map((nextPlan) => {
          const pendingSignature = pendingPlanMutationSignaturesRef.current[nextPlan.id];
          if (!pendingSignature) return nextPlan;
          const fetchedPositions = adjustedPositions[nextPlan.id] ?? EMPTY_PLAN_POSITIONS;
          const fetchedSignature = buildPlanSignature(nextPlan, fetchedPositions);
          if (fetchedSignature === pendingSignature) {
            delete pendingPlanMutationSignaturesRef.current[nextPlan.id];
            return nextPlan;
          }
          adjustedPositions[nextPlan.id] = positionsRef.current[nextPlan.id] ?? EMPTY_PLAN_POSITIONS;
          return plansRef.current.find((c) => c.id === nextPlan.id) ?? nextPlan;
        });

        const currentActivePlanId = activePlanIdRef.current;
        if (currentActivePlanId && !getCollabSessionForPlanId(currentActivePlanId)) {
          const nextActivePlan = adjustedPlans.find((c) => c.id === currentActivePlanId) ?? null;
          const nextActivePositions = adjustedPositions[currentActivePlanId] ?? EMPTY_PLAN_POSITIONS;
          invalidateUndoRedoIfExternalPlanChange(currentActivePlanId, nextActivePlan, nextActivePositions);
        }

        setPlans((prev) => {
          const prevMap = new Map(prev.map((p) => [p.id, p]));
          const merged = adjustedPlans.map((nextPlan) => {
            const prevPlan = prevMap.get(nextPlan.id);
            return prevPlan && JSON.stringify(prevPlan) === JSON.stringify(nextPlan) ? prevPlan : nextPlan;
          });
          if (merged.length === prev.length && merged.every((plan, index) => plan === prev[index])) return prev;
          return merged;
        });

        setFeedbacks((prev) => (JSON.stringify(prev) === JSON.stringify(nextFeedbacks) ? prev : nextFeedbacks));
        setPositions((prev) => mergePositions(prev, adjustedPositions));
        setConnected(true);

        const currentId = activePlanIdRef.current;
        if (adjustedPlans.length) {
          if (!currentId || !adjustedPlans.some((p) => p.id === currentId)) setActivePlanId(adjustedPlans[0].id);
        } else {
          setActivePlanId(null);
        }
      } catch {
        if (alive) setConnected(false);
      }
    };
    poll();
    const iv = setInterval(poll, 2500);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [
    activePlanIdRef, getCollabSessionForPlanId, getCollabSnapshots,
    invalidateUndoRedoIfExternalPlanChange, pendingPlanMutationSignaturesRef,
    plansRef, positionsRef, setActivePlanId, setFeedbacks, setPlans, setPositions,
  ]);

  return { connected };
}
