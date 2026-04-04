import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type {
  Plan,
  Feedback,
  CollabProfile,
  CollabSession,
  CollabTransportState,
  ConnectPlanDraft,
} from "../types";
import type { SharedPlanSnapshot } from "../lib/p2p";
import type { PlanPositions } from "../lib/planUtils";
import {
  buildPlanSignature,
  buildSharedSnapshotSignature,
  feedbacksForPlan,
  applyCollabSnapshotToLocalState,
  cloneValue,
  EMPTY_PLAN_POSITIONS,
} from "../lib/planUtils";
import {
  createHostSession,
  createJoinSession,
  loadConnectionDefaults,
  loadStoredProfile,
  saveConnectionDefaults,
  saveStoredProfile,
  sanitizeUsername,
} from "../lib/collab";
import { FlowPlanCollabDoc } from "../lib/collabDoc";
import { FlowPlanPeerSession } from "../lib/p2p";
import * as api from "../lib/api";

export type CollabSessionMap = Record<string, CollabSession>;
type CollabTransportStateMap = Record<string, CollabTransportState>;
type CursorPresence = { x: number; y: number; active: boolean; lastUpdated: number };
export type CursorPresenceMap = Record<string, Record<string, CursorPresence>>;
type DisconnectedFork = {
  roomId: string;
  planId: string;
  planTitle: string;
  baselineSignature: string | null;
  disconnectedAt: number;
};
type CanvasFrame = { left: number; top: number; width: number; height: number };
type CanvasViewport = { x: number; y: number; zoom: number };

const CURSOR_SEND_INTERVAL_MS = 120;
const CURSOR_STALE_TIMEOUT_MS = 30_000;

interface UseCollaborationArgs {
  activePlanIdRef: { current: string | null };
  plansRef: { current: Plan[] };
  feedbacksRef: { current: Feedback[] };
  positionsRef: { current: Record<string, PlanPositions> };
  setPlans: React.Dispatch<React.SetStateAction<Plan[]>>;
  setFeedbacks: React.Dispatch<React.SetStateAction<Feedback[]>>;
  setPositions: React.Dispatch<React.SetStateAction<Record<string, PlanPositions>>>;
  setActivePlanId: React.Dispatch<React.SetStateAction<string | null>>;
  showToast: (text: string, file: string, error?: boolean) => void;
  showCollabDialog: (title: string, message: string) => void;
  invalidateUndoRedoIfExternalPlanChangeRef: { current: (planId: string | null | undefined, plan: Plan | null, positions: PlanPositions) => void };
  collabRevisionsRef: { current: Record<string, number> };
}

