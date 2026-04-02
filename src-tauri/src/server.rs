use axum::{
    extract::Path,
    extract::Query,
    extract::State as AxumState,
    http::HeaderMap,
    routing::{delete, get, post},
    Json, Router,
};
use http::Method;
use rmcp::transport::streamable_http_server::{
    session::local::LocalSessionManager, StreamableHttpServerConfig, StreamableHttpService,
};
use serde::Deserialize;
use std::sync::Arc;
use tokio_util::sync::CancellationToken;
use tower_http::cors::CorsLayer;

use std::collections::HashMap;

use crate::state::{
    self, Card, CardType, Feedback, FeedbackType, HistoryActor, HistoryChange, HistoryChangeKind,
    HistorySource, Plan, Position, SharedState,
};
use crate::tools::PlannerHandler;

pub async fn run_server(shared: SharedState, ct: CancellationToken) -> anyhow::Result<()> {
    // MCP service
    let session_manager = Arc::new(LocalSessionManager::default());
    let mcp_state = shared.clone();
    let mcp_service = StreamableHttpService::new(
        move || Ok(PlannerHandler::new(mcp_state.clone())),
        session_manager,
        StreamableHttpServerConfig::default(),
    );

    // CORS
    let cors = CorsLayer::new()
        .allow_origin([
            "http://localhost:1420".parse().unwrap(),
            "http://localhost:5173".parse().unwrap(),
            "http://localhost:3100".parse().unwrap(),
            "http://127.0.0.1:1420".parse().unwrap(),
            "http://127.0.0.1:5173".parse().unwrap(),
            "http://127.0.0.1:3100".parse().unwrap(),
            "tauri://localhost".parse().unwrap(),
            "https://tauri.localhost".parse().unwrap(),
        ])
        .allow_methods([Method::GET, Method::POST, Method::DELETE, Method::OPTIONS])
        .allow_headers(tower_http::cors::Any);

    // Routes
    let app = Router::new()
        .route("/api/state", get(get_state))
        .route("/api/feedback", post(add_feedback))
        .route("/api/feedback/{id}/answer", post(answer_feedback))
        .route("/api/feedback/{id}", delete(delete_feedback))
        .route("/api/plans/create", post(create_plan_rest))
        .route("/api/plans/import", post(import_plan))
        .route("/api/plans/{plan_id}/positions", post(save_positions))
        .route(
            "/api/plans/{plan_id}/cards/{card_id}",
            post(update_card_rest).delete(delete_card_rest),
        )
        .route("/api/plans/{plan_id}/cards", post(add_card_rest))
        .route("/api/plans/{plan_id}", delete(delete_plan))
        .route("/api/plans/{plan_id}/pin", post(toggle_pin))
        .route("/api/plans/{plan_id}/history", get(get_history))
        .route("/api/plans/{plan_id}/history", delete(clear_history))
        .with_state(shared)
        .nest_service("/mcp", mcp_service)
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3100").await?;
    println!("[flowplan] MCP server on http://127.0.0.1:3100/mcp");
    println!("[flowplan] UI API on http://127.0.0.1:3100/api/state");

    axum::serve(listener, app)
        .with_graceful_shutdown(async move { ct.cancelled().await })
        .await?;

    Ok(())
}

async fn get_state(AxumState(st): AxumState<SharedState>) -> Json<serde_json::Value> {
    let s = st.read().await;
    Json(serde_json::to_value(&*s).unwrap_or_default())
}

fn history_source_from_headers(headers: &HeaderMap) -> HistorySource {
    match headers
        .get("x-flowplan-source")
        .and_then(|value| value.to_str().ok())
    {
        Some("undo") => HistorySource::Undo,
        Some("redo") => HistorySource::Redo,
        _ => HistorySource::Rest,
    }
}

#[derive(Deserialize)]
struct FeedbackInput {
    #[serde(rename = "cardId")]
    card_id: String,
    #[serde(rename = "type")]
    feedback_type: FeedbackType,
    text: String,
}

