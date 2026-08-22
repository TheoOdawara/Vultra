export type Environment = {
  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly authSecret: string;
  readonly authBaseUrl: string;
  readonly trustedOrigins: readonly string[];
  readonly port: number;
  readonly aiQueueName: string;
  readonly aiResultPrefix: string;
};

export type EnvironmentSource = Record<string, string | undefined>;

const MINIMUM_SECRET_LENGTH = 32;
const MINIMUM_PORT = 1;
const MAXIMUM_PORT = 65535;

function hasScheme(raw: string, schemes: readonly string[]): boolean {
  try {
    return schemes.includes(new URL(raw).protocol);
  } catch {
    return false;
  }
}

function isPostgresUrl(raw: string): boolean {
  return hasScheme(raw, ["postgres:", "postgresql:"]);
}

function isRedisUrl(raw: string): boolean {
  return hasScheme(raw, ["redis:", "rediss:"]);
}

function isHttpUrl(raw: string): boolean {
  return hasScheme(raw, ["http:", "https:"]);
}

function isSecret(raw: string): boolean {
  return raw.trim().length >= MINIMUM_SECRET_LENGTH;
}

function isOriginList(raw: string): boolean {
  const entries = splitOrigins(raw);
  return entries.length > 0 && entries.every(isHttpUrl);
}

function isPort(raw: string): boolean {
  if (!/^\d+$/.test(raw)) {
    return false;
  }
  const parsed = Number(raw);
  return parsed >= MINIMUM_PORT && parsed <= MAXIMUM_PORT;
}

function isNonEmpty(raw: string): boolean {
  return raw.trim().length > 0;
}

function splitOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function readEnvironment(source: EnvironmentSource): Environment {
  const failures: string[] = [];

  const read = (name: string, format: string, isValid: (raw: string) => boolean): string => {
    const raw = source[name];
    if (raw === undefined || !isValid(raw)) {
      failures.push(`${name}: expected ${format}`);
      return "";
    }
    return raw;
  };

  const raw = {
    databaseUrl: read("DATABASE_URL", "postgresql://user:password@host:port/database", isPostgresUrl),
    redisUrl: read("REDIS_URL", "redis://[:password@]host:port", isRedisUrl),
    authSecret: read(
      "BETTER_AUTH_SECRET",
      `a secret of at least ${MINIMUM_SECRET_LENGTH} characters`,
      isSecret
    ),
    authBaseUrl: read("BETTER_AUTH_URL", "an http(s) base URL of this API", isHttpUrl),
    trustedOrigins: read(
      "BETTER_AUTH_TRUSTED_ORIGINS",
      "a comma-separated list of http(s) origins, at least one",
      isOriginList
    ),
    port: read("PORT", `an integer between ${MINIMUM_PORT} and ${MAXIMUM_PORT}`, isPort),
    aiQueueName: read("AI_QUEUE_NAME", "a non-empty Redis list key", isNonEmpty),
    aiResultPrefix: read("AI_RESULT_PREFIX", "a non-empty Redis key prefix", isNonEmpty),
  };

  if (failures.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${failures.map((failure) => `  - ${failure}`).join("\n")}`
    );
  }

  return {
    databaseUrl: raw.databaseUrl,
    redisUrl: raw.redisUrl,
    authSecret: raw.authSecret,
    authBaseUrl: raw.authBaseUrl,
    trustedOrigins: splitOrigins(raw.trustedOrigins),
    port: Number(raw.port),
    aiQueueName: raw.aiQueueName,
    aiResultPrefix: raw.aiResultPrefix,
  };
}
