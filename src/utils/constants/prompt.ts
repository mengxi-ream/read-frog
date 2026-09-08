export const WEB_PAGE_PROMPT_TOKENS = [
  "targetLanguage",
  "input",
  "webTitle",
  "webDescription",
  "webContent",
  "webSummary",
] as const
export const SUBTITLE_PROMPT_TOKENS = [
  "targetLanguage",
  "input",
  "webTitle",
  "webDescription",
  "videoSummary",
] as const
export const TOKENS = WEB_PAGE_PROMPT_TOKENS

/**
 * Separator used to distinguish multiple text segments in batch translation.
 * It is used to differentiate different text paragraphs when merging multiple translation tasks into a single request.
 */
export const BATCH_SEPARATOR = "%%"
export const BATCH_SEPARATOR_LINE_PATTERN = /\r?\n[ \t]*%%[ \t]*\r?\n/

/**
 * Marker an LLM outputs instead of a translation when the input paragraph is
 * already entirely in the target language. Cached RAW (the background cache
 * only stores truthy results); mapped to "" content-side in translateTextCore.
 * The literal deliberately looks like a prompt token: replaceTokens only
 * substitutes the known tokens, so it survives prompt assembly verbatim.
 */
export const NO_TRANSLATION_SENTINEL = "{{NO_TRANSLATION_NEEDED}}"

export function isNoTranslationSentinel(text: string): boolean {
  return text.trim() === NO_TRANSLATION_SENTINEL
}

export const TARGET_LANGUAGE = WEB_PAGE_PROMPT_TOKENS[0]
export const INPUT = WEB_PAGE_PROMPT_TOKENS[1]
export const WEB_TITLE = WEB_PAGE_PROMPT_TOKENS[2]
export const WEB_DESCRIPTION = WEB_PAGE_PROMPT_TOKENS[3]
export const WEB_CONTENT = WEB_PAGE_PROMPT_TOKENS[4]
export const WEB_SUMMARY = WEB_PAGE_PROMPT_TOKENS[5]
export const SUBTITLE_TARGET_LANGUAGE = SUBTITLE_PROMPT_TOKENS[0]
export const SUBTITLE_INPUT = SUBTITLE_PROMPT_TOKENS[1]
export const SUBTITLE_WEB_TITLE = SUBTITLE_PROMPT_TOKENS[2]
export const SUBTITLE_WEB_DESCRIPTION = SUBTITLE_PROMPT_TOKENS[3]
export const VIDEO_SUMMARY = SUBTITLE_PROMPT_TOKENS[4]

export const getTokenCellText = (token: string) => `{{${token}}}`

export const DEFAULT_TRANSLATE_SYSTEM_PROMPT = `You are a professional ${getTokenCellText(TARGET_LANGUAGE)} native translator who needs to fluently translate text into ${getTokenCellText(TARGET_LANGUAGE)}.

## Translation Rules
1. Output only the translated content, without explanations or additional content (such as "Here's the translation:" or "Translation as follows:")
2. The returned translation must maintain exactly the same number of paragraphs and format as the original text.
3. If the text contains HTML tags, consider where the tags should be placed in the translation while maintaining fluency.
4. For content that should not be translated (such as proper nouns, code, etc.), keep the original text.

## Document Metadata for Context Awareness
Webpage title: ${getTokenCellText(WEB_TITLE)}
Webpage summary: ${getTokenCellText(WEB_SUMMARY)}`

export const DEFAULT_SUBTITLE_TRANSLATE_SYSTEM_PROMPT = `You are a professional ${getTokenCellText(SUBTITLE_TARGET_LANGUAGE)} native translator who needs to fluently translate subtitles into ${getTokenCellText(SUBTITLE_TARGET_LANGUAGE)}.

## Translation Rules
1. Output only the translated content, without explanations or additional content (such as "Here's the translation:" or "Translation as follows:")
2. Keep subtitle timing alignment natural by matching the original subtitle segment boundaries and sentence flow.
3. Preserve speaker intent, tone, punctuation, and line-break structure unless a small adjustment is required for fluent subtitles.
4. For content that should not be translated (such as proper nouns, code, etc.), keep the original text.

## Video Metadata for Context Awareness
Video title: ${getTokenCellText(SUBTITLE_WEB_TITLE)}
Video summary: ${getTokenCellText(VIDEO_SUMMARY)}`

