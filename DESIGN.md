# Design: Agentic Dashboard

## Architecture

> **Target Architecture** -- AI-native, skill-distributed application

```
                    Browser
                      |
        +-------------+-------------+
        |     React Shell (fixed)   |
        |  - Layout / routing       |
        |  - WebSocket client       |
        |  - Expand/collapse UI     |
        |  - Attention queue render |
        +-------------+-------------+
                      | WebSocket
        +-------------+-------------+
        |    Express Server (fixed)  |
        |  - Static file serving     |
        |  - WebSocket push          |
        |  - Hot-load generated code |
        +-------------+-------------+
                      |
        +-------------+-------------+
        |  State Discovery Engine    |
        |  - File watcher (chokidar) |
        |  - Adapter registry        |
        |  - Unknown file queue      |
        +-------------+-------------+
               |              |
          Generated       Generated
          Adapters        Adapters
               |              |
        ~/.claude/       ~/.cursor/
        teams/           plans/
        tasks/           projects/
        todos/           snapshots/
```

### Levels of Dynamism

| Level | What | When Generated | Examples |
|-------|------|---------------|----------|
| Fixed | Infrastructure code | Bootstrap (deterministic) | Express server, React shell, WebSocket, chokidar setup |
| Install-generated | Tool adapters, skills | Bootstrap (machine-aware) | Claude Code adapter, Cursor adapter, runtime skills |
| Runtime-generated | UI components, parsers, summaries | On demand by agent | Component for unknown data shape, parser for new file format |
| Always dynamic | Hierarchy, attention, summaries | Every render/state change | Which layers show, what needs attention, natural language summaries |

### Components

| Component | Location | Status | Responsibility |
|-----------|----------|--------|----------------|
| Bootstrap skill | Distributed `.md` file | NEW | Generates entire application on user machine |
| Launch skill | `{skills}/dashboard-launch.md` | NEW (generated) | Starts server, opens browser |
| Claude Code adapter skill | `{skills}/dashboard-adapter-claude.md` | NEW (generated) | Instructions for generating Claude Code parser |
| Cursor adapter skill | `{skills}/dashboard-adapter-cursor.md` | NEW (generated) | Instructions for generating Cursor parser |
| Parser generation skill | `{skills}/dashboard-gen-parser.md` | NEW (generated) | Runtime: generate parser for unknown file formats |
| Component generation skill | `{skills}/dashboard-gen-component.md` | NEW (generated) | Runtime: generate React component for new data shapes |
| Summary generation skill | `{skills}/dashboard-gen-summary.md` | NEW (generated) | Runtime: generate natural language summaries |
| Express server | `~/.agentic-dashboard/server/` | NEW (generated) | HTTP + WebSocket server, adapter registry, file watching |
| React shell | `~/.agentic-dashboard/ui/` | NEW (generated) | Layout, attention queue, hierarchy rendering, WebSocket client |
| Claude Code adapter | `~/.agentic-dashboard/adapters/claude-code.ts` | NEW (generated) | Parses ~/.claude/teams, tasks, todos |
| Cursor adapter | `~/.agentic-dashboard/adapters/cursor.ts` | NEW (generated) | Parses ~/.cursor/plans, projects |

---

## Data Model

### Discovered State (unified model)

The state discovery engine normalizes all tool-specific data into this shape. All fields except `id` are optional -- adapters output whatever they find.

```typescript
// Core types -- the dashboard's internal model
interface DashboardState {
  workspaces: Workspace[]
  attentionItems: AttentionItem[]
}

interface Workspace {
  id: string
  name: string              // e.g. repo name or project name
  path: string              // filesystem path
  tool: string              // "claude-code" | "cursor" | dynamically discovered
  sessions: Session[]
}

interface Session {
  id: string
  name: string              // team name or session identifier
  type: "team" | "solo" | string  // discovered, not hardcoded
  agents: Agent[]
  tasks: TaskItem[]
  messages: Message[]
  metadata: Record<string, unknown>  // anything else the adapter found
  lastActivity: number      // timestamp
}

interface Agent {
  id: string
  name: string
  role?: string             // "team-lead", "general-purpose", etc.
  status: string            // discovered from state, not enum
  model?: string
  currentTask?: string
  lastActivity: number
}

interface TaskItem {
  id: string
  subject: string
  status: string            // discovered string, not enum
  description?: string
  owner?: string
  blockedBy?: string[]
  blocks?: string[]
}

interface Message {
  id: string
  from: string
  to?: string               // undefined = broadcast
  content: string
  summary?: string
  timestamp: number
  read?: boolean
  needsResponse?: boolean   // inferred by attention engine
}

interface AttentionItem {
  id: string
  urgency: "blocking" | "waiting" | "informational"
  shortContext: string      // agent-generated summary
  fullContext: string       // agent-generated full detail
  actions: string[]         // what the user should do
  source: {
    tool: string
    workspace: string
    session: string
    agent?: string
    file: string            // which file triggered this
  }
  createdAt: number
  resolvedAt?: number
}
```

