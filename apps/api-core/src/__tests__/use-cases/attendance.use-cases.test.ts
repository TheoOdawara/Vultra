/**
 * VULTRA — Attendance Use Cases Tests
 *
 * Tests for:
 *   - OpenSessionUseCase
 *   - CloseSessionUseCase
 *   - ManualRecordUseCase
 *   - RecordAttendanceUseCase
 */

import { describe, expect, it } from "bun:test";
import {
  AIServiceUnavailableError,
  AttendanceConflictError,
  FaceNotRecognizedError,
  LowConfidenceMatchError,
  SessionAlreadyClosedError,
  SessionNotFoundError,
} from "../../core/domain/errors/DomainError.ts";
import type { AIJobResult, IAIQueueAdapter } from "../../core/ports/IAIQueueAdapter.ts";
import type {
  AttendanceRecordSnapshot,
  IAttendanceRepository,
  ManualRecordParams,
  NewRecordData,
  NewSessionData,
  SessionSnapshot,
} from "../../core/ports/IAttendanceRepository.ts";
import type {
  IBiometricRepository,
  SimilarityMatch,
} from "../../core/ports/IBiometricRepository.ts";
import { CloseSessionUseCase } from "../../core/use-cases/attendance/CloseSessionUseCase.ts";
import { ManualRecordUseCase } from "../../core/use-cases/attendance/ManualRecordUseCase.ts";
import { OpenSessionUseCase } from "../../core/use-cases/attendance/OpenSessionUseCase.ts";
import { RecordAttendanceUseCase } from "../../core/use-cases/attendance/RecordAttendanceUseCase.ts";

// ── Stub factories ────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    id: "session-1",
    status: "open",
    startedAt: new Date("2026-05-01T09:00:00Z"),
    ...overrides,
  };
}

function makeRecord(overrides: Partial<AttendanceRecordSnapshot> = {}): AttendanceRecordSnapshot {
  return {
    id: "record-1",
    memberId: "member-1",
    sentimentLabel: null,
    sentimentScore: null,
    recognitionMethod: "face",
    recordedAt: new Date("2026-05-01T09:05:00Z"),
    ...overrides,
  };
}

function createAttendanceRepoStub() {
  const store: {
    sessions: Record<string, SessionSnapshot>;
    records: Set<string>; // "sessionId:memberId"
  } = {
    sessions: {},
    records: new Set(),
  };

  const calls = {
    findSessionById: [] as Array<{ sessionId: string; organizationId: string }>,
    createSession: [] as NewSessionData[],
    closeSession: [] as Array<{ sessionId: string; organizationId: string }>,
    existsRecord: [] as Array<{ sessionId: string; memberId: string; organizationId: string }>,
    createRecord: [] as NewRecordData[],
    createManualRecord: [] as ManualRecordParams[],
  };

  const stub: IAttendanceRepository & { calls: typeof calls; store: typeof store } = {
    calls,
    store,

    async findSessionById(sessionId, organizationId) {
      calls.findSessionById.push({ sessionId, organizationId });
      return store.sessions[sessionId] ?? null;
    },

    async createSession(data) {
      calls.createSession.push(data);
      const session: SessionSnapshot = {
        id: "session-new",
        status: data.status,
        startedAt: new Date(),
      };
      store.sessions[session.id] = session;
      return session;
    },

    async closeSession(sessionId, organizationId) {
      calls.closeSession.push({ sessionId, organizationId });
      const session = store.sessions[sessionId];
      if (session) {
        session.status = "closed";
      }
    },

    async existsRecord(sessionId, memberId, organizationId) {
      calls.existsRecord.push({ sessionId, memberId, organizationId });
      return store.records.has(`${sessionId}:${memberId}`);
    },

    async createRecord(data) {
      calls.createRecord.push(data);
      store.records.add(`${data.sessionId}:${data.memberId}`);
      return makeRecord({
        memberId: data.memberId,
        recognitionMethod: data.recognitionMethod,
      });
    },

    async createManualRecord(params) {
      calls.createManualRecord.push(params);
      store.records.add(`${params.sessionId}:${params.memberId}`);
      return makeRecord({
        memberId: params.memberId,
        recognitionMethod: "manual",
      });
    },

    async listRecordsBySession(_sessionId, _organizationId) {
      return [];
    },
  };

  return stub;
}

