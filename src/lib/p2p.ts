import type { CollabParticipant, CollabProfile, CollabSession, Feedback, Plan } from "../types";
import type { CollabTransportState } from "../types";

export type SharedPlanSnapshot = {
  plan: Plan;
  positions: Record<string, { x: number; y: number }>;
  feedbacks: Feedback[];
};

type SignalEnvelope =
  | {
      kind: "ready";
      roomId: string;
      sessionId: string;
      role: "host" | "join";
    }
  | {
      kind: "pong";
      roomId: string;
      ts?: number;
    }
  | {
      kind: "presence";
      roomId: string;
      hostSessionId: string;
      participants: Array<{
        sessionId: string;
        userId: string;
        username: string;
        avatarSeed: string;
        isHost: boolean;
      }>;
    }
  | {
      kind: "signal";
      roomId: string;
      from: string;
      signal: any;
    }
  | {
      kind: "host_disconnected";
      roomId: string;
      graceMs: number;
    }
  | {
      kind: "host_reconnected";
      roomId: string;
    }
  | {
      kind: "room_closed";
      roomId: string;
    }
  | {
      kind: "error";
      message: string;
    }
  | {
      kind: "profile_update";
      userId: string;
      username: string;
      avatarSeed: string;
    };

type DataEnvelope =
  | {
      kind: "doc_state";
      authorSessionId?: string;
      update: string;
    }
  | {
      kind: "doc_update";
      authorSessionId?: string;
      update: string;
    }
  | {
      kind: "cursor";
      authorSessionId?: string;
      x: number;
      y: number;
      active: boolean;
    };

type Options = {
  session: CollabSession;
  getInitialDocUpdate: () => Uint8Array | null;
  onParticipants: (participants: CollabParticipant[]) => void;
  onHostAvailabilityChange?: (available: boolean, graceMs?: number) => void;
  onDocUpdate: (
    update: Uint8Array,
    transportPeerSessionId: string,
    authorSessionId: string | undefined,
    kind: "doc_state" | "doc_update",
  ) => void;
  onCursor: (
    cursor: { x: number; y: number; active: boolean },
    transportPeerSessionId: string,
    authorSessionId?: string,
  ) => void;
  onTransportStateChange?: (state: CollabTransportState) => void;
  onRoomClosed?: () => void;
  onError?: (message: string) => void;
};

function signalUrlForSession(session: CollabSession) {
  const url = new URL(session.serverUrl);
  if (!url.pathname || url.pathname === "/") {
    url.pathname = "/signal";
  }
  url.searchParams.set("roomId", session.roomId);
  url.searchParams.set("sessionId", session.selfSessionId);
  url.searchParams.set("role", session.status === "hosting" ? "host" : "join");
  url.searchParams.set("secret", session.joinSecret ?? "");
  const self = session.participants.find((participant) => participant.isSelf) ?? session.participants[0];
  url.searchParams.set("userId", self?.userId ?? "");
  url.searchParams.set("username", self?.username ?? "");
  url.searchParams.set("avatarSeed", self?.avatarSeed ?? "");
  return url.toString();
}

function serializeDataEnvelope(envelope: DataEnvelope) {
  return JSON.stringify(envelope);
}

function deserializeDataEnvelope(raw: string) {
  return JSON.parse(raw) as DataEnvelope;
}

