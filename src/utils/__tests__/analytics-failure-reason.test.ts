import { describe, expect, it } from "vitest"
import { classifyFailureReason } from "../analytics-failure-reason"

function namedError(name: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(name), { name, ...extra })
}

describe("classifyFailureReason", () => {
  it.each([
    ["a provider without an API key", namedError("AI_LoadAPIKeyError"), "missing_api_key"],
    ["output that failed its schema", namedError("AI_NoObjectGeneratedError"), "invalid_output"],
    [
      "a rejected provider key",
      namedError("AI_APICallError", { statusCode: 401 }),
      "provider_auth",
    ],
    ["a provider rate limit", namedError("AI_APICallError", { statusCode: 429 }), "rate_limited"],
    ["a provider outage", namedError("AI_APICallError", { statusCode: 503 }), "provider_error"],
    [
      "the Ultra wall",
      Object.assign(new Error("x"), { code: "HOSTED_AI_TIER_RESTRICTED" }),
      "tier_restricted",
    ],
    [
      "an exhausted quota",
      Object.assign(new Error("x"), { code: "HOSTED_AI_QUOTA_EXHAUSTED" }),
      "quota_exceeded",
    ],
    ["a signed-out user", Object.assign(new Error("x"), { code: "UNAUTHORIZED" }), "auth_required"],
    [
      "the free note cap",
      Object.assign(new Error("x"), { code: "NOTE_LIMIT_EXCEEDED" }),
      "note_limit",
    ],
    ["a dropped connection", new TypeError("Failed to fetch"), "network"],
  ])("recognizes %s", (_scenario, error, expected) => {
    expect(classifyFailureReason(error)).toBe(expected)
  })

  it("follows the cause chain the background wraps errors in", () => {
    const wrapped = new Error("stream failed", {
      cause: new Error("outer", { cause: namedError("AI_LoadAPIKeyError") }),
    })

    expect(classifyFailureReason(wrapped)).toBe("missing_api_key")
  })

  it("trusts a reason the background already attached", () => {
    expect(classifyFailureReason(Object.assign(new Error("x"), { reason: "quota_exceeded" }))).toBe(
      "quota_exceeded",
    )
  })

  it.each([
    ["an unrelated error", new Error("boom")],
    ["an unknown code", Object.assign(new Error("x"), { code: "constructor" })],
    ["a made-up reason", Object.assign(new Error("x"), { reason: "gremlins" })],
    ["a non-error value", "boom"],
    ["nothing at all", undefined],
  ])("falls back to unknown for %s", (_scenario, error) => {
    expect(classifyFailureReason(error)).toBe("unknown")
  })
})
