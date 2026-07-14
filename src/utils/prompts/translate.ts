import type { Config } from "@/types/config/config"
import type { WebPagePromptContext } from "@/types/content"
import { getLocalConfig } from "@/utils/config/storage"
import {
  HTML_ATTRIBUTE_MARKER,
  parseHtmlAttributeMarkers,
} from "@/utils/host/translate/html-attribute-markers"
import { DEFAULT_CONFIG } from "../constants/config"
import {
  BATCH_SEPARATOR,
  DEFAULT_BATCH_TRANSLATE_PROMPT_WITH_SENTINEL,
  DEFAULT_SENTINEL_TRANSLATE_PROMPT,
  DEFAULT_TRANSLATE_PROMPT,
  DEFAULT_TRANSLATE_SYSTEM_PROMPT,
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
  translateConfig: Pick<Config["translate"], "customPromptsConfig">,
  targetLang: string,
  input: string,
  options?: TranslatePromptOptions<WebPagePromptContext>,
): TranslatePromptResult {
  const customPromptsConfig = translateConfig.customPromptsConfig
  const { patterns, promptId } = customPromptsConfig

  // Resolve system prompt and user prompt
  let systemPrompt: string
  let prompt: string

  if (!promptId) {
    // Use default prompts from constants
    systemPrompt = DEFAULT_TRANSLATE_SYSTEM_PROMPT
    prompt = DEFAULT_TRANSLATE_PROMPT
  } else {
    // Find custom prompt, fallback to default
    const customPrompt = patterns.find((pattern) => pattern.id === promptId)
    systemPrompt = customPrompt?.systemPrompt ?? DEFAULT_TRANSLATE_SYSTEM_PROMPT
    prompt = customPrompt?.prompt ?? DEFAULT_TRANSLATE_PROMPT
  }

  // For batch mode, append batch rules to system prompt. The sentinel rule and
  // the sentinel-bearing format example are appended ONLY here: batch prompts
  // are built exclusively for the background translation pipeline, whose
  // results all return through translateTextCore where the sentinel is mapped
  // — the selection-toolbar streaming path never sees this instruction and can
  // never render the marker raw.
  if (options?.isBatch) {
    systemPrompt = `${systemPrompt}

${DEFAULT_BATCH_TRANSLATE_PROMPT_WITH_SENTINEL}

${DEFAULT_SENTINEL_TRANSLATE_PROMPT}`
  }

  if (parseHtmlAttributeMarkers(input).length > 0) {
    systemPrompt = `${systemPrompt}

${HTML_ATTRIBUTE_MARKER_SYSTEM_PROMPT}`
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

  return {
    systemPrompt: replaceTokens(systemPrompt),
    prompt: replaceTokens(prompt),
  }
}

export async function getTranslatePrompt(
  targetLang: string,
  input: string,
  options?: TranslatePromptOptions<WebPagePromptContext>,
): Promise<TranslatePromptResult> {
  const config = (await getLocalConfig()) ?? DEFAULT_CONFIG
  return getTranslatePromptFromConfig(config.translate, targetLang, input, options)
}