async fn add_feedback(
    AxumState(st): AxumState<SharedState>,
    Json(input): Json<FeedbackInput>,
) -> Json<serde_json::Value> {
    let mut s = st.write().await;
    let fb = Feedback {
        id: state::gen_id("fb"),
        card_id: input.card_id,
        feedback_type: input.feedback_type,
        text: input.text,
        answer: None,
        timestamp: state::now_millis(),
        read: false,
    };
    let id = fb.id.clone();
    s.feedbacks.push(fb);
    state::save_state(&s);
    Json(serde_json::json!({ "id": id }))
}

#[derive(Deserialize)]
struct AnswerInput {
    answer: String,
}

async fn answer_feedback(
    AxumState(st): AxumState<SharedState>,
    Path(id): Path<String>,
    Json(input): Json<AnswerInput>,
) -> Json<serde_json::Value> {
    let mut s = st.write().await;
    if let Some(fb) = s.feedbacks.iter_mut().find(|f| f.id == id) {
        fb.answer = Some(input.answer);
        state::save_state(&s);
        Json(serde_json::json!({ "ok": true }))
    } else {
        Json(serde_json::json!({ "error": "Feedback not found" }))
    }
}

async fn delete_feedback(
    AxumState(st): AxumState<SharedState>,
    Path(id): Path<String>,
) -> Json<serde_json::Value> {
    let mut s = st.write().await;
    s.feedbacks.retain(|f| f.id != id);
    state::save_state(&s);
    Json(serde_json::json!({ "ok": true }))
}

async fn delete_plan(
    AxumState(st): AxumState<SharedState>,
    Path(plan_id): Path<String>,
) -> Json<serde_json::Value> {
    let mut s = st.write().await;
    let before = s.plans.len();
    s.plans.retain(|p| p.id != plan_id);
    if s.plans.len() < before {
        s.positions.remove(&plan_id);
        state::save_state(&s);
        state::delete_history(&plan_id);
        Json(serde_json::json!({ "ok": true }))
    } else {
        Json(serde_json::json!({ "error": "Plan not found" }))
    }
}

async fn toggle_pin(
    AxumState(st): AxumState<SharedState>,
    Path(plan_id): Path<String>,
) -> Json<serde_json::Value> {
    let mut s = st.write().await;
    if let Some(plan) = s.plans.iter_mut().find(|p| p.id == plan_id) {
        plan.pinned = !plan.pinned;
        let pinned = plan.pinned;
        state::save_state(&s);
        Json(serde_json::json!({ "ok": true, "pinned": pinned }))
    } else {
        Json(serde_json::json!({ "error": "Plan not found" }))
    }
}

async fn save_positions(
    AxumState(st): AxumState<SharedState>,
    Path(plan_id): Path<String>,
    Json(positions): Json<HashMap<String, Position>>,
) -> Json<serde_json::Value> {
    let mut s = st.write().await;
    s.positions.insert(plan_id, positions);
    state::save_state(&s);
    Json(serde_json::json!({ "ok": true }))
}

async fn import_plan(
    AxumState(st): AxumState<SharedState>,
    Json(mut plan): Json<state::Plan>,
) -> Json<serde_json::Value> {
    let mut s = st.write().await;
    plan.id = state::gen_id("plan");
    plan.created_at = state::now_millis();
    let imported_ids: HashMap<String, String> = plan
        .steps
        .iter()
        .map(|card| (card.id.clone(), state::gen_id("card")))
        .collect();
    for card in plan.steps.iter_mut() {
        if let Some(new_id) = imported_ids.get(&card.id) {
            card.id = new_id.clone();
        }
        card.dependencies = card
            .dependencies
            .iter()
            .map(|dep| {
                imported_ids
                    .get(dep)
                    .cloned()
                    .unwrap_or_else(|| dep.clone())
            })
            .collect();
    }
    let id = plan.id.clone();
    let title = plan.title.clone();
    s.plans.insert(0, plan);
    state::save_state(&s);
    if let Some(inserted_plan) = s.plans.iter().find(|p| p.id == id).cloned() {
        let changes = state::build_history_changes(None, &inserted_plan);
        state::append_history_entry(
            &inserted_plan,
            s.positions.get(&id),
            HistoryActor::Ui,
            Some("desktop".to_string()),
            HistorySource::Rest,
            None,
            changes,
            Some("Imported plan".to_string()),
        );
    }
    Json(serde_json::json!({ "id": id, "title": title }))
}

