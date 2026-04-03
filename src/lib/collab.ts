import type { CollabConnectionDefaults, CollabParticipant, CollabProfile, CollabSession, Plan } from "../types";

export const PROFILE_STORAGE_KEY = "flowplan.collab.profile.v1";
export const CONNECTION_DEFAULTS_STORAGE_KEY = "flowplan.collab.defaults.v1";
export const DEFAULT_COLLAB_SERVER_URL = "";
export const COLLAB_SERVER_URL_PLACEHOLDER = "wss://your-signal-worker.workers.dev/signal";
export const DEFAULT_ICE_SERVERS = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"].join("\n");

const ADJECTIVES = [
  "Silent",
  "Bright",
  "Quick",
  "Calm",
  "Velvet",
  "Silver",
  "Amber",
  "North",
  "Blue",
  "Glass",
];

const NOUNS = ["Fox", "Pine", "Orbit", "Wave", "Frame", "Maple", "Signal", "Tide", "Lynx", "Nova"];
const AVATAR_OPTION_COUNT = 12;

function safeWindow() {
  return typeof window !== "undefined" ? window : null;
}

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shortId(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) result += alphabet[Math.floor(Math.random() * alphabet.length)];
  return result;
}

function randomUuidFragment() {
  return (
    safeWindow()?.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 18) ??
    `${Date.now()}${Math.random().toString(36).slice(2, 10)}`
  );
}

function createSessionId() {
  const cryptoApi = safeWindow()?.crypto;
  if (cryptoApi?.randomUUID) {
    return `session-${cryptoApi.randomUUID()}`;
  }

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
    return `session-${hex}`;
  }

  return `session-${randomUuidFragment()}-${randomUuidFragment()}`;
}

export function sanitizeUsername(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 32);
}

export function normalizeAvatarSeed(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 96);
}

export function createAvatarSeed(prefix = "avatar") {
  return normalizeAvatarSeed(`${prefix}-${randomUuidFragment()}`);
}

export function createAvatarOptionSeeds(selectedSeed?: string, count = AVATAR_OPTION_COUNT) {
  const seeds: string[] = [];
  const pushUnique = (seed: string) => {
    const normalized = normalizeAvatarSeed(seed);
    if (!normalized || seeds.includes(normalized)) return;
    seeds.push(normalized);
  };

  if (selectedSeed) pushUnique(selectedSeed);

  while (seeds.length < count) {
    pushUnique(createAvatarSeed(`option-${seeds.length + 1}`));
  }

  return seeds;
}

export function normalizeCollabServerUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.hostname === "localhost") {
      url.hostname = "127.0.0.1";
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function validateCollabServerUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Enter the signaling server endpoint first.";

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return "Use a valid WebSocket URL.";
  }

  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    return "Server endpoint must start with ws:// or wss://.";
  }

  const isLocalHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (!isLocalHost && url.protocol !== "wss:") {
    return "Remote signaling servers must use wss://.";
  }

  if (!url.pathname || url.pathname === "/") {
    return "Server endpoint should include the /signal path.";
  }

  return null;
}

export function normalizeIceServersInput(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export function validateIceServersInput(value: string) {
  const normalized = normalizeIceServersInput(value);
  if (!normalized) return null;

  const lines = normalized.split("\n");
  for (const line of lines) {
    const [urlsPart, username, credential] = line.split("|").map((part) => part.trim());
    if (!urlsPart) {
      return "Each ICE entry must include at least one STUN or TURN URL.";
    }

    const urls = urlsPart
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (urls.length === 0) {
      return "Each ICE entry must include at least one STUN or TURN URL.";
    }

    for (const url of urls) {
      if (!/^stun:|^turn:|^turns:/i.test(url)) {
        return "ICE entries must start with stun:, turn:, or turns:.";
      }

      if ((/^turn:|^turns:/i.test(url)) && (!username || !credential)) {
        return "TURN entries must use turn:host:port|username|credential.";
      }
    }
  }

  return null;
}

export function parseIceServers(value: string): RTCIceServer[] {
  const normalized = normalizeIceServersInput(value) || DEFAULT_ICE_SERVERS;
  return normalized
    .split("\n")
    .map((line) => {
      const [urls, username, credential] = line.split("|").map((part) => part.trim());
      if (!urls) return null;
      const server: RTCIceServer = { urls };
      if (username) server.username = username;
      if (credential) server.credential = credential;
      return server;
    })
    .filter((server): server is RTCIceServer => !!server);
}

export function createRandomProfile(): CollabProfile {
  return {
    userId: `user-${safeWindow()?.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`,
    username: `${randomItem(ADJECTIVES)} ${randomItem(NOUNS)}`,
    avatarSeed: createAvatarSeed("profile"),
  };
}

function isValidProfile(value: unknown): value is CollabProfile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.userId === "string" &&
    typeof candidate.username === "string" &&
    typeof candidate.avatarSeed === "string"
  );
}

export function loadStoredProfile() {
  const win = safeWindow();
  if (!win) return createRandomProfile();

  try {
    const raw = win.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      const generated = createRandomProfile();
      saveStoredProfile(generated);
      return generated;
    }
    const parsed = JSON.parse(raw);
    const legacy = parsed as { userId?: unknown; username?: unknown; avatarSeed?: unknown; avatarId?: unknown };
    if (!isValidProfile(parsed) && !(typeof legacy.avatarId === "string")) throw new Error("invalid profile");
    return {
      userId: typeof legacy.userId === "string" ? legacy.userId : createRandomProfile().userId,
      username:
        sanitizeUsername(typeof legacy.username === "string" ? legacy.username : "") || createRandomProfile().username,
      avatarSeed:
        normalizeAvatarSeed(typeof legacy.avatarSeed === "string" ? legacy.avatarSeed : "") ||
        normalizeAvatarSeed(typeof legacy.avatarId === "string" ? `legacy-${legacy.avatarId}` : "") ||
        createAvatarSeed("profile"),
    };
  } catch {
    const generated = createRandomProfile();
    saveStoredProfile(generated);
    return generated;
  }
}

