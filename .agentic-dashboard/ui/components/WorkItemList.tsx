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
