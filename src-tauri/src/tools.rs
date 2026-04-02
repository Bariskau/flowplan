use rmcp::handler::server::tool::ToolRouter;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{CallToolResult, Content, Implementation, ServerCapabilities, ServerInfo};
use rmcp::schemars::JsonSchema;
use rmcp::{tool, tool_handler, tool_router, ErrorData, ServerHandler};
use serde::Deserialize;
use std::collections::HashMap;

use crate::state::{
    self, Card, CardType, FileChange, Feedback, HistoryActor, HistoryChange, HistoryChangeKind,
    HistorySource, Plan, Position, SharedState,
};

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
    title: String,
    icon: String,
    description: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct CardEntry {
    title: String,
    description: String,
    card_type: CardType,
    repo: String,
    files: Vec<String>,
    dependencies: Vec<String>,
    file_changes: Option<Vec<FileChangeEntry>>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct AddCardsParams {
    plan_id: String,
    cards: Vec<CardEntry>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct RemoveCardParams {
    plan_id: String,
    card_id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct GetCardsParams {
    plan_id: String,
    offset: Option<usize>,
    limit: Option<usize>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct ListPlansParams {}

#[derive(Debug, Deserialize, JsonSchema)]
struct GetPlanParams {
    plan_id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct ClearPlanParams {
    plan_id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct GetAllFeedbackParams {}

#[derive(Debug, Deserialize, JsonSchema)]
struct AnswerFeedbackParams {
    feedback_id: String,
    answer: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct AcknowledgeFeedbackParams {
    feedback_ids: Vec<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct UpdateCardParams {
    plan_id: String,
    card_id: String,
    title: Option<String>,
    description: Option<String>,
    card_type: Option<CardType>,
    repo: Option<String>,
    files: Option<Vec<String>>,
    dependencies: Option<Vec<String>>,
    file_changes: Option<Vec<FileChangeEntry>>,
    order: Option<u32>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct FileChangeEntry {
    path: String,
    content: String,
    language: Option<String>,
    change_type: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct ReorderCardsParams {
    plan_id: String,
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
    for entry in entries {
        let path = entry.path;
        let language = entry.language.unwrap_or_else(|| detect_language(&path));
        map.insert(
            path,
            FileChange {
                content: entry.content,
                language,
                change_type: entry.change_type.unwrap_or_else(|| "edit".to_string()),
            },
        );
    }
    map
}

fn card_summary_json(card: &Card) -> serde_json::Value {
    serde_json::json!({
        "id": card.id,
        "title": card.title,
        "description": card.description,
        "type": card.card_type.as_str(),
        "repo": card.repo,
        "files": card.files,
        "dependencies": card.dependencies,
        "hasFileChanges": !card.file_changes.is_empty(),
        "order": card.order,
    })
}

fn append_agent_history(
    plan: &Plan,
    positions: Option<&HashMap<String, Position>>,
    before_plan: Option<&Plan>,
    summary: Option<String>,
) {
    let changes = state::build_history_changes(before_plan, plan);
    state::append_history_entry(
        plan,
        positions,
        HistoryActor::Agent,
        Some("MCP".to_string()),
        None,
        HistorySource::Mcp,
        None,
        changes,
        summary,
    );
}

#[tool_router]
impl PlannerHandler {
    #[tool(description = "Create a new plan board and return its planId.")]
    async fn create_plan(
        &self,
        Parameters(params): Parameters<CreatePlanParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let mut state = self.state.write().await;
        let plan = Plan {
            id: state::gen_id("plan"),
            title: params.title,
            icon: params.icon,
            description: params.description,
            steps: Vec::new(),
            created_at: state::now_millis(),
            pinned: false,
        };
        let plan_id = plan.id.clone();
        state.plans.insert(0, plan.clone());
        state::save_state(&state);
        state::append_history_entry(
            &plan,
            state.positions.get(&plan_id),
            HistoryActor::Agent,
            Some("MCP".to_string()),
            None,
            HistorySource::Mcp,
            None,
            vec![HistoryChange {
                kind: HistoryChangeKind::PlanCreated,
                card_id: None,
                title: Some(plan.title.clone()),
                changed_fields: Vec::new(),
                dependencies_added: Vec::new(),
                dependencies_removed: Vec::new(),
                files_added: Vec::new(),
                files_removed: Vec::new(),
                file_changes_updated: Vec::new(),
                before: None,
                after: None,
            }],
            Some("Created plan".to_string()),
        );
        Ok(CallToolResult::success(vec![Content::text(
            serde_json::json!({ "planId": plan_id }).to_string(),
        )]))
    }

    #[tool(description = "Add one or more cards to an existing plan.")]
    async fn add_cards(
        &self,
        Parameters(params): Parameters<AddCardsParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let mut state = self.state.write().await;
        let Some(plan) = state.plans.iter_mut().find(|plan| plan.id == params.plan_id) else {
            return Ok(CallToolResult::error(vec![Content::text(format!(
                "Plan '{}' not found",
                params.plan_id
            ))]));
        };

        if params.cards.is_empty() {
            return Ok(CallToolResult::error(vec![Content::text(
                "No cards provided. Pass at least one item in the cards array.",
            )]));
        }

        let before_plan = plan.clone();
        let generated_ids: Vec<String> = (0..params.cards.len()).map(|_| state::gen_id("card")).collect();
        let mut card_ids = Vec::new();

        for (index, entry) in params.cards.into_iter().enumerate() {
            let has_existing_cards = !plan.steps.is_empty() || index > 0;
            let resolved_dependencies: Vec<String> = entry
                .dependencies
                .into_iter()
                .map(|dependency| {
                    if let Some(idx_str) = dependency.strip_prefix('$') {
                        if let Ok(idx) = idx_str.parse::<usize>() {
                            if idx < generated_ids.len() {
                                return generated_ids[idx].clone();
                            }
                        }
                    }
                    dependency
                })
                .collect();

            if has_existing_cards && resolved_dependencies.is_empty() {
                return Ok(CallToolResult::error(vec![Content::text(format!(
                    "DEPENDENCY_REQUIRED: Card '{}' needs at least one dependency.",
                    entry.title
                ))]));
            }

            let next_order = plan.steps.len() as u32;
            let card = Card {
                id: generated_ids[index].clone(),
                title: entry.title,
                description: entry.description,
                card_type: entry.card_type,
                repo: entry.repo,
                files: entry.files,
                dependencies: resolved_dependencies,
                file_changes: entry.file_changes.map(build_file_changes).unwrap_or_default(),
                order: next_order,
            };
            card_ids.push(card.id.clone());
            plan.steps.push(card);
        }

        let after_plan = plan.clone();
        let snapshot_positions = state.positions.get(&params.plan_id).cloned();
        state::save_state(&state);
        append_agent_history(&after_plan, snapshot_positions.as_ref(), Some(&before_plan), None);

        Ok(CallToolResult::success(vec![Content::text(
            serde_json::json!({ "cardIds": card_ids }).to_string(),
        )]))
    }

    #[tool(description = "Remove a card and clean dependency references.")]
    async fn remove_card(
        &self,
        Parameters(params): Parameters<RemoveCardParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let mut state = self.state.write().await;
        let Some(plan_index) = state.plans.iter().position(|plan| plan.id == params.plan_id) else {
            return Ok(CallToolResult::error(vec![Content::text(format!(
                "Plan '{}' not found",
                params.plan_id
            ))]));
        };

        let before_plan = state.plans[plan_index].clone();
        let removed_title = before_plan
            .steps
            .iter()
            .find(|card| card.id == params.card_id)
            .map(|card| card.title.clone())
            .unwrap_or_else(|| "Untitled".to_string());

        let removed = {
            let plan = &mut state.plans[plan_index];
            let before = plan.steps.len();
            plan.steps.retain(|card| card.id != params.card_id);
            if plan.steps.len() == before {
                false
            } else {
                for card in &mut plan.steps {
                    card.dependencies.retain(|dependency| dependency != &params.card_id);
                }
                true
            }
        };

        if !removed {
            return Ok(CallToolResult::error(vec![Content::text(format!(
                "Card '{}' not found in plan '{}'",
                params.card_id, params.plan_id
            ))]));
        }

        if let Some(plan_positions) = state.positions.get_mut(&params.plan_id) {
            plan_positions.remove(&params.card_id);
        }
        state.feedbacks.retain(|feedback| feedback.card_id != params.card_id);
        let after_plan = state.plans[plan_index].clone();
        let snapshot_positions = state.positions.get(&params.plan_id).cloned();
        state::save_state(&state);
        append_agent_history(
            &after_plan,
            snapshot_positions.as_ref(),
            Some(&before_plan),
            Some(format!("Removed card: {removed_title}")),
        );

        Ok(CallToolResult::success(vec![Content::text("Card removed")]))
    }

    #[tool(description = "Get cards from a plan without file_changes payloads.")]
    async fn get_cards(
        &self,
        Parameters(params): Parameters<GetCardsParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let state = self.state.read().await;
        let Some(plan) = state.plans.iter().find(|plan| plan.id == params.plan_id) else {
            return Ok(CallToolResult::error(vec![Content::text(format!(
                "Plan '{}' not found",
                params.plan_id
            ))]));
        };

        let total = plan.steps.len();
        let offset = params.offset.unwrap_or(0).min(total);
        let limit = params.limit.unwrap_or(total);
        let cards: Vec<serde_json::Value> = plan
            .steps
            .iter()
            .skip(offset)
            .take(limit)
            .map(card_summary_json)
            .collect();

        Ok(CallToolResult::success(vec![Content::text(
            serde_json::json!({
                "total": total,
                "offset": offset,
                "count": cards.len(),
                "hasMore": offset + cards.len() < total,
                "cards": cards,
            })
            .to_string(),
        )]))
    }

    #[tool(description = "List all plans.")]
    async fn list_plans(
        &self,
        Parameters(_params): Parameters<ListPlansParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let state = self.state.read().await;
        let plans: Vec<serde_json::Value> = state
            .plans
            .iter()
            .map(|plan| {
                serde_json::json!({
                    "id": plan.id,
                    "title": plan.title,
                    "icon": plan.icon,
                    "cardCount": plan.steps.len(),
                })
            })
            .collect();
        Ok(CallToolResult::success(vec![Content::text(
            serde_json::to_string(&plans).unwrap_or_default(),
        )]))
    }

    #[tool(description = "Get a plan and all cards without file_changes.")]
    async fn get_plan(
        &self,
        Parameters(params): Parameters<GetPlanParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let state = self.state.read().await;
        let Some(plan) = state.plans.iter().find(|plan| plan.id == params.plan_id) else {
            return Ok(CallToolResult::error(vec![Content::text(format!(
                "Plan '{}' not found",
                params.plan_id
            ))]));
        };

        let cards: Vec<serde_json::Value> = plan.steps.iter().map(card_summary_json).collect();
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

    #[tool(description = "Remove all cards from a plan but keep the plan itself.")]
    async fn clear_plan(
        &self,
        Parameters(params): Parameters<ClearPlanParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let mut state = self.state.write().await;
        let Some(plan_index) = state.plans.iter().position(|plan| plan.id == params.plan_id) else {
            return Ok(CallToolResult::error(vec![Content::text(format!(
                "Plan '{}' not found",
                params.plan_id
            ))]));
        };
        let before_plan = state.plans[plan_index].clone();
        state.plans[plan_index].steps.clear();
        if let Some(plan_positions) = state.positions.get_mut(&params.plan_id) {
            plan_positions.clear();
        }
        let after_plan = state.plans[plan_index].clone();
        let snapshot_positions = state.positions.get(&params.plan_id).cloned();
        state::save_state(&state);
        append_agent_history(
            &after_plan,
            snapshot_positions.as_ref(),
            Some(&before_plan),
            Some("Cleared plan".to_string()),
        );
        Ok(CallToolResult::success(vec![Content::text("Plan cleared")]))
    }

    #[tool(description = "Get pending unread feedback entries.")]
    async fn get_all_feedback(
        &self,
        Parameters(_params): Parameters<GetAllFeedbackParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let state = self.state.read().await;
        let pending: Vec<&Feedback> = state
            .feedbacks
            .iter()
            .filter(|feedback| !feedback.read && feedback.answer.is_none())
            .collect();
        Ok(CallToolResult::success(vec![Content::text(
            serde_json::to_string(&pending).unwrap_or_default(),
        )]))
    }

    #[tool(description = "Mark directive/issue feedback as acknowledged.")]
    async fn acknowledge_feedback(
        &self,
        Parameters(params): Parameters<AcknowledgeFeedbackParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let mut state = self.state.write().await;
        let mut acknowledged = 0usize;
        for feedback in &mut state.feedbacks {
            if params.feedback_ids.contains(&feedback.id) {
                feedback.read = true;
                acknowledged += 1;
            }
        }
        state::save_state(&state);
        Ok(CallToolResult::success(vec![Content::text(
            serde_json::json!({ "ok": true, "acknowledged": acknowledged }).to_string(),
        )]))
    }

    #[tool(description = "Answer a feedback question.")]
    async fn answer_feedback(
        &self,
        Parameters(params): Parameters<AnswerFeedbackParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let mut state = self.state.write().await;
        let Some(feedback) = state.feedbacks.iter_mut().find(|feedback| feedback.id == params.feedback_id) else {
            return Ok(CallToolResult::error(vec![Content::text(format!(
                "Feedback '{}' not found",
                params.feedback_id
            ))]));
        };
        feedback.answer = Some(params.answer);
        feedback.read = true;
        state::save_state(&state);
        Ok(CallToolResult::success(vec![Content::text(
            serde_json::json!({ "ok": true }).to_string(),
        )]))
    }

    #[tool(description = "Partially update a single card.")]
    async fn update_card(
        &self,
        Parameters(params): Parameters<UpdateCardParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let mut state = self.state.write().await;
        let Some(plan) = state.plans.iter_mut().find(|plan| plan.id == params.plan_id) else {
            return Ok(CallToolResult::error(vec![Content::text(format!(
                "Plan '{}' not found",
                params.plan_id
            ))]));
        };
        let before_plan = plan.clone();
        let Some(card) = plan.steps.iter_mut().find(|card| card.id == params.card_id) else {
            return Ok(CallToolResult::error(vec![Content::text(format!(
                "Card '{}' not found in plan '{}'",
                params.card_id, params.plan_id
            ))]));
        };

        if let Some(title) = params.title {
            card.title = title;
        }
        if let Some(description) = params.description {
            card.description = description;
        }
        if let Some(card_type) = params.card_type {
            card.card_type = card_type;
        }
        if let Some(repo) = params.repo {
            card.repo = repo;
        }
        if let Some(files) = params.files {
            card.files = files;
        }
        if let Some(dependencies) = params.dependencies {
            card.dependencies = dependencies;
        }
        if let Some(order) = params.order {
            card.order = order;
        }
        if let Some(file_changes) = params.file_changes {
            card.file_changes = build_file_changes(file_changes);
        }

        let after_plan = plan.clone();
        let snapshot_positions = state.positions.get(&params.plan_id).cloned();
        state::save_state(&state);
        append_agent_history(&after_plan, snapshot_positions.as_ref(), Some(&before_plan), None);

        Ok(CallToolResult::success(vec![Content::text(
            serde_json::json!({ "ok": true, "cardId": params.card_id }).to_string(),
        )]))
    }

    #[tool(description = "Reorder cards by setting each card order to its index.")]
    async fn reorder_cards(
        &self,
        Parameters(params): Parameters<ReorderCardsParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let mut state = self.state.write().await;
        let Some(plan) = state.plans.iter_mut().find(|plan| plan.id == params.plan_id) else {
            return Ok(CallToolResult::error(vec![Content::text(format!(
                "Plan '{}' not found",
                params.plan_id
            ))]));
        };
        let before_plan = plan.clone();
        let mut updated = 0u32;
        for (index, card_id) in params.card_ids.iter().enumerate() {
            if let Some(card) = plan.steps.iter_mut().find(|card| card.id == *card_id) {
                card.order = index as u32;
                updated += 1;
            }
        }
        let after_plan = plan.clone();
        let snapshot_positions = state.positions.get(&params.plan_id).cloned();
        state::save_state(&state);
        append_agent_history(
            &after_plan,
            snapshot_positions.as_ref(),
            Some(&before_plan),
            Some("Reordered cards".to_string()),
        );

        Ok(CallToolResult::success(vec![Content::text(
            serde_json::json!({ "ok": true, "updated": updated }).to_string(),
        )]))
    }
}

#[tool_handler]
impl ServerHandler for PlannerHandler {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("flowplan", "1.0.0"))
    }
}
