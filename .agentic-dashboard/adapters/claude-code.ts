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
    cwd: member.cwd, prompt: member.prompt,
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
    if (raw) tasks.push({ id: raw.id, subject: raw.subject, status: raw.status, description: raw.description, activeForm: raw.activeForm, owner: raw.owner, blockedBy: raw.blockedBy, blocks: raw.blocks });
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
  const tasks: TaskItem[] = todos.map((t) => ({ id: t.id, subject: t.subject, status: t.status, description: t.description, activeForm: t.activeForm, owner: t.owner, blockedBy: t.blockedBy, blocks: t.blocks }));
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
