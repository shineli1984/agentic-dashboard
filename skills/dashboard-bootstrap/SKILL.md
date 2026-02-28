---
name: dashboard-bootstrap
description: Set up the Agentic Dashboard. Generates a real-time visibility dashboard for agentic coding sessions on the user's machine. Trigger with "set up the agentic dashboard".
---

# Agentic Dashboard Bootstrap

You are setting up a real-time visibility dashboard for agentic coding sessions. This skill contains everything you need to generate the entire application. There is no npm package or CLI -- you ARE the installer.

**What the dashboard does:**
- Observes running agents across Claude Code and Cursor (read-only, zero instrumentation)
- Surfaces only items where agents are blocked and need human action
- Active session detection via process checks and lockfiles
- Workflow inference scanning project configs at startup to produce work items
- Active/All filter tabs for non-attention sections
- Side menu navigation with sections (Attention, Teams, Plans, Solo Sessions) based on detected tools
- List-then-detail drill-down pattern
- Dark theme, local-only, TypeScript + React

---

## Step 1: Scan the Machine

Detect which agentic tools are installed:

```bash
ls ~/.claude/teams/ 2>/dev/null && echo "CLAUDE_TEAMS=true" || echo "CLAUDE_TEAMS=false"
ls ~/.claude/tasks/ 2>/dev/null && echo "CLAUDE_TASKS=true" || echo "CLAUDE_TASKS=false"
ls ~/.claude/todos/ 2>/dev/null && echo "CLAUDE_TODOS=true" || echo "CLAUDE_TODOS=false"
ls ~/.cursor/plans/ 2>/dev/null && echo "CURSOR_PLANS=true" || echo "CURSOR_PLANS=false"
```

Report what you found.

## Step 2: Choose Install Location

Ask the user:
> Where should I install the dashboard?
> A) `~/.agentic-dashboard/` (recommended)
> B) Custom path

Set `INSTALL_DIR` to the chosen path.

## Step 3: Create Directory Structure

```bash
mkdir -p {INSTALL_DIR}/{server,adapters,ui/{components,hooks,styles}}
```

## Step 4: Generate All Files

Write every file below using the Write tool. Copy code blocks **exactly**.

---

### FILE: {INSTALL_DIR}/package.json

```json
{
  "name": "agentic-dashboard",
  "version": "0.3.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently \"tsx watch server/index.ts\" \"vite\"",
    "dev:server": "tsx watch server/index.ts",
    "dev:ui": "vite",
    "build": "tsc && vite build",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "chokidar": "^4.0.0",
    "express": "^5.0.0",
    "js-yaml": "^4.1.0",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/ws": "^8.5.0",
    "@vitejs/plugin-react": "^4.0.0",
    "concurrently": "^9.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

---

### FILE: {INSTALL_DIR}/tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "jsx": "react-jsx",
    "declaration": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["server/**/*.ts", "adapters/**/*.ts", "ui/**/*.ts", "ui/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

---

### FILE: {INSTALL_DIR}/vite.config.ts

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "ui",
  build: {
    outDir: "../dist-ui",
    emptyOutDir: true,
  },
  server: {
    port: 4201,
    proxy: {
      "/api": "http://localhost:4200",
      "/ws": {
        target: "ws://localhost:4200",
        ws: true,
      },
    },
  },
});
```

---

### FILE: {INSTALL_DIR}/server/types.ts

```typescript
export interface DashboardState {
  workspaces: Workspace[];
  attentionItems: AttentionItem[];
  workItems: WorkItem[];
  boardCards: BoardCard[];
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  tool: string;
  sessions: Session[];
}

export interface Session {
  id: string;
  name: string;
  type: string;
  agents: Agent[];
  tasks: TaskItem[];
  messages: Message[];
  metadata: Record<string, unknown>;
  lastActivity: number;
  isActive: boolean;
}

export interface Agent {
  id: string;
  name: string;
  role?: string;
  status: string;
  model?: string;
  currentTask?: string;
  lastActivity: number;
}

export interface TaskItem {
  id: string;
  subject: string;
  status: string;
  description?: string;
  owner?: string;
  blockedBy?: string[];
  blocks?: string[];
}

export interface Message {
  id: string;
  from: string;
  to?: string;
  content: string;
  summary?: string;
  timestamp: number;
  read?: boolean;
  needsResponse?: boolean;
}

export type AttentionUrgency = "blocking" | "waiting" | "informational";

export interface AttentionItem {
  id: string;
  urgency: AttentionUrgency;
  shortContext: string;
  fullContext: string;
  actions: string[];
  source: AttentionSource;
  createdAt: number;
  resolvedAt?: number;
}

export interface AttentionSource {
  tool: string;
  workspace: string;
  session: string;
  agent?: string;
  file: string;
}

export type WorkItemStatus = "planned" | "in_progress" | "done" | "blocked";

export interface WorkItem {
  id: string;
  name: string;
  status: WorkItemStatus;
  source: string;
  sessionId: string;
  lastActivity: number;
}

export type BoardStage = "backlog" | "in_progress" | "done";

export interface BoardCard {
  id: string;
  title: string;
  stage: BoardStage;
  sessionId: string;
  taskSummary: string;
  attention?: {
    urgency: AttentionUrgency;
    preview: string;
  };
  stageEnteredAt: number;
  lastActivity: number;
}

export type WsMessage =
  | { type: "state"; data: DashboardState }
  | { type: "update"; data: Partial<DashboardState> }
  | { type: "attention"; data: AttentionItem }
  | { type: "attention_resolved"; data: { id: string } };
```

---

### FILE: {INSTALL_DIR}/adapters/types.ts

```typescript
import type { Session } from "../server/types.js";

export interface WorkspacePath {
  tool: string;
  workspace: string;
  path: string;
}

export interface Disposable {
  dispose(): void;
}

export interface ToolAdapter {
  name: string;
  detect(): Promise<WorkspacePath[]>;
  scan(workspacePath: WorkspacePath): Promise<Session>;
  watch(
    workspacePath: WorkspacePath,
    onChange: (session: Session) => void,
  ): Disposable;
  watchForNew?(
    onAdded: (wp: WorkspacePath) => void,
    onRemoved: (wp: WorkspacePath) => void,
  ): Disposable;
}
```

---

### FILE: {INSTALL_DIR}/server/adapter-registry.ts

```typescript
import type { ToolAdapter, WorkspacePath } from "../adapters/types.js";
import type { Session, Workspace } from "./types.js";

type StateChangeCallback = (state: { workspaces: Workspace[] }) => void;

export class AdapterRegistry {
  private adapters: ToolAdapter[] = [];
  private workspaces = new Map<string, Workspace>();
  private listeners: StateChangeCallback[] = [];
  private disposables: Array<{ dispose(): void }> = [];
  private watchedPaths = new Set<string>();

  registerAdapter(adapter: ToolAdapter): void {
    this.adapters.push(adapter);
  }

  onStateChange(callback: StateChangeCallback): void {
    this.listeners.push(callback);
  }

  async initialize(): Promise<void> {
    for (const adapter of this.adapters) {
      const paths = await adapter.detect();
      for (const wp of paths) {
        await this.onboardWorkspace(adapter, wp);
      }

      if (adapter.watchForNew) {
        const disposable = adapter.watchForNew(
          (wp) => {
            this.onboardWorkspace(adapter, wp).then(() => this.notifyListeners());
          },
          (wp) => {
            this.removeWorkspace(adapter.name, wp);
            this.notifyListeners();
          },
        );
        this.disposables.push(disposable);
      }
    }
    this.notifyListeners();
  }

  private async onboardWorkspace(adapter: ToolAdapter, wp: WorkspacePath): Promise<void> {
    const key = `${adapter.name}:${wp.workspace}`;
    if (this.watchedPaths.has(key)) return;
    this.watchedPaths.add(key);

    const session = await adapter.scan(wp);
    this.upsertSession(adapter.name, wp, session);
    const disposable = adapter.watch(wp, (updatedSession) => {
      this.upsertSession(adapter.name, wp, updatedSession);
      this.notifyListeners();
    });
    this.disposables.push(disposable);
  }

  private removeWorkspace(tool: string, wp: WorkspacePath): void {
    const workspaceId = `${tool}:${wp.workspace}`;
    this.workspaces.delete(workspaceId);
    this.watchedPaths.delete(workspaceId);
  }

  private upsertSession(tool: string, wp: WorkspacePath, session: Session): void {
    const workspaceId = `${tool}:${wp.workspace}`;
    let workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      workspace = { id: workspaceId, name: wp.workspace, path: wp.path, tool, sessions: [] };
      this.workspaces.set(workspaceId, workspace);
    }
    const idx = workspace.sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      workspace.sessions[idx] = session;
    } else {
      workspace.sessions.push(session);
    }
  }

  private notifyListeners(): void {
    const state = { workspaces: Array.from(this.workspaces.values()) };
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  dispose(): void {
    for (const d of this.disposables) { d.dispose(); }
    this.disposables = [];
  }
}
```

---

### FILE: {INSTALL_DIR}/server/attention-engine.ts

