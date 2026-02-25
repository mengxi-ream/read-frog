import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { getLocalConfig } from "@/utils/config/storage"
import { PROCESS_LOOK_AHEAD_MS } from "@/utils/constants/subtitles"
import { aiSegmentBlock } from "@/utils/subtitles/processor/ai-segmentation"
import { optimizeSubtitles } from "@/utils/subtitles/processor/optimizer"

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

  constructor(options: {
    rawFragments: SubtitlesFragment[]
    getVideoElement: () => HTMLVideoElement | null
    getSourceLanguage: () => string
  }) {
    this.rawFragments = options.rawFragments
    this.getVideoElement = options.getVideoElement
    this.getSourceLanguage = options.getSourceLanguage
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

    const video = this.getVideoElement()
    if (!video) {
      this.running = false
      return
    }

    try {
      while (!this.stopped && this.hasUnprocessedChunks()) {
        const didWork = await this.processNextChunk(video.currentTime * 1000)
        if (!didWork)
          break
      }
    }
    finally {
      this.running = false
    }
  }

  private async processNextChunk(currentTimeMs: number): Promise<boolean> {
    const chunk = this.findNextChunk(currentTimeMs)
    if (chunk.length === 0)
      return false

    chunk.forEach(f => this.segmentedRawStarts.add(f.start))

    try {
      const config = await getLocalConfig()
      if (config) {
        const segmented = await aiSegmentBlock(chunk, config)
        const chunkStart = chunk[0].start
        const chunkEnd = chunk[chunk.length - 1].end
        this.processedFragments = this.processedFragments.filter(
          f => f.start < chunkStart || f.start > chunkEnd,
        )
        this.processedFragments.push(...segmented)
        this.processedFragments.sort((a, b) => a.start - b.start)
      }
    }
    catch {
      chunk.forEach(f => this.aiSegmentFailedRawStarts.add(f.start))
      const optimized = optimizeSubtitles(chunk, this.getSourceLanguage())
      this.processedFragments.push(...optimized)
      this.processedFragments.sort((a, b) => a.start - b.start)
    }

    return true
  }

  private findNextChunk(currentTimeMs: number): SubtitlesFragment[] {
    const searchStart = Math.max(0, currentTimeMs - 10_000)
    const firstUnprocessed = this.rawFragments.find(
      f => f.start >= searchStart && !this.segmentedRawStarts.has(f.start),
    )
    if (!firstUnprocessed)
      return []

    const windowEnd = firstUnprocessed.start + PROCESS_LOOK_AHEAD_MS
    return this.rawFragments.filter(
      f => f.start >= firstUnprocessed.start && f.start < windowEnd
        && !this.segmentedRawStarts.has(f.start),
    )
  }
}
