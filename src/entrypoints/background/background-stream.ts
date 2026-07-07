import type { Browser } from "#imports"
import type {
  BackgroundStreamPortName,
  BackgroundStreamSnapshot,
  BackgroundStreamStructuredObjectSerializablePayload,
  BackgroundStreamTextSerializablePayload,
  BackgroundStructuredObjectOutputField,
  BackgroundStructuredObjectStreamSnapshot,
  BackgroundTextStreamSnapshot,
  StartMessageParseResult,
  StreamPortHandler,
  StreamPortRequestMessage,
  StreamPortResponse,
  StreamPortResponseWithoutRequestId,
  StreamRuntimeOptions,
  ThinkingSnapshot,
} from "@/types/background-stream"
import { Output, parsePartialJson, streamText } from "ai"
import { z } from "zod"
import { BACKGROUND_STREAM_PORTS } from "@/types/background-stream"
import { extractAISDKErrorMessage } from "@/utils/error/extract-message"
import { i18n } from "@/utils/i18n"
import { logger } from "@/utils/logger"
import { backgroundOrpcClient } from "@/utils/orpc/background-client"
import { getModelById } from "@/utils/providers/model"
import { isFreeAiProviderId } from "@/utils/providers/provider-registry"

const invalidStreamStartPayloadMessage = "Invalid stream start payload"
const aiStreamProtocolErrorMessage = "Invalid AI stream response."
const aiOutputValidationErrorMessage = "AI output does not match the expected format."
const aiOutputLengthLimitErrorMessage
  = "The AI output reached the length limit. Please reduce the requested output length and try again."

type AiStreamPart = Record<string, unknown> & { type: string }

function createStreamAbortError(message: string) {
  return new DOMException(message, "AbortError")
}

function isAbortLikeError(error: unknown) {
  return (error instanceof DOMException && error.name === "AbortError")
    || (error instanceof Error && error.name === "AbortError")
}

const streamPortStartEnvelopeSchema = z.object({
  type: z.literal("start"),
  requestId: z.string().trim().min(1),
  payload: z.unknown(),
})

const streamTextPayloadSchema = z.object({
  providerId: z.string().trim().min(1),
}).loose()

const structuredObjectFieldSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["string", "number"]),
})

