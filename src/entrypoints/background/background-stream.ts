import type { HostedAiRateLimitErrorData, PublicAppErrorCode } from "@read-frog/api-contract"
import type { Browser } from "#imports"
import type { BackgroundGenerateTextPayload } from "@/types/background-generate-text"
import type {
  BackgroundNoteSuggestionStreamSnapshot,
  BackgroundStreamNoteSuggestionSerializablePayload,
  BackgroundStreamPortName,
  BackgroundStreamSnapshot,
  BackgroundStreamStructuredObjectSerializablePayload,
  BackgroundStreamTextSerializablePayload,
  BackgroundStructuredObjectOutputField,
  BackgroundStructuredObjectStreamSnapshot,
  BackgroundTextStreamSnapshot,
  HostedAiTextStreamRoute,
  StartMessageParseResult,
  StreamPortHandler,
  StreamPortRequestMessage,
  StreamPortResponse,
  StreamPortResponseWithoutRequestId,
  StreamRuntimeOptions,
  ThinkingSnapshot,
} from "@/types/background-stream"
import type { TranslateProviderConfig } from "@/types/config/provider"
import {
  HostedAiNoteSuggestionObjectSchema,
  HostedAiNoteSuggestionStreamInputSchema,
  HostedAiOutputFieldTypeSchema,
  HostedAiRateLimitErrorDataSchema,
  HostedAiStreamStructuredObjectInputSchema,
  HostedAiStreamTextInputSchema,
} from "@read-frog/api-contract"
import { generateText, Output, parsePartialJson, streamText } from "ai"
import { z } from "zod"
import { BACKGROUND_STREAM_PORTS } from "@/types/background-stream"
import { isLLMProviderConfig } from "@/types/config/provider"
import { createStructuredObjectSchema } from "@/utils/ai/structured-object-schema"
import { extractAISDKErrorMessage } from "@/utils/error/extract-message"
import { i18n } from "@/utils/i18n"
import { logger } from "@/utils/logger"
import { noteSuggestionEnvelopeSchema } from "@/utils/note-suggestion/types"
import { backgroundOrpcClient } from "@/utils/orpc/background-client"
import { buildLocalGenerateTextParams } from "@/utils/providers/generate-params"
import { getLanguageModelForConfig, getModelById } from "@/utils/providers/model"
import { isBuiltInAiProviderId } from "@/utils/providers/provider-registry"
import { attachRequestErrorMeta } from "@/utils/request/retry-policy"

const invalidStreamStartPayloadMessage = "Invalid stream start payload"
const aiStreamProtocolErrorMessage = "Invalid AI stream response."
const aiOutputValidationErrorMessage = "AI output does not match the expected format."
const aiOutputLengthLimitErrorMessage =
  "The AI output reached the length limit. Please reduce the requested output length and try again."

type AiStreamPart = Record<string, unknown> & { type: string }

type HostedStreamFn = (
  input: Record<string, unknown>,
  options?: { signal?: AbortSignal },
) => Promise<AsyncIterable<unknown>>

function createStreamAbortError(message: string) {
  return new DOMException(message, "AbortError")
}

function isAbortLikeError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  )
}

const streamPortStartEnvelopeSchema = z.object({
  type: z.literal("start"),
  requestId: z.string().trim().min(1),
  payload: z.unknown(),
})

const streamTextPayloadSchema = z
  .object({
    providerId: z.string().trim().min(1),
  })
  .loose()

// Transport-level check for BOTH provider kinds, so only the enum comes from
// the contract; hosted-only constraints (name length, field count) are applied
// by the contract input schema right before the hosted call.
const structuredObjectFieldSchema = z.object({
  name: z.string().trim().min(1),
  type: HostedAiOutputFieldTypeSchema,
})

