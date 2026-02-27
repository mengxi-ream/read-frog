import { i18n } from "#imports"
import { PromptConfigurator } from "@/components/prompt-configurator"
import { promptAtoms } from "./atoms"

export function SubtitlesCustomPrompts() {
  return (
    <PromptConfigurator
      promptAtoms={promptAtoms}
      title={i18n.t("options.videoSubtitles.customPrompts.title")}
      description={i18n.t("options.videoSubtitles.customPrompts.description")}
    />
  )
}
