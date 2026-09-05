import type { APIProviderConfig } from "@/types/config/provider"
import { useSelector } from "@tanstack/react-store"
import { useCallback } from "react"
import { HelpTooltip } from "@/components/help-tooltip"
import { isLLMProviderConfig } from "@/types/config/provider"
import { i18n } from "@/utils/i18n"
import { AutosavedJsonCodeEditorField } from "./components/autosaved-json-code-editor-field"
import { withForm } from "./form"

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseHeadersJson(
  input: string,
): { valid: true; value: Record<string, unknown> | undefined } | { valid: false; error: string } {
  if (!input.trim()) {
    return { valid: true, value: undefined }
  }

  try {
    const parsed = JSON.parse(input)
    if (!isPlainObject(parsed)) {
      return { valid: false, error: i18n.t("options.apiProviders.form.invalidJson") }
    }

    if (Object.values(parsed).some((value) => typeof value !== "string")) {
      return { valid: false, error: i18n.t("options.apiProviders.form.invalidJson") }
    }

    return { valid: true, value: parsed }
  } catch {
    return { valid: false, error: i18n.t("options.apiProviders.form.invalidJson") }
  }
}

function toJson(headers: APIProviderConfig["headers"]) {
  return headers ? JSON.stringify(headers, null, 2) : ""
}

const EXAMPLE_HEADERS_PLACEHOLDER = {
  "X-Custom-Header": "value",
}

export const ProviderHeadersField = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerConfig = useSelector(form.store, (state) => state.values)
    const isLLMProvider = isLLMProviderConfig(providerConfig)

    const handleHeadersCommit = useCallback(
      (value: Record<string, unknown> | undefined) => {
        form.setFieldValue("headers", value)
      },
      [form],
    )

    if (!isLLMProvider) {
      return null
    }

    // Only ever an example now: headers a provider starts with are seeded into its config, so
    // they show up as real editable values rather than as a hint the user has to retype. Forced
    // headers are deliberately absent — they are sent regardless, and offering them here would
    // invite edits that go nowhere.
    const placeholderText = JSON.stringify(EXAMPLE_HEADERS_PLACEHOLDER, null, 2)

    return (
      <AutosavedJsonCodeEditorField
        value={providerConfig.headers}
        fieldName="headers"
        parse={parseHeadersJson}
        serialize={toJson}
        onCommit={handleHeadersCommit}
        editorAriaLabel="provider-headers-editor"
        placeholder={placeholderText}
        label={
          <div className="flex items-center gap-1.5">
            <span>{i18n.t("options.apiProviders.form.headers")}</span>
            <HelpTooltip>{i18n.t("options.apiProviders.form.headersHint")}</HelpTooltip>
          </div>
        }
      />
    )
  },
})