function encodeUpdate(update: Uint8Array) {
  let binary = "";
  update.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

function decodeUpdate(encoded: string) {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

const HEARTBEAT_INTERVAL_MS = 20_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;
const MAX_RECONNECT_ATTEMPTS = 15;
const RECONNECT_BASE_MS = 600;
const RECONNECT_CAP_MS = 60_000;
const RECONNECT_JITTER_RATIO = 0.2;
const MAX_DATA_CHANNEL_MESSAGE_BYTES = 256 * 1024;

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

export class FlowPlanPeerSession {
  private readonly session: CollabSession;
  private readonly getInitialDocUpdate: Options["getInitialDocUpdate"];
  private readonly onParticipants: Options["onParticipants"];
  private readonly onHostAvailabilityChange?: Options["onHostAvailabilityChange"];
  private readonly onDocUpdate: Options["onDocUpdate"];
  private readonly onCursor: Options["onCursor"];
  private readonly onTransportStateChange?: Options["onTransportStateChange"];
  private readonly onRoomClosed?: Options["onRoomClosed"];
  private readonly onError?: Options["onError"];
  private readonly peers = new Map<string, RTCPeerConnection>();
  private readonly channels = new Map<string, RTCDataChannel>();
  private readonly knownPeers = new Set<string>();
  private readonly pendingIceCandidates = new Map<string, RTCIceCandidateInit[]>();
  private readonly pendingIceTimers = new Map<string, number>();
  private ws: WebSocket | null = null;
  private destroyed = false;
  private roomClosed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private heartbeatTimeoutTimer: number | null = null;
  private transportState: CollabTransportState = {
    signal: "connecting",
    peer: "idle",
  };

  constructor(options: Options) {
    this.session = options.session;
    this.getInitialDocUpdate = options.getInitialDocUpdate;
    this.onParticipants = options.onParticipants;
    this.onHostAvailabilityChange = options.onHostAvailabilityChange;
    this.onDocUpdate = options.onDocUpdate;
    this.onCursor = options.onCursor;
    this.onTransportStateChange = options.onTransportStateChange;
    this.onRoomClosed = options.onRoomClosed;
    this.onError = options.onError;
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }

  connect() {
    if (this.destroyed || this.roomClosed) return;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    this.updateTransportState({
      signal: this.reconnectAttempts > 0 ? "reconnecting" : "connecting",
    });
    const ws = new WebSocket(signalUrlForSession(this.session));
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.updateTransportState({
        signal: "connected",
      });
      this.startHeartbeat();
    };
    ws.onmessage = (event) => {
      if (this.destroyed) return;
      try {
        const message = JSON.parse(String(event.data)) as SignalEnvelope;
        this.handleSignalEnvelope(message);
      } catch (error) {
        if (this.destroyed) return;
        this.onError?.(error instanceof Error ? error.message : "Invalid signaling message");
      }
    };
    ws.onerror = () => {
      if (this.destroyed) return;
    };
    ws.onclose = () => {
      this.ws = null;
      this.stopHeartbeat();
      if (this.destroyed || this.roomClosed) return;
      this.updateTransportState({
        signal: "reconnecting",
      });
      this.scheduleReconnect();
    };
  }

  destroy() {
    this.destroyed = true;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ kind: "leave" }));
      } catch {}
    }
    this.ws?.close();
    this.ws = null;
    for (const timer of this.pendingIceTimers.values()) {
      window.clearTimeout(timer);
    }
    this.pendingIceTimers.clear();
    this.pendingIceCandidates.clear();
    this.channels.forEach((channel) => channel.close());
    this.channels.clear();
    this.peers.forEach((peer) => peer.close());
    this.peers.clear();
    this.knownPeers.clear();
    this.updateTransportState({
      signal: "disconnected",
      peer: "idle",
    });
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }

  updateSelfProfile(profile: Pick<CollabProfile, "userId" | "username" | "avatarSeed">) {
    this.session.participants = this.session.participants.map((participant) =>
      participant.sessionId === this.session.selfSessionId
        ? {
            ...participant,
            userId: profile.userId,
            username: profile.username,
            avatarSeed: profile.avatarSeed,
          }
        : participant,
    );

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    try {
      this.ws.send(
        JSON.stringify({
          kind: "profile_update",
          userId: profile.userId,
          username: profile.username,
          avatarSeed: profile.avatarSeed,
        }),
      );
    } catch {}
  }

  broadcastDocUpdate(update: Uint8Array, authorSessionId = this.session.selfSessionId) {
    this.broadcast({
      kind: "doc_update",
      authorSessionId,
      update: encodeUpdate(update),
    });
  }

  broadcastCursor(
    cursor: { x: number; y: number; active: boolean },
    authorSessionId = this.session.selfSessionId,
    excludePeerId?: string,
  ) {
    this.broadcast(
      {
        kind: "cursor",
        authorSessionId,
        x: cursor.x,
        y: cursor.y,
        active: cursor.active,
      },
      excludePeerId,
    );
  }

  private handleSignalEnvelope(message: SignalEnvelope) {
    switch (message.kind) {
      case "ready":
        return;
      case "pong":
        this.clearHeartbeatTimeout();
        return;
      case "presence": {
        const participants = message.participants.map((participant) => ({
          ...participant,
          isSelf: participant.sessionId === this.session.selfSessionId,
          status: "active" as const,
        }));
        this.onParticipants(participants);
        if (this.session.status === "hosting") {
          for (const participant of participants) {
            if (participant.sessionId === this.session.selfSessionId) continue;
            if (this.knownPeers.has(participant.sessionId)) continue;
            this.knownPeers.add(participant.sessionId);
            void this.createHostPeer(participant.sessionId);
          }
        }
        return;
      }
      case "host_disconnected":
        this.onHostAvailabilityChange?.(false, message.graceMs);
        return;
      case "host_reconnected":
        this.onHostAvailabilityChange?.(true);
        return;
      case "signal": {
        void this.handlePeerSignal(message.from, message.signal);
        return;
      }
      case "room_closed":
        this.roomClosed = true;
        this.stopHeartbeat();
        this.updateTransportState({
          signal: "disconnected",
          peer: "idle",
        });
        this.onRoomClosed?.();
        return;
      case "error":
        this.onError?.(message.message);
        return;
    }
  }

  private async createHostPeer(peerId: string) {
    const peer = this.createPeer(peerId);
    const channel = peer.createDataChannel("flowplan");
    this.attachChannel(peerId, channel);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    this.updateTransportState({
      peer: "connecting",
    });
    this.sendSignal(peerId, {
      type: "offer",
      sdp: offer.sdp,
    });
  }

  private createPeer(peerId: string) {
    let peer = this.peers.get(peerId);
    if (peer) return peer;

    peer = new RTCPeerConnection({
      iceServers: this.session.iceServers,
    });
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.queueIceCandidate(peerId, event.candidate.toJSON());
      } else {
        this.flushIceCandidates(peerId);
      }
    };
    peer.ondatachannel = (event) => {
      this.attachChannel(peerId, event.channel);
    };
    peer.onconnectionstatechange = () => {
      if (peer?.connectionState === "connected") {
        this.updateTransportState({
          peer: "connected",
        });
      } else if (peer?.connectionState === "connecting") {
        this.updateTransportState({
          peer: "connecting",
        });
      } else if (peer?.connectionState === "failed" || peer?.connectionState === "closed") {
        this.updateTransportState({
          peer: this.channels.size > 0 ? "connected" : "failed",
        });
        this.cleanupPeer(peerId);
      }
    };
    this.peers.set(peerId, peer);
    return peer;
  }

  private attachChannel(peerId: string, channel: RTCDataChannel) {
    this.channels.set(peerId, channel);
    channel.onopen = () => {
      this.updateTransportState({
        peer: "connected",
      });
      if (this.session.status === "hosting") {
        const initialUpdate = this.getInitialDocUpdate();
        if (initialUpdate && initialUpdate.length > 0) {
          this.sendDataEnvelope(peerId, channel, {
            kind: "doc_state",
            authorSessionId: this.session.selfSessionId,
            update: encodeUpdate(initialUpdate),
          });
        }
      }
    };
    channel.onmessage = (event) => {
      if (this.destroyed) return;
      try {
        const envelope = deserializeDataEnvelope(String(event.data));
        if (envelope.kind === "doc_state" || envelope.kind === "doc_update") {
          this.onDocUpdate(decodeUpdate(envelope.update), peerId, envelope.authorSessionId, envelope.kind);
          return;
        }
        if (envelope.kind === "cursor") {
          this.onCursor({ x: envelope.x, y: envelope.y, active: envelope.active }, peerId, envelope.authorSessionId);
        }
      } catch (error) {
        if (this.destroyed) return;
        this.onError?.(error instanceof Error ? error.message : "Invalid peer data");
      }
    };
    channel.onclose = () => {
      this.cleanupPeer(peerId);
    };
  }

  private async handlePeerSignal(fromPeerId: string, signal: any) {
    if (!signal || typeof signal !== "object" || typeof signal.type !== "string") return;

    const peer = this.createPeer(fromPeerId);

    if (signal.type === "offer") {
      await peer.setRemoteDescription(
        new RTCSessionDescription({
          type: "offer",
          sdp: signal.sdp,
        }),
      );
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      this.updateTransportState({
        peer: "connecting",
      });
      this.sendSignal(fromPeerId, {
        type: "answer",
        sdp: answer.sdp,
      });
      return;
    }

    if (signal.type === "answer") {
      await peer.setRemoteDescription(
        new RTCSessionDescription({
          type: "answer",
          sdp: signal.sdp,
        }),
      );
      return;
    }

    if (signal.type === "ice" && signal.candidate) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } catch {}
      return;
    }

    if (signal.type === "ice_batch" && Array.isArray(signal.candidates)) {
      for (const candidate of signal.candidates) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {}
      }
    }
  }

  private sendSignal(to: string, signal: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        kind: "signal",
        to,
        signal,
      }),
    );
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.destroyed || this.roomClosed) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.updateTransportState({
        signal: "disconnected",
        peer: this.channels.size > 0 ? "connected" : this.transportState.peer,
      });
      this.onError?.("Signal connection lost. Reconnect stopped after multiple attempts.");
      return;
    }
    const baseDelay = Math.min(RECONNECT_CAP_MS, RECONNECT_BASE_MS * 2 ** this.reconnectAttempts);
    const jitter = baseDelay * RECONNECT_JITTER_RATIO * ((Math.random() * 2) - 1);
    const delay = Math.max(RECONNECT_BASE_MS, Math.round(baseDelay + jitter));
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.destroyed || this.roomClosed) return;
      this.connect();
    }, delay);
  }

  private readonly handleVisibilityChange = () => {
    if (typeof document === "undefined" || document.hidden || this.destroyed || this.roomClosed) return;
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      if (this.reconnectTimer) {
        window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.connect();
      return;
    }
    if (this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ kind: "ping", ts: Date.now() }));
      } catch {}
    }
  };

  private queueIceCandidate(peerId: string, candidate: RTCIceCandidateInit) {
    const queued = this.pendingIceCandidates.get(peerId) ?? [];
    queued.push(candidate);
    this.pendingIceCandidates.set(peerId, queued);
    if (this.pendingIceTimers.has(peerId)) return;
    const timer = window.setTimeout(() => {
      this.pendingIceTimers.delete(peerId);
      this.flushIceCandidates(peerId);
    }, 120);
    this.pendingIceTimers.set(peerId, timer);
  }

  private flushIceCandidates(peerId: string) {
    const timer = this.pendingIceTimers.get(peerId);
    if (timer) {
      window.clearTimeout(timer);
      this.pendingIceTimers.delete(peerId);
    }
    const candidates = this.pendingIceCandidates.get(peerId) ?? [];
    if (candidates.length === 0) return;
    this.pendingIceCandidates.delete(peerId);
    this.sendSignal(peerId, {
      type: "ice_batch",
      candidates,
    });
  }

  private broadcast(envelope: DataEnvelope, excludePeerId?: string) {
    for (const [peerId, channel] of this.channels.entries()) {
      if (excludePeerId && peerId === excludePeerId) continue;
      this.sendDataEnvelope(peerId, channel, envelope);
    }
  }

  private sendDataEnvelope(peerId: string, channel: RTCDataChannel, envelope: DataEnvelope) {
    if (channel.readyState !== "open") return;
    const raw = serializeDataEnvelope(envelope);
    if (byteLength(raw) > MAX_DATA_CHANNEL_MESSAGE_BYTES) {
      this.onError?.(`Peer update too large to send directly (${peerId.slice(0, 8)}…)`);
      return;
    }
    try {
      channel.send(raw);
    } catch {
      this.cleanupPeer(peerId);
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      this.clearHeartbeatTimeout();
      try {
        this.ws.send(JSON.stringify({ kind: "ping", ts: Date.now() }));
      } catch {}
      this.heartbeatTimeoutTimer = window.setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          try {
            this.ws.close(1012, "Heartbeat timeout");
          } catch {}
        }
      }, HEARTBEAT_TIMEOUT_MS);
    }, HEARTBEAT_INTERVAL_MS);
  }

  private clearHeartbeatTimeout() {
    if (this.heartbeatTimeoutTimer) {
      window.clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.clearHeartbeatTimeout();
  }

  private cleanupPeer(peerId: string) {
    this.flushIceCandidates(peerId);
    this.channels.get(peerId)?.close();
    this.channels.delete(peerId);
    this.peers.get(peerId)?.close();
    this.peers.delete(peerId);
    this.knownPeers.delete(peerId);
    if (this.channels.size === 0) {
      this.updateTransportState({
        peer: this.peers.size > 0 ? "connecting" : "idle",
      });
    }
  }

  private updateTransportState(patch: Partial<CollabTransportState>) {
    const nextState: CollabTransportState = {
      ...this.transportState,
      ...patch,
    };
    if (
      nextState.signal === this.transportState.signal &&
      nextState.peer === this.transportState.peer
    ) {
      return;
    }
    this.transportState = nextState;
    this.onTransportStateChange?.(nextState);
  }
}
