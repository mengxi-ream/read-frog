import type { Config } from '@/types/config/config'
import type { ProviderConfig } from '@/types/config/provider'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { parseBatchResult } from '@/entrypoints/background/translation-queues'
import { BATCH_SEPARATOR } from '@/utils/constants/prompt'
import { Sha256Hex } from '@/utils/hash'
import { executeTranslate } from '@/utils/host/translate/translate-text'
import { BatchQueue } from '../batch-queue'
import { RequestQueue } from '../request-queue'

// Mock dependencies
vi.mock('@/utils/host/translate/translate-text', () => ({
  executeTranslate: vi.fn(),
}))

vi.mock('@/utils/hash', () => ({
  Sha256Hex: vi.fn((...args: string[]) => `hash-${args.join('-')}`),
}))

const mockExecuteTranslate = vi.mocked(executeTranslate)

// Helper: mock successful translation
function mockTranslateSuccess(results: string[]) {
  mockExecuteTranslate.mockImplementation((text: string) => {
    const batchSeparator = `\n${BATCH_SEPARATOR}\n`
    if (text.includes(batchSeparator)) {
      return Promise.resolve(results.join(batchSeparator))
    }
    return Promise.resolve(results[0] || 'translated')
  })
}

// Helper: mock translation failure
function mockTranslateError(error: Error) {
  mockExecuteTranslate.mockImplementation(() => Promise.reject(error))
}

// Test configurations
const sampleLangConfig: Config['language'] = {
  sourceCode: 'eng',
  targetCode: 'cmn',
  detectedCode: 'eng',
  level: 'beginner',
}

const sampleProviderConfig: ProviderConfig = {
  id: 'test-provider',
  name: 'Test Provider',
  provider: 'openai',
  enabled: true,
  apiKey: 'test-key',
  models: {
    read: { model: 'gpt-4o-mini', isCustomModel: false, customModel: null },
    translate: { model: 'gpt-4o-mini', isCustomModel: false, customModel: null },
  },
}

interface TranslateBatchData {
  text: string
  langConfig: Config['language']
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
    executeIndividual?: (data: TranslateBatchData) => Promise<string>
    onError?: (error: Error, context: { batchKey: string, retryCount: number, isFallback: boolean }) => void
  },
) {
  return new BatchQueue<TranslateBatchData, string>({
    ...config,
    maxRetries: options?.maxRetries,
    enableFallbackToIndividual: options?.enableFallbackToIndividual,
    getBatchKey: (data) => {
      return `${data.langConfig.sourceCode}-${data.langConfig.targetCode}-${data.providerConfig.id}`
    },
    getCharacters: (data) => {
      return data.text.length
    },
    executeBatch: async (dataList) => {
      const { langConfig, providerConfig } = dataList[0]
      const texts = dataList.map(d => d.text)
      const batchText = texts.join(`\n${BATCH_SEPARATOR}\n`)
      const hash = Sha256Hex(...dataList.map(d => d.hash))

      const batchThunk = async (): Promise<string[]> => {
        const result = await executeTranslate(batchText, langConfig, providerConfig, { isBatch: true })
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

describe('batchQueue – core functionality', () => {
  it('processes single task successfully', async () => {
    vi.useFakeTimers()
    mockTranslateSuccess(['result'])

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue)

    const promise = batchQueue.enqueue({
      text: 'Hello',
      langConfig: sampleLangConfig,
      providerConfig: sampleProviderConfig,
      hash: 'hash1',
    })

    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    await expect(promise).resolves.toBe('result')
  })
})

describe('batchQueue – batching logic', () => {
  it('batches multiple tasks with same config', async () => {
    vi.useFakeTimers()
    mockTranslateSuccess(['result1', 'result2', 'result3'])

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue)

    const promises = [
      batchQueue.enqueue({
        text: 'Text 1',
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: 'hash1',
      }),
      batchQueue.enqueue({
        text: 'Text 2',
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: 'hash2',
      }),
      batchQueue.enqueue({
        text: 'Text 3',
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: 'hash3',
      }),
    ]

    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    const results = await Promise.all(promises)
    expect(results).toEqual(['result1', 'result2', 'result3'])
  })

  it('flushes batch when size limit reached', async () => {
    vi.useFakeTimers()
    mockTranslateSuccess(['result1', 'result2'])

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, {
      ...baseBatchConfig,
      maxItemsPerBatch: 2, // Flush when 2 tasks batched
    })

    const promises = [
      batchQueue.enqueue({
        text: 'A',
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: 'hash1',
      }),
      batchQueue.enqueue({
        text: 'B',
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: 'hash2',
      }), // Should trigger flush
    ]

    vi.advanceTimersByTime(0) // No delay needed

    const results = await Promise.all(promises)
    expect(results).toEqual(['result1', 'result2'])
  })

  it('flushes batch when character limit reached', async () => {
    vi.useFakeTimers()

    // Setup separate mock calls for separate batches
    let callCount = 0
    mockExecuteTranslate.mockImplementation(() => {
      callCount++
      return Promise.resolve(callCount === 1 ? 'first-batch' : 'second-batch')
    })

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, {
      ...baseBatchConfig,
      maxCharactersPerBatch: 10,
    })

    const promise1 = batchQueue.enqueue({
      text: 'Hi',
      langConfig: sampleLangConfig,
      providerConfig: sampleProviderConfig,
      hash: 'hash1',
    })
    const promise2 = batchQueue.enqueue({
      text: 'Very long text exceeding limit',
      langConfig: sampleLangConfig,
      providerConfig: sampleProviderConfig,
      hash: 'hash2',
    })

    vi.advanceTimersByTime(0)

    const [result1, result2] = await Promise.all([promise1, promise2])
    expect(result1).toBe('first-batch')
    expect(result2).toBe('second-batch')
  })

  it('separates batches by different configs', async () => {
    vi.useFakeTimers()

    // Setup separate mock calls for different configs
    let callCount = 0
    mockExecuteTranslate.mockImplementation(() => {
      callCount++
      return Promise.resolve(callCount === 1 ? 'english-result' : 'chinese-result')
    })

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue)

    const config1 = { ...sampleLangConfig, targetCode: 'eng' as const }
    const config2 = { ...sampleLangConfig, targetCode: 'cmn' as const }

    const promises = [
      batchQueue.enqueue({
        text: 'Text 1',
        langConfig: config1,
        providerConfig: sampleProviderConfig,
        hash: 'hash1',
      }),
      batchQueue.enqueue({
        text: 'Text 2',
        langConfig: config2,
        providerConfig: sampleProviderConfig,
        hash: 'hash2',
      }),
    ]

    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    const results = await Promise.all(promises)
    expect(results).toEqual(['english-result', 'chinese-result'])
  })
})

