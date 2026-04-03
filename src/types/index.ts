export interface FileChange {
  content: string;
  language: string;
  changeType: string;
}

export interface Card {
  id: string;
  title: string;
  description: string;
  type: "research" | "planning" | "create" | "edit" | "test";
  repo: string;
  files: string[];
  dependencies: string[];
  fileChanges?: Record<string, FileChange>;
  order?: number;
}

export interface Plan {
  id: string;
  title: string;
  icon?: string;
  description: string;
  steps: Card[];
  createdAt: number;
  pinned?: boolean;
}

export interface Feedback {
  id: string;
  cardId: string;
  type: "question" | "directive" | "issue";
  text: string;
  answer: string | null;
  timestamp: number;
  read?: boolean;
  ownerUserId?: string;
  ownerUsername?: string;
  ownerAvatarSeed?: string;
}

export interface AppState {
  plans: Plan[];
  feedbacks: Feedback[];
  positions: Record<string, Record<string, { x: number; y: number }>>;
}

export interface CollabProfile {
  userId: string;
  username: string;
  avatarSeed: string;
}

export interface CollabParticipant {
  sessionId: string;
  userId: string;
  username: string;
  avatarSeed: string;
  isSelf?: boolean;
  isHost?: boolean;
  status?: "active" | "connecting" | "idle";
}

export interface CollabConnectionDefaults {
  serverUrl: string;
  iceServers: string;
  lastJoinRoomId?: string;
  lastJoinSecret?: string;
}

export interface ConnectPlanDraft {
  mode: "host" | "join";
  serverUrl: string;
  iceServers: string;
  roomId: string;
  joinSecret: string;
}

export interface CollabSession {
  transport: "p2p";
  status: "hosting" | "joined";
  serverUrl: string;
  iceServers: RTCIceServer[];
  roomId: string;
  joinSecret?: string | null;
  planId: string;
  planTitle: string;
  selfSessionId: string;
  participants: CollabParticipant[];
  snapshot?: {
    plan: Plan;
    positions: Record<string, { x: number; y: number }>;
    feedbacks: Feedback[];
  } | null;
  snapshotHash?: string;
  createdAt: number;
}

export interface CollabTransportState {
  signal: "connecting" | "connected" | "reconnecting" | "disconnected";
  peer: "idle" | "connecting" | "connected" | "failed";
}

export interface CardSummary {
  id: string;
  title: string;
  type: string;
  descriptionLen: number;
  filesCount: number;
  files: string[];
  dependencies: string[];
}

export interface HistoryDiff {
  added: CardSummary[];
  removed: CardSummary[];
  modified: { before: CardSummary; after: CardSummary }[];
}

export type HistoryActor = "ui" | "agent" | "collab" | "system";
export type HistorySource = "rest" | "mcp" | "undo" | "redo" | "system";
export type HistoryChangeKind = "plan_created" | "card_added" | "card_removed" | "card_updated";

export interface HistoryPlanSnapshot {
  id: string;
  title: string;
  icon: string;
  description: string;
  createdAt: number;
  pinned: boolean;
  cards: Card[];
  positions: Record<string, { x: number; y: number }>;
}

export interface HistoryChange {
  kind: HistoryChangeKind;
  cardId?: string | null;
  title?: string | null;
  changedFields: string[];
  dependenciesAdded: string[];
  dependenciesRemoved: string[];
  filesAdded: string[];
  filesRemoved: string[];
  fileChangesUpdated: string[];
  before?: Card | null;
  after?: Card | null;
}

export interface HistoryEntry {
  id: string;
  revision: number;
  timestamp: number;
  actor: HistoryActor;
  actorId?: string | null;
  actorAvatarSeed?: string | null;
  source: HistorySource;
  txId: string;
  summary: string;
  changes: HistoryChange[];
  snapshot: HistoryPlanSnapshot;
  action?: string;
  description?: string;
  previousCards?: CardSummary[];
  cards?: CardSummary[];
  previousFullCards?: Card[];
  fullCards?: Card[];
}

export interface PlanHistory {
  planId: string;
  entries: HistoryEntry[];
  total?: number;
  offset?: number;
  limit?: number;
  hasMore?: boolean;
  hasPrevious?: boolean;
}
