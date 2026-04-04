use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

pub type SharedState = Arc<RwLock<AppState>>;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub plans: Vec<Plan>,
    pub feedbacks: Vec<Feedback>,
    #[serde(default)]
    pub positions: HashMap<String, HashMap<String, Position>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            plans: Vec::new(),
            feedbacks: Vec::new(),
            positions: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub icon: String,
    pub description: String,
    pub steps: Vec<Card>,
    pub created_at: u64,
    #[serde(default)]
    pub pinned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    pub content: String,
    pub language: String,
    pub change_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Card {
    pub id: String,
    pub title: String,
    pub description: String,
    #[serde(rename = "type")]
    pub card_type: CardType,
    pub repo: String,
    pub files: Vec<String>,
    pub dependencies: Vec<String>,
    #[serde(default)]
    pub file_changes: HashMap<String, FileChange>,
    #[serde(default)]
    pub order: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CardType {
    Research,
    Planning,
    Create,
    Edit,
    Test,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Feedback {
    pub id: String,
    pub card_id: String,
    #[serde(rename = "type")]
    pub feedback_type: FeedbackType,
    pub text: String,
    pub answer: Option<String>,
    pub timestamp: u64,
    #[serde(default)]
    pub read: bool,
    #[serde(default)]
    pub owner_user_id: String,
    #[serde(default)]
    pub owner_username: String,
    #[serde(default)]
    pub owner_avatar_seed: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FeedbackType {
    Question,
    Directive,
    Issue,
}

fn state_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".plan-visual-planner")
}

fn state_file() -> PathBuf {
    state_dir().join("state.json")
}

pub fn load_state() -> AppState {
    let path = state_file();
    if path.exists() {
        match std::fs::read_to_string(&path) {
            Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
            Err(_) => AppState::default(),
        }
    } else {
        AppState::default()
    }
}

/// Save state without recording history (for manual UI edits)
#[allow(dead_code)]
pub fn save_state_no_history(state: &AppState) {
    let dir = state_dir();
    let _ = std::fs::create_dir_all(&dir);
    let path = state_file();
    if let Ok(data) = serde_json::to_string_pretty(state) {
        let _ = std::fs::write(path, data);
    }
}

pub fn save_state(state: &AppState) {
    let dir = state_dir();
    let _ = std::fs::create_dir_all(&dir);
    let path = state_file();
    if let Ok(data) = serde_json::to_string_pretty(state) {
        let _ = std::fs::write(path, data);
    }
}

pub fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardSummary {
    pub id: String,
    pub title: String,
    #[serde(rename = "type")]
    pub card_type: String,
    pub description_len: usize,
    pub files_count: usize,
    pub files: Vec<String>,
    pub dependencies: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HistoryActor {
    Ui,
    Agent,
    Collab,
    #[default]
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HistorySource {
    Rest,
    Mcp,
    Undo,
    Redo,
    #[default]
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HistoryChangeKind {
    PlanCreated,
    CardAdded,
    CardRemoved,
    CardUpdated,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HistoryPlanSnapshot {
    pub id: String,
    pub title: String,
    pub icon: String,
    pub description: String,
    pub created_at: u64,
    pub pinned: bool,
    #[serde(default)]
    pub cards: Vec<Card>,
    #[serde(default)]
    pub positions: HashMap<String, Position>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryChange {
    pub kind: HistoryChangeKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub card_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default)]
    pub changed_fields: Vec<String>,
    #[serde(default)]
    pub dependencies_added: Vec<String>,
    #[serde(default)]
    pub dependencies_removed: Vec<String>,
    #[serde(default)]
    pub files_added: Vec<String>,
    #[serde(default)]
    pub files_removed: Vec<String>,
    #[serde(default)]
    pub file_changes_updated: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub before: Option<Card>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub after: Option<Card>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub revision: u64,
    #[serde(default)]
    pub timestamp: u64,
    #[serde(default)]
    pub actor: HistoryActor,
    #[serde(default)]
    pub actor_id: Option<String>,
    #[serde(default)]
    pub actor_avatar_seed: Option<String>,
    #[serde(default)]
    pub source: HistorySource,
    #[serde(default)]
    pub tx_id: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub changes: Vec<HistoryChange>,
    #[serde(default)]
    pub snapshot: HistoryPlanSnapshot,
    #[serde(default)]
    pub action: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub previous_cards: Vec<CardSummary>,
    pub cards: Vec<CardSummary>,
    #[serde(default)]
    pub previous_full_cards: Vec<Card>,
    #[serde(default)]
    pub full_cards: Vec<Card>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanHistory {
    pub plan_id: String,
    pub entries: Vec<HistoryEntry>,
}

impl Card {
    pub fn to_summary(&self) -> CardSummary {
        CardSummary {
            id: self.id.clone(),
            title: self.title.clone(),
            card_type: self.card_type.as_str().to_string(),
            description_len: self.description.len(),
            files_count: self.files.len(),
            files: self.files.clone(),
            dependencies: self.dependencies.clone(),
        }
    }
}

impl CardType {
    pub fn as_str(&self) -> &'static str {
        match self {
            CardType::Research => "research",
            CardType::Planning => "planning",
            CardType::Create => "create",
            CardType::Edit => "edit",
            CardType::Test => "test",
        }
    }
}

impl HistoryPlanSnapshot {
    pub fn from_parts(plan: &Plan, positions: Option<&HashMap<String, Position>>) -> Self {
        Self {
            id: plan.id.clone(),
            title: plan.title.clone(),
            icon: plan.icon.clone(),
            description: plan.description.clone(),
            created_at: plan.created_at,
            pinned: plan.pinned,
            cards: plan.steps.clone(),
            positions: positions.cloned().unwrap_or_default(),
        }
    }
}

fn history_dir() -> PathBuf {
    state_dir().join("history")
}

fn history_file(plan_id: &str) -> PathBuf {
    history_dir().join(format!("{}.json", plan_id))
}

pub fn load_history(plan_id: &str) -> PlanHistory {
    std::fs::read_to_string(history_file(plan_id))
        .ok()
        .and_then(|data| serde_json::from_str(&data).ok())
        .unwrap_or_else(|| PlanHistory {
            plan_id: plan_id.to_string(),
            entries: Vec::new(),
        })
}

pub fn save_history(history: &PlanHistory) {
    let dir = history_dir();
    let _ = std::fs::create_dir_all(&dir);
    let path = history_file(&history.plan_id);
    if let Ok(data) = serde_json::to_string_pretty(history) {
        let _ = std::fs::write(path, data);
    }
}

pub fn delete_history(plan_id: &str) {
    let path = history_file(plan_id);
    let _ = std::fs::remove_file(path);
}

const MAX_HISTORY_ENTRIES: usize = 200;

fn are_string_vectors_equal(prev: &[String], next: &[String]) -> bool {
    prev.len() == next.len() && prev.iter().zip(next.iter()).all(|(a, b)| a == b)
}

fn are_cards_equal(before: &Card, after: &Card) -> bool {
    before.title == after.title
        && before.description == after.description
        && before.card_type == after.card_type
        && before.repo == after.repo
        && before.order == after.order
        && are_string_vectors_equal(&before.files, &after.files)
        && are_string_vectors_equal(&before.dependencies, &after.dependencies)
        && before.file_changes == after.file_changes
}

fn diff_strings(before: &[String], after: &[String]) -> (Vec<String>, Vec<String>) {
    let mut added = after
        .iter()
        .filter(|value| !before.contains(value))
        .cloned()
        .collect::<Vec<_>>();
    let mut removed = before
        .iter()
        .filter(|value| !after.contains(value))
        .cloned()
        .collect::<Vec<_>>();
    added.sort();
    removed.sort();
    (added, removed)
}

fn diff_file_change_paths(
    before: &HashMap<String, FileChange>,
    after: &HashMap<String, FileChange>,
) -> Vec<String> {
    let mut updated = after
        .iter()
        .filter_map(|(path, next_change)| match before.get(path) {
            Some(prev_change) if prev_change == next_change => None,
            _ => Some(path.clone()),
        })
        .collect::<Vec<_>>();

    for path in before.keys() {
        if !after.contains_key(path) {
            updated.push(path.clone());
        }
    }

    updated.sort();
    updated.dedup();
    updated
}

fn collect_changed_fields(before: &Card, after: &Card) -> Vec<String> {
    let mut fields = Vec::new();
    if before.title != after.title {
        fields.push("title".to_string());
    }
    if before.description != after.description {
        fields.push("description".to_string());
    }
    if before.card_type != after.card_type {
        fields.push("type".to_string());
    }
    if before.repo != after.repo {
        fields.push("repo".to_string());
    }
    if before.order != after.order {
        fields.push("order".to_string());
    }
    fields
}

pub fn build_history_changes(before_plan: Option<&Plan>, after_plan: &Plan) -> Vec<HistoryChange> {
    let Some(before_plan) = before_plan else {
        return after_plan
            .steps
            .iter()
            .map(|card| HistoryChange {
                kind: HistoryChangeKind::CardAdded,
                card_id: Some(card.id.clone()),
                title: Some(card.title.clone()),
                changed_fields: Vec::new(),
                dependencies_added: Vec::new(),
                dependencies_removed: Vec::new(),
                files_added: Vec::new(),
                files_removed: Vec::new(),
                file_changes_updated: Vec::new(),
                before: None,
                after: Some(card.clone()),
            })
            .collect();
    };

    let before_map = before_plan
        .steps
        .iter()
        .map(|card| (card.id.as_str(), card))
        .collect::<HashMap<_, _>>();
    let after_map = after_plan
        .steps
        .iter()
        .map(|card| (card.id.as_str(), card))
        .collect::<HashMap<_, _>>();

    let mut changes = Vec::new();

    for card in &after_plan.steps {
        match before_map.get(card.id.as_str()) {
            None => changes.push(HistoryChange {
                kind: HistoryChangeKind::CardAdded,
                card_id: Some(card.id.clone()),
                title: Some(card.title.clone()),
                changed_fields: Vec::new(),
                dependencies_added: Vec::new(),
                dependencies_removed: Vec::new(),
                files_added: Vec::new(),
                files_removed: Vec::new(),
                file_changes_updated: Vec::new(),
                before: None,
                after: Some(card.clone()),
            }),
            Some(before_card) if !are_cards_equal(before_card, card) => {
                let (dependencies_added, dependencies_removed) =
                    diff_strings(&before_card.dependencies, &card.dependencies);
                let (files_added, files_removed) = diff_strings(&before_card.files, &card.files);
                let file_changes_updated =
                    diff_file_change_paths(&before_card.file_changes, &card.file_changes);

                changes.push(HistoryChange {
                    kind: HistoryChangeKind::CardUpdated,
                    card_id: Some(card.id.clone()),
                    title: Some(card.title.clone()),
                    changed_fields: collect_changed_fields(before_card, card),
                    dependencies_added,
                    dependencies_removed,
                    files_added,
                    files_removed,
                    file_changes_updated,
                    before: Some((*before_card).clone()),
                    after: Some(card.clone()),
                });
            }
            _ => {}
        }
    }

    for card in &before_plan.steps {
        if !after_map.contains_key(card.id.as_str()) {
            changes.push(HistoryChange {
                kind: HistoryChangeKind::CardRemoved,
                card_id: Some(card.id.clone()),
                title: Some(card.title.clone()),
                changed_fields: Vec::new(),
                dependencies_added: Vec::new(),
                dependencies_removed: Vec::new(),
                files_added: Vec::new(),
                files_removed: Vec::new(),
                file_changes_updated: Vec::new(),
                before: Some(card.clone()),
                after: None,
            });
        }
    }

    changes
}

fn build_history_summary(changes: &[HistoryChange]) -> String {
    if changes.is_empty() {
        return "Updated plan".to_string();
    }

    if changes.len() == 1 {
        let change = &changes[0];
        return match change.kind {
            HistoryChangeKind::PlanCreated => "Created plan".to_string(),
            HistoryChangeKind::CardAdded => {
                format!(
                    "Added card: {}",
                    change.title.as_deref().unwrap_or("Untitled")
                )
            }
            HistoryChangeKind::CardRemoved => {
                format!(
                    "Removed card: {}",
                    change.title.as_deref().unwrap_or("Untitled")
                )
            }
            HistoryChangeKind::CardUpdated => {
                let dep_only = change.changed_fields.is_empty()
                    && change.files_added.is_empty()
                    && change.files_removed.is_empty()
                    && change.file_changes_updated.is_empty()
                    && (!change.dependencies_added.is_empty()
                        || !change.dependencies_removed.is_empty());
                if dep_only {
                    format!(
                        "Updated dependencies: {}",
                        change.title.as_deref().unwrap_or("Untitled")
                    )
                } else {
                    format!(
                        "Updated card: {}",
                        change.title.as_deref().unwrap_or("Untitled")
                    )
                }
            }
        };
    }

    let added = changes
        .iter()
        .filter(|change| change.kind == HistoryChangeKind::CardAdded)
        .count();
    let removed = changes
        .iter()
        .filter(|change| change.kind == HistoryChangeKind::CardRemoved)
        .count();
    let updated = changes
        .iter()
        .filter(|change| change.kind == HistoryChangeKind::CardUpdated)
        .count();

    if added == changes.len() {
        format!("Added {} cards", added)
    } else if removed == changes.len() {
        format!("Removed {} cards", removed)
    } else if updated == changes.len() {
        format!("Updated {} cards", updated)
    } else {
        format!("Applied {} changes", changes.len())
    }
}

fn build_action_label(changes: &[HistoryChange]) -> String {
    if changes.is_empty() {
        return "update_card".to_string();
    }

    if changes.len() == 1 {
        return match changes[0].kind {
            HistoryChangeKind::PlanCreated => "create".to_string(),
            HistoryChangeKind::CardAdded => "add_card".to_string(),
            HistoryChangeKind::CardRemoved => "remove_card".to_string(),
            HistoryChangeKind::CardUpdated => "update_card".to_string(),
        };
    }

    let all_added = changes
        .iter()
        .all(|change| change.kind == HistoryChangeKind::CardAdded);
    let all_removed = changes
        .iter()
        .all(|change| change.kind == HistoryChangeKind::CardRemoved);

    if all_added {
        "add_cards".to_string()
    } else if all_removed {
        "remove_cards".to_string()
    } else {
        "update_card".to_string()
    }
}

pub fn append_history_entry(
    plan: &Plan,
    positions: Option<&HashMap<String, Position>>,
    actor: HistoryActor,
    actor_id: Option<String>,
    actor_avatar_seed: Option<String>,
    source: HistorySource,
    tx_id: Option<String>,
    changes: Vec<HistoryChange>,
    summary: Option<String>,
) {
    if changes.is_empty() {
        return;
    }

    if matches!(source, HistorySource::Undo | HistorySource::Redo) {
        return;
    }

    let mut history = load_history(&plan.id);
    let last_revision = history
        .entries
        .last()
        .map(|entry| entry.revision.max(history.entries.len() as u64))
        .unwrap_or(0);
    let summary = summary.unwrap_or_else(|| build_history_summary(&changes));
    let action = build_action_label(&changes);
    let entry = HistoryEntry {
        id: gen_id("hist"),
        revision: last_revision + 1,
        timestamp: now_millis(),
        actor,
        actor_id,
        actor_avatar_seed,
        source,
        tx_id: tx_id.unwrap_or_else(|| gen_id("tx")),
        summary: summary.clone(),
        changes,
        snapshot: HistoryPlanSnapshot::from_parts(plan, positions),
        action,
        description: summary,
        previous_cards: Vec::new(),
        cards: plan.steps.iter().map(|c| c.to_summary()).collect(),
        previous_full_cards: Vec::new(),
        full_cards: plan.steps.clone(),
    };
    history.entries.push(entry);
    if history.entries.len() > MAX_HISTORY_ENTRIES {
        let excess = history.entries.len() - MAX_HISTORY_ENTRIES;
        history.entries.drain(..excess);
    }
    save_history(&history);
}

pub fn gen_id(prefix: &str) -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let ts = now_millis();
    let seq = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{}-{}-{:04x}", prefix, ts, seq & 0xFFFF)
}
