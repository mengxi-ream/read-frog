import { i18n } from "#imports"
import { PromptConfigurator } from "@/components/prompt-configurator"
import { getTokenCellText, WEB_PAGE_PROMPT_TOKENS } from "@/utils/constants/prompt"
import { promptAtoms } from "./atoms"

export function PersonalizedPrompts() {
  const insertCells = WEB_PAGE_PROMPT_TOKENS.map(token => ({
    text: getTokenCellText(token),
    description: i18n.t(`options.translation.personalizedPrompts.editPrompt.promptCellInput.${token}`),
  }))

  return (
    <PromptConfigurator
      id="personalized-prompts"
      promptAtoms={promptAtoms}
      insertCells={insertCells}
      title={i18n.t("options.translation.personalizedPrompts.title")}
      description={(
        <p>
          {i18n.t("options.translation.personalizedPrompts.description")}
          {" "}
          <a
            href={i18n.t("options.translation.personalizedPrompts.communityPromptsUrl")}
            target="_blank"
            rel="noreferrer noopener"
            className="text-link hover:underline"
          >
            {i18n.t("options.translation.personalizedPrompts.communityPrompts")}
          </a>
        </p>
      )}
    />
  )
}
