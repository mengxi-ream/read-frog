import type { Config } from "@/types/config/config"
import type { WebPagePromptContext } from "@/types/content"
import type { MatchedTerm } from "@/utils/glossary/types"
import { getLocalConfig } from "@/utils/config/storage"
import { resolveGlossaryTerms } from "@/utils/glossary/active-matcher"
import { appendGlossaryToSystemPrompt } from "@/utils/glossary/prompt"
import {
  HTML_ATTRIBUTE_MARKER,
  parseHtmlAttributeMarkers,
} from "@/utils/host/translate/html-attribute-markers"
import {
  hasInlineAtomTokens,
  INLINE_ATOM_TOKEN_SYSTEM_PROMPT,
} from "@/utils/host/translate/inline-atom-tokens"
import { DEFAULT_CONFIG } from "../constants/config"
import {
  BATCH_SEPARATOR,
  BUILT_IN_PAGE_TRANSLATE_PROMPTS,
  DEFAULT_BATCH_TRANSLATE_PROMPT,
  DEFAULT_SENTINEL_TRANSLATE_PROMPT,
  DEFAULT_TRANSLATE_PROMPT_ID,
  getTokenCellText,
  INPUT,
  TARGET_LANGUAGE,
  WEB_CONTENT,
  WEB_DESCRIPTION,
  WEB_SUMMARY,
  WEB_TITLE,
} from "../constants/prompt"

const HTML_ATTRIBUTE_MARKER_SYSTEM_PROMPT = `## Protected HTML Marker Rules
These mandatory rules override any conflicting instructions above:
1. Within each input segment (segments are separated by a standalone ${BATCH_SEPARATOR} line when present), preserve every \`${HTML_ATTRIBUTE_MARKER}\` attribute occurrence and its value exactly once in that segment's output.
2. Never add, remove, change, duplicate, rename, renumber, or move a marker to another segment.
3. Keep each marker on its original HTML element.
4. The HTML element carrying a marker may move within its segment to follow the target-language word order.`

export interface TranslatePromptOptions<TContext = unknown> {
  isBatch?: boolean
  context?: TContext
  /**
   * Glossary entries the caller found in `input`. Only matched terms are ever
   * passed: the whole list would put every term in every request and, because
   * the finished prompt is the translation cache key
   * (host/translate/translate-text.ts:146), would orphan every cached paragraph
   * on any glossary edit.
   */
  glossaryTerms?: readonly MatchedTerm[]
}

export interface TranslatePromptResult {
  systemPrompt: string
  prompt: string
}

export function resolvePromptReplacementValue(
  value: string | null | undefined,
  fallback: string,
): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback
}

