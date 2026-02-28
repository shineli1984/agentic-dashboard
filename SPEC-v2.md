# Spec: Agentic Dashboard v2 — Navigation & Attention Filtering

## What

Add side menu navigation and tighten the attention queue. The dashboard currently stacks everything on a single scrollable page with 131 attention items, most of which are noise. This iteration adds a sidebar with sections (Attention, Teams, Plans, Solo Sessions) determined at install time, a list-then-detail navigation pattern, and restricts attention items to only cases where an agent is literally blocked and cannot proceed without human action.

## Why

- 131 attention items makes the queue useless — users ignore it entirely
- Single-page layout doesn't scale as more workspaces and sessions are detected
- Users need to quickly navigate to the section they care about without scrolling past irrelevant data
- Action buttons on attention items are premature — the dashboard is read-only visibility, not an orchestrator

## Requirements

1. Side menu with sections determined at install time based on detected tools (not runtime dynamic)
2. Sections: Attention, Teams, Plans, Solo Sessions — only sections with detected data appear
3. `GET /api/sections` endpoint returns available sections based on registered adapters
4. List-then-detail navigation: clicking a section shows a list, clicking an item drills into detail
5. Detail view reuses the existing SessionPanel component (agents/tasks/messages tabs + raw data)
6. Back button in detail view returns to the section list
7. Default active section is Attention if it has items, otherwise the first available section
8. Attention queue only shows items where an agent is blocked and cannot proceed without human action
9. Attention matching pattern: `/\b(blocked|cannot proceed|waiting for your|need your approval|please (approve|confirm))\b/i`
10. Remove orphan task detection from attention engine
11. Remove idle agent detection from attention engine
12. Remove action buttons from attention items

## Acceptance Criteria

1. Side menu renders only sections for detected tools (e.g. no "Plans" if Cursor not installed)
2. Side menu shows item count badges per section
3. Clicking a section shows a list view with name, summary stats, and last activity
4. Clicking a list item shows the detail view with SessionPanel
5. Back button returns to the list view
6. Attention items count drops from 131 to single digits with tightened filtering
7. No action buttons appear on attention items
8. `GET /api/sections` returns correct sections based on registered adapters
9. Empty sections show contextual empty state message
10. `npx tsc --noEmit` passes with zero errors
11. WebSocket connection and real-time updates continue to work
12. Layout is sidebar + main content (not single column)

## Out of Scope

- Runtime dynamic section discovery
- Action buttons or interactive controls on attention items
- Unit tests
- React Router (state-based routing is sufficient)
- New adapter support
- Persisted navigation state across page reloads

## Open Questions

None.
