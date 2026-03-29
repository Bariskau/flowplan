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
    #[schemars(
        description = "Short, descriptive title (3-8 words). E.g., 'Add user authentication middleware'"
    )]
    title: String,
    #[schemars(
        description = "Detailed description in markdown. Use headers, bullet lists, code blocks. Explain: what this card does, why, key decisions, and expected outcomes."
    )]
    description: String,
    #[schemars(
        description = "Card type: 'research' (investigation/analysis), 'planning' (design/architecture), 'create' (new files/features), 'edit' (modify existing code), 'test' (testing/validation)"
    )]
    card_type: CardType,
    #[schemars(description = "Full repository or project path. E.g., '/home/user/projects/myapp'")]
    repo: String,
    #[schemars(
        description = "Full file paths this card touches. E.g., ['src/auth/middleware.ts', 'src/types/user.ts']"
    )]
    files: Vec<String>,
    #[schemars(
        description = "IDs of cards this depends on. REQUIRED for all cards except the very first one in a plan. Without dependencies, cards appear disconnected in the flow view. Use IDs returned by previous add_cards calls."
    )]
    dependencies: Vec<String>,
    #[schemars(
        description = "Code changes per file for the user to preview. Each entry: {path (file path), content (diff/full code/markdown with code blocks), language? (auto-detected from extension if omitted), changeType? ('create'|'edit'|'delete', defaults to 'edit')}. STRONGLY RECOMMENDED — without file_changes, the user cannot preview your proposed code."
    )]
    file_changes: Option<Vec<FileChangeEntry>>,
}

