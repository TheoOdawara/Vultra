/**
 * VULTRA — RH Portal API Client
 */

import type {
  ApiError,
  ListMembersQuery,
  ListMembersResponse,
  AttendanceReportQuery,
  AttendanceReportResponse,
  WellbeingReportQuery,
  WellbeingReportResponse,
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
    return request(`/members${buildQuery((q ?? {}) as unknown as Record<string, string | number | boolean | undefined>)}`);
  },
};

export const reportsApi = {
  attendance(q: AttendanceReportQuery): Promise<AttendanceReportResponse> {
    return request(`/reports/attendance${buildQuery(q as unknown as Record<string, string | number | boolean | undefined>)}`);
  },
  wellbeing(q: WellbeingReportQuery): Promise<WellbeingReportResponse> {
    return request(`/reports/wellbeing${buildQuery(q as unknown as Record<string, string | number | boolean | undefined>)}`);
  },
};
