import { createHash } from "node:crypto";
import { env } from "@/src/server/config/env";
import { redis } from "@/src/server/db/redis";
import { sleep } from "@/src/lib/utils";
import { logger } from "@/src/server/logger";

type FetchOptions = {
  method?: "GET" | "POST";
  headers?: HeadersInit;
  body?: string;
  cacheTtlSeconds?: number;
  cacheNamespace: string;
  retryCount?: number;
  retryBaseDelayMs?: number;
};

function buildCacheKey(namespace: string, value: string): string {
  const hash = createHash("sha256").update(value).digest("hex");
  return `cache:${namespace}:${hash}`;
}

export async function fetchJsonWithCache<T>(url: string, options: FetchOptions): Promise<T> {
  const method = options.method ?? "GET";
  const retryCount = options.retryCount ?? 4;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? 500;
  const cacheTtlSeconds = options.cacheTtlSeconds ?? 900;

  const cacheIdentity = `${method}:${url}:${options.body ?? ""}`;
  const cacheKey = buildCacheKey(options.cacheNamespace, cacheIdentity);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as T;
  }

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        headers: options.headers,
        body: options.body
      });

      if (response.status === 429 || response.status >= 500) {
        if (attempt < retryCount) {
          const jitter = Math.floor(Math.random() * 250);
          const backoff = retryBaseDelayMs * 2 ** attempt + jitter;
          logger.warn(
            {
              url,
              status: response.status,
              attempt,
              backoff
            },
            "Retrying upstream request after backoff"
          );
          await sleep(backoff);
          continue;
        }
      }

      if (!response.ok) {
        throw new Error(`Upstream request failed: ${response.status} ${response.statusText}`);
      }

      const json = (await response.json()) as T;
      await redis.set(cacheKey, JSON.stringify(json), "EX", cacheTtlSeconds);
      return json;
    } catch (error) {
      lastError = error as Error;
      if (attempt < retryCount) {
        const jitter = Math.floor(Math.random() * 250);
        const backoff = retryBaseDelayMs * 2 ** attempt + jitter;
        logger.warn({ url, attempt, backoff, error }, "Retrying after network failure");
        await sleep(backoff);
        continue;
      }
    }
  }

  throw new Error(`Failed request for ${url}: ${lastError?.message ?? "Unknown error"}`);
}

export function requireCredentials(...values: Array<string | undefined>): void {
  if (env.isMockMode) return;
  const missing = values.some((value) => !value || value.trim() === "");
  if (missing) {
    throw new Error("Required provider credentials are missing");
  }
}
