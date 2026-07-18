import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import { afterEach, describe, expect, it, vi } from "vitest"
import { parseBatchResult } from "@/entrypoints/background/translation-queues"
import { BATCH_SEPARATOR } from "@/utils/constants/prompt"
import { Sha256Hex } from "@/utils/hash"
import { executeTranslate } from "@/utils/host/translate/execute-translate"
import { BatchQueue } from "../batch-queue"
import { RequestQueue } from "../request-queue"

const mockPromptResolver = vi
  .fn<(...args: any[]) => any>()
  .mockResolvedValue({ systemPrompt: "", prompt: "" })

// Mock dependencies
vi.mock("@/utils/host/translate/execute-translate", () => ({
  executeTranslate: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/hash", () => ({
  Sha256Hex: vi.fn<(...args: any[]) => any>((...args: string[]) => `hash-${args.join("-")}`),
}))

const mockExecuteTranslate = vi.mocked(executeTranslate)

// Helper: mock successful translation
function mockTranslateSuccess(results: string[]) {
  mockExecuteTranslate.mockImplementation((text: string) => {
    const batchSeparator = `\n\n${BATCH_SEPARATOR}\n\n`
    if (text.includes(batchSeparator)) {
      return Promise.resolve(results.join(batchSeparator))
    }
    return Promise.resolve(results[0] || "translated")
  })
}

// Helper: mock translation failure
function mockTranslateError(error: Error) {
  mockExecuteTranslate.mockImplementation(() => Promise.reject(error))
}

// Test configurations
const sampleLangConfig: Config["language"] = {
  sourceCode: "eng",
  targetCode: "cmn",
  level: "beginner",
}

const sampleProviderConfig: ProviderConfig = {
  id: "test-provider",
  name: "Test Provider",
  provider: "openai",
  enabled: true,
  apiKey: "test-key",
  model: { model: "gpt-4o-mini", isCustomModel: false, customModel: null },
}

interface TranslateBatchData {
  text: string
  langConfig: Config["language"]
  providerConfig: ProviderConfig
  hash: string
}

const baseBatchConfig = {
  maxCharactersPerBatch: 100,
  maxItemsPerBatch: 3,
  batchDelay: 1000,
}

const baseRequestQueueConfig = {
  rate: 2,
  capacity: 2,
  timeoutMs: 10_000,
  maxRetries: 0,
  baseRetryDelayMs: 100,
}

