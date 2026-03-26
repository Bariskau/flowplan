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
    icon: string;
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
}

export interface AppState {
    plans: Plan[];
    feedbacks: Feedback[];
    positions: Record<string, Record<string, { x: number; y: number }>>;
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

export interface HistoryEntry {
    id: string;
    timestamp: number;
    action: string;
    description: string;
    cards: CardSummary[];
    fullCards?: Card[];
}

export interface PlanHistory {
    planId: string;
    entries: HistoryEntry[];
}

export interface HistoryDiff {
    added: CardSummary[];
    removed: CardSummary[];
    modified: { before: CardSummary; after: CardSummary }[];
}