describe('batchQueue – timing control', () => {
  it('flushes batch after delay timeout', async () => {
    vi.useFakeTimers()
    mockTranslateSuccess(['delayed'])

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, {
      ...baseBatchConfig,
      batchDelay: 500,
    })

    const promise = batchQueue.enqueue({
      text: 'Test',
      langConfig: sampleLangConfig,
      providerConfig: sampleProviderConfig,
      hash: 'hash1',
    })

    // Before timeout
    vi.advanceTimersByTime(400)
    // Promise should not be resolved yet

    // After timeout
    vi.advanceTimersByTime(200)
    vi.advanceTimersByTime(0)

    await expect(promise).resolves.toBe('delayed')
  })
})

describe('batchQueue – error handling', () => {
  it('propagates translation errors to all tasks (no retry)', async () => {
    vi.useFakeTimers()
    const error = new Error('Translation failed')
    mockTranslateError(error)

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, baseBatchConfig, {
      maxRetries: 0,
      enableFallbackToIndividual: false,
    })

    const promises = [
      batchQueue.enqueue({
        text: 'Text 1',
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: 'hash1',
      }),
      batchQueue.enqueue({
        text: 'Text 2',
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: 'hash2',
      }),
    ]

    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    await expect(Promise.all(promises)).rejects.toThrow('Translation failed')
  })

  it('handles translation count mismatch (no retry)', async () => {
    vi.useFakeTimers()
    mockExecuteTranslate.mockImplementation(() => Promise.resolve('single-result'))

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, baseBatchConfig, {
      maxRetries: 0,
      enableFallbackToIndividual: false,
    })

    const promises = [
      batchQueue.enqueue({
        text: 'Text 1',
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: 'hash1',
      }),
      batchQueue.enqueue({
        text: 'Text 2',
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: 'hash2',
      }),
    ]

    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    await expect(Promise.all(promises)).rejects.toThrow('Batch result count mismatch')
  })

  it('retries failed batch with exponential backoff', async () => {
    vi.useFakeTimers()
    let attemptCount = 0
    mockExecuteTranslate.mockImplementation(() => {
      attemptCount++
      if (attemptCount <= 2) {
        return Promise.reject(new Error('Temporary error'))
      }
      return Promise.resolve('success-after-retry')
    })

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, baseBatchConfig, {
      maxRetries: 3,
      enableFallbackToIndividual: false,
    })

    const promise = batchQueue.enqueue({
      text: 'Test',
      langConfig: sampleLangConfig,
      providerConfig: sampleProviderConfig,
      hash: 'hash1',
    })

    // Initial execution
    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    // First retry (1s backoff)
    await vi.advanceTimersByTimeAsync(1000)
    // Second retry (2s backoff)
    await vi.advanceTimersByTimeAsync(2000)

    await expect(promise).resolves.toBe('success-after-retry')
    expect(attemptCount).toBe(3)
  })

  it('falls back to individual requests after retries exhausted', async () => {
    vi.useFakeTimers()
    let batchAttemptCount = 0
    mockExecuteTranslate.mockImplementation((text: string) => {
      const batchSeparator = `\n${BATCH_SEPARATOR}\n`
      if (text.includes(batchSeparator)) {
        batchAttemptCount++
        return Promise.reject(new Error('Batch always fails'))
      }
      // Individual requests succeed
      return Promise.resolve(`individual-${text}`)
    })

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, baseBatchConfig, {
      maxRetries: 2,
      enableFallbackToIndividual: true,
      executeIndividual: async (data) => {
        const result = await executeTranslate(data.text, data.langConfig, data.providerConfig)
        return result
      },
    })

    const promises = [
      batchQueue.enqueue({
        text: 'Text1',
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: 'hash1',
      }),
      batchQueue.enqueue({
        text: 'Text2',
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: 'hash2',
      }),
    ]

    // Initial execution
    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    // First retry
    await vi.advanceTimersByTimeAsync(1000)
    // Second retry
    await vi.advanceTimersByTimeAsync(2000)
    // Wait for fallback individual requests
    await vi.advanceTimersByTimeAsync(0)

    const results = await Promise.all(promises)
    expect(results).toEqual(['individual-Text1', 'individual-Text2'])
    expect(batchAttemptCount).toBe(3) // Initial + 2 retries
  })

  it('calls onError callback for each failure', async () => {
    vi.useFakeTimers()
    const error = new Error('Test error')
    mockTranslateError(error)

    const onError = vi.fn()
    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, baseBatchConfig, {
      maxRetries: 2,
      enableFallbackToIndividual: false,
      onError,
    })

    const promise = batchQueue.enqueue({
      text: 'Test',
      langConfig: sampleLangConfig,
      providerConfig: sampleProviderConfig,
      hash: 'hash1',
    }).catch(err => err) // Catch the error to prevent unhandled rejection

    // Initial execution
    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    // First retry
    await vi.advanceTimersByTimeAsync(1000)
    // Second retry
    await vi.advanceTimersByTimeAsync(2000)

    const result = await promise
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('Test error')
    expect(onError).toHaveBeenCalledTimes(3) // Initial + 2 retries
    expect(onError).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        batchKey: expect.any(String),
        retryCount: expect.any(Number),
        isFallback: false,
      }),
    )
  })
})

