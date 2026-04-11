import { i18n } from "#imports"
import { PromptConfigurator } from "@/components/prompt-configurator"
import { getTokenCellText, SUBTITLE_PROMPT_TOKENS } from "@/utils/constants/prompt"
import { promptAtoms } from "./atoms"

export function SubtitlesCustomPrompts() {
  const insertCells = SUBTITLE_PROMPT_TOKENS.map(token => ({
    text: getTokenCellText(token),
    description: i18n.t(`options.videoSubtitles.customPrompts.editPrompt.promptCellInput.${token}` as never),
  }))

  return (
    <PromptConfigurator
      id="subtitles-custom-prompts"
      promptAtoms={promptAtoms}
      insertCells={insertCells}
      title={i18n.t("options.videoSubtitles.customPrompts.title")}
      description={i18n.t("options.videoSubtitles.customPrompts.description")}
    />
  )
}
