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
