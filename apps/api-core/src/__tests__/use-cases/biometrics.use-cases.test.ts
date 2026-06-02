import { describe, expect, it } from "bun:test";
import {
  AIServiceUnavailableError,
  BiometricProfileNotFoundError,
} from "../../core/domain/errors/DomainError.ts";
import type { AIJobResult, IAIQueueAdapter } from "../../core/ports/IAIQueueAdapter.ts";
import type {
  BiometricProfileLookup,
  SimilarityMatch,
} from "../../core/ports/IBiometricRepository.ts";
import type {
  EnrollBiometricInput,
  EnrollBiometricOutput,
  ListFacesInput,
  RevokeBiometricInput,
  VerifyFaceInput,
  VerifyFaceOutput,
} from "../../core/use-cases/biometrics/index.ts";
import * as biometricsModule from "../../core/use-cases/biometrics/index.ts";

type UseCaseConstructor<TArgs extends unknown[], TInstance> = new (...args: TArgs) => TInstance;

type BiometricsRepoStub = ReturnType<typeof createBiometricsRepoStub>;
type AuditLogRepoStub = ReturnType<typeof createAuditLogRepoStub>;

type EnrollBiometricUseCaseContract = {
  execute(input: EnrollBiometricInput): Promise<EnrollBiometricOutput>;
};

type VerifyFaceUseCaseContract = {
  execute(input: VerifyFaceInput): Promise<VerifyFaceOutput>;
};

type ListFacesUseCaseContract = {
  execute(input: ListFacesInput): Promise<BiometricProfileLookup[]>;
};

type RevokeBiometricUseCaseContract = {
  execute(input: RevokeBiometricInput): Promise<void>;
};

type AuditLogInsertInput = {
  organizationId: string;
  actorId: string;
  actorType: "user" | "device" | "system";
  action: "BIOMETRIC_PROFILE_ENROLLED" | "BIOMETRIC_PROFILE_VERIFIED" | "BIOMETRIC_PROFILE_REVOKED";
  resourceType: "biometric_profiles";
  resourceId: string | null;
  payload: Record<string, unknown>;
  ipAddress?: string;
};

function getUseCaseConstructor<TConstructor>(name: string): TConstructor {
  const candidate = (biometricsModule as Record<string, unknown>)[name];

  if (typeof candidate !== "function") {
    throw new Error(`${name} não implementado`);
  }

  return candidate as TConstructor;
}

function createAIQueueStub() {
  const calls: Array<{
    jobId: string;
    frameBase64: string;
    organizationId: string;
    deviceId?: string;
  }> = [];

  let nextResult: AIJobResult | null = null;
  let nextError: unknown = null;

  const stub: IAIQueueAdapter & {
    calls: typeof calls;
    setResult: (result: AIJobResult) => void;
    setError: (error: unknown) => void;
  } = {
    calls,
    setResult(result) {
      nextResult = result;
      nextError = null;
    },
    setError(error) {
      nextError = error;
    },
    async enqueueAndAwait(params) {
      calls.push(params);

      if (nextError) {
        throw nextError;
      }

      if (!nextResult) {
        throw new Error("AI result stub não configurado");
      }

      return nextResult;
    },
    async getCircuitState() {
      return "CLOSED";
    },
  };

  return stub;
}

