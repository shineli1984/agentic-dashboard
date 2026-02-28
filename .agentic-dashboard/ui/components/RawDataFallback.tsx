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
