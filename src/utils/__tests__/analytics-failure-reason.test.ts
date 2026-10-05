import { describe, expect, it } from "vitest"
import { ProviderSetupError } from "@/utils/providers/provider-setup-error"
import { classifyFailureReason } from "../analytics-failure-reason"

function namedError(name: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(name), { name, ...extra })
}

/** A background error as the messaging layer rebuilds it: a plain Error that keeps its name. */
function relayedError(name: string, message: string) {
  return Object.assign(new Error(message), { name })
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
    [
      "a deleted Notebase",
      Object.assign(new Error("x"), { code: "NOTEBASE_NOT_FOUND", status: 404 }),
      "not_found",
    ],
    [
      "output that failed the action's schema",
      Object.assign(new Error("x"), { code: "output_validation_failed" }),
      "invalid_output",
    ],
    [
      "a request the background rejected",
      Object.assign(new Error("x"), { code: "invalid_request" }),
      "precheck",
    ],
    ["a provider with no model", new ProviderSetupError("Model is undefined"), "precheck"],
    ["a missing provider setting", namedError("AI_LoadSettingError"), "precheck"],
    ["a dropped connection", new TypeError("Failed to fetch"), "network"],
    [
      "a dropped connection relayed from the background",
      relayedError("TypeError", "Failed to fetch"),
      "network",
    ],
    [
      "a dropped connection in Firefox",
      relayedError("TypeError", "NetworkError when attempting to fetch resource."),
      "network",
    ],
    [
      "a rate limit that outlasted the retries",
      namedError("AI_RetryError", {
        reason: "maxRetriesExceeded",
        lastError: namedError("AI_APICallError", { statusCode: 429 }),
      }),
      "rate_limited",
    ],
    [
      "a rejected key after a retried outage",
      namedError("AI_RetryError", {
        reason: "errorNotRetryable",
        lastError: namedError("AI_APICallError", { statusCode: 401 }),
      }),
      "provider_auth",
    ],
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
    [
      "a malformed base URL",
      new TypeError(
        "Failed to execute 'fetch' on 'WorkerGlobalScope': Failed to parse URL from localhost:11434/v1",
      ),
    ],
    [
      "a code bug that mentions fetch",
      new TypeError("Cannot read properties of undefined (reading 'prefetchQuery')"),
    ],
    ["a non-error value", "boom"],
    ["nothing at all", undefined],
  ])("falls back to unknown for %s", (_scenario, error) => {
    expect(classifyFailureReason(error)).toBe("unknown")
  })
})
