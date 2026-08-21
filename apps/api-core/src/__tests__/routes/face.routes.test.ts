import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import Elysia from "elysia";
import {
  AIServiceUnavailableError,
  BiometricProfileNotFoundError,
  DomainError,
  UnauthorizedError,
} from "../../core/domain/errors/DomainError.ts";
import type {
  BiometricProfileLookup,
  SimilarityMatch,
} from "../../core/ports/IBiometricRepository.ts";
import { httpPlugin } from "../../shared/infra/http/http.plugin.ts";

import { environmentModulePath, mockedEnvironment } from "../environment.mock.ts";

mock.module(environmentModulePath, () => ({ env: mockedEnvironment }));

const authPluginPath = import.meta.resolve("../../adapters/http/middleware/auth.plugin.ts");
const biometricsRepoPath = import.meta.resolve(
  "../../adapters/repositories/biometric.repository.ts"
);
const auditLogRepoPath = import.meta.resolve("../../adapters/repositories/audit-log.repository.ts");
const dbClientPath = import.meta.resolve("../../infrastructure/database/client.ts");

type ListFaceResponseItem = {
  profileId: string;
  organizationId: string;
  memberId: string;
  modelVersion: string;
  qualityScore: number;
  isActive: boolean;
  deviceId: string | null;
  createdBy: string | null;
  enrolledAt: string;
  lastMatchedAt: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
};

type RouteState = {
  currentOrg: string;
  currentUserId: string;
  currentRole: string;
  repoConstructorArgs: unknown[][];
  auditConstructorArgs: unknown[][];
  aiCalls: Array<{
    jobId: string;
    frameBase64: string;
    organizationId: string;
    deviceId?: string;
  }>;
  repoCalls: {
    enroll: Array<{
      organizationId: string;
      memberId: string;
      faceEmbedding: number[];
      qualityScore: number;
      modelVersion?: string;
    }>;
    findBySimilarity: Array<{
      embedding: number[];
      organizationId: string;
      modelVersion?: string;
      memberId?: string;
    }>;
    findByOrgAndMember: Array<{ organizationId: string; memberId?: string }>;
    findActiveProfileById: Array<{ profileId: string; organizationId: string }>;
    revoke: Array<{ profileId: string; organizationId: string; deletedBy: string }>;
    touchLastMatched: Array<{ memberId: string; organizationId: string }>;
  };
  auditCalls: Array<Record<string, unknown>>;
  results: {
    list: ListFaceResponseItem[];
    similarity: SimilarityMatch | null;
  };
  errors: {
    enroll: unknown;
    verify: unknown;
    list: unknown;
    revoke: unknown;
  };
};

const routeState: RouteState = {
  currentOrg: "org-1",
  currentUserId: "user-1",
  currentRole: "admin",
  repoConstructorArgs: [] as unknown[][],
  auditConstructorArgs: [] as unknown[][],
  aiCalls: [],
  repoCalls: {
    enroll: [],
    findBySimilarity: [],
    findByOrgAndMember: [],
    findActiveProfileById: [],
    revoke: [],
    touchLastMatched: [],
  },
  auditCalls: [],
  results: {
    list: [
      {
        profileId: "profile-1",
        organizationId: "org-1",
        memberId: "member-1",
        modelVersion: "ArcFace-v1",
        qualityScore: 0.91,
        isActive: true,
        deviceId: null,
        createdBy: "user-1",
        enrolledAt: "2026-04-25T00:00:00.000Z",
        lastMatchedAt: null,
        deletedAt: null,
        deletedBy: null,
      },
    ],
    similarity: {
      profileId: "profile-1",
      memberId: "member-1",
      similarity: 0.91,
      modelVersion: "ArcFace-v1",
    },
  },
  errors: {
    enroll: null as unknown,
    verify: null as unknown,
    list: null as unknown,
    revoke: null as unknown,
  },
};

