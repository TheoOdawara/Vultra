/**
 * VULTRA — Admin Portal API Client
 *
 * Typed fetch wrapper around the API Core (/v1/*).
 * All requests go through Next.js rewrites → /api/v1/* → API Core /v1/*
 *
 * Conventions:
 * - All methods are async and throw on non-2xx responses
 * - organizationId is always sourced from the auth context, never from input
 * - Dates are returned as ISO 8601 strings (API always serializes Date → string)
 */

import type {
  ApiError,
  AiServiceHealthResponse,
  CreateMemberBody,
  CreateMemberResponse,
  DeactivateMemberResponse,
  GetMemberResponse,
  ListMembersQuery,
  ListMembersResponse,
  UpdateMemberBody,
  UpdateMemberResponse,
  ListDevicesResponse,
  RegisterDeviceBody,
  RegisterDeviceResponse,
  UpdateDeviceBody,
  UpdateDeviceResponse,
  RotateDeviceKeyResponse,
  DeactivateDeviceResponse,
  AttendanceReportQuery,
  AttendanceReportResponse,
  WellbeingReportQuery,
  WellbeingReportResponse,
  ListFacesQuery,
  ListFacesResponse,
  DeleteFaceResponse,
} from "@vultra/types";

// ── Base ───────────────────────────────────────────────────────────────────────

const BASE = "/api/v1";

class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "include",
    ...init,
  });

  if (!res.ok) {
    let body: ApiError = { error: "UNKNOWN_ERROR" };
    try {
      body = (await res.json()) as ApiError;
    } catch {
      // ignore parse failure
    }
    throw new ApiClientError(res.status, body.error, body.error);
  }

  // 204 No Content
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

// ── Members ────────────────────────────────────────────────────────────────────

export const membersApi = {
  list(q?: ListMembersQuery): Promise<ListMembersResponse> {
    return request(`/members${buildQuery(q as unknown as Record<string, string | number | boolean | undefined> ?? {})}`);
  },

  get(id: string): Promise<GetMemberResponse> {
    return request(`/members/${id}`);
  },

  create(body: CreateMemberBody): Promise<CreateMemberResponse> {
    return request("/members", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  update(id: string, body: UpdateMemberBody): Promise<UpdateMemberResponse> {
    return request(`/members/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  deactivate(id: string): Promise<DeactivateMemberResponse> {
    return request(`/members/${id}`, { method: "DELETE" });
  },
};

// ── Devices ────────────────────────────────────────────────────────────────────

export const devicesApi = {
  list(isActive?: "true" | "false" | "all"): Promise<ListDevicesResponse> {
    return request(`/devices${isActive ? `?isActive=${isActive}` : ""}`);
  },

  register(body: RegisterDeviceBody): Promise<RegisterDeviceResponse> {
    return request("/devices", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  update(id: string, body: UpdateDeviceBody): Promise<UpdateDeviceResponse> {
    return request(`/devices/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  rotateKey(id: string): Promise<RotateDeviceKeyResponse> {
    return request(`/devices/${id}/rotate-key`, { method: "POST" });
  },

  deactivate(id: string): Promise<DeactivateDeviceResponse> {
    return request(`/devices/${id}`, { method: "DELETE" });
  },
};

// ── Reports ────────────────────────────────────────────────────────────────────

export const reportsApi = {
  attendance(q: AttendanceReportQuery): Promise<AttendanceReportResponse> {
    return request(
      `/reports/attendance${buildQuery(q as unknown as unknown as Record<string, string | number | boolean | undefined>)}`
    );
  },

  wellbeing(q: WellbeingReportQuery): Promise<WellbeingReportResponse> {
    return request(
      `/reports/wellbeing${buildQuery(q as unknown as unknown as Record<string, string | number | boolean | undefined>)}`
    );
  },
};

// ── Biometrics (admin oversight) ───────────────────────────────────────────────

export const faceApi = {
  list(q?: ListFacesQuery): Promise<ListFacesResponse> {
    return request(`/face/list${buildQuery((q ?? {}) as unknown as Record<string, string | number | boolean | undefined>)}`);
  },

  revoke(profileId: string): Promise<DeleteFaceResponse> {
    return request(`/face/${profileId}`, { method: "DELETE" });
  },
};

// ── Health ─────────────────────────────────────────────────────────────────────

export const healthApi = {
  aiService(): Promise<AiServiceHealthResponse> {
    return request("/health/ai-service");
  },
};

export { ApiClientError };
