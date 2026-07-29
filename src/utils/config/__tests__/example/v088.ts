import type { TestSeriesObject } from "./types"
import { testSeries as previousTestSeries } from "./v087"

const complexConfig = previousTestSeries["complex-config-from-v020"]!
const llmDetectionConfig = previousTestSeries["config-with-llm-detection-enabled"]!
const promptTokenConfig = previousTestSeries["prompt-token-migration-coverage"]!
const defaultDictionaryWordingConfig = previousTestSeries["default-dictionary-wording"]!

/**
 * Frozen v088 expectations. Keep the migration delta explicit here instead of
 * deriving expected fixtures by calling the migration under test.
 */
export const testSeries: TestSeriesObject = {
  "complex-config-from-v020": {
    ...complexConfig,
    config: {
      ...complexConfig.config,
      selectionToolbar: {
        ...complexConfig.config.selectionToolbar,
        saveSuggestion: {
          enabled: true,
          actionId: "default-dictionary",
        },
        builtInActions: {
          dictionary: {
            enabled: true,
            providerId: "deepseek-default",
          },
        },
        customActions: [],
      },
    },
  },
  "config-with-llm-detection-enabled": {
    ...llmDetectionConfig,
    config: {
      ...llmDetectionConfig.config,
      selectionToolbar: {
        ...llmDetectionConfig.config.selectionToolbar,
        saveSuggestion: {
          enabled: true,
          actionId: "default-dictionary",
        },
        builtInActions: {
          dictionary: {
            enabled: true,
            providerId: "google-default",
          },
        },
        customActions: [],
      },
    },
  },
  "prompt-token-migration-coverage": {
    ...promptTokenConfig,
    config: {
      ...promptTokenConfig.config,
      selectionToolbar: {
        ...promptTokenConfig.config.selectionToolbar,
        saveSuggestion: {
          enabled: true,
          actionId: "default-dictionary",
        },
        builtInActions: {
          dictionary: {
            enabled: false,
            providerId: "read-frog-free-ai",
          },
        },
        customActions: promptTokenConfig.config.selectionToolbar.customActions,
      },
    },
  },
  "default-dictionary-wording": {
    ...defaultDictionaryWordingConfig,
    config: {
      ...defaultDictionaryWordingConfig.config,
      selectionToolbar: {
        ...defaultDictionaryWordingConfig.config.selectionToolbar,
        saveSuggestion: {
          enabled: true,
          actionId: "default-dictionary",
        },
        builtInActions: {
          dictionary: {
            enabled: true,
            providerId: "google-default",
          },
        },
        customActions: [],
      },
    },
  },
}
