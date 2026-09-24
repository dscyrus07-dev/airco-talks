"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WebSocketClient, type ConnectionStatus, type ServerMessageHandler } from "@/lib/websocket-client";
import type { ClientMessage } from "@airco-talks/shared";

/**
 * React wrapper around {@link WebSocketClient}. Owns the connection lifecycle
 * and exposes a stable `send` plus a `subscribe` for incoming messages.
 */
export function useWebSocket(url: string) {
  const clientRef = useRef<WebSocketClient | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");

  if (!clientRef.current && typeof window !== "undefined") {
    clientRef.current = new WebSocketClient(url);
  }

  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;
    const unsub = client.onStatus(setStatus);
    return () => {
      unsub();
      client.disconnect();
    };
  }, []);

  const connect = useCallback(() => clientRef.current?.connect(), []);
  const disconnect = useCallback(() => clientRef.current?.disconnect(), []);
  const send = useCallback((message: ClientMessage) => clientRef.current?.send(message), []);
  const subscribe = useCallback((handler: ServerMessageHandler) => {
    const client = clientRef.current;
    if (!client) return () => undefined;
    return client.onMessage(handler);
  }, []);

  return useMemo(
    () => ({ status, connect, disconnect, send, subscribe }),
    [status, connect, disconnect, send, subscribe],
  );
}
