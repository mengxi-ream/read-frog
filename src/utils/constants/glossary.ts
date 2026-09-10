/**
 * Ceiling on stored terms. Derived from measurement, not taste: at 20,000 terms
 * one compiled alternation scans a 180k-character page in ~0.72 ms and the
 * serialised glossary is ~955 KB. Raising it is a storage-and-UI problem before
 * it is a matching problem — see docs/glossary-feature-plan.md D7.
 */
export const MAX_GLOSSARY_TERMS = 20_000

/** Long enough for a multi-word proper noun, short enough that a pasted paragraph is obviously wrong. */
export const MAX_GLOSSARY_SOURCE_LENGTH = 200
export const MAX_GLOSSARY_TARGET_LENGTH = 200

export const DEFAULT_GLOSSARY_CONFIG = {
  // Costs nothing while the list is empty — an empty matcher returns no terms,
  // so the rendered prompt is byte-identical to having no glossary at all — and
  // it means a user's first term works without hunting for a switch.
  enabled: true,
} as const
