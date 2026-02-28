export interface SectionInfo {
  id: string;
  label: string;
  sessionType: string | null;
}

const sections: SectionInfo[] = [
  { id: "attention", label: "Attention", sessionType: null },
  { id: "board", label: "Board", sessionType: null },
  { id: "teams", label: "Teams", sessionType: "team" },
  { id: "solo", label: "Solo Sessions", sessionType: "solo" },
];

export function useSections() {
  return { sections, loading: false };
}
