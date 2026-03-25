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
    #[schemars(description = "Short title for the plan")]
    title: String,
    #[schemars(description = "An emoji icon for the plan")]
    icon: String,
    #[schemars(description = "A brief description of the plan")]
    description: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct AddCardParams {
    #[schemars(description = "ID of the plan to add the card to (returned by create_plan)")]
    plan_id: String,
    #[schemars(description = "Card title")]
    title: String,
    #[schemars(
        description = "Card description (supports markdown: **bold**, *italic*, `code`, ```code blocks```, - lists, [links](url))"
    )]
    description: String,
    #[schemars(description = "Card type: research, planning, create, edit, or test")]
    card_type: CardType,
    #[schemars(description = "Repository or project path")]
    repo: String,
    #[schemars(description = "List of file paths relevant to this card")]
    files: Vec<String>,
    #[schemars(
        description = "List of card IDs this card depends on (returned by previous add_card/add_cards calls)"
    )]
    dependencies: Vec<String>,
    #[schemars(
        description = "IMPORTANT: For every file in 'files', you SHOULD provide the proposed code changes here. Each entry: {path, content (unified diff, full content, or markdown with ```code blocks```), language? (auto-detected), changeType? ('create'|'edit'|'delete', default 'edit')}. Users can click files in the UI to see these changes."
    )]
    file_changes: Option<Vec<FileChangeEntry>>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct CardEntry {
    #[schemars(description = "Card title")]
    title: String,
    #[schemars(
        description = "Card description (supports markdown: **bold**, *italic*, `code`, ```code blocks```, - lists, [links](url))"
    )]
    description: String,
    #[schemars(description = "Card type: research, planning, create, edit, or test")]
    card_type: CardType,
    #[schemars(description = "Repository or project path")]
    repo: String,
    #[schemars(description = "List of file paths relevant to this card")]
    files: Vec<String>,
    #[schemars(
        description = "List of card IDs this card depends on. Use the IDs returned by previous add_card or add_cards calls."
    )]
    dependencies: Vec<String>,
    #[schemars(
        description = "IMPORTANT: For every file in 'files', you SHOULD provide the proposed code changes here. Each entry: {path, content (unified diff, full content, or markdown with ```code blocks```), language? (auto-detected), changeType? ('create'|'edit'|'delete', default 'edit')}. Users can click files in the UI to see these changes."
    )]
    file_changes: Option<Vec<FileChangeEntry>>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct AddCardsParams {
    #[schemars(description = "ID of the plan to add cards to")]
    plan_id: String,
    #[schemars(description = "Array of card objects to add")]
    cards: Vec<CardEntry>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct RemoveCardParams {
    #[schemars(description = "ID of the plan")]
    plan_id: String,
    #[schemars(description = "ID of the card to remove")]
    card_id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct GetCardsParams {
    #[schemars(description = "ID of the plan to get cards from")]
    plan_id: String,
    #[schemars(
        description = "Number of cards to skip (default 0). Use with limit for pagination."
    )]
    offset: Option<usize>,
    #[schemars(
        description = "Max number of cards to return (default all). Use with offset for pagination when context is large."
    )]
    limit: Option<usize>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct ListPlansParams {}

