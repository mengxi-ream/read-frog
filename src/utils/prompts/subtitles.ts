import type { TranslatePromptOptions, TranslatePromptResult } from "./translate"
import type { SubtitlePromptContext } from "@/types/content"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG } from "../constants/config"
import {
  BUILT_IN_SUBTITLE_TRANSLATE_PROMPTS,
  DEFAULT_BATCH_TRANSLATE_PROMPT,
  DEFAULT_TRANSLATE_PROMPT_ID,
  getTokenCellText,
  SUBTITLE_INPUT,
  SUBTITLE_TARGET_LANGUAGE,
  SUBTITLE_WEB_DESCRIPTION,
  SUBTITLE_WEB_TITLE,
  VIDEO_SUMMARY,
} from "../constants/prompt"
import { resolvePromptReplacementValue } from "./translate"

export async function getSubtitlesTranslatePrompt(
  targetLang: string,
  input: string,
  options?: TranslatePromptOptions<SubtitlePromptContext>,
): Promise<TranslatePromptResult> {
  const config = (await getLocalConfig()) ?? DEFAULT_CONFIG
  const customPromptsConfig = config.videoSubtitles.customPromptsConfig
  const { patterns, promptId } = customPromptsConfig

  const resolvedPromptId = promptId || DEFAULT_TRANSLATE_PROMPT_ID
  const builtInPrompt = Object.hasOwn(BUILT_IN_SUBTITLE_TRANSLATE_PROMPTS, resolvedPromptId)
    ? BUILT_IN_SUBTITLE_TRANSLATE_PROMPTS[
        resolvedPromptId as keyof typeof BUILT_IN_SUBTITLE_TRANSLATE_PROMPTS
      ]
    : undefined
  const customPrompt = patterns.find((pattern) => pattern.id === resolvedPromptId)
  const selectedPrompt =
    builtInPrompt ??
    customPrompt ??
    BUILT_IN_SUBTITLE_TRANSLATE_PROMPTS[DEFAULT_TRANSLATE_PROMPT_ID]

  let { systemPrompt, prompt } = selectedPrompt

  // For batch mode, append batch rules to system prompt
  if (options?.isBatch) {
    systemPrompt = `${systemPrompt}

${DEFAULT_BATCH_TRANSLATE_PROMPT}`
  }

  // Build title and summary replacement values
  const title = resolvePromptReplacementValue(options?.context?.webTitle, "No title available")
  const description = resolvePromptReplacementValue(
    options?.context?.webDescription,
    "No description available",
  )
  const summary = resolvePromptReplacementValue(
    options?.context?.videoSummary,
    "No summary available",
  )

  // Replace tokens in both prompts
  const replaceTokens = (text: string) =>
    text
      .replaceAll(getTokenCellText(SUBTITLE_TARGET_LANGUAGE), targetLang)
      .replaceAll(getTokenCellText(SUBTITLE_INPUT), input)
      .replaceAll(getTokenCellText(SUBTITLE_WEB_TITLE), title)
      .replaceAll(getTokenCellText(SUBTITLE_WEB_DESCRIPTION), description)
      .replaceAll(getTokenCellText(VIDEO_SUMMARY), summary)

  return {
    systemPrompt: replaceTokens(systemPrompt),
    prompt: replaceTokens(prompt),
  }
}
