import { PromptManager } from "@/components/prompt-configurator"
import { getTokenCellText, SUBTITLE_PROMPT_TOKENS } from "@/utils/constants/prompt"
import { i18n } from "@/utils/i18n"
import { ConfigDetailSection } from "../../../../components/config-detail-section"
import { PageLayout } from "../../../../components/page-layout"
import { promptAtoms } from "../atoms"

/**
 * Every prompt Read Frog can translate subtitles with, drilled into from the Video Subtitles
 * page. They stay apart from the page translation prompts, which take different tokens.
 */
export function SubtitlesCustomPromptsPage() {
  const insertCells = SUBTITLE_PROMPT_TOKENS.map((token) => ({
    text: getTokenCellText(token),
    description: i18n.t(
      `options.videoSubtitles.customPrompts.editPrompt.promptCellInput.${token}` as never,
    ),
  }))

  return (
    <PageLayout
      title={i18n.t("options.videoSubtitles.title")}
      description={i18n.t("options.videoSubtitles.pageDescription")}
    >
      <ConfigDetailSection
        backTo="/video-subtitles"
        title={
          <span id="subtitles-custom-prompts">
            {i18n.t("options.videoSubtitles.customPrompts.title")}
          </span>
        }
      >
        <PromptManager promptAtoms={promptAtoms} insertCells={insertCells} />
      </ConfigDetailSection>
    </PageLayout>
  )
}
