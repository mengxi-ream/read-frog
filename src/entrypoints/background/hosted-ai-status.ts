import type { HostedAiStatus } from "@/utils/hosted-ai/types"
import { storage } from "#imports"
import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"
import { backgroundOrpcClient } from "@/utils/orpc/background-client"

/**
 * Long enough to collapse the serialized per-batch resolves that dominate
 * subtitle playback, short enough that a quota exhausted mid-session surfaces
 * within seconds.
 *
 * A stale `available: true` cannot cost credit: nothing derived from this
 * response rides the wire (the generation schema carries only modelTier,
 * requestId, instructions, prompt, temperature), and the server refuses an
 * over-quota request before it reaches the model, releasing the reservation at
 * zero. The verdict is also boolean, not a budget — a fresh response says
 * `available: true` at 5% remaining exactly as a cached one does. What a stale
 * entry does cost is a delayed error message, which is what bounds the TTL.
 */
const HOSTED_AI_STATUS_TTL_MS = 30_000

/**
 * Session storage, not a module variable: the MV3 service worker is torn down
 * on idle, so an in-memory entry would rarely outlive the gap between two
 * batches. Session storage survives that teardown, is shared by every tab, is
 * cleared with the browser session, and never reaches disk.
 */
const CACHE_KEY = "session:hostedAiStatus" as const

interface CachedStatus {
  status: HostedAiStatus
  cachedAt: number
}

/** Coalesces concurrent asks from every tab into one upstream request. */
let inflight: Promise<HostedAiStatus | null> | null = null

/**
 * Drop the cached verdict. Called when the auth cookie changes: a guest verdict
 * served to a user who just signed in (or an entitled one served after sign-out)
 * would be wrong for the whole TTL, and sign-in is exactly when the answer
 * changes.
 */
export async function clearHostedAiStatusCache(): Promise<void> {
  try {
    await storage.removeItem(CACHE_KEY)
  } catch (error) {
    logger.warn("[HostedAiStatus] Failed to clear cache:", error)
  }
}

async function readCachedStatus(): Promise<HostedAiStatus | null> {
  try {
    const cached = await storage.getItem<CachedStatus>(CACHE_KEY)
    if (!cached || Date.now() - cached.cachedAt > HOSTED_AI_STATUS_TTL_MS) {
      return null
    }
    return cached.status
  } catch (error) {
    logger.warn("[HostedAiStatus] Failed to read cache:", error)
    return null
  }
}

function fetchAndCache(): Promise<HostedAiStatus | null> {
  inflight ??= backgroundOrpcClient.hostedAi
    .status({})
    .then(async (status) => {
      // Successes only. Caching a failure would pin `modelRevision: "unknown"`
      // into every provider ref minted during the window, and that value is
      // hashed into the *persistent* translation cache keys — so everything
      // translated then would be stored under a key nothing looks up again,
      // and be re-translated and re-billed on the next visit.
      try {
        await storage.setItem<CachedStatus>(CACHE_KEY, { status, cachedAt: Date.now() })
      } catch (error) {
        logger.warn("[HostedAiStatus] Failed to write cache:", error)
      }
      return status
    })
    .catch((error) => {
      // Fail open: the caller treats null as "no verdict", and the generation
      // endpoints enforce access on their own.
      logger.warn("[HostedAiStatus] Status fetch failed:", error)
      return null
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

export function setupHostedAiStatusHandler(): void {
  onMessage("getHostedAiStatus", async () => {
    return (await readCachedStatus()) ?? (await fetchAndCache())
  })
}