export function getTranslatePromptFromConfig(
  translateConfig: Pick<Config["pageTranslation"], "customPromptsConfig">,
  targetLang: string,
  input: string,
  options?: TranslatePromptOptions<WebPagePromptContext>,
): TranslatePromptResult {
  const customPromptsConfig = translateConfig.customPromptsConfig
  const { patterns, promptId } = customPromptsConfig

  const resolvedPromptId = promptId || DEFAULT_TRANSLATE_PROMPT_ID
  const builtInPrompt = Object.hasOwn(BUILT_IN_PAGE_TRANSLATE_PROMPTS, resolvedPromptId)
    ? BUILT_IN_PAGE_TRANSLATE_PROMPTS[
        resolvedPromptId as keyof typeof BUILT_IN_PAGE_TRANSLATE_PROMPTS
      ]
    : undefined
  const customPrompt = patterns.find((pattern) => pattern.id === resolvedPromptId)
  const selectedPrompt =
    builtInPrompt ?? customPrompt ?? BUILT_IN_PAGE_TRANSLATE_PROMPTS[DEFAULT_TRANSLATE_PROMPT_ID]

  let { systemPrompt, prompt } = selectedPrompt

  // For batch mode, append batch rules to system prompt. The batch block is the
  // same one subtitles use — the marker appears only in the sentinel rule that
  // follows, never inside the format example (see DEFAULT_SENTINEL_TRANSLATE_PROMPT).
  // The sentinel rule is appended ONLY here: batch prompts are built exclusively
  // for the background translation pipeline, whose results all return through
  // translateTextCore where the sentinel is mapped — the selection-toolbar
  // streaming path never sees this instruction and can never render the marker raw.
  if (options?.isBatch) {
    systemPrompt = `${systemPrompt}

${DEFAULT_BATCH_TRANSLATE_PROMPT}

${DEFAULT_SENTINEL_TRANSLATE_PROMPT}`
  }

  if (parseHtmlAttributeMarkers(input).length > 0) {
    systemPrompt = `${systemPrompt}

${HTML_ATTRIBUTE_MARKER_SYSTEM_PROMPT}`
  }

  // Inline-atom placeholders ({{n}}) stand for formulas cloned back after
  // translation. The rule is appended only when the input carries one, so the
  // system prompt — and with it the LLM cache hash — is untouched otherwise.
  if (hasInlineAtomTokens(input)) {
    systemPrompt = `${systemPrompt}

${INLINE_ATOM_TOKEN_SYSTEM_PROMPT}`
  }

  // Build title and summary replacement values
  const title = resolvePromptReplacementValue(options?.context?.webTitle, "No title available")
  const description = resolvePromptReplacementValue(
    options?.context?.webDescription,
    "No description available",
  )
  const contentText = resolvePromptReplacementValue(
    options?.context?.webContent,
    "No content available",
  )
  const summary = resolvePromptReplacementValue(
    options?.context?.webSummary,
    "No summary available",
  )

  // Replace tokens in both prompts
  const replaceTokens = (text: string) =>
    text
      .replaceAll(getTokenCellText(TARGET_LANGUAGE), targetLang)
      .replaceAll(getTokenCellText(INPUT), input)
      .replaceAll(getTokenCellText(WEB_TITLE), title)
      .replaceAll(getTokenCellText(WEB_DESCRIPTION), description)
      .replaceAll(getTokenCellText(WEB_CONTENT), contentText)
      .replaceAll(getTokenCellText(WEB_SUMMARY), summary)

  // The glossary block is appended AFTER token replacement, and that ordering is
  // load-bearing: a term is arbitrary user text that may contain a `{{input}}`-
  // shaped substring, and assembling it earlier would let a user's own glossary
  // rewrite the prompt around it. `renderGlossaryPromptBlock` returns null when
  // nothing matched, so a user whose glossary missed this paragraph produces a
  // prompt byte-identical to a user with no glossary — merely owning a glossary
  // must not orphan the cache.
  return {
    systemPrompt: appendGlossaryToSystemPrompt(
      replaceTokens(systemPrompt),
      options?.glossaryTerms ?? [],
    ),
    prompt: replaceTokens(prompt),
  }
}

export async function getTranslatePrompt(
  targetLang: string,
  input: string,
  options?: TranslatePromptOptions<WebPagePromptContext>,
): Promise<TranslatePromptResult> {
  const config = (await getLocalConfig()) ?? DEFAULT_CONFIG
  // Resolved here rather than at each call site so both prompt builds agree: the
  // content script builds one to derive the cache key
  // (host/translate/translate-text.ts:142) and the background builds another for
  // the actual request. Matching is a pure function of (text, entries), so the
  // two agree as long as they see the same glossary revision. A caller that
  // already matched — the batch pipeline, which unions terms across a batch —
  // passes its own and skips this.
  const glossaryTerms =
    options?.glossaryTerms ??
    (await resolveGlossaryTerms(input, config.glossary.enabled, config.language.targetCode)).terms
  return getTranslatePromptFromConfig(config.pageTranslation, targetLang, input, {
    ...options,
    glossaryTerms,
  })
}
