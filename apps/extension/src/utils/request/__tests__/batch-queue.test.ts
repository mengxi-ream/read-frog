import type { Config } from '@/types/config/config'
import type { ProviderConfig } from '@/types/config/provider'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BATCH_SEPARATOR } from '@/utils/constants/prompt'
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
    if (text.includes(BATCH_SEPARATOR)) {
      return Promise.resolve(results.join(BATCH_SEPARATOR))
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

const baseBatchConfig = {
  batchCharacters: 100,
  batchSize: 3,
  batchDelay: 1000,
}

const baseRequestQueueConfig = {
  rate: 2,
  capacity: 2,
  timeoutMs: 10_000,
  maxRetries: 0,
  baseRetryDelayMs: 100,
}

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('batchQueue – core functionality', () => {
  it('throws error when request queue is not set', async () => {
    const batchQueue = new BatchQueue(baseBatchConfig)

    expect(() => {
      void batchQueue.enqueue('test', sampleLangConfig, sampleProviderConfig, Date.now(), 'hash1')
    }).toThrow('Request queue is not set')
  })

  it('processes single task successfully', async () => {
    vi.useFakeTimers()
    mockTranslateSuccess(['result'])

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = new BatchQueue(baseBatchConfig)
    batchQueue.setRequestQueue(requestQueue)

    const promise = batchQueue.enqueue('Hello', sampleLangConfig, sampleProviderConfig, Date.now(), 'hash1')

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
    const batchQueue = new BatchQueue(baseBatchConfig)
    batchQueue.setRequestQueue(requestQueue)

    const promises = [
      batchQueue.enqueue('Text 1', sampleLangConfig, sampleProviderConfig, Date.now(), 'hash1'),
      batchQueue.enqueue('Text 2', sampleLangConfig, sampleProviderConfig, Date.now(), 'hash2'),
      batchQueue.enqueue('Text 3', sampleLangConfig, sampleProviderConfig, Date.now(), 'hash3'),
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
    const batchQueue = new BatchQueue({
      ...baseBatchConfig,
      batchSize: 2, // Flush when 2 tasks batched
    })
    batchQueue.setRequestQueue(requestQueue)

    const promises = [
      batchQueue.enqueue('A', sampleLangConfig, sampleProviderConfig, Date.now(), 'hash1'),
      batchQueue.enqueue('B', sampleLangConfig, sampleProviderConfig, Date.now(), 'hash2'), // Should trigger flush
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
    const batchQueue = new BatchQueue({
      ...baseBatchConfig,
      batchCharacters: 10,
    })
    batchQueue.setRequestQueue(requestQueue)

    const promise1 = batchQueue.enqueue('Hi', sampleLangConfig, sampleProviderConfig, Date.now(), 'hash1')
    const promise2 = batchQueue.enqueue('Very long text exceeding limit', sampleLangConfig, sampleProviderConfig, Date.now(), 'hash2')

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
    const batchQueue = new BatchQueue(baseBatchConfig)
    batchQueue.setRequestQueue(requestQueue)

    const config1 = { ...sampleLangConfig, targetCode: 'eng' as const }
    const config2 = { ...sampleLangConfig, targetCode: 'cmn' as const }

    const promises = [
      batchQueue.enqueue('Text 1', config1, sampleProviderConfig, Date.now(), 'hash1'),
      batchQueue.enqueue('Text 2', config2, sampleProviderConfig, Date.now(), 'hash2'),
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
    const batchQueue = new BatchQueue({
      ...baseBatchConfig,
      batchDelay: 500,
    })
    batchQueue.setRequestQueue(requestQueue)

    const promise = batchQueue.enqueue('Test', sampleLangConfig, sampleProviderConfig, Date.now(), 'hash1')

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
  it('propagates translation errors to all tasks', async () => {
    vi.useFakeTimers()
    const error = new Error('Translation failed')
    mockTranslateError(error)

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = new BatchQueue(baseBatchConfig)
    batchQueue.setRequestQueue(requestQueue)

    const promises = [
      batchQueue.enqueue('Text 1', sampleLangConfig, sampleProviderConfig, Date.now(), 'hash1'),
      batchQueue.enqueue('Text 2', sampleLangConfig, sampleProviderConfig, Date.now(), 'hash2'),
    ]

    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    await expect(Promise.all(promises)).rejects.toThrow('Translation failed')
  })

  it('handles translation count mismatch', async () => {
    vi.useFakeTimers()
    mockExecuteTranslate.mockImplementation(() => Promise.resolve('single-result'))

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = new BatchQueue(baseBatchConfig)
    batchQueue.setRequestQueue(requestQueue)

    const promises = [
      batchQueue.enqueue('Text 1', sampleLangConfig, sampleProviderConfig, Date.now(), 'hash1'),
      batchQueue.enqueue('Text 2', sampleLangConfig, sampleProviderConfig, Date.now(), 'hash2'),
    ]

    vi.advanceTimersByTime(baseBatchConfig.batchDelay)
    vi.advanceTimersByTime(0)

    await expect(Promise.all(promises)).rejects.toThrow('Translation count mismatch')
  })
})

describe('batchQueue – configuration', () => {
  it('updates batch size configuration', async () => {
    vi.useFakeTimers()
    mockTranslateSuccess(['result1', 'result2'])

    const requestQueue = new RequestQueue(baseRequestQueueConfig)
    const batchQueue = new BatchQueue({
      ...baseBatchConfig,
      batchSize: 10,
    })
    batchQueue.setRequestQueue(requestQueue)

    batchQueue.setBatchConfig({ batchSize: 2 })

    const promises = [
      batchQueue.enqueue('Text 1', sampleLangConfig, sampleProviderConfig, Date.now(), 'hash1'),
      batchQueue.enqueue('Text 2', sampleLangConfig, sampleProviderConfig, Date.now(), 'hash2'),
    ]

    vi.advanceTimersByTime(0) // Should flush immediately

    const results = await Promise.all(promises)
    expect(results).toEqual(['result1', 'result2'])
  })

  it('throws error for invalid configuration', () => {
    const batchQueue = new BatchQueue(baseBatchConfig)

    expect(() => batchQueue.setBatchConfig({ batchCharacters: 0 })).toThrow()
    expect(() => batchQueue.setBatchConfig({ batchSize: 0 })).toThrow()
    expect(() => batchQueue.setBatchConfig({ batchCharacters: -1 })).toThrow()
    expect(() => batchQueue.setBatchConfig({ batchSize: -1 })).toThrow()
  })
})