```typescript
import type {
  AttentionItem,
  AttentionUrgency,
  DashboardState,
  Message,
  Session,
} from "./types.js";

let idCounter = 0;
function nextId(): string {
  return `attn-${++idCounter}-${Date.now()}`;
}

export class AttentionEngine {
  private knownItems = new Map<string, AttentionItem>();

  evaluate(state: DashboardState): AttentionItem[] {
    const items: AttentionItem[] = [];
    for (const workspace of state.workspaces) {
      for (const session of workspace.sessions) {
        items.push(...this.checkMessages(session, workspace.tool, workspace.name));
      }
    }
    this.resolveStaleItems(items);
    return items;
  }

  private checkMessages(session: Session, tool: string, workspace: string): AttentionItem[] {
    const items: AttentionItem[] = [];
    for (const msg of session.messages) {
      if (!msg.needsResponse) continue;
      const key = `msg-${msg.id}`;
      if (this.knownItems.has(key)) { items.push(this.knownItems.get(key)!); continue; }
      const item: AttentionItem = {
        id: nextId(),
        urgency: this.inferMessageUrgency(msg),
        shortContext: msg.summary ?? `${msg.from}: message needs your response`,
        fullContext: msg.content,
        actions: [],
        source: { tool, workspace, session: session.id, agent: msg.from, file: "" },
        createdAt: msg.timestamp,
      };
      this.knownItems.set(key, item);
      items.push(item);
    }
    return items;
  }

  private inferMessageUrgency(msg: Message): AttentionUrgency {
    const text = msg.content.toLowerCase();
    if (/\b(blocked|blocking|cannot proceed)\b/.test(text)) return "blocking";
    if (/\b(waiting|approve|confirm|review)\b/.test(text)) return "waiting";
    return "informational";
  }

  private resolveStaleItems(currentItems: AttentionItem[]): void {
    const currentIds = new Set(currentItems.map((i) => i.id));
    for (const [key, item] of this.knownItems) {
      if (!currentIds.has(item.id)) this.knownItems.delete(key);
    }
  }
}
```

---

### FILE: {INSTALL_DIR}/server/board-engine.ts

```typescript
import { execSync } from "node:child_process";
import type {
  AttentionItem,
  AttentionUrgency,
  BoardCard,
  BoardStage,
  DashboardState,
  Session,
} from "./types.js";

interface SessionEpoch {
  sessionId: string;
  epoch: number;
  cardId: string;
  stageEnteredAt: number;
  lastKnownStage: BoardStage;
  title: string;
  completedAt?: number;
  messageCountAtCompletion?: number;
  taskCountAtCompletion?: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-|^[a-z]+-[a-z0-9]{6,}$/i;

const URGENCY_ORDER: Record<AttentionUrgency, number> = {
  blocking: 0,
  waiting: 1,
  informational: 2,
};

export class BoardEngine {
  private epochs = new Map<string, SessionEpoch[]>();
  private dismissed = new Set<string>();
  private titleCache = new Map<string, string>();

  evaluate(state: DashboardState): BoardCard[] {
    const cards: BoardCard[] = [];
    const seenSessionIds = new Set<string>();

    for (const workspace of state.workspaces) {
      for (const session of workspace.sessions) {
        seenSessionIds.add(session.id);
        const sessionEpochs = this.resolveEpochs(session);

        for (const epoch of sessionEpochs) {
          if (this.dismissed.has(epoch.cardId)) continue;

          const stage = epoch.completedAt && epoch !== sessionEpochs[sessionEpochs.length - 1]
            ? "done" as BoardStage
            : this.deriveStage(session);

          // Update epoch tracking
          if (epoch === sessionEpochs[sessionEpochs.length - 1]) {
            if (stage !== epoch.lastKnownStage) {
              epoch.stageEnteredAt = Date.now();
              epoch.lastKnownStage = stage;
              if (stage === "done") {
                epoch.completedAt = Date.now();
                epoch.messageCountAtCompletion = session.messages.length;
                epoch.taskCountAtCompletion = session.tasks.length;
              }
            }
          }

          const title = this.deriveTitle(session, epoch);
          epoch.title = title;

          const attention = this.deriveAttention(session, state.attentionItems);
          const taskSummary = this.buildTaskSummary(session);

          cards.push({
            id: epoch.cardId,
            title,
            stage: epoch === sessionEpochs[sessionEpochs.length - 1] ? stage : "done",
            sessionId: session.id,
            taskSummary,
            attention,
            stageEnteredAt: epoch.stageEnteredAt,
            lastActivity: session.lastActivity,
          });
        }
      }
    }

    return cards;
  }

  dismiss(cardId: string): boolean {
    for (const epochList of this.epochs.values()) {
      for (const epoch of epochList) {
        if (epoch.cardId === cardId) {
          if (epoch.lastKnownStage === "done" || epoch.completedAt) {
            this.dismissed.add(cardId);
            return true;
          }
          return false;
        }
      }
    }
    return false;
  }

  private resolveEpochs(session: Session): SessionEpoch[] {
    let epochList = this.epochs.get(session.id);

    if (!epochList) {
      const epoch: SessionEpoch = {
        sessionId: session.id,
        epoch: 0,
        cardId: `${session.id}-epoch-0`,
        stageEnteredAt: Date.now(),
        lastKnownStage: this.deriveStage(session),
        title: "",
      };
      epochList = [epoch];
      this.epochs.set(session.id, epochList);
      return epochList;
    }

    const currentEpoch = epochList[epochList.length - 1];

    if (currentEpoch.completedAt) {
      const hasNewTasks = session.tasks.length > (currentEpoch.taskCountAtCompletion ?? 0)
        && session.tasks.some((t) => t.status === "pending" || t.status === "in_progress");
      const hasNewMessages = session.messages.length > (currentEpoch.messageCountAtCompletion ?? 0);

      if (hasNewTasks || hasNewMessages) {
        const newEpochNum = currentEpoch.epoch + 1;
        const newEpoch: SessionEpoch = {
          sessionId: session.id,
          epoch: newEpochNum,
          cardId: `${session.id}-epoch-${newEpochNum}`,
          stageEnteredAt: Date.now(),
          lastKnownStage: this.deriveStage(session),
          title: "",
        };
        epochList.push(newEpoch);
      }
    }

    return epochList;
  }

  private deriveStage(session: Session): BoardStage {
    const tasks = session.tasks;
    const messages = session.messages;

    if (tasks.length === 0 && messages.length === 0) return "backlog";
    if (tasks.length === 0 && messages.length > 0) return "in_progress";
    if (session.isActive) return "in_progress";

    const allCompleted = tasks.length > 0 && tasks.every((t) => t.status === "completed");
    if (allCompleted) return "done";

    const anyInProgress = tasks.some((t) => t.status === "in_progress");
    if (anyInProgress) return "in_progress";

    const allPending = tasks.every((t) => t.status === "pending");
    if (allPending) return "backlog";

    return "in_progress";
  }

  private deriveTitle(session: Session, epoch: SessionEpoch): string {
    if (epoch.title) return epoch.title;

    if (typeof session.metadata?.description === "string" && session.metadata.description) {
      return session.metadata.description;
    }

    if (session.name && !UUID_PATTERN.test(session.name)) {
      return session.name;
    }

    if (session.tasks.length > 0) {
      return session.tasks[0].subject;
    }

    if (session.messages.length > 0) {
      const msg = session.messages[0];
      const text = msg.summary ?? msg.content;
      return text.length > 50 ? text.slice(0, 47) + "..." : text;
    }

    return this.deriveTitleWithCLI(session, epoch);
  }

  private deriveTitleWithCLI(session: Session, epoch: SessionEpoch): string {
    if (this.titleCache.has(epoch.cardId)) return this.titleCache.get(epoch.cardId)!;

    const msgs = session.messages.slice(0, 3).map((m) => m.summary ?? m.content.slice(0, 100));
    if (msgs.length === 0) return session.name;

    try {
      const prompt = `Summarize this work session in 5 words or fewer: ${msgs.join(" | ")}`;
      const result = execSync(`claude --print -p "${prompt.replace(/"/g, '\\"')}"`, {
        timeout: 10_000,
        encoding: "utf-8",
      }).trim();
      if (result) {
        this.titleCache.set(epoch.cardId, result);
        return result;
      }
    } catch {
      // CLI not available or timed out
    }
    return session.name;
  }

  private deriveAttention(
    session: Session,
    attentionItems: AttentionItem[],
  ): BoardCard["attention"] | undefined {
    const sessionAttention = attentionItems.filter(
      (item) => item.source.session === session.id,
    );

    const needsResponseMsgs = session.messages.filter((m) => m.needsResponse);

    if (sessionAttention.length === 0 && needsResponseMsgs.length === 0) return undefined;

    let urgency: AttentionUrgency = "informational";
    let preview = "";

    if (sessionAttention.length > 0) {
      sessionAttention.sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]);
      urgency = sessionAttention[0].urgency;
      if (sessionAttention.length === 1) {
        preview = sessionAttention[0].shortContext;
      } else {
        preview = `${sessionAttention.length} items need attention`;
      }
    } else if (needsResponseMsgs.length > 0) {
      urgency = "waiting";
      if (needsResponseMsgs.length === 1) {
        const msg = needsResponseMsgs[0];
        preview = msg.summary ?? `${msg.from}: needs response`;
      } else {
        preview = `${needsResponseMsgs.length} messages need response`;
      }
    }

    return { urgency, preview };
  }

  private buildTaskSummary(session: Session): string {
    if (session.tasks.length === 0) return "no tasks";
    const completed = session.tasks.filter((t) => t.status === "completed").length;
    return `${completed}/${session.tasks.length} tasks done`;
  }
}
```

---

### FILE: {INSTALL_DIR}/server/workflow-scanner.ts

```typescript
import fs from "node:fs/promises";
import path from "node:path";
import type { Workspace, WorkItem, WorkItemStatus } from "./types.js";