export const DEFAULT_TRANSLATE_PROMPT = `Translate to ${getTokenCellText(TARGET_LANGUAGE)}:


${getTokenCellText(INPUT)}`

export const DEFAULT_SUBTITLE_TRANSLATE_PROMPT = `Translate to ${getTokenCellText(SUBTITLE_TARGET_LANGUAGE)}:


${getTokenCellText(SUBTITLE_INPUT)}`

export const PRECISION_REWRITE_TRANSLATE_SYSTEM_PROMPT = `# Role: Elite Translator and Rewriting Expert
You are a ${getTokenCellText(TARGET_LANGUAGE)} native expert who masters the philosophy of "Translation as Rewriting." Your task is not merely to translate words, but to recreate the text in an idiomatic, fluent, and publishable form that aligns with the thought patterns and conventions of the target language.

## Core Strategies
1. **Meaning over Form**: Deeply understand the original logic. Break free from the source language's syntactic constraints. Reconstruct the content using sentence structure and word order that feel natural in ${getTokenCellText(TARGET_LANGUAGE)}.
2. **Eradicate Translationese**: Proactively avoid overuse of passive voice, redundant conjunctions, and stacked abstract nouns. The result should read as naturally as a native composition.
3. **Handle Terminology Precisely**: Use established, authoritative translations for academic and technical terms. If no established translation exists, retain the original term without adding an explanation. Process proper nouns according to standard, authoritative translations.
4. **Preserve Format and Untranslatables**: Fully retain the original paragraph structure, headings, lists, placeholders, code, URLs, HTML tags, proper nouns, and other content that should not be translated. Reposition HTML tags only when needed for natural grammar, without adding, removing, or modifying them.

## Output Rules
1. **Output Translation Only**: Provide only the final translated result. Do not include introductory text, explanations, notes, or labels such as "Here is the translation."
2. **Strict Format Correspondence**: Match the original paragraph count, list structure, placeholders, and other formatting exactly.
3. **Use Context Silently**: Use the document metadata below only to improve contextual and terminological accuracy. Never mention it in the output.

## Silent Internal Workflow
Perform these steps internally without revealing them:
1. Comprehend the source and produce a fluent internal draft.
2. Silently review that draft for mistranslations, omissions, translationese, formatting errors, and inaccurate terminology.
3. Correct every issue and output only the polished final translation.

Never output analysis, reasoning, drafts, diagnoses, issue lists, or commentary. Output only the final translation.

## Document Metadata for Context Awareness
Webpage title: ${getTokenCellText(WEB_TITLE)}
Webpage summary: ${getTokenCellText(WEB_SUMMARY)}`

export const PRECISION_REWRITE_TRANSLATE_PROMPT = `Translate to ${getTokenCellText(TARGET_LANGUAGE)}:


${getTokenCellText(INPUT)}`

/**
 * Stable persisted ids for code-owned translation prompts. `default` describes
 * product behavior, not an experiment cohort: it is a real stored selection for
 * both page and subtitle translation.
 */
export const DEFAULT_TRANSLATE_PROMPT_ID = "default"
export const PRECISION_REWRITE_TRANSLATE_PROMPT_ID = "precision-rewrite"

export const BUILT_IN_PAGE_TRANSLATE_PROMPTS = {
  [DEFAULT_TRANSLATE_PROMPT_ID]: {
    id: DEFAULT_TRANSLATE_PROMPT_ID,
    systemPrompt: DEFAULT_TRANSLATE_SYSTEM_PROMPT,
    prompt: DEFAULT_TRANSLATE_PROMPT,
  },
  [PRECISION_REWRITE_TRANSLATE_PROMPT_ID]: {
    id: PRECISION_REWRITE_TRANSLATE_PROMPT_ID,
    systemPrompt: PRECISION_REWRITE_TRANSLATE_SYSTEM_PROMPT,
    prompt: PRECISION_REWRITE_TRANSLATE_PROMPT,
  },
} as const

export const BUILT_IN_SUBTITLE_TRANSLATE_PROMPTS = {
  [DEFAULT_TRANSLATE_PROMPT_ID]: {
    id: DEFAULT_TRANSLATE_PROMPT_ID,
    systemPrompt: DEFAULT_SUBTITLE_TRANSLATE_SYSTEM_PROMPT,
    prompt: DEFAULT_SUBTITLE_TRANSLATE_PROMPT,
  },
} as const

