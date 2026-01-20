import type { SubtitlesFragment, SubtitlesTranslationBlock, SubtitlesTranslationBlockState } from '@/utils/subtitles/types'
import { BLOCK_BOUNDARY_LOOK_AHEAD_MS, FIRST_BATCH_DURATION_MS, PRELOAD_AHEAD_MS, SENTENCE_END_PATTERN, SUBSEQUENT_BATCH_DURATION_MS } from '@/utils/constants/subtitles'

/**
 * Find the best index to end a block, looking ahead for natural boundaries
 *
 * @param fragments - All subtitle fragments (sorted by start time)
 * @param startIndex - Index where this block starts
 * @param targetDurationMs - Target duration before looking for boundary
 * @param lookAheadMs - How far to look beyond target for a boundary
 * @returns Index of last fragment to include in this block
 */
function findBlockEndIndex(
  fragments: SubtitlesFragment[],
  startIndex: number,
  targetDurationMs: number,
  lookAheadMs: number,
): number {
  if (startIndex >= fragments.length)
    return startIndex

  const blockStartMs = fragments[startIndex].start
  const targetEndMs = blockStartMs + targetDurationMs
  const maxEndMs = targetEndMs + lookAheadMs

  let fallbackIndex = startIndex // Last fragment within target duration
  let boundaryIndex = -1 // Best boundary found

  for (let i = startIndex; i < fragments.length; i++) {
    const fragment = fragments[i]

    // Beyond max look-ahead window - stop searching
    if (fragment.start >= maxEndMs)
      break

    // Within target duration - valid fallback point
    if (fragment.start < targetEndMs) {
      fallbackIndex = i
      // Track boundary within target duration
      if (SENTENCE_END_PATTERN.test(fragment.text.trim())) {
        boundaryIndex = i
      }
    }
    else {
      // In look-ahead zone - find first boundary and stop
      if (SENTENCE_END_PATTERN.test(fragment.text.trim())) {
        boundaryIndex = i
        break
      }
    }
  }

  // Prefer boundary if found, otherwise use time-based fallback
  return boundaryIndex !== -1 ? boundaryIndex : fallbackIndex
}

/**
 * Create translation blocks from subtitle fragments
 *
 * Boundary strategy:
 * 1. Target duration: 50s for first block, 60s for subsequent blocks
 * 2. Look ahead up to 20s for natural sentence boundaries
 * 3. Split at sentence-ending punctuation or newline if found
 * 4. Fall back to time-based split if no boundary found
 */
export function createSubtitlesBlocks(fragments: SubtitlesFragment[]): SubtitlesTranslationBlock[] {
  if (fragments.length === 0)
    return []

  const blocks: SubtitlesTranslationBlock[] = []
  let currentIndex = 0
  let blockId = 0

  while (currentIndex < fragments.length) {
    const targetDuration = blockId === 0
      ? FIRST_BATCH_DURATION_MS
      : SUBSEQUENT_BATCH_DURATION_MS

    const endIndex = findBlockEndIndex(
      fragments,
      currentIndex,
      targetDuration,
      BLOCK_BOUNDARY_LOOK_AHEAD_MS,
    )

    // Extract fragments for this block
    const blockFragments = fragments.slice(currentIndex, endIndex + 1)

    if (blockFragments.length > 0) {
      blocks.push({
        id: blockId++,
        startMs: blockFragments[0].start,
        endMs: blockFragments[blockFragments.length - 1].end,
        state: 'idle',
        fragments: blockFragments,
      })
    }

    currentIndex = endIndex + 1
  }

  return blocks
}

export function findNextBlockToTranslate(blocks: SubtitlesTranslationBlock[], currentTimeMs: number): SubtitlesTranslationBlock | null {
  const pendingBlocks = blocks.filter(block => block.state === 'idle')

  if (pendingBlocks.length === 0)
    return null

  // 1. Priority: pending block currently playing
  const currentPendingBlock = pendingBlocks.find(
    block => block.startMs <= currentTimeMs && block.endMs > currentTimeMs,
  )
  if (currentPendingBlock)
    return currentPendingBlock

  // 2. Find active block (may already be translated)
  const activeBlock = blocks.find(
    block => block.startMs <= currentTimeMs && block.endMs > currentTimeMs,
  )

  // 3. Trigger next pending block when current block remaining time <= PRELOAD_AHEAD_MS
  //    BUT only if no block after activeBlock is already completed/processing
  //    This prevents chain triggering: Block 4 done → Block 5 → Block 5 done → Block 6...
  if (activeBlock) {
    const remainingMs = activeBlock.endMs - currentTimeMs
    if (remainingMs <= PRELOAD_AHEAD_MS) {
      // Check if there's already a completed/processing block after active block
      const hasPreloadedBlock = blocks.some(
        block => block.startMs >= activeBlock.endMs
          && (block.state === 'completed' || block.state === 'processing'),
      )
      if (!hasPreloadedBlock) {
        const nextPendingBlock = pendingBlocks.find(block => block.startMs >= activeBlock.endMs)
        if (nextPendingBlock)
          return nextPendingBlock
      }
    }
  }

  // 4. Fallback: handle seek scenarios - upcoming block within preload window
  return pendingBlocks.find(
    block => block.startMs <= currentTimeMs + PRELOAD_AHEAD_MS && block.startMs >= currentTimeMs,
  ) || null
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