const TICKET_PATTERN = /\b([A-Z]+-\d+)\b/;
const PLAN_GLOBS = ["PLAN*.md", "SPEC*.md", "DESIGN*.md"];

interface ScanContext {
  cwd: string;
  workspaceId: string;
  sessionId: string;
}

async function fileExists(filePath: string): Promise<boolean> {
  try { await fs.access(filePath); return true; }
  catch { return false; }
}

async function listDir(dirPath: string): Promise<string[]> {
  try { return await fs.readdir(dirPath); }
  catch { return []; }
}

async function readFileSafe(filePath: string): Promise<string | null> {
  try { return await fs.readFile(filePath, "utf-8"); }
  catch { return null; }
}

function inferStatus(tasks: Array<{ status: string; blockedBy?: string[] }>): WorkItemStatus {
  if (tasks.length === 0) return "planned";
  const hasBlocked = tasks.some((t) => t.blockedBy && t.blockedBy.length > 0 && t.status !== "completed");
  if (hasBlocked) return "blocked";
  const allDone = tasks.every((t) => t.status === "completed");
  if (allDone) return "done";
  const anyInProgress = tasks.some((t) => t.status === "in_progress");
  if (anyInProgress) return "in_progress";
  return "planned";
}

function extractTicketId(text: string): string | null {
  const match = TICKET_PATTERN.exec(text);
  return match ? match[1] : null;
}

// Scan task files already loaded in sessions — derive work items from task subjects
function workItemsFromTasks(workspace: Workspace): WorkItem[] {
  const items: WorkItem[] = [];
  for (const session of workspace.sessions) {
    if (session.tasks.length === 0) continue;

    // Group tasks by ticket ID if present, otherwise each task is its own work item
    const ticketGroups = new Map<string, typeof session.tasks>();
    const ungrouped: typeof session.tasks = [];

    for (const task of session.tasks) {
      if (!task.subject) continue;
      const ticketId = extractTicketId(task.subject);
      if (ticketId) {
        const group = ticketGroups.get(ticketId) ?? [];
        group.push(task);
        ticketGroups.set(ticketId, group);
      } else {
        ungrouped.push(task);
      }
    }

    // Create work items from ticket groups
    for (const [ticketId, tasks] of ticketGroups) {
      const primaryTask = tasks[0];
      const lastActivity = session.lastActivity;
      items.push({
        id: `wi-task-${ticketId}-${session.id}`,
        name: `${ticketId}: ${primaryTask.subject.replace(TICKET_PATTERN, "").trim() || primaryTask.subject}`,
        status: inferStatus(tasks),
        source: "task",
        sessionId: session.id,
        lastActivity,
      });
    }

    // Each ungrouped task becomes its own work item
    for (const task of ungrouped) {
      items.push({
        id: `wi-task-${task.id}-${session.id}`,
        name: task.subject,
        status: inferStatus([task]),
        source: "task",
        sessionId: session.id,
        lastActivity: session.lastActivity,
      });
    }
  }
  return items;
}

