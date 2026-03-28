# FlowPlan Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix bugs, add manual plan/card features, improve visuals with glassmorphism + dot grid background, optimize modals, and verify MCP tools.

**Architecture:** Incremental changes across React frontend (App.tsx, lib/) and Rust backend (server.rs, state.rs, tools.rs). Visual overhaul uses CSS backdrop-filter and a canvas-based dot grid. Card editing bypasses history by adding a `manual` flag to state changes.

**Tech Stack:** React 18, TypeScript, Tauri 2, Rust, Axum, RMCP

---

### Task 1: Fix Ubuntu Scroll Zoom Sensitivity

**Files:**
- Modify: `src/App.tsx:563-581` (wheelRef handler)

The zoom multiplier `0.01` is too aggressive on Linux where scroll delta values are larger. Use platform-adaptive multiplier.

- [ ] **Step 1: Fix the wheel zoom multiplier**

In the `wheelRef` handler (around line 573), reduce the zoom sensitivity and add deltaMode normalization:

```typescript
wheelRef.current = (e: WheelEvent) => {
  e.preventDefault();
  const rect = cr.current?.getBoundingClientRect();
  if (!rect) return;
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  // Normalize delta: deltaMode 1 = line-based (multiply by ~28px)
  let dy = e.deltaY;
  let dx = e.deltaX;
  if (e.deltaMode === 1) { dy *= 28; dx *= 28; }
  if (e.ctrlKey || e.metaKey) {
    setZ(prev => {
      const next = Math.max(0.1, Math.min(5, prev - dy * 0.002));
      const ratio = next / prev;
      setOff(o => ({ x: mx - (mx - o.x) * ratio, y: my - (my - o.y) * ratio }));
      return next;
    });
  } else {
    setOff(o => ({ x: o.x - dx, y: o.y - dy }));
  }
};
```

Also fix the `ow` handler (line 932-950) with the same normalization.

- [ ] **Step 2: Verify in dev mode on Ubuntu**

Run: `npm run tauri:dev`
Expected: Scroll zoom increments smoothly ~5% per scroll tick, not jumping 10→90.

- [ ] **Step 3: Commit**

---

### Task 2: Fix XSS in Highlight.ts

**Files:**
- Modify: `src/lib/highlight.ts:64-88`

The catch blocks return raw unescaped code that goes to `dangerouslySetInnerHTML`.

- [ ] **Step 1: Add HTML escape to fallback paths**

```typescript
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function highlight(code: string, lang?: string): string {
  const key = (lang || "") + "\0" + code;
  const cached = cache.get(key);
  if (cached) return cached;

  let result: string;
  if (lang && hljs.getLanguage(lang)) {
    try {
      result = hljs.highlight(code, { language: lang }).value;
    } catch {
      result = escapeHtml(code);
    }
  } else {
    try {
      result = hljs.highlightAuto(code).value;
    } catch {
      result = escapeHtml(code);
    }
  }

  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(key, result);
  return result;
}
```

- [ ] **Step 2: Commit**

---

### Task 3: Add API Error Handling

**Files:**
- Modify: `src/lib/api.ts`

Add `r.ok` checks to all API functions that are missing them.

- [ ] **Step 1: Fix all API functions**

```typescript
export async function addFeedback(cardId: string, type: "question" | "directive" | "issue", text: string): Promise<Feedback> {
  const r = await fetch(`${BASE}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId, type, text }) });
  if (!r.ok) throw new Error("add feedback failed");
  return r.json();
}

