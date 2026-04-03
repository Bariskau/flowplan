import type {
  AppState,
  Feedback,
  Plan,
  PlanHistory,
} from "../types";
import { invoke } from "@tauri-apps/api/core";

export const LOCAL_API_BASE = "http://127.0.0.1:3100/api";
type MutationSource = "rest" | "undo" | "redo";

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function useLocalInvoke(base = LOCAL_API_BASE) {
  return isTauriRuntime() && base === LOCAL_API_BASE;
}

function mutationHeaders(
  source: MutationSource = "rest",
  sessionId?: string | null,
  actorId?: string,
  actorAvatarSeed?: string,
) {
  return {
    "Content-Type": "application/json",
    "X-Flowplan-Source": source,
    ...(actorId ? { "X-Flowplan-Actor": actorId } : {}),
    ...(actorAvatarSeed ? { "X-Flowplan-Avatar": actorAvatarSeed } : {}),
    ...(sessionId ? { "X-Flowplan-Session": sessionId } : {}),
  };
}

export async function fetchState(base = LOCAL_API_BASE): Promise<AppState> {
  if (useLocalInvoke(base)) {
    return invoke<AppState>("get_app_state");
  }
  const r = await fetch(`${base}/state`);
  if (!r.ok) throw new Error("fetch failed");
  return r.json();
}

