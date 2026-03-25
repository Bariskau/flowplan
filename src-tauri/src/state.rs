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
    pub icon: String,
    pub description: String,
    pub steps: Vec<Card>,
    pub created_at: u64,
    #[serde(default)]
    pub pinned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub timestamp: u64,
    pub action: String,
    pub description: String,
    pub cards: Vec<CardSummary>,
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
            card_type: match self.card_type {
                CardType::Research => "research",
                CardType::Planning => "planning",
                CardType::Create => "create",
                CardType::Edit => "edit",
                CardType::Test => "test",
            }
            .to_string(),
            description_len: self.description.len(),
            files_count: self.files.len(),
            files: self.files.clone(),
            dependencies: self.dependencies.clone(),
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

const MAX_HISTORY_ENTRIES: usize = 30;

pub fn record_snapshot(plan: &Plan, action: &str, description: &str) {
    let mut history = load_history(&plan.id);
    let entry = HistoryEntry {
        id: gen_id("hist"),
        timestamp: now_millis(),
        action: action.to_string(),
        description: description.to_string(),
        cards: plan.steps.iter().map(|c| c.to_summary()).collect(),
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
