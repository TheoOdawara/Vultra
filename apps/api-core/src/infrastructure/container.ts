/**
 * VULTRA — DI Container
 *
 * Instantiates all infrastructure singletons (AIJobQueue) that route
 * modules and use cases share. Repositories are still instantiated per
 * route-init call so they each hold a fresh reference to the DB client.
 *
 * Import `aiQueue` wherever a queue reference is needed at startup.
 */

import { AIJobQueue } from "../adapters/queue/ai-job.queue";
import { redis } from "./redis";

export const aiQueue = new AIJobQueue(
  redis,
  process.env.AI_QUEUE_NAME ?? "ai:recognition:queue",
  process.env.AI_RESULT_PREFIX ?? "ai:recognition:result:"
);