### Claude Code Adapter Mapping

```
~/.claude/teams/{name}/config.json
  → Session { type: "team", name: config.name }
  → Agent[] from config.members[]
     - name: member.name
     - role: member.agentType
     - model: member.model
     - status: inferred from activity

~/.claude/teams/{name}/inboxes/{agent}.json
  → Message[] from array entries
     - from: entry.from
     - content: entry.text
     - summary: entry.summary
     - timestamp: Date.parse(entry.timestamp)
     - read: entry.read
     - needsResponse: inferred (unread + not idle_notification)

~/.claude/tasks/{name}/{id}.json
  → TaskItem
     - id: task.id
     - subject: task.subject
     - status: task.status
     - description: task.description
     - owner: task.owner (if present)
     - blockedBy: task.blockedBy
     - blocks: task.blocks

~/.claude/todos/{session-id}.json
  → Session { type: "solo" } (solo agent, no team)
  → TaskItem[] from todo array entries
```

### Cursor Adapter Mapping

```
~/.cursor/plans/*.plan.md
  → Session { type: "plan", name: frontmatter.name }
  → TaskItem[] from frontmatter.todos[]
     - id: todo.id
     - subject: todo.content
     - status: todo.status

  Note: Cursor plans don't expose agent-level data.
  Session has a single implicit agent.
```

---

## Processing Flows

### Bootstrap Flow

```
User adds bootstrap.md to their skills directory
User: "set up the agentic dashboard"
  |
  v
Agent loads bootstrap skill
  |
  v
SCAN MACHINE
  |-- Check: does ~/.claude/ exist? → flag claude-code
  |-- Check: does ~/.cursor/ exist? → flag cursor
  |-- Read ~/.claude/teams/ structure → understand schema
  |-- Read ~/.cursor/plans/ structure → understand schema
  |-- Detect skills directory location
  |
  v
GENERATE FIXED INFRASTRUCTURE
  |-- mkdir ~/.agentic-dashboard/{server,ui,adapters,parsers,components}
  |-- Write server/index.ts (Express + WebSocket + chokidar)
  |-- Write server/adapter-registry.ts (loads adapters, manages watchers)
  |-- Write server/attention-engine.ts (evaluates attention items)
  |-- Write ui/index.html (entry point)
  |-- Write ui/App.tsx (React shell)
  |-- Write ui/components/AttentionQueue.tsx
  |-- Write ui/components/HierarchyView.tsx
  |-- Write ui/components/RawDataFallback.tsx
  |-- Write ui/hooks/useWebSocket.ts
  |-- Write package.json (express, ws, chokidar, react, typescript, vite)
  |-- Write tsconfig.json, vite.config.ts
  |
  v
GENERATE ADAPTERS (per detected tool)
  |-- If claude-code: write adapters/claude-code.ts
  |-- If cursor: write adapters/cursor.ts
  |
  v
GENERATE SKILLS
  |-- Write dashboard-launch.md
  |-- Write dashboard-adapter-claude.md (if claude-code detected)
  |-- Write dashboard-adapter-cursor.md (if cursor detected)
  |-- Write dashboard-gen-parser.md
  |-- Write dashboard-gen-component.md
  |-- Write dashboard-gen-summary.md
  |
  v
INSTALL DEPENDENCIES
  |-- cd ~/.agentic-dashboard && npm install
  |
  v
GENERATE TESTS
  |-- Write server/__tests__/adapter-registry.test.ts
  |-- Write server/__tests__/attention-engine.test.ts
  |-- Write adapters/__tests__/claude-code.test.ts
  |-- Write adapters/__tests__/cursor.test.ts (if applicable)
  |
  v
RUN TESTS
  |-- npm test → verify everything works
  |
  v
DONE: "Dashboard installed. Say 'open the dashboard' to launch."
```

### Launch Flow