function resetRouteState() {
  routeState.currentOrg = "org-1";
  routeState.currentUserId = "user-1";
  routeState.currentRole = "admin";
  routeState.repoConstructorArgs = [];
  routeState.auditConstructorArgs = [];
  routeState.aiCalls = [];
  routeState.repoCalls.enroll = [];
  routeState.repoCalls.findBySimilarity = [];
  routeState.repoCalls.findByOrgAndMember = [];
  routeState.repoCalls.findActiveProfileById = [];
  routeState.repoCalls.revoke = [];
  routeState.repoCalls.touchLastMatched = [];
  routeState.auditCalls = [];
  routeState.results.list = [
    {
      profileId: "profile-1",
      organizationId: "org-1",
      memberId: "member-1",
      modelVersion: "ArcFace-v1",
      qualityScore: 0.91,
      isActive: true,
      deviceId: null,
      createdBy: "user-1",
      enrolledAt: "2026-04-25T00:00:00.000Z",
      lastMatchedAt: null,
      deletedAt: null,
      deletedBy: null,
    },
  ];
  routeState.results.similarity = {
    profileId: "profile-1",
    memberId: "member-1",
    similarity: 0.91,
    modelVersion: "ArcFace-v1",
  };
  routeState.errors.enroll = null;
  routeState.errors.verify = null;
  routeState.errors.list = null;
  routeState.errors.revoke = null;
}

mock.module(authPluginPath, () => ({
  authPlugin: new Elysia({ name: "auth-plugin-mock" }).derive({ as: "scoped" }, ({ headers }) => {
    if (!headers.authorization) {
      throw new UnauthorizedError();
    }

    return {
      currentUser: {
        id: headers["x-test-user-id"] ?? routeState.currentUserId,
        role: headers["x-test-role"] ?? routeState.currentRole,
      },
      currentOrg: headers["x-test-org"] ?? routeState.currentOrg,
    };
  }),
}));

mock.module(biometricsRepoPath, () => ({
  BiometricsRepository: class BiometricsRepository {
    constructor(...args: unknown[]) {
      routeState.repoConstructorArgs.push(args);
    }

    async enroll(params: {
      organizationId: string;
      memberId: string;
      faceEmbedding: number[];
      qualityScore: number;
      modelVersion?: string;
    }) {
      routeState.repoCalls.enroll.push(params);

      if (routeState.errors.enroll) {
        throw routeState.errors.enroll;
      }

      return routeState.results.list[0]?.profileId ?? "profile-1";
    }

    async findBySimilarity(
      embedding: number[],
      organizationId: string,
      modelVersion?: string,
      memberId?: string
    ) {
      routeState.repoCalls.findBySimilarity.push({
        embedding,
        organizationId,
        ...(modelVersion ? { modelVersion } : {}),
        ...(memberId ? { memberId } : {}),
      });

      if (routeState.errors.verify) {
        throw routeState.errors.verify;
      }

      return routeState.results.similarity;
    }

    async findByOrgAndMember(organizationId: string, memberId?: string) {
      routeState.repoCalls.findByOrgAndMember.push({
        organizationId,
        ...(memberId ? { memberId } : {}),
      });

      if (memberId && routeState.errors.verify) {
        throw routeState.errors.verify;
      }

      if (routeState.errors.list) {
        throw routeState.errors.list;
      }

      return routeState.results.list.map(
        (profile): BiometricProfileLookup => ({
          ...profile,
          enrolledAt: new Date(profile.enrolledAt),
          lastMatchedAt: profile.lastMatchedAt ? new Date(profile.lastMatchedAt) : null,
          deletedAt: profile.deletedAt ? new Date(profile.deletedAt) : null,
        })
      );
    }

    async findActiveProfileById(profileId: string, organizationId: string) {
      routeState.repoCalls.findActiveProfileById.push({ profileId, organizationId });

      if (routeState.errors.revoke) {
        return null;
      }

      const profile = routeState.results.list.find(
        (candidate) =>
          candidate.profileId === profileId && candidate.organizationId === organizationId
      );

      if (!profile) {
        return null;
      }

      return {
        ...profile,
        enrolledAt: new Date(profile.enrolledAt),
        lastMatchedAt: profile.lastMatchedAt ? new Date(profile.lastMatchedAt) : null,
        deletedAt: profile.deletedAt ? new Date(profile.deletedAt) : null,
      };
    }

    async touchLastMatched(memberId: string, organizationId: string) {
      routeState.repoCalls.touchLastMatched.push({ memberId, organizationId });
    }

    async revoke(profileId: string, organizationId: string, deletedBy: string) {
      routeState.repoCalls.revoke.push({ profileId, organizationId, deletedBy });
      return !routeState.errors.revoke;
    }
  },
}));

