import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { getLocalConfig } from "@/utils/config/storage"
import { MAX_CONCURRENT_SEGMENTS, PROCESS_LOOK_AHEAD_MS } from "@/utils/constants/subtitles"
import { aiSegmentBlock } from "@/utils/subtitles/processor/ai-segmentation"
import { optimizeSubtitles, rebalanceToTargetRange } from "@/utils/subtitles/processor/optimizer"

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
  private onChunkProcessed: (() => void) | null

  constructor(options: {
    rawFragments: SubtitlesFragment[]
    getVideoElement: () => HTMLVideoElement | null
    getSourceLanguage: () => string
    onChunkProcessed?: () => void
  }) {
    this.rawFragments = options.rawFragments
    this.getVideoElement = options.getVideoElement
    this.getSourceLanguage = options.getSourceLanguage
    this.onChunkProcessed = options.onChunkProcessed ?? null
  }

  get isRunning(): boolean {
    return this.running
  }

  hasUnprocessedChunks(): boolean {
    return this.rawFragments.some(f => !this.segmentedRawStarts.has(f.start))
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
    if (this.running)
      return
    this.running = true

    try {
      // Cache config once per run loop to avoid redundant storage reads
      // across concurrent chunks
      const config = await getLocalConfig()

      while (!this.stopped && this.hasUnprocessedChunks()) {
        const video = this.getVideoElement()
        if (!video)
          break

        const currentTimeMs = video.currentTime * 1000
        const chunks = this.findNextChunks(currentTimeMs, MAX_CONCURRENT_SEGMENTS)
        if (chunks.length === 0)
          break

        // Mark all fragments as in-progress
        for (const chunk of chunks) {
          chunk.forEach(f => this.segmentedRawStarts.add(f.start))
        }

        // Process chunks concurrently with shared config
        await Promise.all(chunks.map(chunk => this.processChunk(chunk, config)))
      }
    }
    finally {
      this.running = false
    }
  }

  private async processChunk(chunk: SubtitlesFragment[], config: Awaited<ReturnType<typeof getLocalConfig>>): Promise<void> {
    try {
      if (config) {
        const segmented = await aiSegmentBlock(chunk, config)
        const rebalanced = rebalanceToTargetRange(segmented, this.getSourceLanguage())
        this.mergeFragments(rebalanced, chunk)
      }
    }
    catch {
      chunk.forEach(f => this.aiSegmentFailedRawStarts.add(f.start))
      const optimized = optimizeSubtitles(chunk, this.getSourceLanguage())
      this.mergeFragments(optimized, chunk)
    }

    this.onChunkProcessed?.()
  }

  private mergeFragments(newFragments: SubtitlesFragment[], chunk: SubtitlesFragment[]): void {
    const chunkStart = chunk[0].start
    const chunkEnd = chunk.at(-1)!.end
    this.processedFragments = this.processedFragments.filter(
      f => f.start < chunkStart || f.start > chunkEnd,
    )
    this.processedFragments.push(...newFragments)
    this.processedFragments.sort((a, b) => a.start - b.start)
  }

  /**
   * Find up to `maxChunks` non-overlapping chunks, prioritizing fragments
   * closest to the current playback position.
   */
  private findNextChunks(currentTimeMs: number, maxChunks: number): SubtitlesFragment[][] {
    const chunks: SubtitlesFragment[][] = []
    const claimed = new Set<number>()

    for (let i = 0; i < maxChunks; i++) {
      const chunk = this.findNextChunk(currentTimeMs, claimed)
      if (chunk.length === 0)
        break
      chunks.push(chunk)
      chunk.forEach(f => claimed.add(f.start))
    }

    return chunks
  }

  private findNextChunk(currentTimeMs: number, claimed: Set<number>): SubtitlesFragment[] {
    const searchStart = Math.max(0, currentTimeMs - 10_000)
    const firstUnprocessed = this.rawFragments.find(
      f => f.start >= searchStart && !this.segmentedRawStarts.has(f.start) && !claimed.has(f.start),
    )
    if (!firstUnprocessed)
      return []

    const windowEnd = firstUnprocessed.start + PROCESS_LOOK_AHEAD_MS
    return this.rawFragments.filter(
      f => f.start >= firstUnprocessed.start && f.start < windowEnd
        && !this.segmentedRawStarts.has(f.start) && !claimed.has(f.start),
    )
  }
}
