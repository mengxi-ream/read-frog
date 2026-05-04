import type { APIProviderConfig } from "@/types/config/provider"
import { i18n } from "#imports"
import { useStore } from "@tanstack/react-form"
import { useCallback } from "react"
import { HelpTooltip } from "@/components/help-tooltip"
import { isLLMProviderConfig } from "@/types/config/provider"
import { resolveModelId } from "@/utils/providers/model-id"
import { getRecommendedProviderOptions } from "@/utils/providers/options"
import { AutosavedJsonCodeEditorField } from "./components/autosaved-json-code-editor-field"
import { withForm } from "./form"

function parseJson(input: string): { valid: true, value: Record<string, unknown> | undefined } | { valid: false, error: string } {
  if (!input.trim()) {
    return { valid: true, value: undefined }
  }
  try {
    return { valid: true, value: JSON.parse(input) }
  }
  catch {
    return { valid: false, error: i18n.t("options.apiProviders.form.invalidJson") }
  }
}

function toJson(options: APIProviderConfig["providerOptions"]) {
  return options ? JSON.stringify(options, null, 2) : ""
}

export const ProviderOptionsField = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerConfig = useStore(form.store, state => state.values)
    const isLLMProvider = isLLMProviderConfig(providerConfig)

    const handleProviderOptionsCommit = useCallback((value: Record<string, unknown> | undefined) => {
      form.setFieldValue("providerOptions", value)
    }, [form])

    const handleSubmit = useCallback(() => form.handleSubmit(), [form])

    if (!isLLMProvider) {
      return null
    }

    const modelId = resolveModelId(providerConfig.model)
    const placeholderText = (() => {
      const recommendedOptions = getRecommendedProviderOptions(modelId ?? "")
      return recommendedOptions
        ? JSON.stringify(recommendedOptions, null, 2)
        : JSON.stringify({ field: "value" }, null, 2)
    })()

    return (
      <AutosavedJsonCodeEditorField
        value={providerConfig.providerOptions}
        resetKey={providerConfig.id}
        syncSignal={providerConfig.providerOptions}
        parse={parseJson}
        serialize={toJson}
        onCommit={handleProviderOptionsCommit}
        onSubmit={handleSubmit}
        editorAriaLabel="provider-options-editor"
        placeholder={placeholderText}
        label={(
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5">
              <span>{i18n.t("options.apiProviders.form.providerOptions")}</span>
              <HelpTooltip>{i18n.t("options.apiProviders.form.providerOptionsHint")}</HelpTooltip>
            </div>
            <a
              href="https://ai-sdk.dev/providers/ai-sdk-providers"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-link hover:opacity-90"
            >
              {i18n.t("options.apiProviders.form.providerOptionsDocsLink")}
            </a>
          </div>
        )}
      />
    )
  },
})
