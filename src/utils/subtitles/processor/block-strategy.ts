import type { SubtitlesFragment, SubtitlesTranslationBlock, SubtitlesTranslationBlockState } from '@/utils/subtitles/types'
import {
  FIRST_BATCH_DURATION_MS,
  PRELOAD_AHEAD_MS,
  SUBSEQUENT_BATCH_DURATION_MS,
} from '@/utils/constants/subtitles'

export const DEFAULT_BATCH_CONFIG = {
  firstBatchDurationMs: FIRST_BATCH_DURATION_MS,
  subsequentBatchDurationMs: SUBSEQUENT_BATCH_DURATION_MS,
  preloadAheadMs: PRELOAD_AHEAD_MS,
}

/**
 * Create translation blocks from subtitle fragments
 *
 * Boundary strategy: Divide by fragment's **start time**
 * - Fragments with start in [0, 100s) → first batch
 * - Fragments with start in [100s, 160s) → second batch
 * - And so on...
 *
 * This ensures fragments crossing boundaries (e.g., 98s-103s)
 * are fully included in the batch where they start
 */
export function createSubtitlesBlocks(
  fragments: SubtitlesFragment[],
  config = DEFAULT_BATCH_CONFIG,
): SubtitlesTranslationBlock[] {
  if (fragments.length === 0)
    return []

  const blocks: SubtitlesTranslationBlock[] = []
  let batchStartMs = 0
  let batchId = 0

  const firstBatchEndMs = config.firstBatchDurationMs
  const firstBatchFragments = fragments.filter(
    f => f.start >= 0 && f.start < firstBatchEndMs,
  )

  if (firstBatchFragments.length > 0) {
    blocks.push({
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
      blocks.push({
        id: batchId++,
        startMs: batchStartMs,
        endMs: batchEndMs,
        state: 'idle',
        fragments: batchFragments,
      })
    }
    batchStartMs = batchEndMs
  }

  return blocks
}

export function findNextBlockToTranslate(
  blocks: SubtitlesTranslationBlock[],
  currentTimeMs: number,
  preloadAheadMs: number = DEFAULT_BATCH_CONFIG.preloadAheadMs,
): SubtitlesTranslationBlock | null {
  const pendingBlocks = blocks.filter(block => block.state === 'idle')

  if (pendingBlocks.length === 0)
    return null

  const currentBlock = pendingBlocks.find(
    block => block.startMs <= currentTimeMs && block.endMs > currentTimeMs,
  )
  if (currentBlock)
    return currentBlock

  const upcomingBlock = pendingBlocks.find(
    block => block.startMs <= currentTimeMs + preloadAheadMs && block.startMs >= currentTimeMs,
  )

  return upcomingBlock || null
}

export function updateBatchState(
  blocks: SubtitlesTranslationBlock[],
  batchId: number,
  state: SubtitlesTranslationBlockState,
): SubtitlesTranslationBlock[] {
  return blocks.map(block =>
    block.id === batchId ? { ...block, state } : block,
  )
}
