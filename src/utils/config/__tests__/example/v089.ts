import type { TestSeriesObject } from "./types"
import { testSeries as previousTestSeries } from "./v088"

const complexConfig = previousTestSeries["complex-config-from-v020"]!
const llmDetectionConfig = previousTestSeries["config-with-llm-detection-enabled"]!
const promptTokenConfig = previousTestSeries["prompt-token-migration-coverage"]!
const defaultDictionaryWordingConfig = previousTestSeries["default-dictionary-wording"]!

/**
 * Frozen v089 expectations. Keep the migration delta explicit here instead of
 * deriving expected fixtures by calling the migration under test.
 */
export const testSeries: TestSeriesObject = {
  "complex-config-from-v020": {
    ...complexConfig,
    config: {
      ...complexConfig.config,
      translationHub: {
        selectedProviderIds: null,
      },
    },
  },
  "config-with-llm-detection-enabled": {
    ...llmDetectionConfig,
    config: {
      ...llmDetectionConfig.config,
      translationHub: {
        selectedProviderIds: null,
      },
    },
  },
  "prompt-token-migration-coverage": {
    ...promptTokenConfig,
    config: {
      ...promptTokenConfig.config,
      translationHub: {
        selectedProviderIds: null,
      },
    },
  },
  "default-dictionary-wording": {
    ...defaultDictionaryWordingConfig,
    config: {
      ...defaultDictionaryWordingConfig.config,
      translationHub: {
        selectedProviderIds: null,
      },
    },
  },
}
