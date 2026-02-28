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
