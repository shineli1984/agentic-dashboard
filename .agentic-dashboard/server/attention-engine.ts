import type {
  AttentionItem,
  AttentionUrgency,
  DashboardState,
  Message,
  Session,
} from "./types.js";

let idCounter = 0;
function nextId(): string {
  return `attn-${++idCounter}-${Date.now()}`;
}

export class AttentionEngine {
  private knownItems = new Map<string, AttentionItem>();

  evaluate(state: DashboardState): AttentionItem[] {
    const items: AttentionItem[] = [];
    for (const workspace of state.workspaces) {
      for (const session of workspace.sessions) {
        items.push(...this.checkMessages(session, workspace.tool, workspace.name));
      }
    }
    this.resolveStaleItems(items);
    return items;
  }

  private checkMessages(session: Session, tool: string, workspace: string): AttentionItem[] {
    const items: AttentionItem[] = [];
    for (const msg of session.messages) {
      if (!msg.needsResponse) continue;
      const key = `msg-${msg.id}`;
      if (this.knownItems.has(key)) { items.push(this.knownItems.get(key)!); continue; }
      const item: AttentionItem = {
        id: nextId(),
        urgency: this.inferMessageUrgency(msg),
        shortContext: msg.summary ?? `${msg.from}: message needs your response`,
        fullContext: msg.content,
        actions: [],
        source: { tool, workspace, session: session.id, agent: msg.from, file: "" },
        createdAt: msg.timestamp,
      };
      this.knownItems.set(key, item);
      items.push(item);
    }
    return items;
  }

  private inferMessageUrgency(msg: Message): AttentionUrgency {
    const text = msg.content.toLowerCase();
    if (/\b(blocked|blocking|cannot proceed)\b/.test(text)) return "blocking";
    if (/\b(waiting|approve|confirm|review)\b/.test(text)) return "waiting";
    return "informational";
  }

  private resolveStaleItems(currentItems: AttentionItem[]): void {
    const currentIds = new Set(currentItems.map((i) => i.id));
    for (const [key, item] of this.knownItems) {
      if (!currentIds.has(item.id)) this.knownItems.delete(key);
    }
  }
}
