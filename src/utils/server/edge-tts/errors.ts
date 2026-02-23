import type { EdgeTTSErrorCode, EdgeTTSErrorPayload } from '@/types/edge-tts'

export class EdgeTTSError extends Error {
  code: EdgeTTSErrorCode
  retryable: boolean
  status?: number

  constructor(
    code: EdgeTTSErrorCode,
    message: string,
    options?: {
      retryable?: boolean
      status?: number
      cause?: unknown
    },
  ) {
    super(message)
    this.name = 'EdgeTTSError'
    this.code = code
    this.retryable = options?.retryable ?? false
    this.status = options?.status

    if (options?.cause) {
      this.cause = options.cause
    }
  }
}

export function toEdgeTTSErrorPayload(error: unknown): EdgeTTSErrorPayload {
  if (error instanceof EdgeTTSError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      status: error.status,
    }
  }

  if (error instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message,
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'Unknown edge tts error',
  }
}
