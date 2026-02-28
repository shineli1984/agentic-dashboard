# Agentic Dashboard

Real-time monitoring dashboard for Claude Code multi-agent sessions. Surfaces what needs your attention across teams and solo sessions — so you can supervise without context-switching.

## What it monitors

The dashboard watches the Claude Code filesystem under `~/.claude/`:

| Path | Contents |
|------|----------|
| `~/.claude/teams/{name}/config.json` | Team membership, agent roles, models, working directories, prompts |
| `~/.claude/teams/{name}/inboxes/{agent}.json` | Messages between agents |
| `~/.claude/tasks/{team}/*.json` | Task lists with status, blocking info, activeForm labels |
| `~/.claude/todos/*.json` | Solo session task lists |

## What it does

- **Watches** the directories above for live changes via chokidar
- **Classifies** incoming messages by urgency: blocking, waiting, or informational
- **Derives** agent status (active/idle/unknown) and current task from filesystem state
- **Renders** a single-page dashboard with attention queue, kanban board, and session drill-down

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌────────────┐
│  Adapter     │────▶│  Express Server   │────▶│  React UI  │
│  (filesystem │     │  + WebSocket      │     │  (Vite)    │
│   watcher)   │     │  port 4200        │     │            │
└─────────────┘     └──────────────────┘     └────────────┘
      │                      │
      ▼                      ▼
 claude-code.ts      attention-engine.ts
                     board-engine.ts
                     workflow-scanner.ts
```

**Adapter** detects and watches `~/.claude/` directories using chokidar. Implements `ToolAdapter` (detect → scan → watch).

**Server** holds `DashboardState` in memory, re-evaluates on every filesystem change, and broadcasts updates over WebSocket.

**UI** connects via WebSocket and renders: sidebar navigation, attention queue (sorted by urgency), kanban board (backlog/in-progress/done), and detail views for sessions with agents, tasks, and messages.

## Quick start

The dashboard installs to `~/.agentic-dashboard/`. If it's already set up:

```bash
cd ~/.agentic-dashboard
npm run dev
# Server: http://localhost:4200
# Vite dev: http://localhost:4201 (with HMR)
```

For first-time setup, use the `/dashboard-bootstrap` skill in Claude Code.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start server + UI dev server in parallel |
| `npm run dev:server` | Server only (tsx watch, auto-reload) |
| `npm run dev:ui` | Vite dev server only |
| `npm run build` | TypeScript compile + Vite production build |
| `npm run typecheck` | Type-check without emitting |

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Server status, workspace + attention counts |
| `GET /api/state` | Full `DashboardState` JSON |
| `DELETE /api/board/:id` | Dismiss a board card |
| `ws://localhost:4200` | WebSocket — receives `state` and `update` messages |

## Key types

```typescript
DashboardState { workspaces, attentionItems, workItems, boardCards }
Session        { agents, tasks, messages, isActive, type: "team" | "solo" }
Agent          { name, role, status, model, currentTask, cwd, prompt }
TaskItem       { subject, status, activeForm, owner, blockedBy, blocks }
AttentionItem  { urgency: "blocking" | "waiting" | "informational", shortContext, source }
BoardCard      { title, stage: "backlog" | "in_progress" | "done", attention? }
```

## Project structure

```
server/
  index.ts              Entry point — Express, WebSocket, adapter orchestration
  types.ts              Shared type definitions
  attention-engine.ts   Classifies messages into urgency levels
  board-engine.ts       Derives kanban board cards from sessions
  workflow-scanner.ts   Discovers work items across sessions
  adapter-registry.ts   Manages adapter lifecycle
adapters/
  claude-code.ts        Reads ~/.claude/teams, tasks, todos
  types.ts              ToolAdapter interface
ui/
  App.tsx               Root layout, routing, WebSocket hook
  components/           SessionPanel, AttentionQueue, BoardView, ListView, etc.
  hooks/                useWebSocket, useSections
  styles/               CSS variables, dark theme
skills/                 Claude Code skill definitions
  dashboard-bootstrap/  Full setup skill (generates all files)
  dashboard-launch.md   Start/stop the server
specs/                  Design documents
```

## Tech stack

- **Server**: Express 5, ws, chokidar, tsx
- **UI**: React 19, Vite 6
- **Language**: TypeScript 5.7 (ESM)
- **Testing**: Vitest 3
