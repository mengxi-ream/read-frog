import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { PROCESS_LOOK_AHEAD_MS } from "@/utils/constants/subtitles"
import { effectiveLookAheadMs } from "@/utils/subtitles/lookahead"
import { aiSegmentBlock } from "@/utils/subtitles/processor/ai-segmentation"
import { optimizeSubtitles } from "@/utils/subtitles/processor/optimizer"

export type ChunkSegmentedHandler = (
  chunk: SubtitlesFragment[],
  nextFragments: SubtitlesFragment[],
) => void

export class SegmentationPipeline {
  // Segmented results, read by translation pipeline
  processedFragments: SubtitlesFragment[] = []

  private rawFragments: SubtitlesFragment[]
  private segmentedRawStarts = new Set<number>()
  private aiSegmentFailedRawStarts = new Set<number>()
  private running = false
  private stopped = false

  private getVideoElement: () => HTMLVideoElement | null
  private getSourceLanguage: () => string
  private preSegmented: boolean
  private onChunkSegmented: ChunkSegmentedHandler | null
  /**
   * Resolved once per session by the adapter and narrowed to a promptable
   * ref, so segmentation neither pays a hostedAi.status round trip per block
   * nor sends a translate-only provider on a doomed generation per chunk.
   * Null means AI segmentation cannot run (no provider, the provider has no
   * model to prompt, or the hosted tier was unavailable when the session
   * started); chunks then fall back to rule-based optimization until a new
   * session resolves a fresh ref.
   */
  private providerRef: PromptableProviderRef | null

  constructor(options: {
    baselineFragments?: SubtitlesFragment[]
    rawFragments: SubtitlesFragment[]
    getVideoElement: () => HTMLVideoElement | null
    getSourceLanguage: () => string
    providerRef: PromptableProviderRef | null
    preSegmented?: boolean
    onChunkSegmented?: ChunkSegmentedHandler
  }) {
    this.rawFragments = options.rawFragments
    this.processedFragments = [...(options.baselineFragments ?? [])]
    this.getVideoElement = options.getVideoElement
    this.getSourceLanguage = options.getSourceLanguage
    this.providerRef = options.providerRef
    this.preSegmented = options.preSegmented ?? false
    this.onChunkSegmented = options.onChunkSegmented ?? null
  }

  get isRunning(): boolean {
    return this.running
  }

  hasUnprocessedChunks(): boolean {
    return this.rawFragments.some((f) => !this.segmentedRawStarts.has(f.start))
  }

  start() {
    this.stopped = false
    void this.runLoop()
  }

  stop() {
    this.stopped = true
  }

  restart() {
    void this.runLoop()
  }

  clearFailedStarts() {
    for (const start of this.aiSegmentFailedRawStarts) {
      this.segmentedRawStarts.delete(start)
    }
    this.aiSegmentFailedRawStarts.clear()
  }

  private async runLoop() {
    if (this.running) return
    this.running = true

    const video = this.getVideoElement()
    if (!video) {
      this.running = false
      return
    }

    try {
      while (!this.stopped && this.hasUnprocessedChunks()) {
        const didWork = await this.processNextChunk(video.currentTime * 1000)
        if (!didWork) break
      }
    } finally {
      this.running = false
    }
  }

  private async processNextChunk(currentTimeMs: number): Promise<boolean> {
    if (this.stopped) return false

    const chunk = this.findNextChunk(currentTimeMs)
    if (chunk.length === 0) return false

    chunk.forEach((f) => this.segmentedRawStarts.add(f.start))

    if (this.preSegmented) {
      this.replaceProcessedChunk(chunk, chunk)
      return true
    }

    if (!this.providerRef) {
      // Do not leave starts marked segmented with no replacement (would skip forever).
      const optimized = optimizeSubtitles(chunk, this.getSourceLanguage())
      this.replaceProcessedChunk(chunk, optimized)
      return true
    }

    try {
      const segmented = await aiSegmentBlock(chunk, this.providerRef)
      // Session may have been torn down while the AI call was in flight.
      if (this.stopped) {
        chunk.forEach((f) => this.segmentedRawStarts.delete(f.start))
        return true
      }
      const optimized = optimizeSubtitles(segmented, this.getSourceLanguage())
      this.replaceProcessedChunk(chunk, optimized)
    } catch {
      if (this.stopped) {
        chunk.forEach((f) => this.segmentedRawStarts.delete(f.start))
        return true
      }
      chunk.forEach((f) => this.aiSegmentFailedRawStarts.add(f.start))
      const optimized = optimizeSubtitles(chunk, this.getSourceLanguage())
      this.replaceProcessedChunk(chunk, optimized)
    }

    return true
  }

  private replaceProcessedChunk(chunk: SubtitlesFragment[], nextFragments: SubtitlesFragment[]) {
    // Do not mutate processed fragments or notify the adapter after stop().
    if (this.stopped) return

    const chunkStart = chunk[0]!.start
    const chunkEnd = chunk.at(-1)!.end

    // Drop any cue that overlaps the window (not just cues whose start falls inside it).
    // Half-open: keep if end <= chunkStart || start >= chunkEnd.
    this.processedFragments = this.processedFragments.filter(
      (fragment) => fragment.end <= chunkStart || fragment.start >= chunkEnd,
    )
    this.processedFragments.push(...nextFragments)
    this.processedFragments.sort((a, b) => a.start - b.start)

    this.onChunkSegmented?.(chunk, nextFragments)
  }

  private findNextChunk(currentTimeMs: number): SubtitlesFragment[] {
    const searchStart = Math.max(0, currentTimeMs - 10_000)
    const firstUnprocessed = this.rawFragments.find(
      (f) => f.start >= searchStart && !this.segmentedRawStarts.has(f.start),
    )
    if (!firstUnprocessed) return []

    // Only segment chunks within the look-ahead window ahead of the current
    // position. Without this bound the loop keeps segmenting until the end of
    // the video regardless of how far playback has actually reached, which
    // eagerly sends the entire remaining video to the AI segmentation model.
    // Chunks further ahead are picked up later, once playback advances and the
    // translation coordinator restarts the pipeline.
    const lookAheadMs = effectiveLookAheadMs(
      PROCESS_LOOK_AHEAD_MS,
      this.getVideoElement()?.playbackRate,
    )
    if (firstUnprocessed.start > currentTimeMs + lookAheadMs) return []

    const windowEnd = firstUnprocessed.start + lookAheadMs
    return this.rawFragments.filter(
      (f) =>
        f.start >= firstUnprocessed.start &&
        f.start < windowEnd &&
        !this.segmentedRawStarts.has(f.start),
    )
  }
}