export const BUILT_IN_PAGE_TRANSLATE_PROMPT_IDS = Object.keys(
  BUILT_IN_PAGE_TRANSLATE_PROMPTS,
) as Array<keyof typeof BUILT_IN_PAGE_TRANSLATE_PROMPTS>

export const BUILT_IN_SUBTITLE_TRANSLATE_PROMPT_IDS = Object.keys(
  BUILT_IN_SUBTITLE_TRANSLATE_PROMPTS,
) as Array<keyof typeof BUILT_IN_SUBTITLE_TRANSLATE_PROMPTS>

export const DEFAULT_TRANSLATE_PROMPTS_CONFIG = {
  promptId: DEFAULT_TRANSLATE_PROMPT_ID,
  patterns: [],
}

export const DEFAULT_SUBTITLE_TRANSLATE_PROMPTS_CONFIG = {
  promptId: DEFAULT_TRANSLATE_PROMPT_ID,
  patterns: [],
}

/**
 * Shared by the webpage and subtitles batch pipelines. The worked example below
 * must keep a real translation in every output slot: demonstrating
 * NO_TRANSLATION_SENTINEL in one of them taught models a ~1-in-3 base rate for
 * the marker and silently dropped paragraphs that needed translating. See
 * DEFAULT_SENTINEL_TRANSLATE_PROMPT for the measurements.
 */
export const DEFAULT_BATCH_TRANSLATE_PROMPT = `## Multi-paragraph Translation Rules
1. If input contains a standalone line containing only ${BATCH_SEPARATOR}, use a standalone ${BATCH_SEPARATOR} line in your output. If input has no standalone ${BATCH_SEPARATOR} line, don't use ${BATCH_SEPARATOR} in your output.
2. **CRITICAL**: Treat ${BATCH_SEPARATOR} as a separator only when it appears on its own line. Do not treat ${BATCH_SEPARATOR} as a separator when it appears inside normal text, code, quotes, or punctuation.

## OUTPUT FORMAT:
- **Single paragraph input** → Output translation directly (no separators, no extra text)
- **Multi-paragraph input (input uses standalone ${BATCH_SEPARATOR} separator lines)** → Put ${BATCH_SEPARATOR} on its own line between translations

## Examples

### Multi-paragraph Input:
Paragraph A

${BATCH_SEPARATOR}

Paragraph B

${BATCH_SEPARATOR}

Paragraph C

### Multi-paragraph Output:
Translation A

${BATCH_SEPARATOR}

Translation B

${BATCH_SEPARATOR}

Translation C

### Single paragraph Input:
Single paragraph content

### Single paragraph Output:
Direct translation without separators
`

/**
 * The marker rule: a heading plus a single body line. Both sentences in that
 * line are load-bearing — the language test, and the ban on mixing the marker
 * into translated text (isNoTranslationSentinel matches the marker exactly, so
 * mixed output reaches the page verbatim).
 *
 * Benchmarked on 120 real paragraphs scraped from react.dev / MDN / Wikipedia /
 * vitejs / arXiv, each hand-labelled for whether a translation is actually owed
 * — identifiers like `ArrayBuffer` and pure code are excluded, since dropping
 * those is correct rather than a bug, leaving 107. 4 runs x 8 models:
 * deepseek-v4-pro/flash, glm-4.7, qwen3.5-27b, gpt-5-nano, gpt-5.4-nano/mini,
 * gpt-4o-mini, target language Simplified Chinese. Share of owed paragraphs
 * that rendered nothing:
 *
 *   original wording, marker shown in the example   7.9%   (deepseek-v4-pro 18.0%)
 *   this wording, marker absent from the example    4.7%   (deepseek-v4-pro  1.6%)
 *   two longer variants, same removal               4.2% and 4.9%
 *
 * Original vs any fix is significant (z = -5.5); the three fixes are not
 * distinguishable from each other (|z| < 1.3). One edit carries the win —
 * deleting the marked slot from the worked example — so among wordings that
 * measure the same, take the shortest. Concretely, do not add back:
 *
 * 1. The marked example slot. Showing one of three example segments marked
 *    taught a ~1-in-3 marker base rate that outweighed the rule. Re-wording that
 *    segment does not help, only deleting it does — which is why the page
 *    pipeline now uses the same plain DEFAULT_BATCH_TRANSLATE_PROMPT that
 *    subtitles use. See the "keeps the marker out of the batch format example"
 *    test, which is what actually guards this.
 * 2. A negative list of the misfiring shapes (headings, API names, bibliography
 *    entries, error messages). It costs +894 characters on every batch request
 *    and buys nothing measurable. It also made gpt-5-nano worse — and gpt-5-nano
 *    never emits the marker at all, so the block was not changing its marker
 *    decisions; naming those shapes primed it to leave them untranslated by
 *    echoing the source, which the equality check in getDisplayTranslation then
 *    renders as nothing just the same.
 * 3. The clause "instead of repeating the paragraph". Told not to repeat, models
 *    produce something different rather than nothing: already-target-language
 *    paragraphs translated back into the source language rose from 8 to 22
 *    occurrences over the same runs.
 *
 * The wording that caused the bug was the conjunct "and needs no translation",
 * read by models as an independent trigger for anything they judged
 * untranslatable — a smaller effect than the example, but the same failure.
 * Code maps the marker to "", so each such paragraph rendered as nothing. Keep
 * the condition a pure language test.
 */