function createBiometricsRepoStub() {
  const calls = {
    enroll: [] as Array<{
      organizationId: string;
      memberId: string;
      faceEmbedding: number[];
      qualityScore: number;
      modelVersion?: string;
    }>,
    findBySimilarity: [] as Array<{
      embedding: number[];
      organizationId: string;
      modelVersion: string | undefined;
      memberId: string | undefined;
    }>,
    findByOrgAndMember: [] as Array<{ organizationId: string; memberId: string | undefined }>,
    findActiveProfileById: [] as Array<{ profileId: string; organizationId: string }>,
    touchLastMatched: [] as Array<{ memberId: string; organizationId: string }>,
    revoke: [] as Array<{ profileId: string; organizationId: string; deletedBy: string }>,
  };

  let enrollResult = "profile-1";
  let similarityResult: SimilarityMatch | null = null;
  let listResult: BiometricProfileLookup[] = [];
  let activeProfileByIdResult: BiometricProfileLookup | null = null;
  let revokeResult = true;
  let similarityHandler:
    | ((params: {
        embedding: number[];
        organizationId: string;
        modelVersion: string | undefined;
        memberId: string | undefined;
      }) => Promise<SimilarityMatch | null>)
    | null = null;
  let listHandler:
    | ((params: {
        organizationId: string;
        memberId: string | undefined;
      }) => Promise<BiometricProfileLookup[]>)
    | null = null;

  return {
    calls,
    setEnrollResult(result: string) {
      enrollResult = result;
    },
    setSimilarityResult(result: SimilarityMatch | null) {
      similarityResult = result;
      similarityHandler = null;
    },
    setSimilarityHandler(
      handler: (params: {
        embedding: number[];
        organizationId: string;
        modelVersion: string | undefined;
        memberId: string | undefined;
      }) => Promise<SimilarityMatch | null>
    ) {
      similarityHandler = handler;
    },
    setListResult(result: BiometricProfileLookup[]) {
      listResult = result;
      listHandler = null;
    },
    setActiveProfileByIdResult(result: BiometricProfileLookup | null) {
      activeProfileByIdResult = result;
    },
    setListHandler(
      handler: (params: {
        organizationId: string;
        memberId: string | undefined;
      }) => Promise<BiometricProfileLookup[]>
    ) {
      listHandler = handler;
    },
    setRevokeResult(result: boolean) {
      revokeResult = result;
    },
    async enroll(params: {
      organizationId: string;
      memberId: string;
      faceEmbedding: number[];
      qualityScore: number;
      modelVersion?: string;
    }) {
      calls.enroll.push(params);
      return enrollResult;
    },
    async findBySimilarity(
      embedding: number[],
      organizationId: string,
      modelVersion?: string,
      memberId?: string
    ) {
      const params = { embedding, organizationId, modelVersion, memberId };
      calls.findBySimilarity.push(params);

      if (similarityHandler) {
        return similarityHandler(params);
      }

      return similarityResult;
    },
    async findByOrgAndMember(organizationId: string, memberId?: string) {
      const params = { organizationId, memberId };
      calls.findByOrgAndMember.push(params);

      if (listHandler) {
        return listHandler(params);
      }

      return listResult;
    },
    async findActiveProfileById(profileId: string, organizationId: string) {
      calls.findActiveProfileById.push({ profileId, organizationId });
      return activeProfileByIdResult;
    },
    async touchLastMatched(memberId: string, organizationId: string) {
      calls.touchLastMatched.push({ memberId, organizationId });
    },
    async revoke(profileId: string, organizationId: string, deletedBy: string) {
      calls.revoke.push({ profileId, organizationId, deletedBy });
      return revokeResult;
    },
  };
}

function createAuditLogRepoStub() {
  const calls = {
    insert: [] as AuditLogInsertInput[],
  };

  return {
    calls,
    async insert(params: AuditLogInsertInput) {
      calls.insert.push(params);
    },
  };
}

function expectNoSensitivePayload(payload: Record<string, unknown>) {
  expect(payload).not.toHaveProperty("frameBase64");
  expect(payload).not.toHaveProperty("embedding");
  expect(payload).not.toHaveProperty("faceEmbedding");
}