const structuredObjectPayloadSchema = z.object({
  providerId: z.string().trim().min(1),
  outputSchema: z.array(structuredObjectFieldSchema).min(1),
}).loose().superRefine((payload, ctx) => {
  const nameSet = new Set<string>()

  payload.outputSchema.forEach((field, index) => {
    if (nameSet.has(field.name)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate output schema name "${field.name}".`,
        path: ["outputSchema", index, "name"],
      })
      return
    }
    nameSet.add(field.name)
  })
})

function createStartMessageParser<TSerializablePayload>(payloadSchema: z.ZodTypeAny) {
  return (msg: unknown): StartMessageParseResult<TSerializablePayload> => {
    const envelopeResult = streamPortStartEnvelopeSchema.safeParse(msg)
    if (!envelopeResult.success) {
      return { success: false }
    }

    const payloadResult = payloadSchema.safeParse(envelopeResult.data.payload)
    if (!payloadResult.success) {
      return {
        success: false,
        requestId: envelopeResult.data.requestId,
      }
    }

    return {
      success: true,
      message: {
        type: "start",
        requestId: envelopeResult.data.requestId,
        payload: payloadResult.data as TSerializablePayload,
      },
    }
  }
}

function createStreamPortHandler<TSerializablePayload, TResponse>(
  streamFn: (
    serializablePayload: TSerializablePayload,
    options: StreamRuntimeOptions<TResponse>,
  ) => Promise<TResponse>,
  startMessageParser: (msg: unknown) => StartMessageParseResult<TSerializablePayload>,
) {
  return (port: Browser.runtime.Port) => {
    const abortController = new AbortController()
    let isActive = true
    let hasStarted = false
    let requestId: string | undefined
    let messageListener: ((rawMessage: unknown) => void) | undefined
    let disconnectListener: (() => void) | undefined

    const safePost = (response: StreamPortResponseWithoutRequestId<TResponse>) => {
      if (!isActive || abortController.signal.aborted || !requestId) {
        return
      }
      try {
        const message: StreamPortResponse<TResponse> = {
          ...response,
          requestId,
        }
        port.postMessage(message)
      }
      catch (error) {
        logger.error("[Background] Stream port post failed", error)
      }
    }

    const cleanup = () => {
      if (!isActive) {
        return
      }
      isActive = false
      if (messageListener) {
        port.onMessage.removeListener(messageListener)
      }
      if (disconnectListener) {
        port.onDisconnect.removeListener(disconnectListener)
      }
    }

    disconnectListener = () => {
      abortController.abort(createStreamAbortError("stream port disconnected"))
      cleanup()
    }

    messageListener = async (rawMessage: unknown) => {
      const requestMessage = rawMessage as StreamPortRequestMessage<TSerializablePayload> | undefined
      if (requestMessage?.type === "ping") {
        return
      }

      if (hasStarted) {
        return
      }

      const parseResult = startMessageParser(rawMessage)
      if (!parseResult.success) {
        if (parseResult.requestId) {
          requestId = parseResult.requestId
          safePost({
            type: "error",
            error: { message: invalidStreamStartPayloadMessage },
          })
        }

        cleanup()
        try {
          port.disconnect()
        }
        catch {
          // The port may already be closed due to a race with onDisconnect.
          // This is expected during cleanup and safe to ignore.
        }
        return
      }

      const startMessage = parseResult.message
      requestId = startMessage.requestId
      hasStarted = true
      let streamError: unknown

      try {
        const result = await streamFn(startMessage.payload, {
          signal: abortController.signal,
          onChunk: (snapshot) => {
            safePost({ type: "chunk", data: snapshot })
          },
          onError: (error) => {
            if (streamError === undefined) {
              streamError = error
            }
          },
        })

        if (streamError !== undefined) {
          throw streamError
        }

        if (!abortController.signal.aborted) {
          safePost({ type: "done", data: result })
        }
      }
      catch (error) {
        const finalError = streamError ?? error
        if (abortController.signal.aborted || isAbortLikeError(finalError)) {
          return
        }

        logger.error("[Background] Stream Function failed", finalError)
        safePost({ type: "error", error: { message: extractAISDKErrorMessage(finalError) } })
      }
      finally {
        cleanup()
        try {
          port.disconnect()
        }
        catch {
          // The port may already be closed due to a race with onDisconnect.
          // This is expected during cleanup and safe to ignore.
        }
      }
    }

    port.onMessage.addListener(messageListener)
    port.onDisconnect.addListener(disconnectListener)
  }
}

function createStreamSnapshot<TOutput>(
  output: TOutput,
  thinking: ThinkingSnapshot,
): BackgroundStreamSnapshot<TOutput> {
  return {
    output: output !== null && typeof output === "object"
      ? { ...output } as TOutput
      : output,
    thinking: { ...thinking },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

class BackgroundStreamError extends Error {
  constructor(
    readonly code: string,
    message: string,
    options?: { cause?: unknown, retryAfterMs?: number },
  ) {
    super(message, { cause: options?.cause })
    this.retryAfterMs = options?.retryAfterMs
  }

  readonly retryAfterMs?: number
}

function toAiStreamPart(part: unknown): AiStreamPart {
  if (!isRecord(part) || typeof part.type !== "string" || part.type.trim().length === 0) {
    throw new BackgroundStreamError("stream_protocol_error", aiStreamProtocolErrorMessage)
  }

  return part as AiStreamPart
}

function createStructuredObjectSchema(
  outputSchema: BackgroundStructuredObjectOutputField[],
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const fieldTypeToZodSchema: Record<string, z.ZodTypeAny> = {
    string: z.string().nullable(),
    number: z.number().nullable(),
  }

  const schemaShape: Record<string, z.ZodTypeAny> = {}
  for (const field of outputSchema) {
    schemaShape[field.name] = fieldTypeToZodSchema[field.type] ?? z.string().nullable()
  }

  return z.strictObject(schemaShape)
}

function getStringPartField(part: Record<string, unknown>, field: string): string {
  const value = part[field]
  if (typeof value !== "string") {
    throw new BackgroundStreamError("stream_protocol_error", aiStreamProtocolErrorMessage)
  }

  return value
}

function getStreamPartError(part: Record<string, unknown>): unknown {
  return "error" in part
    ? part.error
    : new BackgroundStreamError("stream_protocol_error", aiStreamProtocolErrorMessage)
}

function isOrpcRateLimitError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false
  }

  const candidate = error as { code?: unknown, status?: unknown }
  return candidate.status === 429 || candidate.code === "TOO_MANY_REQUESTS"
}

function getHostedAiRateLimitQuotaScope(error: unknown): "guest" | "user" | undefined {
  if (!isRecord(error) || !isRecord(error.data)) {
    return undefined
  }

  if (error.data.quotaScope === "guest" || error.data.quotaScope === "user") {
    return error.data.quotaScope
  }

  return undefined
}

function getHostedAiRateLimitMessage(error: unknown): string {
  switch (getHostedAiRateLimitQuotaScope(error)) {
    case "guest":
      return i18n.t("hostedAi.errors.guestRateLimited")
    case "user":
      return i18n.t("hostedAi.errors.userRateLimited")
    default:
      return i18n.t("hostedAi.errors.rateLimited")
  }
}

function normalizeHostedAiError(error: unknown): unknown {
  if (isOrpcRateLimitError(error)) {
    return new BackgroundStreamError("rate_limited", getHostedAiRateLimitMessage(error), { cause: error })
  }

  return error
}

function getStreamFinishReason(part: Record<string, unknown>): string | undefined {
  return typeof part.finishReason === "string"
    ? part.finishReason
    : undefined
}

function validateFinishedStream(hasFinish: boolean, finishReason: string | undefined): void {
  if (!hasFinish) {
    throw new BackgroundStreamError("stream_protocol_error", aiStreamProtocolErrorMessage)
  }

  if (finishReason === "length") {
    throw new BackgroundStreamError("output_validation_failed", aiOutputLengthLimitErrorMessage)
  }
}

async function consumeTextPartStream(
  partStream: AsyncIterable<unknown>,
  options: {
    onChunk?: StreamRuntimeOptions<BackgroundTextStreamSnapshot>["onChunk"]
    signal?: AbortSignal
  },
): Promise<BackgroundTextStreamSnapshot> {
  const { onChunk, signal } = options
  let cumulativeText = ""
  let thinking: ThinkingSnapshot = {
    status: "thinking",
    text: "",
  }
  let hasFinish = false
  let finishReason: string | undefined

  for await (const rawPart of partStream) {
    if (signal?.aborted) {
      throw new DOMException("stream aborted", "AbortError")
    }

    const part = toAiStreamPart(rawPart)
    switch (part.type) {
      case "text-delta": {
        cumulativeText += getStringPartField(part, "text")
        onChunk?.(createStreamSnapshot(cumulativeText, thinking))
        break
      }
      case "reasoning-start": {
        thinking = {
          ...thinking,
          status: "thinking",
        }
        break
      }
      case "reasoning-delta": {
        thinking = {
          status: "thinking",
          text: thinking.text + getStringPartField(part, "text"),
        }
        onChunk?.(createStreamSnapshot(cumulativeText, thinking))
        break
      }
      case "reasoning-end": {
        thinking = {
          ...thinking,
          status: "complete",
        }
        onChunk?.(createStreamSnapshot(cumulativeText, thinking))
        break
      }
      case "reasoning-file": {
        break
      }
      case "finish": {
        hasFinish = true
        finishReason = getStreamFinishReason(part)
        break
      }
      case "error": {
        throw getStreamPartError(part)
      }
      default: {
        break
      }
    }
  }

  validateFinishedStream(hasFinish, finishReason)

  thinking = {
    ...thinking,
    status: "complete",
  }

  return createStreamSnapshot(cumulativeText, thinking)
}

async function consumeStructuredObjectPartStream(
  partStream: AsyncIterable<unknown>,
  options: {
    objectSchema: z.ZodObject<Record<string, z.ZodTypeAny>>
    onChunk?: StreamRuntimeOptions<BackgroundStructuredObjectStreamSnapshot>["onChunk"]
    signal?: AbortSignal
  },
): Promise<BackgroundStructuredObjectStreamSnapshot> {
  const { objectSchema, onChunk, signal } = options
  let cumulativeText = ""
  let cumulativeValue: Record<string, unknown> = {}
  let thinking: ThinkingSnapshot = {
    status: "thinking",
    text: "",
  }
  let hasFinish = false
  let finishReason: string | undefined

  for await (const rawPart of partStream) {
    if (signal?.aborted) {
      throw new DOMException("stream aborted", "AbortError")
    }

    const part = toAiStreamPart(rawPart)
    switch (part.type) {
      case "text-delta": {
        cumulativeText += getStringPartField(part, "text")
        const partial = await parsePartialJson(cumulativeText)
        if (isRecord(partial.value)) {
          cumulativeValue = { ...cumulativeValue, ...partial.value }
          onChunk?.(createStreamSnapshot(cumulativeValue, thinking))
        }
        break
      }
      case "reasoning-start": {
        thinking = {
          ...thinking,
          status: "thinking",
        }
        break
      }
      case "reasoning-delta": {
        thinking = {
          status: "thinking",
          text: thinking.text + getStringPartField(part, "text"),
        }
        onChunk?.(createStreamSnapshot(cumulativeValue, thinking))
        break
      }
      case "reasoning-end": {
        thinking = {
          ...thinking,
          status: "complete",
        }
        onChunk?.(createStreamSnapshot(cumulativeValue, thinking))
        break
      }
      case "reasoning-file": {
        break
      }
      case "finish": {
        hasFinish = true
        finishReason = getStreamFinishReason(part)
        break
      }
      case "error": {
        throw getStreamPartError(part)
      }
      default: {
        break
      }
    }
  }

  validateFinishedStream(hasFinish, finishReason)

  try {
    const finalJson = await parsePartialJson(cumulativeText)
    const finalValue = objectSchema.parse(finalJson.value)
    thinking = {
      ...thinking,
      status: "complete",
    }

    return createStreamSnapshot(finalValue, thinking)
  }
  catch (error) {
    throw new BackgroundStreamError("output_validation_failed", aiOutputValidationErrorMessage, { cause: error })
  }
}

async function createLocalTextPartStream(
  serializablePayload: BackgroundStreamTextSerializablePayload,
  options: StreamRuntimeOptions<BackgroundTextStreamSnapshot> = {},
): Promise<AsyncIterable<unknown>> {
  const { providerId, ...streamTextParams } = serializablePayload
  const { signal, onError } = options

  const model = await getModelById(providerId)
  const result = streamText({
    ...(streamTextParams as Parameters<typeof streamText>[0]),
    model,
    abortSignal: signal,
    onError: ({ error }) => {
      onError?.(error)
    },
  })

  return result.stream
}

async function createHostedTextPartStream(
  serializablePayload: BackgroundStreamTextSerializablePayload,
  signal?: AbortSignal,
): Promise<AsyncIterable<unknown>> {
  const { prompt, instructions, temperature } = serializablePayload

  if (!instructions || !prompt) {
    throw new BackgroundStreamError("invalid_request", "Invalid hosted AI request")
  }

  try {
    return await backgroundOrpcClient.hostedAi.translate.streamText({
      instructions,
      prompt,
      temperature,
    }, { signal })
  }
  catch (error) {
    throw normalizeHostedAiError(error)
  }
}

export async function runStreamTextInBackground(
  serializablePayload: BackgroundStreamTextSerializablePayload,
  options: StreamRuntimeOptions<BackgroundTextStreamSnapshot> = {},
): Promise<BackgroundTextStreamSnapshot> {
  const { signal, onChunk } = options

  if (signal?.aborted) {
    throw new DOMException("stream aborted", "AbortError")
  }

  const partStream = isFreeAiProviderId(serializablePayload.providerId)
    ? await createHostedTextPartStream(serializablePayload, signal)
    : await createLocalTextPartStream(serializablePayload, options)

  return consumeTextPartStream(partStream, {
    onChunk,
    signal,
  })
}

async function createLocalStructuredObjectPartStream(
  serializablePayload: BackgroundStreamStructuredObjectSerializablePayload,
  objectSchema: z.ZodObject<Record<string, z.ZodTypeAny>>,
  options: StreamRuntimeOptions<BackgroundStructuredObjectStreamSnapshot> = {},
): Promise<AsyncIterable<unknown>> {
  const { providerId, outputSchema: _outputSchema, ...streamParams } = serializablePayload
  const { signal, onError } = options

  const model = await getModelById(providerId)
  const result = streamText({
    ...(streamParams as Parameters<typeof streamText>[0]),
    model,
    output: Output.object({
      schema: objectSchema,
    }),
    abortSignal: signal,
    onError: ({ error }) => {
      onError?.(error)
    },
  })

  return result.stream
}

async function createHostedStructuredObjectPartStream(
  serializablePayload: BackgroundStreamStructuredObjectSerializablePayload,
  signal?: AbortSignal,
): Promise<AsyncIterable<unknown>> {
  const { outputSchema, prompt, instructions, temperature } = serializablePayload

  if (!instructions || !prompt) {
    throw new BackgroundStreamError("invalid_request", "Invalid hosted AI request")
  }

  try {
    return await backgroundOrpcClient.hostedAi.customAction.streamStructuredObject({
      instructions,
      prompt,
      outputSchema,
      temperature,
    }, { signal })
  }
  catch (error) {
    throw normalizeHostedAiError(error)
  }
}

export async function runStructuredObjectStreamInBackground(
  serializablePayload: BackgroundStreamStructuredObjectSerializablePayload,
  options: StreamRuntimeOptions<BackgroundStructuredObjectStreamSnapshot> = {},
): Promise<BackgroundStructuredObjectStreamSnapshot> {
  const { signal, onChunk } = options

  if (signal?.aborted) {
    throw new DOMException("stream aborted", "AbortError")
  }

  const objectSchema = createStructuredObjectSchema(serializablePayload.outputSchema)
  const partStream = isFreeAiProviderId(serializablePayload.providerId)
    ? await createHostedStructuredObjectPartStream(serializablePayload, signal)
    : await createLocalStructuredObjectPartStream(serializablePayload, objectSchema, options)

  return consumeStructuredObjectPartStream(partStream, {
    objectSchema,
    onChunk,
    signal,
  })
}

const parseStreamTextStartMessage = createStartMessageParser<BackgroundStreamTextSerializablePayload>(streamTextPayloadSchema)
const parseStructuredObjectStartMessage
  = createStartMessageParser<BackgroundStreamStructuredObjectSerializablePayload>(structuredObjectPayloadSchema)

export const handleStreamTextPort = createStreamPortHandler<
  BackgroundStreamTextSerializablePayload,
  BackgroundTextStreamSnapshot
>(
  runStreamTextInBackground,
  parseStreamTextStartMessage,
)

export const handleStreamStructuredObjectPort = createStreamPortHandler<
  BackgroundStreamStructuredObjectSerializablePayload,
  BackgroundStructuredObjectStreamSnapshot
>(
  runStructuredObjectStreamInBackground,
  parseStructuredObjectStartMessage,
)

export const BACKGROUND_STREAM_PORT_HANDLERS: Readonly<
  Record<BackgroundStreamPortName, StreamPortHandler>
> = {
  [BACKGROUND_STREAM_PORTS.streamText]: handleStreamTextPort,
  [BACKGROUND_STREAM_PORTS.streamStructuredObject]: handleStreamStructuredObjectPort,
}

export function dispatchBackgroundStreamPort(port: Browser.runtime.Port): boolean {
  const handler = BACKGROUND_STREAM_PORT_HANDLERS[port.name as BackgroundStreamPortName]
  if (!handler) {
    return false
  }

  handler(port)
  return true
}
