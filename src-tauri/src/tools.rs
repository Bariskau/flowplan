use rmcp::handler::server::tool::ToolRouter;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{CallToolResult, Content, Implementation, ServerCapabilities, ServerInfo};
use rmcp::schemars::JsonSchema;
use rmcp::{tool, tool_handler, tool_router, ErrorData, ServerHandler};
use serde::Deserialize;

use crate::state::{self, Card, CardType, FileChange, Plan, SharedState};
use std::collections::HashMap;

pub struct PlannerHandler {
    state: SharedState,
    tool_router: ToolRouter<Self>,
}

impl PlannerHandler {
    pub fn new(state: SharedState) -> Self {
        let tool_router = Self::tool_router();
        Self { state, tool_router }
    }
}

#[derive(Debug, Deserialize, JsonSchema)]
struct CreatePlanParams {
    #[schemars(description = "Plan title")]
    title: String,
    #[schemars(description = "Emoji icon")]
    icon: String,
    #[schemars(description = "Brief description")]
    description: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct CardEntry {
    #[schemars(description = "Card title")]
    title: String,
    #[schemars(description = "Card description (markdown supported)")]
    description: String,
    #[schemars(description = "Type: research, planning, create, edit, or test")]
    card_type: CardType,
    #[schemars(description = "Repository or project path")]
    repo: String,
    #[schemars(description = "File paths relevant to this card")]
    files: Vec<String>,
    #[schemars(
        description = "IDs of cards this depends on. REQUIRED except for the first card — without dependencies cards appear disconnected."
    )]
    dependencies: Vec<String>,
    #[schemars(
        description = "Proposed code changes per file: [{path, content, language?, changeType?}]. Users preview these in the UI."
    )]
    file_changes: Option<Vec<FileChangeEntry>>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct AddCardsParams {
    #[schemars(description = "Plan ID")]
    plan_id: String,
    #[schemars(description = "Cards to add (single or multiple). IDs returned in order so later cards can reference earlier ones as dependencies.")]
    cards: Vec<CardEntry>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct RemoveCardParams {
    #[schemars(description = "Plan ID")]
    plan_id: String,
    #[schemars(description = "Card ID to remove")]
    card_id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct GetCardsParams {
    #[schemars(description = "Plan ID")]
    plan_id: String,
    #[schemars(description = "Skip N cards (default 0)")]
    offset: Option<usize>,
    #[schemars(description = "Max cards to return (default all)")]
    limit: Option<usize>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct ListPlansParams {}

#[derive(Debug, Deserialize, JsonSchema)]
struct GetPlanParams {
    #[schemars(description = "Plan ID")]
    plan_id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct ClearPlanParams {
    #[schemars(description = "Plan ID")]
    plan_id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct GetAllFeedbackParams {}

#[derive(Debug, Deserialize, JsonSchema)]
struct AnswerFeedbackParams {
    #[schemars(description = "Feedback ID")]
    feedback_id: String,
    #[schemars(description = "Your answer")]
    answer: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct AcknowledgeFeedbackParams {
    #[schemars(description = "Feedback IDs to mark as read")]
    feedback_ids: Vec<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct UpdateCardParams {
    #[schemars(description = "Plan ID")]
    plan_id: String,
    #[schemars(description = "Card ID")]
    card_id: String,
    #[schemars(description = "New title (omit to keep)")]
    title: Option<String>,
    #[schemars(description = "New description (omit to keep)")]
    description: Option<String>,
    #[schemars(description = "New type (omit to keep)")]
    card_type: Option<CardType>,
    #[schemars(description = "New repo path (omit to keep)")]
    repo: Option<String>,
    #[schemars(description = "New file list (omit to keep)")]
    files: Option<Vec<String>>,
    #[schemars(description = "New dependencies (omit to keep)")]
    dependencies: Option<Vec<String>>,
    #[schemars(description = "New file changes (omit to keep)")]
    file_changes: Option<Vec<FileChangeEntry>>,
    #[schemars(description = "Display order (omit to keep)")]
    order: Option<u32>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct FileChangeEntry {
    #[schemars(description = "File path")]
    path: String,
    #[schemars(description = "Diff, full content, or markdown with code blocks")]
    content: String,
    #[schemars(description = "Language hint (auto-detected if omitted)")]
    language: Option<String>,
    #[schemars(description = "'create', 'edit', or 'delete' (default 'edit')")]
    change_type: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct ReorderCardsParams {
    #[schemars(description = "Plan ID")]
    plan_id: String,
    #[schemars(description = "Ordered card IDs — each gets order = index")]
    card_ids: Vec<String>,
}

fn detect_language(path: &str) -> String {
    let ext = path.rsplit('.').next().unwrap_or("");
    match ext {
        "rs" => "rust",
        "ts" | "tsx" => "typescript",
        "js" | "jsx" => "javascript",
        "py" => "python",
        "go" => "go",
        "java" => "java",
        "rb" => "ruby",
        "c" | "h" => "c",
        "cpp" | "cc" | "cxx" | "hpp" => "cpp",
        "cs" => "csharp",
        "swift" => "swift",
        "kt" | "kts" => "kotlin",
        "json" => "json",
        "yaml" | "yml" => "yaml",
        "toml" => "toml",
        "html" | "htm" => "html",
        "css" => "css",
        "scss" | "sass" => "scss",
        "sql" => "sql",
        "sh" | "bash" | "zsh" => "shell",
        "md" | "markdown" => "markdown",
        "xml" => "xml",
        "vue" => "vue",
        "svelte" => "svelte",
        _ => "text",
    }
    .to_string()
}

fn build_file_changes(entries: Vec<FileChangeEntry>) -> HashMap<String, FileChange> {
    let mut map = HashMap::new();
    for e in entries {
        let lang = e.language.unwrap_or_else(|| detect_language(&e.path));
        let ct = e.change_type.unwrap_or_else(|| "edit".to_string());
        map.insert(
            e.path,
            FileChange {
                content: e.content,
                language: lang,
                change_type: ct,
            },
        );
    }
    map
}

/// Strip file_changes from cards for lighter responses
fn card_summary_json(card: &Card) -> serde_json::Value {
    serde_json::json!({
        "id": card.id,
        "title": card.title,
        "description": card.description,
        "type": match card.card_type {
            CardType::Research => "research",
            CardType::Planning => "planning",
            CardType::Create => "create",
            CardType::Edit => "edit",
            CardType::Test => "test",
        },
        "repo": card.repo,
        "files": card.files,
        "dependencies": card.dependencies,
        "hasFileChanges": !card.file_changes.is_empty(),
        "order": card.order,
    })
}

#[tool_router]
impl PlannerHandler {
    #[tool(description = "Create a new plan board. Returns planId for adding cards.")]
    async fn create_plan(
        &self,
        Parameters(params): Parameters<CreatePlanParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let mut st = self.state.write().await;
        let plan = Plan {
            id: state::gen_id("plan"),
            title: params.title,
            icon: params.icon,
            description: params.description,
            steps: Vec::new(),
            created_at: state::now_millis(),
            pinned: false,
        };
        let id = plan.id.clone();
        st.plans.insert(0, plan);
        state::save_state(&st);
        Ok(CallToolResult::success(vec![Content::text(
            serde_json::json!({ "planId": id }).to_string(),
        )]))
    }

    #[tool(
        description = "Add cards to a plan. Works for single or batch. Returns cardIds in order — use earlier IDs as dependencies for later cards. Every card except the first MUST have dependencies. Include file_changes for each file so users can preview code."
    )]
    async fn add_cards(
        &self,
        Parameters(params): Parameters<AddCardsParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let mut st = self.state.write().await;
        let plan = st.plans.iter_mut().find(|p| p.id == params.plan_id);
        match plan {
            Some(plan) => {
                let mut ids = Vec::new();
                let mut next_order = plan.steps.len() as u32;
                let has_existing_cards = !plan.steps.is_empty();
                for (ci, entry) in params.cards.into_iter().enumerate() {
                    let has_prior = has_existing_cards || ci > 0;
                    if has_prior && entry.dependencies.is_empty() {
                        let available: Vec<String> = plan.steps.iter().map(|c| format!("{} ({})", c.id, c.title)).chain(ids.iter().cloned()).collect();
                        return Ok(CallToolResult::error(vec![Content::text(format!(
                            "DEPENDENCY_REQUIRED: Card '{}' needs at least one dependency. Available card IDs you can reference: [{}]. Set the 'dependencies' array with one or more of these IDs and retry.",
                            entry.title, available.join(", ")
                        ))]));
                    }
                    let fc = entry
                        .file_changes
                        .map(build_file_changes)
                        .unwrap_or_default();
                    let card = Card {
                        id: state::gen_id("card"),
                        title: entry.title,
                        description: entry.description,
                        card_type: entry.card_type,
                        repo: entry.repo,
                        files: entry.files,
                        dependencies: entry.dependencies,
                        file_changes: fc,
                        order: next_order,
                    };
                    next_order += 1;
                    ids.push(card.id.clone());
                    plan.steps.push(card);
                }
                state::save_state(&st);
                Ok(CallToolResult::success(vec![Content::text(
                    serde_json::json!({ "cardIds": ids }).to_string(),
                )]))
            }
            None => Ok(CallToolResult::error(vec![Content::text(format!(
                "Plan '{}' not found",
                params.plan_id
            ))])),
        }
    }

    #[tool(description = "Remove a card by ID.")]
    async fn remove_card(
        &self,
        Parameters(params): Parameters<RemoveCardParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let mut st = self.state.write().await;
        let plan = st.plans.iter_mut().find(|p| p.id == params.plan_id);
        match plan {
            Some(plan) => {
                let before = plan.steps.len();
                plan.steps.retain(|c| c.id != params.card_id);
                if plan.steps.len() == before {
                    Ok(CallToolResult::error(vec![Content::text(format!(
                        "Card '{}' not found in plan '{}'",
                        params.card_id, params.plan_id
                    ))]))
                } else {
                    state::save_state(&st);
                    Ok(CallToolResult::success(vec![Content::text("Card removed")]))
                }
            }
            None => Ok(CallToolResult::error(vec![Content::text(format!(
                "Plan '{}' not found",
                params.plan_id
            ))])),
        }
    }

    #[tool(
        description = "Get cards from a plan. Returns card metadata without file_changes content (use update_card to modify file_changes). Supports pagination."
    )]
    async fn get_cards(
        &self,
        Parameters(params): Parameters<GetCardsParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let st = self.state.read().await;
        let plan = st.plans.iter().find(|p| p.id == params.plan_id);
        match plan {
            Some(plan) => {
                let total = plan.steps.len();
                let off = params.offset.unwrap_or(0).min(total);
                let lim = params.limit.unwrap_or(total);
                let page: Vec<serde_json::Value> = plan
                    .steps
                    .iter()
                    .skip(off)
                    .take(lim)
                    .map(card_summary_json)
                    .collect();
                let has_more = off + page.len() < total;
                Ok(CallToolResult::success(vec![Content::text(
                    serde_json::json!({
                        "total": total,
                        "offset": off,
                        "count": page.len(),
                        "hasMore": has_more,
                        "cards": page
                    })
                    .to_string(),
                )]))
            }
            None => Ok(CallToolResult::error(vec![Content::text(format!(
                "Plan '{}' not found",
                params.plan_id
            ))])),
        }
    }

    #[tool(description = "List all plans with IDs, titles, and card counts.")]
    async fn list_plans(
        &self,
        Parameters(_params): Parameters<ListPlansParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let st = self.state.read().await;
        let list: Vec<serde_json::Value> = st
            .plans
            .iter()
            .map(|p| {
                serde_json::json!({
                    "id": p.id,
                    "title": p.title,
                    "icon": p.icon,
                    "cardCount": p.steps.len(),
                })
            })
            .collect();
        Ok(CallToolResult::success(vec![Content::text(
            serde_json::to_string(&list).unwrap_or_default(),
        )]))
    }

    #[tool(description = "Get a plan with all cards (without file_changes content). Use get_cards with pagination for large plans.")]
    async fn get_plan(
        &self,
        Parameters(params): Parameters<GetPlanParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let st = self.state.read().await;
        let plan = st.plans.iter().find(|p| p.id == params.plan_id);
        match plan {
            Some(plan) => {
                let cards: Vec<serde_json::Value> =
                    plan.steps.iter().map(card_summary_json).collect();
                Ok(CallToolResult::success(vec![Content::text(
                    serde_json::json!({
                        "id": plan.id,
                        "title": plan.title,
                        "icon": plan.icon,
                        "description": plan.description,
                        "cards": cards,
                    })
                    .to_string(),
                )]))
            }
            None => Ok(CallToolResult::error(vec![Content::text(format!(
                "Plan '{}' not found",
                params.plan_id
            ))])),
        }
    }

    #[tool(description = "Remove all cards from a plan.")]
    async fn clear_plan(
        &self,
        Parameters(params): Parameters<ClearPlanParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let mut st = self.state.write().await;
        let plan = st.plans.iter_mut().find(|p| p.id == params.plan_id);
        match plan {
            Some(plan) => {
                plan.steps.clear();
                state::save_state(&st);
                Ok(CallToolResult::success(vec![Content::text("Plan cleared")]))
            }
            None => Ok(CallToolResult::error(vec![Content::text(format!(
                "Plan '{}' not found",
                params.plan_id
            ))])),
        }
    }

    #[tool(
        description = "Get pending feedback (unread questions, directives, issues). Answer questions with answer_feedback, acknowledge directives/issues with acknowledge_feedback."
    )]
    async fn get_all_feedback(
        &self,
        Parameters(_params): Parameters<GetAllFeedbackParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let st = self.state.read().await;
        let pending: Vec<&state::Feedback> = st
            .feedbacks
            .iter()
            .filter(|f| !f.read && f.answer.is_none())
            .collect();
        Ok(CallToolResult::success(vec![Content::text(
            serde_json::to_string(&pending).unwrap_or_default(),
        )]))
    }

    #[tool(description = "Mark directive/issue feedback as acknowledged so it won't reappear.")]
    async fn acknowledge_feedback(
        &self,
        Parameters(params): Parameters<AcknowledgeFeedbackParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let mut st = self.state.write().await;
        let mut count = 0;
        for fb in st.feedbacks.iter_mut() {
            if params.feedback_ids.contains(&fb.id) {
                fb.read = true;
                count += 1;
            }
        }
        state::save_state(&st);
        Ok(CallToolResult::success(vec![Content::text(
            serde_json::json!({ "ok": true, "acknowledged": count }).to_string(),
        )]))
    }

    #[tool(description = "Answer a question feedback. The answer appears in the UI under the question.")]
    async fn answer_feedback(
        &self,
        Parameters(params): Parameters<AnswerFeedbackParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let mut st = self.state.write().await;
        if let Some(fb) = st.feedbacks.iter_mut().find(|f| f.id == params.feedback_id) {
            fb.answer = Some(params.answer);
            fb.read = true;
            state::save_state(&st);
            Ok(CallToolResult::success(vec![Content::text(
                serde_json::json!({ "ok": true }).to_string(),
            )]))
        } else {
            Ok(CallToolResult::error(vec![Content::text(format!(
                "Feedback '{}' not found",
                params.feedback_id
            ))]))
        }
    }

    #[tool(description = "Update card fields. Only provided fields change, others stay. Supports title, description, type, repo, files, dependencies, file_changes, order.")]
    async fn update_card(
        &self,
        Parameters(params): Parameters<UpdateCardParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let mut st = self.state.write().await;
        let plan = st.plans.iter_mut().find(|p| p.id == params.plan_id);
        match plan {
            Some(plan) => {
                let card = plan.steps.iter_mut().find(|c| c.id == params.card_id);
                match card {
                    Some(card) => {
                        if let Some(v) = params.title {
                            card.title = v;
                        }
                        if let Some(v) = params.description {
                            card.description = v;
                        }
                        if let Some(v) = params.card_type {
                            card.card_type = v;
                        }
                        if let Some(v) = params.repo {
                            card.repo = v;
                        }
                        if let Some(v) = params.files {
                            card.files = v;
                        }
                        if let Some(v) = params.order {
                            card.order = v;
                        }
                        if let Some(v) = params.dependencies {
                            card.dependencies = v;
                        }
                        if let Some(entries) = params.file_changes {
                            card.file_changes = build_file_changes(entries);
                        }
                        state::save_state(&st);
                        Ok(CallToolResult::success(vec![Content::text(
                            serde_json::json!({ "ok": true, "cardId": params.card_id }).to_string(),
                        )]))
                    }
                    None => Ok(CallToolResult::error(vec![Content::text(format!(
                        "Card '{}' not found in plan '{}'",
                        params.card_id, params.plan_id
                    ))])),
                }
            }
            None => Ok(CallToolResult::error(vec![Content::text(format!(
                "Plan '{}' not found",
                params.plan_id
            ))])),
        }
    }

    #[tool(description = "Reorder cards. Each card's order = its index in the provided ID list.")]
    async fn reorder_cards(
        &self,
        Parameters(params): Parameters<ReorderCardsParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let mut st = self.state.write().await;
        let plan = st.plans.iter_mut().find(|p| p.id == params.plan_id);
        match plan {
            Some(plan) => {
                let mut updated = 0u32;
                for (i, cid) in params.card_ids.iter().enumerate() {
                    if let Some(card) = plan.steps.iter_mut().find(|c| c.id == *cid) {
                        card.order = i as u32;
                        updated += 1;
                    }
                }
                state::save_state(&st);
                Ok(CallToolResult::success(vec![Content::text(
                    serde_json::json!({ "ok": true, "updated": updated }).to_string(),
                )]))
            }
            None => Ok(CallToolResult::error(vec![Content::text(format!(
                "Plan '{}' not found",
                params.plan_id
            ))])),
        }
    }
}

#[tool_handler]
impl ServerHandler for PlannerHandler {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("flowplan", "1.0.0"))
    }
}
