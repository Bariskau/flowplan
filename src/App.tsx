import { useState, useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import type {
  Card,
  Plan,
  Feedback,
  FileChange,
  HistoryEntry,
  CollabProfile,
  CollabSession,
  CollabTransportState,
  ConnectPlanDraft,
} from "./types";
import * as api from "./lib/api";
import { X } from "@phosphor-icons/react";
import {
  createHostSession,
  createJoinSession,
  loadConnectionDefaults,
  loadStoredProfile,
  saveConnectionDefaults,
  saveStoredProfile,
  sanitizeUsername,
} from "./lib/collab";
import { FlowPlanCollabDoc } from "./lib/collabDoc";
import { FlowPlanPeerSession, type SharedPlanSnapshot } from "./lib/p2p";
import useEscapeClose from "./hooks/useEscapeClose";

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
import AvatarGroup from "./components/AvatarGroup";
import CollabCursorLayer from "./components/CollabCursorLayer";
import Button from "./components/ui/Button";

const EMPTY_STEPS: Card[] = [];
const EMPTY_PLAN_POSITIONS: Record<string, { x: number; y: number }> = {};
const EMPTY_FEEDBACK_COUNTS: Record<string, number> = {};
const EMPTY_FEEDBACK_TYPES: Record<string, string[]> = {};
const HISTORY_PAGE_LIMIT = 100;
const CURSOR_SEND_INTERVAL_MS = 120;
const CURSOR_STALE_TIMEOUT_MS = 30_000;
const UI_UNDO_STACK_LIMIT = 10;

type PlanPositions = Record<string, { x: number; y: number }>;
type CollabSessionMap = Record<string, CollabSession>;
type CollabTransportStateMap = Record<string, CollabTransportState>;
type CursorPresence = { x: number; y: number; active: boolean; lastUpdated: number };
type CursorPresenceMap = Record<string, Record<string, CursorPresence>>;
type CanvasFrame = { left: number; top: number; width: number; height: number };
type CanvasViewport = { x: number; y: number; zoom: number };
type UndoStackBehavior = "preserve" | "invalidate" | "ignore";
type DisconnectedFork = {
  roomId: string;
  planId: string;
  planTitle: string;
  baselineSignature: string | null;
  disconnectedAt: number;
};

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizePlan(plan: Plan | null) {
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

function normalizeFeedback(feedback: Feedback) {
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

function feedbacksForPlan(plan: Plan | null, feedbacks: Feedback[]) {
  if (!plan) return [];
  const planCardIds = new Set(plan.steps.map((card) => card.id));
  return feedbacks
    .filter((feedback) => planCardIds.has(feedback.cardId))
    .sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
}

function mergeFeedbacksForPlan(prev: Feedback[], nextPlan: Plan, nextFeedbacks: Feedback[], previousPlan?: Plan | null) {
  const planCardIds = new Set([
    ...nextPlan.steps.map((card) => card.id),
    ...(previousPlan?.steps.map((card) => card.id) ?? []),
  ]);
  return [...prev.filter((feedback) => !planCardIds.has(feedback.cardId)), ...nextFeedbacks];
}

function buildSharedSnapshotSignature(snapshot: SharedPlanSnapshot | null) {
  if (!snapshot) return null;
  return JSON.stringify({
    plan: normalizePlan(snapshot.plan),
    positions: normalizePositions(snapshot.positions),
    feedbacks: [...snapshot.feedbacks]
      .sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id))
      .map(normalizeFeedback),
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

function applyCollabSnapshotToLocalState(
  session: CollabSession,
  setPlans: Dispatch<SetStateAction<Plan[]>>,
  setPositions: Dispatch<SetStateAction<Record<string, Record<string, { x: number; y: number }>>>>,
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

export default function App() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [positions, setPositions] = useState<Record<string, Record<string, { x: number; y: number }>>>({});
  const [profile, setProfile] = useState<CollabProfile>(() => loadStoredProfile());
  const [collabSessions, setCollabSessions] = useState<CollabSessionMap>({});
  const [collabTransportStates, setCollabTransportStates] = useState<CollabTransportStateMap>({});
  const [cursorPresences, setCursorPresences] = useState<CursorPresenceMap>({});
  const [disconnectedForks, setDisconnectedForks] = useState<Record<string, DisconnectedFork>>({});
  const [collabBusy, setCollabBusy] = useState(false);
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; file: string; error?: boolean } | null>(null);
  const [rejoinPrompt, setRejoinPrompt] = useState<{ draft: ConnectPlanDraft; fork: DisconnectedFork } | null>(null);
  const [canvasFrame, setCanvasFrame] = useState<CanvasFrame | null>(null);
  const [canvasViewport, setCanvasViewport] = useState<CanvasViewport | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const exportSvgRef = useRef<(() => Promise<Blob | null>) | null>(null);
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(null);

  useEscapeClose(() => setDialog(null), !!dialog);
  useEscapeClose(() => setRejoinPrompt(null), !!rejoinPrompt);

  const showToast = useCallback((text: string, file: string, error = false) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ text, file, error });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const showCollabDialog = useCallback((title: string, message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(null);
    setDialog({ title, message });
  }, []);

  // Listen for Tauri dialog events via CustomEvent
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.title || detail?.message) setDialog(detail);
    };
    window.addEventListener("fp-dialog", handler);
    return () => window.removeEventListener("fp-dialog", handler);
  }, []);

  useEffect(() => {
    saveStoredProfile(profile);
  }, [profile]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
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
  const lastUndoPreservingSignatureRef = useRef<string | null>(null);
  const undoStackRef = useRef<UiUndoAction[]>([]);
  const redoStackRef = useRef<UiUndoAction[]>([]);
  const collabSessionsRef = useRef(collabSessions);
  collabSessionsRef.current = collabSessions;
  const disconnectedForksRef = useRef(disconnectedForks);
  disconnectedForksRef.current = disconnectedForks;
  const collabDocsRef = useRef<Record<string, FlowPlanCollabDoc>>({});
  const collabDocUnsubsRef = useRef<Record<string, () => void>>({});
  const peerSessionsRef = useRef<Record<string, FlowPlanPeerSession>>({});
  const collabRevisionsRef = useRef<Record<string, number>>({});
  const applyingPeerSnapshotRoomsRef = useRef<Record<string, boolean>>({});
  const lastPeerSnapshotSignaturesRef = useRef<Record<string, string | null>>({});
  const lastLocalCollabSyncSignaturesRef = useRef<Record<string, string | null>>({});
  const pendingPlanMutationSignaturesRef = useRef<Record<string, string>>({});

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
    const currentPlan = plansRef.current.find((candidate) => candidate.id === nextPlanId) ?? null;
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
  }, [invalidateUndoRedoStacks]);

  const apiBaseForPlan = useCallback((_planId: string | null | undefined) => {
    return api.LOCAL_API_BASE;
  }, []);

  const sessionIdForPlan = useCallback((_planId: string | null | undefined) => {
    return undefined;
  }, []);

  const buildUndoGuardContext = useCallback((planId: string) => {
    const session = Object.values(collabSessionsRef.current).find((candidate) => candidate.planId === planId) ?? null;
    if (!session) {
      return {
        collabRoomId: null,
        collabRevision: null,
      };
    }

    return {
      collabRoomId: session.roomId,
      collabRevision: collabRevisionsRef.current[session.roomId] ?? 0,
    };
  }, []);

  const isUndoActionSafe = useCallback((action?: UiUndoAction | null) => {
    if (!action) return false;
    if (!action.collabRoomId) return true;
    const session = collabSessionsRef.current[action.collabRoomId];
    if (!session) return true;
    if (session.planId && session.planId !== action.planId) return false;
    const currentRevision = collabRevisionsRef.current[action.collabRoomId] ?? 0;
    const actionRevision = action.collabRevision ?? 0;
    return currentRevision === actionRevision;
  }, []);

  const markPendingPlanMutation = useCallback((planId: string, nextPlan: Plan, nextPositions: PlanPositions) => {
    const signature = buildPlanSignature(nextPlan, nextPositions);
    if (!signature) return;
    pendingPlanMutationSignaturesRef.current[planId] = signature;
  }, []);

  const clearPendingPlanMutation = useCallback((planId: string, expectedSignature?: string | null) => {
    const currentSignature = pendingPlanMutationSignaturesRef.current[planId];
    if (!currentSignature) return;
    if (expectedSignature && currentSignature !== expectedSignature) return;
    delete pendingPlanMutationSignaturesRef.current[planId];
  }, []);

  const buildPeerSnapshot = useCallback((planId?: string | null): SharedPlanSnapshot | null => {
    const resolvedPlanId = planId ?? activePlanIdRef.current;
    if (!resolvedPlanId) return null;
    const nextPlan = plansRef.current.find((candidate) => candidate.id === resolvedPlanId);
    if (!nextPlan) return null;
    return {
      plan: cloneValue(nextPlan),
      positions: cloneValue(positionsRef.current[resolvedPlanId] ?? EMPTY_PLAN_POSITIONS),
      feedbacks: cloneValue(feedbacksForPlan(nextPlan, feedbacksRef.current)),
    };
  }, []);

  const getCollabSessionForPlanId = useCallback((planId?: string | null) => {
    if (!planId) return null;
    return Object.values(collabSessionsRef.current).find((session) => session.planId === planId) ?? null;
  }, []);

  const resolveParticipantLabel = useCallback((roomId: string, sessionId?: string | null) => {
    if (!sessionId) return undefined;
    return collabSessionsRef.current[roomId]?.participants.find((participant) => participant.sessionId === sessionId)?.username;
  }, []);
  const resolveParticipantAvatarSeed = useCallback((roomId: string, sessionId?: string | null) => {
    if (!sessionId) return undefined;
    return collabSessionsRef.current[roomId]?.participants.find((participant) => participant.sessionId === sessionId)?.avatarSeed;
  }, []);

  const isTerminalCollabError = useCallback((message: string) => {
    const normalized = message.trim().toLowerCase();
    return [
      "room not found",
      "invalid join secret",
      "room already exists",
      "room is full",
      "session already connected",
      "missing required signaling parameters",
      "join secret must be at least",
    ].some((fragment) => normalized.includes(fragment));
  }, []);

  const describeCollabError = useCallback((message: string) => {
    const normalized = message.trim().toLowerCase();
    if (normalized.includes("room not found")) {
      return {
        title: "Room Not Found",
        message: "The host room is not live right now. Ask the host to start the session again and then rejoin with the latest room id and secret.",
      };
    }
    if (normalized.includes("invalid join secret")) {
      return {
        title: "Invalid Secret",
        message: "That room exists, but the secret does not match. Copy the latest secret from the host and try again.",
      };
    }
    if (normalized.includes("room already exists")) {
      return {
        title: "Room Already Exists",
        message: "This room id is already hosting another session. Use a different room id or disconnect the existing host first.",
      };
    }
    if (normalized.includes("room is full")) {
      return {
        title: "Room Is Full",
        message: "This collaboration room already reached the participant limit. Disconnect someone first or host a new room.",
      };
    }
    if (normalized.includes("session already connected")) {
      return {
        title: "Session Already Connected",
        message: "This device session is already attached to the room. Disconnect the existing session or retry after a refresh.",
      };
    }
    return {
      title: "Connection Error",
      message,
    };
  }, []);

  const destroyCollabRoom = useCallback((roomId: string) => {
    peerSessionsRef.current[roomId]?.destroy();
    delete peerSessionsRef.current[roomId];

    collabDocUnsubsRef.current[roomId]?.();
    delete collabDocUnsubsRef.current[roomId];

    collabDocsRef.current[roomId]?.destroy();
    delete collabDocsRef.current[roomId];

    delete collabRevisionsRef.current[roomId];
    delete applyingPeerSnapshotRoomsRef.current[roomId];
    delete lastPeerSnapshotSignaturesRef.current[roomId];
    setCollabTransportStates((prev) => {
      if (!prev[roomId]) return prev;
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
    setCursorPresences((prev) => {
      if (!prev[roomId]) return prev;
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
  }, []);

  const clearDisconnectedFork = useCallback((roomId: string) => {
    setDisconnectedForks((prev) => {
      if (!prev[roomId]) return prev;
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
  }, []);

  const rememberDisconnectedFork = useCallback((session: CollabSession) => {
    if (session.status !== "joined" || !session.planId) return;
    const currentPlan = plansRef.current.find((candidate) => candidate.id === session.planId) ?? session.snapshot?.plan ?? null;
    if (!currentPlan) return;
    const currentPositions =
      positionsRef.current[session.planId] ?? session.snapshot?.positions ?? EMPTY_PLAN_POSITIONS;
    setDisconnectedForks((prev) => ({
      ...prev,
      [session.roomId]: {
        roomId: session.roomId,
        planId: session.planId,
        planTitle: currentPlan.title,
        baselineSignature: buildPlanSignature(currentPlan, currentPositions),
        disconnectedAt: Date.now(),
      },
    }));
  }, []);

  const isDisconnectedForkDirty = useCallback((fork: DisconnectedFork) => {
    const currentPlan = plansRef.current.find((candidate) => candidate.id === fork.planId) ?? null;
    if (!currentPlan) return false;
    const currentPositions = positionsRef.current[fork.planId] ?? EMPTY_PLAN_POSITIONS;
    return buildPlanSignature(currentPlan, currentPositions) !== fork.baselineSignature;
  }, []);

  const applyPeerSnapshot = useCallback((
    roomId: string,
    snapshot: SharedPlanSnapshot,
    revision: number,
    actorId?: string,
    actorAvatarSeed?: string,
    recordHistory = true,
  ) => {
    const roomSession = collabSessionsRef.current[roomId];
    if (!roomSession) return;
    invalidateUndoRedoIfExternalPlanChange(snapshot.plan.id, snapshot.plan, snapshot.positions);
    const previousPlan = plansRef.current.find((candidate) => candidate.id === snapshot.plan.id) ?? roomSession.snapshot?.plan ?? null;
    const signature = buildSharedSnapshotSignature(snapshot);
    collabRevisionsRef.current[roomId] = revision;
    lastPeerSnapshotSignaturesRef.current[roomId] = signature;
    applyingPeerSnapshotRoomsRef.current[roomId] = true;
    void api.applyPeerSnapshot(snapshot.plan, snapshot.positions, snapshot.feedbacks, actorId, actorAvatarSeed, recordHistory);
    applyCollabSnapshotToLocalState(
      {
        transport: "p2p",
        status: roomSession.status,
        serverUrl: roomSession.serverUrl,
        iceServers: roomSession.iceServers,
        roomId: roomSession.roomId,
        joinSecret: roomSession.joinSecret ?? null,
        planId: snapshot.plan.id,
        planTitle: snapshot.plan.title,
        selfSessionId: roomSession.selfSessionId,
        participants: roomSession.participants,
        snapshot,
        createdAt: roomSession.createdAt,
      },
      setPlans,
      setPositions,
      setFeedbacks,
      previousPlan,
    );
    setCollabSessions((prev) =>
      prev[roomId]
        ? {
            ...prev,
            [roomId]: {
              ...prev[roomId],
              planId: snapshot.plan.id,
              planTitle: snapshot.plan.title,
              snapshot,
            },
          }
        : prev,
    );
    setActivePlanId(snapshot.plan.id);
    window.setTimeout(() => {
      delete applyingPeerSnapshotRoomsRef.current[roomId];
    }, 0);
  }, [invalidateUndoRedoIfExternalPlanChange]);

  const syncLocalSnapshotToCollab = useCallback((
    planId: string,
    nextPlan: Plan,
    nextPositions: PlanPositions,
    nextFeedbacks?: Feedback[],
  ) => {
    const roomSession = getCollabSessionForPlanId(planId);
    if (!roomSession) return;
    const roomId = roomSession.roomId;
    const snapshot = {
      plan: cloneValue(nextPlan),
      positions: cloneValue(nextPositions),
      feedbacks: cloneValue(nextFeedbacks ?? feedbacksForPlan(nextPlan, feedbacksRef.current)),
    };
    const signature = buildSharedSnapshotSignature(snapshot);
    lastLocalCollabSyncSignaturesRef.current[roomId] = signature;
    setCollabSessions((prev) =>
      prev[roomId]
        ? {
            ...prev,
            [roomId]: {
              ...prev[roomId],
              planId: snapshot.plan.id,
              planTitle: snapshot.plan.title,
              snapshot,
            },
          }
        : prev,
    );
    collabDocsRef.current[roomId]?.syncFromSnapshot(snapshot, { kind: "local-ui" });
  }, [getCollabSessionForPlanId]);

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
        const remoteSnapshots = Object.values(collabSessionsRef.current)
          .map((session) => session.snapshot)
          .filter((snapshot): snapshot is SharedPlanSnapshot => !!snapshot);
        const snapshotPlanIds = new Set(remoteSnapshots.map((snapshot) => snapshot.plan.id));
        const collabCardIds = new Set(remoteSnapshots.flatMap((snapshot) => snapshot.plan.steps.map((card) => card.id)));
        const nextPlans = [
          ...s.plans.filter((candidate) => !snapshotPlanIds.has(candidate.id)),
          ...remoteSnapshots.map((snapshot) => snapshot.plan),
        ];
        const nextPositions = {
          ...s.positions,
          ...Object.fromEntries(remoteSnapshots.map((snapshot) => [snapshot.plan.id, snapshot.positions])),
        };
        const nextFeedbacks = [
          ...s.feedbacks.filter((feedback) => !collabCardIds.has(feedback.cardId)),
          ...remoteSnapshots.flatMap((snapshot) => snapshot.feedbacks ?? []),
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
          return plansRef.current.find((candidate) => candidate.id === nextPlan.id) ?? nextPlan;
        });

        const currentActivePlanId = activePlanIdRef.current;
        if (currentActivePlanId && !getCollabSessionForPlanId(currentActivePlanId)) {
          const nextActivePlan = adjustedPlans.find((candidate) => candidate.id === currentActivePlanId) ?? null;
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
  }, [getCollabSessionForPlanId, invalidateUndoRedoIfExternalPlanChange]);

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
    lastUndoPreservingSignatureRef.current = null;
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
        const h = await api.fetchHistory(activePlanId, {
          limit: HISTORY_PAGE_LIMIT,
          base: apiBaseForPlan(activePlanId),
        });
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

  useEffect(() => {
    const activeRoomIds = new Set(Object.keys(collabSessions));

    Object.keys(peerSessionsRef.current).forEach((roomId) => {
      if (activeRoomIds.has(roomId)) return;
      destroyCollabRoom(roomId);
    });

    Object.values(collabSessions).forEach((session) => {
      if (!session.roomId || !session.selfSessionId) return;

      if (!collabDocsRef.current[session.roomId]) {
        const roomId = session.roomId;
        const initialSnapshot =
          session.snapshot ?? (session.status === "hosting" ? buildPeerSnapshot(session.planId) : null);
        const doc = new FlowPlanCollabDoc(initialSnapshot);
        const unsubscribe = doc.onUpdate((update, snapshot, origin) => {
          const signature = buildSharedSnapshotSignature(snapshot);
          lastPeerSnapshotSignaturesRef.current[roomId] = signature;

          setCollabSessions((prev) =>
            prev[roomId]
              ? {
                  ...prev,
                  [roomId]: {
                    ...prev[roomId],
                    planId: snapshot.plan.id,
                    planTitle: snapshot.plan.title,
                    snapshot,
                  },
                }
              : prev,
          );

          if (origin.kind === "peer_state" || origin.kind === "peer_update") {
            const nextRevision = (collabRevisionsRef.current[roomId] ?? 0) + 1;
            applyPeerSnapshot(
              roomId,
              snapshot,
              nextRevision,
              resolveParticipantLabel(roomId, origin.fromSessionId),
              resolveParticipantAvatarSeed(roomId, origin.fromSessionId),
              origin.kind === "peer_update",
            );
          }

          const currentSession = collabSessionsRef.current[roomId];
          const shouldBroadcast =
            origin.kind === "local-ui" ||
            (origin.kind === "peer_update" && currentSession?.status === "hosting");
          if (shouldBroadcast) {
            peerSessionsRef.current[roomId]?.broadcastDocUpdate(
              update,
              origin.kind === "peer_update" ? origin.fromSessionId : currentSession?.selfSessionId,
            );
          }
        });

        collabDocsRef.current[roomId] = doc;
        collabDocUnsubsRef.current[roomId] = unsubscribe;
      }

      if (!peerSessionsRef.current[session.roomId]) {
        const roomId = session.roomId;
        const peer = new FlowPlanPeerSession({
          session,
          getInitialDocUpdate: () => collabDocsRef.current[roomId]?.getStateUpdate() ?? null,
          onParticipants: (participants) => {
            setCollabSessions((prev) =>
              prev[roomId]
                ? {
                    ...prev,
                    [roomId]: {
                      ...prev[roomId],
                      participants,
                    },
                  }
                : prev,
            );
            setCursorPresences((prev) => {
              const roomCursors = prev[roomId];
              if (!roomCursors) return prev;
              const participantIds = new Set(participants.map((participant) => participant.sessionId));
              const nextRoomCursors = Object.fromEntries(
                Object.entries(roomCursors).filter(([sessionId]) => participantIds.has(sessionId)),
              );
              const previousKeys = Object.keys(roomCursors);
              const nextKeys = Object.keys(nextRoomCursors);
              if (
                previousKeys.length === nextKeys.length &&
                previousKeys.every((sessionId) => participantIds.has(sessionId))
              ) {
                return prev;
              }
              return { ...prev, [roomId]: nextRoomCursors };
            });
          },
          onHostAvailabilityChange: (available, graceMs) => {
            const session = collabSessionsRef.current[roomId];
            if (!session || session.status !== "joined") return;
            if (available) {
              showToast("Host reconnected", roomId);
              return;
            }
            const seconds = graceMs ? Math.max(1, Math.round(graceMs / 1000)) : 10;
            showToast("Host disconnected · waiting to recover", `${roomId} · up to ${seconds}s`, true);
          },
          onDocUpdate: (update, _transportPeerSessionId, authorSessionId, kind) => {
            collabDocsRef.current[roomId]?.applyRemoteUpdate(
              update,
              authorSessionId,
              kind === "doc_state" ? "state" : "update",
            );
          },
          onTransportStateChange: (state) => {
            setCollabTransportStates((prev) => {
              const current = prev[roomId];
              if (current && current.signal === state.signal && current.peer === state.peer) {
                return prev;
              }
              return {
                ...prev,
                [roomId]: state,
              };
            });
          },
          onCursor: (cursor, transportPeerSessionId, authorSessionId) => {
            const ownerSessionId = authorSessionId ?? transportPeerSessionId;
            const currentSession = collabSessionsRef.current[roomId];
            if (!ownerSessionId || ownerSessionId === currentSession?.selfSessionId) return;

            setCursorPresences((prev) => {
              const roomCursors = prev[roomId] ?? {};
              const previousCursor = roomCursors[ownerSessionId];
              if (
                previousCursor &&
                previousCursor.x === cursor.x &&
                previousCursor.y === cursor.y &&
                previousCursor.active === cursor.active
              ) {
                return prev;
              }
              return {
                ...prev,
                [roomId]: {
                  ...roomCursors,
                  [ownerSessionId]: {
                    x: cursor.x,
                    y: cursor.y,
                    active: cursor.active,
                    lastUpdated: Date.now(),
                  },
                },
              };
            });

            if (collabSessionsRef.current[roomId]?.status === "hosting") {
              peerSessionsRef.current[roomId]?.broadcastCursor(cursor, ownerSessionId, transportPeerSessionId);
            }
          },
          onRoomClosed: () => {
            const latestSession = collabSessionsRef.current[roomId];
            if (latestSession) {
              rememberDisconnectedFork(latestSession);
            }
            destroyCollabRoom(roomId);
            setCollabSessions((prev) => {
              if (!prev[roomId]) return prev;
              const { [roomId]: _removed, ...rest } = prev;
              return rest;
            });
            showToast(
              latestSession?.status === "joined" ? "Collaboration ended · editing local copy" : "Collaboration ended",
              roomId,
              true,
            );
          },
          onError: (message) => {
            if (isTerminalCollabError(message)) {
              destroyCollabRoom(roomId);
              setCollabSessions((prev) => {
                if (!prev[roomId]) return prev;
                const { [roomId]: _removed, ...rest } = prev;
                return rest;
              });
              const details = describeCollabError(message);
              showCollabDialog(details.title, details.message);
              return;
            }
            showToast(message, roomId, true);
          },
        });
        peerSessionsRef.current[roomId] = peer;
        peer.connect();
      }
    });
  }, [applyPeerSnapshot, buildPeerSnapshot, collabSessions, describeCollabError, destroyCollabRoom, isTerminalCollabError, rememberDisconnectedFork, resolveParticipantAvatarSeed, resolveParticipantLabel, showCollabDialog, showToast]);

  useEffect(() => {
    return () => {
      Object.keys(peerSessionsRef.current).forEach((roomId) => destroyCollabRoom(roomId));
    };
  }, [destroyCollabRoom]);

  const plan = useMemo(() => plans.find((p) => p.id === activePlanId) ?? null, [plans, activePlanId]);
  const steps = plan?.steps ?? EMPTY_STEPS;
  const selectedCard = useMemo(
    () => steps.find((s) => s.id === selectedCardId) ?? null,
    [steps, selectedCardId],
  );
  const collabSessionList = useMemo(() => Object.values(collabSessions), [collabSessions]);
  const collabStatusByPlan = useMemo(
    () =>
      collabSessionList.reduce<Record<string, "hosting" | "joined">>((acc, session) => {
        if (session.planId) acc[session.planId] = session.status;
        return acc;
      }, {}),
    [collabSessionList],
  );
  const collabSessionForPlan = useMemo(
    () => (plan ? collabSessionList.find((session) => session.planId === plan.id) ?? null : null),
    [collabSessionList, plan],
  );
  const collabTransportForPlan = useMemo(
    () => (collabSessionForPlan ? collabTransportStates[collabSessionForPlan.roomId] ?? null : null),
    [collabSessionForPlan, collabTransportStates],
  );
  const pendingCollabSession = useMemo(
    () => collabSessionList.find((session) => !session.planId) ?? null,
    [collabSessionList],
  );
  const connectModalSession = collabSessionForPlan ?? pendingCollabSession;
  const activeUsers = useMemo(() => {
    if (!plan) return [];
    if (collabSessionForPlan) return collabSessionForPlan.participants;
    return [
      {
        sessionId: `local-${profile.userId}`,
        userId: profile.userId,
        username: profile.username,
        avatarSeed: profile.avatarSeed,
        isSelf: true,
        status: "active" as const,
      },
    ];
  }, [collabSessionForPlan, plan, profile]);
  const activeCollabCursors = useMemo(() => {
    if (!collabSessionForPlan) return [];
    const roomCursors = cursorPresences[collabSessionForPlan.roomId] ?? {};

    return collabSessionForPlan.participants
      .filter((participant) => !participant.isSelf)
      .map((participant) => {
        const cursor = roomCursors[participant.sessionId];
        if (!cursor?.active) return null;
        return {
          sessionId: participant.sessionId,
          username: participant.username,
          avatarSeed: participant.avatarSeed,
          x: cursor.x,
          y: cursor.y,
          lastUpdated: cursor.lastUpdated,
        };
      })
      .filter((cursor): cursor is { sessionId: string; username: string; avatarSeed: string; x: number; y: number; lastUpdated: number } => !!cursor)
      .sort((left, right) => left.lastUpdated - right.lastUpdated)
      .map(({ lastUpdated: _lastUpdated, ...cursor }) => cursor);
  }, [collabSessionForPlan, cursorPresences]);
  const currentActorId = useMemo(
    () => sanitizeUsername(profile.username) || profile.userId,
    [profile.userId, profile.username],
  );
  const currentActorAvatarSeed = useMemo(() => profile.avatarSeed, [profile.avatarSeed]);

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
  const currentPlanFeedbacks = useMemo(() => feedbacksForPlan(plan, feedbacks), [feedbacks, plan]);
  const collabPlanSignature = useMemo(
    () =>
      collabSessionForPlan && plan
        ? buildSharedSnapshotSignature({
            plan,
            positions: savedPositions,
            feedbacks: currentPlanFeedbacks,
          })
        : null,
    [collabSessionForPlan, currentPlanFeedbacks, plan, savedPositions],
  );
  useEffect(() => {
    const signature = buildPlanSignature(plan, savedPositions);
    if (!signature) {
      lastPlanSignatureRef.current = null;
      return;
    }

    lastPlanSignatureRef.current = signature;
    if (signature === lastUndoPreservingSignatureRef.current) {
      lastUndoPreservingSignatureRef.current = null;
    }
  }, [plan, savedPositions]);

  useEffect(() => {
    if (!collabSessionForPlan || !plan || !collabPlanSignature) return;
    const roomId = collabSessionForPlan.roomId;
    if (applyingPeerSnapshotRoomsRef.current[roomId]) return;
    if (lastPeerSnapshotSignaturesRef.current[roomId] === collabPlanSignature) return;
    if (lastLocalCollabSyncSignaturesRef.current[roomId] === collabPlanSignature) {
      delete lastLocalCollabSyncSignaturesRef.current[roomId];
      return;
    }

    const snapshot = {
      plan: cloneValue(plan),
      positions: cloneValue(savedPositions),
      feedbacks: cloneValue(currentPlanFeedbacks),
    };
    lastPeerSnapshotSignaturesRef.current[roomId] = collabPlanSignature;
    setCollabSessions((prev) =>
      prev[roomId]
        ? {
            ...prev,
            [roomId]: {
              ...prev[roomId],
              planId: snapshot.plan.id,
              planTitle: snapshot.plan.title,
              snapshot,
            },
          }
        : prev,
    );
    collabDocsRef.current[roomId]?.syncFromSnapshot(snapshot, { kind: "local-ui" });
  }, [collabPlanSignature, collabSessionForPlan, currentPlanFeedbacks, plan, savedPositions]);

  useEffect(() => {
    if (!collabSessionForPlan || !canvasViewport) return;

    const roomId = collabSessionForPlan.roomId;
    const selfSessionId = collabSessionForPlan.selfSessionId;
    let lastSentAt = 0;
    let lastX = 0;
    let lastY = 0;
    let active = false;
    let pendingCursor: { x: number; y: number; active: boolean } | null = null;
    let pendingTimer: number | null = null;

    const sendCursor = (x: number, y: number, nextActive: boolean) => {
      lastX = x;
      lastY = y;
      active = nextActive;
      lastSentAt = performance.now();
      peerSessionsRef.current[roomId]?.broadcastCursor({ x, y, active: nextActive }, selfSessionId);
    };

    const clearPending = () => {
      if (pendingTimer) {
        window.clearTimeout(pendingTimer);
        pendingTimer = null;
      }
    };

    const flushPending = () => {
      clearPending();
      if (!pendingCursor) return;
      const next = pendingCursor;
      pendingCursor = null;
      sendCursor(next.x, next.y, next.active);
    };

    const scheduleCursor = (x: number, y: number, nextActive: boolean) => {
      pendingCursor = { x, y, active: nextActive };
      const now = performance.now();
      const wait = Math.max(0, CURSOR_SEND_INTERVAL_MS - (now - lastSentAt));
      if (wait === 0) {
        flushPending();
        return;
      }
      if (pendingTimer) return;
      pendingTimer = window.setTimeout(() => {
        flushPending();
      }, wait);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvasFrame;
      const viewport = canvasViewport;
      if (!rect || !viewport || rect.width <= 0 || rect.height <= 0 || viewport.zoom <= 0) return;
      if (
        event.clientX < rect.left ||
        event.clientX > rect.left + rect.width ||
        event.clientY < rect.top ||
        event.clientY > rect.top + rect.height
      ) {
        handleInactive();
        return;
      }
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const x = (localX - viewport.x) / viewport.zoom;
      const y = (localY - viewport.y) / viewport.zoom;
      const flowThreshold = 12 / viewport.zoom;
      const reference = pendingCursor ?? { x: lastX, y: lastY, active };
      if (
        reference.active &&
        Math.abs(x - reference.x) < flowThreshold &&
        Math.abs(y - reference.y) < flowThreshold
      ) {
        return;
      }
      scheduleCursor(x, y, true);
    };

    const handleInactive = () => {
      const reference = pendingCursor ?? { x: lastX, y: lastY, active };
      if (!reference.active) return;
      scheduleCursor(reference.x, reference.y, false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleInactive();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("blur", handleInactive);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.documentElement.addEventListener("mouseleave", handleInactive);

    return () => {
      handleInactive();
      flushPending();
      clearPending();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", handleInactive);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.documentElement.removeEventListener("mouseleave", handleInactive);
    };
  }, [canvasFrame, canvasViewport, collabSessionForPlan?.roomId, collabSessionForPlan?.selfSessionId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setCursorPresences((prev) => {
        let changed = false;
        const nextRooms = Object.fromEntries(
          Object.entries(prev).flatMap(([roomId, roomCursors]) => {
            const nextRoomCursors = Object.fromEntries(
              Object.entries(roomCursors).filter(([, cursor]) => now - cursor.lastUpdated <= CURSOR_STALE_TIMEOUT_MS),
            );
            if (Object.keys(nextRoomCursors).length !== Object.keys(roomCursors).length) {
              changed = true;
            }
            return Object.keys(nextRoomCursors).length > 0 ? [[roomId, nextRoomCursors]] : [];
          }),
        );
        return changed ? nextRooms : prev;
      });
    }, 10_000);

    return () => window.clearInterval(timer);
  }, []);

  const applyLocalPlanSnapshot = useCallback(
    (
      planId: string,
      nextPlan: Plan,
      nextPositions: PlanPositions,
      nextSelectedCardId: string | null,
      stackBehavior: UndoStackBehavior = "ignore",
    ) => {
      const signature = buildPlanSignature(nextPlan, nextPositions);
      if (signature && stackBehavior === "preserve") {
        lastUndoPreservingSignatureRef.current = signature;
      } else if (stackBehavior === "invalidate") {
        invalidateUndoRedoStacks();
      }
      setPlans((prev) => prev.map((candidate) => (candidate.id === planId ? nextPlan : candidate)));
      setPositions((prev) => {
        const prevPlanPositions = prev[planId] ?? EMPTY_PLAN_POSITIONS;
        if (arePositionsEqual(prevPlanPositions, nextPositions)) return prev;
        return { ...prev, [planId]: nextPositions };
      });
      setSelectedCardId(nextSelectedCardId);
      syncLocalSnapshotToCollab(planId, nextPlan, nextPositions);
    },
    [invalidateUndoRedoStacks, syncLocalSnapshotToCollab],
  );

  const pushUndoAction = useCallback((action: UiUndoAction) => {
    setUndoStack((prev) => keepLastUndoActions(prev, action));
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
        invalidateUndoRedoStacks();
        markPendingPlanMutation(currentPlanId, currentPlan, positions);
        syncLocalSnapshotToCollab(currentPlanId, currentPlan, positions);
      }
      setPositions((prev) => {
        const prevPlanPositions = prev[currentPlanId];
        if (prevPlanPositions && arePositionsEqual(prevPlanPositions, positions)) return prev;
        return { ...prev, [currentPlanId]: positions };
      });
      api
        .savePositions(currentPlanId, positions, apiBaseForPlan(currentPlanId), sessionIdForPlan(currentPlanId))
        .then(() => {
          clearPendingPlanMutation(currentPlanId);
        })
        .catch(() => {
          clearPendingPlanMutation(currentPlanId);
        });
    },
    [apiBaseForPlan, clearPendingPlanMutation, invalidateUndoRedoStacks, markPendingPlanMutation, sessionIdForPlan, syncLocalSnapshotToCollab],
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
        const result = await api.importPlan(data, undefined, currentActorId, currentActorAvatarSeed);
        if (!activePlanIdRef.current) setActivePlanId(result.id);
        showToast("Imported", data.title);
      } catch {
        showToast("Could not import plan", file.name, true);
      }
    };
    input.click();
  }, [currentActorAvatarSeed, currentActorId, showToast]);

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
    setCollabSessions((prev) => {
      const next = { ...prev };
      Object.entries(prev).forEach(([roomId, session]) => {
        if (session.planId !== id) return;
        destroyCollabRoom(roomId);
        delete next[roomId];
      });
      return next;
    });
    api.deletePlan(id, apiBaseForPlan(id), sessionIdForPlan(id)).catch(() => {});
  }, [apiBaseForPlan, destroyCollabRoom, sessionIdForPlan]);

  const handleTogglePin = useCallback(async (id: string) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p)));
    api.togglePin(id, apiBaseForPlan(id), sessionIdForPlan(id)).catch(() => {});
  }, [apiBaseForPlan, sessionIdForPlan]);

  const handleNewPlan = useCallback(() => setNewPlanModal(true), []);
  const handleNewCard = useCallback(() => setNewCardModal(true), []);
  const handleOpenSettings = useCallback(() => setSettingsOpen(true), []);
  const handleOpenConnectModal = useCallback(() => {
    setConnectModalOpen(true);
  }, []);
  const applyProfileIdentity = useCallback((nextProfile: CollabProfile) => {
    setProfile(nextProfile);
    setCollabSessions((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([roomId, session]) => [
          roomId,
          {
            ...session,
            participants: session.participants.map((participant) =>
              participant.isSelf
                ? {
                    ...participant,
                    userId: nextProfile.userId,
                    username: nextProfile.username,
                    avatarSeed: nextProfile.avatarSeed,
                  }
                : participant,
            ),
          },
        ]),
      ),
    );
    Object.values(peerSessionsRef.current).forEach((peerSession) => {
      peerSession.updateSelfProfile(nextProfile);
    });
  }, []);
  const handleSaveProfile = useCallback((nextProfile: CollabProfile) => {
    applyProfileIdentity(nextProfile);
    setSettingsOpen(false);
    showToast("Saved settings", nextProfile.username);
  }, [applyProfileIdentity, showToast]);
  const beginCollabSession = useCallback(async (draft: ConnectPlanDraft) => {
    const currentPlanId = activePlanIdRef.current;
    if (collabSessionsRef.current[draft.roomId.trim()]) {
      setDialog({
        title: "Room Already Connected",
        message: "This room is already active in the current app window.",
      });
      return;
    }
    if (draft.mode === "host" && !currentPlanId) {
      setDialog({
        title: "Select A Plan",
        message: "Choose the plan you want to host before starting a collaboration session.",
      });
      return;
    }
    if (draft.mode === "host" && getCollabSessionForPlanId(currentPlanId)) {
      setDialog({
        title: "Plan Already Connected",
        message: "This plan already has an active collaboration session. Disconnect it first to host a new room.",
      });
      return;
    }
    setCollabBusy(true);
    try {
      const currentPlan =
        draft.mode === "host"
          ? plansRef.current.find((candidate) => candidate.id === currentPlanId) ?? null
          : plansRef.current.find((candidate) => candidate.id === currentPlanId) ?? null;
      const session =
        draft.mode === "host" && currentPlan
          ? {
              ...createHostSession(profile, currentPlan, draft),
              snapshot: {
                plan: cloneValue(currentPlan),
                positions: cloneValue(positionsRef.current[currentPlan.id] ?? EMPTY_PLAN_POSITIONS),
                feedbacks: cloneValue(feedbacksForPlan(currentPlan, feedbacksRef.current)),
              },
            }
          : createJoinSession(profile, null, draft);
      if (session.snapshot) {
        applyCollabSnapshotToLocalState(session, setPlans, setPositions, setFeedbacks);
      }
      setCollabSessions((prev) => ({
        ...prev,
        [session.roomId]: {
          ...session,
          joinSecret: draft.joinSecret,
        },
      }));
      if (session.planId) {
        setActivePlanId(session.planId);
      }
      clearDisconnectedFork(session.roomId);
      setConnectModalOpen(false);
      if (draft.mode === "join") {
        const defaults = loadConnectionDefaults();
        saveConnectionDefaults({
          ...defaults,
          lastJoinRoomId: draft.roomId.trim(),
          lastJoinSecret: draft.joinSecret.trim(),
        });
      }
      showToast(session.status === "hosting" ? "P2P host ready" : "Joining P2P room", session.roomId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Collaboration connection failed";
      showToast(message, draft.roomId || currentPlanId || "", true);
    } finally {
      setCollabBusy(false);
    }
  }, [clearDisconnectedFork, getCollabSessionForPlanId, profile, showToast]);

  const handleStartCollabSession = useCallback(async (draft: ConnectPlanDraft) => {
    const roomId = draft.roomId.trim();
    if (draft.mode === "join") {
      const fork = disconnectedForksRef.current[roomId];
      if (fork && isDisconnectedForkDirty(fork)) {
        setRejoinPrompt({
          draft: { ...draft, roomId },
          fork,
        });
        return;
      }
    }

    await beginCollabSession(draft);
  }, [beginCollabSession, isDisconnectedForkDirty]);

  const handleResolveForkAndJoin = useCallback(async (strategy: "discard" | "duplicate") => {
    if (!rejoinPrompt) return;
    const { draft, fork } = rejoinPrompt;
    setRejoinPrompt(null);

    if (strategy === "duplicate") {
      const currentPlan = plansRef.current.find((candidate) => candidate.id === fork.planId) ?? null;
      if (currentPlan) {
        try {
          const result = await api.forkPlan(
            fork.planId,
            `${currentPlan.title} local copy`,
            apiBaseForPlan(fork.planId),
            currentActorId,
            currentActorAvatarSeed,
          );
          showToast("Saved local copy", result.title);
        } catch {
          showToast("Could not save local copy", fork.planTitle, true);
          return;
        }
      }
    }

    await beginCollabSession(draft);
  }, [apiBaseForPlan, beginCollabSession, currentActorAvatarSeed, currentActorId, rejoinPrompt, showToast]);

  const handleDisconnectSession = useCallback(async (roomId?: string | null) => {
    const targetRoom = roomId ?? connectModalSession?.roomId ?? collabSessionForPlan?.roomId ?? "";
    const session = collabSessionsRef.current[targetRoom];
    const currentRoom = session?.roomId ?? targetRoom;
    if (!currentRoom) return;
    setCollabBusy(true);
    try {
      if (session?.status === "joined") {
        rememberDisconnectedFork(session);
      }
      destroyCollabRoom(currentRoom);
      setCollabSessions((prev) => {
        if (!prev[currentRoom]) return prev;
        const { [currentRoom]: _removed, ...rest } = prev;
        return rest;
      });
      if (connectModalSession?.roomId === currentRoom) {
        setConnectModalOpen(false);
      }
      showToast("Disconnected", currentRoom);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Disconnect failed";
      showToast(message, currentRoom, true);
    } finally {
      setCollabBusy(false);
    }
  }, [collabSessionForPlan, connectModalSession, destroyCollabRoom, rememberDisconnectedFork, showToast]);

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
          for (const dependencyRestore of action.restoredDependencies) {
            await api.updateCard(
              action.planId,
              dependencyRestore.cardId,
              { dependencies: dependencyRestore.dependencies },
              source,
              base,
              sessionId,
              currentActorId,
              currentActorAvatarSeed,
            );
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
          {
            dependencies: direction === "undo" ? action.beforeDependencies : action.afterDependencies,
          },
          source,
          base,
          sessionId,
          currentActorId,
          currentActorAvatarSeed,
        );
        return;
    }
  }, [apiBaseForPlan, currentActorAvatarSeed, currentActorId, sessionIdForPlan]);

  const applyUndoableSnapshot = useCallback(
    (action: UiUndoAction, direction: "undo" | "redo") => {
      const nextPlan = cloneValue(direction === "undo" ? action.beforePlan : action.afterPlan);
      const currentPositions = cloneValue(positionsRef.current[action.planId] ?? EMPTY_PLAN_POSITIONS);
      const nextPositions = mergeUndoPositions(action, direction, currentPositions);
      const nextSelectedCardId = direction === "undo" ? action.beforeSelectedCardId : action.afterSelectedCardId;
      markPendingPlanMutation(action.planId, nextPlan, nextPositions);
      applyLocalPlanSnapshot(action.planId, nextPlan, nextPositions, nextSelectedCardId, "preserve");
    },
    [applyLocalPlanSnapshot, markPendingPlanMutation],
  );

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
      ...buildUndoGuardContext(currentAId),
    };

    markPendingPlanMutation(currentAId, afterPlan, afterPositions);
    applyLocalPlanSnapshot(currentAId, cloneValue(afterPlan), cloneValue(afterPositions), action.afterSelectedCardId, "preserve");
    setFeedbacks((prev) => prev.filter((feedback) => feedback.cardId !== cardId));
    pushUndoAction(action);
    try {
      await api.deleteCard(
        currentAId,
        cardId,
        "rest",
        apiBaseForPlan(currentAId),
        sessionIdForPlan(currentAId),
        currentActorId,
        currentActorAvatarSeed,
      );
      clearPendingPlanMutation(currentAId);
    } catch {
      clearPendingPlanMutation(currentAId);
      applyLocalPlanSnapshot(currentAId, cloneValue(beforePlan), cloneValue(beforePositions), action.beforeSelectedCardId, "preserve");
      setFeedbacks((prev) => [...prev, ...removedFeedbacks]);
      setUndoStack((prev) => prev.slice(0, -1));
      showToast("Delete failed", removedCard.title, true);
    }
  }, [apiBaseForPlan, applyLocalPlanSnapshot, buildUndoGuardContext, clearPendingPlanMutation, currentActorAvatarSeed, currentActorId, markPendingPlanMutation, pushUndoAction, sessionIdForPlan, showToast]);

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
      ...buildUndoGuardContext(currentAId),
    };

    markPendingPlanMutation(currentAId, afterPlan, beforePositions);
    applyLocalPlanSnapshot(currentAId, cloneValue(afterPlan), cloneValue(beforePositions), action.afterSelectedCardId, "preserve");
    pushUndoAction(action);
    try {
      await api.updateCard(
        currentAId,
        targetId,
        { dependencies: afterDependencies },
        "rest",
        apiBaseForPlan(currentAId),
        sessionIdForPlan(currentAId),
        currentActorId,
        currentActorAvatarSeed,
      );
      clearPendingPlanMutation(currentAId);
    } catch {
      clearPendingPlanMutation(currentAId);
      applyLocalPlanSnapshot(currentAId, cloneValue(beforePlan), cloneValue(beforePositions), action.beforeSelectedCardId, "preserve");
      setUndoStack((prev) => prev.slice(0, -1));
      showToast("Dependency add failed", targetCard.title, true);
    }
  }, [apiBaseForPlan, applyLocalPlanSnapshot, buildUndoGuardContext, clearPendingPlanMutation, currentActorAvatarSeed, currentActorId, markPendingPlanMutation, pushUndoAction, sessionIdForPlan, showToast]);

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
      ...buildUndoGuardContext(currentAId),
    };

    markPendingPlanMutation(currentAId, afterPlan, beforePositions);
    applyLocalPlanSnapshot(currentAId, cloneValue(afterPlan), cloneValue(beforePositions), action.afterSelectedCardId, "preserve");
    pushUndoAction(action);
    try {
      await api.updateCard(
        currentAId,
        targetId,
        { dependencies: afterDependencies },
        "rest",
        apiBaseForPlan(currentAId),
        sessionIdForPlan(currentAId),
        currentActorId,
        currentActorAvatarSeed,
      );
      clearPendingPlanMutation(currentAId);
    } catch {
      clearPendingPlanMutation(currentAId);
      applyLocalPlanSnapshot(currentAId, cloneValue(beforePlan), cloneValue(beforePositions), action.beforeSelectedCardId, "preserve");
      setUndoStack((prev) => prev.slice(0, -1));
      showToast("Dependency remove failed", targetCard.title, true);
    }
  }, [apiBaseForPlan, applyLocalPlanSnapshot, buildUndoGuardContext, clearPendingPlanMutation, currentActorAvatarSeed, currentActorId, markPendingPlanMutation, pushUndoAction, sessionIdForPlan, showToast]);

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
  const canToolbarUndo = !canvasReadOnly && !undoRedoBusy && isUndoActionSafe(undoStack[undoStack.length - 1]);
  const canToolbarRedo = !canvasReadOnly && !undoRedoBusy && isUndoActionSafe(redoStack[redoStack.length - 1]);
  const undoDisabledReason =
    !canvasReadOnly && !undoRedoBusy && undoStack.length > 0 && !isUndoActionSafe(undoStack[undoStack.length - 1])
      ? "Remote changes invalidated your undo stack"
      : undefined;
  const redoDisabledReason =
    !canvasReadOnly && !undoRedoBusy && redoStack.length > 0 && !isUndoActionSafe(redoStack[redoStack.length - 1])
      ? "Remote changes invalidated your undo stack"
      : undefined;
  const presenceRightOffset = histOpen
    ? "calc(var(--spacing-fp-history) + var(--spacing-fp-gap) * 2)"
    : selectedCard
      ? "calc(var(--spacing-fp-drawer) + var(--spacing-fp-gap) * 2)"
      : "var(--spacing-fp-gap)";
  const presenceStatusLabel = collabSessionForPlan
    ? collabSessionForPlan.status === "hosting"
      ? "Hosting"
      : "Joined"
    : "Local";

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
              onFrameChange={setCanvasFrame}
              onViewportChange={setCanvasViewport}
            />
            </div>
          </div>
        )}
      </div>

      <CollabCursorLayer cursors={activeCollabCursors} frame={canvasFrame} viewport={canvasViewport} />

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
          onOpenSettings={handleOpenSettings}
          connected={connected}
          onConnectPlan={handleOpenConnectModal}
          onDisconnectPlan={collabSessionForPlan ? () => void handleDisconnectSession(collabSessionForPlan.roomId) : undefined}
          collabSession={collabSessionForPlan}
          collabTransportState={collabTransportForPlan}
          collabSessionCount={collabSessionList.length}
          collabStatusByPlan={collabStatusByPlan}
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
            undoDisabledReason={undoDisabledReason}
            redoDisabledReason={redoDisabledReason}
            planTitle={plan.title}
            planId={plan.id}
          />
        </div>
      )}

      {plan && (
        <div
          className="fixed z-10"
          style={{ top: "var(--spacing-fp-gap)", right: presenceRightOffset }}
        >
          <div className="h-[var(--spacing-fp-toolbar)] border border-white/8 bg-[rgba(32,33,36,0.58)] backdrop-blur-[28px] supports-[backdrop-filter]:backdrop-saturate-150 rounded-full inline-flex items-center gap-3 px-3.5 shrink-0 animate-toolbar-in">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-2.5 py-1">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  collabSessionForPlan
                    ? collabSessionForPlan.status === "hosting"
                      ? "bg-fp-accent"
                      : "bg-fp-info"
                    : "bg-white/28"
                }`}
              />
              <span className="text-[11px] font-medium text-white/62">{presenceStatusLabel}</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-[11px] font-medium text-white/74">
                  {activeUsers.length} active
                </div>
                <div className="text-[10px] text-white/28">
                  {collabSessionForPlan ? collabSessionForPlan.roomId : "Current plan"}
                </div>
              </div>
              <AvatarGroup users={activeUsers} />
            </div>
          </div>
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
            profile={profile}
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
                await api.clearHistory(
                  activePlanId,
                  apiBaseForPlan(activePlanId),
                  sessionIdForPlan(activePlanId),
                );
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
            key={[
              selectedCard.id,
              selectedCard.title,
              selectedCard.description,
              selectedCard.type,
              selectedCard.repo,
              selectedCard.files.join("|"),
              selectedCard.dependencies.join("|"),
            ].join("::")}
            card={selectedCard}
            feedbacks={feedbacks.filter((f) => f.cardId === selectedCard.id)}
            onClose={() => setSelectedCardId(null)}
            onAddFeedback={async (c, t, x) => {
              try {
                const result = await api.addFeedback(
                  c,
                  t as any,
                  x,
                  profile.userId,
                  profile.username,
                  profile.avatarSeed,
                );
                const nextFeedback: Feedback = {
                  id: result.id,
                  cardId: c,
                  type: t as Feedback["type"],
                  text: x,
                  answer: null,
                  timestamp: Date.now(),
                  read: false,
                  ownerUserId: profile.userId,
                  ownerUsername: profile.username,
                  ownerAvatarSeed: profile.avatarSeed,
                };
                const nextFeedbacks = [...feedbacksRef.current, nextFeedback];
                setFeedbacks(nextFeedbacks);
                if (plan) {
                  syncLocalSnapshotToCollab(
                    plan.id,
                    plan,
                    positionsRef.current[plan.id] ?? EMPTY_PLAN_POSITIONS,
                    feedbacksForPlan(plan, nextFeedbacks),
                  );
                }
              } catch {}
            }}
            onDeleteFeedback={async (id) => {
              try {
                await api.deleteFeedback(id);
                const nextFeedbacks = feedbacksRef.current.filter((feedback) => feedback.id !== id);
                setFeedbacks(nextFeedbacks);
                if (plan) {
                  syncLocalSnapshotToCollab(
                    plan.id,
                    plan,
                    positionsRef.current[plan.id] ?? EMPTY_PLAN_POSITIONS,
                    feedbacksForPlan(plan, nextFeedbacks),
                  );
                }
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
              const currentPlan = plansRef.current.find((candidate) => candidate.id === pid);
              if (!currentPlan) return;
              const currentCard = currentPlan.steps.find((candidate) => candidate.id === cid);
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
                steps: beforePlan.steps.map((candidate) => (candidate.id === cid ? nextCard : cloneValue(candidate))),
              };
              markPendingPlanMutation(pid, optimisticPlan, currentPositions);
              applyLocalPlanSnapshot(pid, optimisticPlan, currentPositions, cid, "invalidate");
              try {
                await api.updateCard(
                  pid,
                  cid,
                  updates,
                  "rest",
                  apiBaseForPlan(pid),
                  sessionIdForPlan(pid),
                  currentActorId,
                  currentActorAvatarSeed,
                );
                clearPendingPlanMutation(pid);
              } catch {
                clearPendingPlanMutation(pid);
                applyLocalPlanSnapshot(pid, beforePlan, currentPositions, cid, "ignore");
              }
            }}
          />
        </div>
      )}

      {codeViewer && (
        <CodeViewer
          key={`${codeViewer.cardId}:${codeViewer.path}`}
          path={codeViewer.path}
          change={codeViewer.change}
          onClose={() => setCodeViewer(null)}
          onSave={async (filePath, newContent) => {
            if (!activePlanId || !codeViewer.cardId) throw new Error("Missing active plan");
            const currentPlan = plansRef.current.find((candidate) => candidate.id === activePlanId);
            if (!currentPlan) throw new Error("Plan not found");
            const card = steps.find((s) => s.id === codeViewer.cardId);
            if (!card) throw new Error("Card not found");
            const updatedFileChanges = {
              ...card.fileChanges,
              [filePath]: { ...codeViewer.change, content: newContent },
            };
            const beforePlan = cloneValue(currentPlan);
            const currentPositions = cloneValue(positionsRef.current[activePlanId] ?? EMPTY_PLAN_POSITIONS);
            const optimisticPlan: Plan = {
              ...cloneValue(beforePlan),
              steps: beforePlan.steps.map((step) =>
                step.id === codeViewer.cardId
                  ? { ...cloneValue(step), fileChanges: updatedFileChanges }
                  : cloneValue(step),
              ),
            };
            markPendingPlanMutation(activePlanId, optimisticPlan, currentPositions);
            applyLocalPlanSnapshot(activePlanId, optimisticPlan, currentPositions, codeViewer.cardId, "invalidate");
            try {
              await api.updateCard(
                activePlanId,
                codeViewer.cardId,
                { fileChanges: updatedFileChanges },
                "rest",
                apiBaseForPlan(activePlanId),
                sessionIdForPlan(activePlanId),
                currentActorId,
                currentActorAvatarSeed,
              );
              clearPendingPlanMutation(activePlanId);
              showToast("Saved", filePath);
            } catch (error) {
              clearPendingPlanMutation(activePlanId);
              applyLocalPlanSnapshot(activePlanId, beforePlan, currentPositions, codeViewer.cardId, "ignore");
              showToast("Save failed", filePath, true);
              throw error;
            }
          }}
        />
      )}

      {newPlanModal && (
        <NewPlanModal
          actorId={currentActorId}
          actorAvatarSeed={currentActorAvatarSeed}
          onClose={() => setNewPlanModal(false)}
          onCreated={(newPlan) => {
            setPlans((prev) => [newPlan, ...prev]);
            setPositions((prev) => ({ ...prev, [newPlan.id]: EMPTY_PLAN_POSITIONS }));
            setActivePlanId(newPlan.id);
            setNewPlanModal(false);
            showToast("Plan created", newPlan.title);
          }}
        />
      )}

      {newCardModal && plan && (
        <NewCardModal
          planId={plan.id}
          existingCards={steps}
          apiBase={apiBaseForPlan(plan.id)}
          sessionId={sessionIdForPlan(plan.id)}
          actorId={currentActorId}
          actorAvatarSeed={currentActorAvatarSeed}
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
                ...buildUndoGuardContext(plan.id),
              };
              applyLocalPlanSnapshot(plan.id, cloneValue(afterPlan), cloneValue(beforePositions), card.id, "preserve");
              pushUndoAction(action);
            } else {
              setSelectedCardId(card.id);
            }
            setNewCardModal(false);
            showToast("Card added", "");
          }}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          profile={profile}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSaveProfile}
        />
      )}

      {connectModalOpen && (
        <ConnectPlanModal
          plan={plan}
          session={connectModalSession}
          onClose={() => setConnectModalOpen(false)}
          onConnect={handleStartCollabSession}
          busy={collabBusy}
        />
      )}

      {rejoinPrompt && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[1200] flex items-center justify-center animate-modal-overlay"
          onClick={() => setRejoinPrompt(null)}
        >
          <div
            className="relative w-[420px] flex flex-col animate-modal-in rounded-xl overflow-hidden border border-white/[0.08] bg-[rgba(32,33,36,0.95)] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h1 className="text-[16px] font-semibold text-fp-text mb-3">Host Has The Latest Shared Version</h1>
            <p className="text-[13px] text-white/50 leading-relaxed whitespace-pre-line mb-5">
              You edited this plan after the host session ended. Rejoining will use the host&apos;s current shared state.
              {"\n\n"}
              Choose what to do with your local changes first.
            </p>
            <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.025] px-4 py-3.5 mb-5">
              <div className="text-[11px] uppercase tracking-[0.12em] text-white/28 font-mono">Room</div>
              <div className="mt-1 text-[13px] font-medium text-white/78">{rejoinPrompt.fork.roomId}</div>
              <div className="mt-2 text-[11px] text-white/34">Shared plan: {rejoinPrompt.fork.planTitle}</div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="accent"
                size="md"
                onClick={() => void handleResolveForkAndJoin("discard")}
                disabled={collabBusy}
                className="w-full"
              >
                Sync To Host
              </Button>
              <Button
                variant="glassy"
                size="md"
                onClick={() => void handleResolveForkAndJoin("duplicate")}
                disabled={collabBusy}
                className="w-full"
              >
                Duplicate Local Copy, Then Sync
              </Button>
              <Button variant="ghost" size="md" onClick={() => setRejoinPrompt(null)} disabled={collabBusy} className="w-full">
                Cancel
              </Button>
            </div>
          </div>
        </div>
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
