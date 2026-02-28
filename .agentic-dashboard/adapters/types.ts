import type { Session } from "../server/types.js";

export interface WorkspacePath {
  tool: string;
  workspace: string;
  path: string;
}

export interface Disposable {
  dispose(): void;
}

export interface ToolAdapter {
  name: string;
  detect(): Promise<WorkspacePath[]>;
  scan(workspacePath: WorkspacePath): Promise<Session>;
  watch(
    workspacePath: WorkspacePath,
    onChange: (session: Session) => void,
  ): Disposable;
  watchForNew?(
    onAdded: (wp: WorkspacePath) => void,
    onRemoved: (wp: WorkspacePath) => void,
  ): Disposable;
}
