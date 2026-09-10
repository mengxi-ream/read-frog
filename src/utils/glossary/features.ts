import type { FeatureKey } from "../constants/feature-providers"

/**
 * The features whose translation goes through a prompt, and can therefore carry
 * a glossary.
 *
 * `noteSuggestion` is deliberately absent — it is a dictionary lookup, not a
 * translation, and has no terminology to honour. The other four each build a
 * prompt: page and input translation through `prompts/translate.ts`, subtitles
 * through `prompts/subtitles.ts`, and the selection toolbar through the sync
 * builder with terms resolved by its caller.
 *
 * Whether a given feature currently RUNS on a prompt-driven provider is answered
 * by `options/components/llm-feature-status-list.tsx`, which resolves the
 * provider by capability — a plain `providersConfig` lookup reports Built-in AI
 * as unconfigured forever, since the registry synthesizes it and it is never a
 * row there.
 */
export const GLOSSARY_FEATURE_KEYS = [
  "pageTranslation",
  "videoSubtitles",
  "selectionTranslation",
  "inputTranslation",
] as const satisfies readonly FeatureKey[]

export type GlossaryFeatureKey = (typeof GLOSSARY_FEATURE_KEYS)[number]
