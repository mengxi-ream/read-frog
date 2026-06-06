import type { TestSeriesObject } from "./types"
import { testSeries as previousTestSeries } from "./v073"

const knowledgeBase = {
  enabled: true,
  captureSurfaces: [
    "page",
    "node",
    "selection",
    "input",
    "subtitles",
    "translationHub",
  ],
  remoteSync: {
    enabled: false,
    endpoint: "",
    token: "",
  },
}

export const testSeries: TestSeriesObject = Object.fromEntries(
  Object.entries(previousTestSeries).map(([seriesId, seriesData]) => [
    seriesId,
    {
      ...seriesData,
      config: {
        ...seriesData.config,
        knowledgeBase,
      },
    },
  ]),
)
