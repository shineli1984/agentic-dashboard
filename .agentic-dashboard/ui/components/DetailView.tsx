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
