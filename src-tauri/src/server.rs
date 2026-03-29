use axum::{
    extract::Path,
    extract::State as AxumState,
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

use crate::state::{self, Card, CardType, Feedback, FeedbackType, Plan, Position, SharedState};
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
    Json(serde_json::json!({ "id": id, "title": title }))
}

async fn get_history(Path(plan_id): Path<String>) -> Json<serde_json::Value> {
    let history = state::load_history(&plan_id);
    Json(serde_json::to_value(&history).unwrap_or_default())
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
    s.plans.insert(0, plan);
    state::save_state(&s);
    Json(serde_json::json!({ "id": id }))
}

#[derive(Deserialize)]
struct AddCardInput {
    title: String,
    description: String,
    #[serde(rename = "type")]
    card_type: String,
    repo: String,
    #[serde(default)]
    files: Vec<String>,
    #[serde(default)]
    dependencies: Vec<String>,
}

async fn add_card_rest(
    AxumState(st): AxumState<SharedState>,
    Path(plan_id): Path<String>,
    Json(input): Json<AddCardInput>,
) -> Json<serde_json::Value> {
    let mut s = st.write().await;
    if let Some(plan) = s.plans.iter_mut().find(|p| p.id == plan_id) {
        let ct = match input.card_type.as_str() {
            "research" => CardType::Research,
            "planning" => CardType::Planning,
            "create" => CardType::Create,
            "test" => CardType::Test,
            _ => CardType::Edit,
        };
        let next_order = plan.steps.len() as u32;
        let card = Card {
            id: state::gen_id("card"),
            title: input.title,
            description: input.description,
            card_type: ct,
            repo: input.repo,
            files: input.files,
            dependencies: input.dependencies,
            file_changes: HashMap::new(),
            order: next_order,
        };
        let id = card.id.clone();
        plan.steps.push(card);
        state::save_state(&s);
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
    Path((plan_id, card_id)): Path<(String, String)>,
    Json(input): Json<UpdateCardInput>,
) -> Json<serde_json::Value> {
    let mut s = st.write().await;
    if let Some(plan) = s.plans.iter_mut().find(|p| p.id == plan_id) {
        if let Some(card) = plan.steps.iter_mut().find(|c| c.id == card_id) {
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
            // Manual edits don't record history
            state::save_state_no_history(&s);
            Json(serde_json::json!({ "ok": true }))
        } else {
            Json(serde_json::json!({ "error": "Card not found" }))
        }
    } else {
        Json(serde_json::json!({ "error": "Plan not found" }))
    }
}

async fn delete_card_rest(
    AxumState(st): AxumState<SharedState>,
    Path((plan_id, card_id)): Path<(String, String)>,
) -> Json<serde_json::Value> {
    let mut s = st.write().await;
    let Some(plan_index) = s.plans.iter().position(|p| p.id == plan_id) else {
        return Json(serde_json::json!({ "error": "Plan not found" }));
    };

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
    state::save_state(&s);
    Json(serde_json::json!({ "ok": true }))
}