```
User: "open the dashboard"
  |
  v
Agent loads dashboard-launch.md
  |
  v
cd ~/.agentic-dashboard
npm run dev (or ts-node server/index.ts)
  |
  v
Server starts on localhost:{port}
  |-- Loads all adapters from adapters/
  |-- Each adapter calls detect() → finds active sessions
  |-- Starts file watchers via chokidar
  |-- Serves React shell from ui/
  |
  v
Opens browser to localhost:{port}
  |
  v
React shell connects via WebSocket
  |-- Receives initial state snapshot
  |-- Renders hierarchy based on what's running
  |-- Renders attention queue
  |
  v
RUNTIME LOOP:
  File change detected by chokidar
    → Adapter re-scans affected path
    → New state pushed via WebSocket
    → If unknown file: queued for agent (if available)
    → UI updates in real-time
```

### Unknown File Discovery Flow

```
chokidar detects new/changed file
  |
  v
Does any adapter claim this path?
  |-- YES → adapter.scan(path) → state update → WebSocket push
  |-- NO ↓
  |
  v
Is file in exclusion list?
  |-- YES → ignore
  |-- NO ↓
  |
  v
Is an agent available?
  |-- NO → queue file, show in UI as "unprocessed"
  |-- YES ↓
  |
  v
Agent loads dashboard-gen-parser.md
  |-- Agent reads the unknown file
  |-- Agent decides: is this relevant state?
  |    |-- NO → add to exclusion list, done
  |    |-- YES ↓
  |
  v
Agent generates parser
  |-- Writes to ~/.agentic-dashboard/parsers/{name}.ts
  |-- Server hot-loads the new parser
  |-- Parser runs on the file → state update
  |
  v
Does the data need a custom UI component?
  |-- NO → render with RawDataFallback
  |-- YES → agent loads dashboard-gen-component.md
  |          → writes to ~/.agentic-dashboard/components/{name}.tsx
  |          → server notifies UI to load new component
```

### Attention Evaluation Flow

```
State change received (from adapter or parser)
  |
  v
Is an agent available?
  |-- YES → agent evaluates with dashboard-gen-summary.md
  |-- NO  → heuristic fallback ↓
  |
  v
HEURISTIC FALLBACK (no agent):
  |-- Unread messages where needsResponse=true → "waiting"
  |-- Tasks with no owner and no blocker → "informational"
  |-- Agents idle for > 60s after sending message → "waiting"
  |-- Messages containing "?" not followed by response → "waiting"
  |
  v
AGENT EVALUATION (agent available):
  |-- Agent reads raw state change
  |-- Agent generates: urgency, shortContext, fullContext, actions
  |-- Returns AttentionItem
  |
  v
Add to attention queue → WebSocket push → UI renders
  |
  v
STALE CHECK (periodic):
  |-- Re-read source file for each open attention item
  |-- If underlying state changed → mark resolved → dismiss from UI
```

---

## Key Decisions

1. **Skill-distributed, not packaged** -- The bootstrap skill IS the product. This means no versioning system, no update mechanism beyond replacing the skill file. Acceptable for v1; revisit if adoption grows.

2. **Generated code is disposable** -- Everything in `~/.agentic-dashboard/` can be deleted and regenerated. This simplifies updates but means the agent must be available to regenerate.

3. **Heuristic fallback for attention** -- When no agent is available, the attention queue still works via pattern matching (unread messages, idle agents, questions). Quality is lower but functional.

4. **Adapter interface is the extension point** -- Adding a new tool = writing a new adapter. The adapter interface is simple enough that an agent can generate one from a skill's instructions.

5. **No database** -- All state is derived from filesystem reads. The dashboard holds state in memory (server-side) and pushes to the client. Restart = re-scan.

6. **Cursor adapter is thinner** -- Cursor doesn't expose agent-level data or inter-agent messages. The adapter will surface plans and todos but not real-time agent activity. This is a tool limitation, not a dashboard limitation.

---

## File Structure

After bootstrap completes:

```
~/.agentic-dashboard/
  ├── package.json
  ├── tsconfig.json
  ├── vite.config.ts
  ├── server/
  │   ├── index.ts                 # Express + WebSocket entry point
  │   ├── adapter-registry.ts      # Loads adapters, manages watchers
  │   ├── attention-engine.ts      # Heuristic + agent-powered attention
  │   ├── types.ts                 # Shared TypeScript types
  │   └── __tests__/
  │       ├── adapter-registry.test.ts
  │       └── attention-engine.test.ts
  ├── adapters/
  │   ├── claude-code.ts           # Claude Code filesystem adapter
  │   ├── cursor.ts                # Cursor filesystem adapter
  │   ├── types.ts                 # ToolAdapter interface
  │   └── __tests__/
  │       ├── claude-code.test.ts
  │       └── cursor.test.ts
  ├── parsers/                     # Runtime-generated parsers (initially empty)
  ├── components/                  # Runtime-generated React components (initially empty)
  └── ui/
      ├── index.html
      ├── App.tsx
      ├── components/
      │   ├── AttentionQueue.tsx    # Attention items with expand/collapse
      │   ├── HierarchyView.tsx    # Adaptive summary hierarchy
      │   ├── SessionPanel.tsx     # Single session detail view
      │   ├── AgentCard.tsx        # Agent status card
      │   ├── TaskList.tsx         # Task board within a session
      │   ├── MessageThread.tsx    # Agent communication view
      │   └── RawDataFallback.tsx  # Fallback for data without custom component
      ├── hooks/
      │   └── useWebSocket.ts      # WebSocket connection + reconnect
      └── styles/
          └── globals.css

{skills-dir}/
  ├── dashboard-bootstrap.md       # The distributed product (input)
  ├── dashboard-launch.md          # Generated: starts server
  ├── dashboard-adapter-claude.md  # Generated: Claude Code adapter knowledge
  ├── dashboard-adapter-cursor.md  # Generated: Cursor adapter knowledge
  ├── dashboard-gen-parser.md      # Generated: runtime parser generation
  ├── dashboard-gen-component.md   # Generated: runtime component generation
  └── dashboard-gen-summary.md     # Generated: runtime summary generation
```

---

## Testing Strategy

### Fixed Infrastructure (traditional tests)

- **adapter-registry.test.ts**: adapter loading, watcher setup, hot-reload of new parsers
- **attention-engine.test.ts**: heuristic rules fire correctly, stale item detection works
- **claude-code.test.ts**: parses sample team config, tasks, messages, todos correctly
- **cursor.test.ts**: parses sample plan files with YAML frontmatter correctly

### Agent-Generated Code (generated tests at generation time)

- Bootstrap instructs agent to write tests for every generated adapter
- Runtime parser generation skill instructs agent to test parser against the source file
- Component generation not tested (visual -- manual verification)

### Smoke Test

- Launch skill includes a verification step: start server, connect WebSocket, verify initial state loads, shut down

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Bootstrap skill too large for context window | Medium | Keep bootstrap focused on infrastructure. Adapter details in separate generated skills. |
| Claude Code changes file format between versions | Low | Adapters are regenerated on bootstrap. Re-run bootstrap after Claude Code updates. |
| Cursor has no useful state files | Medium | Cursor adapter is best-effort. Dashboard value comes primarily from Claude Code initially. |
| Agent unavailable for runtime generation | Medium | Heuristic fallback for attention queue. RawDataFallback component for unknown data. |
| Hot-loading generated code is unreliable | Medium | Use dynamic import() for parsers. For components, use React.lazy with error boundaries. |
| Multiple agents writing to same state files simultaneously | Low | File watchers debounce. Adapters read full file on each change (no partial reads). |

---

## Future Scope (Next Slice)

### F1: Act from Dashboard

**Current State:** Dashboard is read-only. Shows what needs attention and where to act.
**Proposed Change:** Add action buttons (approve, respond, reassign) that write back to agent state files.
**Benefits:** Single pane of glass for both visibility and action.
**Trade-offs:** Breaks read-only principle. Need to handle concurrent writes with agents.
**Decision:** Deferred. Revisit after v1 validates the visibility model.

### F2: Open State Format Specification

**Current State:** Each tool has its own file format. Adapters translate per-tool.
**Proposed Change:** Define an open spec for agentic state that any tool could adopt.
**Benefits:** New tools would work out of the box without adapters.
**Trade-offs:** Getting tool authors to adopt a standard is hard. Premature standardization.
**Decision:** Deferred. Revisit if 3+ tools are supported.

### F3: Cloud/Hosted Version

**Current State:** Local-only, single user.
**Proposed Change:** Hosted version with team visibility across multiple developers.
**Benefits:** Team-wide visibility without everyone running local dashboards.
**Trade-offs:** Requires auth, data sync, hosting infrastructure.
**Decision:** Deferred. Validate local-first model first.