function createBatchQueue(
  requestQueue: RequestQueue,
  config = baseBatchConfig,
  options?: {
    maxRetries?: number
    enableFallbackToIndividual?: boolean
    getDedupKey?: (data: TranslateBatchData) => string | undefined
    executeIndividual?: (data: TranslateBatchData) => Promise<string>
    onError?: (
      error: Error,
      context: { batchKey: string; retryCount: number; isFallback: boolean },
    ) => void
  },
) {
  return new BatchQueue<TranslateBatchData, string>({
    ...config,
    maxRetries: options?.maxRetries,
    enableFallbackToIndividual: options?.enableFallbackToIndividual,
    getDedupKey: options?.getDedupKey,
    getBatchKey: (data) => {
      return `${data.langConfig.sourceCode}-${data.langConfig.targetCode}-${data.providerConfig.id}`
    },
    getCharacters: (data) => {
      return data.text.length
    },
    executeBatch: async (dataList) => {
      const { langConfig, providerConfig } = dataList[0]
      const texts = dataList.map((d) => d.text)
      const batchText = texts.join(`\n\n${BATCH_SEPARATOR}\n\n`)
      const hash = Sha256Hex(...dataList.map((d) => d.hash))

      const batchThunk = async (): Promise<string[]> => {
        const result = await executeTranslate(
          batchText,
          langConfig,
          providerConfig,
          mockPromptResolver,
          { isBatch: true },
        )
        return parseBatchResult(result)
      }

      return requestQueue.enqueue(batchThunk, Date.now(), hash)
    },
    executeIndividual: options?.executeIndividual,
    onError: options?.onError,
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe("batchQueue – core functionality", () => {
  it("processes single task successfully", async () => {
    vi.useFakeTimers()
    mockTranslateSuccess(["result"])

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue)

    const promise = batchQueue.enqueue({
      text: "Hello",
      langConfig: sampleLangConfig,
      providerConfig: sampleProviderConfig,
      hash: "hash1",
    })

    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    await expect(promise).resolves.toBe("result")
  })
})

describe("batchQueue – batching logic", () => {
  it("batches multiple tasks with same config", async () => {
    vi.useFakeTimers()
    mockTranslateSuccess(["result1", "result2", "result3"])

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue)

    const promises = [
      batchQueue.enqueue({
        text: "Text 1",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash1",
      }),
      batchQueue.enqueue({
        text: "Text 2",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash2",
      }),
      batchQueue.enqueue({
        text: "Text 3",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash3",
      }),
    ]

    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    const results = await Promise.all(promises)
    expect(results).toEqual(["result1", "result2", "result3"])
  })

  it("flushes batch when size limit reached", async () => {
    vi.useFakeTimers()
    mockTranslateSuccess(["result1", "result2"])

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, {
      ...baseBatchConfig,
      maxItemsPerBatch: 2, // Flush when 2 tasks batched
    })

    const promises = [
      batchQueue.enqueue({
        text: "A",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash1",
      }),
      batchQueue.enqueue({
        text: "B",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash2",
      }), // Should trigger flush
    ]

    vi.advanceTimersByTime(0) // No delay needed

    const results = await Promise.all(promises)
    expect(results).toEqual(["result1", "result2"])
  })

  it("flushes batch when character limit reached", async () => {
    vi.useFakeTimers()

    // Setup separate mock calls for separate batches
    let callCount = 0
    mockExecuteTranslate.mockImplementation(() => {
      callCount++
      return Promise.resolve(callCount === 1 ? "first-batch" : "second-batch")
    })

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, {
      ...baseBatchConfig,
      maxCharactersPerBatch: 10,
    })

    const promise1 = batchQueue.enqueue({
      text: "Hi",
      langConfig: sampleLangConfig,
      providerConfig: sampleProviderConfig,
      hash: "hash1",
    })
    const promise2 = batchQueue.enqueue({
      text: "Very long text exceeding limit",
      langConfig: sampleLangConfig,
      providerConfig: sampleProviderConfig,
      hash: "hash2",
    })

    vi.advanceTimersByTime(0)

    const [result1, result2] = await Promise.all([promise1, promise2])
    expect(result1).toBe("first-batch")
    expect(result2).toBe("second-batch")
  })

  it("separates batches by different configs", async () => {
    vi.useFakeTimers()

    // Setup separate mock calls for different configs
    let callCount = 0
    mockExecuteTranslate.mockImplementation(() => {
      callCount++
      return Promise.resolve(callCount === 1 ? "english-result" : "chinese-result")
    })

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue)

    const config1 = { ...sampleLangConfig, targetCode: "eng" as const }
    const config2 = { ...sampleLangConfig, targetCode: "cmn" as const }

    const promises = [
      batchQueue.enqueue({
        text: "Text 1",
        langConfig: config1,
        providerConfig: sampleProviderConfig,
        hash: "hash1",
      }),
      batchQueue.enqueue({
        text: "Text 2",
        langConfig: config2,
        providerConfig: sampleProviderConfig,
        hash: "hash2",
      }),
    ]

    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    const results = await Promise.all(promises)
    expect(results).toEqual(["english-result", "chinese-result"])
  })
})

describe("batchQueue – timing control", () => {
  it("flushes batch after delay timeout", async () => {
    vi.useFakeTimers()
    mockTranslateSuccess(["delayed"])

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, {
      ...baseBatchConfig,
      batchDelay: 500,
    })

    const promise = batchQueue.enqueue({
      text: "Test",
      langConfig: sampleLangConfig,
      providerConfig: sampleProviderConfig,
      hash: "hash1",
    })

    // Before timeout
    vi.advanceTimersByTime(400)
    // Promise should not be resolved yet

    // After timeout
    vi.advanceTimersByTime(200)
    vi.advanceTimersByTime(0)

    await expect(promise).resolves.toBe("delayed")
  })
})