function createAIQueueStub() {
  let nextResult: AIJobResult | null = null;
  let nextError: unknown = null;

  const calls: Array<{
    jobId: string;
    frameBase64: string;
    organizationId: string;
    deviceId?: string;
  }> = [];

  const stub: IAIQueueAdapter & {
    calls: typeof calls;
    setResult: (r: AIJobResult) => void;
    setError: (e: unknown) => void;
  } = {
    calls,
    setResult(r) {
      nextResult = r;
      nextError = null;
    },
    setError(e) {
      nextError = e;
      nextResult = null;
    },
    async enqueueAndAwait(params) {
      calls.push(params);
      if (nextError) throw nextError;
      if (!nextResult) throw new Error("AI stub result not configured");
      return nextResult;
    },
    async getCircuitState() {
      return "CLOSED";
    },
  };

  return stub;
}

function createBiometricsRepoStub() {
  let similarityResult: SimilarityMatch | null = null;

  const calls = {
    findBySimilarity: [] as Array<{
      embedding: number[];
      organizationId: string;
      modelVersion: string | undefined;
    }>,
    touchLastMatched: [] as Array<{ memberId: string; organizationId: string }>,
  };

  return {
    calls,
    setSimilarityResult(r: SimilarityMatch | null) {
      similarityResult = r;
    },
    async findBySimilarity(embedding: number[], organizationId: string, modelVersion?: string) {
      calls.findBySimilarity.push({ embedding, organizationId, modelVersion: modelVersion });
      return similarityResult;
    },
    async findByOrgAndMember() {
      return [];
    },
    async findActiveProfileById() {
      return null;
    },
    async enroll() {
      return "profile-stub";
    },
    async touchLastMatched(memberId: string, organizationId: string) {
      calls.touchLastMatched.push({ memberId, organizationId });
    },
    async revoke() {
      return true;
    },
  } as unknown as IBiometricRepository & {
    calls: typeof calls;
    setSimilarityResult: (r: SimilarityMatch | null) => void;
  };
}

// ── OpenSessionUseCase ────────────────────────────────────────────────────────

describe("OpenSessionUseCase", () => {
  it("deve criar sessão com status open", async () => {
    const repo = createAttendanceRepoStub();
    const useCase = new OpenSessionUseCase(repo);

    const result = await useCase.execute({
      organizationId: "org-1",
      deviceId: "device-1",
    });

    expect(result?.status).toBe("open");
    expect(repo.calls.createSession).toHaveLength(1);
    expect(repo.calls.createSession[0]).toMatchObject({
      organizationId: "org-1",
      deviceId: "device-1",
      status: "open",
    });
  });

  it("deve aceitar classId e professorId opcionais", async () => {
    const repo = createAttendanceRepoStub();
    const useCase = new OpenSessionUseCase(repo);

    await useCase.execute({
      organizationId: "org-1",
      deviceId: "device-1",
      classId: "class-1",
      professorId: "professor-1",
    });

    expect(repo.calls.createSession[0]).toMatchObject({
      classId: "class-1",
      professorId: "professor-1",
    });
  });

  it("deve preservar organizationId na sessão criada", async () => {
    const repo = createAttendanceRepoStub();
    const useCase = new OpenSessionUseCase(repo);

    await useCase.execute({ organizationId: "org-tenant-b", deviceId: "device-b" });

    expect(repo.calls.createSession[0]?.organizationId).toBe("org-tenant-b");
  });
});

