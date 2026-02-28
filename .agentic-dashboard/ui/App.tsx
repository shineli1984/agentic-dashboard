import { useMemo, useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket.js";
import { useSections } from "./hooks/useSections.js";
import type { SectionInfo } from "./hooks/useSections.js";
import type { DashboardState, Session } from "../server/types.js";
import { SideMenu } from "./components/SideMenu.js";
import { AttentionQueue } from "./components/AttentionQueue.js";
import { ListView } from "./components/ListView.js";
import { DetailView } from "./components/DetailView.js";
import { BoardView } from "./components/BoardView.js";

const WS_URL = `ws://${window.location.hostname}:4200`;

const EMPTY_LABELS: Record<string, string> = {
  teams: "No active teams",
  plans: "No Cursor plans found",
  solo: "No solo sessions",
};

export function App() {
  const { state, connected } = useWebSocket(WS_URL);
  const { sections, loading } = useSections();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Determine default section once sections load
  const effectiveSection = activeSection ?? getDefaultSection(sections, state);

  const badgeCounts = useMemo(() => computeBadgeCounts(state, sections), [state, sections]);

  const sessionsForSection = useMemo(() => {
    if (!effectiveSection) return [];
    const section = sections.find((s) => s.id === effectiveSection);
    if (!section?.sessionType) return [];
    return state.workspaces.flatMap((w) =>
      w.sessions.filter((s) => s.type === section.sessionType)
    );
  }, [state, sections, effectiveSection]);

  const selectedSession = useMemo(() => {
    if (!selectedSessionId) return null;
    for (const ws of state.workspaces) {
      const found = ws.sessions.find((s) => s.id === selectedSessionId);
      if (found) return { session: found, tool: ws.tool };
    }
    return null;
  }, [state, selectedSessionId]);

  function handleDismissCard(cardId: string) {
    fetch(`/api/board/${cardId}`, { method: "DELETE" }).catch(() => {});
  }

  function handleSectionSelect(sectionId: string) {
    setActiveSection(sectionId);
    setSelectedSessionId(null);
  }

  if (loading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "var(--text-subtle)" }}>Loading...</div>;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <SideMenu
        sections={sections}
        activeSection={effectiveSection ?? ""}
        onSelect={handleSectionSelect}
        badgeCounts={badgeCounts}
      />
      <div style={{ flex: 1, padding: "24px", maxWidth: 1000 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Agentic Dashboard</h1>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: connected ? "var(--success)" : "var(--danger)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "var(--success)" : "var(--danger)" }} />
            {connected ? "Connected" : "Disconnected"}
          </span>
        </header>
        <MainContent
          section={effectiveSection}
          state={state}
          sessionsForSection={sessionsForSection}
          selectedSession={selectedSession}
          onSelectSession={setSelectedSessionId}
          onBack={() => setSelectedSessionId(null)}
          onDismissCard={handleDismissCard}
        />
      </div>
    </div>
  );
}

function MainContent({
  section,
  state,
  sessionsForSection,
  selectedSession,
  onSelectSession,
  onBack,
  onDismissCard,
}: {
  section: string | null;
  state: DashboardState;
  sessionsForSection: Session[];
  selectedSession: { session: Session; tool: string } | null;
  onSelectSession: (id: string) => void;
  onBack: () => void;
  onDismissCard: (cardId: string) => void;
}) {
  if (!section) return null;

  if (section === "attention") {
    return <AttentionQueue items={state.attentionItems} />;
  }

  if (section === "board") {
    return <BoardView cards={state.boardCards} onDismiss={onDismissCard} />;
  }

  if (selectedSession) {
    return <DetailView session={selectedSession.session} tool={selectedSession.tool} onBack={onBack} workItems={state.workItems} />;
  }

  return (
    <ListView
      sessions={sessionsForSection}
      onSelect={onSelectSession}
      emptyLabel={EMPTY_LABELS[section] ?? "No sessions"}
    />
  );
}

function getDefaultSection(sections: SectionInfo[], state: DashboardState): string | null {
  if (sections.length === 0) return null;
  if (state.attentionItems.length > 0) return "attention";
  return sections[0].id;
}

function computeBadgeCounts(state: DashboardState, sections: SectionInfo[]): Record<string, number> {
  const counts: Record<string, number> = {};
  counts.attention = state.attentionItems.length;
  counts.board = state.boardCards.filter((c) => c.attention).length;
  for (const section of sections) {
    if (!section.sessionType) continue;
    counts[section.id] = state.workspaces.reduce(
      (sum, ws) => sum + ws.sessions.filter((s) => s.type === section.sessionType).length,
      0,
    );
  }
  return counts;
}