export function saveStoredProfile(profile: CollabProfile) {
  const win = safeWindow();
  if (!win) return;

  try {
    win.localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({
        userId: profile.userId,
        username: sanitizeUsername(profile.username),
        avatarSeed: normalizeAvatarSeed(profile.avatarSeed) || createAvatarSeed("profile"),
      }),
    );
  } catch {}
}

export function loadConnectionDefaults(): CollabConnectionDefaults {
  const win = safeWindow();
  if (!win) {
    return {
      serverUrl: DEFAULT_COLLAB_SERVER_URL,
      iceServers: DEFAULT_ICE_SERVERS,
      lastJoinRoomId: "",
      lastJoinSecret: "",
    };
  }

  try {
    const raw = win.localStorage.getItem(CONNECTION_DEFAULTS_STORAGE_KEY);
    if (!raw) {
      return {
        serverUrl: DEFAULT_COLLAB_SERVER_URL,
        iceServers: DEFAULT_ICE_SERVERS,
        lastJoinRoomId: "",
        lastJoinSecret: "",
      };
    }
    const parsed = JSON.parse(raw) as Partial<CollabConnectionDefaults>;
    return {
      serverUrl: normalizeCollabServerUrl(
        typeof parsed.serverUrl === "string" && parsed.serverUrl.trim()
          ? parsed.serverUrl
          : DEFAULT_COLLAB_SERVER_URL,
      ),
      iceServers: normalizeIceServersInput(
        typeof parsed.iceServers === "string" && parsed.iceServers.trim()
          ? parsed.iceServers
          : DEFAULT_ICE_SERVERS,
      ),
      lastJoinRoomId:
        typeof parsed.lastJoinRoomId === "string"
          ? parsed.lastJoinRoomId.trim().slice(0, 120)
          : "",
      lastJoinSecret:
        typeof parsed.lastJoinSecret === "string"
          ? parsed.lastJoinSecret.trim().slice(0, 120)
          : "",
    };
  } catch {
    return {
      serverUrl: DEFAULT_COLLAB_SERVER_URL,
      iceServers: DEFAULT_ICE_SERVERS,
      lastJoinRoomId: "",
      lastJoinSecret: "",
    };
  }
}

export function saveConnectionDefaults(defaults: CollabConnectionDefaults) {
  const win = safeWindow();
  if (!win) return;
  try {
    const current = loadConnectionDefaults();
    win.localStorage.setItem(
      CONNECTION_DEFAULTS_STORAGE_KEY,
      JSON.stringify({
        serverUrl: normalizeCollabServerUrl(defaults.serverUrl ?? current.serverUrl),
        iceServers: normalizeIceServersInput(defaults.iceServers ?? current.iceServers),
        lastJoinRoomId: (defaults.lastJoinRoomId ?? current.lastJoinRoomId ?? "").trim().slice(0, 120),
        lastJoinSecret: (defaults.lastJoinSecret ?? current.lastJoinSecret ?? "").trim().slice(0, 120),
      }),
    );
  } catch {}
}

export function slugifyPlanTitle(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "flowplan"
  );
}

export function makeRoomId(planTitle: string) {
  return `${slugifyPlanTitle(planTitle)}-${shortId(5).toLowerCase()}`;
}

export function makeJoinSecret() {
  return `${shortId(4)}-${shortId(4)}-${shortId(4)}`;
}

export function buildSelfParticipant(
  profile: CollabProfile,
  options?: { isHost?: boolean; status?: CollabParticipant["status"] },
): CollabParticipant {
  return {
    sessionId: createSessionId(),
    userId: profile.userId,
    username: sanitizeUsername(profile.username),
    avatarSeed: normalizeAvatarSeed(profile.avatarSeed) || createAvatarSeed("profile"),
    isSelf: true,
    isHost: !!options?.isHost,
    status: options?.status ?? "active",
  };
}

export function createHostSession(
  profile: CollabProfile,
  plan: Plan,
  draft: { serverUrl: string; iceServers?: string; roomId?: string; joinSecret?: string },
): CollabSession {
  const self = buildSelfParticipant(profile, { isHost: true });
  return {
    transport: "p2p",
    status: "hosting",
    serverUrl: normalizeCollabServerUrl(draft.serverUrl),
    iceServers: parseIceServers(draft.iceServers ?? DEFAULT_ICE_SERVERS),
    roomId: draft.roomId?.trim() || makeRoomId(plan.title),
    joinSecret: draft.joinSecret?.trim() || makeJoinSecret(),
    planId: plan.id,
    planTitle: plan.title,
    selfSessionId: self.sessionId,
    participants: [self],
    createdAt: Date.now(),
  };
}

export function createJoinSession(
  profile: CollabProfile,
  plan: Plan | null,
  draft: { serverUrl: string; iceServers?: string; roomId: string; joinSecret: string },
): CollabSession {
  const self = buildSelfParticipant(profile);
  return {
    transport: "p2p",
    status: "joined",
    serverUrl: normalizeCollabServerUrl(draft.serverUrl),
    iceServers: parseIceServers(draft.iceServers ?? DEFAULT_ICE_SERVERS),
    roomId: draft.roomId.trim(),
    joinSecret: draft.joinSecret.trim(),
    planId: plan?.id ?? "",
    planTitle: plan?.title ?? "Connecting...",
    selfSessionId: self.sessionId,
    participants: [self],
    createdAt: Date.now(),
  };
}