// Scan plan/spec/design files in a project cwd
async function workItemsFromPlanFiles(ctx: ScanContext): Promise<WorkItem[]> {
  const items: WorkItem[] = [];
  const docsPlansDir = path.join(ctx.cwd, "docs", "plans");

  // Check root-level plan files
  const rootFiles = await listDir(ctx.cwd);
  const planFiles = rootFiles.filter((f) => PLAN_GLOBS.some((g) => {
    const pattern = g.replace("*", "");
    return f.toUpperCase().startsWith(pattern.replace(".md", "").replace("*", "")) && f.endsWith(".md");
  }));

  // Check docs/plans/ directory
  const docsPlanFiles = (await listDir(docsPlansDir)).filter((f) => f.endsWith(".md"));

  const allPlanFiles = [
    ...planFiles.map((f) => path.join(ctx.cwd, f)),
    ...docsPlanFiles.map((f) => path.join(docsPlansDir, f)),
  ];

  for (const filePath of allPlanFiles) {
    const content = await readFileSafe(filePath);
    if (!content) continue;
    const fileName = path.basename(filePath, ".md");
    const stat = await fs.stat(filePath);

    // Extract heading as work item name
    const headingMatch = content.match(/^#\s+(.+)$/m);
    const name = headingMatch ? headingMatch[1].trim() : fileName;

    // Try to infer status from content
    let status: WorkItemStatus = "planned";
    if (/\ball\s+tasks?\s+(completed|done)\b/i.test(content)) status = "done";
    else if (/\bin progress\b/i.test(content)) status = "in_progress";

    items.push({
      id: `wi-plan-${fileName}-${ctx.sessionId}`,
      name,
      status,
      source: "plan",
      sessionId: ctx.sessionId,
      lastActivity: stat.mtimeMs,
    });
  }

  return items;
}

// Scan CLAUDE.md and skills/agents for workflow hints
async function workItemsFromProjectConfig(ctx: ScanContext): Promise<WorkItem[]> {
  const items: WorkItem[] = [];

  // Read CLAUDE.md for project-level context
  const claudeMd = await readFileSafe(path.join(ctx.cwd, "CLAUDE.md"));
  if (claudeMd) {
    // Extract any task-like items from CLAUDE.md (e.g., "## Current Work" sections)
    const currentWorkMatch = claudeMd.match(/##\s+(Current Work|In Progress|TODO)[^\n]*\n([\s\S]*?)(?=\n##|\n$)/i);
    if (currentWorkMatch) {
      const section = currentWorkMatch[2];
      const bulletItems = section.match(/^[-*]\s+(.+)$/gm);
      if (bulletItems) {
        for (const bullet of bulletItems) {
          const text = bullet.replace(/^[-*]\s+/, "").trim();
          if (text.length > 5) {
            items.push({
              id: `wi-claude-${Buffer.from(text).toString("base64").slice(0, 12)}-${ctx.sessionId}`,
              name: text,
              status: "in_progress",
              source: "spec",
              sessionId: ctx.sessionId,
              lastActivity: Date.now(),
            });
          }
        }
      }
    }
  }

  // Check for MCP configs indicating external tracker
  const settingsPath = path.join(ctx.cwd, ".claude", "settings.json");
  const settings = await readFileSafe(settingsPath);
  if (settings) {
    try {
      const parsed = JSON.parse(settings);
      const mcpServers = parsed?.mcpServers ?? {};
      for (const serverName of Object.keys(mcpServers)) {
        if (/linear|jira|github/i.test(serverName)) {
          // Note: we don't pull from these, just flag that external tracking exists
          // This could be expanded in the future
        }
      }
    } catch { /* ignore parse errors */ }
  }

  return items;
}

// Deduplicate work items by name similarity
function deduplicateItems(items: WorkItem[]): WorkItem[] {
  const seen = new Map<string, WorkItem>();
  for (const item of items) {
    // Normalize name for dedup: lowercase, strip ticket IDs, trim
    const key = (item.name ?? "").toLowerCase().replace(TICKET_PATTERN, "").trim();
    if (!key) continue;
    const existing = seen.get(key);
    if (!existing || item.lastActivity > existing.lastActivity) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}

export class WorkflowScanner {
  async scan(workspaces: Workspace[]): Promise<WorkItem[]> {
    const allItems: WorkItem[] = [];

    for (const workspace of workspaces) {
      // Phase 1: Work items from task data (already loaded)
      allItems.push(...workItemsFromTasks(workspace));

      // Phase 2: Scan project directories for plan files and config
      const cwds = new Set<string>();
      for (const session of workspace.sessions) {
        // Extract cwds from agent metadata
        const members = (session.metadata as Record<string, unknown>)?.members as Array<{ cwd?: string }> | undefined;
        if (members) {
          for (const m of members) {
            if (m.cwd) cwds.add(m.cwd);
          }
        }
      }

      // Also try to extract cwd from team config path
      if (workspace.tool === "claude-code" && workspace.path) {
        // workspace.path is like ~/.claude/teams/{teamName}
        // Read config to get member cwds
        const configPath = path.join(workspace.path, "config.json");
        const config = await readFileSafe(configPath);
        if (config) {
          try {
            const parsed = JSON.parse(config);
            for (const member of parsed.members ?? []) {
              if (member.cwd) cwds.add(member.cwd);
            }
          } catch { /* ignore */ }
        }
      }

      for (const cwd of cwds) {
        if (!(await fileExists(cwd))) continue;
        const ctx: ScanContext = {
          cwd,
          workspaceId: workspace.id,
          sessionId: workspace.sessions[0]?.id ?? workspace.id,
        };
        try {
          allItems.push(...await workItemsFromPlanFiles(ctx));
          allItems.push(...await workItemsFromProjectConfig(ctx));
        } catch (err) {
          console.warn(`Workflow scan failed for ${cwd}:`, err);
        }
      }
    }

    return deduplicateItems(allItems);
  }
}
```

---

### FILE: {INSTALL_DIR}/server/index.ts

**IMPORTANT:** This file must register the adapters that were detected in Step 1. Only import and register adapters for tools that exist on this machine.

```typescript
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { AdapterRegistry } from "./adapter-registry.js";
import { AttentionEngine } from "./attention-engine.js";
import { BoardEngine } from "./board-engine.js";
import { WorkflowScanner } from "./workflow-scanner.js";
import type { DashboardState, WsMessage } from "./types.js";
// CONDITIONAL IMPORTS -- only include adapters for detected tools:
// import { ClaudeCodeAdapter } from "../adapters/claude-code.js";
// import { CursorAdapter } from "../adapters/cursor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? "4200", 10);

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

let state: DashboardState = { workspaces: [], attentionItems: [], workItems: [], boardCards: [] };
const clients = new Set<WebSocket>();

app.use(express.static(path.join(__dirname, "../dist-ui")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", workspaces: state.workspaces.length, attentionItems: state.attentionItems.length });
});

app.get("/api/state", (_req, res) => { res.json(state); });

interface SectionInfo {
  id: string;
  label: string;
  sessionType: string | null;
}

const sections: SectionInfo[] = [
  { id: "attention", label: "Attention", sessionType: null },
  { id: "board", label: "Board", sessionType: null },
  { id: "teams", label: "Teams", sessionType: "team" },
  { id: "solo", label: "Solo Sessions", sessionType: "solo" },
  { id: "plans", label: "Plans", sessionType: "plan" },
];

// Filter sections based on registered adapters
const adapterNames = new Set<string>();
const registeredSections: SectionInfo[] = [];

function buildSections(): void {
  registeredSections.length = 0;
  registeredSections.push(sections[0]); // attention always present
  registeredSections.push(sections[1]); // board always present
  if (adapterNames.has("claude-code")) {
    registeredSections.push(sections[2]); // teams
    registeredSections.push(sections[3]); // solo
  }
  if (adapterNames.has("cursor")) {
    registeredSections.push(sections[4]); // plans
  }
}

app.get("/api/sections", (_req, res) => { res.json({ sections: registeredSections }); });

app.get("/api/work-items", (req, res) => {
  const workspace = req.query.workspace as string | undefined;
  if (workspace) {
    res.json({ workItems: state.workItems.filter((wi) => state.workspaces.some((ws) => ws.id === workspace && ws.sessions.some((s) => s.id === wi.sessionId))) });
  } else {
    res.json({ workItems: state.workItems });
  }
});

wss.on("connection", (ws) => {
  clients.add(ws);
  const msg: WsMessage = { type: "state", data: state };
  ws.send(JSON.stringify(msg));
  ws.on("close", () => { clients.delete(ws); });
});

function broadcast(message: WsMessage): void {
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}

const registry = new AdapterRegistry();
const attention = new AttentionEngine();
const board = new BoardEngine();
const scanner = new WorkflowScanner();

// CONDITIONAL REGISTRATION -- only register adapters for detected tools:
// const claudeAdapter = new ClaudeCodeAdapter();
// registry.registerAdapter(claudeAdapter);
// adapterNames.add(claudeAdapter.name);
// const cursorAdapter = new CursorAdapter();
// registry.registerAdapter(cursorAdapter);
// adapterNames.add(cursorAdapter.name);
// buildSections();

registry.onStateChange((updatedState) => {
  state = { ...state, workspaces: updatedState.workspaces };
  state.attentionItems = attention.evaluate(state);
  state.boardCards = board.evaluate(state);
  broadcast({ type: "state", data: state });
});

app.delete("/api/board/:cardId", (req, res) => {
  const ok = board.dismiss(req.params.cardId);
  if (!ok) return res.status(400).json({ error: "Card not found or not in done stage" });
  state.boardCards = board.evaluate(state);
  broadcast({ type: "state", data: state });
  res.json({ ok: true });
});

async function start(): Promise<void> {
  await registry.initialize();
  // Run workflow scan after adapters have loaded session data
  try {
    state.workItems = await scanner.scan(state.workspaces);
    console.log(`Workflow scanner found ${state.workItems.length} work items`);
  } catch (err) {
    console.warn("Workflow scan failed:", err);
  }
  httpServer.listen(PORT, () => {
    console.log(`Agentic Dashboard running at http://localhost:${PORT}`);
  });
}

start().catch((err) => { console.error("Failed to start dashboard:", err); process.exit(1); });
```

**When writing this file:** Uncomment the import and registration lines for each detected tool. For example, if both Claude Code and Cursor were detected, uncomment all lines. If only Claude Code, uncomment only the ClaudeCodeAdapter lines. Always call `buildSections()` after registering adapters.

---

### FILE: {INSTALL_DIR}/adapters/claude-code.ts

**Only generate this file if Claude Code was detected in Step 1.**

```typescript
import { watch } from "chokidar";
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { ToolAdapter, WorkspacePath, Disposable } from "./types.js";
import type { Agent, Message, Session, TaskItem } from "../server/types.js";

const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const TEAMS_DIR = path.join(CLAUDE_DIR, "teams");
const TASKS_DIR = path.join(CLAUDE_DIR, "tasks");
const TODOS_DIR = path.join(CLAUDE_DIR, "todos");

interface RawTeamConfig {
  name: string;
  description?: string;
  createdAt: number;
  leadAgentId?: string;
  members: RawMember[];
}

interface RawMember {
  agentId: string;
  name: string;
  agentType: string;
  model?: string;
  prompt?: string;
  joinedAt: number;
  cwd?: string;
}

interface RawTask {
  id: string;
  subject: string;
  description?: string;
  status: string;
  activeForm?: string;
  owner?: string;
  blocks?: string[];
  blockedBy?: string[];
}

interface RawInboxMessage {
  from: string;
  text: string;
  summary?: string;
  timestamp: string;
  color?: string;
  read?: boolean;
}

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch { return null; }
}

async function dirExists(dirPath: string): Promise<boolean> {
  try { const stat = await fs.stat(dirPath); return stat.isDirectory(); }
  catch { return false; }
}

async function listFiles(dirPath: string): Promise<string[]> {
  try { return await fs.readdir(dirPath); }
  catch { return []; }
}

function parseAgent(member: RawMember): Agent {
  return {
    id: member.agentId, name: member.name, role: member.agentType,
    status: "unknown", model: member.model, lastActivity: member.joinedAt,
  };
}

function isIdleNotification(text: string): boolean {
  try { const parsed = JSON.parse(text); return parsed?.type === "idle_notification"; }
  catch { return false; }
}

function parseMessage(raw: RawInboxMessage, index: number): Message {
  const isIdle = isIdleNotification(raw.text);
  return {
    id: `msg-${index}-${raw.timestamp}`, from: raw.from,
    content: isIdle ? `[idle] ${raw.from} is available` : raw.text,
    summary: raw.summary, timestamp: new Date(raw.timestamp).getTime(),
    read: raw.read,
    needsResponse: !isIdle && !raw.read &&
      (raw.text.includes("?") || /\b(approve|confirm|review|blocked)\b/i.test(raw.text)),
  };
}

function hasLockfile(teamDir: string): boolean {
  try {
    const lockPath = path.join(teamDir, ".lock");
    // Synchronous check via execSync since fs.access is async
    execSync(`test -f "${lockPath}"`, { timeout: 1000 });
    return true;
  } catch { return false; }
}

function isTeamSessionActive(session: Session, config: RawTeamConfig | null, teamDir: string): boolean {
  if (hasLockfile(teamDir)) return true;
  const now = Date.now();
  for (const msg of session.messages) {
    if (msg.needsResponse) return true;
    if (!msg.content.startsWith("[idle]") && (now - msg.timestamp) < ACTIVE_THRESHOLD_MS) return true;
  }
  return false;
}

async function isSoloSessionActive(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return (Date.now() - stat.mtimeMs) < ACTIVE_THRESHOLD_MS;
  } catch { return false; }
}

async function scanTeamSession(teamName: string): Promise<Session> {
  const config = await readJsonSafe<RawTeamConfig>(path.join(TEAMS_DIR, teamName, "config.json"));
  const agents: Agent[] = config?.members.map(parseAgent) ?? [];

  const tasksDir = path.join(TASKS_DIR, teamName);
  const taskFiles = (await listFiles(tasksDir)).filter((f) => f.endsWith(".json") && f !== ".lock");
  const tasks: TaskItem[] = [];
  for (const file of taskFiles) {
    const raw = await readJsonSafe<RawTask>(path.join(tasksDir, file));
    if (raw) tasks.push({ id: raw.id, subject: raw.subject, status: raw.status, description: raw.description, owner: raw.owner, blockedBy: raw.blockedBy, blocks: raw.blocks });
  }

  const inboxDir = path.join(TEAMS_DIR, teamName, "inboxes");
  const inboxFiles = await listFiles(inboxDir);
  const messages: Message[] = [];
  for (const file of inboxFiles) {
    if (!file.endsWith(".json")) continue;
    const rawMessages = await readJsonSafe<RawInboxMessage[]>(path.join(inboxDir, file));
    if (rawMessages) messages.push(...rawMessages.map(parseMessage));
  }

  messages.sort((a, b) => a.timestamp - b.timestamp);

  for (const agent of agents) {
    const agentMessages = messages.filter((m) => m.from === agent.name);
    const lastMsg = agentMessages.at(-1);
    if (lastMsg) {
      agent.lastActivity = lastMsg.timestamp;
      agent.status = lastMsg.content.startsWith("[idle]") ? "idle" : "active";
    }
  }
  for (const agent of agents) {
    const activeTask = tasks.find((t) => t.owner === agent.name && t.status === "in_progress");
    if (activeTask) agent.currentTask = activeTask.subject;
  }

  const lastActivity = Math.max(config?.createdAt ?? 0, ...agents.map((a) => a.lastActivity), ...messages.map((m) => m.timestamp));

  const session: Session = {
    id: `claude-team-${teamName}`, name: config?.name ?? teamName, type: "team",
    agents, tasks, messages,
    metadata: { description: config?.description, leadAgentId: config?.leadAgentId },
    lastActivity, isActive: false,
  };
  session.isActive = isTeamSessionActive(session, config, path.join(TEAMS_DIR, teamName));
  return session;
}

async function scanTodoSession(fileName: string): Promise<Session | null> {
  const filePath = path.join(TODOS_DIR, fileName);
  const todos = await readJsonSafe<RawTask[]>(filePath);
  if (!todos || todos.length === 0) return null;
  const sessionId = fileName.replace(".json", "");
  const tasks: TaskItem[] = todos.map((t) => ({ id: t.id, subject: t.subject, status: t.status, description: t.description, owner: t.owner, blockedBy: t.blockedBy, blocks: t.blocks }));
  const stat = await fs.stat(filePath);
  const isActive = await isSoloSessionActive(filePath);
  return { id: `claude-solo-${sessionId}`, name: sessionId, type: "solo", agents: [], tasks, messages: [], metadata: {}, lastActivity: stat.mtimeMs, isActive };
}

export class ClaudeCodeAdapter implements ToolAdapter {
  name = "claude-code";

  async detect(): Promise<WorkspacePath[]> {
    const paths: WorkspacePath[] = [];
    if (await dirExists(TEAMS_DIR)) {
      const teams = await listFiles(TEAMS_DIR);
      for (const team of teams) {
        try { await fs.access(path.join(TEAMS_DIR, team, "config.json")); paths.push({ tool: this.name, workspace: team, path: path.join(TEAMS_DIR, team) }); } catch {}
      }
    }
    if (await dirExists(TODOS_DIR)) {
      const todoFiles = (await listFiles(TODOS_DIR)).filter((f) => f.endsWith(".json"));
      for (const file of todoFiles) {
        paths.push({ tool: this.name, workspace: `solo-${file.replace(".json", "")}`, path: path.join(TODOS_DIR, file) });
      }
    }
    return paths;
  }

  async scan(wp: WorkspacePath): Promise<Session> {
    if (wp.workspace.startsWith("solo-")) {
      const session = await scanTodoSession(path.basename(wp.path));
      return session ?? { id: `claude-solo-${wp.workspace}`, name: wp.workspace, type: "solo", agents: [], tasks: [], messages: [], metadata: {}, lastActivity: 0, isActive: false };
    }
    return scanTeamSession(wp.workspace);
  }

  watch(wp: WorkspacePath, onChange: (session: Session) => void): Disposable {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    // For team workspaces, also watch the corresponding tasks directory
    const watchPaths: string[] = [wp.path];
    if (!wp.workspace.startsWith("solo-")) {
      const tasksPath = path.join(TASKS_DIR, wp.workspace);
      watchPaths.push(tasksPath);
    }
    const watcher = watch(watchPaths, { ignoreInitial: true, depth: 2 });
    watcher.on("all", () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => { onChange(await this.scan(wp)); }, 300);
    });
    return { dispose() { if (debounceTimer) clearTimeout(debounceTimer); watcher.close(); } };
  }

  watchForNew(
    onAdded: (wp: WorkspacePath) => void,
    onRemoved: (wp: WorkspacePath) => void,
  ): Disposable {
    const disposables: Array<{ dispose(): void }> = [];
    const knownTeams = new Set<string>();
    const knownTodos = new Set<string>();

    // Watch ~/.claude/teams/ for new/removed team directories
    if (TEAMS_DIR) {
      let teamsDebounce: ReturnType<typeof setTimeout> | null = null;
      const teamsWatcher = watch(TEAMS_DIR, { ignoreInitial: true, depth: 0 });
      teamsWatcher.on("all", () => {
        if (teamsDebounce) clearTimeout(teamsDebounce);
        teamsDebounce = setTimeout(async () => {
          const currentTeams = new Set<string>();
          const teams = await listFiles(TEAMS_DIR);
          for (const team of teams) {
            try {
              await fs.access(path.join(TEAMS_DIR, team, "config.json"));
              currentTeams.add(team);
              if (!knownTeams.has(team)) {
                knownTeams.add(team);
                onAdded({ tool: "claude-code", workspace: team, path: path.join(TEAMS_DIR, team) });
              }
            } catch {}
          }
          for (const team of knownTeams) {
            if (!currentTeams.has(team)) {
              knownTeams.delete(team);
              onRemoved({ tool: "claude-code", workspace: team, path: path.join(TEAMS_DIR, team) });
            }
          }
        }, 500);
      });
      disposables.push({ dispose() { if (teamsDebounce) clearTimeout(teamsDebounce); teamsWatcher.close(); } });

      // Seed known teams
      listFiles(TEAMS_DIR).then(async (teams) => {
        for (const team of teams) {
          try { await fs.access(path.join(TEAMS_DIR, team, "config.json")); knownTeams.add(team); } catch {}
        }
      });
    }

    // Watch ~/.claude/todos/ for new/removed todo files
    if (TODOS_DIR) {
      let todosDebounce: ReturnType<typeof setTimeout> | null = null;
      const todosWatcher = watch(TODOS_DIR, { ignoreInitial: true, depth: 0 });
      todosWatcher.on("all", () => {
        if (todosDebounce) clearTimeout(todosDebounce);
        todosDebounce = setTimeout(async () => {
          const currentTodos = new Set<string>();
          const files = (await listFiles(TODOS_DIR)).filter((f) => f.endsWith(".json"));
          for (const file of files) {
            currentTodos.add(file);
            if (!knownTodos.has(file)) {
              knownTodos.add(file);
              onAdded({ tool: "claude-code", workspace: `solo-${file.replace(".json", "")}`, path: path.join(TODOS_DIR, file) });
            }
          }
          for (const file of knownTodos) {
            if (!currentTodos.has(file)) {
              knownTodos.delete(file);
              onRemoved({ tool: "claude-code", workspace: `solo-${file.replace(".json", "")}`, path: path.join(TODOS_DIR, file) });
            }
          }
        }, 500);
      });
      disposables.push({ dispose() { if (todosDebounce) clearTimeout(todosDebounce); todosWatcher.close(); } });

      // Seed known todos
      listFiles(TODOS_DIR).then((files) => {
        for (const file of files.filter((f) => f.endsWith(".json"))) {
          knownTodos.add(file);
        }
      });
    }

    return { dispose() { for (const d of disposables) d.dispose(); } };
  }
}
```

---

### FILE: {INSTALL_DIR}/adapters/cursor.ts

**Only generate this file if Cursor was detected in Step 1.**

```typescript
import { watch } from "chokidar";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import yaml from "js-yaml";
import type { ToolAdapter, WorkspacePath, Disposable } from "./types.js";
import type { Session, TaskItem } from "../server/types.js";