describe("batchQueue – error handling", () => {
  it("propagates translation errors to all tasks (no retry)", async () => {
    vi.useFakeTimers()
    const error = new Error("Translation failed")
    mockTranslateError(error)

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, baseBatchConfig, {
      maxRetries: 0,
      enableFallbackToIndividual: false,
    })

    const promises = [
      batchQueue.enqueue({
        text: "Text 1",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash1",
      }),
      batchQueue.enqueue({
        text: "Text 2",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash2",
      }),
    ]

    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    await expect(Promise.all(promises)).rejects.toThrow("Translation failed")
  })

  it("handles translation count mismatch (no retry)", async () => {
    vi.useFakeTimers()
    mockExecuteTranslate.mockImplementation(() => Promise.resolve("single-result"))

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, baseBatchConfig, {
      maxRetries: 0,
      enableFallbackToIndividual: false,
    })

    const promises = [
      batchQueue.enqueue({
        text: "Text 1",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash1",
      }),
      batchQueue.enqueue({
        text: "Text 2",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash2",
      }),
    ]

    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    await expect(Promise.all(promises)).rejects.toThrow("Batch result count mismatch")
  })

  it("retries BatchCountMismatchError with exponential backoff", async () => {
    vi.useFakeTimers()
    let attemptCount = 0
    mockExecuteTranslate.mockImplementation(() => {
      attemptCount++
      const batchSeparator = `\n\n${BATCH_SEPARATOR}\n\n`
      if (attemptCount <= 2) {
        // Return wrong count (1 result instead of 2)
        return Promise.resolve("single-result")
      }
      // Return correct count on 3rd attempt
      return Promise.resolve(["result1", "result2"].join(batchSeparator))
    })

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, baseBatchConfig, {
      maxRetries: 3,
      enableFallbackToIndividual: false,
    })

    const promises = [
      batchQueue.enqueue({
        text: "Text 1",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash1",
      }),
      batchQueue.enqueue({
        text: "Text 2",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash2",
      }),
    ]

    // Initial execution
    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    // First retry (1s backoff)
    await vi.advanceTimersByTimeAsync(1000)
    // Second retry (2s backoff)
    await vi.advanceTimersByTimeAsync(2000)

    const results = await Promise.all(promises)
    expect(results).toEqual(["result1", "result2"])
    expect(attemptCount).toBe(3) // Initial + 2 retries
  })

  it("does not retry regular request errors", async () => {
    vi.useFakeTimers()
    let attemptCount = 0
    mockExecuteTranslate.mockImplementation(() => {
      attemptCount++
      return Promise.reject(new Error("Network error"))
    })

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, baseBatchConfig, {
      maxRetries: 3,
      enableFallbackToIndividual: false,
    })

    const promise = batchQueue.enqueue({
      text: "Test",
      langConfig: sampleLangConfig,
      providerConfig: sampleProviderConfig,
      hash: "hash1",
    })

    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    await expect(promise).rejects.toThrow("Network error")
    expect(attemptCount).toBe(1) // No retry for regular errors
  })

  it("falls back to individual requests after BatchCountMismatchError retries exhausted", async () => {
    vi.useFakeTimers()
    let batchAttemptCount = 0
    mockExecuteTranslate.mockImplementation((text: string) => {
      const batchSeparator = `\n\n${BATCH_SEPARATOR}\n\n`
      if (text.includes(batchSeparator)) {
        batchAttemptCount++
        // Always return wrong count for batch
        return Promise.resolve("single-result")
      }
      // Individual requests succeed
      return Promise.resolve(`individual-${text}`)
    })

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, baseBatchConfig, {
      maxRetries: 2,
      enableFallbackToIndividual: true,
      executeIndividual: async (data) => {
        const result = await executeTranslate(
          data.text,
          data.langConfig,
          data.providerConfig,
          mockPromptResolver,
        )
        return result
      },
    })

    const promises = [
      batchQueue.enqueue({
        text: "Text1",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash1",
      }),
      batchQueue.enqueue({
        text: "Text2",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash2",
      }),
    ]

    // Initial execution
    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    // First retry (1s backoff)
    await vi.advanceTimersByTimeAsync(1000)
    // Second retry (2s backoff)
    await vi.advanceTimersByTimeAsync(2000)
    // Wait for fallback individual requests
    await vi.advanceTimersByTimeAsync(0)

    const results = await Promise.all(promises)
    expect(results).toEqual(["individual-Text1", "individual-Text2"])
    expect(batchAttemptCount).toBe(3) // Initial + 2 retries before fallback
  })

  it("does not fall back to individual requests on request errors", async () => {
    vi.useFakeTimers()
    let batchAttemptCount = 0
    const executeIndividual = vi.fn<(...args: any[]) => any>(async (data: TranslateBatchData) => {
      const result = await executeTranslate(
        data.text,
        data.langConfig,
        data.providerConfig,
        mockPromptResolver,
      )
      return result
    })

    mockExecuteTranslate.mockImplementation((text: string) => {
      const batchSeparator = `\n\n${BATCH_SEPARATOR}\n\n`
      if (text.includes(batchSeparator)) {
        batchAttemptCount++
        return Promise.reject(new Error("API error"))
      }
      return Promise.resolve(`individual-${text}`)
    })

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, baseBatchConfig, {
      maxRetries: 3,
      enableFallbackToIndividual: true,
      executeIndividual,
    })

    const promises = [
      batchQueue.enqueue({
        text: "Text1",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash1",
      }),
      batchQueue.enqueue({
        text: "Text2",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash2",
      }),
    ]

    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    await expect(Promise.all(promises)).rejects.toThrow("API error")
    expect(batchAttemptCount).toBe(1) // Only 1 attempt, no retry for request errors
    expect(executeIndividual).not.toHaveBeenCalled()
  })

  it("retries the same batch through a rate-limit pause instead of falling back", async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, "random").mockReturnValue(0) // deterministic pause (no jitter)
    let batchAttemptCount = 0
    const executeIndividual = vi.fn<(...args: any[]) => any>(async (data: TranslateBatchData) => {
      const result = await executeTranslate(
        data.text,
        data.langConfig,
        data.providerConfig,
        mockPromptResolver,
      )
      return result
    })
    const rateLimitedError = Object.assign(new Error("Too Many Requests"), {
      statusCode: 429,
      responseHeaders: {
        "retry-after": "2",
      },
    })

    const batchSeparator = `\n\n${BATCH_SEPARATOR}\n\n`
    mockExecuteTranslate.mockImplementation((text: string) => {
      if (text.includes(batchSeparator)) {
        batchAttemptCount++
        if (batchAttemptCount === 1) {
          return Promise.reject(rateLimitedError)
        }
        return Promise.resolve(
          text
            .split(batchSeparator)
            .map((t) => `batch-${t}`)
            .join(batchSeparator),
        )
      }
      return Promise.resolve(`individual-${text}`)
    })

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, baseBatchConfig, {
      maxRetries: 3,
      enableFallbackToIndividual: true,
      executeIndividual,
    })

    const promises = [
      batchQueue.enqueue({
        text: "Text1",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash1",
      }),
      batchQueue.enqueue({
        text: "Text2",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash2",
      }),
    ]

    await vi.advanceTimersByTimeAsync(baseBatchConfig.batchDelay)
    expect(batchAttemptCount).toBe(1)

    // The 429 pauses the queue (base 5s > Retry-After 2s) and re-enqueues the
    // SAME batch task; after the pause it succeeds — no individual fallback,
    // no mass rejection.
    await vi.advanceTimersByTimeAsync(5_100)

    await expect(Promise.all(promises)).resolves.toEqual(["batch-Text1", "batch-Text2"])
    expect(batchAttemptCount).toBe(2)
    expect(executeIndividual).not.toHaveBeenCalled()
    vi.mocked(Math.random).mockRestore()
  })

  it("calls onError for each retry attempt on BatchCountMismatchError", async () => {
    vi.useFakeTimers()
    // Always return wrong count to trigger retries
    mockExecuteTranslate.mockImplementation(() => Promise.resolve("single-result"))

    const onError = vi.fn<(...args: any[]) => any>()
    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, baseBatchConfig, {
      maxRetries: 2,
      enableFallbackToIndividual: false,
      onError,
    })

    const promises = [
      batchQueue.enqueue({
        text: "Text 1",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash1",
      }),
      batchQueue.enqueue({
        text: "Text 2",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash2",
      }),
    ].map((p) => p.catch((err) => err))

    // Initial execution
    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    // First retry
    await vi.advanceTimersByTimeAsync(1000)
    // Second retry
    await vi.advanceTimersByTimeAsync(2000)

    await Promise.all(promises)
    expect(onError).toHaveBeenCalledTimes(3) // Initial + 2 retries
    expect(onError).toHaveBeenNthCalledWith(
      1,
      expect.any(Error),
      expect.objectContaining({ retryCount: 0 }),
    )
    expect(onError).toHaveBeenNthCalledWith(
      2,
      expect.any(Error),
      expect.objectContaining({ retryCount: 1 }),
    )
    expect(onError).toHaveBeenNthCalledWith(
      3,
      expect.any(Error),
      expect.objectContaining({ retryCount: 2 }),
    )
  })

  it("calls onError once on request error (no retry)", async () => {
    vi.useFakeTimers()
    const error = new Error("Request failed")
    mockTranslateError(error)

    const onError = vi.fn<(...args: any[]) => any>()
    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, baseBatchConfig, {
      maxRetries: 3,
      enableFallbackToIndividual: false,
      onError,
    })

    const promise = batchQueue
      .enqueue({
        text: "Test",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash1",
      })
      .catch((err) => err)

    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    await promise
    expect(onError).toHaveBeenCalledTimes(1) // Only once, no retry
    expect(onError).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ retryCount: 0, isFallback: false }),
    )
  })
})