#[derive(Debug, Deserialize, JsonSchema)]
struct AddCardsParams {
    #[schemars(description = "Plan ID")]
    plan_id: String,
    #[schemars(
        description = "Array of cards to add. Cards are processed in order, so later cards can depend on earlier ones. Use '$0', '$1', etc. in dependencies to reference cards in THIS batch by their array index. You can also reference existing card IDs from the plan."
    )]
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
    #[tool(
        description = "Create a new plan board. Returns planId — use it immediately with add_cards to populate. Keep title short (3-6 words), icon as single emoji, description as one sentence summarizing the plan's goal."
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
        description = "Add one or more cards (tasks/steps) to a plan. Accepts a single card or a batch — cards are processed in order so later cards can depend on earlier ones.\n\nBATCH DEPENDENCIES: Use '$0', '$1', etc. to reference cards within the same batch by array index. These are resolved to real IDs automatically.\n\nRULES:\n1. Every card except the FIRST in the plan must have at least one dependency — cards without dependencies appear disconnected.\n2. Include file_changes for every file the card modifies so the user can preview diffs in the UI.\n3. Set card_type accurately: 'research' for investigation, 'planning' for design, 'create' for new files, 'edit' for modifications, 'test' for testing.\n4. Description supports full markdown — use headers, lists, code blocks for clarity.\n\nExample batch with internal refs:\n[{title: 'Setup auth', ...dependencies: []}, {title: 'Add middleware', ...dependencies: ['$0']}, {title: 'Write tests', ...dependencies: ['$1']}]"
    )]
    async fn add_cards(
        &self,
        Parameters(params): Parameters<AddCardsParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let mut st = self.state.write().await;
        let plan = st.plans.iter_mut().find(|p| p.id == params.plan_id);
        match plan {
            Some(plan) => {
                if params.cards.is_empty() {
                    return Ok(CallToolResult::error(vec![Content::text(
                        "No cards provided. Pass at least one card in the 'cards' array.",
                    )]));
                }

                // Pre-generate IDs for all cards so batch refs ($0, $1, ...) can be resolved
                let generated_ids: Vec<String> = (0..params.cards.len())
                    .map(|_| state::gen_id("card"))
                    .collect();

                let mut card_ids = Vec::new();

                for (i, entry) in params.cards.into_iter().enumerate() {
                    let has_existing_cards = !plan.steps.is_empty() || i > 0;
                    // Resolve dependencies: replace $N refs with generated IDs
                    let resolved_deps: Vec<String> = entry
                        .dependencies
                        .into_iter()
                        .map(|dep| {
                            if let Some(idx_str) = dep.strip_prefix('$') {
                                if let Ok(idx) = idx_str.parse::<usize>() {
                                    if idx < generated_ids.len() {
                                        return generated_ids[idx].clone();
                                    }
                                }
                            }
                            dep
                        })
                        .collect();

                    if has_existing_cards && resolved_deps.is_empty() {
                        let mut available: Vec<String> = plan
                            .steps
                            .iter()
                            .map(|c| format!("{} ({})", c.id, c.title))
                            .collect();
                        for (j, id) in generated_ids.iter().enumerate().take(i) {
                            available.push(format!("{} (batch ${})", id, j));
                        }
                        return Ok(CallToolResult::error(vec![Content::text(format!(
                            "DEPENDENCY_REQUIRED: Card '{}' (index {}) needs at least one dependency. Use '$N' to reference cards in this batch, or use these existing IDs: [{}].",
                            entry.title, i, available.join(", ")
                        ))]));
                    }

                    let fc = entry
                        .file_changes
                        .map(build_file_changes)
                        .unwrap_or_default();
                    let next_order = plan.steps.len() as u32;
                    let card = Card {
                        id: generated_ids[i].clone(),
                        title: entry.title,
                        description: entry.description,
                        card_type: entry.card_type,
                        repo: entry.repo,
                        files: entry.files,
                        dependencies: resolved_deps,
                        file_changes: fc,
                        order: next_order,
                    };
                    card_ids.push(card.id.clone());
                    plan.steps.push(card);
                }

                state::save_state(&st);
                Ok(CallToolResult::success(vec![Content::text(
                    serde_json::json!({ "cardIds": card_ids }).to_string(),
                )]))
            }
            None => Ok(CallToolResult::error(vec![Content::text(format!(
                "Plan '{}' not found",
                params.plan_id
            ))])),
        }
    }

    #[tool(
        description = "Remove a card by ID. Automatically cleans up dangling dependency references in other cards."
    )]
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
                    // Clean up dangling dependency references
                    for card in plan.steps.iter_mut() {
                        card.dependencies.retain(|d| d != &params.card_id);
                    }
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
        description = "Get cards from a plan with pagination. Returns card metadata WITHOUT file_changes content to save tokens. Use offset/limit for large plans (e.g., offset=0, limit=10). Each card includes: id, title, description, type, repo, files, dependencies, hasFileChanges flag, order."
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

    #[tool(
        description = "List all plans. Returns id, title, icon, and cardCount for each. Use this to find the right plan_id before calling other tools."
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

    #[tool(
        description = "Get a plan's full structure with all cards (without file_changes). For plans with many cards, prefer get_cards with pagination to save tokens. Returns: id, title, icon, description, and cards array."
    )]
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

    #[tool(
        description = "Remove ALL cards from a plan. This is destructive — use remove_card for single deletions. The plan itself remains; only its cards are cleared."
    )]
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
        description = "Get pending feedback from the user. Returns unread questions, directives, and issues.\n\nAction required per type:\n- question: Answer with answer_feedback (provide the feedback_id and your answer)\n- directive: Read and follow the instruction, then acknowledge with acknowledge_feedback\n- issue: Address the reported problem, then acknowledge with acknowledge_feedback\n\nCheck this regularly during plan execution to stay aligned with user intent."
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

    #[tool(
        description = "Answer a question feedback. The answer appears in the UI under the question."
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
                serde_json::json!({ "ok": true }).to_string(),
            )]))
        } else {
            Ok(CallToolResult::error(vec![Content::text(format!(
                "Feedback '{}' not found",
                params.feedback_id
            ))]))
        }
    }

    #[tool(
        description = "Partially update a card — only provided fields change, others are preserved. Use this to:\n- Update description with progress/results\n- Add or modify file_changes with new code diffs\n- Change dependencies as the plan evolves\n- Reorder with the 'order' field\n\nFor file_changes, provide the full set of changes (not incremental) — existing file_changes are replaced entirely."
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