const structuredObjectPayloadSchema = z
  .object({
    providerId: z.string().trim().min(1),
    outputSchema: z.array(structuredObjectFieldSchema).min(1),
  })
  .loose()
  .superRefine((payload, ctx) => {
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
      } catch (error) {
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
      const requestMessage = rawMessage as
        | StreamPortRequestMessage<TSerializablePayload>
        | undefined
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
        } catch {
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
          throw streamError instanceof Error
            ? new Error(streamError.message, { cause: streamError })
            : new Error(typeof streamError === "string" ? streamError : "Unknown stream error")
        }

        if (!abortController.signal.aborted) {
          safePost({ type: "done", data: result })
        }
      } catch (error) {
        const finalError = streamError ?? error
        if (abortController.signal.aborted || isAbortLikeError(finalError)) {
          return
        }

        logger.error("[Background] Stream Function failed", finalError)
        safePost({ type: "error", error: { message: extractAISDKErrorMessage(finalError) } })
      } finally {
        cleanup()
        try {
          port.disconnect()
        } catch {
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
    output: output !== null && typeof output === "object" ? { ...output } : output,
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
    options?: { cause?: unknown; retryAfterMs?: number },
  ) {
    super(message, { cause: options?.cause })
    this.retryAfterMs = options?.retryAfterMs
  }

  readonly retryAfterMs?: number
}

function withRequestErrorMeta<T extends Error>(
  error: T,
  meta: {
    statusCode?: number
    isRetryable: boolean
    kind: "rate-limit" | "bad-request" | "access-denied"
  },
): T {
  // Keep enumerable top-level fields as well as the symbol metadata. This is
  // robust across isolated extension/test realms where Symbol identities may
  // differ, and RequestQueue reads both representations.
  Object.assign(error, meta)
  return attachRequestErrorMeta(error, meta)
}

function toAiStreamPart(part: unknown): AiStreamPart {
  if (!isRecord(part) || typeof part.type !== "string" || part.type.trim().length === 0) {
    throw new BackgroundStreamError("stream_protocol_error", aiStreamProtocolErrorMessage)
  }

  return part as AiStreamPart
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

  const candidate = error as { code?: unknown }
  return candidate.code === "TOO_MANY_REQUESTS"
}

function getOrpcErrorCode(error: unknown): string | undefined {
  return isRecord(error) && typeof error.code === "string" ? error.code : undefined
}

/**
 * The server builds this payload `satisfies HostedAiRateLimitErrorData`; the
 * same contract schema parses it back here, so the two ends cannot drift.
 */
function getHostedAiRateLimitData(error: unknown): HostedAiRateLimitErrorData | undefined {
  if (!isRecord(error)) {
    return undefined
  }

  const parsed = HostedAiRateLimitErrorDataSchema.safeParse(error.data)
  return parsed.success ? parsed.data : undefined
}

function getHostedAiRateLimitMessage(error: unknown): string {
  switch (getHostedAiRateLimitData(error)?.quotaScope) {
    case "guest":
      return i18n.t("hostedAi.errors.guestRateLimited")
    case "user":
      return i18n.t("hostedAi.errors.userRateLimited")
    default:
      return i18n.t("hostedAi.errors.rateLimited")
  }
}

// Pinned with `satisfies` so a code renamed in the contract fails this build
// instead of silently falling through to the generic error path.
const HOSTED_AI_TIER_RESTRICTED = "HOSTED_AI_TIER_RESTRICTED" satisfies PublicAppErrorCode
const HOSTED_AI_QUOTA_EXHAUSTED = "HOSTED_AI_QUOTA_EXHAUSTED" satisfies PublicAppErrorCode

