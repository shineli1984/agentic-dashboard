# Plan: Agentic Dashboard v2 — Navigation & Attention Filtering

> Spec: [SPEC-v2.md](./SPEC-v2.md)
> Design: [DESIGN-v2.md](./DESIGN-v2.md)

## Dependencies

```
┌───────────────────────────────────────────┐
│  SLICE 1: SERVER CHANGES                   │
│                                            │
│  1  Strip attention engine (2 pts)         │
│  2  Add /api/sections endpoint (2 pts)     │
└─────────────────────┬─────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
┌────────────────────┐  ┌────────────────────┐
│  SLICE 2           │  │  SLICE 3           │
│  UI COMPONENTS     │  │  ATTENTION UI      │
│  (parallel)        │  │  (parallel)        │
│                    │  │                    │
│  3  Extract        │  │  6  Strip action   │
│     SessionPanel   │  │     buttons (1 pt) │
│     (2 pts)        │  │                    │
│  4  SideMenu +     │  │                    │
│     useSections    │  │                    │
│     (2 pts)        │  │                    │
│  5  ListView +     │  │                    │
│     DetailView     │  │                    │
│     (3 pts)        │  │                    │
└─────────┬──────────┘  └──────────┬─────────┘
          └────────────┬───────────┘
                       ▼
┌───────────────────────────────────────────┐
│  SLICE 4: INTEGRATION                      │
│                                            │
│  7  Rewrite App.tsx with sidebar layout    │
│     + navigation (3 pts)                   │
│  8  Delete HierarchyView, verify (1 pt)    │
└───────────────────────────────────────────┘

Legend: number = task ID, (N pts) = estimate
```

## Tasks

| # | Task | Status | Pts | Blocked By | Parallel With | Description |
|---|------|--------|-----|------------|---------------|-------------|
| 1 | Strip attention engine | Available | 2 | — | 2 | Remove `checkOrphanTasks`, `checkIdleAgents`, tighten `checkMessages` regex to blocked-only pattern |
| 2 | Add /api/sections endpoint | Available | 2 | — | 1 | Add `GET /api/sections` to server/index.ts, derive sections from registered adapters |
| 3 | Extract SessionPanel | Available | 2 | — | — | Move SessionPanel + sub-components from HierarchyView.tsx into SessionPanel.tsx, export |
| 4 | Create SideMenu + useSections | Blocked | 2 | 2 | 5 | New SideMenu component + useSections hook that fetches /api/sections once |
| 5 | Create ListView + DetailView | Blocked | 3 | 3 | 4 | ListView filters sessions by type, DetailView wraps SessionPanel with back button |
| 6 | Strip attention action buttons | Blocked | 1 | 1 | 4, 5 | Remove action buttons from AttentionQueue, remove actions from AttentionItem display |
| 7 | Rewrite App.tsx | Blocked | 3 | 4, 5, 6 | 8 | Sidebar + main content layout, navigation state (activeSection, selectedSessionId) |
| 8 | Delete HierarchyView + verify | Blocked | 1 | 7 | — | Remove HierarchyView.tsx, run tsc --noEmit, manual test |

**Total: 8 tasks, 16 points**

---

## Implementation Notes

### Task 1: Strip attention engine

In `server/attention-engine.ts`:
- Delete `checkOrphanTasks` method entirely
- Delete `checkIdleAgents` method entirely
- Remove `IDLE_THRESHOLD_MS` constant
- In `evaluate()`, remove calls to both deleted methods
- In `checkMessages`, change `needsResponse` check: instead of trusting the adapter's `needsResponse` flag, apply the strict pattern: `/\b(blocked|cannot proceed|waiting for your|need your approval|please (approve|confirm))\b/i`
- Remove `actions` from created AttentionItems (set to empty array)
- Keep `inferMessageUrgency` but only "blocking" and "waiting" will realistically trigger

### Task 2: Add /api/sections endpoint

In `server/index.ts`:
- Add `SectionInfo` type (or import from types.ts)
- After adapter registration, build sections array:
  - Check which adapters are registered
  - ClaudeCodeAdapter → potentially "teams" and "solo"
  - CursorAdapter → "plans"
  - Always include "attention"
- Add `app.get("/api/sections", ...)` returning the sections array

### Task 3: Extract SessionPanel

- Create `ui/components/SessionPanel.tsx`
- Move from `HierarchyView.tsx`: `SessionPanel`, `AgentList`, `TaskList`, `MessageList`, `StatusDot`, `TaskStatusIcon`, `Empty`
- Export `SessionPanel` as named export
- Export `Empty` as named export (used by ListView)
- Update HierarchyView.tsx to import from SessionPanel.tsx (temporary — HierarchyView deleted in task 8)

### Task 4: SideMenu + useSections

- Create `ui/hooks/useSections.ts`: fetch `/api/sections` once with useEffect, return `{ sections, loading }`
- Create `ui/components/SideMenu.tsx`: render vertical nav from sections, accept `activeSection` and `onSelect` props, show badge counts from dashboard state

### Task 5: ListView + DetailView

- Create `ui/components/ListView.tsx`: accept `sessions: Session[]`, show name + stats + last activity, accept `onSelect(sessionId)` prop
- Create `ui/components/DetailView.tsx`: accept `session: Session`, render back button + SessionPanel
- ListView filters sessions from state by `session.type` matching the section's `sessionType`

### Task 6: Strip attention action buttons

In `ui/components/AttentionQueue.tsx`:
- Remove the `item.actions.map(...)` block from the expanded view
- Keep urgency badge, short context, expand/collapse, full context, source info

### Task 7: Rewrite App.tsx

- Import SideMenu, ListView, DetailView, AttentionQueue, useSections
- State: `activeSection: string`, `selectedSessionId: string | null`
- Layout: flex row — SideMenu (fixed width ~200px) | main content (flex 1)
- Main content renders based on state:
  - `attention` → AttentionQueue
  - others → selectedSessionId ? DetailView : ListView
- Default activeSection: attention if items > 0, else first section
- Pass badge counts to SideMenu from WebSocket state

### Task 8: Delete HierarchyView + verify

- Delete `ui/components/HierarchyView.tsx`
- Remove any remaining imports
- Run `npx tsc --noEmit`
- Manual test: launch, click through all sections