mock.module(auditLogRepoPath, () => ({
  AuditLogRepository: class AuditLogRepository {
    constructor(...args: unknown[]) {
      routeState.auditConstructorArgs.push(args);
    }

    async insert(params: Record<string, unknown>) {
      routeState.auditCalls.push(params);
    }
  },
}));

mock.module(dbClientPath, () => ({
  db: { mocked: true },
}));

async function createApp() {
  const { faceRoutes, initFaceRoutes } = await import("../../adapters/http/routes/face.routes.ts");

  initFaceRoutes({
    async enqueueAndAwait(params: {
      jobId: string;
      frameBase64: string;
      organizationId: string;
      deviceId?: string;
    }) {
      routeState.aiCalls.push(params);

      const error = routeState.errors.enroll ?? routeState.errors.verify;
      if (error) {
        throw error;
      }

      return {
        embedding: [0.11, 0.22, 0.33],
        qualityScore: routeState.results.list[0]?.qualityScore ?? 0.91,
        processingMs: 98,
      };
    },
    async getCircuitState() {
      return "CLOSED";
    },
  } as unknown as Parameters<typeof initFaceRoutes>[0]);

  return new Elysia().use(httpPlugin).group("/v1", (v1) => v1.use(faceRoutes));
}

async function requestJson(
  app: Awaited<ReturnType<typeof createApp>>,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  } = {}
) {
  const headers = new Headers(options.headers);

  if (options.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? null : JSON.stringify(options.body),
    })
  );

  const text = await response.text();
  const trimmed = text.trim();
  const body = !trimmed
    ? null
    : trimmed.startsWith("{") || trimmed.startsWith("[")
      ? JSON.parse(trimmed)
      : trimmed;

  return {
    response,
    body,
  };
}

function authenticatedHeaders(overrides: Record<string, string> = {}) {
  return {
    authorization: "Bearer test-token",
    ...overrides,
  };
}

beforeEach(() => {
  resetRouteState();
});

afterAll(() => {
  mock.restore();
});