// ── CloseSessionUseCase ───────────────────────────────────────────────────────

describe("CloseSessionUseCase", () => {
  it("deve fechar sessão aberta com sucesso", async () => {
    const repo = createAttendanceRepoStub();
    repo.store.sessions["session-1"] = makeSession({ id: "session-1", status: "open" });

    const useCase = new CloseSessionUseCase(repo);

    await expect(
      useCase.execute({ sessionId: "session-1", organizationId: "org-1" })
    ).resolves.toBeUndefined();

    expect(repo.calls.closeSession).toEqual([{ sessionId: "session-1", organizationId: "org-1" }]);
  });

  it("deve lançar SessionNotFoundError quando sessão não existir", async () => {
    const repo = createAttendanceRepoStub();
    const useCase = new CloseSessionUseCase(repo);

    await expect(
      useCase.execute({ sessionId: "session-missing", organizationId: "org-1" })
    ).rejects.toBeInstanceOf(SessionNotFoundError);

    expect(repo.calls.closeSession).toHaveLength(0);
  });

  it("deve lançar SessionAlreadyClosedError para sessão já encerrada", async () => {
    const repo = createAttendanceRepoStub();
    repo.store.sessions["session-closed"] = makeSession({
      id: "session-closed",
      status: "closed",
    });

    const useCase = new CloseSessionUseCase(repo);

    await expect(
      useCase.execute({ sessionId: "session-closed", organizationId: "org-1" })
    ).rejects.toBeInstanceOf(SessionAlreadyClosedError);

    expect(repo.calls.closeSession).toHaveLength(0);
  });

  it("deve lançar SessionAlreadyClosedError para sessão cancelada", async () => {
    const repo = createAttendanceRepoStub();
    repo.store.sessions["session-cancelled"] = makeSession({
      id: "session-cancelled",
      status: "cancelled",
    });

    const useCase = new CloseSessionUseCase(repo);

    await expect(
      useCase.execute({ sessionId: "session-cancelled", organizationId: "org-1" })
    ).rejects.toBeInstanceOf(SessionAlreadyClosedError);
  });
});

// ── ManualRecordUseCase ───────────────────────────────────────────────────────

describe("ManualRecordUseCase", () => {
  it("deve registrar presença manual com sucesso", async () => {
    const repo = createAttendanceRepoStub();
    repo.store.sessions["session-1"] = makeSession({ id: "session-1" });

    const useCase = new ManualRecordUseCase(repo);

    const result = await useCase.execute({
      sessionId: "session-1",
      memberId: "member-1",
      organizationId: "org-1",
    });

    expect(result?.recognitionMethod).toBe("manual");
    expect(result?.memberId).toBe("member-1");
    expect(repo.calls.createManualRecord).toHaveLength(1);
    expect(repo.calls.createManualRecord[0]).toMatchObject({
      sessionId: "session-1",
      memberId: "member-1",
      organizationId: "org-1",
    });
  });

  it("deve lançar SessionNotFoundError para sessão inexistente", async () => {
    const repo = createAttendanceRepoStub();
    const useCase = new ManualRecordUseCase(repo);

    await expect(
      useCase.execute({ sessionId: "no-session", memberId: "m1", organizationId: "org-1" })
    ).rejects.toBeInstanceOf(SessionNotFoundError);
  });

  it("deve lançar SessionAlreadyClosedError para sessão fechada", async () => {
    const repo = createAttendanceRepoStub();
    repo.store.sessions["session-closed"] = makeSession({
      id: "session-closed",
      status: "closed",
    });

    const useCase = new ManualRecordUseCase(repo);

    await expect(
      useCase.execute({
        sessionId: "session-closed",
        memberId: "m1",
        organizationId: "org-1",
      })
    ).rejects.toBeInstanceOf(SessionAlreadyClosedError);
  });

  it("deve lançar AttendanceConflictError para presença duplicada", async () => {
    const repo = createAttendanceRepoStub();
    repo.store.sessions["session-1"] = makeSession({ id: "session-1" });
    repo.store.records.add("session-1:member-dup");

    const useCase = new ManualRecordUseCase(repo);

    await expect(
      useCase.execute({
        sessionId: "session-1",
        memberId: "member-dup",
        organizationId: "org-1",
      })
    ).rejects.toBeInstanceOf(AttendanceConflictError);

    expect(repo.calls.createManualRecord).toHaveLength(0);
  });
});

