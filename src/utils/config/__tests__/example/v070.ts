import type { VersionTestData } from "./types"
import { testSeries as v069TestSeries } from "./v069"

export const testSeries = Object.fromEntries(
  Object.entries(v069TestSeries).map(([seriesId, seriesData]) => [
    seriesId,
    {
      ...seriesData,
      config: {
        ...seriesData.config,
        translate: {
          ...seriesData.config.translate,
          splitTranslator: {
            shortcut: "Alt+S",
          },
        },
      },
    },
  ]),
) as VersionTestData["testSeries"]
