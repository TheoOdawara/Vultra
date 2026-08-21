import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import Elysia from "elysia";
import { UnauthorizedError } from "../../core/domain/errors/DomainError.ts";
import type { MemberRole, MemberSnapshot } from "../../core/ports/IMemberRepository.ts";
import { createHttpApp } from "../../shared/infra/http/http.app.ts";

const ADMIN_USER_ID = "10000000-0000-0000-0000-000000000001";
const STUDENT_USER_ID = "10000000-0000-0000-0000-000000000002";
const PROFESSOR_USER_ID = "10000000-0000-0000-0000-000000000003";
const PROFESSOR_MEMBER_ID = "20000000-0000-0000-0000-000000000003";
const OTHER_PROFESSOR_MEMBER_ID = "20000000-0000-0000-0000-000000000004";
const STUDENT_MEMBER_ID = "30000000-0000-0000-0000-000000000001";
const OTHER_MEMBER_ID = "30000000-0000-0000-0000-000000000002";
const DEVICE_ID = "40000000-0000-0000-0000-000000000001";
const SESSION_ID = "50000000-0000-0000-0000-000000000001";
const PROFILE_ID = "60000000-0000-0000-0000-000000000001";
const CLASS_ID = "70000000-0000-0000-0000-000000000001";
const ORG_ID = "80000000-0000-0000-0000-000000000001";

import { environmentModulePath, mockedEnvironment } from "../environment.mock.ts";

mock.module(environmentModulePath, () => ({ env: mockedEnvironment }));

const authPath = import.meta.resolve("../../infrastructure/auth.ts");
const containerPath = import.meta.resolve("../../infrastructure/container.ts");
const dbClientPath = import.meta.resolve("../../infrastructure/database/client.ts");
const authPluginPath = import.meta.resolve("../../adapters/http/middleware/auth.plugin.ts");
const deviceAuthPluginPath = import.meta.resolve(
  "../../adapters/http/middleware/device-auth.plugin.ts"
);
const memberRepoPath = import.meta.resolve("../../adapters/repositories/member.repository.ts");
const deviceRepoPath = import.meta.resolve("../../adapters/repositories/device.repository.ts");
const attendanceRepoPath = import.meta.resolve(
  "../../adapters/repositories/attendance.repository.ts"
);
const biometricRepoPath = import.meta.resolve(
  "../../adapters/repositories/biometric.repository.ts"
);
const auditLogRepoPath = import.meta.resolve("../../adapters/repositories/audit-log.repository.ts");
const reportsRepoPath = import.meta.resolve("../../adapters/repositories/reports.repository.ts");

