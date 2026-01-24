import { Icon } from '@iconify/react'
import { useAtomValue } from 'jotai'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/shadcn/empty'
import { selectedProviderIdsAtom } from '../atoms'
import { TranslationCard } from './translation-card'

export function TranslationPanel() {
  const selectedProviderIds = useAtomValue(selectedProviderIdsAtom)

  if (selectedProviderIds.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon icon="tabler:language-off" className="size-6" />
          </EmptyMedia>
          <EmptyTitle>No Translation Services Selected</EmptyTitle>
          <EmptyDescription>
            Select translation services above to see translation cards here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
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
