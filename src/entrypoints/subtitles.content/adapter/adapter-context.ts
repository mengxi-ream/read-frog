import type { SubtitlesScheduler } from "../subtitles-scheduler"
import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import type { SubtitlesFetcher } from "@/utils/subtitles/fetchers/types"
import { createOperationGeneration } from "./operation-generation"

export class AdapterLifecycle {
  // Set by destroy(); async work that resumes afterwards backs out instead of touching the page.
  destroyed = false
  readonly switchGeneration = createOperationGeneration()
  // Bumped by a leave and a navigation reset, so an init still waiting on the old player stops.
  readonly playerGeneration = createOperationGeneration()

  isSuperseded(operationId: number) {
    return this.destroyed || !this.switchGeneration.isCurrent(operationId)
  }

  isPlayerSuperseded(generation: number) {
    return this.destroyed || !this.playerGeneration.isCurrent(generation)
  }
}

export interface AdapterContext {
  config: PlatformConfig
  lifecycle: AdapterLifecycle
  getScheduler: () => SubtitlesScheduler | null
  getFetcher: () => SubtitlesFetcher
}