#[derive(Deserialize, Default)]
struct HistoryQuery {
    offset: Option<usize>,
    limit: Option<usize>,
}

async fn get_history(
    Path(plan_id): Path<String>,
    Query(query): Query<HistoryQuery>,
) -> Json<serde_json::Value> {
    let history = state::load_history(&plan_id);
    let total = history.entries.len();
    let offset = query.offset.unwrap_or(0).min(total);
    let limit = query.limit.unwrap_or(20).max(1).min(100);
    let end = total.saturating_sub(offset);
    let start = end.saturating_sub(limit);
    let entries = history.entries[start..end].to_vec();

    Json(serde_json::json!({
        "planId": history.plan_id,
        "entries": entries,
        "total": total,
        "offset": offset,
        "limit": limit,
        "hasMore": start > 0,
        "hasPrevious": offset > 0,
    }))
}

async fn clear_history(Path(plan_id): Path<String>) -> Json<serde_json::Value> {
    state::delete_history(&plan_id);
    Json(serde_json::json!({ "ok": true }))
}

// --- Manual operations (REST) ---

#[derive(Deserialize)]
struct CreatePlanInput {
    title: String,
    icon: String,
    description: String,
}

async fn create_plan_rest(
    AxumState(st): AxumState<SharedState>,
    Json(input): Json<CreatePlanInput>,
) -> Json<serde_json::Value> {
    let mut s = st.write().await;
    let plan = Plan {
        id: state::gen_id("plan"),
        title: input.title,
        icon: input.icon,
        description: input.description,
        steps: Vec::new(),
        created_at: state::now_millis(),
        pinned: false,
    };
    let id = plan.id.clone();
    s.plans.insert(0, plan.clone());
    state::save_state(&s);
    state::append_history_entry(
        &plan,
        s.positions.get(&id),
        HistoryActor::Ui,
        Some("desktop".to_string()),
        HistorySource::Rest,
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
    Json(serde_json::json!({ "id": id }))
}

#[derive(Deserialize)]
struct AddCardInput {
    id: Option<String>,
    title: String,
    description: String,
    #[serde(rename = "type")]
    card_type: String,
    repo: String,
    #[serde(default)]
    files: Vec<String>,
    #[serde(default)]
    dependencies: Vec<String>,
    #[serde(rename = "fileChanges")]
    file_changes: Option<HashMap<String, state::FileChange>>,
    order: Option<u32>,
}

async fn add_card_rest(
    AxumState(st): AxumState<SharedState>,
    headers: HeaderMap,
    Path(plan_id): Path<String>,
    Json(input): Json<AddCardInput>,
) -> Json<serde_json::Value> {
    let mut s = st.write().await;
    if let Some(plan) = s.plans.iter_mut().find(|p| p.id == plan_id) {
        let before_plan = plan.clone();
        let ct = match input.card_type.as_str() {
            "research" => CardType::Research,
            "planning" => CardType::Planning,
            "create" => CardType::Create,
            "test" => CardType::Test,
            _ => CardType::Edit,
        };
        let next_order = plan.steps.len() as u32;
        let card = Card {
            id: input.id.unwrap_or_else(|| state::gen_id("card")),
            title: input.title,
            description: input.description,
            card_type: ct,
            repo: input.repo,
            files: input.files,
            dependencies: input.dependencies,
            file_changes: input.file_changes.unwrap_or_default(),
            order: input.order.unwrap_or(next_order),
        };
        if plan.steps.iter().any(|existing| existing.id == card.id) {
            return Json(serde_json::json!({ "error": "Card already exists" }));
        }
        let id = card.id.clone();
        plan.steps.push(card);
        let after_plan = plan.clone();
        let snapshot_positions = s.positions.get(&plan_id).cloned();
        let source = history_source_from_headers(&headers);
        state::save_state(&s);
        let changes = state::build_history_changes(Some(&before_plan), &after_plan);
        state::append_history_entry(
            &after_plan,
            snapshot_positions.as_ref(),
            HistoryActor::Ui,
            Some("desktop".to_string()),
            source,
            None,
            changes,
            None,
        );
        Json(serde_json::json!({ "id": id }))
    } else {
        Json(serde_json::json!({ "error": "Plan not found" }))
    }
}

#[derive(Deserialize)]
struct UpdateCardInput {
    title: Option<String>,
    description: Option<String>,
    #[serde(rename = "type")]
    card_type: Option<String>,
    repo: Option<String>,
    files: Option<Vec<String>>,
    dependencies: Option<Vec<String>>,
    #[serde(rename = "fileChanges")]
    file_changes: Option<HashMap<String, state::FileChange>>,
}

async fn update_card_rest(
    AxumState(st): AxumState<SharedState>,
    headers: HeaderMap,
    Path((plan_id, card_id)): Path<(String, String)>,
    Json(input): Json<UpdateCardInput>,
) -> Json<serde_json::Value> {
    let mut s = st.write().await;
    if let Some(plan) = s.plans.iter_mut().find(|p| p.id == plan_id) {
        let before_plan = plan.clone();
        let updated = if let Some(card) = plan.steps.iter_mut().find(|c| c.id == card_id) {
            if let Some(v) = input.title {
                card.title = v;
            }
            if let Some(v) = input.description {
                card.description = v;
            }
            if let Some(v) = input.card_type {
                card.card_type = match v.as_str() {
                    "research" => CardType::Research,
                    "planning" => CardType::Planning,
                    "create" => CardType::Create,
                    "test" => CardType::Test,
                    _ => CardType::Edit,
                };
            }
            if let Some(v) = input.repo {
                card.repo = v;
            }
            if let Some(v) = input.files {
                card.files = v;
            }
            if let Some(v) = input.dependencies {
                card.dependencies = v;
            }
            if let Some(v) = input.file_changes {
                card.file_changes = v;
            }
            true
        } else {
            false
        };

        if !updated {
            return Json(serde_json::json!({ "error": "Card not found" }));
        }

        let after_plan = plan.clone();
        let snapshot_positions = s.positions.get(&plan_id).cloned();
        let source = history_source_from_headers(&headers);
        state::save_state(&s);
        let changes = state::build_history_changes(Some(&before_plan), &after_plan);
        state::append_history_entry(
            &after_plan,
            snapshot_positions.as_ref(),
            HistoryActor::Ui,
            Some("desktop".to_string()),
            source,
            None,
            changes,
            None,
        );
        Json(serde_json::json!({ "ok": true }))
    } else {
        Json(serde_json::json!({ "error": "Plan not found" }))
    }
}

async fn delete_card_rest(
    AxumState(st): AxumState<SharedState>,
    headers: HeaderMap,
    Path((plan_id, card_id)): Path<(String, String)>,
) -> Json<serde_json::Value> {
    let mut s = st.write().await;
    let Some(plan_index) = s.plans.iter().position(|p| p.id == plan_id) else {
        return Json(serde_json::json!({ "error": "Plan not found" }));
    };
    let before_plan = s.plans[plan_index].clone();
    let removed_title = before_plan
        .steps
        .iter()
        .find(|card| card.id == card_id)
        .map(|card| card.title.clone())
        .unwrap_or_else(|| "Untitled".to_string());

    let removed = {
        let plan = &mut s.plans[plan_index];
        let before = plan.steps.len();
        plan.steps.retain(|card| card.id != card_id);
        if plan.steps.len() == before {
            false
        } else {
            for card in plan.steps.iter_mut() {
                card.dependencies.retain(|dep| dep != &card_id);
            }
            true
        }
    };

    if !removed {
        return Json(serde_json::json!({ "error": "Card not found" }));
    }

    if let Some(plan_positions) = s.positions.get_mut(&plan_id) {
        plan_positions.remove(&card_id);
    }
    s.feedbacks.retain(|feedback| feedback.card_id != card_id);
    let after_plan = s.plans[plan_index].clone();
    let snapshot_positions = s.positions.get(&plan_id).cloned();
    let source = history_source_from_headers(&headers);
    state::save_state(&s);
    let changes = state::build_history_changes(Some(&before_plan), &after_plan);
    state::append_history_entry(
        &after_plan,
        snapshot_positions.as_ref(),
        HistoryActor::Ui,
        Some("desktop".to_string()),
        source,
        None,
        changes,
        Some(format!("Removed card: {removed_title}")),
    );
    Json(serde_json::json!({ "ok": true }))
}
