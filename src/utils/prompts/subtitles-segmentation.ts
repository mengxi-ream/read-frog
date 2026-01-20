import {
  DEFAULT_SUBTITLES_SEGMENTATION_PROMPT,
  DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT,
  getTokenCellText,
  INPUT,
} from '../constants/prompt'

export interface SubtitlesSegmentationPromptResult {
  systemPrompt: string
  prompt: string
}

export function getSubtitlesSegmentationPrompt(
  jsonContent: string,
): SubtitlesSegmentationPromptResult {
  return {
    systemPrompt: DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT,
    prompt: DEFAULT_SUBTITLES_SEGMENTATION_PROMPT.replaceAll(getTokenCellText(INPUT), jsonContent),
  }
}
