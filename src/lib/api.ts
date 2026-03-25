import type { AppState, Feedback, PlanHistory } from "../types";

const BASE = "http://localhost:3100/api";

export async function fetchState(): Promise<AppState> {
  const r = await fetch(`${BASE}/state`);
  if (!r.ok) throw new Error("fetch failed");
  return r.json();
}

export async function addFeedback(cardId: string, type: "question" | "directive" | "issue", text: string): Promise<Feedback> {
  const r = await fetch(`${BASE}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId, type, text }) });
  return r.json();
}

export async function answerFeedback(id: string, answer: string): Promise<Feedback> {
  const r = await fetch(`${BASE}/feedback/${id}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer }) });
  return r.json();
}

export async function deleteFeedback(id: string): Promise<void> {
  await fetch(`${BASE}/feedback/${id}`, { method: "DELETE" });
}

export async function savePositions(planId: string, positions: Record<string, { x: number; y: number }>): Promise<void> {
  await fetch(`${BASE}/plans/${planId}/positions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(positions) });
}

export async function deletePlan(planId: string): Promise<void> {
  await fetch(`${BASE}/plans/${planId}`, { method: "DELETE" });
}

export async function togglePin(planId: string): Promise<{ pinned: boolean }> {
  const r = await fetch(`${BASE}/plans/${planId}/pin`, { method: "POST" });
  return r.json();
}

export async function fetchHistory(planId: string): Promise<PlanHistory> {
  const r = await fetch(`${BASE}/plans/${planId}/history`);
  if (!r.ok) throw new Error("fetch history failed");
  return r.json();
}

export async function clearHistory(planId: string): Promise<void> {
  await fetch(`${BASE}/plans/${planId}/history`, { method: "DELETE" });
}

export async function importPlan(plan: any): Promise<{ id: string; title: string }> {
  const r = await fetch(`${BASE}/plans/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plan) });
  if (!r.ok) throw new Error("import failed");
  return r.json();
}
