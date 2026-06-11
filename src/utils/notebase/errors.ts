import { ORPCError } from "@orpc/client"

export function isORPCUnauthorizedError(error: unknown) {
  return error instanceof ORPCError && (error.code === "UNAUTHORIZED" || error.status === 401)
}

export function isORPCForbiddenError(error: unknown) {
  return error instanceof ORPCError && (error.code === "FORBIDDEN" || error.status === 403)
}

export function isORPCNotFoundError(error: unknown) {
  return error instanceof ORPCError && (error.code === "NOT_FOUND" || error.status === 404)
}

export function isORPCValidationError(error: unknown) {
  return error instanceof ORPCError && (error.code === "CELL_VALIDATION_FAILED" || error.status === 422)
}
