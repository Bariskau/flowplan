use std::collections::HashMap;

use serde::Deserialize;
use tauri::State as TauriState;

use crate::state::{
    self, AppState, Card, CardType, Feedback, FeedbackType, HistoryActor, HistoryChange,
    HistoryChangeKind, HistorySource, Plan, Position, SharedState,
};

fn history_source_from_value(source: Option<String>) -> HistorySource {
    match source.as_deref() {
        Some("undo") => HistorySource::Undo,
        Some("redo") => HistorySource::Redo,
        Some("mcp") => HistorySource::Mcp,
        Some("system") => HistorySource::System,
        _ => HistorySource::Rest,
    }
}

fn history_actor_id(actor_id: Option<String>) -> Option<String> {
    actor_id
        .map(|value| value.split_whitespace().collect::<Vec<_>>().join(" "))
        .map(|value| value.chars().take(48).collect::<String>())
        .filter(|value| !value.is_empty())
}

fn history_actor_avatar_seed(actor_avatar_seed: Option<String>) -> Option<String> {
    actor_avatar_seed
        .map(|value| value.split_whitespace().collect::<Vec<_>>().join(" "))
        .map(|value| value.chars().take(96).collect::<String>())
        .filter(|value| !value.is_empty())
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddCardInput {
    pub id: Option<String>,
    pub title: String,
    pub description: String,
    #[serde(rename = "type")]
    pub card_type: String,
    pub repo: String,
    #[serde(default)]
    pub files: Vec<String>,
    #[serde(default)]
    pub dependencies: Vec<String>,
    #[serde(rename = "fileChanges")]
    pub file_changes: Option<HashMap<String, state::FileChange>>,
    pub order: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCardInput {
    pub title: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub card_type: Option<String>,
    pub repo: Option<String>,
    pub files: Option<Vec<String>>,
    pub dependencies: Option<Vec<String>>,
    #[serde(rename = "fileChanges")]
    pub file_changes: Option<HashMap<String, state::FileChange>>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HistoryQuery {
    pub offset: Option<usize>,
    pub limit: Option<usize>,
}

fn fork_plan_snapshot(
    source_plan: &Plan,
    source_positions: Option<&HashMap<String, Position>>,
    title: Option<String>,
) -> (Plan, HashMap<String, Position>) {
    let next_plan_id = state::gen_id("plan");
    let next_title = title
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
        .collect();

    let next_positions = source_positions
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

    (
        Plan {
            id: next_plan_id,
            title: next_title,
            icon: source_plan.icon.clone(),
            description: source_plan.description.clone(),
            steps: next_steps,
            created_at: state::now_millis(),
            pinned: false,
        },
        next_positions,
    )
}

#[tauri::command]
pub async fn get_app_state(st: TauriState<'_, SharedState>) -> Result<AppState, String> {
    Ok(st.read().await.clone())
}

#[tauri::command]
pub async fn add_feedback(
    st: TauriState<'_, SharedState>,
    card_id: String,
    feedback_type: FeedbackType,
    text: String,
    owner_user_id: Option<String>,
    owner_username: Option<String>,
    owner_avatar_seed: Option<String>,
) -> Result<serde_json::Value, String> {
    let mut s = st.write().await;
    let fb = Feedback {
        id: state::gen_id("fb"),
        card_id,
        feedback_type,
        text,
        answer: None,
        timestamp: state::now_millis(),
        read: false,
        owner_user_id: owner_user_id.unwrap_or_default(),
        owner_username: owner_username.unwrap_or_default(),
        owner_avatar_seed: owner_avatar_seed.unwrap_or_default(),
    };
    let id = fb.id.clone();
    s.feedbacks.push(fb);
    state::save_state(&s);
    Ok(serde_json::json!({ "id": id }))
}

#[tauri::command]
pub async fn delete_feedback(
    st: TauriState<'_, SharedState>,
    id: String,
) -> Result<serde_json::Value, String> {
    let mut s = st.write().await;
    s.feedbacks.retain(|feedback| feedback.id != id);
    state::save_state(&s);
    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
pub async fn create_plan(
    st: TauriState<'_, SharedState>,
    title: String,
    icon: String,
    description: String,
    actor_id: Option<String>,
    actor_avatar_seed: Option<String>,
) -> Result<serde_json::Value, String> {
    let mut s = st.write().await;
    let plan = Plan {
        id: state::gen_id("plan"),
        title,
        icon,
        description,
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
        history_actor_id(actor_id),
        history_actor_avatar_seed(actor_avatar_seed),
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
    Ok(serde_json::json!({ "id": id }))
}

#[tauri::command]
pub async fn import_plan(
    st: TauriState<'_, SharedState>,
    mut plan: Plan,
    actor_id: Option<String>,
    actor_avatar_seed: Option<String>,
) -> Result<serde_json::Value, String> {
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
            .map(|dep| imported_ids.get(dep).cloned().unwrap_or_else(|| dep.clone()))
            .collect();
    }
    let id = plan.id.clone();
    let title = plan.title.clone();
    s.plans.insert(0, plan.clone());
    state::save_state(&s);
    let changes = state::build_history_changes(None, &plan);
    state::append_history_entry(
        &plan,
        s.positions.get(&id),
        HistoryActor::Ui,
        history_actor_id(actor_id),
        history_actor_avatar_seed(actor_avatar_seed),
        HistorySource::Rest,
        None,
        changes,
        Some("Imported plan".to_string()),
    );
    Ok(serde_json::json!({ "id": id, "title": title }))
}

#[tauri::command]
pub async fn save_positions(
    st: TauriState<'_, SharedState>,
    plan_id: String,
    positions: HashMap<String, Position>,
) -> Result<serde_json::Value, String> {
    let mut s = st.write().await;
    s.positions.insert(plan_id, positions);
    state::save_state(&s);
    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
pub async fn delete_plan(
    st: TauriState<'_, SharedState>,
    plan_id: String,
) -> Result<serde_json::Value, String> {
    let mut s = st.write().await;
    let before = s.plans.len();
    s.plans.retain(|plan| plan.id != plan_id);
    if s.plans.len() == before {
        return Err("Plan not found".to_string());
    }
    s.positions.remove(&plan_id);
    state::save_state(&s);
    state::delete_history(&plan_id);
    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
pub async fn fork_plan(
    st: TauriState<'_, SharedState>,
    plan_id: String,
    title: Option<String>,
    actor_id: Option<String>,
    actor_avatar_seed: Option<String>,
) -> Result<serde_json::Value, String> {
    let mut s = st.write().await;
    let Some(source_plan) = s.plans.iter().find(|plan| plan.id == plan_id).cloned() else {
        return Err("Plan not found".to_string());
    };
    let source_positions = s.positions.get(&plan_id).cloned();
    let (forked_plan, forked_positions) = fork_plan_snapshot(&source_plan, source_positions.as_ref(), title);
    let forked_plan_id = forked_plan.id.clone();
    let forked_plan_title = forked_plan.title.clone();
    s.plans.insert(0, forked_plan.clone());
    s.positions.insert(forked_plan_id.clone(), forked_positions);
    state::save_state(&s);
    state::append_history_entry(
        &forked_plan,
        s.positions.get(&forked_plan_id),
        HistoryActor::Ui,
        history_actor_id(actor_id),
        history_actor_avatar_seed(actor_avatar_seed),
        HistorySource::Rest,
        None,
        vec![HistoryChange {
            kind: HistoryChangeKind::PlanCreated,
            card_id: None,
            title: Some(forked_plan_title.clone()),
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
    Ok(serde_json::json!({ "id": forked_plan_id, "title": forked_plan_title }))
}

#[tauri::command]
pub async fn toggle_pin(
    st: TauriState<'_, SharedState>,
    plan_id: String,
) -> Result<serde_json::Value, String> {
    let mut s = st.write().await;
    let Some(plan) = s.plans.iter_mut().find(|plan| plan.id == plan_id) else {
        return Err("Plan not found".to_string());
    };
    plan.pinned = !plan.pinned;
    let pinned = plan.pinned;
    state::save_state(&s);
    Ok(serde_json::json!({ "ok": true, "pinned": pinned }))
}

#[tauri::command]
pub async fn fetch_history(
    plan_id: String,
    query: Option<HistoryQuery>,
) -> Result<serde_json::Value, String> {
    let query = query.unwrap_or_default();
    let history = state::load_history(&plan_id);
    let total = history.entries.len();
    let offset = query.offset.unwrap_or(0).min(total);
    let limit = query.limit.unwrap_or(20).max(1).min(100);
    let end = total.saturating_sub(offset);
    let start = end.saturating_sub(limit);
    let entries = history.entries[start..end].to_vec();
    Ok(serde_json::json!({
        "planId": history.plan_id,
        "entries": entries,
        "total": total,
        "offset": offset,
        "limit": limit,
        "hasMore": start > 0,
        "hasPrevious": offset > 0,
    }))
}

#[tauri::command]
pub async fn clear_history(plan_id: String) -> Result<serde_json::Value, String> {
    state::delete_history(&plan_id);
    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
pub async fn add_card(
    st: TauriState<'_, SharedState>,
    plan_id: String,
    card: AddCardInput,
    source: Option<String>,
    actor_id: Option<String>,
    actor_avatar_seed: Option<String>,
) -> Result<serde_json::Value, String> {
    let mut s = st.write().await;
    let Some(plan) = s.plans.iter_mut().find(|plan| plan.id == plan_id) else {
        return Err("Plan not found".to_string());
    };
    let before_plan = plan.clone();
    let card_type = match card.card_type.as_str() {
        "research" => CardType::Research,
        "planning" => CardType::Planning,
        "create" => CardType::Create,
        "test" => CardType::Test,
        _ => CardType::Edit,
    };
    let next_order = plan.steps.len() as u32;
    let new_card = Card {
        id: card.id.unwrap_or_else(|| state::gen_id("card")),
        title: card.title,
        description: card.description,
        card_type,
        repo: card.repo,
        files: card.files,
        dependencies: card.dependencies,
        file_changes: card.file_changes.unwrap_or_default(),
        order: card.order.unwrap_or(next_order),
    };
    if plan.steps.iter().any(|existing| existing.id == new_card.id) {
        return Err("Card already exists".to_string());
    }
    let id = new_card.id.clone();
    plan.steps.push(new_card);
    let after_plan = plan.clone();
    let snapshot_positions = s.positions.get(&plan_id).cloned();
    state::save_state(&s);
    let changes = state::build_history_changes(Some(&before_plan), &after_plan);
    state::append_history_entry(
        &after_plan,
        snapshot_positions.as_ref(),
        HistoryActor::Ui,
        history_actor_id(actor_id),
        history_actor_avatar_seed(actor_avatar_seed),
        history_source_from_value(source),
        None,
        changes,
        None,
    );
    Ok(serde_json::json!({ "id": id }))
}

#[tauri::command]
pub async fn update_card(
    st: TauriState<'_, SharedState>,
    plan_id: String,
    card_id: String,
    updates: UpdateCardInput,
    source: Option<String>,
    actor_id: Option<String>,
    actor_avatar_seed: Option<String>,
) -> Result<serde_json::Value, String> {
    let mut s = st.write().await;
    let Some(plan) = s.plans.iter_mut().find(|plan| plan.id == plan_id) else {
        return Err("Plan not found".to_string());
    };
    let before_plan = plan.clone();
    let Some(card) = plan.steps.iter_mut().find(|card| card.id == card_id) else {
        return Err("Card not found".to_string());
    };
    if let Some(value) = updates.title {
        card.title = value;
    }
    if let Some(value) = updates.description {
        card.description = value;
    }
    if let Some(value) = updates.card_type {
        card.card_type = match value.as_str() {
            "research" => CardType::Research,
            "planning" => CardType::Planning,
            "create" => CardType::Create,
            "test" => CardType::Test,
            _ => CardType::Edit,
        };
    }
    if let Some(value) = updates.repo {
        card.repo = value;
    }
    if let Some(value) = updates.files {
        card.files = value;
    }
    if let Some(value) = updates.dependencies {
        card.dependencies = value;
    }
    if let Some(value) = updates.file_changes {
        card.file_changes = value;
    }

    let after_plan = plan.clone();
    let snapshot_positions = s.positions.get(&plan_id).cloned();
    state::save_state(&s);
    let changes = state::build_history_changes(Some(&before_plan), &after_plan);
    state::append_history_entry(
        &after_plan,
        snapshot_positions.as_ref(),
        HistoryActor::Ui,
        history_actor_id(actor_id),
        history_actor_avatar_seed(actor_avatar_seed),
        history_source_from_value(source),
        None,
        changes,
        None,
    );
    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
pub async fn delete_card(
    st: TauriState<'_, SharedState>,
    plan_id: String,
    card_id: String,
    source: Option<String>,
    actor_id: Option<String>,
    actor_avatar_seed: Option<String>,
) -> Result<serde_json::Value, String> {
    let mut s = st.write().await;
    let Some(plan_index) = s.plans.iter().position(|plan| plan.id == plan_id) else {
        return Err("Plan not found".to_string());
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
        return Err("Card not found".to_string());
    }

    if let Some(plan_positions) = s.positions.get_mut(&plan_id) {
        plan_positions.remove(&card_id);
    }
    s.feedbacks.retain(|feedback| feedback.card_id != card_id);
    let after_plan = s.plans[plan_index].clone();
    let snapshot_positions = s.positions.get(&plan_id).cloned();
    state::save_state(&s);
    let changes = state::build_history_changes(Some(&before_plan), &after_plan);
    state::append_history_entry(
        &after_plan,
        snapshot_positions.as_ref(),
        HistoryActor::Ui,
        history_actor_id(actor_id),
        history_actor_avatar_seed(actor_avatar_seed),
        history_source_from_value(source),
        None,
        changes,
        Some(format!("Removed card: {removed_title}")),
    );
    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
pub async fn apply_peer_snapshot(
    st: TauriState<'_, SharedState>,
    plan: Plan,
    positions: HashMap<String, Position>,
    feedbacks: Vec<Feedback>,
    actor_id: Option<String>,
    actor_avatar_seed: Option<String>,
    record_history: Option<bool>,
) -> Result<serde_json::Value, String> {
    let mut s = st.write().await;
    let before_plan = s.plans.iter().find(|candidate| candidate.id == plan.id).cloned();
    match s.plans.iter_mut().find(|candidate| candidate.id == plan.id) {
        Some(existing) => *existing = plan.clone(),
        None => s.plans.insert(0, plan.clone()),
    }
    let plan_card_ids: std::collections::HashSet<String> = plan
        .steps
        .iter()
        .map(|card| card.id.clone())
        .chain(
            before_plan
                .as_ref()
                .into_iter()
                .flat_map(|previous| previous.steps.iter().map(|card| card.id.clone())),
        )
        .collect();
    s.feedbacks.retain(|feedback| !plan_card_ids.contains(&feedback.card_id));
    s.feedbacks.extend(feedbacks);
    s.positions.insert(plan.id.clone(), positions);
    if record_history.unwrap_or(true) {
        let changes = state::build_history_changes(before_plan.as_ref(), &plan);
        state::save_state_no_history(&s);
        state::append_history_entry(
            &plan,
            s.positions.get(&plan.id),
            HistoryActor::Collab,
            history_actor_id(actor_id),
            history_actor_avatar_seed(actor_avatar_seed),
            HistorySource::Rest,
            None,
            changes,
            None,
        );
    } else {
        state::save_state_no_history(&s);
    }
    Ok(serde_json::json!({ "ok": true }))
}
