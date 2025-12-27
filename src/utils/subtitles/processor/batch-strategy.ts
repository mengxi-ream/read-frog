import type { BatchState, SubtitlesFragment, TranslationBatch } from '@/utils/subtitles/types'
import {
  FIRST_BATCH_DURATION_MS,
  PRELOAD_AHEAD_MS,
  SUBSEQUENT_BATCH_DURATION_MS,
} from '@/utils/constants/subtitles'

export interface BatchConfig {
  firstBatchDurationMs: number
  subsequentBatchDurationMs: number
  preloadAheadMs: number
}

export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  firstBatchDurationMs: FIRST_BATCH_DURATION_MS,
  subsequentBatchDurationMs: SUBSEQUENT_BATCH_DURATION_MS,
  preloadAheadMs: PRELOAD_AHEAD_MS,
}

/**
 * Create translation batches from subtitle fragments
 *
 * Boundary strategy: Divide by fragment's **start time**
 * - Fragments with start in [0, 100s) → first batch
 * - Fragments with start in [100s, 160s) → second batch
 * - And so on...
 *
 * This ensures fragments crossing boundaries (e.g., 98s-103s)
 * are fully included in the batch where they start
 */
export function createBatches(
  fragments: SubtitlesFragment[],
  config: BatchConfig = DEFAULT_BATCH_CONFIG,
): TranslationBatch[] {
  if (fragments.length === 0)
    return []

  const batches: TranslationBatch[] = []
  let batchStartMs = 0
  let batchId = 0

  // First batch: 0 to firstBatchDurationMs
  const firstBatchEndMs = config.firstBatchDurationMs
  const firstBatchFragments = fragments.filter(
    f => f.start >= 0 && f.start < firstBatchEndMs,
  )

  if (firstBatchFragments.length > 0) {
    batches.push({
      id: batchId++,
      startMs: 0,
      endMs: firstBatchEndMs,
      state: 'idle',
      fragments: firstBatchFragments,
    })
  }
  batchStartMs = firstBatchEndMs

  const maxEndMs = Math.max(...fragments.map(f => f.end))

  while (batchStartMs < maxEndMs) {
    const batchEndMs = batchStartMs + config.subsequentBatchDurationMs
    const batchFragments = fragments.filter(
      f => f.start >= batchStartMs && f.start < batchEndMs,
    )

    if (batchFragments.length > 0) {
      batches.push({
        id: batchId++,
        startMs: batchStartMs,
        endMs: batchEndMs,
        state: 'idle',
        fragments: batchFragments,
      })
    }
    batchStartMs = batchEndMs
  }

  return batches
}

export function findNextBatchToTranslate(
  batches: TranslationBatch[],
  currentTimeMs: number,
  preloadAheadMs: number = DEFAULT_BATCH_CONFIG.preloadAheadMs,
): TranslationBatch | null {
  const pendingBatches = batches.filter(b => b.state === 'idle')

  if (pendingBatches.length === 0)
    return null

  const currentBatch = pendingBatches.find(
    b => b.startMs <= currentTimeMs && b.endMs > currentTimeMs,
  )
  if (currentBatch)
    return currentBatch

  const upcomingBatch = pendingBatches.find(
    b => b.startMs <= currentTimeMs + preloadAheadMs && b.startMs > currentTimeMs,
  )

  return upcomingBatch || null
}

export function updateBatchState(
  batches: TranslationBatch[],
  batchId: number,
  state: BatchState,
): TranslationBatch[] {
  return batches.map(b =>
    b.id === batchId ? { ...b, state } : b,
  )
}