const CURSOR_DIR = path.join(os.homedir(), ".cursor");
const PLANS_DIR = path.join(CURSOR_DIR, "plans");
const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000;

interface PlanFrontmatter { name?: string; overview?: string; isProject?: boolean; todos?: PlanTodo[]; }
interface PlanTodo { id: string; content: string; status: string; }

function parsePlanFile(content: string): { frontmatter: PlanFrontmatter; body: string } {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return { frontmatter: {}, body: content };
  return { frontmatter: yaml.load(fmMatch[1]) as PlanFrontmatter, body: fmMatch[2] };
}

async function scanPlanSession(filePath: string): Promise<Session | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const { frontmatter, body } = parsePlanFile(content);
    const fileName = path.basename(filePath, ".plan.md");
    const tasks: TaskItem[] = (frontmatter.todos ?? []).map((todo) => ({ id: todo.id, subject: todo.content, status: todo.status }));
    const stat = await fs.stat(filePath);
    const isActive = (Date.now() - stat.mtimeMs) < ACTIVE_THRESHOLD_MS;
    return {
      id: `cursor-plan-${fileName}`, name: frontmatter.name ?? fileName, type: "plan",
      agents: [], tasks, messages: [],
      metadata: { overview: frontmatter.overview, isProject: frontmatter.isProject, bodyPreview: body.slice(0, 500) },
      lastActivity: stat.mtimeMs, isActive,
    };
  } catch { return null; }
}

export class CursorAdapter implements ToolAdapter {
  name = "cursor";

  async detect(): Promise<WorkspacePath[]> {
    const paths: WorkspacePath[] = [];
    try {
      await fs.access(PLANS_DIR);
      const files = await fs.readdir(PLANS_DIR);
      for (const file of files.filter((f) => f.endsWith(".plan.md"))) {
        paths.push({ tool: this.name, workspace: file.replace(".plan.md", ""), path: path.join(PLANS_DIR, file) });
      }
    } catch {}
    return paths;
  }

