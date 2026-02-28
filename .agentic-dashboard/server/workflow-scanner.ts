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
