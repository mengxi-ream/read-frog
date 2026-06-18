import { DEFAULT_SUBTITLES_SEGMENTATION_PROMPT, DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT, getTokenCellText, INPUT, } from "../constants/prompt";
export function getSubtitlesSegmentationPrompt(jsonContent) {
    return {
        systemPrompt: DEFAULT_SUBTITLES_SEGMENTATION_SYSTEM_PROMPT,
        prompt: DEFAULT_SUBTITLES_SEGMENTATION_PROMPT.replaceAll(getTokenCellText(INPUT), jsonContent),
    };
}
