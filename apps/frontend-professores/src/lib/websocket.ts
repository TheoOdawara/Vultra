/**
 * VULTRA — Attendance WebSocket Hook
 *
 * Connects to the API Core WebSocket endpoint for real-time attendance events.
 * The WS server pushes events as new records arrive from the AI Service.
 *
 * Event types received from server:
 *   { type: "RECORD_CREATED", memberId, memberName, confidenceScore, sentimentLabel, recordedAt }
 *   { type: "SESSION_CLOSED", sessionId }
 *   { type: "AI_DEGRADED", retryAfter }
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type AttendanceEvent =
  | {
      type: "RECORD_CREATED";
      memberId: string;
      memberName: string;
      confidenceScore: number;
      sentimentLabel: string | null;
      recordedAt: string;
    }
  | { type: "SESSION_CLOSED"; sessionId: string }
  | { type: "AI_DEGRADED"; retryAfter: number };

type WsState = "connecting" | "open" | "closed" | "error";

export function useAttendanceWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<WsState>("closed");
  const [events, setEvents] = useState<AttendanceEvent[]>([]);

  const connect = useCallback(() => {
    if (!sessionId) return;

    const apiBase =
      (typeof window !== "undefined" &&
        process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, "ws")) ??
      "ws://localhost:3000";

    const ws = new WebSocket(`${apiBase}/v1/attendance/sessions/${sessionId}/ws`);
    wsRef.current = ws;
    setState("connecting");

    ws.onopen = () => setState("open");
    ws.onclose = () => setState("closed");
    ws.onerror = () => setState("error");

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data as string) as AttendanceEvent;
        setEvents((prev) => [event, ...prev].slice(0, 100)); // keep last 100
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      ws.close();
    };
  }, [sessionId]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      wsRef.current?.close();
    };
  }, [connect]);

  return { state, events };
}
