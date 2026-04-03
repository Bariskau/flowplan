import { DurableObject } from "cloudflare:workers";

const MIN_SECRET_LEN = 8;
const MAX_PARTICIPANTS_PER_ROOM = 12;
const MAX_SIGNAL_MESSAGE_BYTES = 128 * 1024;
const PRESENCE_DEBOUNCE_MS = 120;
const HOST_GRACE_MS = 10_000;
const MAX_FAILED_JOIN_ATTEMPTS = 5;
const FAILED_JOIN_BLOCK_MS = 60_000;
const FAILED_JOIN_WINDOW_MS = 60_000;

function normalizeText(value, maxLen) {
  return String(value ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
    .slice(0, maxLen);
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function encodeEnvelope(value) {
  return JSON.stringify(value);
}

function createErrorWebSocket(message) {
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();
  server.send(
    encodeEnvelope({
      kind: "error",
      message,
    }),
  );
  server.close(1011, message.slice(0, 120));
  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

function messageSizeBytes(message) {
  if (typeof message === "string") {
    return new TextEncoder().encode(message).byteLength;
  }
  if (message instanceof ArrayBuffer) {
    return message.byteLength;
  }
  if (ArrayBuffer.isView(message)) {
    return message.byteLength;
  }
  return 0;
}

function sortParticipants(participants) {
  return [...participants].sort((a, b) => {
    if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
    if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
    return a.username.localeCompare(b.username);
  });
}

function isWebSocketUpgrade(request) {
  return request.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

function buildParticipant(query, now) {
  return {
    sessionId: query.sessionId,
    userId: query.userId,
    username: query.username,
    avatarSeed: query.avatarSeed,
    isHost: query.role === "host",
    joinedAt: now,
  };
}

function buildAttachment(roomId, joinSecret, participant) {
  return {
    roomId,
    joinSecret,
    ...participant,
  };
}

function isHostReplacement(room, sessionId, role, secret) {
  return role === "host" && room.hostSessionId === sessionId && room.joinSecret === secret;
}

function isValidAttachment(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.roomId === "string" &&
    typeof value.joinSecret === "string" &&
    typeof value.sessionId === "string" &&
    typeof value.userId === "string" &&
    typeof value.username === "string" &&
    typeof value.avatarSeed === "string" &&
    typeof value.isHost === "boolean" &&
    typeof value.joinedAt === "number"
  );
}

function isValidRoomMeta(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.roomId === "string" &&
    typeof value.joinSecret === "string" &&
    typeof value.hostSessionId === "string" &&
    typeof value.hostDisconnectedAt === "number"
  );
}

function clientAttemptKey(request) {
  return normalizeText(
    request.headers.get("CF-Connecting-IP") ||
      request.headers.get("X-Forwarded-For") ||
      request.headers.get("x-real-ip") ||
      "unknown",
    128,
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true });
    }

    if (url.pathname === "/signal") {
      const roomId = normalizeText(url.searchParams.get("roomId"), 64).toLowerCase();
      if (!roomId) {
        return new Response("Missing roomId", { status: 400 });
      }

      const stub = env.SIGNAL_ROOM.getByName(roomId);
      return stub.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};

export class SignalRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.roomId = "";
    this.joinSecret = "";
    this.hostSessionId = "";
    this.hostDisconnectedAt = 0;
    this.participants = new Map();
    this.sockets = new Map();
    this.presenceTimer = null;
    this.ctx.blockConcurrencyWhile(async () => {
      await this.restoreState();
    });
  }

  async restoreState() {
    const persistedMeta = await this.ctx.storage.get("room-meta");
    if (isValidRoomMeta(persistedMeta)) {
      this.roomId = persistedMeta.roomId;
      this.joinSecret = persistedMeta.joinSecret;
      this.hostSessionId = persistedMeta.hostSessionId;
      this.hostDisconnectedAt = persistedMeta.hostDisconnectedAt;
    }
    this.restoreFromSockets();
    if (this.sockets.size === 0) {
      this.roomId = "";
      this.joinSecret = "";
      this.hostSessionId = "";
      this.hostDisconnectedAt = 0;
      await this.clearRoomMeta();
      await this.clearRoomAlarm();
      return;
    }
    if (this.hostSessionId && this.sockets.has(this.hostSessionId)) {
      this.hostDisconnectedAt = 0;
      await this.persistRoomMeta();
      await this.clearRoomAlarm();
    } else if (this.hostDisconnectedAt > 0) {
      await this.ctx.storage.setAlarm(this.hostDisconnectedAt + HOST_GRACE_MS);
    }
  }

  restoreFromSockets() {
    this.participants.clear();
    this.sockets.clear();

    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      if (!isValidAttachment(attachment)) continue;

      this.roomId ||= attachment.roomId;
      this.joinSecret ||= attachment.joinSecret;
      if (attachment.isHost) {
        this.hostSessionId = attachment.sessionId;
        this.hostDisconnectedAt = 0;
      }

      this.participants.set(attachment.sessionId, {
        sessionId: attachment.sessionId,
        userId: attachment.userId,
        username: attachment.username,
        avatarSeed: attachment.avatarSeed,
        isHost: attachment.isHost,
        joinedAt: attachment.joinedAt,
      });
      this.sockets.set(attachment.sessionId, ws);
    }
  }

  async persistRoomMeta() {
    await this.ctx.storage.put("room-meta", {
      roomId: this.roomId,
      joinSecret: this.joinSecret,
      hostSessionId: this.hostSessionId,
      hostDisconnectedAt: this.hostDisconnectedAt,
    });
  }

  async clearRoomMeta() {
    await this.ctx.storage.delete("room-meta");
  }

  async clearRoomAlarm() {
    if (typeof this.ctx.storage.deleteAlarm === "function") {
      await this.ctx.storage.deleteAlarm();
    }
  }

  schedulePresenceBroadcast() {
    if (this.presenceTimer) {
      clearTimeout(this.presenceTimer);
    }
    this.presenceTimer = setTimeout(() => {
      this.presenceTimer = null;
      this.broadcastPresenceNow();
    }, PRESENCE_DEBOUNCE_MS);
  }

  notifyHostDisconnected() {
    this.broadcast({
      kind: "host_disconnected",
      roomId: this.roomId,
      graceMs: HOST_GRACE_MS,
    });
  }

  notifyHostReconnected() {
    this.broadcast({
      kind: "host_reconnected",
      roomId: this.roomId,
    });
  }

  failedJoinStorageKey(clientKey) {
    return `failed-join:${clientKey}`;
  }

  async getFailedJoinState(clientKey) {
    if (!clientKey) return null;
    const value = await this.ctx.storage.get(this.failedJoinStorageKey(clientKey));
    if (!value || typeof value !== "object") return null;
    const candidate = value;
    if (
      typeof candidate.count !== "number" ||
      typeof candidate.firstFailedAt !== "number" ||
      typeof candidate.blockedUntil !== "number"
    ) {
      return null;
    }
    return candidate;
  }

  async clearFailedJoinState(clientKey) {
    if (!clientKey) return;
    await this.ctx.storage.delete(this.failedJoinStorageKey(clientKey));
  }

  async recordFailedJoin(clientKey, now) {
    if (!clientKey) return;
    const previous = (await this.getFailedJoinState(clientKey)) ?? {
      count: 0,
      firstFailedAt: now,
      blockedUntil: 0,
    };
    const withinWindow = now - previous.firstFailedAt <= FAILED_JOIN_WINDOW_MS;
    const count = withinWindow ? previous.count + 1 : 1;
    const firstFailedAt = withinWindow ? previous.firstFailedAt : now;
    const blockedUntil = count >= MAX_FAILED_JOIN_ATTEMPTS ? now + FAILED_JOIN_BLOCK_MS : 0;
    await this.ctx.storage.put(this.failedJoinStorageKey(clientKey), {
      count,
      firstFailedAt,
      blockedUntil,
    });
  }

  async fetch(request) {
    if (!isWebSocketUpgrade(request)) {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const url = new URL(request.url);
    const roomId = normalizeText(url.searchParams.get("roomId"), 64).toLowerCase();
    const sessionId = normalizeText(url.searchParams.get("sessionId"), 96);
    const role = normalizeText(url.searchParams.get("role"), 8).toLowerCase();
    const secret = normalizeText(url.searchParams.get("secret"), 64).toUpperCase();
    const userId = normalizeText(url.searchParams.get("userId"), 96);
    const username = normalizeText(url.searchParams.get("username"), 32);
    const avatarSeed = normalizeText(url.searchParams.get("avatarSeed"), 96);
    const attemptKey = clientAttemptKey(request);
    const now = Date.now();

    if (
      !roomId ||
      !sessionId ||
      !secret ||
      !userId ||
      !username ||
      !avatarSeed ||
      (role !== "host" && role !== "join")
    ) {
      return createErrorWebSocket("Missing required signaling parameters");
    }

    if (secret.length < MIN_SECRET_LEN) {
      return createErrorWebSocket(`Join secret must be at least ${MIN_SECRET_LEN} characters`);
    }

    if (role === "join") {
      const failedJoinState = await this.getFailedJoinState(attemptKey);
      if (failedJoinState?.blockedUntil && failedJoinState.blockedUntil > now) {
        return createErrorWebSocket("Too many failed join attempts. Try again in a minute.");
      }
    }

    const replacingExistingSession = this.participants.has(sessionId);
    const replacingHost = isHostReplacement(this, sessionId, role, secret);

    if (role === "host") {
      if ((this.participants.size > 0 || this.hostSessionId) && !replacingHost) {
        return createErrorWebSocket("Room already exists");
      }
    } else {
      if (!this.hostSessionId || this.participants.size === 0) {
        return createErrorWebSocket("Room not found");
      }
      if (this.hostDisconnectedAt > 0) {
        return createErrorWebSocket("Host is reconnecting");
      }
      if (this.joinSecret !== secret) {
        await this.recordFailedJoin(attemptKey, now);
        return createErrorWebSocket("Invalid join secret");
      }
      if (this.participants.size >= MAX_PARTICIPANTS_PER_ROOM && !replacingExistingSession) {
        return createErrorWebSocket("Room is full");
      }
    }

    const participant = buildParticipant(
      {
        sessionId,
        role,
        userId,
        username,
        avatarSeed,
      },
      Date.now(),
    );

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const attachment = buildAttachment(roomId, secret, participant);

    if (replacingExistingSession) {
      this.replaceSession(sessionId);
    }

    this.ctx.acceptWebSocket(server, [sessionId]);
    server.serializeAttachment(attachment);

    this.roomId = roomId;
    this.joinSecret = secret;
    if (participant.isHost) {
      this.hostSessionId = participant.sessionId;
      const wasRecovering = this.hostDisconnectedAt > 0;
      this.hostDisconnectedAt = 0;
      void this.clearRoomAlarm();
      if (wasRecovering) {
        this.notifyHostReconnected();
      }
    }
    this.participants.set(participant.sessionId, participant);
    this.sockets.set(participant.sessionId, server);
    if (role === "join") {
      await this.clearFailedJoinState(attemptKey);
    }
    void this.persistRoomMeta();

    this.sendTo(participant.sessionId, {
      kind: "ready",
      roomId,
      sessionId,
      role,
    });
    this.schedulePresenceBroadcast();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  webSocketMessage(ws, message) {
    const attachment = this.getAttachment(ws);
    if (!attachment) return;

    if (messageSizeBytes(message) > MAX_SIGNAL_MESSAGE_BYTES) {
      this.sendTo(attachment.sessionId, {
        kind: "error",
        message: "Signal message too large",
      });
      try {
        ws.close(1009, "Signal message too large");
      } catch {}
      this.cleanupConnection(attachment.sessionId);
      return;
    }

    if (typeof message !== "string") return;

    const envelope = safeJsonParse(message);
    if (!envelope || typeof envelope.kind !== "string") return;

    if (envelope.kind === "ping") {
      this.sendTo(attachment.sessionId, {
        kind: "pong",
        roomId: this.roomId,
        ts: typeof envelope.ts === "number" ? envelope.ts : Date.now(),
      });
      return;
    }

    if (envelope.kind === "leave") {
      this.cleanupConnection(attachment.sessionId);
      try {
        ws.close(1000, "Client left");
      } catch {}
      return;
    }

    if (envelope.kind === "profile_update") {
      const userId = normalizeText(envelope.userId, 96);
      const username = normalizeText(envelope.username, 32);
      const avatarSeed = normalizeText(envelope.avatarSeed, 96);
      if (!userId || !username || !avatarSeed) return;

      const currentParticipant = this.participants.get(attachment.sessionId);
      if (!currentParticipant) return;

      const nextParticipant = {
        ...currentParticipant,
        userId,
        username,
        avatarSeed,
      };

      this.participants.set(attachment.sessionId, nextParticipant);
      this.updateAttachment(ws, nextParticipant);
      this.schedulePresenceBroadcast();
      return;
    }

    if (envelope.kind !== "signal" || typeof envelope.to !== "string") return;

    const targetSessionId = normalizeText(envelope.to, 96);
    if (!targetSessionId || targetSessionId === attachment.sessionId) return;

    this.relaySignal(attachment.sessionId, targetSessionId, envelope.signal);
  }

  webSocketClose(ws) {
    const attachment = this.getAttachment(ws);
    if (!attachment) return;
    this.cleanupConnection(attachment.sessionId);
  }

  webSocketError(ws) {
    const attachment = this.getAttachment(ws);
    if (!attachment) return;
    this.cleanupConnection(attachment.sessionId);
    try {
      ws.close(1011, "Signal websocket error");
    } catch {}
  }

  getAttachment(ws) {
    const attachment = ws.deserializeAttachment();
    return isValidAttachment(attachment) ? attachment : null;
  }

  updateAttachment(ws, participant) {
    const attachment = this.getAttachment(ws);
    if (!attachment) return;
    ws.serializeAttachment({
      ...attachment,
      userId: participant.userId,
      username: participant.username,
      avatarSeed: participant.avatarSeed,
      isHost: participant.isHost,
      joinedAt: participant.joinedAt,
    });
  }

  relaySignal(from, to, signal) {
    if (!this.participants.has(to)) return;

    this.sendTo(to, {
      kind: "signal",
      roomId: this.roomId,
      from,
      signal,
    });
  }

  sendTo(sessionId, envelope) {
    const socket = this.sockets.get(sessionId);
    if (!socket) return;
    try {
      socket.send(encodeEnvelope(envelope));
    } catch {
      this.cleanupConnection(sessionId);
    }
  }

  broadcast(envelope, excludeSessionId = null) {
    const raw = encodeEnvelope(envelope);
    for (const [sessionId, socket] of this.sockets.entries()) {
      if (excludeSessionId && sessionId === excludeSessionId) continue;
      try {
        socket.send(raw);
      } catch {
        this.cleanupConnection(sessionId);
      }
    }
  }

  broadcastPresenceNow() {
    this.broadcast({
      kind: "presence",
      roomId: this.roomId,
      hostSessionId: this.hostSessionId,
      participants: sortParticipants(this.participants.values()),
    });
  }

  replaceSession(sessionId) {
    const socket = this.sockets.get(sessionId);
    this.sockets.delete(sessionId);
    this.participants.delete(sessionId);
    try {
      socket?.close(1012, "Session replaced");
    } catch {}
  }

  cleanupConnection(sessionId) {
    if (!this.participants.has(sessionId) && !this.sockets.has(sessionId)) {
      return;
    }

    const wasHost = sessionId === this.hostSessionId;
    this.participants.delete(sessionId);
    this.sockets.delete(sessionId);

    if (wasHost && this.participants.size > 0) {
      this.hostDisconnectedAt = Date.now();
      void this.persistRoomMeta();
      void this.ctx.storage.setAlarm(this.hostDisconnectedAt + HOST_GRACE_MS);
      this.notifyHostDisconnected();
      this.schedulePresenceBroadcast();
      return;
    }

    if (this.participants.size === 0) {
      void this.closeRoom();
      return;
    }

    void this.persistRoomMeta();
    this.schedulePresenceBroadcast();
  }

  async closeRoom() {
    const roomId = this.roomId;
    const remainingSockets = [...this.sockets.values()];

    if (this.presenceTimer) {
      clearTimeout(this.presenceTimer);
      this.presenceTimer = null;
    }

    this.roomId = "";
    this.joinSecret = "";
    this.hostSessionId = "";
    this.hostDisconnectedAt = 0;
    this.participants.clear();
    this.sockets.clear();
    await this.clearRoomAlarm();
    await this.clearRoomMeta();

    const payload = encodeEnvelope({
      kind: "room_closed",
      roomId,
    });

    for (const socket of remainingSockets) {
      try {
        socket.send(payload);
      } catch {}
      try {
        socket.close(1001, "Room closed");
      } catch {}
    }
  }

  async alarm() {
    if (!this.hostDisconnectedAt) return;
    if (this.hostSessionId && this.sockets.has(this.hostSessionId)) {
      this.hostDisconnectedAt = 0;
      await this.persistRoomMeta();
      await this.clearRoomAlarm();
      return;
    }
    if (Date.now() - this.hostDisconnectedAt < HOST_GRACE_MS) {
      await this.ctx.storage.setAlarm(this.hostDisconnectedAt + HOST_GRACE_MS);
      return;
    }
    await this.closeRoom();
  }
}
