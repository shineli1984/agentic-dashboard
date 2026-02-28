import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { AdapterRegistry } from "./adapter-registry.js";
import { AttentionEngine } from "./attention-engine.js";
import { BoardEngine } from "./board-engine.js";
import { WorkflowScanner } from "./workflow-scanner.js";
import type { DashboardState, WsMessage } from "./types.js";
import { ClaudeCodeAdapter } from "../adapters/claude-code.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? "4200", 10);

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

let state: DashboardState = { workspaces: [], attentionItems: [], workItems: [], boardCards: [] };
const clients = new Set<WebSocket>();

app.use(express.static(path.join(__dirname, "../dist-ui")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", workspaces: state.workspaces.length, attentionItems: state.attentionItems.length });
});

app.get("/api/state", (_req, res) => { res.json(state); });

app.get("/api/work-items", (req, res) => {
  const workspace = req.query.workspace as string | undefined;
  if (workspace) {
    res.json({ workItems: state.workItems.filter((wi) => state.workspaces.some((ws) => ws.id === workspace && ws.sessions.some((s) => s.id === wi.sessionId))) });
  } else {
    res.json({ workItems: state.workItems });
  }
});

wss.on("connection", (ws) => {
  clients.add(ws);
  const msg: WsMessage = { type: "state", data: state };
  ws.send(JSON.stringify(msg));
  ws.on("close", () => { clients.delete(ws); });
});

function broadcast(message: WsMessage): void {
  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}

const registry = new AdapterRegistry();
const attention = new AttentionEngine();
const board = new BoardEngine();
const scanner = new WorkflowScanner();

const claudeAdapter = new ClaudeCodeAdapter();
registry.registerAdapter(claudeAdapter);

registry.onStateChange((updatedState) => {
  state = { ...state, workspaces: updatedState.workspaces };
  state.attentionItems = attention.evaluate(state);
  state.boardCards = board.evaluate(state);
  broadcast({ type: "state", data: state });
});

app.delete("/api/board/:cardId", (req, res) => {
  const ok = board.dismiss(req.params.cardId);
  if (!ok) return res.status(400).json({ error: "Card not found or not in done stage" });
  state.boardCards = board.evaluate(state);
  broadcast({ type: "state", data: state });
  res.json({ ok: true });
});

async function start(): Promise<void> {
  await registry.initialize();
  // Run workflow scan after adapters have loaded session data
  try {
    state.workItems = await scanner.scan(state.workspaces);
    console.log(`Workflow scanner found ${state.workItems.length} work items`);
  } catch (err) {
    console.warn("Workflow scan failed:", err);
  }
  httpServer.listen(PORT, () => {
    console.log(`Agentic Dashboard running at http://localhost:${PORT}`);
  });
}

start().catch((err) => { console.error("Failed to start dashboard:", err); process.exit(1); });
