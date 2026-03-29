import type { AppState, PlanHistory } from "../types";

const BASE = "http://localhost:3100/api";

export async function fetchState(): Promise<AppState> {
  const r = await fetch(`${BASE}/state`);
  if (!r.ok) throw new Error("fetch failed");
  return r.json();
}

export async function addFeedback(
  cardId: string,
  type: "question" | "directive" | "issue",
  text: string,
): Promise<{ id: string }> {
  const r = await fetch(`${BASE}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId, type, text }),
  });
  if (!r.ok) throw new Error("add feedback failed");
  return r.json();
}

export async function deleteFeedback(id: string): Promise<void> {
  const r = await fetch(`${BASE}/feedback/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("delete feedback failed");
}

export async function savePositions(
  planId: string,
  positions: Record<string, { x: number; y: number }>,
): Promise<void> {
  const r = await fetch(`${BASE}/plans/${planId}/positions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(positions),
  });
  if (!r.ok) throw new Error("save positions failed");
}

export async function deletePlan(planId: string): Promise<void> {
  const r = await fetch(`${BASE}/plans/${planId}`, { method: "DELETE" });
  if (!r.ok) throw new Error("delete plan failed");
}

export async function togglePin(planId: string): Promise<{ pinned: boolean }> {
  const r = await fetch(`${BASE}/plans/${planId}/pin`, { method: "POST" });
  if (!r.ok) throw new Error("toggle pin failed");
  return r.json();
}

export async function fetchHistory(planId: string): Promise<PlanHistory> {
  const r = await fetch(`${BASE}/plans/${planId}/history`);
  if (!r.ok) throw new Error("fetch history failed");
  return r.json();
}

export async function clearHistory(planId: string): Promise<void> {
  const r = await fetch(`${BASE}/plans/${planId}/history`, { method: "DELETE" });
  if (!r.ok) throw new Error("clear history failed");
}

export async function importPlan(plan: any): Promise<{ id: string; title: string }> {
  const r = await fetch(`${BASE}/plans/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  });
  if (!r.ok) throw new Error("import failed");
  return r.json();
}

export async function createPlan(title: string, icon: string, description: string): Promise<{ id: string }> {
  const r = await fetch(`${BASE}/plans/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, icon, description }),
  });
  if (!r.ok) throw new Error("create plan failed");
  return r.json();
}

export async function addCard(
  planId: string,
  card: { title: string; description: string; type: string; repo: string; files: string[]; dependencies: string[] },
): Promise<{ id: string }> {
  const r = await fetch(`${BASE}/plans/${planId}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });
  if (!r.ok) throw new Error("add card failed");
  return r.json();
}

export async function updateCard(planId: string, cardId: string, updates: Record<string, any>): Promise<void> {
  const r = await fetch(`${BASE}/plans/${planId}/cards/${cardId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!r.ok) throw new Error("update card failed");
}

export async function deleteCard(planId: string, cardId: string): Promise<void> {
  const r = await fetch(`${BASE}/plans/${planId}/cards/${cardId}`, { method: "DELETE" });
  if (!r.ok) throw new Error("delete card failed");
}
