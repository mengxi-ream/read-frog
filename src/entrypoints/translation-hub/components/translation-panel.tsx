import { Icon } from '@iconify/react'
import { useAtomValue } from 'jotai'
import { selectedProviderIdsAtom } from '../atoms'
import { TranslationCard } from './translation-card'

export function TranslationPanel() {
  const selectedProviderIds = useAtomValue(selectedProviderIdsAtom)

  if (selectedProviderIds.length === 0) {
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
      {selectedProviderIds.map(id => (
        <TranslationCard key={id} providerId={id} />
      ))}
    </div>
  )
}