#[derive(Debug, Deserialize, JsonSchema)]
struct GetPlanParams {
    #[schemars(description = "ID of the plan to retrieve")]
    plan_id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct ClearPlanParams {
    #[schemars(description = "ID of the plan to clear all cards from")]
    plan_id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct GetAllFeedbackParams {}

#[derive(Debug, Deserialize, JsonSchema)]
struct AnswerFeedbackParams {
    #[schemars(description = "ID of the feedback item to answer (from get_all_feedback results)")]
    feedback_id: String,
    #[schemars(description = "Your answer to the user's question")]
    answer: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct AcknowledgeFeedbackParams {
    #[schemars(description = "IDs of the feedback items to mark as read/acknowledged")]
    feedback_ids: Vec<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct UpdateCardParams {
    #[schemars(description = "ID of the plan containing the card")]
    plan_id: String,
    #[schemars(description = "ID of the card to update")]
    card_id: String,
    #[schemars(description = "New title (omit to keep current)")]
    title: Option<String>,
    #[schemars(description = "New description in markdown (omit to keep current)")]
    description: Option<String>,
    #[schemars(
        description = "New card type: research, planning, create, edit, or test (omit to keep current)"
    )]
    card_type: Option<CardType>,
    #[schemars(description = "New repository path (omit to keep current)")]
    repo: Option<String>,
    #[schemars(description = "New list of file paths (omit to keep current)")]
    files: Option<Vec<String>>,
    #[schemars(description = "New list of dependency card IDs (omit to keep current)")]
    dependencies: Option<Vec<String>>,
    #[schemars(
        description = "File changes map: array of {path, content (markdown with code blocks), language?, changeType?} (omit to keep current)"
    )]
    file_changes: Option<Vec<FileChangeEntry>>,
    #[schemars(
        description = "Display order (0-based). Cards are sorted by order within each dependency column. Omit to keep current."
    )]
    order: Option<u32>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct FileChangeEntry {
    #[schemars(description = "File path (e.g. 'src/main.rs')")]
    path: String,
    #[schemars(
        description = "Unified diff, full file content, or markdown with ```code blocks```. Rendered with markdown support in the UI."
    )]
    content: String,
    #[schemars(
        description = "Language hint (e.g. 'rust', 'typescript'). Auto-detected from extension if omitted."
    )]
    language: Option<String>,
    #[schemars(description = "Type of change: 'create', 'edit', or 'delete'. Defaults to 'edit'.")]
    change_type: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct SetFileChangesParams {
    #[schemars(description = "ID of the plan containing the card")]
    plan_id: String,
    #[schemars(description = "ID of the card to set file changes on")]
    card_id: String,
    #[schemars(description = "Array of file change entries")]
    changes: Vec<FileChangeEntry>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct ReorderCardsParams {
    #[schemars(description = "ID of the plan")]
    plan_id: String,
    #[schemars(
        description = "Ordered list of card IDs. The order field of each card is set to its index in this array (0, 1, 2, ...). Cards not in this list keep their current order."
    )]
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