describe("biometrics.use-cases", () => {
  describe("EnrollBiometricUseCase", () => {
    it("deve matricular a biometria com sucesso", async () => {
      const EnrollBiometricUseCase =
        getUseCaseConstructor<
          UseCaseConstructor<
            [IAIQueueAdapter, BiometricsRepoStub, AuditLogRepoStub],
            EnrollBiometricUseCaseContract
          >
        >("EnrollBiometricUseCase");
      const aiQueue = createAIQueueStub();
      const biometricsRepo = createBiometricsRepoStub();
      const auditLogRepo = createAuditLogRepoStub();

      aiQueue.setResult({
        embedding: [0.11, 0.22, 0.33],
        qualityScore: 0.91,
        processingMs: 187,
      });
      biometricsRepo.setEnrollResult("profile-enrolled");

      const useCase = new EnrollBiometricUseCase(aiQueue, biometricsRepo, auditLogRepo);

      const result = await useCase.execute({
        jobId: "job-1",
        frameBase64: "base64-frame",
        memberId: "member-1",
        organizationId: "org-1",
        deviceId: "device-1",
        actorId: "user-1",
        actorType: "user",
        ipAddress: "203.0.113.10",
      });

      expect(result).toEqual({
        profileId: "profile-enrolled",
        qualityScore: 0.91,
        modelVersion: "ArcFace-v1",
        processingMs: 187,
      });
      expect(aiQueue.calls).toEqual([
        {
          jobId: "job-1",
          frameBase64: "base64-frame",
          organizationId: "org-1",
          deviceId: "device-1",
        },
      ]);
      expect(biometricsRepo.calls.enroll).toEqual([
        {
          organizationId: "org-1",
          memberId: "member-1",
          faceEmbedding: [0.11, 0.22, 0.33],
          qualityScore: 0.91,
          modelVersion: "ArcFace-v1",
        },
      ]);
      expect(auditLogRepo.calls.insert).toEqual([
        {
          organizationId: "org-1",
          actorId: "user-1",
          actorType: "user",
          action: "BIOMETRIC_PROFILE_ENROLLED",
          resourceType: "biometric_profiles",
          resourceId: "profile-enrolled",
          ipAddress: "203.0.113.10",
          payload: {
            member_id: "member-1",
            profile_id: "profile-enrolled",
            quality_score: 0.91,
            model_version: "ArcFace-v1",
          },
        },
      ]);
      const enrolledAuditLog = auditLogRepo.calls.insert[0];
      if (!enrolledAuditLog) {
        throw new Error("Audit log de enroll não foi registrado");
      }
      expectNoSensitivePayload(enrolledAuditLog.payload);
    });

    it("deve propagar NO_FACE quando o frame não contém rosto detectável", async () => {
      const EnrollBiometricUseCase =
        getUseCaseConstructor<
          UseCaseConstructor<
            [IAIQueueAdapter, BiometricsRepoStub, AuditLogRepoStub],
            EnrollBiometricUseCaseContract
          >
        >("EnrollBiometricUseCase");
      const aiQueue = createAIQueueStub();
      const biometricsRepo = createBiometricsRepoStub();
      const auditLogRepo = createAuditLogRepoStub();

      aiQueue.setError(
        Object.assign(new Error("Nenhum rosto detectado"), {
          errorCode: "NO_FACE",
          httpStatus: 422,
        })
      );

      const useCase = new EnrollBiometricUseCase(aiQueue, biometricsRepo, auditLogRepo);

      await expect(
        useCase.execute({
          jobId: "job-no-face",
          frameBase64: "frame-sem-face",
          memberId: "member-1",
          organizationId: "org-1",
          actorId: "user-1",
          actorType: "user",
        })
      ).rejects.toMatchObject({
        errorCode: "NO_FACE",
        httpStatus: 422,
      });
      expect(biometricsRepo.calls.enroll).toHaveLength(0);
      expect(auditLogRepo.calls.insert).toHaveLength(0);
    });

    it("deve rejeitar enroll com qualidade abaixo de 0.40", async () => {
      const EnrollBiometricUseCase =
        getUseCaseConstructor<
          UseCaseConstructor<
            [IAIQueueAdapter, BiometricsRepoStub, AuditLogRepoStub],
            EnrollBiometricUseCaseContract
          >
        >("EnrollBiometricUseCase");
      const aiQueue = createAIQueueStub();
      const biometricsRepo = createBiometricsRepoStub();
      const auditLogRepo = createAuditLogRepoStub();

      aiQueue.setResult({
        embedding: [0.1, 0.2, 0.3],
        qualityScore: 0.39,
        processingMs: 99,
      });

      const useCase = new EnrollBiometricUseCase(aiQueue, biometricsRepo, auditLogRepo);

      await expect(
        useCase.execute({
          jobId: "job-low-quality",
          frameBase64: "frame-base64",
          memberId: "member-1",
          organizationId: "org-1",
          actorId: "user-1",
          actorType: "user",
        })
      ).rejects.toMatchObject({
        errorCode: "LOW_QUALITY",
        httpStatus: 422,
      });
      expect(biometricsRepo.calls.enroll).toHaveLength(0);
      expect(auditLogRepo.calls.insert).toHaveLength(0);
    });

    it("deve propagar indisponibilidade do AI Service quando o circuit breaker estiver aberto", async () => {
      const EnrollBiometricUseCase =
        getUseCaseConstructor<
          UseCaseConstructor<
            [IAIQueueAdapter, BiometricsRepoStub, AuditLogRepoStub],
            EnrollBiometricUseCaseContract
          >
        >("EnrollBiometricUseCase");
      const aiQueue = createAIQueueStub();
      const biometricsRepo = createBiometricsRepoStub();
      const auditLogRepo = createAuditLogRepoStub();

      aiQueue.setError(new AIServiceUnavailableError(17));

      const useCase = new EnrollBiometricUseCase(aiQueue, biometricsRepo, auditLogRepo);

      await expect(
        useCase.execute({
          jobId: "job-cb-open",
          frameBase64: "frame-base64",
          memberId: "member-1",
          organizationId: "org-1",
          actorId: "user-1",
          actorType: "user",
        })
      ).rejects.toBeInstanceOf(AIServiceUnavailableError);
      expect(biometricsRepo.calls.enroll).toHaveLength(0);
      expect(auditLogRepo.calls.insert).toHaveLength(0);
    });

    it("deve preservar o organizationId em toda a operação para garantir isolamento entre tenants", async () => {
      const EnrollBiometricUseCase =
        getUseCaseConstructor<
          UseCaseConstructor<
            [IAIQueueAdapter, BiometricsRepoStub, AuditLogRepoStub],
            EnrollBiometricUseCaseContract
          >
        >("EnrollBiometricUseCase");
      const aiQueue = createAIQueueStub();
      const biometricsRepo = createBiometricsRepoStub();
      const auditLogRepo = createAuditLogRepoStub();

      aiQueue.setResult({
        embedding: [0.4, 0.5, 0.6],
        qualityScore: 0.82,
        processingMs: 121,
      });

      const useCase = new EnrollBiometricUseCase(aiQueue, biometricsRepo, auditLogRepo);

      await useCase.execute({
        jobId: "job-org-b",
        frameBase64: "frame-org-b",
        memberId: "member-org-b",
        organizationId: "org-b",
        actorId: "user-org-b",
        actorType: "user",
      });

      expect(aiQueue.calls[0]).toMatchObject({ organizationId: "org-b" });
      expect(biometricsRepo.calls.enroll[0]).toMatchObject({
        organizationId: "org-b",
        memberId: "member-org-b",
      });
      expect(auditLogRepo.calls.insert[0]).toMatchObject({
        organizationId: "org-b",
        actorId: "user-org-b",
      });
    });
  });

  describe("VerifyFaceUseCase", () => {
    it("deve retornar MATCH quando a similaridade for maior que 0.85", async () => {
      const VerifyFaceUseCase =
        getUseCaseConstructor<
          UseCaseConstructor<
            [IAIQueueAdapter, BiometricsRepoStub, AuditLogRepoStub],
            VerifyFaceUseCaseContract
          >
        >("VerifyFaceUseCase");
      const aiQueue = createAIQueueStub();
      const biometricsRepo = createBiometricsRepoStub();
      const auditLogRepo = createAuditLogRepoStub();

      aiQueue.setResult({
        embedding: [0.21, 0.34, 0.55],
        qualityScore: 0.88,
        processingMs: 144,
      });
      biometricsRepo.setSimilarityResult({
        profileId: "profile-match",
        memberId: "member-match",
        similarity: 0.91,
        modelVersion: "ArcFace-v1",
      });

      const useCase = new VerifyFaceUseCase(aiQueue, biometricsRepo, auditLogRepo);

      const result = await useCase.execute({
        jobId: "job-match",
        frameBase64: "frame-match",
        organizationId: "org-1",
        actorId: "user-1",
        actorType: "user",
        ipAddress: "198.51.100.20",
      });

      expect(result).toEqual({
        result: "MATCH",
        memberId: "member-match",
        confidence: 0.91,
        processingMs: 144,
      });
      expect(biometricsRepo.calls.findBySimilarity[0]).toMatchObject({
        embedding: [0.21, 0.34, 0.55],
        organizationId: "org-1",
        modelVersion: "ArcFace-v1",
      });
      expect(biometricsRepo.calls.findBySimilarity[0]?.memberId).toBeUndefined();
      expect(biometricsRepo.calls.touchLastMatched).toEqual([
        { memberId: "member-match", organizationId: "org-1" },
      ]);
      expect(auditLogRepo.calls.insert).toEqual([
        {
          organizationId: "org-1",
          actorId: "user-1",
          actorType: "user",
          action: "BIOMETRIC_PROFILE_VERIFIED",
          resourceType: "biometric_profiles",
          resourceId: "profile-match",
          ipAddress: "198.51.100.20",
          payload: {
            result: "MATCH",
            confidence: 0.91,
            matched_member_id: "member-match",
            matched_profile_id: "profile-match",
          },
        },
      ]);
      const verifyMatchAuditLog = auditLogRepo.calls.insert[0];
      if (!verifyMatchAuditLog) {
        throw new Error("Audit log de verify MATCH não foi registrado");
      }
      expectNoSensitivePayload(verifyMatchAuditLog.payload);
    });

    it("deve retornar POSSÍVEL quando a similaridade estiver entre 0.75 e 0.85", async () => {
      const VerifyFaceUseCase =
        getUseCaseConstructor<
          UseCaseConstructor<
            [IAIQueueAdapter, BiometricsRepoStub, AuditLogRepoStub],
            VerifyFaceUseCaseContract
          >
        >("VerifyFaceUseCase");
      const aiQueue = createAIQueueStub();
      const biometricsRepo = createBiometricsRepoStub();
      const auditLogRepo = createAuditLogRepoStub();

      aiQueue.setResult({
        embedding: [0.12, 0.45, 0.67],
        qualityScore: 0.77,
        processingMs: 132,
      });
      biometricsRepo.setSimilarityResult({
        profileId: "profile-possible",
        memberId: "member-possible",
        similarity: 0.8,
        modelVersion: "ArcFace-v1",
      });

      const useCase = new VerifyFaceUseCase(aiQueue, biometricsRepo, auditLogRepo);

      const result = await useCase.execute({
        jobId: "job-possible",
        frameBase64: "frame-possible",
        organizationId: "org-1",
        actorId: "user-1",
        actorType: "user",
      });

      expect(result).toEqual({
        result: "POSSÍVEL",
        memberId: "member-possible",
        confidence: 0.8,
        processingMs: 132,
      });
      expect(biometricsRepo.calls.touchLastMatched).toHaveLength(0);
      expect(auditLogRepo.calls.insert[0]).toMatchObject({
        resourceId: "profile-possible",
        payload: {
          result: "POSSÍVEL",
          confidence: 0.8,
          matched_member_id: "member-possible",
          matched_profile_id: "profile-possible",
        },
      });
    });

    it("deve retornar SEM_MATCH quando a similaridade for menor que 0.75", async () => {
      const VerifyFaceUseCase =
        getUseCaseConstructor<
          UseCaseConstructor<
            [IAIQueueAdapter, BiometricsRepoStub, AuditLogRepoStub],
            VerifyFaceUseCaseContract
          >
        >("VerifyFaceUseCase");
      const aiQueue = createAIQueueStub();
      const biometricsRepo = createBiometricsRepoStub();
      const auditLogRepo = createAuditLogRepoStub();

      aiQueue.setResult({
        embedding: [0.98, 0.76, 0.54],
        qualityScore: 0.73,
        processingMs: 111,
      });
      biometricsRepo.setSimilarityResult({
        profileId: "profile-low",
        memberId: "member-low",
        similarity: 0.74,
        modelVersion: "ArcFace-v1",
      });

      const useCase = new VerifyFaceUseCase(aiQueue, biometricsRepo, auditLogRepo);

      const result = await useCase.execute({
        jobId: "job-sem-match",
        frameBase64: "frame-sem-match",
        organizationId: "org-1",
        actorId: "user-1",
        actorType: "user",
      });

      expect(result).toEqual({
        result: "SEM_MATCH",
        confidence: 0,
        processingMs: 111,
      });
      expect("memberId" in result).toBe(false);
      expect(biometricsRepo.calls.touchLastMatched).toHaveLength(0);
      expect(auditLogRepo.calls.insert).toEqual([
        {
          organizationId: "org-1",
          actorId: "user-1",
          actorType: "user",
          action: "BIOMETRIC_PROFILE_VERIFIED",
          resourceType: "biometric_profiles",
          resourceId: null,
          payload: {
            result: "SEM_MATCH",
            confidence: 0,
          },
        },
      ]);
      const verifySemMatchAuditLog = auditLogRepo.calls.insert[0];
      if (!verifySemMatchAuditLog) {
        throw new Error("Audit log de verify SEM_MATCH não foi registrado");
      }
      expectNoSensitivePayload(verifySemMatchAuditLog.payload);
    });

    it("deve propagar indisponibilidade do AI Service quando o circuit breaker estiver aberto", async () => {
      const VerifyFaceUseCase =
        getUseCaseConstructor<
          UseCaseConstructor<
            [IAIQueueAdapter, BiometricsRepoStub, AuditLogRepoStub],
            VerifyFaceUseCaseContract
          >
        >("VerifyFaceUseCase");
      const aiQueue = createAIQueueStub();
      const biometricsRepo = createBiometricsRepoStub();
      const auditLogRepo = createAuditLogRepoStub();

      aiQueue.setError(new AIServiceUnavailableError(9));

      const useCase = new VerifyFaceUseCase(aiQueue, biometricsRepo, auditLogRepo);

      await expect(
        useCase.execute({
          jobId: "job-verify-open",
          frameBase64: "frame-verify-open",
          organizationId: "org-1",
          actorId: "user-1",
          actorType: "user",
        })
      ).rejects.toBeInstanceOf(AIServiceUnavailableError);
      expect(biometricsRepo.calls.findBySimilarity).toHaveLength(0);
      expect(auditLogRepo.calls.insert).toHaveLength(0);
    });

    it("deve retornar 404 quando o memberId informado não existir no tenant atual antes de acionar o AI Service", async () => {
      const VerifyFaceUseCase =
        getUseCaseConstructor<
          UseCaseConstructor<
            [IAIQueueAdapter, BiometricsRepoStub, AuditLogRepoStub],
            VerifyFaceUseCaseContract
          >
        >("VerifyFaceUseCase");
      const aiQueue = createAIQueueStub();
      const biometricsRepo = createBiometricsRepoStub();
      const auditLogRepo = createAuditLogRepoStub();

      aiQueue.setResult({
        embedding: [0.42, 0.24, 0.12],
        qualityScore: 0.79,
        processingMs: 103,
      });

      const useCase = new VerifyFaceUseCase(aiQueue, biometricsRepo, auditLogRepo);

      await expect(
        useCase.execute({
          jobId: "job-member-outside-tenant",
          frameBase64: "frame-member-outside-tenant",
          memberId: "member-from-other-tenant",
          organizationId: "org-b",
          actorId: "user-org-b",
          actorType: "user",
          ipAddress: "198.51.100.40",
        })
      ).rejects.toMatchObject({
        errorCode: "MEMBER_NOT_FOUND",
        httpStatus: 404,
      });
      expect(aiQueue.calls).toHaveLength(0);
      expect(biometricsRepo.calls.findBySimilarity).toHaveLength(0);
      expect(auditLogRepo.calls.insert).toEqual([
        {
          organizationId: "org-b",
          actorId: "user-org-b",
          actorType: "user",
          action: "BIOMETRIC_PROFILE_VERIFIED",
          resourceType: "biometric_profiles",
          resourceId: null,
          ipAddress: "198.51.100.40",
          payload: {
            requested_member_id: "member-from-other-tenant",
            status: "NOT_FOUND",
          },
        },
      ]);
    });

    it("deve retornar SEM_MATCH com confidence 0 quando não houver perfis ativos cadastrados", async () => {
      const VerifyFaceUseCase =
        getUseCaseConstructor<
          UseCaseConstructor<
            [IAIQueueAdapter, BiometricsRepoStub, AuditLogRepoStub],
            VerifyFaceUseCaseContract
          >
        >("VerifyFaceUseCase");
      const aiQueue = createAIQueueStub();
      const biometricsRepo = createBiometricsRepoStub();
      const auditLogRepo = createAuditLogRepoStub();

      aiQueue.setResult({
        embedding: [0.1, 0.1, 0.1],
        qualityScore: 0.68,
        processingMs: 118,
      });
      biometricsRepo.setSimilarityResult(null);

      const useCase = new VerifyFaceUseCase(aiQueue, biometricsRepo, auditLogRepo);

      const result = await useCase.execute({
        jobId: "job-no-profiles",
        frameBase64: "frame-no-profiles",
        organizationId: "org-1",
        actorId: "user-1",
        actorType: "user",
      });

      expect(result).toEqual({
        result: "SEM_MATCH",
        confidence: 0,
        processingMs: 118,
      });
      expect("memberId" in result).toBe(false);
      expect(auditLogRepo.calls.insert[0]).toMatchObject({
        resourceId: null,
        payload: {
          result: "SEM_MATCH",
          confidence: 0,
        },
      });
    });
  });

  describe("ListFacesUseCase", () => {
    it("deve retornar lista vazia quando não houver perfis ativos", async () => {
      const ListFacesUseCase =
        getUseCaseConstructor<UseCaseConstructor<[BiometricsRepoStub], ListFacesUseCaseContract>>(
          "ListFacesUseCase"
        );
      const biometricsRepo = createBiometricsRepoStub();

      biometricsRepo.setListResult([]);

      const useCase = new ListFacesUseCase(biometricsRepo);

      await expect(useCase.execute({ organizationId: "org-1" })).resolves.toEqual([]);
      expect(biometricsRepo.calls.findByOrgAndMember[0]).toMatchObject({
        organizationId: "org-1",
      });
      expect(biometricsRepo.calls.findByOrgAndMember[0]?.memberId).toBeUndefined();
    });

    it("deve listar perfis filtrando por memberId", async () => {
      const ListFacesUseCase =
        getUseCaseConstructor<UseCaseConstructor<[BiometricsRepoStub], ListFacesUseCaseContract>>(
          "ListFacesUseCase"
        );
      const biometricsRepo = createBiometricsRepoStub();
      const expectedProfiles: BiometricProfileLookup[] = [
        {
          profileId: "profile-1",
          organizationId: "org-1",
          memberId: "member-1",
          modelVersion: "ArcFace-v1",
          qualityScore: 0.93,
          isActive: true,
          deviceId: "device-1",
          createdBy: "user-1",
          enrolledAt: new Date("2026-04-25T00:00:00.000Z"),
          lastMatchedAt: null,
          deletedAt: null,
          deletedBy: null,
        },
      ];

      biometricsRepo.setListResult(expectedProfiles);

      const useCase = new ListFacesUseCase(biometricsRepo);

      await expect(
        useCase.execute({ organizationId: "org-1", memberId: "member-1" })
      ).resolves.toEqual(expectedProfiles);
      expect(biometricsRepo.calls.findByOrgAndMember).toEqual([
        { organizationId: "org-1", memberId: "member-1" },
      ]);
    });

    it("deve respeitar o isolamento por organização ao listar perfis", async () => {
      const ListFacesUseCase =
        getUseCaseConstructor<UseCaseConstructor<[BiometricsRepoStub], ListFacesUseCaseContract>>(
          "ListFacesUseCase"
        );
      const biometricsRepo = createBiometricsRepoStub();
      const orgAProfiles: BiometricProfileLookup[] = [
        {
          profileId: "profile-org-a",
          organizationId: "org-a",
          memberId: "member-a",
          modelVersion: "ArcFace-v1",
          qualityScore: 0.81,
          isActive: true,
          deviceId: null,
          createdBy: "user-a",
          enrolledAt: new Date("2026-04-25T01:00:00.000Z"),
          lastMatchedAt: null,
          deletedAt: null,
          deletedBy: null,
        },
      ];
      const orgBProfiles: BiometricProfileLookup[] = [
        {
          profileId: "profile-org-b",
          organizationId: "org-b",
          memberId: "member-b",
          modelVersion: "ArcFace-v1",
          qualityScore: 0.86,
          isActive: true,
          deviceId: null,
          createdBy: "user-b",
          enrolledAt: new Date("2026-04-25T02:00:00.000Z"),
          lastMatchedAt: null,
          deletedAt: null,
          deletedBy: null,
        },
      ];

      biometricsRepo.setListHandler(async ({ organizationId }) =>
        organizationId === "org-b" ? orgBProfiles : orgAProfiles
      );

      const useCase = new ListFacesUseCase(biometricsRepo);

      await expect(useCase.execute({ organizationId: "org-b" })).resolves.toEqual(orgBProfiles);
      expect(biometricsRepo.calls.findByOrgAndMember[0]).toMatchObject({
        organizationId: "org-b",
      });
      expect(biometricsRepo.calls.findByOrgAndMember[0]?.memberId).toBeUndefined();
    });
  });

  describe("RevokeBiometricUseCase", () => {
    it("deve revogar um perfil biométrico com sucesso", async () => {
      const RevokeBiometricUseCase =
        getUseCaseConstructor<
          UseCaseConstructor<[BiometricsRepoStub, AuditLogRepoStub], RevokeBiometricUseCaseContract>
        >("RevokeBiometricUseCase");
      const biometricsRepo = createBiometricsRepoStub();
      const auditLogRepo = createAuditLogRepoStub();

      biometricsRepo.setRevokeResult(true);
      biometricsRepo.setActiveProfileByIdResult({
        profileId: "profile-1",
        organizationId: "org-1",
        memberId: "member-1",
        modelVersion: "ArcFace-v1",
        qualityScore: 0.91,
        isActive: true,
        deviceId: null,
        createdBy: "user-admin",
        enrolledAt: new Date("2026-04-25T00:00:00.000Z"),
        lastMatchedAt: null,
        deletedAt: null,
        deletedBy: null,
      });

      const useCase = new RevokeBiometricUseCase(biometricsRepo, auditLogRepo);

      await expect(
        useCase.execute({
          profileId: "profile-1",
          organizationId: "org-1",
          deletedBy: "user-admin",
          actorId: "user-admin",
          actorType: "user",
          ipAddress: "203.0.113.50",
        })
      ).resolves.toBeUndefined();
      expect(biometricsRepo.calls.findActiveProfileById).toEqual([
        {
          profileId: "profile-1",
          organizationId: "org-1",
        },
      ]);
      expect(biometricsRepo.calls.revoke).toEqual([
        {
          profileId: "profile-1",
          organizationId: "org-1",
          deletedBy: "user-admin",
        },
      ]);
      expect(auditLogRepo.calls.insert).toEqual([
        {
          organizationId: "org-1",
          actorId: "user-admin",
          actorType: "user",
          action: "BIOMETRIC_PROFILE_REVOKED",
          resourceType: "biometric_profiles",
          resourceId: "profile-1",
          ipAddress: "203.0.113.50",
          payload: {
            profile_id: "profile-1",
            member_id: "member-1",
            deleted_by: "user-admin",
          },
        },
      ]);
    });

    it("deve retornar erro quando o perfil não existir", async () => {
      const RevokeBiometricUseCase =
        getUseCaseConstructor<
          UseCaseConstructor<[BiometricsRepoStub, AuditLogRepoStub], RevokeBiometricUseCaseContract>
        >("RevokeBiometricUseCase");
      const biometricsRepo = createBiometricsRepoStub();
      const auditLogRepo = createAuditLogRepoStub();

      biometricsRepo.setRevokeResult(false);
      biometricsRepo.setActiveProfileByIdResult(null);

      const useCase = new RevokeBiometricUseCase(biometricsRepo, auditLogRepo);

      await expect(
        useCase.execute({
          profileId: "profile-missing",
          organizationId: "org-1",
          deletedBy: "user-admin",
          actorId: "user-admin",
          actorType: "user",
        })
      ).rejects.toBeInstanceOf(BiometricProfileNotFoundError);
      expect(auditLogRepo.calls.insert).toEqual([
        {
          organizationId: "org-1",
          actorId: "user-admin",
          actorType: "user",
          action: "BIOMETRIC_PROFILE_REVOKED",
          resourceType: "biometric_profiles",
          resourceId: null,
          payload: {
            requested_profile_id: "profile-missing",
            status: "NOT_FOUND",
          },
        },
      ]);
    });

    it("deve retornar 404 quando o profileId pertencer a outra organização", async () => {
      const RevokeBiometricUseCase =
        getUseCaseConstructor<
          UseCaseConstructor<[BiometricsRepoStub, AuditLogRepoStub], RevokeBiometricUseCaseContract>
        >("RevokeBiometricUseCase");
      const biometricsRepo = createBiometricsRepoStub();
      const auditLogRepo = createAuditLogRepoStub();

      biometricsRepo.setRevokeResult(false);
      biometricsRepo.setActiveProfileByIdResult(null);

      const useCase = new RevokeBiometricUseCase(biometricsRepo, auditLogRepo);

      await expect(
        useCase.execute({
          profileId: "profile-org-a",
          organizationId: "org-b",
          deletedBy: "user-admin",
          actorId: "user-admin",
          actorType: "user",
        })
      ).rejects.toBeInstanceOf(BiometricProfileNotFoundError);
      expect(auditLogRepo.calls.insert).toEqual([
        {
          organizationId: "org-b",
          actorId: "user-admin",
          actorType: "user",
          action: "BIOMETRIC_PROFILE_REVOKED",
          resourceType: "biometric_profiles",
          resourceId: null,
          payload: {
            requested_profile_id: "profile-org-a",
            status: "NOT_FOUND",
          },
        },
      ]);
      expect(biometricsRepo.calls.revoke).toEqual([]);
    });
  });
});
