import type { TestSeriesObject } from "./types"
import { testSeries as v072TestSeries } from "./v072"

function withRequestQueueTimeout(config: any) {
  return {
    ...config,
    translate: {
      ...config.translate,
      requestQueueConfig: {
        ...config.translate.requestQueueConfig,
        timeoutMs: 20_000,
      },
    },
    videoSubtitles: {
      ...config.videoSubtitles,
      requestQueueConfig: {
        ...config.videoSubtitles.requestQueueConfig,
        timeoutMs: 20_000,
      },
    },
  }
}

export const testSeries: TestSeriesObject = Object.fromEntries(
  Object.entries(v072TestSeries).map(([seriesId, seriesData]) => [
    seriesId,
    {
      ...seriesData,
      config: withRequestQueueTimeout(seriesData.config),
    },
  ]),
)
