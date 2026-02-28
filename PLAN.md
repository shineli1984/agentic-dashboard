# Implementation Plan: Agentic Dashboard

> Spec: [SPEC.md](./SPEC.md)
> Design: [DESIGN.md](./DESIGN.md)

## Summary

Build an AI-native agentic dashboard distributed as a bootstrap skill. The agent generates the entire application on the user's machine -- infrastructure, adapters, UI, and runtime generation skills.

## Dependencies

```
+-----------------------------------------+
|  SLICE 1: FOUNDATION                    |
|                                         |
|  #1  TypeScript types & adapter iface   |
|  #2  Express + WebSocket server         |
|  #3  File watcher + adapter registry    |
+-----------------------------------------+
                  |
     +------------+------------+
     |                         |
     v                         v
+-----------------------+  +-----------------------+
|  SLICE 2: ADAPTERS    |  |  SLICE 3: UI SHELL    |
|  (parallel)           |  |  (parallel)           |
|                       |  |                       |
|  #4  Claude Code      |  |  #6  React shell +    |
|      adapter          |  |      WebSocket client |
|  #5  Cursor adapter   |  |  #7  RawDataFallback  |
+-----------+-----------+  +-----------+-----------+
            |                          |
            +------------+-------------+
                         |
                         v
+-----------------------------------------+
|  SLICE 4: CORE FEATURES                 |
|                                         |
|  #8   Attention engine (heuristics)     |
|    └── #9  AttentionQueue UI component  |
|  #10  Adaptive hierarchy logic          |
|    └── #11 HierarchyView UI component   |
+-----------------------------------------+
                  |
                  v
+-----------------------------------------+
|  SLICE 5: SKILLS                        |
|                                         |
|  #12  Bootstrap skill                   |
|  #13  Launch skill                      |
|  #14  Runtime generation skills         |
+-----------------------------------------+
                  |
                  v
+-----------------------------------------+
|  SLICE 6: INTEGRATION                   |
|                                         |
|  #15  End-to-end smoke test             |
+-----------------------------------------+

Legend: Blocked #N  Available #N  Parallel (side-by-side)
```

## Tasks

