import type { APIProviderConfig } from "@/types/config/provider"
import { i18n } from "#imports"
import { useStore } from "@tanstack/react-form"
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { HelpTooltip } from "@/components/help-tooltip"
import { Field, FieldError, FieldLabel } from "@/components/ui/base-ui/field"
import { JSONCodeEditor } from "@/components/ui/json-code-editor"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { isLLMProviderConfig } from "@/types/config/provider"
import { resolveModelId } from "@/utils/providers/model-id"
import { getRecommendedProviderOptions } from "@/utils/providers/options"
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

export const ProviderOptionsField = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerConfig = useStore(form.store, state => state.values)
    const isLLMProvider = isLLMProviderConfig(providerConfig)

    const toJson = useCallback(
      (options: APIProviderConfig["providerOptions"]) => options ? JSON.stringify(options, null, 2) : "",
      [],
    )
    const externalJson = toJson(providerConfig.providerOptions)

    // Local state for the JSON string input
    const [jsonInput, setJsonInput] = useState(() => externalJson)
    const lastCommittedJsonRef = useRef(externalJson)
    const pendingEditorCommitRef = useRef(false)

    const syncJsonInput = useEffectEvent((nextJson: string) => {
      // eslint-disable-next-line react/set-state-in-effect
      setJsonInput(nextJson)
    })

    const resetSyncStateForProvider = useEffectEvent(() => {
      lastCommittedJsonRef.current = externalJson
      pendingEditorCommitRef.current = false
      syncJsonInput(externalJson)
    })

    const readJsonInput = useEffectEvent(() => {
      return jsonInput
    })

    useEffect(() => {
      resetSyncStateForProvider()
    }, [providerConfig.id])

    useEffect(() => {
      if (pendingEditorCommitRef.current && externalJson === lastCommittedJsonRef.current) {
        pendingEditorCommitRef.current = false
        return
      }

      pendingEditorCommitRef.current = false
      lastCommittedJsonRef.current = externalJson

      if (readJsonInput() !== externalJson) {
        syncJsonInput(externalJson)
      }
    }, [providerConfig.providerOptions, externalJson])

    // Debounce the input value
    const debouncedJsonInput = useDebouncedValue(jsonInput, 500)

    // Derive parse result from debounced value
    const parseResult = useMemo(() => parseJson(debouncedJsonInput), [debouncedJsonInput])

    // Submit when debounced value changes and is valid
    useEffect(() => {
      if (parseResult.valid) {
        const normalizedJson = toJson(parseResult.value)
        if (normalizedJson === lastCommittedJsonRef.current) {
          return
        }

        lastCommittedJsonRef.current = normalizedJson
        pendingEditorCommitRef.current = true
        form.setFieldValue("providerOptions", parseResult.value)
        void form.handleSubmit()
      }
    }, [parseResult, form, toJson])

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
    const jsonError = !parseResult.valid ? parseResult.error : null

    return (
      <Field>
        <FieldLabel>
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
        </FieldLabel>
        <JSONCodeEditor
          value={jsonInput}
          onChange={setJsonInput}
          placeholder={placeholderText}
          hasError={!!jsonError}
          height="150px"
        />
        {jsonError && (
          <FieldError>{jsonError}</FieldError>
        )}
      </Field>
    )
  },
})
