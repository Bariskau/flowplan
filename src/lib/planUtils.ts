import type { Plan, Feedback, CollabSession } from "../types";
import type { SharedPlanSnapshot } from "./p2p";
import type { Dispatch, SetStateAction } from "react";

export type PlanPositions = Record<string, { x: number; y: number }>;

export const EMPTY_PLAN_POSITIONS: PlanPositions = {};
export const EMPTY_FEEDBACK_COUNTS: Record<string, number> = {};
export const EMPTY_FEEDBACK_TYPES: Record<string, string[]> = {};

export function arePositionsEqual(
  prev: PlanPositions,
  next: PlanPositions,
): boolean {
  const prevIds = Object.keys(prev);
  const nextIds = Object.keys(next);
  if (prevIds.length !== nextIds.length) return false;
  return prevIds.every((id) => {
    const prevPos = prev[id];
    const nextPos = next[id];
    return !!nextPos && prevPos.x === nextPos.x && prevPos.y === nextPos.y;
  });
}

export function mergePositions(
  prev: Record<string, PlanPositions>,
  next: Record<string, PlanPositions>,
): Record<string, PlanPositions> {
  const nextPlanIds = Object.keys(next);
  let changed = nextPlanIds.length !== Object.keys(prev).length;
  const merged: Record<string, PlanPositions> = {};

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

export function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

export function normalizePlan(plan: Plan | null) {
  if (!plan) return null;
  return {
    id: plan.id,
    title: plan.title,
    icon: plan.icon ?? "",
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

export function normalizePositions(positions: PlanPositions) {
  return Object.keys(positions)
    .sort()
    .map((id) => [id, { x: positions[id].x, y: positions[id].y }]);
}

export function buildPlanSignature(plan: Plan | null, positions: PlanPositions): string | null {
  if (!plan) return null;
  return JSON.stringify({
    plan: normalizePlan(plan),
    positions: normalizePositions(positions),
  });
}

export function normalizeFeedback(feedback: Feedback) {
  return {
    id: feedback.id,
    cardId: feedback.cardId,
    type: feedback.type,
    text: feedback.text,
    answer: feedback.answer,
    timestamp: feedback.timestamp,
    read: !!feedback.read,
    ownerUserId: feedback.ownerUserId ?? "",
    ownerUsername: feedback.ownerUsername ?? "",
    ownerAvatarSeed: feedback.ownerAvatarSeed ?? "",
  };
}

export function feedbacksForPlan(plan: Plan | null, feedbacks: Feedback[]): Feedback[] {
  if (!plan) return [];
  const planCardIds = new Set(plan.steps.map((card) => card.id));
  return feedbacks
    .filter((feedback) => planCardIds.has(feedback.cardId))
    .sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
}

export function mergeFeedbacksForPlan(
  prev: Feedback[],
  nextPlan: Plan,
  nextFeedbacks: Feedback[],
  previousPlan?: Plan | null,
): Feedback[] {
  const planCardIds = new Set([
    ...nextPlan.steps.map((card) => card.id),
    ...(previousPlan?.steps.map((card) => card.id) ?? []),
  ]);
  return [...prev.filter((feedback) => !planCardIds.has(feedback.cardId)), ...nextFeedbacks];
}

export function buildSharedSnapshotSignature(snapshot: SharedPlanSnapshot | null): string | null {
  if (!snapshot) return null;
  return JSON.stringify({
    plan: normalizePlan(snapshot.plan),
    positions: normalizePositions(snapshot.positions),
    feedbacks: [...snapshot.feedbacks]
      .sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id))
      .map(normalizeFeedback),
  });
}

export function applyCollabSnapshotToLocalState(
  session: CollabSession,
  setPlans: Dispatch<SetStateAction<Plan[]>>,
  setPositions: Dispatch<SetStateAction<Record<string, PlanPositions>>>,
  setFeedbacks: Dispatch<SetStateAction<Feedback[]>>,
  previousPlan?: Plan | null,
) {
  const snapshot = session.snapshot;
  if (!snapshot) return;

  setPlans((prev) => {
    const exists = prev.some((candidate) => candidate.id === snapshot.plan.id);
    if (exists) {
      return prev.map((candidate) => (candidate.id === snapshot.plan.id ? snapshot.plan : candidate));
    }
    return [snapshot.plan, ...prev];
  });

  setPositions((prev) => ({
    ...prev,
    [snapshot.plan.id]: snapshot.positions,
  }));
  setFeedbacks((prev) => mergeFeedbacksForPlan(prev, snapshot.plan, snapshot.feedbacks ?? [], previousPlan));
}
