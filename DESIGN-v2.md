# Design: Agentic Dashboard v2 — Navigation & Attention Filtering

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser (localhost:4201)                        │
│                                                  │
│  ┌──────────┐  ┌─────────────────────────────┐  │
│  │ SideMenu │  │ Main Content Area            │  │
│  │ (NEW)    │  │                              │  │
│  │          │  │  ListView (NEW)              │  │
│  │ Attention│  │    or                        │  │
│  │ Teams    │  │  DetailView (NEW)            │  │
│  │ Plans    │  │    └── SessionPanel (existing)│  │
│  │ Solo     │  │    or                        │  │
│  │          │  │  AttentionQueue (modified)    │  │
│  └──────────┘  └─────────────────────────────┘  │
│                                                  │
│  useWebSocket (existing) ◄──── ws://4200         │
│  useSections (NEW)       ◄──── GET /api/sections │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  Express Server (localhost:4200)                 │
│                                                  │
│  GET /api/sections (NEW)                         │
│  GET /api/health   (existing)                    │
│  GET /api/state    (existing)                    │
│  WebSocket         (existing)                    │
│                                                  │
│  AdapterRegistry (existing)                      │
│  AttentionEngine (modified — stripped down)       │
└─────────────────────────────────────────────────┘
```

### Components

| Component | Location | Status | Responsibility |
|-----------|----------|--------|----------------|
| SideMenu | `ui/components/SideMenu.tsx` | NEW | Vertical nav with section badges |
| ListView | `ui/components/ListView.tsx` | NEW | Generic session list for any section |
| DetailView | `ui/components/DetailView.tsx` | NEW | Back button + SessionPanel wrapper |
| App | `ui/App.tsx` | modified | Sidebar + main content layout, navigation state |
| AttentionQueue | `ui/components/AttentionQueue.tsx` | modified | Remove action buttons |
| AttentionEngine | `server/attention-engine.ts` | modified | Remove orphan/idle checks, tighten regex |
| server/index.ts | `server/index.ts` | modified | Add `/api/sections` endpoint |
| SessionPanel | `ui/components/HierarchyView.tsx` | existing | Reused inside DetailView (exported) |
| RawDataFallback | `ui/components/RawDataFallback.tsx` | existing | Unchanged |
| useWebSocket | `ui/hooks/useWebSocket.ts` | existing | Unchanged |

---

## API Design

### GET /api/sections

Returns available sections based on registered adapters. Called once on UI load.

```typescript
// Response
interface SectionsResponse {
  sections: SectionInfo[];
}

interface SectionInfo {
  id: string;        // "attention" | "teams" | "plans" | "solo"
  label: string;     // "Attention" | "Teams" | "Plans" | "Solo Sessions"
  sessionType: string | null;  // maps to session.type filter, null for attention
}
```

The server determines sections from registered adapters:
- `ClaudeCodeAdapter` registered → "teams" and "solo" sections
- `CursorAdapter` registered → "plans" section
- "attention" section always present (but hidden in UI if 0 items)

---

## Processing Flows

### Navigation Flow

```
User clicks section in SideMenu
  │
  ├── section === "attention"
  │     └── Main area renders AttentionQueue with filtered items
  │
  └── section === "teams" | "plans" | "solo"
        └── Main area renders ListView
              │
              └── User clicks item in list
                    └── Main area renders DetailView
                          │ (wraps SessionPanel)
                          │
                          └── User clicks back
                                └── Main area renders ListView again
```

### Section Detection Flow (server startup)

```
Server starts
  │
  ├── ClaudeCodeAdapter registered?
  │     ├── Has team sessions? → add "teams" section
  │     └── Has solo sessions? → add "solo" section
  │
  └── CursorAdapter registered?
        └── Has plan sessions? → add "plans" section

→ Always add "attention" section
→ Expose via GET /api/sections
```

### Attention Evaluation (tightened)

```
For each workspace → session → message:
  │
  ├── Is message.needsResponse? (from adapter)
  │     └── Does content match BLOCKED_PATTERN?
  │           /\b(blocked|cannot proceed|waiting for your|
  │            need your approval|please (approve|confirm))\b/i
  │           ├── Yes → create AttentionItem (urgency from content)
  │           └── No → skip
  │
  └── (orphan tasks and idle agents: REMOVED)
```

---

## Key Decisions

1. **State-based routing over React Router** — App holds `activeSection` and `selectedSessionId` in useState. No URL routing needed. Keeps dependencies minimal.

2. **Sections fetched once on load, not from WebSocket** — `/api/sections` is a one-time HTTP call. Sections don't change at runtime, so no need to push them over WebSocket.

3. **SessionPanel extracted from HierarchyView** — Currently `SessionPanel` is a private function inside `HierarchyView.tsx`. It needs to be exported so `DetailView` can import it. The sub-components (`AgentList`, `TaskList`, `MessageList`, `StatusDot`, `TaskStatusIcon`, `Empty`) move with it.

4. **ListView filters client-side by session type** — The WebSocket already pushes full state. ListView filters `state.workspaces` → `sessions` by `session.type` matching the section's `sessionType`. No server-side filtering needed.

5. **Attention "informational" urgency removed** — With orphan tasks and idle agents gone, only "blocking" and "waiting" urgencies remain. The `inferMessageUrgency` method stays but "informational" is effectively dead code. Keep the type for forward compatibility but nothing will produce it.

---

## File Structure

```
~/.agentic-dashboard/
  server/
    index.ts              ← modified: add /api/sections endpoint
    attention-engine.ts   ← modified: strip down to blocked-only
    types.ts              ← existing (unchanged)
    adapter-registry.ts   ← existing (unchanged)
  adapters/
    claude-code.ts        ← existing (unchanged)
    cursor.ts             ← existing (unchanged)
    types.ts              ← existing (unchanged)
  ui/
    App.tsx               ← modified: sidebar layout + nav state
    components/
      SideMenu.tsx        ← NEW
      ListView.tsx        ← NEW
      DetailView.tsx      ← NEW
      SessionPanel.tsx    ← NEW (extracted from HierarchyView)
      AttentionQueue.tsx  ← modified: remove action buttons
      HierarchyView.tsx   ← DELETED (replaced by ListView + DetailView)
      RawDataFallback.tsx ← existing (unchanged)
    hooks/
      useWebSocket.ts     ← existing (unchanged)
      useSections.ts      ← NEW (fetch /api/sections once)
```

---

## Testing Strategy

- Manual: launch dashboard, verify side menu shows only detected sections
- Manual: click each section, verify list view renders with correct items
- Manual: click list item, verify detail view shows SessionPanel, back button works
- Manual: verify attention count dropped from 131 to single digits
- Manual: verify no action buttons on attention items
- TypeScript: `npx tsc --noEmit` passes with zero errors

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| SessionPanel extraction breaks existing code | Low | Extract as-is, keep all sub-components together |
| Attention filter too aggressive (0 items) | Medium | Pattern is reasonable but may need tuning after testing |

---

## Future Scope (Next Slice)

### F1: Runtime Dynamic Sections

**Current State:** Sections determined at install time, fixed for the session.
**Proposed Change:** Watch for new adapter data appearing and dynamically add/remove sections.
**Decision:** Deferred. Install-time is sufficient for now.

### F2: Attention Action Buttons

**Current State:** Removed in this slice.
**Proposed Change:** Add interactive buttons that trigger actions (respond, dismiss, assign).
**Decision:** Deferred. Dashboard is read-only visibility for now.