function normalizeHostedAiError(error: unknown): unknown {
  switch (getOrpcErrorCode(error)) {
    case HOSTED_AI_TIER_RESTRICTED:
      return withRequestErrorMeta(
        new BackgroundStreamError(
          "HOSTED_AI_TIER_RESTRICTED",
          i18n.t("hostedAi.availability.ultraRequired"),
          { cause: error },
        ),
        { isRetryable: false, kind: "access-denied" },
      )
    case HOSTED_AI_QUOTA_EXHAUSTED:
      // Quota exhaustion may also use HTTP 429, but it is a billing-period hard limit:
      // never normalize it into the short-term pause-and-retry path. Kind
      // "access-denied" (never a statusCode) drains the queue backlog without
      // ever entering rate-limit classification.
      return withRequestErrorMeta(
        new BackgroundStreamError(
          "HOSTED_AI_QUOTA_EXHAUSTED",
          i18n.t("hostedAi.availability.quotaExhausted"),
          { cause: error },
        ),
        { isRetryable: false, kind: "access-denied" },
      )
    case "UNAUTHORIZED":
      return withRequestErrorMeta(
        new BackgroundStreamError(
          "UNAUTHORIZED",
          i18n.t("hostedAi.availability.authenticationRequired"),
          { cause: error },
        ),
        { isRetryable: false, kind: "access-denied" },
      )
    default:
      break
  }

  if (isOrpcRateLimitError(error)) {
    return withRequestErrorMeta(
      new BackgroundStreamError("rate_limited", getHostedAiRateLimitMessage(error), {
        cause: error,
        retryAfterMs: getHostedAiRateLimitData(error)?.retryAfterMs,
      }),
      { statusCode: 429, isRetryable: true, kind: "rate-limit" },
    )
  }

  return error
}

async function* normalizeHostedPartStreamErrors(stream: AsyncIterable<unknown>): AsyncGenerator {
  try {
    for await (const part of stream) {
      yield part
    }
  } catch (error) {
    throw normalizeHostedAiError(error)
  }
}

function getStreamFinishReason(part: Record<string, unknown>): string | undefined {
  return typeof part.finishReason === "string" ? part.finishReason : undefined
}

/**
 * Reasoning is over once the answer starts coming out, so the first output delta
 * closes the thinking phase. Models that emit no reasoning at all never send
 * `reasoning-end`, and without this they would stay "thinking" for the whole
 * stream while their output is already rendering. Models that interleave need no
 * special case: a later `reasoning-delta` reopens the phase on its own.
 */