export function useCollaboration(args: UseCollaborationArgs) {
  const {
    activePlanIdRef,
    plansRef,
    feedbacksRef,
    positionsRef,
    setPlans,
    setFeedbacks,
    setPositions,
    setActivePlanId,
    showToast,
    showCollabDialog,
    invalidateUndoRedoIfExternalPlanChangeRef,
    collabRevisionsRef,
  } = args;

  const [profile, setProfile] = useState<CollabProfile>(() => loadStoredProfile());
  const [collabSessions, setCollabSessions] = useState<CollabSessionMap>({});
  const [collabTransportStates, setCollabTransportStates] = useState<CollabTransportStateMap>({});
  const [cursorPresences, setCursorPresences] = useState<CursorPresenceMap>({});
  const [disconnectedForks, setDisconnectedForks] = useState<Record<string, DisconnectedFork>>({});
  const [collabBusy, setCollabBusy] = useState(false);
  const [canvasFrame, setCanvasFrame] = useState<CanvasFrame | null>(null);
  const [canvasViewport, setCanvasViewport] = useState<CanvasViewport | null>(null);
  const [rejoinPrompt, setRejoinPrompt] = useState<{ draft: ConnectPlanDraft; fork: DisconnectedFork } | null>(null);

  const collabSessionsRef = useRef(collabSessions);
  collabSessionsRef.current = collabSessions;
  const disconnectedForksRef = useRef(disconnectedForks);
  disconnectedForksRef.current = disconnectedForks;
  const collabDocsRef = useRef<Record<string, FlowPlanCollabDoc>>({});
  const collabDocUnsubsRef = useRef<Record<string, () => void>>({});
  const peerSessionsRef = useRef<Record<string, FlowPlanPeerSession>>({});
  const applyingPeerSnapshotRoomsRef = useRef<Record<string, boolean>>({});
  const lastPeerSnapshotSignaturesRef = useRef<Record<string, string | null>>({});
  const lastLocalCollabSyncSignaturesRef = useRef<Record<string, string | null>>({});

  useEffect(() => { saveStoredProfile(profile); }, [profile]);

  const currentActorId = useMemo(
    () => sanitizeUsername(profile.username) || profile.userId,
    [profile.userId, profile.username],
  );
  const currentActorAvatarSeed = useMemo(() => profile.avatarSeed, [profile.avatarSeed]);

  const getCollabSessionForPlanId = useCallback((planId?: string | null) => {
    if (!planId) return null;
    return Object.values(collabSessionsRef.current).find((s) => s.planId === planId) ?? null;
  }, []);

  const buildPeerSnapshot = useCallback((planId?: string | null): SharedPlanSnapshot | null => {
    const resolvedPlanId = planId ?? activePlanIdRef.current;
    if (!resolvedPlanId) return null;
    const nextPlan = plansRef.current.find((c) => c.id === resolvedPlanId);
    if (!nextPlan) return null;
    return {
      plan: cloneValue(nextPlan),
      positions: cloneValue(positionsRef.current[resolvedPlanId] ?? EMPTY_PLAN_POSITIONS),
      feedbacks: cloneValue(feedbacksForPlan(nextPlan, feedbacksRef.current)),
    };
  }, [activePlanIdRef, plansRef, positionsRef, feedbacksRef]);

  const getCollabSnapshots = useCallback((): SharedPlanSnapshot[] => {
    return Object.values(collabSessionsRef.current)
      .map((session) => session.snapshot)
      .filter((snap): snap is SharedPlanSnapshot => !!snap);
  }, []);

  const resolveParticipantLabel = useCallback((roomId: string, sessionId?: string | null) => {
    if (!sessionId) return undefined;
    return collabSessionsRef.current[roomId]?.participants.find((p) => p.sessionId === sessionId)?.username;
  }, []);

  const resolveParticipantAvatarSeed = useCallback((roomId: string, sessionId?: string | null) => {
    if (!sessionId) return undefined;
    return collabSessionsRef.current[roomId]?.participants.find((p) => p.sessionId === sessionId)?.avatarSeed;
  }, []);

  const isTerminalCollabError = useCallback((message: string) => {
    const normalized = message.trim().toLowerCase();
    return [
      "room not found", "invalid join secret", "room already exists",
      "room is full", "session already connected", "missing required signaling parameters",
      "join secret must be at least",
    ].some((fragment) => normalized.includes(fragment));
  }, []);

  const describeCollabError = useCallback((message: string) => {
    const normalized = message.trim().toLowerCase();
    if (normalized.includes("room not found")) return { title: "Room Not Found", message: "The host room is not live right now. Ask the host to start the session again and then rejoin with the latest room id and secret." };
    if (normalized.includes("invalid join secret")) return { title: "Invalid Secret", message: "That room exists, but the secret does not match. Copy the latest secret from the host and try again." };
    if (normalized.includes("room already exists")) return { title: "Room Already Exists", message: "This room id is already hosting another session. Use a different room id or disconnect the existing host first." };
    if (normalized.includes("room is full")) return { title: "Room Is Full", message: "This collaboration room already reached the participant limit. Disconnect someone first or host a new room." };
    if (normalized.includes("session already connected")) return { title: "Session Already Connected", message: "This device session is already attached to the room. Disconnect the existing session or retry after a refresh." };
    return { title: "Connection Error", message };
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
  }, [collabRevisionsRef]);

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
    const currentPlan = plansRef.current.find((c) => c.id === session.planId) ?? session.snapshot?.plan ?? null;
    if (!currentPlan) return;
    const currentPositions = positionsRef.current[session.planId] ?? session.snapshot?.positions ?? EMPTY_PLAN_POSITIONS;
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
  }, [plansRef, positionsRef]);

  const isDisconnectedForkDirty = useCallback((fork: DisconnectedFork) => {
    const currentPlan = plansRef.current.find((c) => c.id === fork.planId) ?? null;
    if (!currentPlan) return false;
    const currentPositions = positionsRef.current[fork.planId] ?? EMPTY_PLAN_POSITIONS;
    return buildPlanSignature(currentPlan, currentPositions) !== fork.baselineSignature;
  }, [plansRef, positionsRef]);

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
    invalidateUndoRedoIfExternalPlanChangeRef.current(snapshot.plan.id, snapshot.plan, snapshot.positions);
    const previousPlan = plansRef.current.find((c) => c.id === snapshot.plan.id) ?? roomSession.snapshot?.plan ?? null;
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
      setPlans, setPositions, setFeedbacks, previousPlan,
    );
    setCollabSessions((prev) =>
      prev[roomId]
        ? { ...prev, [roomId]: { ...prev[roomId], planId: snapshot.plan.id, planTitle: snapshot.plan.title, snapshot } }
        : prev,
    );
    setActivePlanId(snapshot.plan.id);
    window.setTimeout(() => { delete applyingPeerSnapshotRoomsRef.current[roomId]; }, 0);
  }, [invalidateUndoRedoIfExternalPlanChangeRef, plansRef, collabRevisionsRef, setPlans, setPositions, setFeedbacks, setActivePlanId]);

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
        ? { ...prev, [roomId]: { ...prev[roomId], planId: snapshot.plan.id, planTitle: snapshot.plan.title, snapshot } }
        : prev,
    );
    collabDocsRef.current[roomId]?.syncFromSnapshot(snapshot, { kind: "local-ui" });
  }, [getCollabSessionForPlanId, feedbacksRef]);

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
        const initialSnapshot = session.snapshot ?? (session.status === "hosting" ? buildPeerSnapshot(session.planId) : null);
        const doc = new FlowPlanCollabDoc(initialSnapshot);
        const unsubscribe = doc.onUpdate((update, snapshot, origin) => {
          const signature = buildSharedSnapshotSignature(snapshot);
          lastPeerSnapshotSignaturesRef.current[roomId] = signature;
          setCollabSessions((prev) =>
            prev[roomId]
              ? { ...prev, [roomId]: { ...prev[roomId], planId: snapshot.plan.id, planTitle: snapshot.plan.title, snapshot } }
              : prev,
          );
          if (origin.kind === "peer_state" || origin.kind === "peer_update") {
            const nextRevision = (collabRevisionsRef.current[roomId] ?? 0) + 1;
            applyPeerSnapshot(
              roomId, snapshot, nextRevision,
              resolveParticipantLabel(roomId, origin.fromSessionId),
              resolveParticipantAvatarSeed(roomId, origin.fromSessionId),
              origin.kind === "peer_update",
            );
          }
          const currentSession = collabSessionsRef.current[roomId];
          const shouldBroadcast = origin.kind === "local-ui" || (origin.kind === "peer_update" && currentSession?.status === "hosting");
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
              prev[roomId] ? { ...prev, [roomId]: { ...prev[roomId], participants } } : prev,
            );
            setCursorPresences((prev) => {
              const roomCursors = prev[roomId];
              if (!roomCursors) return prev;
              const participantIds = new Set(participants.map((p) => p.sessionId));
              const nextRoomCursors = Object.fromEntries(
                Object.entries(roomCursors).filter(([sid]) => participantIds.has(sid)),
              );
              const previousKeys = Object.keys(roomCursors);
              const nextKeys = Object.keys(nextRoomCursors);
              if (previousKeys.length === nextKeys.length && previousKeys.every((sid) => participantIds.has(sid))) return prev;
              return { ...prev, [roomId]: nextRoomCursors };
            });
          },
          onHostAvailabilityChange: (available, graceMs) => {
            const s = collabSessionsRef.current[roomId];
            if (!s || s.status !== "joined") return;
            if (available) { showToast("Host reconnected", roomId); return; }
            const seconds = graceMs ? Math.max(1, Math.round(graceMs / 1000)) : 10;
            showToast("Host disconnected · waiting to recover", `${roomId} · up to ${seconds}s`, true);
          },
          onDocUpdate: (update, _transportPeerSessionId, authorSessionId, kind) => {
            collabDocsRef.current[roomId]?.applyRemoteUpdate(update, authorSessionId, kind === "doc_state" ? "state" : "update");
          },
          onTransportStateChange: (state) => {
            setCollabTransportStates((prev) => {
              const current = prev[roomId];
              if (current && current.signal === state.signal && current.peer === state.peer) return prev;
              return { ...prev, [roomId]: state };
            });
          },
          onCursor: (cursor, transportPeerSessionId, authorSessionId) => {
            const ownerSessionId = authorSessionId ?? transportPeerSessionId;
            const currentSession = collabSessionsRef.current[roomId];
            if (!ownerSessionId || ownerSessionId === currentSession?.selfSessionId) return;
            setCursorPresences((prev) => {
              const roomCursors = prev[roomId] ?? {};
              const previousCursor = roomCursors[ownerSessionId];
              if (previousCursor && previousCursor.x === cursor.x && previousCursor.y === cursor.y && previousCursor.active === cursor.active) return prev;
              return { ...prev, [roomId]: { ...roomCursors, [ownerSessionId]: { x: cursor.x, y: cursor.y, active: cursor.active, lastUpdated: Date.now() } } };
            });
            if (collabSessionsRef.current[roomId]?.status === "hosting") {
              peerSessionsRef.current[roomId]?.broadcastCursor(cursor, ownerSessionId, transportPeerSessionId);
            }
          },
          onRoomClosed: () => {
            const latestSession = collabSessionsRef.current[roomId];
            if (latestSession) rememberDisconnectedFork(latestSession);
            destroyCollabRoom(roomId);
            setCollabSessions((prev) => {
              if (!prev[roomId]) return prev;
              const { [roomId]: _removed, ...rest } = prev;
              return rest;
            });
            showToast(
              latestSession?.status === "joined" ? "Collaboration ended · editing local copy" : "Collaboration ended",
              roomId, true,
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
  }, [applyPeerSnapshot, buildPeerSnapshot, collabSessions, describeCollabError, destroyCollabRoom, isTerminalCollabError, rememberDisconnectedFork, resolveParticipantAvatarSeed, resolveParticipantLabel, showCollabDialog, showToast, collabRevisionsRef]);

  useEffect(() => {
    return () => {
      Object.keys(peerSessionsRef.current).forEach((roomId) => destroyCollabRoom(roomId));
    };
  }, [destroyCollabRoom]);

  useEffect(() => {
    if (!collabSessions || !canvasViewport) return;
    const sessionForPlan = Object.values(collabSessions).find((s) => s.planId);
    if (!sessionForPlan) return;

    const roomId = sessionForPlan.roomId;
    const selfSessionId = sessionForPlan.selfSessionId;
    let lastSentAt = 0;
    let lastX = 0;
    let lastY = 0;
    let active = false;
    let pendingCursor: { x: number; y: number; active: boolean } | null = null;
    let pendingTimer: number | null = null;

    const sendCursor = (x: number, y: number, nextActive: boolean) => {
      lastX = x; lastY = y; active = nextActive;
      lastSentAt = performance.now();
      peerSessionsRef.current[roomId]?.broadcastCursor({ x, y, active: nextActive }, selfSessionId);
    };
    const clearPending = () => { if (pendingTimer) { window.clearTimeout(pendingTimer); pendingTimer = null; } };
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
      if (wait === 0) { flushPending(); return; }
      if (pendingTimer) return;
      pendingTimer = window.setTimeout(() => flushPending(), wait);
    };
    const handleInactive = () => {
      const reference = pendingCursor ?? { x: lastX, y: lastY, active };
      if (!reference.active) return;
      scheduleCursor(reference.x, reference.y, false);
    };
    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvasFrame;
      const viewport = canvasViewport;
      if (!rect || !viewport || rect.width <= 0 || rect.height <= 0 || viewport.zoom <= 0) return;
      if (event.clientX < rect.left || event.clientX > rect.left + rect.width || event.clientY < rect.top || event.clientY > rect.top + rect.height) {
        handleInactive();
        return;
      }
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const x = (localX - viewport.x) / viewport.zoom;
      const y = (localY - viewport.y) / viewport.zoom;
      const flowThreshold = 12 / viewport.zoom;
      const reference = pendingCursor ?? { x: lastX, y: lastY, active };
      if (reference.active && Math.abs(x - reference.x) < flowThreshold && Math.abs(y - reference.y) < flowThreshold) return;
      scheduleCursor(x, y, true);
    };
    const handleVisibilityChange = () => { if (document.hidden) handleInactive(); };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("blur", handleInactive);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.documentElement.addEventListener("mouseleave", handleInactive);
    return () => {
      handleInactive(); flushPending(); clearPending();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", handleInactive);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.documentElement.removeEventListener("mouseleave", handleInactive);
    };
  }, [canvasFrame, canvasViewport, collabSessions]);

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
            if (Object.keys(nextRoomCursors).length !== Object.keys(roomCursors).length) changed = true;
            return Object.keys(nextRoomCursors).length > 0 ? [[roomId, nextRoomCursors]] : [];
          }),
        );
        return changed ? nextRooms : prev;
      });
    }, 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const applyProfileIdentity = useCallback((nextProfile: CollabProfile) => {
    setProfile(nextProfile);
    setCollabSessions((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([roomId, session]) => [
          roomId,
          {
            ...session,
            participants: session.participants.map((p) =>
              p.isSelf ? { ...p, userId: nextProfile.userId, username: nextProfile.username, avatarSeed: nextProfile.avatarSeed } : p,
            ),
          },
        ]),
      ),
    );
    Object.values(peerSessionsRef.current).forEach((peer) => peer.updateSelfProfile(nextProfile));
  }, []);

  const handleSaveProfile = useCallback((nextProfile: CollabProfile) => {
    applyProfileIdentity(nextProfile);
    showToast("Saved settings", nextProfile.username);
  }, [applyProfileIdentity, showToast]);

  const beginCollabSession = useCallback(async (draft: ConnectPlanDraft) => {
    const currentPlanId = activePlanIdRef.current;
    if (collabSessionsRef.current[draft.roomId.trim()]) {
      showCollabDialog("Room Already Connected", "This room is already active in the current app window.");
      return;
    }
    if (draft.mode === "host" && !currentPlanId) {
      showCollabDialog("Select A Plan", "Choose the plan you want to host before starting a collaboration session.");
      return;
    }
    if (draft.mode === "host" && getCollabSessionForPlanId(currentPlanId)) {
      showCollabDialog("Plan Already Connected", "This plan already has an active collaboration session. Disconnect it first to host a new room.");
      return;
    }
    setCollabBusy(true);
    try {
      const currentPlan = plansRef.current.find((c) => c.id === currentPlanId) ?? null;
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
      setCollabSessions((prev) => ({ ...prev, [session.roomId]: { ...session, joinSecret: draft.joinSecret } }));
      if (session.planId) setActivePlanId(session.planId);
      clearDisconnectedFork(session.roomId);
      if (draft.mode === "join") {
        const defaults = loadConnectionDefaults();
        saveConnectionDefaults({ ...defaults, lastJoinRoomId: draft.roomId.trim(), lastJoinSecret: draft.joinSecret.trim() });
      }
      showToast(session.status === "hosting" ? "P2P host ready" : "Joining P2P room", session.roomId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Collaboration connection failed";
      showToast(message, draft.roomId || currentPlanId || "", true);
    } finally {
      setCollabBusy(false);
    }
  }, [activePlanIdRef, clearDisconnectedFork, feedbacksRef, getCollabSessionForPlanId, plansRef, positionsRef, profile, setActivePlanId, setFeedbacks, setPlans, setPositions, showCollabDialog, showToast]);

  const handleStartCollabSession = useCallback(async (draft: ConnectPlanDraft) => {
    const roomId = draft.roomId.trim();
    if (draft.mode === "join") {
      const fork = disconnectedForksRef.current[roomId];
      if (fork && isDisconnectedForkDirty(fork)) {
        setRejoinPrompt({ draft: { ...draft, roomId }, fork });
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
      const currentPlan = plansRef.current.find((c) => c.id === fork.planId) ?? null;
      if (currentPlan) {
        try {
          const result = await api.forkPlan(fork.planId, `${currentPlan.title} local copy`, api.LOCAL_API_BASE, currentActorId, currentActorAvatarSeed);
          showToast("Saved local copy", result.title);
        } catch {
          showToast("Could not save local copy", fork.planTitle, true);
          return;
        }
      }
    }
    await beginCollabSession(draft);
  }, [beginCollabSession, currentActorAvatarSeed, currentActorId, plansRef, rejoinPrompt, showToast]);

  const handleDisconnectSession = useCallback(async (roomId?: string | null) => {
    const collabSessionList = Object.values(collabSessionsRef.current);
    const collabSessionForPlan = activePlanIdRef.current
      ? collabSessionList.find((s) => s.planId === activePlanIdRef.current) ?? null
      : null;
    const pendingCollabSession = collabSessionList.find((s) => !s.planId) ?? null;
    const connectModalSession = collabSessionForPlan ?? pendingCollabSession;

    const targetRoom = roomId ?? connectModalSession?.roomId ?? collabSessionForPlan?.roomId ?? "";
    const session = collabSessionsRef.current[targetRoom];
    const currentRoom = session?.roomId ?? targetRoom;
    if (!currentRoom) return;
    setCollabBusy(true);
    try {
      if (session?.status === "joined") rememberDisconnectedFork(session);
      destroyCollabRoom(currentRoom);
      setCollabSessions((prev) => {
        if (!prev[currentRoom]) return prev;
        const { [currentRoom]: _removed, ...rest } = prev;
        return rest;
      });
      showToast("Disconnected", currentRoom);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Disconnect failed";
      showToast(message, currentRoom, true);
    } finally {
      setCollabBusy(false);
    }
  }, [activePlanIdRef, destroyCollabRoom, rememberDisconnectedFork, showToast]);

  const collabSyncRefs = useMemo(() => ({
    applyingPeerSnapshotRoomsRef,
    lastPeerSnapshotSignaturesRef,
    lastLocalCollabSyncSignaturesRef,
    collabDocsRef,
  }), []);

  return {
    profile,
    setProfile,
    collabSessions,
    setCollabSessions,
    collabTransportStates,
    cursorPresences,
    collabBusy,
    canvasFrame,
    canvasViewport,
    rejoinPrompt,
    setCanvasFrame,
    setCanvasViewport,
    setRejoinPrompt,
    collabSessionsRef,
    collabRevisionsRef,
    currentActorId,
    currentActorAvatarSeed,
    getCollabSessionForPlanId,
    getCollabSnapshots,
    buildPeerSnapshot,
    syncLocalSnapshotToCollab,
    applyProfileIdentity,
    handleSaveProfile,
    handleStartCollabSession,
    handleResolveForkAndJoin,
    handleDisconnectSession,
    destroyCollabRoom,
    collabSyncRefs,
  };
}
