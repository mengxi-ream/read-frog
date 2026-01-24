import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { useMutation } from '@tanstack/react-query'
import { useAtom, useAtomValue } from 'jotai'
import { useEffect, useEffectEvent, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/base-ui/button'
import ProviderIcon from '@/components/provider-icon'
import { useTheme } from '@/components/providers/theme-provider'
import { cn } from '@/lib/utils'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { getProviderConfigById } from '@/utils/config/helpers'
import { PROVIDER_ITEMS } from '@/utils/constants/providers'
import { executeTranslate } from '@/utils/host/translate/execute-translate'
import { selectedProviderIdsAtom, translateRequestAtom } from '../atoms'

interface TranslationCardProps {
  providerId: string
}

export function TranslationCard({ providerId }: TranslationCardProps) {
  const { theme } = useTheme()
  const request = useAtomValue(translateRequestAtom)
  const language = useAtomValue(configFieldsAtomMap.language)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const [selectedProviderIds, setSelectedProviderIds] = useAtom(selectedProviderIdsAtom)

  const provider = getProviderConfigById(providersConfig, providerId)
  const providerItem = provider ? PROVIDER_ITEMS[provider.provider as keyof typeof PROVIDER_ITEMS] : undefined

  // Track request IDs to ignore stale responses from slow providers
  const requestIdRef = useRef(0)

  const mutation = useMutation({
    mutationKey: ['translate', providerId],
    meta: { suppressToast: true },
    mutationFn: async (req: NonNullable<typeof request>) => {
      if (!provider)
        throw new Error('Provider not found')

      const myRequestId = ++requestIdRef.current
      const result = await executeTranslate(req.inputText, {
        sourceCode: req.sourceLanguage,
        targetCode: req.targetLanguage,
        level: language.level,
      }, provider)

      // Ignore stale responses - return undefined to silently discard
      if (requestIdRef.current !== myRequestId) {
        return undefined
      }

      return result
    },
  })

  // Trigger translation when request changes
  const triggerTranslation = useEffectEvent(() => {
    if (request?.inputText.trim()) {
      mutation.mutate(request)
    }
  })

  useEffect(() => {
    triggerTranslation()
  }, [request?.timestamp])

  const handleCopy = () => {
    if (mutation.data) {
      void navigator.clipboard.writeText(mutation.data)
      toast.success(i18n.t('translationHub.copiedToClipboard'))
    }
  }

  const handleRemove = () => {
    setSelectedProviderIds(selectedProviderIds.filter(id => id !== providerId))
  }

  if (!provider)
    return null

  const hasContent = mutation.isError || (mutation.data !== undefined && mutation.data !== '')

  return (
    <div className="border rounded-lg bg-card">
      <div className={cn('flex items-center justify-between px-3 py-2', hasContent && 'border-b')}>
        <div className="flex items-center space-x-2">
          {providerItem
            ? (
                <ProviderIcon
                  logo={providerItem.logo(theme)}
                  name={provider.name}
                  size="sm"
                />
              )
            : (
                <div className="w-5 h-5 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                  ?
                </div>
              )}
        </div>
        <div className="flex items-center space-x-1">
          {mutation.isPending && (
            <Icon icon="tabler:loader-2" className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {mutation.data && !mutation.isPending && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              className="h-7 w-7"
              title={i18n.t('translationHub.copyTranslation')}
            >
              <Icon icon="tabler:copy" className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            className="h-7 w-7"
            title={i18n.t('translationHub.deleteCard')}
          >
            <Icon icon="tabler:x" className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {hasContent && (
        <div className="p-3">
          {mutation.isError
            ? (
                <div>
                  <div className="flex items-center space-x-2 text-destructive mb-1">
                    <Icon icon="tabler:alert-circle" className="h-4 w-4" />
                    <span className="text-sm font-medium">{i18n.t('translationHub.translationFailed')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {mutation.error instanceof Error ? mutation.error.message : i18n.t('translationHub.translationFailedFallback')}
                  </p>
                </div>
              )
            : (
                <div
                  key={mutation.data}
                  className="text-base leading-relaxed whitespace-pre-wrap animate-in fade-in duration-300"
                >
                  {mutation.data}
                </div>
              )}
        </div>
      )}
    </div>
  )
}
