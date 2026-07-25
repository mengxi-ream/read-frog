import { describe, expect, it } from "vitest"
import {
  attachRequestErrorMeta,
  defaultRequestRetryPolicy,
  getRequestErrorMeta,
  MAX_CONSECUTIVE_RATE_LIMIT_PAUSES,
  MAX_RATE_LIMIT_RETRIES_PER_TASK,
  MAX_RETRY_AFTER_MS,
  RATE_LIMIT_BASE_PAUSE_MS,
} from "../retry-policy"

const retryContext = {
  retryCount: 0,
  maxRetries: 2,
  baseRetryDelayMs: 100,
  now: 0,
  rateLimitRetryCount: 0,
  consecutiveRateLimits: 0,
}

function errorWithStatus(statusCode: number) {
  return Object.assign(new Error(`HTTP ${statusCode}`), { statusCode })
}

function rateLimitError(headers?: Record<string, string>) {
  return Object.assign(new Error("Too Many Requests"), {
    statusCode: 429,
    ...(headers ? { responseHeaders: headers } : {}),
  })
}

describe("request retry policy", () => {
  it.each([
    { statusCode: 408, kind: "timeout" },
    { statusCode: 409, kind: "unknown" },
  ] as const)(
    "keeps $statusCode retryable instead of classifying it as bad-request",
    ({ statusCode, kind }) => {
      const error = errorWithStatus(statusCode)

      expect(getRequestErrorMeta(error)).toEqual(
        expect.objectContaining({
          statusCode,
          kind,
        }),
      )
      expect(defaultRequestRetryPolicy.decide(error, retryContext)).toEqual(
        expect.objectContaining({
          action: "retry",
        }),
      )
    },
  )

  it("fails ordinary bad requests without retrying", () => {
    expect(getRequestErrorMeta(errorWithStatus(400))).toEqual(
      expect.objectContaining({
        statusCode: 400,
        kind: "bad-request",
      }),
    )
    expect(defaultRequestRetryPolicy.decide(errorWithStatus(400), retryContext)).toEqual({
      action: "fail",
    })
  })

  it.each([401, 403, 404])("keeps %s as queue-fatal", (statusCode) => {
    expect(defaultRequestRetryPolicy.decide(errorWithStatus(statusCode), retryContext)).toEqual({
      action: "fail",
      failQueue: true,
    })
  })

  it("preserves explicit bad-request metadata precedence", () => {
    const error = attachRequestErrorMeta(errorWithStatus(409), { kind: "bad-request" })

    expect(getRequestErrorMeta(error)).toEqual(
      expect.objectContaining({
        statusCode: 409,
        kind: "bad-request",
      }),
    )
    expect(defaultRequestRetryPolicy.decide(error, retryContext)).toEqual({
      action: "fail",
    })
  })

  describe("429 pause-and-retry", () => {
    it("pauses instead of failing the queue", () => {
      const decision = defaultRequestRetryPolicy.decide(rateLimitError(), retryContext)
      expect(decision.action).toBe("pause-and-retry")
      if (decision.action !== "pause-and-retry") return
      // no Retry-After header: exponential base pause with ≤10% jitter
      expect(decision.pauseMs).toBeGreaterThanOrEqual(RATE_LIMIT_BASE_PAUSE_MS)
      expect(decision.pauseMs).toBeLessThanOrEqual(RATE_LIMIT_BASE_PAUSE_MS * 1.1)
    })

    it("honors a Retry-After seconds header larger than the backoff", () => {
      const decision = defaultRequestRetryPolicy.decide(
        rateLimitError({ "retry-after": "30" }),
        retryContext,
      )
      expect(decision).toEqual({ action: "pause-and-retry", pauseMs: 30_000 })
    })

    it("prefers a retry-after-ms header over retry-after", () => {
      const decision = defaultRequestRetryPolicy.decide(
        rateLimitError({ "retry-after-ms": "15000", "retry-after": "1" }),
        retryContext,
      )
      expect(decision).toEqual({ action: "pause-and-retry", pauseMs: 15_000 })
    })

    it("honors explicit retryAfterMs metadata", () => {
      const error = attachRequestErrorMeta(rateLimitError(), { retryAfterMs: 42_000 })
      const decision = defaultRequestRetryPolicy.decide(error, retryContext)
      expect(decision).toEqual({ action: "pause-and-retry", pauseMs: 42_000 })
    })

    it("clamps a hostile Retry-After to MAX_RETRY_AFTER_MS", () => {
      const decision = defaultRequestRetryPolicy.decide(
        rateLimitError({ "retry-after": "86400" }),
        retryContext,
      )
      expect(decision).toEqual({ action: "pause-and-retry", pauseMs: MAX_RETRY_AFTER_MS })
    })

    it("doubles the base pause per consecutive rate-limit window", () => {
      const decision = defaultRequestRetryPolicy.decide(rateLimitError(), {
        ...retryContext,
        consecutiveRateLimits: 2,
      })
      expect(decision.action).toBe("pause-and-retry")
      if (decision.action !== "pause-and-retry") return
      expect(decision.pauseMs).toBeGreaterThanOrEqual(RATE_LIMIT_BASE_PAUSE_MS * 4)
      expect(decision.pauseMs).toBeLessThanOrEqual(RATE_LIMIT_BASE_PAUSE_MS * 4 * 1.1)
    })

    it("fails the queue once consecutive pauses hit the cap", () => {
      expect(
        defaultRequestRetryPolicy.decide(rateLimitError(), {
          ...retryContext,
          consecutiveRateLimits: MAX_CONSECUTIVE_RATE_LIMIT_PAUSES,
        }),
      ).toEqual({ action: "fail", failQueue: true })
    })

    it("fails the queue once a single task exhausts its 429 retry budget", () => {
      expect(
        defaultRequestRetryPolicy.decide(rateLimitError(), {
          ...retryContext,
          rateLimitRetryCount: MAX_RATE_LIMIT_RETRIES_PER_TASK,
        }),
      ).toEqual({ action: "fail", failQueue: true })
    })

    it("classifies rate limits by kind as well as status code", () => {
      const error = attachRequestErrorMeta(new Error("slow down"), { kind: "rate-limit" })
      const decision = defaultRequestRetryPolicy.decide(error, retryContext)
      expect(decision.action).toBe("pause-and-retry")
    })
  })
})
