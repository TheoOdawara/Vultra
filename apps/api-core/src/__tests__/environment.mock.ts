import type { Environment } from "../shared/infra/env/environment.ts";

export const environmentModulePath = import.meta.resolve("../shared/infra/env/env.ts");

export const mockedEnvironment: Environment = {
  databaseUrl: "postgresql://test:test@localhost:5432/test",
  redisUrl: "redis://localhost:6379",
  authSecret: "test-auth-secret-not-used-by-any-real-signature",
  authBaseUrl: "http://localhost:3000",
  trustedOrigins: ["http://localhost:3000"],
  port: 3000,
  aiQueueName: "ai:recognition:queue",
  aiResultPrefix: "ai:recognition:result:",
};
