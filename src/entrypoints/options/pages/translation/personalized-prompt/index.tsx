import { i18n } from "#imports"
import { PromptConfigurator } from "@/components/prompt-configurator"
import { promptAtoms } from "./atoms"

export function PersonalizedPrompts() {
  return (
    <PromptConfigurator
      promptAtoms={promptAtoms}
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
