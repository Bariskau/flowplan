import * as Y from "yjs";
import type { Card, Feedback, Plan } from "../types";
import type { SharedPlanSnapshot } from "./p2p";

const ROOT_KEY = "flowplan";
const META_KEY = "meta";
const CARDS_KEY = "cards";
const POSITIONS_KEY = "positions";
const FEEDBACKS_JSON_KEY = "feedbacks_json";

export type FlowPlanDocOrigin =
  | { kind: "bootstrap" }
  | { kind: "local-ui" }
  | { kind: "peer_state"; fromSessionId?: string }
  | { kind: "peer_update"; fromSessionId?: string };

type UpdateListener = (update: Uint8Array, snapshot: SharedPlanSnapshot, origin: FlowPlanDocOrigin) => void;

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function normalizeOrigin(origin: unknown): FlowPlanDocOrigin {
  if (origin && typeof origin === "object" && "kind" in origin) {
    const candidate = origin as { kind?: unknown; fromSessionId?: unknown };
    if (candidate.kind === "bootstrap") return { kind: "bootstrap" };
    if (candidate.kind === "local-ui") return { kind: "local-ui" };
    if (candidate.kind === "peer_state" || candidate.kind === "peer_update") {
      return {
        kind: candidate.kind,
        fromSessionId: typeof candidate.fromSessionId === "string" ? candidate.fromSessionId : undefined,
      };
    }
  }
  return { kind: "local-ui" };
}

function ensureMap(parent: Y.Map<unknown>, key: string) {
  const existing = parent.get(key);
  if (existing instanceof Y.Map) return existing as Y.Map<unknown>;
  const created = new Y.Map<unknown>();
  parent.set(key, created);
  return created;
}

function removeMissingKeys(map: Y.Map<unknown>, nextKeys: Set<string>) {
  for (const key of Array.from(map.keys())) {
    if (!nextKeys.has(key)) {
      map.delete(key);
    }
  }
}

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toCard(cardId: string, cardMap: Y.Map<unknown>): Card {
  return {
    id: cardId,
    title: typeof cardMap.get("title") === "string" ? (cardMap.get("title") as string) : "",
    description: typeof cardMap.get("description") === "string" ? (cardMap.get("description") as string) : "",
    type: (typeof cardMap.get("type") === "string" ? (cardMap.get("type") as string) : "edit") as Card["type"],
    repo: typeof cardMap.get("repo") === "string" ? (cardMap.get("repo") as string) : "",
    files: parseJsonValue<string[]>(cardMap.get("files_json"), []),
    dependencies: parseJsonValue<string[]>(cardMap.get("dependencies_json"), []),
    fileChanges: parseJsonValue<Record<string, NonNullable<Card["fileChanges"]>[string]>>(
      cardMap.get("file_changes_json"),
      {},
    ),
    order: typeof cardMap.get("order") === "number" ? (cardMap.get("order") as number) : 0,
  };
}

export class FlowPlanCollabDoc {
  private readonly doc = new Y.Doc();
  private readonly root = this.doc.getMap<unknown>(ROOT_KEY);
  private readonly listeners = new Set<UpdateListener>();
  private cachedSnapshot: SharedPlanSnapshot | null = null;
  private snapshotDirty = true;

  constructor(initialSnapshot?: SharedPlanSnapshot | null) {
    this.doc.on("update", this.handleUpdate);
    if (initialSnapshot) {
      this.syncFromSnapshot(initialSnapshot, { kind: "bootstrap" });
    }
  }

  destroy() {
    this.doc.off("update", this.handleUpdate);
    this.listeners.clear();
    this.doc.destroy();
  }

