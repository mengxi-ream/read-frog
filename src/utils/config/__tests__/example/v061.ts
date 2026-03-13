import type { TestSeriesObject } from "./types"
import { testSeries as v060TestSeries } from "./v060"

function addSpeakingToConfig(config: any): any {
  const customActions = Array.isArray(config.selectionToolbar?.customActions)
    ? config.selectionToolbar.customActions.map((action: any) => ({
        ...action,
        outputSchema: Array.isArray(action.outputSchema)
          ? action.outputSchema.map((field: any) => ({
              ...field,
              speaking: field.id === "default-dictionary-term" || field.id === "default-dictionary-context",
            }))
          : action.outputSchema,
      }))
    : config.selectionToolbar?.customActions

  return {
    ...config,
    selectionToolbar: {
      ...config.selectionToolbar,
      customActions,
    },
  }
}

export const testSeries: TestSeriesObject = Object.fromEntries(
  Object.entries(v060TestSeries).map(([seriesId, seriesData]) => [
    seriesId,
    {
      ...seriesData,
      config: addSpeakingToConfig(seriesData.config),
    },
  ]),
)

export const description = "Add speaking flag to custom action output schema fields"
export const configExample = testSeries["complex-config-from-v020"]?.config
