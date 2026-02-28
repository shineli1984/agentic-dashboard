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

function AgentPrompt({ prompt }: { prompt: string }) {
  const [expanded, setExpanded] = useState(false);
  const preview = prompt.length > 100 ? prompt.slice(0, 100) + "..." : prompt;
  return (
    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
      <span>{expanded ? prompt : preview}</span>
      {prompt.length > 100 && (
        <button type="button" onClick={() => setExpanded(!expanded)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 11, marginLeft: 4, padding: 0 }}>
          {expanded ? "less" : "more"}
        </button>
      )}
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
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{agent.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>{agent.role}{agent.model ? ` \u00b7 ${agent.model}` : ""}</div>
            {agent.cwd && <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2 }}>{agent.cwd}</div>}
            {agent.currentTask && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Working on: {agent.currentTask}</div>}
            {agent.prompt && <AgentPrompt prompt={agent.prompt} />}
          </div>
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
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13 }}>{task.subject}</span>
            {task.status === "in_progress" && task.activeForm && (
              <div style={{ fontSize: 12, fontStyle: "italic", color: "var(--text-muted)" }}>{task.activeForm}</div>
            )}
          </div>
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