  async scan(wp: WorkspacePath): Promise<Session> {
    const session = await scanPlanSession(wp.path);
    return session ?? { id: `cursor-plan-${wp.workspace}`, name: wp.workspace, type: "plan", agents: [], tasks: [], messages: [], metadata: {}, lastActivity: 0, isActive: false };
  }

  watch(wp: WorkspacePath, onChange: (session: Session) => void): Disposable {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const watcher = watch(wp.path, { ignoreInitial: true });
    watcher.on("all", () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => { onChange(await this.scan(wp)); }, 300);
    });
    return { dispose() { if (debounceTimer) clearTimeout(debounceTimer); watcher.close(); } };
  }

  watchForNew(
    onAdded: (wp: WorkspacePath) => void,
    onRemoved: (wp: WorkspacePath) => void,
  ): Disposable {
    const knownPlans = new Set<string>();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const plansWatcher = watch(PLANS_DIR, { ignoreInitial: true, depth: 0 });
    plansWatcher.on("all", () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const currentPlans = new Set<string>();
        try {
          const files = (await fs.readdir(PLANS_DIR)).filter((f) => f.endsWith(".plan.md"));
          for (const file of files) {
            currentPlans.add(file);
            if (!knownPlans.has(file)) {
              knownPlans.add(file);
              onAdded({ tool: "cursor", workspace: file.replace(".plan.md", ""), path: path.join(PLANS_DIR, file) });
            }
          }
        } catch {}
        for (const file of knownPlans) {
          if (!currentPlans.has(file)) {
            knownPlans.delete(file);
            onRemoved({ tool: "cursor", workspace: file.replace(".plan.md", ""), path: path.join(PLANS_DIR, file) });
          }
        }
      }, 500);
    });

    // Seed known plans
    fs.readdir(PLANS_DIR).then((files) => {
      for (const file of files.filter((f) => f.endsWith(".plan.md"))) {
        knownPlans.add(file);
      }
    }).catch(() => {});

    return { dispose() { if (debounceTimer) clearTimeout(debounceTimer); plansWatcher.close(); } };
  }
}
```

---

### FILE: {INSTALL_DIR}/ui/index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Agentic Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

---

### FILE: {INSTALL_DIR}/ui/main.tsx

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

---

### FILE: {INSTALL_DIR}/ui/styles/globals.css

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0a0a0a; --surface: #141414; --surface-hover: #1a1a1a;
  --border: #262626; --text: #fafafa; --text-muted: #a1a1aa; --text-subtle: #71717a;
  --accent: #7c3aed; --accent-hover: #6d28d9;
  --danger: #ef4444; --warning: #f59e0b; --success: #22c55e; --info: #3b82f6;
  --radius: 8px; --radius-sm: 4px;
}

body {
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--bg); color: var(--text); line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

#root { min-height: 100vh; }
```

---

### FILE: {INSTALL_DIR}/ui/hooks/useWebSocket.ts

```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardState, WsMessage } from "../../server/types.js";

const RECONNECT_DELAY_MS = 2000;
const INITIAL_STATE: DashboardState = { workspaces: [], attentionItems: [], workItems: [], boardCards: [] };

export function useWebSocket(url: string) {
  const [state, setState] = useState<DashboardState>(INITIAL_STATE);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => { setConnected(true); };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as WsMessage;
      switch (msg.type) {
        case "state": setState(msg.data); break;
        case "attention": setState((prev) => ({ ...prev, attentionItems: [...prev.attentionItems, msg.data] })); break;
        case "attention_resolved": setState((prev) => ({ ...prev, attentionItems: prev.attentionItems.filter((i) => i.id !== msg.data.id) })); break;
      }
    };
    ws.onclose = () => { setConnected(false); wsRef.current = null; reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS); };
    ws.onerror = () => { ws.close(); };
  }, [url]);

  useEffect(() => {
    connect();
    return () => { if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current); wsRef.current?.close(); };
  }, [connect]);

  return { state, connected };
}
```

---

### FILE: {INSTALL_DIR}/ui/hooks/useSections.ts

```typescript
import { useEffect, useState } from "react";

export interface SectionInfo {
  id: string;
  label: string;
  sessionType: string | null;
}

export function useSections() {
  const [sections, setSections] = useState<SectionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sections")
      .then((res) => res.json())
      .then((data: { sections: SectionInfo[] }) => {
        setSections(data.sections);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  return { sections, loading };
}
```

---

### FILE: {INSTALL_DIR}/ui/App.tsx

```tsx
import { useMemo, useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket.js";
import { useSections } from "./hooks/useSections.js";
import type { SectionInfo } from "./hooks/useSections.js";
import type { DashboardState, Session } from "../server/types.js";
import { SideMenu } from "./components/SideMenu.js";
import { AttentionQueue } from "./components/AttentionQueue.js";
import { ListView } from "./components/ListView.js";
import { DetailView } from "./components/DetailView.js";
import { BoardView } from "./components/BoardView.js";

const WS_URL = `ws://${window.location.hostname}:4200`;

const EMPTY_LABELS: Record<string, string> = {
  teams: "No active teams",
  plans: "No Cursor plans found",
  solo: "No solo sessions",
};

export function App() {
  const { state, connected } = useWebSocket(WS_URL);
  const { sections, loading } = useSections();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Determine default section once sections load
  const effectiveSection = activeSection ?? getDefaultSection(sections, state);

  const badgeCounts = useMemo(() => computeBadgeCounts(state, sections), [state, sections]);

  const sessionsForSection = useMemo(() => {
    if (!effectiveSection) return [];
    const section = sections.find((s) => s.id === effectiveSection);
    if (!section?.sessionType) return [];
    return state.workspaces.flatMap((w) =>
      w.sessions.filter((s) => s.type === section.sessionType)
    );
  }, [state, sections, effectiveSection]);

  const selectedSession = useMemo(() => {
    if (!selectedSessionId) return null;
    for (const ws of state.workspaces) {
      const found = ws.sessions.find((s) => s.id === selectedSessionId);
      if (found) return { session: found, tool: ws.tool };
    }
    return null;
  }, [state, selectedSessionId]);

  function handleDismissCard(cardId: string) {
    fetch(`/api/board/${cardId}`, { method: "DELETE" }).catch(() => {});
  }

  function handleSectionSelect(sectionId: string) {
    setActiveSection(sectionId);
    setSelectedSessionId(null);
  }

  if (loading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "var(--text-subtle)" }}>Loading...</div>;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <SideMenu
        sections={sections}
        activeSection={effectiveSection ?? ""}
        onSelect={handleSectionSelect}
        badgeCounts={badgeCounts}
      />
      <div style={{ flex: 1, padding: "24px", maxWidth: 1000 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Agentic Dashboard</h1>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: connected ? "var(--success)" : "var(--danger)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "var(--success)" : "var(--danger)" }} />
            {connected ? "Connected" : "Disconnected"}
          </span>
        </header>
        <MainContent
          section={effectiveSection}
          state={state}
          sessionsForSection={sessionsForSection}
          selectedSession={selectedSession}
          onSelectSession={setSelectedSessionId}
          onBack={() => setSelectedSessionId(null)}
          onDismissCard={handleDismissCard}
        />
      </div>
    </div>
  );
}

function MainContent({
  section,
  state,
  sessionsForSection,
  selectedSession,
  onSelectSession,
  onBack,
  onDismissCard,
}: {
  section: string | null;
  state: DashboardState;
  sessionsForSection: Session[];
  selectedSession: { session: Session; tool: string } | null;
  onSelectSession: (id: string) => void;
  onBack: () => void;
  onDismissCard: (cardId: string) => void;
}) {
  if (!section) return null;

  if (section === "attention") {
    return <AttentionQueue items={state.attentionItems} />;
  }

  if (section === "board") {
    return <BoardView cards={state.boardCards} onDismiss={onDismissCard} />;
  }

  if (selectedSession) {
    return <DetailView session={selectedSession.session} tool={selectedSession.tool} onBack={onBack} workItems={state.workItems} />;
  }

  return (
    <ListView
      sessions={sessionsForSection}
      onSelect={onSelectSession}
      emptyLabel={EMPTY_LABELS[section] ?? "No sessions"}
    />
  );
}

function getDefaultSection(sections: SectionInfo[], state: DashboardState): string | null {
  if (sections.length === 0) return null;
  if (state.attentionItems.length > 0) return "attention";
  return sections[0].id;
}

function computeBadgeCounts(state: DashboardState, sections: SectionInfo[]): Record<string, number> {
  const counts: Record<string, number> = {};
  counts.attention = state.attentionItems.length;
  counts.board = state.boardCards.filter((c) => c.attention).length;
  for (const section of sections) {
    if (!section.sessionType) continue;
    counts[section.id] = state.workspaces.reduce(
      (sum, ws) => sum + ws.sessions.filter((s) => s.type === section.sessionType).length,
      0,
    );
  }
  return counts;
}
```

---

### FILE: {INSTALL_DIR}/ui/components/SideMenu.tsx

```tsx
import type { SectionInfo } from "../hooks/useSections.js";

interface SideMenuProps {
  sections: SectionInfo[];
  activeSection: string;
  onSelect: (sectionId: string) => void;
  badgeCounts: Record<string, number>;
}

