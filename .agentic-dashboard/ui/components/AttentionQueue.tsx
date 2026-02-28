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