| # | Task | Est | Blocked By | Parallel With | Description |
|---|------|-----|------------|---------------|-------------|
| 1 | Define TypeScript types & adapter interface | 2 | -- | -- | Create shared types (DashboardState, Workspace, Session, Agent, TaskItem, Message, AttentionItem) and the ToolAdapter interface. Write to `types.ts` files. |
| 2 | Build Express + WebSocket server | 3 | 1 | -- | Express server that serves static files, manages WebSocket connections, and pushes state updates. Include health endpoint. |
| 3 | Build file watcher + adapter registry | 3 | 1 | 2 | Adapter registry that loads adapter modules, calls detect/scan/watch. Chokidar file watchers with debounce. Unknown file queue for unmatched paths. |
| 4 | Build Claude Code adapter | 3 | 1 | 5 | Parse `~/.claude/teams/*/config.json` (team + agents), `~/.claude/tasks/*/*.json` (tasks), `~/.claude/teams/*/inboxes/*.json` (messages), `~/.claude/todos/*.json` (solo sessions). Map to unified model. Include tests with fixture files. |
| 5 | Build Cursor adapter | 2 | 1 | 4 | Parse `~/.cursor/plans/*.plan.md` (YAML frontmatter + todos). Map to unified model. Include tests with fixture files. |
| 6 | Build React shell + WebSocket client | 3 | 2 | 7 | Vite + React setup. App.tsx with layout. useWebSocket hook with reconnect logic. State management (useState or zustand). Route structure. |
| 7 | Build RawDataFallback component | 1 | 1 | 6 | Generic component that renders any unknown data as a collapsible JSON tree. Used when no custom component exists for a data shape. |
| 8 | Build attention engine (heuristics) | 3 | 3, 4 | 10 | Server-side module that evaluates state changes against heuristic rules: unread messages needing response, unowned tasks, idle agents, question patterns. Outputs AttentionItem[]. Include tests. |
| 9 | Build AttentionQueue UI component | 2 | 6, 8 | 11 | Renders attention items sorted by urgency. Short context visible, click to expand full context. Shows action hints. Badge count. Auto-dismiss on resolve. |
| 10 | Build adaptive hierarchy logic | 3 | 3, 4 | 8 | Server-side module that builds the hierarchy tree from discovered state. Determines which layers exist (multi-workspace > workspace > team > agent). Handles dynamic layer appearance/disappearance. |
| 11 | Build HierarchyView UI component | 3 | 6, 10 | 9 | Renders adaptive hierarchy. Expandable layers. Agent cards, task lists, message threads within each layer. Summary placeholders (text for now, agent-generated later). |
| 12 | Write bootstrap skill | 5 | 4, 5, 6, 8, 10 | -- | The distributed product. Markdown skill file containing instructions for an agent to: scan the machine, generate all infrastructure code, generate adapters, generate runtime skills, install deps, run tests. Must encode the full codebase as generation instructions. |
| 13 | Write launch skill | 1 | 12 | 14 | Markdown skill file: start server, open browser, verify connection. Generated by bootstrap. |
| 14 | Write runtime generation skills | 3 | 12 | 13 | Three skill files: dashboard-gen-parser.md (generate parser for unknown file format), dashboard-gen-component.md (generate React component for new data shape), dashboard-gen-summary.md (generate natural language summary for hierarchy level). |
| 15 | End-to-end smoke test | 2 | 13, 14 | -- | Create sample fixture data mimicking Claude Code and Cursor state files. Bootstrap from scratch. Launch. Verify: state discovered, hierarchy renders, attention items surface, WebSocket updates work. |

**Total: 15 tasks, 39 points**

## Implementation Notes

### Task 1: Types & Adapter Interface

The adapter interface is the most important contract:

```typescript
interface ToolAdapter {
  name: string
  detect(): Promise<WorkspacePath[]>   // find active sessions on this machine
  scan(path: WorkspacePath): Promise<Session>  // read full state from a path
  watch(path: WorkspacePath, onChange: (session: Session) => void): Disposable
}

interface WorkspacePath {
  tool: string        // adapter name
  workspace: string   // workspace/project identifier
  path: string        // filesystem path to watch
}

interface Disposable {
  dispose(): void
}
```

### Task 4: Claude Code Adapter Detail

Key parsing logic:
- `config.json` members array → Agent[] with name, role (agentType), model, status
- Agent status inferred: if inbox has recent unread messages FROM this agent → "active"; if idle_notification in inbox → "idle"
- Task status comes directly from task JSON `status` field (string, not enum)
- Messages: filter out `idle_notification` JSON blobs, parse those separately for agent status
- `needsResponse` inference: message is unread AND content contains "?" or approval-like language AND no subsequent message from the user

### Task 5: Cursor Adapter Detail

Key parsing logic:
- YAML frontmatter parsed with a YAML parser (js-yaml)
- `todos` array maps to TaskItem[] with id, content→subject, status
- Plan name from frontmatter `name` field → Session.name
- `isProject` frontmatter field can inform hierarchy
- No agent-level data available -- single implicit agent per plan

### Task 12: Bootstrap Skill Complexity

This is the hardest task. The bootstrap skill must encode enough information for an agent to generate the entire codebase. Strategies:

1. **Template sections**: The skill contains the actual TypeScript code for fixed infrastructure, wrapped in code blocks that the agent copies verbatim.
2. **Generation instructions**: For adapters and skills, the bootstrap provides the adapter interface + sample data + instructions for the agent to generate code that parses the actual files it finds on the machine.
3. **Size management**: The skill will be large (likely 2000+ lines). This is acceptable because it's loaded once during bootstrap and never again. The generated skills are small.
