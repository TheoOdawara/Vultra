/**
 * VULTRA — Redis Singleton
 *
 * Single Redis client for the entire api-core process.
 * Import this module wherever a Redis connection is needed.
 *
 * Error/connect events are intentionally silent at the module level;
 * the application continues operating in degraded mode when Redis is
 * unreachable (circuit-breaker logic lives in AIJobQueue).
 */

import { Redis } from "ioredis";
import { env } from "../shared/infra/env/env.ts";

export const redis = new Redis(env.redisUrl);

redis.on("error", () => undefined);
redis.on("connect", () => undefined);
