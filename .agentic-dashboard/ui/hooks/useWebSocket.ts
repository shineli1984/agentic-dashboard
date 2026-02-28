import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardState, WsMessage } from "../../server/types.js";

const RECONNECT_DELAY_MS = 2000;
const INITIAL_STATE: DashboardState = { workspaces: [], attentionItems: [], workItems: [], boardCards: [] };

export function useWebSocket(url: string) {
  const [state, setState] = useState<DashboardState>(INITIAL_STATE);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => { setConnected(true); };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as WsMessage;
      switch (msg.type) {
        case "state": setState(msg.data); break;
        case "attention": setState((prev) => ({ ...prev, attentionItems: [...prev.attentionItems, msg.data] })); break;
        case "attention_resolved": setState((prev) => ({ ...prev, attentionItems: prev.attentionItems.filter((i) => i.id !== msg.data.id) })); break;
      }
    };
    ws.onclose = () => { setConnected(false); wsRef.current = null; reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS); };
    ws.onerror = () => { ws.close(); };
  }, [url]);

  useEffect(() => {
    connect();
    return () => { if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current); wsRef.current?.close(); };
  }, [connect]);

  return { state, connected };
}
