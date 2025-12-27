import type { SubtitlesFragment, SubtitlesTranslationBlock, SubtitlesTranslationBlockState } from '@/utils/subtitles/types'
import { FIRST_BATCH_DURATION_MS, PRELOAD_AHEAD_MS, SUBSEQUENT_BATCH_DURATION_MS } from '@/utils/constants/subtitles'

/**
 * Create translation blocks from subtitle fragments
 *
 * Boundary strategy: Divide by fragment's **start time**
 * - Fragments with start in [0, 100s) → first batch
 * - Fragments with start in [100s, 160s) → second batch
 * - And so on...
 *
 * This ensures fragments crossing boundaries (e.g., 98s-103s)
 * are fully included in the block where they start
 */
export function createSubtitlesBlocks(fragments: SubtitlesFragment[]): SubtitlesTranslationBlock[] {
  if (fragments.length === 0)
    return []

  const blocks: SubtitlesTranslationBlock[] = []
  let blockStartMs = FIRST_BATCH_DURATION_MS
  let blockId = 0

  const firstBlockFragments = fragments.filter(
    f => f.start >= 0 && f.start < FIRST_BATCH_DURATION_MS,
  )

  if (firstBlockFragments.length > 0) {
    blocks.push({
      id: blockId++,
      startMs: 0,
      endMs: FIRST_BATCH_DURATION_MS,
      state: 'idle',
      fragments: firstBlockFragments,
    })
  }

  const maxEndMs = Math.max(...fragments.map(f => f.end))

  while (blockStartMs < maxEndMs) {
    const batchEndMs = blockStartMs + SUBSEQUENT_BATCH_DURATION_MS
    const batchFragments = fragments.filter(
      f => f.start >= blockStartMs && f.start < batchEndMs,
    )

    if (batchFragments.length > 0) {
      blocks.push({
        id: blockId++,
        startMs: blockStartMs,
        endMs: batchEndMs,
        state: 'idle',
        fragments: batchFragments,
      })
    }
    blockStartMs = batchEndMs
  }

  return blocks
}

export function findNextBlockToTranslate(blocks: SubtitlesTranslationBlock[], currentTimeMs: number): SubtitlesTranslationBlock | null {
  const pendingBlocks = blocks.filter(block => block.state === 'idle')

  if (pendingBlocks.length === 0)
    return null

  const currentBlock = pendingBlocks.find(
    block => block.startMs <= currentTimeMs && block.endMs > currentTimeMs,
  )
  if (currentBlock)
    return currentBlock

  const upcomingBlock = pendingBlocks.find(
    block => block.startMs <= currentTimeMs + PRELOAD_AHEAD_MS && block.startMs >= currentTimeMs,
  )

  return upcomingBlock || null
}

export function updateBlockState(
  blocks: SubtitlesTranslationBlock[],
  blockId: number,
  state: SubtitlesTranslationBlockState,
): SubtitlesTranslationBlock[] {
  return blocks.map(block =>
    block.id === blockId ? { ...block, state } : block,
  )
}