export function SideMenu({ sections, activeSection, onSelect, badgeCounts }: SideMenuProps) {
  return (
    <nav style={{
      width: 200, flexShrink: 0, borderRight: "1px solid var(--border)",
      padding: "16px 0", display: "flex", flexDirection: "column", gap: 2,
    }}>
      {sections.map((section) => {
        const isActive = activeSection === section.id;
        const count = badgeCounts[section.id] ?? 0;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 16px", background: isActive ? "var(--surface)" : "transparent",
              border: "none", borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
              color: isActive ? "var(--text)" : "var(--text-muted)",
              cursor: "pointer", fontSize: 14, textAlign: "left", width: "100%",
            }}
          >
            <span>{section.label}</span>
            {count > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 10,
                background: section.id === "attention" ? "var(--danger)" : "var(--surface-hover)",
                color: section.id === "attention" ? "white" : "var(--text-subtle)",
              }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
```

---

### FILE: {INSTALL_DIR}/ui/components/ListView.tsx

```tsx
import { useState } from "react";
import type { Session } from "../../server/types.js";
import { Empty } from "./SessionPanel.js";

interface ListViewProps {
  sessions: Session[];
  onSelect: (sessionId: string) => void;
  emptyLabel: string;
}

type FilterTab = "active" | "all";

export function ListView({ sessions, onSelect, emptyLabel }: ListViewProps) {
  const [tab, setTab] = useState<FilterTab>("active");

  const filtered = tab === "active" ? sessions.filter((s) => s.isActive) : sessions;
  const sorted = [...filtered].sort((a, b) => b.lastActivity - a.lastActivity);
  const activeCount = sessions.filter((s) => s.isActive).length;

  return (
    <div>
      <div style={{ display: "flex", gap: 0, marginBottom: 12, borderBottom: "1px solid var(--border)" }}>
        <TabButton label={`Active (${activeCount})`} isActive={tab === "active"} onClick={() => setTab("active")} />
        <TabButton label={`All (${sessions.length})`} isActive={tab === "all"} onClick={() => setTab("all")} />
      </div>
      {sorted.length === 0 ? (
        <Empty label={tab === "active" ? "No active sessions" : emptyLabel} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((session) => {
            const agentCount = session.agents.length;
            const taskCount = session.tasks.length;
            const msgCount = session.messages.length;
            const stats = [
              agentCount > 0 ? `${agentCount} agents` : null,
              `${taskCount} tasks`,
              msgCount > 0 ? `${msgCount} messages` : null,
            ].filter(Boolean).join(" \u00b7 ");

            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelect(session.id)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 16px", background: "var(--surface)",
                  border: "1px solid var(--border)", borderRadius: "var(--radius)",
                  color: "var(--text)", cursor: "pointer", textAlign: "left", width: "100%",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {session.isActive && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{session.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-subtle)", marginTop: 2 }}>{stats}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-subtle)", flexShrink: 0 }}>
                  {formatRelativeTime(session.lastActivity)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabButton({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 14px", background: "none", border: "none",
        borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
        color: isActive ? "var(--text)" : "var(--text-subtle)",
        cursor: "pointer", fontSize: 13,
      }}
    >
      {label}
    </button>
  );
}

function formatRelativeTime(timestamp: number): string {
  if (timestamp === 0) return "";
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

---

### FILE: {INSTALL_DIR}/ui/components/DetailView.tsx

```tsx
import type { Session, WorkItem } from "../../server/types.js";
import { SessionPanel } from "./SessionPanel.js";

interface DetailViewProps {
  session: Session;
  tool: string;
  onBack: () => void;
  workItems?: WorkItem[];
}

export function DetailView({ session, tool, onBack, workItems }: DetailViewProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "6px 0",
          marginBottom: 16, background: "none", border: "none",
          color: "var(--text-muted)", cursor: "pointer", fontSize: 13,
        }}
      >
        <span style={{ fontSize: 16 }}>{"\u2190"}</span>
        <span>Back</span>
      </button>
      <SessionPanel session={session} tool={tool} workItems={workItems} />
    </div>
  );
}
```

---

### FILE: {INSTALL_DIR}/ui/components/SessionPanel.tsx

```tsx
import { useState } from "react";
import type { Session, Agent, TaskItem, Message, WorkItem } from "../../server/types.js";
import { RawDataFallback } from "./RawDataFallback.js";
import { WorkItemList } from "./WorkItemList.js";

export function SessionPanel({ session, tool, workItems = [] }: { session: Session; tool: string; workItems?: WorkItem[] }) {
  const sessionWorkItems = workItems.filter((wi) => wi.sessionId === session.id);
  const [tab, setTab] = useState<"agents" | "tasks" | "workitems" | "messages" | "raw">(session.agents.length > 0 ? "agents" : "tasks");
  const tabs = [
    ...(session.agents.length > 0 ? [{ key: "agents" as const, label: `Agents (${session.agents.length})` }] : []),
    { key: "tasks" as const, label: `Tasks (${session.tasks.length})` },
    ...(sessionWorkItems.length > 0 ? [{ key: "workitems" as const, label: `Work Items (${sessionWorkItems.length})` }] : []),
    ...(session.messages.length > 0 ? [{ key: "messages" as const, label: `Messages (${session.messages.length})` }] : []),
    { key: "raw" as const, label: "Raw" },
  ];
  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: "var(--radius-sm)", background: "var(--surface)", color: "var(--text-subtle)", border: "1px solid var(--border)" }}>{session.type}</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{session.name}</span>
          <span style={{ fontSize: 12, color: "var(--text-subtle)", marginLeft: "auto" }}>{tool}</span>
        </div>
        {typeof session.metadata?.description === "string" && (
          <div style={{ fontSize: 12, color: "var(--text-subtle)", marginTop: 4 }}>
            {session.metadata.description}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
        {tabs.map((t) => <button key={t.key} type="button" onClick={() => setTab(t.key)} style={{ padding: "8px 14px", background: "none", border: "none", borderBottom: tab === t.key ? "2px solid var(--accent)" : "2px solid transparent", color: tab === t.key ? "var(--text)" : "var(--text-subtle)", cursor: "pointer", fontSize: 13 }}>{t.label}</button>)}
      </div>
      <div style={{ padding: 14 }}>
        {tab === "agents" && <AgentList agents={session.agents} />}
        {tab === "tasks" && <TaskList tasks={session.tasks} />}
        {tab === "workitems" && <WorkItemList items={sessionWorkItems} />}
        {tab === "messages" && <MessageList messages={session.messages} />}
        {tab === "raw" && <RawDataFallback data={session} label="Session Data" />}
      </div>
    </div>
  );
}

function AgentList({ agents }: { agents: Agent[] }) {
  if (agents.length === 0) return <Empty label="No agents" />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {agents.map((agent) => (
        <div key={agent.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
          <StatusDot status={agent.status} />
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 500 }}>{agent.name}</div><div style={{ fontSize: 12, color: "var(--text-subtle)" }}>{agent.role}{agent.model ? ` \u00b7 ${agent.model}` : ""}</div>{agent.currentTask && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Working on: {agent.currentTask}</div>}</div>
          <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>{agent.status}</span>
        </div>
      ))}
    </div>
  );
}

function TaskList({ tasks }: { tasks: TaskItem[] }) {
  if (tasks.length === 0) return <Empty label="No tasks" />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {tasks.map((task) => (
        <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: "var(--radius-sm)" }}>
          <TaskStatusIcon status={task.status} />
          <span style={{ fontSize: 13, flex: 1 }}>{task.subject}</span>
          {task.blockedBy?.length ? <span style={{ fontSize: 11, color: "var(--danger)" }}>blocked</span> : null}
          {task.owner && <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>{task.owner}</span>}
        </div>
      ))}
    </div>
  );
}

function MessageList({ messages }: { messages: Message[] }) {
  if (messages.length === 0) return <Empty label="No messages" />;
  const recent = messages.slice(-20);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {recent.map((msg) => (
        <div key={msg.id} style={{ padding: "8px 12px", background: msg.needsResponse ? "rgba(245, 158, 11, 0.05)" : "transparent", borderRadius: "var(--radius-sm)", borderLeft: msg.needsResponse ? "2px solid var(--warning)" : "2px solid transparent" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{msg.from}</span>
            <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>{new Date(msg.timestamp).toLocaleTimeString()}</span>
          </div>
          {msg.summary && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{msg.summary}</div>}
        </div>
      ))}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === "active" ? "var(--success)" : status === "idle" ? "var(--warning)" : "var(--text-subtle)";
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}

function TaskStatusIcon({ status }: { status: string }) {
  const icon = status === "completed" ? "\u2705" : status === "in_progress" ? "\uD83D\uDD04" : status === "pending" ? "\u25CB" : "\u25CF";
  return <span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{icon}</span>;
}

export function Empty({ label }: { label: string }) {
  return <div style={{ textAlign: "center", padding: 20, color: "var(--text-subtle)", fontSize: 13 }}>{label}</div>;
}
```

---

### FILE: {INSTALL_DIR}/ui/components/AttentionQueue.tsx

```tsx
import { useState } from "react";
import type { AttentionItem, AttentionUrgency } from "../../server/types.js";

const URGENCY_CONFIG: Record<AttentionUrgency, { color: string; label: string; order: number }> = {
  blocking: { color: "var(--danger)", label: "Blocking", order: 0 },
  waiting: { color: "var(--warning)", label: "Waiting", order: 1 },
  informational: { color: "var(--info)", label: "Info", order: 2 },
};

export function AttentionQueue({ items }: { items: AttentionItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sorted = [...items].sort((a, b) => URGENCY_CONFIG[a.urgency].order - URGENCY_CONFIG[b.urgency].order);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Needs Attention</h2>
        <span style={{ background: "var(--danger)", color: "white", fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 10 }}>{items.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((item) => {
          const config = URGENCY_CONFIG[item.urgency];
          const isExpanded = expandedId === item.id;
          return (
            <div key={item.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", borderLeft: `3px solid ${config.color}`, overflow: "hidden" }}>
              <button type="button" onClick={() => setExpandedId(isExpanded ? null : item.id)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "none", border: "none", color: "var(--text)", cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: config.color, textTransform: "uppercase", flexShrink: 0, width: 70 }}>{config.label}</span>
                <span style={{ fontSize: 14, flex: 1, minWidth: 0 }}>{item.shortContext}</span>
                <span style={{ fontSize: 11, color: "var(--text-subtle)", flexShrink: 0 }}>{isExpanded ? "\u25B2" : "\u25BC"}</span>
              </button>
              {isExpanded && (
                <div style={{ padding: "0 14px 14px", borderTop: "1px solid var(--border)" }}>
                  <pre style={{ fontSize: 13, color: "var(--text-muted)", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "12px 0", lineHeight: 1.6 }}>{item.fullContext}</pre>
                  {item.source.agent && (
                    <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-subtle)" }}>
                      Source: {item.source.tool} / {item.source.session}{item.source.agent ? ` / ${item.source.agent}` : ""}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

### FILE: {INSTALL_DIR}/ui/components/RawDataFallback.tsx

```tsx
import { useState } from "react";

export function RawDataFallback({ data, label }: { data: unknown; label?: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
      <button type="button" onClick={() => setExpanded(!expanded)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, textAlign: "left" }}>
        <span>{label ?? "Raw Data"}</span>
        <span style={{ fontSize: 11 }}>{expanded ? "\u25B2" : "\u25BC"}</span>
      </button>
      {expanded && (
        <pre style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-subtle)", overflow: "auto", maxHeight: 400, margin: 0 }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
```

---

### FILE: {INSTALL_DIR}/ui/components/WorkItemList.tsx

```tsx
import type { WorkItem, WorkItemStatus } from "../../server/types.js";
import { Empty } from "./SessionPanel.js";

const STATUS_CONFIG: Record<WorkItemStatus, { color: string; label: string; order: number }> = {
  blocked: { color: "var(--danger)", label: "Blocked", order: 0 },
  in_progress: { color: "var(--info)", label: "In Progress", order: 1 },
  planned: { color: "var(--warning)", label: "Planned", order: 2 },
  done: { color: "var(--success)", label: "Done", order: 3 },
};

export function WorkItemList({ items }: { items: WorkItem[] }) {
  if (items.length === 0) return <Empty label="No work items detected" />;

  const sorted = [...items].sort((a, b) => {
    const orderDiff = STATUS_CONFIG[a.status].order - STATUS_CONFIG[b.status].order;
    if (orderDiff !== 0) return orderDiff;
    return b.lastActivity - a.lastActivity;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {sorted.map((item) => {
        const config = STATUS_CONFIG[item.status];
        return (
          <div
            key={item.id}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px", borderRadius: "var(--radius-sm)",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: config.color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.name}
            </span>
            <span style={{ fontSize: 11, color: config.color, fontWeight: 500, flexShrink: 0 }}>
              {config.label}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-subtle)", flexShrink: 0 }}>
              {formatRelativeTime(item.lastActivity)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatRelativeTime(timestamp: number): string {
  if (timestamp === 0) return "";
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

---

### FILE: {INSTALL_DIR}/ui/components/BoardView.tsx

```tsx
import type { BoardCard, BoardStage, AttentionUrgency } from "../../server/types.js";

const URGENCY_ORDER: Record<AttentionUrgency, number> = {
  blocking: 0,
  waiting: 1,
  informational: 2,
};

const COLUMNS: { stage: BoardStage; title: string }[] = [
  { stage: "backlog", title: "Backlog" },
  { stage: "in_progress", title: "In Progress" },
  { stage: "done", title: "Done" },
];

const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

export function BoardView({ cards, onDismiss }: { cards: BoardCard[]; onDismiss: (cardId: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 120px)" }}>
      {COLUMNS.map((col) => {
        const columnCards = cards
          .filter((c) => c.stage === col.stage)
          .sort(sortCards);
        return (
          <BoardColumn
            key={col.stage}
            title={col.title}
            cards={columnCards}
            stage={col.stage}
            onDismiss={onDismiss}
          />
        );
      })}
    </div>
  );
}

function sortCards(a: BoardCard, b: BoardCard): number {
  // Attention cards first
  const aHasAttn = a.attention ? 0 : 1;
  const bHasAttn = b.attention ? 0 : 1;
  if (aHasAttn !== bHasAttn) return aHasAttn - bHasAttn;

  // Among attention cards, sort by urgency
  if (a.attention && b.attention) {
    const urgDiff = URGENCY_ORDER[a.attention.urgency] - URGENCY_ORDER[b.attention.urgency];
    if (urgDiff !== 0) return urgDiff;
  }

  // Then oldest first (lowest stageEnteredAt = oldest)
  return a.stageEnteredAt - b.stageEnteredAt;
}

function BoardColumn({ title, cards, stage, onDismiss }: {
  title: string;
  cards: BoardCard[];
  stage: BoardStage;
  onDismiss: (cardId: string) => void;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", marginBottom: 8,
        borderBottom: "2px solid var(--border)",
      }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 10,
          background: "var(--surface-hover)", color: "var(--text-subtle)",
        }}>
          {cards.length}
        </span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {cards.length === 0 ? (
          <div style={{ textAlign: "center", padding: 20, color: "var(--text-subtle)", fontSize: 13 }}>
            No items
          </div>
        ) : (
          cards.map((card) => (
            <BoardCardItem key={card.id} card={card} stage={stage} onDismiss={onDismiss} />
          ))
        )}
      </div>
    </div>
  );
}

function BoardCardItem({ card, stage, onDismiss }: {
  card: BoardCard;
  stage: BoardStage;
  onDismiss: (cardId: string) => void;
}) {
  return (
    <div style={{
      padding: "10px 12px",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderLeft: card.attention ? "2px solid var(--warning)" : "1px solid var(--border)",
      borderRadius: "var(--radius-sm)",
      position: "relative",
    }}>
      {stage === "done" && (
        <button
          type="button"
          onClick={() => onDismiss(card.id)}
          style={{
            position: "absolute", top: 6, right: 6,
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-subtle)", fontSize: 14, lineHeight: 1,
            padding: "2px 4px", borderRadius: "var(--radius-sm)",
          }}
          title="Dismiss"
        >
          {"\u00d7"}
        </button>
      )}
      <div style={{ fontSize: 14, fontWeight: 500, paddingRight: stage === "done" ? 20 : 0 }}>
        {card.title}
      </div>
      {card.attention && (
        <div style={{ fontSize: 12, color: "var(--warning)", marginTop: 4 }}>
          {card.attention.preview}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{card.taskSummary}</span>
        {stage !== "done" && <AgeBadge stageEnteredAt={card.stageEnteredAt} />}
      </div>
    </div>
  );
}

function AgeBadge({ stageEnteredAt }: { stageEnteredAt: number }) {
  const age = Date.now() - stageEnteredAt;
  const label = age < MS_HOUR
    ? `${Math.max(1, Math.floor(age / MS_MINUTE))}m`
    : age < MS_DAY
      ? `${Math.floor(age / MS_HOUR)}h`
      : `${Math.floor(age / MS_DAY)}d`;

  const color = age >= 2 * MS_DAY
    ? "var(--danger)"
    : age >= MS_DAY
      ? "var(--warning)"
      : "var(--text-subtle)";

  return (
    <span style={{ fontSize: 11, fontWeight: 500, color }}>{label}</span>
  );
}
```

---

## Step 5: Install Dependencies

```bash
cd {INSTALL_DIR} && npm install
```

## Step 6: Verify

```bash
cd {INSTALL_DIR} && npx tsc --noEmit
```

Must pass with zero errors. If it fails, read the error and fix it.

## Step 7: Generate Launch Skill

Ask the user where their skills directory is. Write this file there:

### FILE: {SKILLS_DIR}/dashboard-launch/SKILL.md

````markdown
---
name: dashboard-launch
description: Launch the Agentic Dashboard. Trigger with "open the dashboard".
---

# Launch Agentic Dashboard

1. Start the dev server:
   ```bash
   cd {INSTALL_DIR} && npm run dev &
   ```
2. Wait 3 seconds for server startup, then open:
   ```bash
   open http://localhost:4201
   ```
3. Verify:
   ```bash
   curl -s http://localhost:4200/api/health
   ```
   Should return `{"status":"ok",...}`.
````

**Replace `{INSTALL_DIR}` with the actual install path.**

## Step 8: Report

```
Dashboard installed at: {INSTALL_DIR}
Adapters: {list detected tools}
Sections: {list sections based on detected tools}
Launch skill: {SKILLS_DIR}/dashboard-launch/SKILL.md

To launch: "open the dashboard"
To reinstall: delete {INSTALL_DIR} and run this skill again
```