describe('batchQueue – configuration', () => {
  it('updates batch size configuration', async () => {
    vi.useFakeTimers()
    mockTranslateSuccess(['result1', 'result2'])

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue, {
      ...baseBatchConfig,
      maxItemsPerBatch: 10,
    })

    batchQueue.setBatchConfig({ maxItemsPerBatch: 2 })

    const promises = [
      batchQueue.enqueue({
        text: 'Text 1',
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: 'hash1',
      }),
      batchQueue.enqueue({
        text: 'Text 2',
        langConfig: sampleLangConfig,
        providerConfig: sampleProviderConfig,
        hash: 'hash2',
      }),
    ]

    vi.advanceTimersByTime(0) // Should flush immediately

    const results = await Promise.all(promises)
    expect(results).toEqual(['result1', 'result2'])
  })

  it('throws error for invalid configuration', () => {
    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = createBatchQueue(requestQueue)

    expect(() => batchQueue.setBatchConfig({ maxCharactersPerBatch: 0 })).toThrow()
    expect(() => batchQueue.setBatchConfig({ maxItemsPerBatch: 0 })).toThrow()
    expect(() => batchQueue.setBatchConfig({ maxCharactersPerBatch: -1 })).toThrow()
    expect(() => batchQueue.setBatchConfig({ maxItemsPerBatch: -1 })).toThrow()
  })
})