export async function addFeedback(
  cardId: string,
  type: "question" | "directive" | "issue",
  text: string,
  ownerUserId?: string,
  ownerUsername?: string,
  ownerAvatarSeed?: string,
  base = LOCAL_API_BASE,
): Promise<{ id: string }> {
  if (useLocalInvoke(base)) {
    return invoke<{ id: string }>("add_feedback", {
      cardId,
      feedbackType: type,
      text,
      ownerUserId,
      ownerUsername,
      ownerAvatarSeed,
    });
  }
  const r = await fetch(`${base}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId, type, text, ownerUserId, ownerUsername, ownerAvatarSeed }),
  });
  if (!r.ok) throw new Error("add feedback failed");
  return r.json();
}

export async function deleteFeedback(id: string, base = LOCAL_API_BASE): Promise<void> {
  if (useLocalInvoke(base)) {
    await invoke("delete_feedback", { id });
    return;
  }
  const r = await fetch(`${base}/feedback/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("delete feedback failed");
}

export async function savePositions(
  planId: string,
  positions: Record<string, { x: number; y: number }>,
  base = LOCAL_API_BASE,
  sessionId?: string | null,
): Promise<void> {
  if (useLocalInvoke(base)) {
    await invoke("save_positions", { planId, positions });
    return;
  }
  const r = await fetch(`${base}/plans/${planId}/positions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionId ? { "X-Flowplan-Session": sessionId } : {}),
    },
    body: JSON.stringify(positions),
  });
  if (!r.ok) throw new Error("save positions failed");
}

export async function deletePlan(planId: string, base = LOCAL_API_BASE, sessionId?: string | null): Promise<void> {
  if (useLocalInvoke(base)) {
    await invoke("delete_plan", { planId });
    return;
  }
  const r = await fetch(`${base}/plans/${planId}`, {
    method: "DELETE",
    headers: sessionId ? { "X-Flowplan-Session": sessionId } : undefined,
  });
  if (!r.ok) throw new Error("delete plan failed");
}

export async function forkPlan(
  planId: string,
  title?: string,
  base = LOCAL_API_BASE,
  actorId?: string,
  actorAvatarSeed?: string,
): Promise<{ id: string; title: string }> {
  if (useLocalInvoke(base)) {
    return invoke<{ id: string; title: string }>("fork_plan", { planId, title, actorId, actorAvatarSeed });
  }
  const r = await fetch(`${base}/plans/${planId}/fork`, {
    method: "POST",
    headers: mutationHeaders("rest", undefined, actorId, actorAvatarSeed),
    body: JSON.stringify({ title }),
  });
  if (!r.ok) throw new Error("fork plan failed");
  return r.json();
}

export async function togglePin(
  planId: string,
  base = LOCAL_API_BASE,
  sessionId?: string | null,
): Promise<{ pinned: boolean }> {
  if (useLocalInvoke(base)) {
    return invoke<{ pinned: boolean }>("toggle_pin", { planId });
  }
  const r = await fetch(`${base}/plans/${planId}/pin`, {
    method: "POST",
    headers: sessionId ? { "X-Flowplan-Session": sessionId } : undefined,
  });
  if (!r.ok) throw new Error("toggle pin failed");
  return r.json();
}

export async function fetchHistory(
  planId: string,
  options?: { offset?: number; limit?: number; base?: string },
): Promise<PlanHistory> {
  if (useLocalInvoke(options?.base || LOCAL_API_BASE)) {
    return invoke<PlanHistory>("fetch_history", {
      planId,
      query: {
        offset: options?.offset,
        limit: options?.limit,
      },
    });
  }
  const params = new URLSearchParams();
  if (options?.offset !== undefined) params.set("offset", String(options.offset));
  if (options?.limit !== undefined) params.set("limit", String(options.limit));
  const query = params.toString();
  const r = await fetch(`${options?.base || LOCAL_API_BASE}/plans/${planId}/history${query ? `?${query}` : ""}`);
  if (!r.ok) throw new Error("fetch history failed");
  return r.json();
}

export async function clearHistory(planId: string, base = LOCAL_API_BASE, sessionId?: string | null): Promise<void> {
  if (useLocalInvoke(base)) {
    await invoke("clear_history", { planId });
    return;
  }
  const r = await fetch(`${base}/plans/${planId}/history`, {
    method: "DELETE",
    headers: sessionId ? { "X-Flowplan-Session": sessionId } : undefined,
  });
  if (!r.ok) throw new Error("clear history failed");
}

export async function importPlan(
  plan: any,
  base = LOCAL_API_BASE,
  actorId?: string,
  actorAvatarSeed?: string,
): Promise<{ id: string; title: string }> {
  if (useLocalInvoke(base)) {
    return invoke<{ id: string; title: string }>("import_plan", { plan, actorId, actorAvatarSeed });
  }
  const r = await fetch(`${base}/plans/import`, {
    method: "POST",
    headers: mutationHeaders("rest", undefined, actorId, actorAvatarSeed),
    body: JSON.stringify(plan),
  });
  if (!r.ok) throw new Error("import failed");
  return r.json();
}

export async function createPlan(
  title: string,
  icon: string,
  description: string,
  base = LOCAL_API_BASE,
  actorId?: string,
  actorAvatarSeed?: string,
): Promise<{ id: string }> {
  if (useLocalInvoke(base)) {
    return invoke<{ id: string }>("create_plan", { title, icon, description, actorId, actorAvatarSeed });
  }
  const r = await fetch(`${base}/plans/create`, {
    method: "POST",
    headers: mutationHeaders("rest", undefined, actorId, actorAvatarSeed),
    body: JSON.stringify({ title, icon, description }),
  });
  if (!r.ok) throw new Error("create plan failed");
  return r.json();
}

export async function addCard(
  planId: string,
  card: {
    id?: string;
    title: string;
    description: string;
    type: string;
    repo: string;
    files: string[];
    dependencies: string[];
    fileChanges?: Record<string, any>;
    order?: number;
  },
  source: MutationSource = "rest",
  base = LOCAL_API_BASE,
  sessionId?: string | null,
  actorId?: string,
  actorAvatarSeed?: string,
): Promise<{ id: string }> {
  if (useLocalInvoke(base)) {
    return invoke<{ id: string }>("add_card", { planId, card, source, actorId, actorAvatarSeed });
  }
  const r = await fetch(`${base}/plans/${planId}/cards`, {
    method: "POST",
    headers: mutationHeaders(source, sessionId, actorId, actorAvatarSeed),
    body: JSON.stringify(card),
  });
  if (!r.ok) throw new Error("add card failed");
  return r.json();
}

export async function updateCard(
  planId: string,
  cardId: string,
  updates: Record<string, any>,
  source: MutationSource = "rest",
  base = LOCAL_API_BASE,
  sessionId?: string | null,
  actorId?: string,
  actorAvatarSeed?: string,
): Promise<void> {
  if (useLocalInvoke(base)) {
    await invoke("update_card", { planId, cardId, updates, source, actorId, actorAvatarSeed });
    return;
  }
  const r = await fetch(`${base}/plans/${planId}/cards/${cardId}`, {
    method: "POST",
    headers: mutationHeaders(source, sessionId, actorId, actorAvatarSeed),
    body: JSON.stringify(updates),
  });
  if (!r.ok) throw new Error("update card failed");
}

export async function deleteCard(
  planId: string,
  cardId: string,
  source: MutationSource = "rest",
  base = LOCAL_API_BASE,
  sessionId?: string | null,
  actorId?: string,
  actorAvatarSeed?: string,
): Promise<void> {
  if (useLocalInvoke(base)) {
    await invoke("delete_card", { planId, cardId, source, actorId, actorAvatarSeed });
    return;
  }
  const r = await fetch(`${base}/plans/${planId}/cards/${cardId}`, {
    method: "DELETE",
    headers: mutationHeaders(source, sessionId, actorId, actorAvatarSeed),
  });
  if (!r.ok) throw new Error("delete card failed");
}

export async function applyPeerSnapshot(
  plan: Plan,
  positions: Record<string, { x: number; y: number }>,
  feedbacks: Feedback[],
  actorId?: string,
  actorAvatarSeed?: string,
  recordHistory = true,
): Promise<void> {
  if (isTauriRuntime()) {
    await invoke("apply_peer_snapshot", { plan, positions, feedbacks, actorId, actorAvatarSeed, recordHistory });
  }
}
