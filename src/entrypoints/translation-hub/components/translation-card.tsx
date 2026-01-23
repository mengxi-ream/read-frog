import type { TranslationResult } from '../types'
import { Icon } from '@iconify/react'
import { Button } from '@/components/base-ui/button'
import ProviderIcon from '@/components/provider-icon'
import { useTheme } from '@/components/providers/theme-provider'
import { PROVIDER_ITEMS } from '@/utils/constants/providers'

interface TranslationCardProps {
  result: TranslationResult
  onCopy: (text: string) => void
  onRemove: (id: string) => void
}

export function TranslationCard({ result, onCopy, onRemove }: TranslationCardProps) {
  const { theme } = useTheme()

  const handleCopy = () => {
    if (result.text) {
      onCopy(result.text)
    }
  }

  const hasContent = result.error || result.text
  const providerItem = PROVIDER_ITEMS[result.provider as keyof typeof PROVIDER_ITEMS]

  return (
    <div className="border rounded-lg bg-card">
      <div className={`flex items-center justify-between px-3 py-2 ${hasContent ? 'border-b' : ''}`}>
        <div className="flex items-center space-x-2">
          {providerItem
            ? (
                <ProviderIcon
                  logo={providerItem.logo(theme)}
                  name={result.name}
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
          {result.isLoading && (
            <Icon icon="tabler:loader-2" className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {result.text && !result.isLoading && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              className="h-7 w-7"
              title="Copy translation"
            >
              <Icon icon="tabler:copy" className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(result.id)}
            className="h-7 w-7"
            title="Delete card"
          >
            <Icon icon="tabler:x" className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {hasContent && (
        <div className="p-3">
          {result.error
            ? (
                <div>
                  <div className="flex items-center space-x-2 text-destructive mb-1">
                    <Icon icon="tabler:alert-circle" className="h-4 w-4" />
                    <span className="text-sm font-medium">Translation Failed</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{result.error}</p>
                </div>
              )
            : (
                <div
                  key={result.text}
                  className="text-base leading-relaxed whitespace-pre-wrap animate-in fade-in duration-300"
                >
                  {result.text}
                </div>
              )}
        </div>
      )}
    </div>
  )
}
