import { Icon } from '@iconify/react'
import { useAtomValue } from 'jotai'
import { selectedServicesAtom, translationResultsAtom } from '../atoms'
import { TranslationCard } from './translation-card'

interface TranslationPanelProps {
  onCopy: (text: string) => void
  onRemove: (id: string) => void
}

export function TranslationPanel({ onCopy, onRemove }: TranslationPanelProps) {
  const results = useAtomValue(translationResultsAtom)
  const selectedServices = useAtomValue(selectedServicesAtom)

  // Create cards for all selected services, showing empty state if no result yet
  const displayCards = selectedServices.map(service =>
    results.find(r => r.id === service.id) ?? {
      id: service.id,
      name: service.name,
      provider: service.provider,
      isLoading: false,
    },
  )

  if (selectedServices.length === 0) {
    return (
      <div className="text-center py-16">
        <Icon icon="tabler:language-off" className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-medium text-foreground mb-2">No Translation Services Selected</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Select translation services above to see translation cards here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {displayCards.map(result => (
        <TranslationCard
          key={result.id}
          result={result}
          onCopy={onCopy}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}
