import { describe, expect, it } from "vitest"
import { attachRequestErrorMeta, defaultRequestRetryPolicy, getRequestErrorMeta } from "../retry-policy"

const retryContext = {
  retryCount: 0,
  maxRetries: 2,
  baseRetryDelayMs: 100,
  now: 0,
}

function errorWithStatus(statusCode: number) {
  return Object.assign(new Error(`HTTP ${statusCode}`), { statusCode })
}

describe("request retry policy", () => {
  it.each([
    { statusCode: 408, kind: "timeout" },
    { statusCode: 409, kind: "unknown" },
  ] as const)("keeps $statusCode retryable instead of classifying it as bad-request", ({ statusCode, kind }) => {
    const error = errorWithStatus(statusCode)

    expect(getRequestErrorMeta(error)).toEqual(expect.objectContaining({
      statusCode,
      kind,
    }))
    expect(defaultRequestRetryPolicy.decide(error, retryContext)).toEqual(expect.objectContaining({
      action: "retry",
    }))
  })

  it("fails ordinary bad requests without retrying", () => {
    expect(getRequestErrorMeta(errorWithStatus(400))).toEqual(expect.objectContaining({
      statusCode: 400,
      kind: "bad-request",
    }))
    expect(defaultRequestRetryPolicy.decide(errorWithStatus(400), retryContext)).toEqual({
      action: "fail",
    })
  })

  it.each([401, 403, 404, 429])("keeps %s as queue-fatal", (statusCode) => {
    expect(defaultRequestRetryPolicy.decide(errorWithStatus(statusCode), retryContext)).toEqual({
      action: "fail",
      failQueue: true,
    })
  })

  it("preserves explicit bad-request metadata precedence", () => {
    const error = attachRequestErrorMeta(errorWithStatus(409), { kind: "bad-request" })

    expect(getRequestErrorMeta(error)).toEqual(expect.objectContaining({
      statusCode: 409,
      kind: "bad-request",
    }))
    expect(defaultRequestRetryPolicy.decide(error, retryContext)).toEqual({
      action: "fail",
    })
  })
})
