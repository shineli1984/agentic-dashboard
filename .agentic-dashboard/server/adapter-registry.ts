import type { ToolAdapter, WorkspacePath } from "../adapters/types.js";
import type { Session, Workspace } from "./types.js";

type StateChangeCallback = (state: { workspaces: Workspace[] }) => void;

export class AdapterRegistry {
  private adapters: ToolAdapter[] = [];
  private workspaces = new Map<string, Workspace>();
  private listeners: StateChangeCallback[] = [];
  private disposables: Array<{ dispose(): void }> = [];
  private watchedPaths = new Set<string>();

  registerAdapter(adapter: ToolAdapter): void {
    this.adapters.push(adapter);
  }

  onStateChange(callback: StateChangeCallback): void {
    this.listeners.push(callback);
  }

  async initialize(): Promise<void> {
    for (const adapter of this.adapters) {
      const paths = await adapter.detect();
      for (const wp of paths) {
        await this.onboardWorkspace(adapter, wp);
      }

      if (adapter.watchForNew) {
        const disposable = adapter.watchForNew(
          (wp) => {
            this.onboardWorkspace(adapter, wp).then(() => this.notifyListeners());
          },
          (wp) => {
            this.removeWorkspace(adapter.name, wp);
            this.notifyListeners();
          },
        );
        this.disposables.push(disposable);
      }
    }
    this.notifyListeners();
  }

  private async onboardWorkspace(adapter: ToolAdapter, wp: WorkspacePath): Promise<void> {
    const key = `${adapter.name}:${wp.workspace}`;
    if (this.watchedPaths.has(key)) return;
    this.watchedPaths.add(key);

    const session = await adapter.scan(wp);
    this.upsertSession(adapter.name, wp, session);
    const disposable = adapter.watch(wp, (updatedSession) => {
      this.upsertSession(adapter.name, wp, updatedSession);
      this.notifyListeners();
    });
    this.disposables.push(disposable);
  }

  private removeWorkspace(tool: string, wp: WorkspacePath): void {
    const workspaceId = `${tool}:${wp.workspace}`;
    this.workspaces.delete(workspaceId);
    this.watchedPaths.delete(workspaceId);
  }

  private upsertSession(tool: string, wp: WorkspacePath, session: Session): void {
    const workspaceId = `${tool}:${wp.workspace}`;
    let workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      workspace = { id: workspaceId, name: wp.workspace, path: wp.path, tool, sessions: [] };
      this.workspaces.set(workspaceId, workspace);
    }
    const idx = workspace.sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      workspace.sessions[idx] = session;
    } else {
      workspace.sessions.push(session);
    }
  }

  private notifyListeners(): void {
    const state = { workspaces: Array.from(this.workspaces.values()) };
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  dispose(): void {
    for (const d of this.disposables) { d.dispose(); }
    this.disposables = [];
  }
}