function endThinkingOnOutput(thinking: ThinkingSnapshot): ThinkingSnapshot {
  return thinking.status === "thinking" ? { ...thinking, status: "complete" } : thinking
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
        thinking = endThinkingOnOutput(thinking)
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

async function consumeStructuredObjectPartStream<TOutput extends Record<string, unknown>>(
  partStream: AsyncIterable<unknown>,
  options: {
    objectSchema: z.ZodType<TOutput>
    onChunk?: StreamRuntimeOptions<BackgroundStructuredObjectStreamSnapshot>["onChunk"]
    signal?: AbortSignal
  },
): Promise<BackgroundStreamSnapshot<TOutput>> {
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
        thinking = endThinkingOnOutput(thinking)
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
  } catch (error) {
    throw new BackgroundStreamError("output_validation_failed", aiOutputValidationErrorMessage, {
      cause: error,
    })
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

/**
 * One oRPC procedure per hosted text feature: the server derives the billing
 * feature from the route path, so the payload's `hostedFeature` never rides
 * the wire — it only selects which procedure to call. Absent means page
 * translation, the sole caller before the field existed. Resolved lazily so
 * importing this module never touches the client proxy.
 */
const HOSTED_TEXT_STREAM_PROCEDURES: Record<HostedAiTextStreamRoute, () => HostedStreamFn> = {
  pageTranslation: () =>
    backgroundOrpcClient.hostedAi.translate.streamText as unknown as HostedStreamFn,
  selectionTranslation: () =>
    backgroundOrpcClient.hostedAi.selectionTranslation.streamText as unknown as HostedStreamFn,
  // Subtitle lines and the video summary share one route; both bill as
  // videoSubtitles. Segmentation is the same feature on a wider-budget route.
  videoSubtitles: () =>
    backgroundOrpcClient.hostedAi.videoSubtitles.streamText as unknown as HostedStreamFn,
  videoSubtitlesSegmentation: () =>
    backgroundOrpcClient.hostedAi.videoSubtitles.streamSegmentation as unknown as HostedStreamFn,
  inputTranslation: () =>
    backgroundOrpcClient.hostedAi.inputTranslation.streamText as unknown as HostedStreamFn,
  languageDetection: () =>
    backgroundOrpcClient.hostedAi.languageDetection.streamText as unknown as HostedStreamFn,
}

async function createHostedTextPartStream(
  serializablePayload: BackgroundStreamTextSerializablePayload,
  signal?: AbortSignal,
): Promise<AsyncIterable<unknown>> {
  const { prompt, instructions, temperature, modelTier, requestId, hostedFeature } =
    serializablePayload

  // The contract schema is the same one the server parses with, so a payload
  // it rejects fails here as invalid_request instead of a round trip to a 400.
  const input = HostedAiStreamTextInputSchema.safeParse({
    instructions,
    prompt,
    temperature,
    modelTier,
    requestId,
  })
  if (!input.success) {
    throw new BackgroundStreamError("invalid_request", "Invalid hosted AI request")
  }

  const procedure = HOSTED_TEXT_STREAM_PROCEDURES[hostedFeature ?? "pageTranslation"]()
  try {
    const stream = await procedure(input.data, { signal })
    return normalizeHostedPartStreamErrors(stream)
  } catch (error) {
    throw normalizeHostedAiError(error)
  }
}

/**
 * One text generation against either provider kind, collected into a string.
 *
 * Four callers are non-streaming `generateText` calls — the page summary, the
 * video summary, subtitle segmentation, and language detection — and the
 * hosted side has no non-streaming route, because quota reserve/settle, the
 * circuit breaker, and the ledger are stream-shaped end to end. Rather than
 * give each caller its own hosted branch, they all collapse onto this: the
 * hosted path reuses the same part stream and reader as page translation and
 * hands back the accumulated text.
 *
 * Lives here rather than beside its callers because it needs the
 * module-private `createHostedTextPartStream` (contract pre-validation, error
 * normalization, procedure lookup) and `consumeTextPartStream`.
 */
export async function generateTextForProviderRef(
  payload: BackgroundGenerateTextPayload,
  options: { signal?: AbortSignal } = {},
): Promise<string> {
  const { providerRef, hostedFeature, instructions, prompt, requestId, maxRetries } = payload
  const { signal } = options

  if (signal?.aborted) {
    throw new DOMException("stream aborted", "AbortError")
  }

  if (providerRef.kind === "system") {
    const partStream = await createHostedTextPartStream(
      {
        providerId: providerRef.providerId,
        modelTier: providerRef.modelTier,
        requestId,
        hostedFeature,
        instructions,
        prompt,
      },
      signal,
    )
    const snapshot = await consumeTextPartStream(partStream, { signal })
    return snapshot.output.trim()
  }

  // Local text generation needs a real LLM: pure translate providers (DeepLX,
  // Google, Microsoft) have no model to prompt. The payload type already says
  // LLM, but the wire is a trust boundary — a pre-update content script can
  // still send a translate-only ref — so re-widen and check for real.
  const localConfig = providerRef.config as TranslateProviderConfig
  if (!isLLMProviderConfig(localConfig)) {
    throw new BackgroundStreamError(
      "invalid_request",
      `Provider "${localConfig.id}" cannot generate text`,
    )
  }

  // Built from the config the ref carries, not looked up by id: every other
  // parameter below already comes from the ref, so re-reading storage would
  // pair a model from the current row with reasoning/temperature/providerOptions
  // computed from the snapshot the caller captured — and would fail outright
  // for a row deleted from another tab while the config was already in hand.
  const model = getLanguageModelForConfig(providerRef.config)
  const { text } = await generateText({
    model,
    instructions,
    prompt,
    // maxRetries: 0 — retries belong to the RequestQueue, which meters them
    // against the token bucket; ai-sdk's hidden default (2) would issue extra
    // HTTP attempts invisible to the rate limiter.
    maxRetries: maxRetries ?? 0,
    abortSignal: signal,
    ...buildLocalGenerateTextParams(providerRef.config),
  })
  return text.trim()
}

export async function runStreamTextInBackground(
  serializablePayload: BackgroundStreamTextSerializablePayload,
  options: StreamRuntimeOptions<BackgroundTextStreamSnapshot> = {},
): Promise<BackgroundTextStreamSnapshot> {
  const { signal, onChunk } = options

  if (signal?.aborted) {
    throw new DOMException("stream aborted", "AbortError")
  }

  const partStream = isBuiltInAiProviderId(serializablePayload.providerId)
    ? await createHostedTextPartStream(serializablePayload, signal)
    : await createLocalTextPartStream(serializablePayload, options)

  return consumeTextPartStream(partStream, {
    onChunk,
    signal,
  })
}

async function createLocalStructuredObjectPartStream<TOutput extends Record<string, unknown>>(
  serializablePayload: BackgroundStreamTextSerializablePayload & {
    outputSchema?: BackgroundStructuredObjectOutputField[]
  },
  objectSchema: z.ZodType<TOutput>,
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
  const { outputSchema, prompt, instructions, temperature, modelTier, requestId } =
    serializablePayload

  // Contract-schema parse converges the hosted-only constraints (field-name
  // length, field count) the transport check deliberately leaves loose for
  // BYOK, and fails locally instead of as a server 400.
  const input = HostedAiStreamStructuredObjectInputSchema.safeParse({
    instructions,
    prompt,
    outputSchema,
    temperature,
    modelTier,
    requestId,
  })
  if (!input.success) {
    throw new BackgroundStreamError("invalid_request", "Invalid hosted AI request")
  }

  try {
    const stream = await (
      backgroundOrpcClient.hostedAi.customAction.streamStructuredObject as unknown as HostedStreamFn
    )(input.data, { signal })
    return normalizeHostedPartStreamErrors(stream)
  } catch (error) {
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
  const partStream = isBuiltInAiProviderId(serializablePayload.providerId)
    ? await createHostedStructuredObjectPartStream(serializablePayload, signal)
    : await createLocalStructuredObjectPartStream(serializablePayload, objectSchema, options)

  return consumeStructuredObjectPartStream(partStream, {
    objectSchema,
    onChunk,
    signal,
  })
}

async function createHostedNoteSuggestionPartStream(
  serializablePayload: BackgroundStreamNoteSuggestionSerializablePayload,
  signal?: AbortSignal,
): Promise<AsyncIterable<unknown>> {
  const { prompt, instructions, temperature, modelTier, requestId } = serializablePayload

  const input = HostedAiNoteSuggestionStreamInputSchema.safeParse({
    instructions,
    prompt,
    temperature,
    modelTier,
    requestId,
  })
  if (!input.success) {
    throw new BackgroundStreamError("invalid_request", "Invalid hosted AI request")
  }

  try {
    const stream = await (
      backgroundOrpcClient.hostedAi.noteSuggestion
        .streamStructuredObject as unknown as HostedStreamFn
    )(input.data, { signal })
    return normalizeHostedPartStreamErrors(stream)
  } catch (error) {
    throw normalizeHostedAiError(error)
  }
}

export async function runNoteSuggestionStreamInBackground(
  serializablePayload: BackgroundStreamNoteSuggestionSerializablePayload,
  options: StreamRuntimeOptions<BackgroundNoteSuggestionStreamSnapshot> = {},
): Promise<BackgroundNoteSuggestionStreamSnapshot> {
  const { signal, onError } = options
  const { providerId, prompt, instructions } = serializablePayload

  if (signal?.aborted) {
    throw new DOMException("stream aborted", "AbortError")
  }

  if (!instructions || !prompt) {
    throw new BackgroundStreamError(
      "invalid_request",
      "Note suggestion requires instructions and prompt",
    )
  }

  // The card renders only the final result, so neither branch forwards onChunk.
  if (isBuiltInAiProviderId(providerId)) {
    // Hosted note suggestions stream the fixed contract object (the server
    // enforces it via Output.object). Its `action.createNewDictionaryAction`
    // and `action.targetActionId` fields belong to a richer server-driven flow
    // this client does not implement yet, so they are dropped in the envelope
    // adaptation below.
    const partStream = await createHostedNoteSuggestionPartStream(serializablePayload, signal)
    const hostedSnapshot = await consumeStructuredObjectPartStream(partStream, {
      objectSchema: HostedAiNoteSuggestionObjectSchema,
      signal,
    })
    const envelope = noteSuggestionEnvelopeSchema.safeParse({
      summaryFieldName: hostedSnapshot.output.action.summaryFieldName,
      notes: hostedSnapshot.output.notes,
    })
    if (!envelope.success) {
      throw new BackgroundStreamError("output_validation_failed", aiOutputValidationErrorMessage, {
        cause: envelope.error,
      })
    }
    return createStreamSnapshot(envelope.data, hostedSnapshot.thinking)
  }

  const partStream = await createLocalStructuredObjectPartStream(
    serializablePayload,
    noteSuggestionEnvelopeSchema,
    { signal, onError },
  )

  return consumeStructuredObjectPartStream(partStream, {
    objectSchema: noteSuggestionEnvelopeSchema,
    signal,
  })
}

const parseStreamTextStartMessage =
  createStartMessageParser<BackgroundStreamTextSerializablePayload>(streamTextPayloadSchema)
const parseStructuredObjectStartMessage =
  createStartMessageParser<BackgroundStreamStructuredObjectSerializablePayload>(
    structuredObjectPayloadSchema,
  )
const parseNoteSuggestionStartMessage =
  createStartMessageParser<BackgroundStreamNoteSuggestionSerializablePayload>(
    streamTextPayloadSchema,
  )

export const handleStreamTextPort = createStreamPortHandler<
  BackgroundStreamTextSerializablePayload,
  BackgroundTextStreamSnapshot
>(runStreamTextInBackground, parseStreamTextStartMessage)

export const handleStreamStructuredObjectPort = createStreamPortHandler<
  BackgroundStreamStructuredObjectSerializablePayload,
  BackgroundStructuredObjectStreamSnapshot
>(runStructuredObjectStreamInBackground, parseStructuredObjectStartMessage)

export const handleStreamNoteSuggestionPort = createStreamPortHandler<
  BackgroundStreamNoteSuggestionSerializablePayload,
  BackgroundNoteSuggestionStreamSnapshot
>(runNoteSuggestionStreamInBackground, parseNoteSuggestionStartMessage)

export const BACKGROUND_STREAM_PORT_HANDLERS: Readonly<
  Record<BackgroundStreamPortName, StreamPortHandler>
> = {
  [BACKGROUND_STREAM_PORTS.streamText]: handleStreamTextPort,
  [BACKGROUND_STREAM_PORTS.streamStructuredObject]: handleStreamStructuredObjectPort,
  [BACKGROUND_STREAM_PORTS.streamNoteSuggestion]: handleStreamNoteSuggestionPort,
}

export function dispatchBackgroundStreamPort(port: Browser.runtime.Port): boolean {
  const handler = BACKGROUND_STREAM_PORT_HANDLERS[port.name as BackgroundStreamPortName]
  if (!handler) {
    return false
  }

  handler(port)
  return true
}