describe("batchQueue – in-flight coalescing", () => {
  const dedupOptions = {
    getDedupKey: (data: TranslateBatchData) => data.hash,
  }

  it("coalesces concurrent enqueues with the same dedup key into one request", async () => {
    vi.useFakeTimers()
    mockTranslateSuccess(["result"])

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, baseBatchConfig, dedupOptions)

    const first = batchQueue.enqueue({
      text: "Hello",
      langConfig: sampleLangConfig,
      providerConfig: sampleProviderConfig,
      hash: "same-hash",
    })
    const second = batchQueue.enqueue({
      text: "Hello",
      langConfig: sampleLangConfig,
      providerConfig: sampleProviderConfig,
      hash: "same-hash",
    })

    expect(second).toBe(first)

    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    await expect(Promise.all([first, second])).resolves.toEqual(["result", "result"])
    expect(mockExecuteTranslate).toHaveBeenCalledTimes(1)
    // the coalesced item appears once in the batch payload, not twice
    expect(mockExecuteTranslate.mock.calls[0][0]).toBe("Hello")
  })

  it("does not coalesce enqueues with different dedup keys", async () => {
    vi.useFakeTimers()
    mockTranslateSuccess(["result1", "result2"])

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, baseBatchConfig, dedupOptions)

    const first = batchQueue.enqueue({
      text: "Hello",
      langConfig: sampleLangConfig,
      providerConfig: sampleProviderConfig,
      hash: "hash-one",
    })
    const second = batchQueue.enqueue({
      text: "Hello",
      langConfig: sampleLangConfig,
      providerConfig: sampleProviderConfig,
      hash: "hash-two",
    })

    expect(second).not.toBe(first)

    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    await expect(Promise.all([first, second])).resolves.toEqual(["result1", "result2"])
    // both items are translated as distinct entries of a single batch
    expect(mockExecuteTranslate).toHaveBeenCalledTimes(1)
    expect(mockExecuteTranslate.mock.calls[0][0]).toBe(`Hello\n\n${BATCH_SEPARATOR}\n\nHello`)
  })

  it("issues a fresh request for the same key after the in-flight one resolves", async () => {
    vi.useFakeTimers()
    let callCount = 0
    mockExecuteTranslate.mockImplementation(() => {
      callCount++
      return Promise.resolve(`result-${callCount}`)
    })

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, baseBatchConfig, dedupOptions)

    const data = {
      text: "Hello",
      langConfig: sampleLangConfig,
      providerConfig: sampleProviderConfig,
      hash: "same-hash",
    }

    const first = batchQueue.enqueue(data)
    await vi.advanceTimersByTimeAsync(baseBatchConfig.batchDelay)
    await expect(first).resolves.toBe("result-1")

    const second = batchQueue.enqueue(data)
    await vi.advanceTimersByTimeAsync(baseBatchConfig.batchDelay)
    await expect(second).resolves.toBe("result-2")

    expect(mockExecuteTranslate).toHaveBeenCalledTimes(2)
  })

  it("shares the failure across coalesced enqueues and releases the key", async () => {
    vi.useFakeTimers()
    const error = new Error("Translation failed")
    mockTranslateError(error)

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, baseBatchConfig, {
      ...dedupOptions,
      maxRetries: 0,
      enableFallbackToIndividual: false,
    })

    const data = {
      text: "Hello",
      langConfig: sampleLangConfig,
      providerConfig: sampleProviderConfig,
      hash: "same-hash",
    }

    const first = batchQueue.enqueue(data)
    const second = batchQueue.enqueue(data)

    await vi.advanceTimersByTimeAsync(baseBatchConfig.batchDelay)

    await expect(first).rejects.toBe(error)
    await expect(second).rejects.toBe(error)
    expect(mockExecuteTranslate).toHaveBeenCalledTimes(1)

    // the failed key is released, so a later enqueue retries
    mockTranslateSuccess(["recovered"])
    const third = batchQueue.enqueue(data)
    await vi.advanceTimersByTimeAsync(baseBatchConfig.batchDelay)

    await expect(third).resolves.toBe("recovered")
    expect(mockExecuteTranslate).toHaveBeenCalledTimes(2)
  })
})

