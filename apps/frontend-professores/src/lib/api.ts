/**
 * VULTRA — Professor Portal API Client
 */

import type {
  ApiError,
  ListMembersQuery,
  ListMembersResponse,
  GetMemberResponse,
  OpenSessionBody,
  OpenSessionResponse,
  CloseSessionResponse,
  ManualRecordBody,
  ManualRecordResponse,
  AttendanceReportQuery,
  AttendanceReportResponse,
} from "@vultra/types";

const BASE = "/api/v1";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "include",
    ...init,
  });

  if (!res.ok) {
    let body: ApiError = { error: "UNKNOWN_ERROR" };
    try { body = (await res.json()) as ApiError; } catch { /* ignore */ }
    throw new ApiClientError(res.status, body.error, body.error);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export const membersApi = {
  list(q?: ListMembersQuery): Promise<ListMembersResponse> {
    return request(`/members${buildQuery((q ?? {}) as Record<string, string | number | boolean | undefined>)}`);
  },
  get(id: string): Promise<GetMemberResponse> {
    return request(`/members/${id}`);
  },
};

export const attendanceApi = {
  openSession(body: OpenSessionBody): Promise<OpenSessionResponse> {
    return request("/attendance/sessions", { method: "POST", body: JSON.stringify(body) });
  },
  closeSession(sessionId: string): Promise<CloseSessionResponse> {
    return request(`/attendance/sessions/${sessionId}`, { method: "DELETE" });
  },
  manualRecord(sessionId: string, body: ManualRecordBody): Promise<ManualRecordResponse> {
    return request(`/attendance/sessions/${sessionId}/records/manual`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};

export const reportsApi = {
  attendance(q: AttendanceReportQuery): Promise<AttendanceReportResponse> {
    return request(`/reports/attendance${buildQuery(q as Record<string, string | number | boolean | undefined>)}`);
  },
};
