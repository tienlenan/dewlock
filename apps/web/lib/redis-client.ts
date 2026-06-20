import "server-only";

/**
 * Shared Upstash Redis client (server-only, REST → serverless-safe).
 *
 * One lazily-constructed client reused across server features (conversation index lives
 * in its own module; this is the general client used by the user-stats cache). Accepts
 * either credential pair — `UPSTASH_REDIS_REST_*` (Upstash console) or `KV_REST_API_*`
 * (Vercel Marketplace injection). The REST token is read here and never leaves the
 * server; `server-only` throws at build if a client bundle imports this.
 */

import { Redis } from "@upstash/redis";

function creds(): { url?: string; token?: string } {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN,
  };
}

/** True when Upstash REST creds are present (either env-var pair). */
export function isRedisConfigured(): boolean {
  const { url, token } = creds();
  return Boolean(url && token);
}

let client: Redis | null = null;
export function getRedis(): Redis {
  if (client) return client;
  const { url, token } = creds();
  if (!url || !token) {
    throw new Error("Upstash Redis not configured — set UPSTASH_REDIS_REST_* or KV_REST_API_*.");
  }
  client = new Redis({ url, token });
  return client;
}
