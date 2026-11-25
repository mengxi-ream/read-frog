import type { PublicAppErrorCode } from "@read-frog/api-contract"
import { z } from "zod"

/**
 * The field a failed Built-in AI call carries its request id on, from the background to
 * whatever shows the error. A top-level own field, so it survives both the stream port
 * and the messaging layer's error serialization, which keeps an error's own fields. Named
 * so that no provider's or free translator's own error can carry it by chance: only
 * Built-in AI errors ever show an id.
 */
export const BUILT_IN_AI_REQUEST_ID_FIELD = "builtInAiRequestId"

const requestIdSchema = z.uuid()

const MAX_CAUSE_DEPTH = 5

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** The value when it is a UUID, the only shape a request id comes in. */
function readRequestId(value: unknown): string | undefined {
  const parsed = requestIdSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

/**
 * The id that finds a failed Built-in AI call in the server's logs, traces and billing
 * ledger: the one the server's error names in `data.requestId`, else the one the call was
 * sent with. A server names the id it used, the caller's or one it made up, on every
 * Built-in AI error except the three whose data the contract declares; an older server
 * names none. The published contract types leave the field out, so it is read untyped,
 * down the cause chain, since the background wraps the server's error in its own.
 */
export function resolveBuiltInAiRequestId(
  error: unknown,
  sentRequestId: string | undefined,
): string | undefined {
  let current = error
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && isRecord(current); depth++) {
    const fromServer = isRecord(current.data) ? readRequestId(current.data.requestId) : undefined
    if (fromServer) {
      return fromServer
    }
    current = current.cause
  }
  return readRequestId(sentRequestId)
}

/** The request id the background tagged a failed Built-in AI call with, if any. */
export function getBuiltInAiRequestId(error: unknown): string | undefined {
  return isRecord(error) ? readRequestId(error[BUILT_IN_AI_REQUEST_ID_FIELD]) : undefined
}

/**
 * Refusals whose message already says what to do: log in, the plan the feature needs, the
 * credit used up, another model. They carry no request id, since the user has nothing to
 * report; nor does `invalid_request`, which never left the extension.
 */
const CODES_WITHOUT_REQUEST_ID: ReadonlySet<string> = new Set([
  "HOSTED_AI_TIER_RESTRICTED" satisfies PublicAppErrorCode,
  "HOSTED_AI_QUOTA_EXHAUSTED" satisfies PublicAppErrorCode,
  "HOSTED_AI_MODEL_UNAVAILABLE" satisfies PublicAppErrorCode,
  "UNAUTHORIZED",
  "invalid_request",
])

/**
 * Tags a failed Built-in AI call with the id that finds it on the server (see
 * `resolveBuiltInAiRequestId`), for whatever shows the error to offer in a report. The
 * error keeps its identity and every other field, so retries and failure analytics read it
 * as before. A cancelled call, a refusal and an error already tagged are left as they are,
 * as is a thrown primitive, which has no field to carry the id on.
 */
export function withBuiltInAiRequestId(error: unknown, sentRequestId: string | undefined): unknown {
  if (
    !isRecord(error) ||
    !Object.isExtensible(error) ||
    error.name === "AbortError" ||
    getBuiltInAiRequestId(error) !== undefined ||
    (typeof error.code === "string" && CODES_WITHOUT_REQUEST_ID.has(error.code))
  ) {
    return error
  }
  const requestId = resolveBuiltInAiRequestId(error, sentRequestId)
  if (requestId !== undefined) {
    Object.assign(error, { [BUILT_IN_AI_REQUEST_ID_FIELD]: requestId })
  }
  return error
}