  onUpdate(listener: UpdateListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStateUpdate() {
    return Y.encodeStateAsUpdate(this.doc);
  }

  applyRemoteUpdate(update: Uint8Array, fromSessionId?: string, mode: "state" | "update" = "update") {
    Y.applyUpdate(
      this.doc,
      update,
      {
        kind: mode === "state" ? "peer_state" : "peer_update",
        fromSessionId,
      } satisfies FlowPlanDocOrigin,
    );
  }

  syncFromSnapshot(snapshot: SharedPlanSnapshot, origin: FlowPlanDocOrigin = { kind: "local-ui" }) {
    this.doc.transact(() => {
      const meta = ensureMap(this.root, META_KEY);
      const cards = ensureMap(this.root, CARDS_KEY);
      const positions = ensureMap(this.root, POSITIONS_KEY);

      meta.set("id", snapshot.plan.id);
      meta.set("title", snapshot.plan.title);
      meta.set("icon", snapshot.plan.icon ?? "");
      meta.set("description", snapshot.plan.description);
      meta.set("created_at", snapshot.plan.createdAt);
      meta.set("pinned", !!snapshot.plan.pinned);
      meta.set(FEEDBACKS_JSON_KEY, JSON.stringify(snapshot.feedbacks ?? []));

      const nextCardIds = new Set(snapshot.plan.steps.map((card) => card.id));
      removeMissingKeys(cards, nextCardIds);

      for (const card of snapshot.plan.steps) {
        const cardMap = ensureMap(cards, card.id);
        cardMap.set("title", card.title);
        cardMap.set("description", card.description);
        cardMap.set("type", card.type);
        cardMap.set("repo", card.repo);
        cardMap.set("order", card.order ?? 0);
        cardMap.set("files_json", JSON.stringify(card.files ?? []));
        cardMap.set("dependencies_json", JSON.stringify(card.dependencies ?? []));
        cardMap.set("file_changes_json", JSON.stringify(card.fileChanges ?? {}));
      }

      const nextPositionIds = new Set(Object.keys(snapshot.positions));
      removeMissingKeys(positions, nextPositionIds);

      for (const [cardId, position] of Object.entries(snapshot.positions)) {
        const positionMap = ensureMap(positions, cardId);
        positionMap.set("x", position.x);
        positionMap.set("y", position.y);
      }
    }, origin);
    this.snapshotDirty = true;
  }

  getSnapshot(): SharedPlanSnapshot | null {
    if (!this.snapshotDirty && this.cachedSnapshot) {
      return cloneValue(this.cachedSnapshot);
    }

    const meta = ensureMap(this.root, META_KEY);
    const cards = ensureMap(this.root, CARDS_KEY);
    const positions = ensureMap(this.root, POSITIONS_KEY);

    const planId = meta.get("id");
    if (typeof planId !== "string" || !planId) return null;

    const plan: Plan = {
      id: planId,
      title: typeof meta.get("title") === "string" ? (meta.get("title") as string) : "",
      icon: typeof meta.get("icon") === "string" ? (meta.get("icon") as string) : "",
      description: typeof meta.get("description") === "string" ? (meta.get("description") as string) : "",
      createdAt: typeof meta.get("created_at") === "number" ? (meta.get("created_at") as number) : Date.now(),
      pinned: !!meta.get("pinned"),
      steps: Array.from(cards.entries())
        .map(([cardId, value]) => {
          if (!(value instanceof Y.Map)) return null;
          return toCard(cardId, value as Y.Map<unknown>);
        })
        .filter((card): card is Card => !!card)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title)),
    };

    const snapshotPositions = Object.fromEntries(
      Array.from(positions.entries())
        .map(([cardId, value]) => {
          if (!(value instanceof Y.Map)) return null;
          const positionMap = value as Y.Map<unknown>;
          const x = typeof positionMap.get("x") === "number" ? (positionMap.get("x") as number) : 0;
          const y = typeof positionMap.get("y") === "number" ? (positionMap.get("y") as number) : 0;
          return [cardId, { x, y }] as const;
        })
        .filter((entry): entry is readonly [string, { x: number; y: number }] => !!entry),
    );

    this.cachedSnapshot = {
      plan: cloneValue(plan),
      positions: cloneValue(snapshotPositions),
      feedbacks: parseJsonValue<Feedback[]>(meta.get(FEEDBACKS_JSON_KEY), []).map((feedback) => ({
        ...feedback,
      })),
    };
    this.snapshotDirty = false;
    return cloneValue(this.cachedSnapshot);
  }

  private readonly handleUpdate = (update: Uint8Array, origin: unknown) => {
    this.snapshotDirty = true;
    const snapshot = this.getSnapshot();
    if (!snapshot) return;
    const normalizedOrigin = normalizeOrigin(origin);
    for (const listener of this.listeners) {
      listener(update, snapshot, normalizedOrigin);
    }
  };
}
