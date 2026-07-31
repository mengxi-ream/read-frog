import { PromptManager } from "@/components/prompt-configurator"
import { getTokenCellText, WEB_PAGE_PROMPT_TOKENS } from "@/utils/constants/prompt"
import { i18n } from "@/utils/i18n"
import { ConfigDetailSection } from "../../../../components/config-detail-section"
import { PageLayout } from "../../../../components/page-layout"
import { promptAtoms } from "../atoms"

/**
 * Every prompt Read Frog can translate a page with, drilled into from the Translation page.
 * The community link lives here rather than on the row, which cannot hold a link of its own —
 * the whole row is already one.
 */
export function PersonalizedPromptsPage() {
  const insertCells = WEB_PAGE_PROMPT_TOKENS.map((token) => ({
    text: getTokenCellText(token),
    description: i18n.t(
      `options.translation.personalizedPrompts.editPrompt.promptCellInput.${token}`,
    ),
  }))

  return (
    <PageLayout
      title={i18n.t("options.translation.title")}
      description={i18n.t("options.translation.pageDescription")}
    >
      <ConfigDetailSection
        backTo="/page-translation"
        title={
          <span id="personalized-prompts">
            {i18n.t("options.translation.personalizedPrompts.title")}
          </span>
        }
      >
        <div className="flex justify-start">
          <a
            href={i18n.t("options.translation.personalizedPrompts.communityPromptsUrl")}
            target="_blank"
            rel="noreferrer noopener"
            className="text-xs text-link hover:opacity-90"
          >
            {i18n.t("options.translation.personalizedPrompts.communityPrompts")}
          </a>
        </div>
        <PromptManager promptAtoms={promptAtoms} insertCells={insertCells} />
      </ConfigDetailSection>
    </PageLayout>
  )
}
