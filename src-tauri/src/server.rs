use axum::{
    extract::{Path, Query, State as AxumState},
    http::{HeaderMap, Method, StatusCode},
    routing::{delete, get, post},
    Json, Router,
};
use rmcp::transport::streamable_http_server::{
    session::local::LocalSessionManager, StreamableHttpServerConfig, StreamableHttpService,
};
use serde::Deserialize;
use std::{collections::HashMap, sync::Arc};
use tokio_util::sync::CancellationToken;
use tower_http::cors::CorsLayer;

use crate::{
    commands::{AddCardInput, HistoryQuery, UpdateCardInput},
    state::{
        self, Card, CardType, Feedback, FeedbackType, HistoryActor, HistoryChange, HistoryChangeKind,
        HistorySource, Plan, Position, SharedState,
    },
    tools::PlannerHandler,
};

type ApiError = (StatusCode, Json<serde_json::Value>);
type ApiResult = Result<Json<serde_json::Value>, ApiError>;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FeedbackInput {
    card_id: String,
    #[serde(rename = "type")]
    feedback_type: FeedbackType,
    text: String,
    owner_user_id: Option<String>,
    owner_username: Option<String>,
    owner_avatar_seed: Option<String>,
}

#[derive(Deserialize)]
struct AnswerInput {
    answer: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreatePlanInput {
    title: String,
    icon: String,
    description: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ForkPlanInput {
    title: Option<String>,
}

fn json_error(status: StatusCode, message: impl Into<String>) -> ApiError {
    (status, Json(serde_json::json!({ "error": message.into() })))
}

fn header_str<'a>(headers: &'a HeaderMap, name: &'static str) -> Option<&'a str> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn history_source_from_headers(headers: &HeaderMap) -> HistorySource {
    match header_str(headers, "X-Flowplan-Source") {
        Some("undo") => HistorySource::Undo,
        Some("redo") => HistorySource::Redo,
        Some("mcp") => HistorySource::Mcp,
        Some("system") => HistorySource::System,
        _ => HistorySource::Rest,
    }
}

fn history_actor_id_from_headers(headers: &HeaderMap) -> Option<String> {
    header_str(headers, "X-Flowplan-Actor")
        .map(|value| value.split_whitespace().collect::<Vec<_>>().join(" "))
        .map(|value| value.chars().take(48).collect::<String>())
        .filter(|value| !value.is_empty())
}

fn history_actor_avatar_seed_from_headers(headers: &HeaderMap) -> Option<String> {
    header_str(headers, "X-Flowplan-Avatar")
        .map(|value| value.chars().take(96).collect::<String>())
        .filter(|value| !value.is_empty())
}

fn parse_card_type(value: &str) -> CardType {
    match value {
        "research" => CardType::Research,
        "planning" => CardType::Planning,
        "create" => CardType::Create,
        "test" => CardType::Test,
        _ => CardType::Edit,
    }
}

pub async fn run_server(shared: SharedState, ct: CancellationToken) -> anyhow::Result<()> {
    let session_manager = Arc::new(LocalSessionManager::default());
    let mcp_state = shared.clone();
    let mcp_service = StreamableHttpService::new(
        move || Ok(PlannerHandler::new(mcp_state.clone())),
        session_manager,
        StreamableHttpServerConfig::default(),
    );

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

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/state", get(get_state))
        .route("/api/feedback", post(add_feedback))
        .route("/api/feedback/{id}/answer", post(answer_feedback))
        .route("/api/feedback/{id}", delete(delete_feedback))
        .route("/api/plans/create", post(create_plan_rest))
        .route("/api/plans/import", post(import_plan))
        .route("/api/plans/{plan_id}/fork", post(fork_plan_rest))
        .route("/api/plans/{plan_id}/positions", post(save_positions))
        .route("/api/plans/{plan_id}/cards", post(add_card_rest))
        .route(
            "/api/plans/{plan_id}/cards/{card_id}",
            post(update_card_rest).delete(delete_card_rest),
        )
        .route("/api/plans/{plan_id}", delete(delete_plan))
        .route("/api/plans/{plan_id}/pin", post(toggle_pin))
        .route("/api/plans/{plan_id}/history", get(get_history).delete(clear_history))
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

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "ok": true }))
}

async fn get_state(AxumState(st): AxumState<SharedState>) -> Json<serde_json::Value> {
    let state = st.read().await;
    Json(serde_json::to_value(&*state).unwrap_or_default())
}

