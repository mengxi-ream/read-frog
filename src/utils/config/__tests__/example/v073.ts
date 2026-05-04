import type { VersionTestData } from "./types"
import { testSeries as v072TestSeries } from "./v072"

export const testSeries = Object.fromEntries(
  Object.entries(v072TestSeries).map(([seriesId, seriesData]) => [
    seriesId,
    {
      ...seriesData,
      config: {
        ...seriesData.config,
        videoSubtitles: {
          ...seriesData.config.videoSubtitles,
          style: {
            ...seriesData.config.videoSubtitles.style,
            blurTranslation: false,
          },
        },
      },
    },
  ]),
) as VersionTestData["testSeries"]
