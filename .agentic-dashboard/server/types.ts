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
  cwd?: string;
  prompt?: string;
}

export interface TaskItem {
  id: string;
  subject: string;
  status: string;
  description?: string;
  activeForm?: string;
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
