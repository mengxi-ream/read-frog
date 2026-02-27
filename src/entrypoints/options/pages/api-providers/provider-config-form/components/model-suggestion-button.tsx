import { i18n } from "#imports"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { Icon } from "@iconify/react"
import { useMutation } from "@tanstack/react-query"
import LoadingDots from "@/components/loading-dots"
import { Button } from "@/components/ui/base-ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/base-ui/combobox"
import { extractErrorMessage } from "@/utils/api-error"

interface ModelsResponse {
  object: string
  data: Array<{ id: string, object: string, created: number, owned_by: string }>
}

interface ModelSuggestionButtonProps {
  baseURL: string
  apiKey?: string
  onSelect: (model: string) => void
  disabled?: boolean
}

export function ModelSuggestionButton({
  baseURL,
  apiKey,
  onSelect,
  disabled,
}: ModelSuggestionButtonProps) {
  const mutation = useMutation({
    mutationKey: ["fetchModels", baseURL],
    meta: {
      errorDescription: i18n.t("options.apiProviders.form.models.fetchError"),
    },
    mutationFn: async () => {
      if (!apiKey) {
        throw new Error(i18n.t("options.apiProviders.form.models.apiKeyRequired"))
      }

      const response = await fetch(`${baseURL}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!response.ok) {
        throw new Error(await extractErrorMessage(response))
      }

      const data: ModelsResponse = await response.json()
      return data.data.map(m => m.id)
    },
  })

  const handleFetch = () => {
    if (!baseURL)
      return
    mutation.reset()
    mutation.mutate()
  }

  const isDisabled = disabled || !baseURL

  // Idle state - show fetch button
  if (mutation.isIdle) {
    return (
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={handleFetch}
        disabled={isDisabled}
      >
        <Icon icon="tabler:list-search" className="size-3.5" />
        {i18n.t("options.apiProviders.form.models.fetchModels")}
      </Button>
    )
  }

  // Loading state
  if (mutation.isPending) {
    return (
      <Button type="button" variant="outline" size="xs" disabled>
        <LoadingDots className="scale-75" />
        {i18n.t("options.apiProviders.form.models.fetchModels")}
      </Button>
    )
  }

  // Error state - show error button with retry option
  if (mutation.isError) {
    return (
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={handleFetch}
        className="text-red-500 hover:text-red-500"
      >
        <Icon icon="tabler:alert-circle" className="size-3.5" />
        {i18n.t("options.apiProviders.form.models.clickToRetry")}
      </Button>
    )
  }

  // Success state - show popover with model list
  if (mutation.isSuccess) {
    const models = mutation.data ?? []

    if (models.length === 0) {
      return (
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={handleFetch}
        >
          <Icon icon="tabler:list" />
          {i18n.t("options.apiProviders.form.models.noModels")}
        </Button>
      )
    }

    return (
      <Combobox
        items={models}
        defaultOpen
        onValueChange={(model: string | null) => {
          if (model)
            onSelect(model)
        }}
      >
        <ComboboxPrimitive.Trigger render={<Button type="button" variant="outline" size="xs" />}>
          <Icon icon="tabler:list" />
          {i18n.t("options.apiProviders.form.models.selectModel")}
        </ComboboxPrimitive.Trigger>
        <ComboboxContent align="end" className="w-64">
          <ComboboxInput showTrigger={false} placeholder={i18n.t("options.apiProviders.form.models.searchModels")} />
          <ComboboxList>
            {(model: string) => (
              <ComboboxItem key={model} value={model}>
                {model}
              </ComboboxItem>
            )}
          </ComboboxList>
          <ComboboxEmpty>{i18n.t("options.apiProviders.form.models.noModelsFound")}</ComboboxEmpty>
        </ComboboxContent>
      </Combobox>
    )
  }

  return null
}
