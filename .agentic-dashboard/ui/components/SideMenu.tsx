import type { SectionInfo } from "../hooks/useSections.js";

interface SideMenuProps {
  sections: SectionInfo[];
  activeSection: string;
  onSelect: (sectionId: string) => void;
  badgeCounts: Record<string, number>;
}

export function SideMenu({ sections, activeSection, onSelect, badgeCounts }: SideMenuProps) {
  return (
    <nav style={{
      width: 200, flexShrink: 0, borderRight: "1px solid var(--border)",
      padding: "16px 0", display: "flex", flexDirection: "column", gap: 2,
    }}>
      {sections.map((section) => {
        const isActive = activeSection === section.id;
        const count = badgeCounts[section.id] ?? 0;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 16px", background: isActive ? "var(--surface)" : "transparent",
              border: "none", borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
              color: isActive ? "var(--text)" : "var(--text-muted)",
              cursor: "pointer", fontSize: 14, textAlign: "left", width: "100%",
            }}
          >
            <span>{section.label}</span>
            {count > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 10,
                background: section.id === "attention" ? "var(--danger)" : "var(--surface-hover)",
                color: section.id === "attention" ? "white" : "var(--text-subtle)",
              }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