describe("batchQueue – configuration", () => {
  it("updates batch size configuration", async () => {
    vi.useFakeTimers()
    mockTranslateSuccess(["result1", "result2"])

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, {
      ...baseBatchConfig,
      maxItemsPerBatch: 10,
    })

    batchQueue.setBatchConfig({ maxItemsPerBatch: 2 })

    const promises = [
      batchQueue.enqueue({
        text: "Text 1",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash1",
      }),
      batchQueue.enqueue({
        text: "Text 2",
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: "hash2",
      }),
    ]

    vi.advanceTimersByTime(0) // Should flush immediately

    const results = await Promise.all(promises)
    expect(results).toEqual(["result1", "result2"])
  })

  it("throws error for invalid configuration", () => {
    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue)

    expect(() => batchQueue.setBatchConfig({ maxCharactersPerBatch: 0 })).toThrow(/Too small/)
    expect(() => batchQueue.setBatchConfig({ maxItemsPerBatch: 0 })).toThrow(/Too small/)
    expect(() => batchQueue.setBatchConfig({ maxCharactersPerBatch: -1 })).toThrow(/Too small/)
    expect(() => batchQueue.setBatchConfig({ maxItemsPerBatch: -1 })).toThrow(/Too small/)
  })
})

describe("batchQueue – dispatch gate", () => {
  interface GateItem {
    text: string
    hash: string
    scope?: string
  }

  function createGatedQueue(
    etaRef: { value: number },
    executeBatch: (dataList: GateItem[]) => Promise<string[]>,
  ) {
    return new BatchQueue<GateItem, string>({
      maxCharactersPerBatch: 1000,
      maxItemsPerBatch: 5,
      batchDelay: 100,
      dispatchGate: { nextDispatchEtaMs: () => etaRef.value },
      getBatchKey: () => "gated",
      getCharacters: (d) => d.text.length,
      getScope: (d) => d.scope,
      executeBatch,
    })
  }

  it("flushes at batchDelay when the gate reports a free slot", async () => {
    vi.useFakeTimers()
    const executeBatch = vi.fn<(dataList: GateItem[]) => Promise<string[]>>(async (dataList) =>
      dataList.map((d) => d.text),
    )
    const q = createGatedQueue({ value: 0 }, executeBatch)

    const p1 = q.enqueue({ text: "a", hash: "a" })
    const p2 = q.enqueue({ text: "b", hash: "b" })

    await vi.advanceTimersByTimeAsync(100)

    expect(executeBatch).toHaveBeenCalledTimes(1)
    expect(executeBatch.mock.calls[0][0]).toHaveLength(2)
    await expect(Promise.all([p1, p2])).resolves.toEqual(["a", "b"])
  })

  it("holds an under-filled batch while the gate is blocked, but still flushes on size-full", async () => {
    vi.useFakeTimers()
    const executeBatch = vi.fn<(dataList: GateItem[]) => Promise<string[]>>(async (dataList) =>
      dataList.map((d) => d.text),
    )
    const q = createGatedQueue({ value: 5_000 }, executeBatch)

    // Items trickle in far slower than batchDelay — under the old behavior
    // each 100ms window would flush a tiny batch.
    const promises: Promise<string>[] = []
    for (let i = 0; i < 4; i++) {
      promises.push(q.enqueue({ text: `t${i}`, hash: `t${i}` }))
      await vi.advanceTimersByTimeAsync(300)
    }
    expect(executeBatch).not.toHaveBeenCalled()

    // The 5th item hits maxItemsPerBatch: size-full flushes immediately even
    // while the gate is blocked (composition is already maximal).
    promises.push(q.enqueue({ text: "t4", hash: "t4" }))
    await vi.advanceTimersByTimeAsync(0)

    expect(executeBatch).toHaveBeenCalledTimes(1)
    expect(executeBatch.mock.calls[0][0]).toHaveLength(5)
    await expect(Promise.all(promises)).resolves.toEqual(["t0", "t1", "t2", "t3", "t4"])
  })

  it("flushes a trailing partial batch once the gate opens", async () => {
    vi.useFakeTimers()
    const etaRef = { value: 5_000 }
    const executeBatch = vi.fn<(dataList: GateItem[]) => Promise<string[]>>(async (dataList) =>
      dataList.map((d) => d.text),
    )
    const q = createGatedQueue(etaRef, executeBatch)

    const p1 = q.enqueue({ text: "a", hash: "a" })
    const p2 = q.enqueue({ text: "b", hash: "b" })

    await vi.advanceTimersByTimeAsync(3_000)
    expect(executeBatch).not.toHaveBeenCalled()

    // A dispatch slot frees downstream: the next gate poll flushes the batch.
    etaRef.value = 0
    await vi.advanceTimersByTimeAsync(1_100)

    expect(executeBatch).toHaveBeenCalledTimes(1)
    expect(executeBatch.mock.calls[0][0]).toHaveLength(2)
    await expect(Promise.all([p1, p2])).resolves.toEqual(["a", "b"])
  })

  it("force-flushes after MAX_BATCH_HOLD_MS even if the gate never opens", async () => {
    vi.useFakeTimers()
    const executeBatch = vi.fn<(dataList: GateItem[]) => Promise<string[]>>(async (dataList) =>
      dataList.map((d) => d.text),
    )
    const q = createGatedQueue({ value: 999_999 }, executeBatch)

    const p = q.enqueue({ text: "a", hash: "a" })

    await vi.advanceTimersByTimeAsync(59_000)
    expect(executeBatch).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(2_100)
    expect(executeBatch).toHaveBeenCalledTimes(1)
    await expect(p).resolves.toBe("a")
  })

  it("lets cancellation prune a held batch before it ever flushes", async () => {
    vi.useFakeTimers()
    const executeBatch = vi.fn<(dataList: GateItem[]) => Promise<string[]>>(async (dataList) =>
      dataList.map((d) => d.text),
    )
    const q = createGatedQueue({ value: 5_000 }, executeBatch)

    const p1 = q.enqueue({ text: "a", hash: "a", scope: "tab" })
    const p2 = q.enqueue({ text: "b", hash: "b", scope: "tab" })
    p1.catch(() => {})
    p2.catch(() => {})

    await vi.advanceTimersByTimeAsync(1_000)
    expect(q.cancelByScope("tab")).toBe(2)

    await vi.advanceTimersByTimeAsync(120_000)
    expect(executeBatch).not.toHaveBeenCalled()
    await expect(p1).rejects.toMatchObject({ name: "TranslationCancelledError" })
    await expect(p2).rejects.toMatchObject({ name: "TranslationCancelledError" })
  })
})