type DeviceSnapshot = {
  id: string;
  organizationId: string;
  label: string;
  location: string | null;
  firmwareVersion: string | null;
  lastSeenAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type SessionSnapshot = {
  id: string;
  status: "open" | "closed" | "cancelled";
  startedAt: Date;
};

type AttendanceRecordSnapshot = {
  id: string;
  memberId: string;
  recognitionMethod: "manual" | "face";
  recordedAt: Date;
  sentimentLabel: string | null;
  sentimentScore: number | null;
};

type AttendanceReportFilter = {
  organizationId: string;
  from: Date;
  to: Date;
  classId?: string;
  professorId?: string;
};

type PermissionResource = "attendance" | "reports" | "biometrics" | "devices" | "members";
type PermissionRequest = Partial<Record<PermissionResource, readonly string[]>>;

type RouteState = {
  members: Map<string, MemberSnapshot>;
  devices: DeviceSnapshot[];
  sessions: Map<string, SessionSnapshot>;
  records: Set<string>;
  reportCalls: AttendanceReportFilter[];
  memberRepoCalls: {
    findById: Array<{ memberId: string; organizationId: string }>;
    findByUserId: Array<{ userId: string; organizationId: string }>;
  };
};

type TestApp = {
  handle: (request: Request) => Response | Promise<Response>;
};

const routeState: RouteState = {
  members: new Map(),
  devices: [],
  sessions: new Map(),
  records: new Set(),
  reportCalls: [],
  memberRepoCalls: {
    findById: [],
    findByUserId: [],
  },
};

function makeMember(overrides: Partial<MemberSnapshot> = {}): MemberSnapshot {
  return {
    id: STUDENT_MEMBER_ID,
    organizationId: ORG_ID,
    userId: STUDENT_USER_ID,
    fullName: "Aluno Teste",
    email: "aluno@example.com",
    role: "student",
    externalCode: "MAT-001",
    isActive: true,
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function resetRouteState() {
  routeState.members = new Map([
    [`${ORG_ID}:${STUDENT_MEMBER_ID}`, makeMember()],
    [
      `${ORG_ID}:${OTHER_MEMBER_ID}`,
      makeMember({
        id: OTHER_MEMBER_ID,
        userId: "10000000-0000-0000-0000-000000000099",
        fullName: "Outro Aluno",
        externalCode: "MAT-099",
      }),
    ],
    [
      `${ORG_ID}:${PROFESSOR_MEMBER_ID}`,
      makeMember({
        id: PROFESSOR_MEMBER_ID,
        userId: PROFESSOR_USER_ID,
        fullName: "Professor Teste",
        role: "professor",
        externalCode: "PROF-001",
      }),
    ],
  ]);
  routeState.devices = [
    {
      id: DEVICE_ID,
      organizationId: ORG_ID,
      label: "CAM-01",
      location: "Sala 01",
      firmwareVersion: "1.0.0",
      lastSeenAt: null,
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ];
  routeState.sessions = new Map([
    [SESSION_ID, { id: SESSION_ID, status: "open", startedAt: new Date("2026-01-01T08:00:00Z") }],
  ]);
  routeState.records = new Set();
  routeState.reportCalls = [];
  routeState.memberRepoCalls.findById = [];
  routeState.memberRepoCalls.findByUserId = [];
}

const rolePermissions: Record<MemberRole, Record<PermissionResource, readonly string[]>> = {
  admin: {
    attendance: ["write", "read"],
    reports: ["read"],
    biometrics: ["enroll", "verify", "list", "delete"],
    devices: ["manage"],
    members: ["read", "manage"],
  },
  professor: {
    attendance: ["write", "read"],
    reports: [],
    biometrics: ["enroll", "verify", "list", "delete"],
    devices: [],
    members: ["read"],
  },
  rh: {
    attendance: ["read"],
    reports: ["read"],
    biometrics: ["verify", "list"],
    devices: [],
    members: ["read"],
  },
  student: {
    attendance: ["read"],
    reports: [],
    biometrics: [],
    devices: [],
    members: [],
  },
};

function checkPermission(role: string | null | undefined, permission: PermissionRequest): boolean {
  if (!role || !(role in rolePermissions)) return false;

  const permissions = rolePermissions[role as MemberRole];
  return Object.entries(permission).every(([resource, actions]) => {
    if (!actions) return true;
    const allowedActions = permissions[resource as PermissionResource] ?? [];
    return actions.every((action) => allowedActions.includes(action));
  });
}

mock.module(authPath, () => ({
  auth: {
    handler: () => new Response("AUTH_NOT_MOCKED", { status: 404 }),
  },
  checkPermission,
}));

mock.module(authPluginPath, () => ({
  authPlugin: new Elysia({ name: "auth-plugin-mock" }).derive({ as: "scoped" }, ({ headers }) => {
    if (!headers.authorization) throw new UnauthorizedError();

    const role = (headers["x-test-role"] ?? "admin") as MemberRole;
    const userId = headers["x-test-user-id"] ?? ADMIN_USER_ID;

    return {
      currentUser: { id: userId, role },
      currentOrg: headers["x-test-org"] ?? ORG_ID,
      currentRole: role,
    };
  }),
}));

mock.module(deviceAuthPluginPath, () => ({
  deviceAuthPlugin: new Elysia({ name: "device-auth-plugin-mock" }).derive({ as: "scoped" }, () => ({
    authenticatedDevice: { id: DEVICE_ID, organizationId: ORG_ID },
  })),
}));

mock.module(dbClientPath, () => ({
  db: { mocked: true },
  withTenantContext: async <T>(_database: unknown, _organizationId: string, fn: () => Promise<T>) =>
    fn(),
}));

mock.module(containerPath, () => ({
  aiQueue: {
    async enqueueAndAwait() {
      return { embedding: [0.1, 0.2, 0.3], qualityScore: 0.91, processingMs: 10 };
    },
    async getCircuitHealth() {
      return { status: "ok", circuitState: "CLOSED", failureCount: 0, lastFailureAt: null };
    },
    async getCircuitState() {
      return "CLOSED";
    },
  },
}));

mock.module(memberRepoPath, () => ({
  MemberRepository: class MemberRepository {
    async findById(memberId: string, organizationId: string) {
      routeState.memberRepoCalls.findById.push({ memberId, organizationId });
      return routeState.members.get(`${organizationId}:${memberId}`) ?? null;
    }

    async findByUserId(userId: string, organizationId: string) {
      routeState.memberRepoCalls.findByUserId.push({ userId, organizationId });
      return (
        [...routeState.members.values()].find(
          (member) => member.organizationId === organizationId && member.userId === userId
        ) ?? null
      );
    }

    async findByExternalCode(externalCode: string, organizationId: string) {
      return (
        [...routeState.members.values()].find(
          (member) =>
            member.organizationId === organizationId && member.externalCode === externalCode
        ) ?? null
      );
    }

    async list() {
      return [...routeState.members.values()];
    }

    async count() {
      return routeState.members.size;
    }

    async create(data: {
      organizationId: string;
      fullName: string;
      role: MemberRole;
      email?: string | null;
      externalCode?: string | null;
      userId?: string | null;
    }) {
      const member = makeMember({
        id: "30000000-0000-0000-0000-000000000010",
        organizationId: data.organizationId,
        fullName: data.fullName,
        role: data.role,
        email: data.email ?? null,
        externalCode: data.externalCode ?? null,
        userId: data.userId ?? null,
      });
      routeState.members.set(`${data.organizationId}:${member.id}`, member);
      return member;
    }

    async update(memberId: string, organizationId: string, data: Partial<MemberSnapshot>) {
      const key = `${organizationId}:${memberId}`;
      const current = routeState.members.get(key);
      if (!current) return null;
      const updated = { ...current, ...data, updatedAt: new Date("2026-01-02T00:00:00Z") };
      routeState.members.set(key, updated);
      return updated;
    }

    async deactivate(memberId: string, organizationId: string) {
      return routeState.members.has(`${organizationId}:${memberId}`);
    }
  },
}));

mock.module(deviceRepoPath, () => ({
  DeviceRepository: class DeviceRepository {
    async list() {
      return routeState.devices;
    }

    async create(data: { organizationId: string; label: string; location?: string | null }) {
      return {
        device: {
          ...routeState.devices[0],
          organizationId: data.organizationId,
          label: data.label,
          location: data.location ?? null,
        },
        apiKey: "a".repeat(64),
      };
    }

    async update() {
      return routeState.devices[0];
    }

    async rotateApiKey() {
      return true;
    }

    async deactivate() {
      return true;
    }
  },
}));

mock.module(attendanceRepoPath, () => ({
  AttendanceRepository: class AttendanceRepository {
    async findSessionById(sessionId: string) {
      return routeState.sessions.get(sessionId) ?? null;
    }

    async createSession() {
      const session = { id: SESSION_ID, status: "open" as const, startedAt: new Date() };
      routeState.sessions.set(SESSION_ID, session);
      return session;
    }

    async closeSession(sessionId: string) {
      const session = routeState.sessions.get(sessionId);
      if (session) session.status = "closed";
    }

    async existsRecord(sessionId: string, memberId: string) {
      return routeState.records.has(`${sessionId}:${memberId}`);
    }

    async createManualRecord(params: { sessionId: string; memberId: string }) {
      routeState.records.add(`${params.sessionId}:${params.memberId}`);
      return {
        id: "record-1",
        memberId: params.memberId,
        recognitionMethod: "manual",
        recordedAt: new Date("2026-01-01T08:05:00Z"),
        sentimentLabel: null,
        sentimentScore: null,
      } satisfies AttendanceRecordSnapshot;
    }

    async createRecord(params: { memberId: string }) {
      return {
        id: "record-1",
        memberId: params.memberId,
        recognitionMethod: "face",
        recordedAt: new Date("2026-01-01T08:05:00Z"),
        sentimentLabel: null,
        sentimentScore: null,
      } satisfies AttendanceRecordSnapshot;
    }
  },
}));

mock.module(biometricRepoPath, () => ({
  BiometricsRepository: class BiometricsRepository {
    async enroll() {
      return PROFILE_ID;
    }

    async findBySimilarity() {
      return { profileId: PROFILE_ID, memberId: STUDENT_MEMBER_ID, similarity: 0.91 };
    }

    async findByOrgAndMember() {
      return [];
    }

    async findActiveProfileById() {
      return {
        profileId: PROFILE_ID,
        organizationId: ORG_ID,
        memberId: STUDENT_MEMBER_ID,
        modelVersion: "ArcFace-v1",
        qualityScore: 0.91,
        isActive: true,
        deviceId: null,
        createdBy: ADMIN_USER_ID,
        enrolledAt: new Date("2026-01-01T00:00:00Z"),
        lastMatchedAt: null,
        deletedAt: null,
        deletedBy: null,
      };
    }

    async touchLastMatched() {
      return undefined;
    }

    async revoke() {
      return true;
    }
  },
}));

mock.module(auditLogRepoPath, () => ({
  AuditLogRepository: class AuditLogRepository {
    async insert() {
      return undefined;
    }
  },
}));

mock.module(reportsRepoPath, () => ({
  ReportsRepository: class ReportsRepository {
    async getAttendanceReport(filter: AttendanceReportFilter) {
      routeState.reportCalls.push(filter);
      return [];
    }

    async getWellbeingReport() {
      return [];
    }

    async getWellbeingAlerts() {
      return [];
    }
  },
}));

async function createApp() {
  const [membersModule, devicesModule, attendanceModule, reportsModule] = await Promise.all([
    import("../../adapters/http/routes/members.routes.ts"),
    import("../../adapters/http/routes/devices.routes.ts"),
    import("../../adapters/http/routes/attendance.routes.ts"),
    import("../../adapters/http/routes/reports.routes.ts"),
  ]);

  const aiQueue = {
    async enqueueAndAwait() {
      return { embedding: [0.1, 0.2, 0.3], qualityScore: 0.91, processingMs: 10 };
    },
    async getCircuitState() {
      return "CLOSED";
    },
  } as unknown as Parameters<typeof attendanceModule.initAttendanceRoutes>[0];

  membersModule.initMemberRoutes();
  devicesModule.initDeviceRoutes();
  attendanceModule.initAttendanceRoutes(aiQueue);
  reportsModule.initReportRoutes();

  return createHttpApp().group("/v1", (v1) =>
    v1
      .use(membersModule.memberRoutes)
      .use(devicesModule.deviceRoutes)
      .use(attendanceModule.attendanceUserRoutes)
      .use(reportsModule.reportRoutes)
  );
}

async function createServerApp() {
  const { app } = await import("../../infrastructure/server.ts");
  return app;
}

async function requestJson(
  app: TestApp,
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: unknown } = {}
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

  return {
    response,
    body:
      trimmed.length === 0
        ? null
        : trimmed.startsWith("{") || trimmed.startsWith("[")
          ? (JSON.parse(trimmed) as unknown)
          : trimmed,
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

describe("baseline security routes", () => {
  it("GET /v1/members/:id bloqueia estudante acessando outro membro", async () => {
    const app = await createApp();

    const { response } = await requestJson(app, `/v1/members/${OTHER_MEMBER_ID}`, {
      headers: authenticatedHeaders({
        "x-test-role": "student",
        "x-test-user-id": STUDENT_USER_ID,
      }),
    });

    expect(response.status).toBe(403);
  });

  it("GET /v1/members/:id permite estudante acessar apenas membro vinculado ao seu userId", async () => {
    const app = await createApp();

    const { response, body } = await requestJson(app, `/v1/members/${STUDENT_MEMBER_ID}`, {
      headers: authenticatedHeaders({
        "x-test-role": "student",
        "x-test-user-id": STUDENT_USER_ID,
      }),
    });

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: STUDENT_MEMBER_ID, userId: STUDENT_USER_ID });
  });

  for (const route of [
    {
      method: "POST",
      path: "/v1/members/",
      body: { fullName: "Novo Aluno", role: "student", externalCode: "MAT-200" },
    },
    {
      method: "PATCH",
      path: `/v1/members/${STUDENT_MEMBER_ID}`,
      body: { fullName: "Aluno Alterado" },
    },
    {
      method: "DELETE",
      path: `/v1/members/${STUDENT_MEMBER_ID}`,
    },
  ]) {
    it(`${route.method} ${route.path} bloqueia professor`, async () => {
      const app = await createApp();

      const { response } = await requestJson(app, route.path, {
        method: route.method,
        headers: authenticatedHeaders({
          "x-test-role": "professor",
          "x-test-user-id": PROFESSOR_USER_ID,
        }),
        body: route.body,
      });

      expect(response.status).toBe(403);
    });
  }

  for (const role of ["professor", "rh", "student"] as const) {
    it(`GET /v1/devices bloqueia role ${role}`, async () => {
      const app = await createApp();

      const { response } = await requestJson(app, "/v1/devices/", {
        headers: authenticatedHeaders({ "x-test-role": role }),
      });

      expect(response.status).toBe(403);
    });
  }

  for (const route of [
    {
      method: "POST",
      path: "/v1/attendance/sessions",
      body: { deviceId: DEVICE_ID, classId: CLASS_ID, professorId: PROFESSOR_MEMBER_ID },
    },
    {
      method: "PATCH",
      path: `/v1/attendance/sessions/${SESSION_ID}/close`,
    },
    {
      method: "POST",
      path: `/v1/attendance/sessions/${SESSION_ID}/records/manual`,
      body: { memberId: STUDENT_MEMBER_ID },
    },
  ]) {
    it(`${route.method} ${route.path} exige attendance:write`, async () => {
      const app = await createApp();

      const { response } = await requestJson(app, route.path, {
        method: route.method,
        headers: authenticatedHeaders({ "x-test-role": "rh" }),
        body: route.body,
      });

      expect(response.status).toBe(403);
    });
  }

  for (const route of [
    {
      method: "POST",
      path: "/v1/biometric/enroll",
      body: { memberId: STUDENT_MEMBER_ID, frameBase64: "frame-base64" },
    },
    {
      method: "DELETE",
      path: `/v1/biometric/${PROFILE_ID}`,
    },
  ]) {
    it(`${route.method} ${route.path} retorna 404 depois do cutover legado`, async () => {
      const app = await createServerApp();

      const { response } = await requestJson(app, route.path, {
        method: route.method,
        headers: authenticatedHeaders(),
        body: route.body,
      });

      expect(response.status).toBe(404);
    });
  }

  it("GET /v1/reports/attendance para professor usa members.id, não auth user id", async () => {
    const app = await createApp();

    const { response } = await requestJson(
      app,
      `/v1/reports/attendance?from=2026-01-01T00:00:00.000Z&to=2026-01-31T00:00:00.000Z&professorId=${OTHER_PROFESSOR_MEMBER_ID}`,
      {
        headers: authenticatedHeaders({
          "x-test-role": "professor",
          "x-test-user-id": PROFESSOR_USER_ID,
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(routeState.reportCalls.at(-1)?.professorId).toBe(PROFESSOR_MEMBER_ID);
    expect(routeState.reportCalls.at(-1)?.professorId).not.toBe(PROFESSOR_USER_ID);
  });
});