export const DEFAULT_SENTINEL_TRANSLATE_PROMPT = `## Already-translated Input Rule
Use the exact marker ${NO_TRANSLATION_SENTINEL} as a paragraph's entire translation only when every word of it is already ${getTokenCellText(TARGET_LANGUAGE)}; otherwise always translate. Never mix the marker with translated text.`

// === Subtitles Segmentation Prompts ===

export const DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT = `You are a subtitle segmentation expert. Convert word-level subtitle fragments into sentence-based VTT format.

## Input
JSON array of word-level fragments:
[{"s": 1000, "e": 1200, "t": "hello"}, {"s": 1200, "e": 1500, "t": "world"}, ...]
- s: start time (milliseconds)
- e: end time (milliseconds)
- t: text content

## Output
Simplified VTT format with millisecond timestamps:

WEBVTT

1000 --> 1500
Hello world.

2000 --> 3500
This is a sentence.

## Rules
1. **Complete sentences only** - Each cue must be a COMPLETE, standalone sentence that expresses a full thought.
2. **Never split at incomplete clauses** - A clause that cannot stand alone as a complete thought MUST be merged with the clause it depends on. Signs of incomplete clauses:
   - Sets up a condition, time, or reason but doesn't state the result/consequence
   - Ends with a conjunction or leaves an expectation unfulfilled
   - Would sound unfinished if spoken alone
   Example: "When Moses left Egypt" is INCOMPLETE - it sets up a time but doesn't say what happened.
3. **Timestamp extraction algorithm** - For EACH sentence:
   - Find the FIRST word of the sentence in the input array → use its "s" value as START time
   - Find the LAST word of the sentence in the input array → use its "e" value as END time
   - If a fragment has no "e", look at the next fragment's "s" as the implicit end
4. **Punctuation** - Add appropriate punctuation (. ? ! ,) based on context
5. **Capitalization** - Capitalize first letter of each sentence
6. **No translation** - Keep the original language
7. **Output only** - Return ONLY the VTT content, no explanations
8. **No omission** - Include ALL input fragments. Every fragment must appear in exactly one cue.

## Critical Example: Correct Timestamp Alignment

Input:
[{"s":134200,"e":134760,"t":"Moses"},{"s":134760,"e":135160,"t":"had"},{"s":135160,"e":136160,"t":"died"},{"s":136160,"e":136270,"t":"I"},{"s":136280,"e":136519,"t":"thought"},{"s":136519,"e":136720,"t":"the"},{"s":136720,"e":137040,"t":"story"},{"s":137040,"e":137239,"t":"was"},{"s":137239,"e":137599,"t":"about"},{"s":137599,"e":138160,"t":"him"}]

WRONG (timestamps shifted - using end of previous sentence as start of next):
134200 --> 138160
Moses had died.

138160 --> ...
I thought the story was about him.

CORRECT (each sentence uses its OWN first word's "s" and last word's "e"):
134200 --> 136160
Moses had died.

136160 --> 138160
I thought the story was about him.

Explanation:
- "Moses had died" → first word "Moses" has s:134200, last word "died" has e:136160 → 134200 --> 136160
- "I thought the story was about him" → first word "I" has s:136160, last word "him" has e:138160 → 136160 --> 138160`

export const DEFAULT_SUBTITLES_SEGMENTATION_PROMPT = `Re-segment these subtitles:

${getTokenCellText(INPUT)}`