describe("/v1/face routes", () => {
  it("POST /v1/face/enroll deve responder 201 no caminho feliz", async () => {
    const app = await createApp();

    const { response, body } = await requestJson(app, "/v1/face/enroll", {
      method: "POST",
      headers: authenticatedHeaders({
        "x-forwarded-for": "203.0.113.10, 198.51.100.1",
      }),
      body: {
        memberId: "11111111-1111-1111-1111-111111111111",
        frameBase64: "frame-base64",
      },
    });

    expect(response.status).toBe(201);
    expect(body).toEqual({
      profileId: "profile-1",
      qualityScore: 0.91,
      modelVersion: "ArcFace-v1",
      processingMs: 98,
    });
    expect(routeState.auditCalls).toEqual([
      {
        organizationId: "org-1",
        actorId: "user-1",
        actorType: "user",
        action: "BIOMETRIC_PROFILE_ENROLLED",
        resourceType: "biometric_profiles",
        resourceId: "profile-1",
        ipAddress: "203.0.113.10",
        payload: {
          profile_id: "profile-1",
          member_id: "11111111-1111-1111-1111-111111111111",
          quality_score: 0.91,
          model_version: "ArcFace-v1",
        },
      },
    ]);
  });

  it("POST /v1/face/verify deve responder 200 no caminho feliz", async () => {
    const app = await createApp();

    const { response, body } = await requestJson(app, "/v1/face/verify", {
      method: "POST",
      headers: authenticatedHeaders({
        "x-real-ip": "198.51.100.20",
      }),
      body: {
        memberId: "11111111-1111-1111-1111-111111111111",
        frameBase64: "frame-base64",
      },
    });

    expect(response.status).toBe(200);
    expect(body).toEqual({
      result: "MATCH",
      memberId: "member-1",
      confidence: 0.91,
      processingMs: 98,
    });
    expect(routeState.auditCalls).toEqual([
      {
        organizationId: "org-1",
        actorId: "user-1",
        actorType: "user",
        action: "BIOMETRIC_PROFILE_VERIFIED",
        resourceType: "biometric_profiles",
        resourceId: "profile-1",
        ipAddress: "198.51.100.20",
        payload: {
          result: "MATCH",
          confidence: 0.91,
          requested_member_id: "11111111-1111-1111-1111-111111111111",
          matched_member_id: "member-1",
          matched_profile_id: "profile-1",
        },
      },
    ]);
  });

  it("GET /v1/face/list deve responder 200 no caminho feliz", async () => {
    const app = await createApp();

    const { response, body } = await requestJson(
      app,
      "/v1/face/list?memberId=11111111-1111-1111-1111-111111111111",
      {
        headers: authenticatedHeaders(),
      }
    );

    expect(response.status).toBe(200);
    expect(body).toEqual(routeState.results.list);
  });

  it("DELETE /v1/face/:profileId deve responder 200 no caminho feliz", async () => {
    const app = await createApp();

    const { response, body } = await requestJson(app, "/v1/face/profile-1", {
      method: "DELETE",
      headers: authenticatedHeaders({
        "x-forwarded-for": "192.0.2.55",
      }),
    });

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(routeState.auditCalls).toEqual([
      {
        organizationId: "org-1",
        actorId: "user-1",
        actorType: "user",
        action: "BIOMETRIC_PROFILE_REVOKED",
        resourceType: "biometric_profiles",
        resourceId: "profile-1",
        ipAddress: "192.0.2.55",
        payload: {
          profile_id: "profile-1",
          member_id: "member-1",
          deleted_by: "user-1",
        },
      },
    ]);
  });

  it("deve bloquear input inválido via TypeBox com 422 em POST /v1/face/enroll", async () => {
    const app = await createApp();

    const { response } = await requestJson(app, "/v1/face/enroll", {
      method: "POST",
      headers: authenticatedHeaders(),
      body: {
        memberId: "uuid-invalido",
        frameBase64: "",
      },
    });

    expect(response.status).toBe(422);
  });

  it("deve bloquear input inválido via TypeBox com 422 em POST /v1/face/verify", async () => {
    const app = await createApp();

    const { response } = await requestJson(app, "/v1/face/verify", {
      method: "POST",
      headers: authenticatedHeaders(),
      body: {
        memberId: 123,
        frameBase64: "",
      },
    });

    expect(response.status).toBe(422);
  });

  it("deve bloquear input inválido via TypeBox com 422 em GET /v1/face/list", async () => {
    const app = await createApp();

    const { response } = await requestJson(app, "/v1/face/list?memberId=uuid-invalido", {
      headers: authenticatedHeaders(),
    });

    expect(response.status).toBe(422);
  });

  it("deve bloquear input inválido via TypeBox com 422 em DELETE /v1/face/:profileId", async () => {
    const app = await createApp();

    const { response } = await requestJson(app, "/v1/face/profile-invalido", {
      method: "DELETE",
      headers: authenticatedHeaders(),
    });

    expect(response.status).toBe(422);
  });

  it("deve rejeitar payload acima de 1MB em POST /v1/face/enroll com 413", async () => {
    const app = await createApp();

    const { response } = await requestJson(app, "/v1/face/enroll", {
      method: "POST",
      headers: authenticatedHeaders(),
      body: {
        memberId: "11111111-1111-1111-1111-111111111111",
        frameBase64: "a".repeat(1024 * 1024 + 1),
      },
    });

    expect(response.status).toBe(413);
  });

  it("deve rejeitar payload acima de 1MB em POST /v1/face/verify com 413", async () => {
    const app = await createApp();

    const { response } = await requestJson(app, "/v1/face/verify", {
      method: "POST",
      headers: authenticatedHeaders(),
      body: {
        frameBase64: "a".repeat(1024 * 1024 + 1),
      },
    });

    expect(response.status).toBe(413);
  });

  for (const route of [
    {
      method: "POST",
      path: "/v1/face/enroll",
      body: { memberId: "11111111-1111-1111-1111-111111111111", frameBase64: "frame" },
    },
    { method: "POST", path: "/v1/face/verify", body: { frameBase64: "frame" } },
    { method: "GET", path: "/v1/face/list" },
    { method: "DELETE", path: "/v1/face/profile-1" },
  ]) {
    it(`deve responder 401 sem token em ${route.method} ${route.path}`, async () => {
      const app = await createApp();

      const { response, body } = await requestJson(app, route.path, {
        method: route.method,
        body: route.body,
      });

      expect(response.status).toBe(401);
      expect(body).toEqual({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
          correlationId: expect.any(String),
        },
      });
    });
  }

  for (const route of [
    {
      method: "POST",
      path: "/v1/face/enroll",
      body: { memberId: "11111111-1111-1111-1111-111111111111", frameBase64: "frame" },
    },
    { method: "POST", path: "/v1/face/verify", body: { frameBase64: "frame" } },
    { method: "GET", path: "/v1/face/list" },
    { method: "DELETE", path: "/v1/face/profile-1" },
  ]) {
    it(`deve responder 403 quando a role não tiver permissão em ${route.method} ${route.path}`, async () => {
      const app = await createApp();

      const { response } = await requestJson(app, route.path, {
        method: route.method,
        headers: authenticatedHeaders({
          "x-test-role": "student",
        }),
        body: route.body,
      });

      expect(response.status).toBe(403);
    });
  }

  it("POST /v1/face/enroll deve responder 404 quando o memberId não pertencer ao tenant atual", async () => {
    routeState.errors.enroll = new DomainError(
      "MEMBER_NOT_FOUND",
      404,
      "Member not found in tenant"
    );
    const app = await createApp();

    const { response, body } = await requestJson(app, "/v1/face/enroll", {
      method: "POST",
      headers: authenticatedHeaders({
        "x-test-org": "org-b",
      }),
      body: {
        memberId: "22222222-2222-2222-2222-222222222222",
        frameBase64: "frame-base64",
      },
    });

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: {
        code: "MEMBER_NOT_FOUND",
        message: "Member not found in tenant",
        correlationId: expect.any(String),
      },
    });
  });

  it("POST /v1/face/verify deve responder 404 em isolamento entre organizações", async () => {
    routeState.errors.verify = new DomainError(
      "MEMBER_NOT_FOUND",
      404,
      "Member not found in tenant"
    );
    const app = await createApp();

    const { response } = await requestJson(app, "/v1/face/verify", {
      method: "POST",
      headers: authenticatedHeaders({
        "x-test-org": "org-b",
      }),
      body: {
        memberId: "22222222-2222-2222-2222-222222222222",
        frameBase64: "frame-base64",
      },
    });

    expect(response.status).toBe(404);
  });

  it("GET /v1/face/list deve responder 404 em isolamento entre organizações", async () => {
    routeState.errors.list = new DomainError("MEMBER_NOT_FOUND", 404, "Member not found in tenant");
    const app = await createApp();

    const { response } = await requestJson(
      app,
      "/v1/face/list?memberId=22222222-2222-2222-2222-222222222222",
      {
        headers: authenticatedHeaders({
          "x-test-org": "org-b",
        }),
      }
    );

    expect(response.status).toBe(404);
  });

  it("DELETE /v1/face/:profileId deve responder 404 em isolamento entre organizações", async () => {
    routeState.errors.revoke = new BiometricProfileNotFoundError();
    const app = await createApp();

    const { response } = await requestJson(app, "/v1/face/profile-org-a", {
      method: "DELETE",
      headers: authenticatedHeaders({
        "x-test-org": "org-b",
      }),
    });

    expect(response.status).toBe(404);
  });

  it("deve responder 429 quando o burst exceder o limite por usuário", async () => {
    const app = await createApp();

    const responses = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      responses.push(
        await requestJson(app, "/v1/face/verify", {
          method: "POST",
          headers: authenticatedHeaders(),
          body: { frameBase64: "frame-base64" },
        })
      );
    }

    const last = responses[responses.length - 1];

    if (!last) {
      throw new Error("Nenhuma resposta foi capturada para o cenário de rate limiting");
    }

    expect(last.response.status).toBe(429);
    expect(last.response.headers.get("retry-after")).toBeTruthy();
  });

  it("POST /v1/face/enroll deve responder 503 + AI_SERVICE_UNAVAILABLE quando o AI Service estiver indisponível", async () => {
    routeState.errors.enroll = new AIServiceUnavailableError(17);
    const app = await createApp();

    const { response, body } = await requestJson(app, "/v1/face/enroll", {
      method: "POST",
      headers: authenticatedHeaders(),
      body: {
        memberId: "11111111-1111-1111-1111-111111111111",
        frameBase64: "frame-base64",
      },
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("17");
    expect(body).toEqual({
      error: {
        code: "AI_SERVICE_UNAVAILABLE",
        message: "AI service is currently unavailable",
        correlationId: expect.any(String),
      },
    });
  });

  it("POST /v1/face/verify deve responder 503 + AI_SERVICE_UNAVAILABLE quando o circuit breaker estiver aberto", async () => {
    routeState.errors.verify = new AIServiceUnavailableError(11);
    const app = await createApp();

    const { response, body } = await requestJson(app, "/v1/face/verify", {
      method: "POST",
      headers: authenticatedHeaders(),
      body: {
        frameBase64: "frame-base64",
      },
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("11");
    expect(body).toEqual({
      error: {
        code: "AI_SERVICE_UNAVAILABLE",
        message: "AI service is currently unavailable",
        correlationId: expect.any(String),
      },
    });
  });

  it("POST /v1/face/verify deve responder 503 sem Retry-After quando não houver cooldown conhecido", async () => {
    routeState.errors.verify = Object.assign(new AIServiceUnavailableError(30), {
      retryAfter: undefined,
    });
    const app = await createApp();

    const { response, body } = await requestJson(app, "/v1/face/verify", {
      method: "POST",
      headers: authenticatedHeaders(),
      body: {
        frameBase64: "frame-base64",
      },
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBeNull();
    expect(body).toEqual({
      error: {
        code: "AI_SERVICE_UNAVAILABLE",
        message: "AI service is currently unavailable",
        correlationId: expect.any(String),
      },
    });
  });
});

describe("cutover legado /v1/biometric", () => {
  for (const legacyRoute of [
    {
      method: "POST",
      path: "/v1/biometric/enroll",
      body: {
        memberId: "11111111-1111-1111-1111-111111111111",
        frameBase64: "frame-base64",
      },
    },
    {
      method: "POST",
      path: "/v1/biometric/verify",
      body: {
        frameBase64: "frame-base64",
      },
    },
    {
      method: "GET",
      path: "/v1/biometric/list?memberId=11111111-1111-1111-1111-111111111111",
    },
    {
      method: "DELETE",
      path: "/v1/biometric/profile-1",
    },
  ]) {
    it(`${legacyRoute.method} ${legacyRoute.path} deve responder 404 após o cutover`, async () => {
      const app = await createApp();

      const { response, body } = await requestJson(app, legacyRoute.path, {
        method: legacyRoute.method,
        headers: authenticatedHeaders(),
        body: legacyRoute.body,
      });

      expect(response.status).toBe(404);
      expect(body).toEqual({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
          correlationId: expect.any(String),
        },
      });
      expect(routeState.aiCalls).toHaveLength(0);
      expect(routeState.repoCalls.enroll).toHaveLength(0);
      expect(routeState.repoCalls.findBySimilarity).toHaveLength(0);
      expect(routeState.repoCalls.findByOrgAndMember).toHaveLength(0);
      expect(routeState.repoCalls.findActiveProfileById).toHaveLength(0);
      expect(routeState.repoCalls.revoke).toHaveLength(0);
      expect(routeState.auditCalls).toHaveLength(0);
    });
  }
});
