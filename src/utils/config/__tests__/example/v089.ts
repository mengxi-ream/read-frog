import type { TestSeriesObject } from "./types"
import { testSeries as previousTestSeries } from "./v088"

/**
 * Frozen v089 expectations. Keep the migration delta explicit here instead of
 * deriving expected fixtures by calling the migration under test.
 */
export const testSeries: TestSeriesObject = Object.fromEntries(
  Object.entries(previousTestSeries).map(([seriesId, seriesData]) => [
    seriesId,
    {
      ...seriesData,
      config: {
        ...seriesData.config,
        translate: {
          ...seriesData.config.translate,
          node: {
            ...seriesData.config.translate.node,
            forceRetranslation: false,
          },
        },
      },
    },
  ]),
)
