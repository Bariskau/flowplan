import { FlowPlanCollabDoc } from "../lib/collabDoc";
import { FlowPlanPeerSession, type SharedPlanSnapshot } from "../lib/p2p";
import { createAvatarSeed, parseIceServers } from "../lib/collab";
import type { CollabSession, Plan } from "../types";

declare global {
  interface Window {
    __FLOWPLAN_P2P_SMOKE__?: {
      getState: () => {
        revision: number;
        participants: string[];
        snapshot: SharedPlanSnapshot | null;
      };
      publishTitle: (title: string) => void;
      proposeTitle: (title: string) => void;
    };
  }
}

const params = new URLSearchParams(window.location.search);
const role = params.get("role") === "join" ? "join" : "host";
const roomId = params.get("room") || "flowplan-smoke";
const secret = params.get("secret") || "FLOW-PLAN-SMOKE";
const serverUrl = params.get("server") || "ws://127.0.0.1:3320/signal";
const iceServersInput = params.get("ice") || "";
const sessionId = params.get("session") || `${role}-${Math.random().toString(36).slice(2, 10)}`;
const username = params.get("name") || (role === "host" ? "Host User" : "Join User");
const avatarSeed = params.get("avatar") || createAvatarSeed(role === "host" ? "host" : "join");
const planId = "plan-smoke";

const roleEl = document.getElementById("role");
const roomEl = document.getElementById("room");
const revisionEl = document.getElementById("revision");
const participantsEl = document.getElementById("participants");
const titleEl = document.getElementById("title");
const subtitleEl = document.getElementById("subtitle");
const logEl = document.getElementById("log");

const baseSnapshot: SharedPlanSnapshot = {
  plan: {
    id: planId,
    title: "Smoke Plan",
    icon: "sparkles",
    description: "WebRTC smoke validation",
    createdAt: Date.now(),
    pinned: false,
    steps: [
      {
        id: "card-smoke",
        title: "Hello peer",
        description: "Testing P2P sync",
        type: "planning",
        repo: "",
        files: [],
        dependencies: [],
        order: 0,
        fileChanges: {},
      },
    ],
  },
  positions: {
    "card-smoke": { x: 120, y: 90 },
  },
  feedbacks: [],
};

let currentSnapshot: SharedPlanSnapshot | null = role === "host" ? structuredClone(baseSnapshot) : null;
let currentRevision = 0;
let participantNames: string[] = [username];
const collabDoc = new FlowPlanCollabDoc(currentSnapshot);

function log(message: string) {
  if (!logEl) return;
  const next = `${new Date().toLocaleTimeString()} ${message}`;
  logEl.textContent = logEl.textContent ? `${logEl.textContent}\n${next}` : next;
}

function updateUi() {
  if (roleEl) roleEl.textContent = role;
  if (roomEl) roomEl.textContent = roomId;
  if (revisionEl) revisionEl.textContent = String(currentRevision);
  if (participantsEl) participantsEl.textContent = `${participantNames.length} · ${participantNames.join(", ")}`;
  if (titleEl) titleEl.textContent = currentSnapshot?.plan.title ?? "Waiting for snapshot...";
  if (subtitleEl) {
    subtitleEl.textContent =
      role === "host"
        ? "Host peer publishes authoritative snapshots."
        : "Join peer receives host snapshots and can send proposals.";
  }
}

function buildSession(): CollabSession {
  return {
    transport: "p2p",
    status: role === "host" ? "hosting" : "joined",
    serverUrl,
    iceServers: parseIceServers(iceServersInput),
    roomId,
    joinSecret: secret,
    planId,
    planTitle: currentSnapshot?.plan.title ?? "Connecting...",
    selfSessionId: sessionId,
    participants: [
      {
        sessionId,
        userId: `user-${sessionId}`,
        username,
        avatarSeed,
        isHost: role === "host",
        isSelf: true,
        status: "active",
      },
    ],
    snapshot: currentSnapshot,
    createdAt: Date.now(),
  };
}

function setSnapshot(snapshot: SharedPlanSnapshot, revision: number, source: string) {
  currentSnapshot = structuredClone(snapshot);
  currentRevision = revision;
  updateUi();
  log(`${source} -> rev ${revision} (${snapshot.plan.title})`);
}

function nextSnapshotWithTitle(title: string): SharedPlanSnapshot {
  const previous = currentSnapshot ?? structuredClone(baseSnapshot);
  const nextPlan: Plan = {
    ...previous.plan,
    title,
  };
  return {
    plan: nextPlan,
    positions: structuredClone(previous.positions),
    feedbacks: structuredClone(previous.feedbacks),
  };
}

const peer = new FlowPlanPeerSession({
  session: buildSession(),
  getInitialDocUpdate: () => collabDoc.getStateUpdate(),
  onParticipants: (participants) => {
    participantNames = participants.map((participant) => participant.username);
    updateUi();
    log(`presence -> ${participantNames.join(", ")}`);
  },
  onDocUpdate: (update, fromSessionId) => {
    collabDoc.applyRemoteUpdate(update, fromSessionId);
  },
  onCursor: () => {},
  onRoomClosed: () => {
    log("room closed");
  },
  onError: (message) => {
    log(`error -> ${message}`);
  },
});

collabDoc.onUpdate((update, snapshot, origin) => {
  if (origin.kind !== "bootstrap") {
    currentRevision += 1;
    setSnapshot(
      snapshot,
      currentRevision,
      origin.kind === "peer_state" || origin.kind === "peer_update" ? "remote update" : "local update",
    );
  }

  if (origin.kind === "local-ui" || (origin.kind === "peer_update" && role === "host")) {
    peer.broadcastDocUpdate(update);
  }
});

peer.connect();
updateUi();

window.__FLOWPLAN_P2P_SMOKE__ = {
  getState: () => ({
    revision: currentRevision,
    participants: [...participantNames],
    snapshot: currentSnapshot ? structuredClone(currentSnapshot) : null,
  }),
  publishTitle: (title: string) => {
    const snapshot = nextSnapshotWithTitle(title);
    collabDoc.syncFromSnapshot(snapshot, { kind: "local-ui" });
  },
  proposeTitle: (title: string) => {
    const snapshot = nextSnapshotWithTitle(title);
    log(`local proposal -> ${title}`);
    collabDoc.syncFromSnapshot(snapshot, { kind: "local-ui" });
  },
};