async fn add_feedback(
    AxumState(st): AxumState<SharedState>,
    Json(input): Json<FeedbackInput>,
) -> ApiResult {
    let mut state = st.write().await;
    let feedback = Feedback {
        id: state::gen_id("fb"),
        card_id: input.card_id,
        feedback_type: input.feedback_type,
        text: input.text,
        answer: None,
        timestamp: state::now_millis(),
        read: false,
        owner_user_id: input.owner_user_id.unwrap_or_default(),
        owner_username: input.owner_username.unwrap_or_default(),
        owner_avatar_seed: input.owner_avatar_seed.unwrap_or_default(),
    };
    let id = feedback.id.clone();
    state.feedbacks.push(feedback);
    state::save_state(&state);
    Ok(Json(serde_json::json!({ "id": id })))
}

async fn answer_feedback(
    AxumState(st): AxumState<SharedState>,
    Path(id): Path<String>,
    Json(input): Json<AnswerInput>,
) -> ApiResult {
    let mut state = st.write().await;
    let Some(feedback) = state.feedbacks.iter_mut().find(|feedback| feedback.id == id) else {
        return Err(json_error(StatusCode::NOT_FOUND, "Feedback not found"));
    };
    feedback.answer = Some(input.answer);
    feedback.read = true;
    state::save_state(&state);
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn delete_feedback(
    AxumState(st): AxumState<SharedState>,
    Path(id): Path<String>,
) -> ApiResult {
    let mut state = st.write().await;
    let before = state.feedbacks.len();
    state.feedbacks.retain(|feedback| feedback.id != id);
    if state.feedbacks.len() == before {
        return Err(json_error(StatusCode::NOT_FOUND, "Feedback not found"));
    }
    state::save_state(&state);
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn create_plan_rest(
    AxumState(st): AxumState<SharedState>,
    headers: HeaderMap,
    Json(input): Json<CreatePlanInput>,
) -> ApiResult {
    let mut state = st.write().await;
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
    state.plans.insert(0, plan.clone());
    state::save_state(&state);
    state::append_history_entry(
        &plan,
        state.positions.get(&id),
        HistoryActor::Ui,
        history_actor_id_from_headers(&headers),
        history_actor_avatar_seed_from_headers(&headers),
        history_source_from_headers(&headers),
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
    Ok(Json(serde_json::json!({ "id": id })))
}

async fn import_plan(
    AxumState(st): AxumState<SharedState>,
    headers: HeaderMap,
    Json(mut plan): Json<Plan>,
) -> ApiResult {
    let mut state = st.write().await;
    plan.id = state::gen_id("plan");
    plan.created_at = state::now_millis();
    let imported_ids: HashMap<String, String> = plan
        .steps
        .iter()
        .map(|card| (card.id.clone(), state::gen_id("card")))
        .collect();
    for card in &mut plan.steps {
        if let Some(new_id) = imported_ids.get(&card.id) {
            card.id = new_id.clone();
        }
        card.dependencies = card
            .dependencies
            .iter()
            .map(|dependency| imported_ids.get(dependency).cloned().unwrap_or_else(|| dependency.clone()))
            .collect();
    }
    let id = plan.id.clone();
    let title = plan.title.clone();
    state.plans.insert(0, plan.clone());
    state::save_state(&state);
    let changes = state::build_history_changes(None, &plan);
    state::append_history_entry(
        &plan,
        state.positions.get(&id),
        HistoryActor::Ui,
        history_actor_id_from_headers(&headers),
        history_actor_avatar_seed_from_headers(&headers),
        history_source_from_headers(&headers),
        None,
        changes,
        Some("Imported plan".to_string()),
    );
    Ok(Json(serde_json::json!({ "id": id, "title": title })))
}

async fn save_positions(
    AxumState(st): AxumState<SharedState>,
    Path(plan_id): Path<String>,
    Json(positions): Json<HashMap<String, Position>>,
) -> ApiResult {
    let mut state = st.write().await;
    state.positions.insert(plan_id, positions);
    state::save_state(&state);
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn add_card_rest(
    AxumState(st): AxumState<SharedState>,
    headers: HeaderMap,
    Path(plan_id): Path<String>,
    Json(input): Json<AddCardInput>,
) -> ApiResult {
    let mut state = st.write().await;
    let Some(plan) = state.plans.iter_mut().find(|plan| plan.id == plan_id) else {
        return Err(json_error(StatusCode::NOT_FOUND, "Plan not found"));
    };
    let before_plan = plan.clone();
    let next_order = plan.steps.len() as u32;
    let card = Card {
        id: input.id.unwrap_or_else(|| state::gen_id("card")),
        title: input.title,
        description: input.description,
        card_type: parse_card_type(&input.card_type),
        repo: input.repo,
        files: input.files,
        dependencies: input.dependencies,
        file_changes: input.file_changes.unwrap_or_default(),
        order: input.order.unwrap_or(next_order),
    };
    if plan.steps.iter().any(|existing| existing.id == card.id) {
        return Err(json_error(StatusCode::CONFLICT, "Card already exists"));
    }
    let id = card.id.clone();
    plan.steps.push(card);
    let after_plan = plan.clone();
    let snapshot_positions = state.positions.get(&plan_id).cloned();
    state::save_state(&state);
    let changes = state::build_history_changes(Some(&before_plan), &after_plan);
    state::append_history_entry(
        &after_plan,
        snapshot_positions.as_ref(),
        HistoryActor::Ui,
        history_actor_id_from_headers(&headers),
        history_actor_avatar_seed_from_headers(&headers),
        history_source_from_headers(&headers),
        None,
        changes,
        None,
    );
    Ok(Json(serde_json::json!({ "id": id })))
}

async fn update_card_rest(
    AxumState(st): AxumState<SharedState>,
    headers: HeaderMap,
    Path((plan_id, card_id)): Path<(String, String)>,
    Json(input): Json<UpdateCardInput>,
) -> ApiResult {
    let mut state = st.write().await;
    let Some(plan) = state.plans.iter_mut().find(|plan| plan.id == plan_id) else {
        return Err(json_error(StatusCode::NOT_FOUND, "Plan not found"));
    };
    let before_plan = plan.clone();
    let Some(card) = plan.steps.iter_mut().find(|card| card.id == card_id) else {
        return Err(json_error(StatusCode::NOT_FOUND, "Card not found"));
    };
    if let Some(value) = input.title {
        card.title = value;
    }
    if let Some(value) = input.description {
        card.description = value;
    }
    if let Some(value) = input.card_type {
        card.card_type = parse_card_type(&value);
    }
    if let Some(value) = input.repo {
        card.repo = value;
    }
    if let Some(value) = input.files {
        card.files = value;
    }
    if let Some(value) = input.dependencies {
        card.dependencies = value;
    }
    if let Some(value) = input.file_changes {
        card.file_changes = value;
    }
    let after_plan = plan.clone();
    let snapshot_positions = state.positions.get(&plan_id).cloned();
    state::save_state(&state);
    let changes = state::build_history_changes(Some(&before_plan), &after_plan);
    state::append_history_entry(
        &after_plan,
        snapshot_positions.as_ref(),
        HistoryActor::Ui,
        history_actor_id_from_headers(&headers),
        history_actor_avatar_seed_from_headers(&headers),
        history_source_from_headers(&headers),
        None,
        changes,
        None,
    );
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn delete_card_rest(
    AxumState(st): AxumState<SharedState>,
    headers: HeaderMap,
    Path((plan_id, card_id)): Path<(String, String)>,
) -> ApiResult {
    let mut state = st.write().await;
    let Some(plan_index) = state.plans.iter().position(|plan| plan.id == plan_id) else {
        return Err(json_error(StatusCode::NOT_FOUND, "Plan not found"));
    };
    let before_plan = state.plans[plan_index].clone();
    let removed_title = before_plan
        .steps
        .iter()
        .find(|card| card.id == card_id)
        .map(|card| card.title.clone())
        .unwrap_or_else(|| "Untitled".to_string());

    let removed = {
        let plan = &mut state.plans[plan_index];
        let before = plan.steps.len();
        plan.steps.retain(|card| card.id != card_id);
        if plan.steps.len() == before {
            false
        } else {
            for card in &mut plan.steps {
                card.dependencies.retain(|dependency| dependency != &card_id);
            }
            true
        }
    };

    if !removed {
        return Err(json_error(StatusCode::NOT_FOUND, "Card not found"));
    }

    if let Some(plan_positions) = state.positions.get_mut(&plan_id) {
        plan_positions.remove(&card_id);
    }
    state.feedbacks.retain(|feedback| feedback.card_id != card_id);
    let after_plan = state.plans[plan_index].clone();
    let snapshot_positions = state.positions.get(&plan_id).cloned();
    state::save_state(&state);
    let changes = state::build_history_changes(Some(&before_plan), &after_plan);
    state::append_history_entry(
        &after_plan,
        snapshot_positions.as_ref(),
        HistoryActor::Ui,
        history_actor_id_from_headers(&headers),
        history_actor_avatar_seed_from_headers(&headers),
        history_source_from_headers(&headers),
        None,
        changes,
        Some(format!("Removed card: {removed_title}")),
    );
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn delete_plan(
    AxumState(st): AxumState<SharedState>,
    Path(plan_id): Path<String>,
) -> ApiResult {
    let mut state = st.write().await;
    let before = state.plans.len();
    state.plans.retain(|plan| plan.id != plan_id);
    if state.plans.len() == before {
        return Err(json_error(StatusCode::NOT_FOUND, "Plan not found"));
    }
    state.positions.remove(&plan_id);
    state::save_state(&state);
    state::delete_history(&plan_id);
    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn fork_plan_rest(
    AxumState(st): AxumState<SharedState>,
    headers: HeaderMap,
    Path(plan_id): Path<String>,
    Json(input): Json<ForkPlanInput>,
) -> ApiResult {
    let mut state = st.write().await;
    let Some(source_plan) = state.plans.iter().find(|plan| plan.id == plan_id).cloned() else {
        return Err(json_error(StatusCode::NOT_FOUND, "Plan not found"));
    };

    let source_positions = state.positions.get(&plan_id).cloned();
    let next_plan_id = state::gen_id("plan");
    let next_title = input
        .title
        .map(|value| value.split_whitespace().collect::<Vec<_>>().join(" "))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("{} local copy", source_plan.title));

    let card_id_map: HashMap<String, String> = source_plan
        .steps
        .iter()
        .map(|card| (card.id.clone(), state::gen_id("card")))
        .collect();

    let next_steps = source_plan
        .steps
        .iter()
        .map(|card| Card {
            id: card_id_map
                .get(&card.id)
                .cloned()
                .unwrap_or_else(|| state::gen_id("card")),
            title: card.title.clone(),
            description: card.description.clone(),
            card_type: card.card_type.clone(),
            repo: card.repo.clone(),
            files: card.files.clone(),
            dependencies: card
                .dependencies
                .iter()
                .map(|dependency| card_id_map.get(dependency).cloned().unwrap_or_else(|| dependency.clone()))
                .collect(),
            file_changes: card.file_changes.clone(),
            order: card.order,
        })
        .collect::<Vec<_>>();

    let next_positions = source_positions
        .as_ref()
        .map(|positions| {
            positions
                .iter()
                .filter_map(|(card_id, position)| {
                    card_id_map
                        .get(card_id)
                        .cloned()
                        .map(|next_card_id| (next_card_id, position.clone()))
                })
                .collect::<HashMap<_, _>>()
        })
        .unwrap_or_default();

    let forked_plan = Plan {
        id: next_plan_id.clone(),
        title: next_title.clone(),
        icon: source_plan.icon.clone(),
        description: source_plan.description.clone(),
        steps: next_steps,
        created_at: state::now_millis(),
        pinned: false,
    };

    state.plans.insert(0, forked_plan.clone());
    state.positions.insert(next_plan_id.clone(), next_positions);
    state::save_state(&state);
    state::append_history_entry(
        &forked_plan,
        state.positions.get(&next_plan_id),
        HistoryActor::Ui,
        history_actor_id_from_headers(&headers),
        history_actor_avatar_seed_from_headers(&headers),
        history_source_from_headers(&headers),
        None,
        vec![HistoryChange {
            kind: HistoryChangeKind::PlanCreated,
            card_id: None,
            title: Some(next_title.clone()),
            changed_fields: Vec::new(),
            dependencies_added: Vec::new(),
            dependencies_removed: Vec::new(),
            files_added: Vec::new(),
            files_removed: Vec::new(),
            file_changes_updated: Vec::new(),
            before: None,
            after: None,
        }],
        Some("Saved local copy".to_string()),
    );

    Ok(Json(serde_json::json!({ "id": next_plan_id, "title": next_title })))
}

async fn toggle_pin(
    AxumState(st): AxumState<SharedState>,
    Path(plan_id): Path<String>,
) -> ApiResult {
    let mut state = st.write().await;
    let Some(plan) = state.plans.iter_mut().find(|plan| plan.id == plan_id) else {
        return Err(json_error(StatusCode::NOT_FOUND, "Plan not found"));
    };
    plan.pinned = !plan.pinned;
    let pinned = plan.pinned;
    state::save_state(&state);
    Ok(Json(serde_json::json!({ "ok": true, "pinned": pinned })))
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
