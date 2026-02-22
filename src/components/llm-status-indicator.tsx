import { i18n } from '#imports'

interface LLMStatusIndicatorProps {
  hasLLMProvider: boolean
  featureName: string
}

export function LLMStatusIndicator({ hasLLMProvider, featureName }: LLMStatusIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5 mt-2">
      <div className={`size-2 rounded-full ${hasLLMProvider ? 'bg-green-500' : 'bg-orange-400'}`} />
      <span className="text-xs">
        {hasLLMProvider
          ? i18n.t('options.translation.llmProviderConfigured', [featureName])
          : i18n.t('options.translation.llmProviderNotConfigured', [featureName])}
      </span>
    </div>
  )
}
