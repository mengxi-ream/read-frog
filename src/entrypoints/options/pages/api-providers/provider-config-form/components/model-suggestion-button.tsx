import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import LoadingDots from '@/components/loading-dots'
import { Button } from '@/components/shadcn/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/shadcn/popover'
import { extractErrorMessage } from '@/utils/api-error'

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
  const [open, setOpen] = useState(false)

  const mutation = useMutation({
    mutationKey: ['fetchModels', baseURL],
    meta: {
      errorDescription: i18n.t('options.apiProviders.form.models.fetchError'),
    },
    mutationFn: async () => {
      if (!apiKey) {
        throw new Error(i18n.t('options.apiProviders.form.models.apiKeyRequired'))
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
    onSuccess: (data) => {
      if (data && data.length > 0) {
        setOpen(true)
      }
    },
  })

  const handleFetch = () => {
    if (!baseURL)
      return
    mutation.reset()
    mutation.mutate()
  }

  const handleSelect = (model: string) => {
    onSelect(model)
    setOpen(false)
  }

  const isDisabled = disabled || !baseURL

  // Idle state - show fetch button
  if (mutation.isIdle) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleFetch}
        disabled={isDisabled}
      >
        <Icon icon="tabler:list-search" className="size-3.5" />
        {i18n.t('options.apiProviders.form.models.fetchModels')}
      </Button>
    )
  }

  // Loading state
  if (mutation.isPending) {
    return (
      <Button type="button" variant="outline" size="sm" disabled>
        <LoadingDots className="scale-75" />
        {i18n.t('options.apiProviders.form.models.fetchModels')}
      </Button>
    )
  }

  // Error state - show error button with retry option
  if (mutation.isError) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleFetch}
        className="text-red-500 hover:text-red-500"
      >
        <Icon icon="tabler:alert-circle" className="size-3.5" />
        {i18n.t('options.apiProviders.form.models.clickToRetry')}
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
          size="sm"
          onClick={handleFetch}
        >
          <Icon icon="tabler:list" />
          {i18n.t('options.apiProviders.form.models.noModels')}
        </Button>
      )
    }

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Icon icon="tabler:list" />
            {i18n.t('options.apiProviders.form.models.selectModel')}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-1 max-h-60 overflow-y-auto">
          {models.map(model => (
            <button
              key={model}
              type="button"
              onClick={() => handleSelect(model)}
              className="w-full min-w-0 rounded-sm py-1.5 px-2 text-left text-sm outline-hidden select-none hover:bg-ghost hover:text-ghost-foreground truncate"
            >
              {model}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    )
  }

  return null
}