// ── RecordAttendanceUseCase ───────────────────────────────────────────────────

describe("RecordAttendanceUseCase", () => {
  it("deve registrar presença via reconhecimento facial com sucesso", async () => {
    const attendanceRepo = createAttendanceRepoStub();
    attendanceRepo.store.sessions["session-1"] = makeSession({ id: "session-1" });

    const aiQueue = createAIQueueStub();
    aiQueue.setResult({ embedding: [0.1, 0.2, 0.3], qualityScore: 0.88, processingMs: 120 });

    const biometricsRepo = createBiometricsRepoStub();
    biometricsRepo.setSimilarityResult({
      profileId: "profile-1",
      memberId: "member-face",
      similarity: 0.91,
      modelVersion: "ArcFace-v1",
    });

    const useCase = new RecordAttendanceUseCase(aiQueue, biometricsRepo, attendanceRepo);

    const result = await useCase.execute({
      jobId: "job-1",
      frameBase64: "base64-frame",
      sessionId: "session-1",
      organizationId: "org-1",
      deviceId: "device-1",
    });

    expect(result.memberId).toBe("member-face");
    expect(result.confidenceScore).toBe(0.91);
    expect(result.recordId).toBeTruthy();
    expect(aiQueue.calls[0]).toMatchObject({
      jobId: "job-1",
      frameBase64: "base64-frame",
      organizationId: "org-1",
      deviceId: "device-1",
    });
  });

  it("deve lançar SessionNotFoundError quando sessão não existir", async () => {
    const attendanceRepo = createAttendanceRepoStub();
    const aiQueue = createAIQueueStub();
    const biometricsRepo = createBiometricsRepoStub();

    const useCase = new RecordAttendanceUseCase(aiQueue, biometricsRepo, attendanceRepo);

    await expect(
      useCase.execute({
        jobId: "job-2",
        frameBase64: "frame",
        sessionId: "session-missing",
        organizationId: "org-1",
        deviceId: "device-1",
      })
    ).rejects.toBeInstanceOf(SessionNotFoundError);

    expect(aiQueue.calls).toHaveLength(0);
  });

  it("deve lançar SessionAlreadyClosedError para sessão fechada", async () => {
    const attendanceRepo = createAttendanceRepoStub();
    attendanceRepo.store.sessions["session-closed"] = makeSession({
      id: "session-closed",
      status: "closed",
    });

    const aiQueue = createAIQueueStub();
    const biometricsRepo = createBiometricsRepoStub();

    const useCase = new RecordAttendanceUseCase(aiQueue, biometricsRepo, attendanceRepo);

    await expect(
      useCase.execute({
        jobId: "job-3",
        frameBase64: "frame",
        sessionId: "session-closed",
        organizationId: "org-1",
        deviceId: "device-1",
      })
    ).rejects.toBeInstanceOf(SessionAlreadyClosedError);

    expect(aiQueue.calls).toHaveLength(0);
  });

  it("deve lançar FaceNotRecognizedError quando nenhum perfil bater", async () => {
    const attendanceRepo = createAttendanceRepoStub();
    attendanceRepo.store.sessions["session-1"] = makeSession({ id: "session-1" });

    const aiQueue = createAIQueueStub();
    aiQueue.setResult({ embedding: [0.5, 0.5, 0.5], qualityScore: 0.7, processingMs: 80 });

    const biometricsRepo = createBiometricsRepoStub();
    biometricsRepo.setSimilarityResult(null);

    const useCase = new RecordAttendanceUseCase(aiQueue, biometricsRepo, attendanceRepo);

    await expect(
      useCase.execute({
        jobId: "job-4",
        frameBase64: "frame",
        sessionId: "session-1",
        organizationId: "org-1",
        deviceId: "device-1",
      })
    ).rejects.toBeInstanceOf(FaceNotRecognizedError);

    expect(attendanceRepo.calls.createRecord).toHaveLength(0);
  });

  it("deve lançar FaceNotRecognizedError quando similaridade < LOW_CONFIDENCE_THRESHOLD (0.4)", async () => {
    const attendanceRepo = createAttendanceRepoStub();
    attendanceRepo.store.sessions["session-1"] = makeSession({ id: "session-1" });

    const aiQueue = createAIQueueStub();
    aiQueue.setResult({ embedding: [0.1, 0.1, 0.1], qualityScore: 0.6, processingMs: 70 });

    const biometricsRepo = createBiometricsRepoStub();
    biometricsRepo.setSimilarityResult({
      profileId: "p-1",
      memberId: "m-1",
      similarity: 0.39,
      modelVersion: "ArcFace-v1",
    });

    const useCase = new RecordAttendanceUseCase(aiQueue, biometricsRepo, attendanceRepo);

    await expect(
      useCase.execute({
        jobId: "job-5",
        frameBase64: "frame",
        sessionId: "session-1",
        organizationId: "org-1",
        deviceId: "device-1",
      })
    ).rejects.toBeInstanceOf(FaceNotRecognizedError);
  });

  it("deve lançar LowConfidenceMatchError quando 0.4 ≤ similaridade < 0.85", async () => {
    const attendanceRepo = createAttendanceRepoStub();
    attendanceRepo.store.sessions["session-1"] = makeSession({ id: "session-1" });

    const aiQueue = createAIQueueStub();
    aiQueue.setResult({ embedding: [0.2, 0.2, 0.2], qualityScore: 0.75, processingMs: 90 });

    const biometricsRepo = createBiometricsRepoStub();
    biometricsRepo.setSimilarityResult({
      profileId: "p-1",
      memberId: "m-1",
      similarity: 0.72, // above LOW_CONFIDENCE but below MATCH threshold
      modelVersion: "ArcFace-v1",
    });

    const useCase = new RecordAttendanceUseCase(aiQueue, biometricsRepo, attendanceRepo);

    await expect(
      useCase.execute({
        jobId: "job-6",
        frameBase64: "frame",
        sessionId: "session-1",
        organizationId: "org-1",
        deviceId: "device-1",
      })
    ).rejects.toBeInstanceOf(LowConfidenceMatchError);

    expect(attendanceRepo.calls.createRecord).toHaveLength(0);
  });

  it("deve lançar AttendanceConflictError para duplicatas na mesma sessão", async () => {
    const attendanceRepo = createAttendanceRepoStub();
    attendanceRepo.store.sessions["session-1"] = makeSession({ id: "session-1" });
    // Pre-populate as already recorded
    attendanceRepo.store.records.add("session-1:member-face");

    const aiQueue = createAIQueueStub();
    aiQueue.setResult({ embedding: [0.1, 0.2, 0.3], qualityScore: 0.88, processingMs: 100 });

    const biometricsRepo = createBiometricsRepoStub();
    biometricsRepo.setSimilarityResult({
      profileId: "profile-1",
      memberId: "member-face",
      similarity: 0.91,
      modelVersion: "ArcFace-v1",
    });

    const useCase = new RecordAttendanceUseCase(aiQueue, biometricsRepo, attendanceRepo);

    await expect(
      useCase.execute({
        jobId: "job-7",
        frameBase64: "frame",
        sessionId: "session-1",
        organizationId: "org-1",
        deviceId: "device-1",
      })
    ).rejects.toBeInstanceOf(AttendanceConflictError);

    expect(attendanceRepo.calls.createRecord).toHaveLength(0);
  });

  it("deve propagar AIServiceUnavailableError quando circuit breaker estiver aberto", async () => {
    const attendanceRepo = createAttendanceRepoStub();
    attendanceRepo.store.sessions["session-1"] = makeSession({ id: "session-1" });

    const aiQueue = createAIQueueStub();
    aiQueue.setError(new AIServiceUnavailableError(30));

    const biometricsRepo = createBiometricsRepoStub();

    const useCase = new RecordAttendanceUseCase(aiQueue, biometricsRepo, attendanceRepo);

    await expect(
      useCase.execute({
        jobId: "job-8",
        frameBase64: "frame",
        sessionId: "session-1",
        organizationId: "org-1",
        deviceId: "device-1",
      })
    ).rejects.toBeInstanceOf(AIServiceUnavailableError);

    expect(attendanceRepo.calls.createRecord).toHaveLength(0);
    expect(biometricsRepo.calls.findBySimilarity).toHaveLength(0);
  });

  it("deve tocar lastMatchedAt sem bloquear a resposta", async () => {
    const attendanceRepo = createAttendanceRepoStub();
    attendanceRepo.store.sessions["session-1"] = makeSession({ id: "session-1" });

    const aiQueue = createAIQueueStub();
    aiQueue.setResult({ embedding: [0.3, 0.3, 0.3], qualityScore: 0.9, processingMs: 95 });

    const biometricsRepo = createBiometricsRepoStub();
    biometricsRepo.setSimilarityResult({
      profileId: "profile-touch",
      memberId: "member-touch",
      similarity: 0.93,
      modelVersion: "ArcFace-v1",
    });

    const useCase = new RecordAttendanceUseCase(aiQueue, biometricsRepo, attendanceRepo);

    const result = await useCase.execute({
      jobId: "job-touch",
      frameBase64: "frame",
      sessionId: "session-1",
      organizationId: "org-1",
      deviceId: "device-1",
    });

    // Result should be returned even if touchLastMatched is async fire-and-forget
    expect(result.memberId).toBe("member-touch");
    // Give micro-task queue a chance to resolve
    await new Promise((r) => setTimeout(r, 10));
    expect(biometricsRepo.calls.touchLastMatched).toEqual([
      { memberId: "member-touch", organizationId: "org-1" },
    ]);
  });

  it("deve respeitar isolamento de tenant — organizationId propagado a todas as camadas", async () => {
    const attendanceRepo = createAttendanceRepoStub();
    attendanceRepo.store.sessions["session-tenant-b"] = makeSession({
      id: "session-tenant-b",
      status: "open",
    });

    const aiQueue = createAIQueueStub();
    aiQueue.setResult({ embedding: [0.4, 0.5, 0.6], qualityScore: 0.85, processingMs: 88 });

    const biometricsRepo = createBiometricsRepoStub();
    biometricsRepo.setSimilarityResult({
      profileId: "profile-b",
      memberId: "member-b",
      similarity: 0.9,
      modelVersion: "ArcFace-v1",
    });

    const useCase = new RecordAttendanceUseCase(aiQueue, biometricsRepo, attendanceRepo);

    await useCase.execute({
      jobId: "job-tenant-b",
      frameBase64: "frame",
      sessionId: "session-tenant-b",
      organizationId: "org-tenant-b",
      deviceId: "device-b",
    });

    expect(aiQueue.calls[0]).toMatchObject({ organizationId: "org-tenant-b" });
    expect(biometricsRepo.calls.findBySimilarity[0]).toMatchObject({
      organizationId: "org-tenant-b",
    });
    expect(attendanceRepo.calls.createRecord[0]).toMatchObject({
      organizationId: "org-tenant-b",
    });
  });
});
