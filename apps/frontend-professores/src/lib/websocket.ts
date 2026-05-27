"use client";

/**
 * VULTRA — Live Attendance Polling Hook
 *
 * Replaces the previous WebSocket implementation with polling against
 * GET /v1/attendance/sessions/:id/records.
 *
 * The API Core does not expose a WebSocket endpoint; polling is the
 * supported real-time mechanism for the professor portal.
 *
 * LGPD: Only derived metadata is returned — no frames or embeddings.
 */

import { useQuery } from "@tanstack/react-query";
import { attendanceApi } from "./api";
import type { SessionAttendanceRecord } from "@vultra/types";

/** Poll interval in milliseconds (5 s). */
const POLL_INTERVAL_MS = 5_000;

export type { SessionAttendanceRecord };

export function useAttendancePolling(sessionId: string | null) {
  const { data, isFetching, isError } = useQuery({
    queryKey: ["attendance", "records", sessionId],
    queryFn: () => attendanceApi.listRecords(sessionId!),
    enabled: !!sessionId,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });

  return {
    records: data?.records ?? [],
    isFetching,
    isError,
  };
}
