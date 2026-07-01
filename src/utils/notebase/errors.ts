import type { PublicAppErrorCode } from "@read-frog/api-contract"
import { ORPCError } from "@orpc/client"

export function isORPCPublicAppError(error: unknown, code: PublicAppErrorCode) {
  return error instanceof ORPCError && error.code === code
}

export function isORPCUnauthorizedError(error: unknown) {
  return error instanceof ORPCError && (error.code === "UNAUTHORIZED" || error.status === 401)
}

export function isORPCForbiddenError(error: unknown) {
  return error instanceof ORPCError && (error.code === "FORBIDDEN" || error.status === 403)
}

export function isORPCNoteLimitExceededError(error: unknown) {
  return isORPCPublicAppError(error, "NOTE_LIMIT_EXCEEDED")
}

export function isORPCNotFoundError(error: unknown) {
  return error instanceof ORPCError && (error.code === "NOT_FOUND" || error.status === 404)
}

export function isORPCValidationError(error: unknown) {
  return error instanceof ORPCError && (error.code === "CELL_VALIDATION_FAILED" || error.status === 422)
}