export async function answerFeedback(id: string, answer: string): Promise<Feedback> {
  const r = await fetch(`${BASE}/feedback/${id}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer }) });
  if (!r.ok) throw new Error("answer feedback failed");
  return r.json();
}

export async function deleteFeedback(id: string): Promise<void> {
  const r = await fetch(`${BASE}/feedback/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("delete feedback failed");
}

export async function savePositions(planId: string, positions: Record<string, { x: number; y: number }>): Promise<void> {
  const r = await fetch(`${BASE}/plans/${planId}/positions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(positions) });
  if (!r.ok) throw new Error("save positions failed");
}

export async function deletePlan(planId: string): Promise<void> {
  const r = await fetch(`${BASE}/plans/${planId}`, { method: "DELETE" });
  if (!r.ok) throw new Error("delete plan failed");
}

export async function togglePin(planId: string): Promise<{ pinned: boolean }> {
  const r = await fetch(`${BASE}/plans/${planId}/pin`, { method: "POST" });
  if (!r.ok) throw new Error("toggle pin failed");
  return r.json();
}
```

- [ ] **Step 2: Add createPlan API function**

```typescript
export async function createPlan(title: string, icon: string, description: string): Promise<{ id: string }> {
  const r = await fetch(`${BASE}/plans/create`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, icon, description }) });
  if (!r.ok) throw new Error("create plan failed");
  return r.json();
}

export async function addCard(planId: string, card: { title: string; description: string; type: string; repo: string; files: string[]; dependencies: string[] }): Promise<{ id: string }> {
  const r = await fetch(`${BASE}/plans/${planId}/cards`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(card) });
  if (!r.ok) throw new Error("add card failed");
  return r.json();
}

export async function updateCard(planId: string, cardId: string, updates: Record<string, any>): Promise<void> {
  const r = await fetch(`${BASE}/plans/${planId}/cards/${cardId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
  if (!r.ok) throw new Error("update card failed");
}
```

- [ ] **Step 3: Commit**

---

### Task 4: Add Backend REST Endpoints for Manual Operations

**Files:**
- Modify: `src-tauri/src/server.rs` — add create_plan, add_card, update_card REST routes
- Modify: `src-tauri/src/state.rs` — add `save_state_no_history` function

- [ ] **Step 1: Add save_state_no_history to state.rs**

```rust
/// Save state without recording history (for manual UI edits)
pub fn save_state_no_history(state: &AppState) {
    let dir = state_dir();
    let _ = std::fs::create_dir_all(&dir);
    let path = state_file();
    if let Ok(data) = serde_json::to_string_pretty(state) {
        let _ = std::fs::write(path, data);
    }
}
```

- [ ] **Step 2: Add REST routes to server.rs**

Add routes:
```
POST /api/plans/create          → create_plan_rest
POST /api/plans/{plan_id}/cards → add_card_rest
POST /api/plans/{plan_id}/cards/{card_id} → update_card_rest
```

Create handler:
```rust
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
    files: Vec<String>,
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
            file_changes: std::collections::HashMap::new(),
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
    file_changes: Option<std::collections::HashMap<String, state::FileChange>>,
}

async fn update_card_rest(
    AxumState(st): AxumState<SharedState>,
    Path((plan_id, card_id)): Path<(String, String)>,
    Json(input): Json<UpdateCardInput>,
) -> Json<serde_json::Value> {
    let mut s = st.write().await;
    if let Some(plan) = s.plans.iter_mut().find(|p| p.id == plan_id) {
        if let Some(card) = plan.steps.iter_mut().find(|c| c.id == card_id) {
            if let Some(v) = input.title { card.title = v; }
            if let Some(v) = input.description { card.description = v; }
            if let Some(v) = input.card_type {
                card.card_type = match v.as_str() {
                    "research" => CardType::Research,
                    "planning" => CardType::Planning,
                    "create" => CardType::Create,
                    "test" => CardType::Test,
                    _ => CardType::Edit,
                };
            }
            if let Some(v) = input.repo { card.repo = v; }
            if let Some(v) = input.files { card.files = v; }
            if let Some(v) = input.dependencies { card.dependencies = v; }
            if let Some(v) = input.file_changes { card.file_changes = v; }
            // Use no-history save for manual edits
            state::save_state_no_history(&s);
            Json(serde_json::json!({ "ok": true }))
        } else {
            Json(serde_json::json!({ "error": "Card not found" }))
        }
    } else {
        Json(serde_json::json!({ "error": "Plan not found" }))
    }
}
```

- [ ] **Step 3: Register routes**

```rust
.route("/api/plans/create", post(create_plan_rest))
.route("/api/plans/{plan_id}/cards", post(add_card_rest))
.route("/api/plans/{plan_id}/cards/{card_id}", post(update_card_rest))
```

- [ ] **Step 4: Commit**

---

### Task 5: Improve MCP Tool Descriptions

**Files:**
- Modify: `src-tauri/src/tools.rs`

Make tool descriptions more directive and comprehensive for AI coding agents.

- [ ] **Step 1: Update all tool descriptions and parameter descriptions**

Key improvements:
- `create_plan`: Add clear instruction about plan structure
- `add_cards`: More explicit about dependency requirements, file_changes format
- `CardEntry` fields: More detailed schemars descriptions
- `update_card`: Clearer about partial updates
- `get_all_feedback`: Better instructions about how to handle each type

- [ ] **Step 2: Commit**

---

### Task 6: Manual Plan Creation UI

**Files:**
- Modify: `src/App.tsx` — sidebar + button, new plan modal

- [ ] **Step 1: Replace import button with dropdown menu (+ button → Import JSON, New Plan)**

Change the sidebar `+` button to open a small dropdown menu with two options: "Import JSON" and "New Plan".

- [ ] **Step 2: Add new plan modal**

Modal with fields: Title (text input), Icon (emoji picker or text input), Description (textarea). On submit, calls `api.createPlan()` and selects the new plan.

- [ ] **Step 3: Commit**

---

### Task 7: Manual Card Creation UI

**Files:**
- Modify: `src/App.tsx` — add card button on canvas/toolbar, card creation modal

- [ ] **Step 1: Add "Add Card" button in the toolbar area**

Add a `+` button next to the arrange button in the canvas bottom controls.

- [ ] **Step 2: Create card creation modal**

Modal with: Title, Description, Type (dropdown), Repo, Files (comma-separated or add-one-by-one). For dependencies, show checkboxes of existing cards. Manual cards bypass the strict dependency requirement from MCP (they can have zero dependencies).

- [ ] **Step 3: Wire to backend**

Call `api.addCard()` to create the card. The REST endpoint doesn't enforce dependency requirements like the MCP tool does.

- [ ] **Step 4: Commit**

---

### Task 8: Card Content Editing UI

**Files:**
- Modify: `src/App.tsx` — Detail component gets edit mode
- Modify: `src/lib/api.ts` — updateCard function already added in Task 3

- [ ] **Step 1: Add edit mode toggle to Detail component**

Add a pencil/edit button in the Detail header. When clicked, switches to edit mode where:
- Title becomes an input field
- Description becomes a textarea
- Type becomes a dropdown
- File changes text becomes editable textareas per file

- [ ] **Step 2: Save changes on blur/button click**

Call `api.updateCard()` which uses `save_state_no_history` (no history recording).

- [ ] **Step 3: Commit**

---

### Task 9: Manual Dependency/Arrow Reordering

**Files:**
- Modify: `src/App.tsx` — Detail dependencies section

- [ ] **Step 1: Add drag-to-reorder on dependencies list in Detail**

In the dependencies section of the Detail drawer, allow drag-and-drop to reorder dependencies. Each dependency gets a drag handle.

- [ ] **Step 2: Save reordered dependencies**

When order changes, call `api.updateCard()` with the new dependencies array order.

- [ ] **Step 3: Commit**

---

### Task 10: Visual Overhaul — Dot Grid Background

**Files:**
- Modify: `src/App.tsx` — canvas area gets dot grid background

- [ ] **Step 1: Create DotGrid canvas component**

Port the provided HTML example into a React component. The canvas renders a dot grid that responds to mouse movement with glow effects. It sits behind the card layer.

Key config from the example:
```
spacing: 28px
dotRadius: 1.5
dotColor: [50, 50, 60]
glowColor: [140, 80, 255]  (purple)
accentColor: [80, 180, 255]  (blue)
influenceRadius: 140px
maxGlowRadius: 3.5
```

The canvas must account for the current pan/zoom transform so dots stay aligned with the viewport.

- [ ] **Step 2: Integrate into the flow view**

Place the DotGrid canvas as an absolutely positioned layer behind the card transform container. The dots are in screen-space (viewport-fixed), not world-space.

- [ ] **Step 3: Commit**

---

### Task 11: Visual Overhaul — Glassmorphism

**Files:**
- Modify: `src/App.tsx` — sidebar, drawers, cards, modals

- [ ] **Step 1: Apply glassmorphism to sidebar**

```css
background: rgba(20, 20, 20, 0.7);
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
```

- [ ] **Step 2: Apply glassmorphism to drawers (Detail, History)**

```css
background: rgba(26, 26, 26, 0.75);
backdrop-filter: blur(16px);
-webkit-backdrop-filter: blur(16px);
```

- [ ] **Step 3: Apply glassmorphism to cards**

```css
background: rgba(30, 30, 30, 0.6);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.06);
```

- [ ] **Step 4: Update toolbar and modals similarly**

- [ ] **Step 5: Commit**

---

### Task 12: Optimize About and Check Updates Modals

**Files:**
- Modify: `src-tauri/src/main.rs` — show_dialog function

- [ ] **Step 1: Optimize the dialog injection**

The current `show_dialog` function injects styles and DOM elements via `eval()` every time. Optimize by:
- Only inject the style once (check for existing `<style>` element)
- Use simpler DOM construction
- Reduce the JavaScript string size

- [ ] **Step 2: Commit**

---

### Task 13: MCP Testing — Create 10+ Plans

**Files:**
- Uses MCP tools via the running application

- [ ] **Step 1: Start the dev server and verify MCP connectivity**

Run: `npm run tauri:dev`

- [ ] **Step 2: Create 10 diverse plans via MCP tools**

Use `mcp__flowplan__create_plan` and `mcp__flowplan__add_cards` to create plans covering:
1. Simple 3-card linear dependency
2. Complex 8-card branching dependency tree
3. Single card plan
4. Plan with all 5 card types
5. Plan with file_changes (create/edit/delete)
6. Plan with long descriptions (markdown)
7. Plan with many files per card
8. Plan with feedback items
9. Plan to test pagination (many cards)
10. Plan with deeply nested dependencies

- [ ] **Step 3: Verify each plan renders correctly in flow and list views**

- [ ] **Step 4: Test manual features — create plan, add card, edit card, reorder deps**

- [ ] **Step 5: Fix any issues found**

---

## Execution Order

Tasks 1-5 (bugs & backend) → Tasks 6-9 (UI features) → Tasks 10-11 (visuals) → Task 12 (optimization) → Task 13 (testing)
