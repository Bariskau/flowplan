import type { Card } from "../types";

export function formatCardRef(planTitle: string, card: Card): string {
  return `[${planTitle} / ${card.title}] (${card.type}#${card.id})`;
}
