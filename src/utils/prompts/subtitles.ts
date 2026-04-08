import type { TranslatePromptOptions, TranslatePromptResult } from "./translate"
import type { SubtitlePromptContext } from "@/types/content"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG } from "../constants/config"
import {
  DEFAULT_BATCH_TRANSLATE_PROMPT,
  DEFAULT_SUBTITLE_TRANSLATE_SYSTEM_PROMPT,
  DEFAULT_TRANSLATE_PROMPT,
  getTokenCellText,
  INPUT,
  TARGET_LANGUAGE,
  VIDEO_SUMMARY,
  VIDEO_TITLE,
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
    prompt = DEFAULT_TRANSLATE_PROMPT
  }
  else {
    // Find custom prompt, fallback to default
    const customPrompt = patterns.find(pattern => pattern.id === promptId)
    systemPrompt = customPrompt?.systemPrompt ?? DEFAULT_SUBTITLE_TRANSLATE_SYSTEM_PROMPT
    prompt = customPrompt?.prompt ?? DEFAULT_TRANSLATE_PROMPT
  }

  // For batch mode, append batch rules to system prompt
  if (options?.isBatch) {
    systemPrompt = `${systemPrompt}

${DEFAULT_BATCH_TRANSLATE_PROMPT}`
  }

  // Build title and summary replacement values
  const title = resolvePromptReplacementValue(options?.context?.videoTitle, "No title available")
  const summary = resolvePromptReplacementValue(options?.context?.videoSummary, "No summary available")

  // Replace tokens in both prompts
  const replaceTokens = (text: string) =>
    text
      .replaceAll(getTokenCellText(TARGET_LANGUAGE), targetLang)
      .replaceAll(getTokenCellText(INPUT), input)
      .replaceAll(getTokenCellText(VIDEO_TITLE), title)
      .replaceAll(getTokenCellText(VIDEO_SUMMARY), summary)

  return {
    systemPrompt: replaceTokens(systemPrompt),
    prompt: replaceTokens(prompt),
  }
}
