import type { TranslatePromptOptions, TranslatePromptResult } from "./translate"
import type { SubtitlePromptContext } from "@/types/content"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG } from "../constants/config"
import {
  DEFAULT_BATCH_TRANSLATE_PROMPT,
  DEFAULT_SUBTITLE_TRANSLATE_PROMPT,
  DEFAULT_SUBTITLE_TRANSLATE_SYSTEM_PROMPT,
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
  const config = await getLocalConfig() ?? DEFAULT_CONFIG
  const customPromptsConfig = config.videoSubtitles.customPromptsConfig
  const { patterns = [], promptId } = customPromptsConfig

  // Resolve system prompt and user prompt
  let systemPrompt: string
  let prompt: string

  if (!promptId) {
    // Use default prompts from constants
    systemPrompt = DEFAULT_SUBTITLE_TRANSLATE_SYSTEM_PROMPT
    prompt = DEFAULT_SUBTITLE_TRANSLATE_PROMPT
  }
  else {
    // Find custom prompt, fallback to default
    const customPrompt = patterns.find(pattern => pattern.id === promptId)
    systemPrompt = customPrompt?.systemPrompt ?? DEFAULT_SUBTITLE_TRANSLATE_SYSTEM_PROMPT
    prompt = customPrompt?.prompt ?? DEFAULT_SUBTITLE_TRANSLATE_PROMPT
  }

  // For batch mode, append batch rules to system prompt
  if (options?.isBatch) {
    systemPrompt = `${systemPrompt}

${DEFAULT_BATCH_TRANSLATE_PROMPT}`
  }

  // Build title and summary replacement values
  const title = resolvePromptReplacementValue(options?.context?.webTitle, "No title available")
  const description = resolvePromptReplacementValue(options?.context?.webDescription, "No description available")
  const summary = resolvePromptReplacementValue(options?.context?.videoSummary, "No summary available")

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
