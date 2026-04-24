import type { Browser } from "#imports"
import type {
  BackgroundStreamPortName,
  BackgroundStreamSnapshot,
  BackgroundStreamStructuredObjectSerializablePayload,
  BackgroundStreamTextSerializablePayload,
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
import { logger } from "@/utils/logger"
import { getModelById } from "@/utils/providers/model"

const invalidStreamStartPayloadMessage = "Invalid stream start payload"

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

export async function runStreamTextInBackground(
  serializablePayload: BackgroundStreamTextSerializablePayload,
  options: StreamRuntimeOptions<BackgroundTextStreamSnapshot> = {},
): Promise<BackgroundTextStreamSnapshot> {
  const { providerId, ...streamTextParams } = serializablePayload
  const { signal, onChunk, onError } = options

  if (signal?.aborted) {
    throw new DOMException("stream aborted", "AbortError")
  }

  const model = await getModelById(providerId)
  let cumulativeText = ""
  let thinking: ThinkingSnapshot = {
    status: "thinking",
    text: "",
  }

  const result = streamText({
    ...(streamTextParams as Parameters<typeof streamText>[0]),
    model,
    abortSignal: signal,
    onError: ({ error }) => {
      onError?.(error)
    },
  })

  for await (const part of result.fullStream) {
    if (signal?.aborted) {
      throw new DOMException("stream aborted", "AbortError")
    }

    switch (part.type) {
      case "text-delta": {
        cumulativeText += part.text
        onChunk?.(createStreamSnapshot(cumulativeText, thinking))
        break
      }
      case "reasoning-delta": {
        thinking = {
          status: "thinking",
          text: thinking.text + part.text,
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
      case "error": {
        throw part.error
      }
    }
  }

  thinking = {
    ...thinking,
    status: "complete",
  }

  return createStreamSnapshot(cumulativeText, thinking)
}

export async function runStructuredObjectStreamInBackground(
  serializablePayload: BackgroundStreamStructuredObjectSerializablePayload,
  options: StreamRuntimeOptions<BackgroundStructuredObjectStreamSnapshot> = {},
): Promise<BackgroundStructuredObjectStreamSnapshot> {
  const { providerId, outputSchema, ...streamParams } = serializablePayload
  const { signal, onChunk, onError } = options

  if (signal?.aborted) {
    throw new DOMException("stream aborted", "AbortError")
  }

  const model = await getModelById(providerId)
  let cumulativeValue: Record<string, unknown> = {}
  let thinking: ThinkingSnapshot = {
    status: "thinking",
    text: "",
  }

  const fieldTypeToZodSchema: Record<string, z.ZodTypeAny> = {
    string: z.string().nullable(),
    number: z.number().nullable(),
  }

  const schemaShape: Record<string, z.ZodTypeAny> = {}
  for (const field of outputSchema) {
    schemaShape[field.name] = fieldTypeToZodSchema[field.type] ?? z.string().nullable()
  }
  const objectSchema = z.object(schemaShape).strict()

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
  let cumulativeText = ""

  for await (const part of result.fullStream) {
    if (signal?.aborted) {
      throw new DOMException("stream aborted", "AbortError")
    }

    switch (part.type) {
      case "text-delta": {
        cumulativeText += part.text
        const partial = await parsePartialJson(cumulativeText)
        if (isRecord(partial.value)) {
          cumulativeValue = { ...cumulativeValue, ...partial.value }
          onChunk?.(createStreamSnapshot(cumulativeValue, thinking))
        }
        break
      }
      case "reasoning-delta": {
        thinking = {
          status: "thinking",
          text: thinking.text + part.text,
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
      case "error": {
        throw part.error
      }
    }
  }

  const finalJson = await parsePartialJson(cumulativeText)
  const finalValue = objectSchema.parse(finalJson.value)

  thinking = {
    ...thinking,
    status: "complete",
  }

  return createStreamSnapshot(finalValue, thinking)
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