#[tool_router]
impl PlannerHandler {
    #[tool(
        description = "Create a new plan in FlowPlan. A plan is a visual board that contains cards (steps). Returns the plan ID which you need for adding cards. The plan appears immediately in the FlowPlan desktop app sidebar."
    )]
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
        description = "Add a single card (step) to a plan. Each card represents one task/step and appears as a draggable node in the FlowPlan flow view. Use dependencies to create connections between cards. IMPORTANT: When listing files, always include file_changes with the proposed code diff or content for each file so users can review changes in the UI. Returns the new card's ID."
    )]
    async fn add_card(
        &self,
        Parameters(params): Parameters<AddCardParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let mut st = self.state.write().await;
        let plan = st.plans.iter_mut().find(|p| p.id == params.plan_id);
        match plan {
            Some(plan) => {
                let fc = params
                    .file_changes
                    .map(build_file_changes)
                    .unwrap_or_default();
                let snap_title = params.title.clone();
                let next_order = plan.steps.len() as u32;
                let card = Card {
                    id: state::gen_id("card"),
                    title: params.title,
                    description: params.description,
                    card_type: params.card_type,
                    repo: params.repo,
                    files: params.files,
                    dependencies: params.dependencies,
                    file_changes: fc,
                    order: next_order,
                };
                let id = card.id.clone();
                plan.steps.push(card);
                state::save_state(&st);
                if let Some(p) = st.plans.iter().find(|p| p.id == params.plan_id) {
                    state::record_snapshot(p, "add_card", &format!("Added card: {}", snap_title));
                }
                Ok(CallToolResult::success(vec![Content::text(
                    serde_json::json!({ "cardId": id }).to_string(),
                )]))
            }
            None => Ok(CallToolResult::error(vec![Content::text(format!(
                "Plan '{}' not found",
                params.plan_id
            ))])),
        }
    }

    #[tool(
        description = "Add multiple cards (steps) to a plan at once. More efficient than calling add_card repeatedly. Cards are added in order and IDs are returned in the same order, so you can reference earlier cards as dependencies for later ones. IMPORTANT: When listing files, always include file_changes with the proposed code diff or content for each file so users can review changes in the UI. Returns all new card IDs."
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
                for entry in params.cards {
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
                let count = ids.len();
                state::save_state(&st);
                if let Some(p) = st.plans.iter().find(|p| p.id == params.plan_id) {
                    state::record_snapshot(p, "add_cards", &format!("Added {} cards", count));
                }
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

    #[tool(description = "Remove a card from a plan by its ID.")]
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
                    if let Some(p) = st.plans.iter().find(|p| p.id == params.plan_id) {
                        state::record_snapshot(
                            p,
                            "remove_card",
                            &format!("Removed card: {}", params.card_id),
                        );
                    }
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
        description = "Get cards (steps) from a specific plan. Supports pagination via offset/limit to avoid large context. Returns cards with total count, offset, and whether more cards remain."
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
                let page: Vec<&state::Card> = plan.steps.iter().skip(off).take(lim).collect();
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

    #[tool(
        description = "List all plans with their IDs, titles, and card counts. Use this first to discover available plans before operating on them."
    )]
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

    #[tool(description = "Get a specific plan by its ID, including all cards and their details.")]
    async fn get_plan(
        &self,
        Parameters(params): Parameters<GetPlanParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let st = self.state.read().await;
        let plan = st.plans.iter().find(|p| p.id == params.plan_id);
        match plan {
            Some(plan) => Ok(CallToolResult::success(vec![Content::text(
                serde_json::to_string(plan).unwrap_or_default(),
            )])),
            None => Ok(CallToolResult::error(vec![Content::text(format!(
                "Plan '{}' not found",
                params.plan_id
            ))])),
        }
    }

    #[tool(description = "Clear all cards from a plan, keeping the plan itself.")]
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
                if let Some(p) = st.plans.iter().find(|p| p.id == params.plan_id) {
                    state::record_snapshot(p, "clear_plan", "Cleared all cards");
                }
                Ok(CallToolResult::success(vec![Content::text("Plan cleared")]))
            }
            None => Ok(CallToolResult::error(vec![Content::text(format!(
                "Plan '{}' not found",
                params.plan_id
            ))])),
        }
    }

    #[tool(
        description = "Get pending feedback items from the FlowPlan UI. Only returns unread items — already read/acknowledged directives and issues, and already answered questions are excluded. Feedback types: 'question' (needs your answer - use answer_feedback to respond), 'directive' (instruction to follow), 'issue' (problem to fix). After processing directives/issues, call acknowledge_feedback to mark them as read so they won't appear again."
    )]
    async fn get_all_feedback(
        &self,
        Parameters(_params): Parameters<GetAllFeedbackParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let st = self.state.read().await;
        let pending: Vec<&state::Feedback> = st
            .feedbacks
            .iter()
            .filter(|f| {
                if f.read {
                    return false;
                }
                if f.answer.is_some() {
                    return false;
                }
                true
            })
            .collect();
        Ok(CallToolResult::success(vec![Content::text(
            serde_json::to_string(&pending).unwrap_or_default(),
        )]))
    }

    #[tool(
        description = "Mark directive or issue feedback items as read/acknowledged. Call this after you have processed a directive or issue so it won't appear again in get_all_feedback results. Do NOT use this for questions — use answer_feedback instead."
    )]
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

    #[tool(
        description = "Answer a question feedback item from the FlowPlan UI. When a user adds a 'question' type feedback on a card, use this tool to provide your answer. The answer will appear in the FlowPlan app under the question. Answering also marks it as read."
    )]
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
                serde_json::json!({ "ok": true, "feedbackId": params.feedback_id }).to_string(),
            )]))
        } else {
            Ok(CallToolResult::error(vec![Content::text(format!(
                "Feedback '{}' not found",
                params.feedback_id
            ))]))
        }
    }

    #[tool(
        description = "Update an existing card's fields without removing it. Only provided fields are changed — omitted fields keep their current values. This preserves the card ID and avoids breaking feedback references."
    )]
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
                        if let Some(p) = st.plans.iter().find(|p| p.id == params.plan_id) {
                            state::record_snapshot(
                                p,
                                "update_card",
                                &format!("Updated card: {}", params.card_id),
                            );
                        }
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

    #[tool(
        description = "Reorder cards in a plan. Pass an ordered list of card IDs and each card's order is set to its position in that list (0, 1, 2, ...). This controls the vertical arrangement within dependency columns in the flow view. More efficient than calling update_card for each card individually."
    )]
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
                if let Some(p) = st.plans.iter().find(|p| p.id == params.plan_id) {
                    state::record_snapshot(
                        p,
                        "reorder_cards",
                        &format!("Reordered {} cards", updated),
                    );
                }
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

    #[tool(
        description = "Set file changes (diffs or new content) on a card. Each change includes a file path and content (unified diff or full file). The changes appear in the FlowPlan UI as clickable files with a code viewer. Language is auto-detected from extension if not provided."
    )]
    async fn set_file_changes(
        &self,
        Parameters(params): Parameters<SetFileChangesParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let mut st = self.state.write().await;
        let plan = st.plans.iter_mut().find(|p| p.id == params.plan_id);
        match plan {
            Some(plan) => {
                let card = plan.steps.iter_mut().find(|c| c.id == params.card_id);
                match card {
                    Some(card) => {
                        let changes = build_file_changes(params.changes);
                        let count = changes.len();
                        card.file_changes = changes;
                        state::save_state(&st);
                        Ok(CallToolResult::success(vec![Content::text(
                            serde_json::json!({
                                "ok": true,
                                "cardId": params.card_id,
                                "fileCount": count
                            })
                            .to_string(),
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
}

#[tool_handler]
impl ServerHandler for PlannerHandler {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("flowplan", "1.0.0"))
    }
}
