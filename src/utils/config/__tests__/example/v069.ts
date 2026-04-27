import type { VersionTestData } from "./types"
import { testSeries as v068TestSeries } from "./v068"

export const testSeries = Object.fromEntries(
  Object.entries(v068TestSeries).map(([seriesId, seriesData]) => [
    seriesId,
    {
      ...seriesData,
      config: {
        ...seriesData.config,
        floatingButton: {
          ...seriesData.config.floatingButton,
          side: "right",
        },
      },
    },
  ]),
) as VersionTestData["testSeries"]
