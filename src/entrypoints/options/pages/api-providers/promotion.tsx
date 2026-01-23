import { i18n } from '#imports'
import { useAtom, useSetAtom } from 'jotai'
import { Button } from '@/components/base-ui/button'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { cn } from '@/utils/styles/utils'
import { selectedProviderIdAtom } from './atoms'
import { addProvider } from './utils'

export default function Promotion({ className }: { className?: string }) {
  const [providersConfig, setProvidersConfig] = useAtom(configFieldsAtomMap.providersConfig)
  const setSelectedProviderId = useSetAtom(selectedProviderIdAtom)

  const handleAddAI302Provider = async () => {
    await addProvider('ai302', providersConfig, setProvidersConfig, setSelectedProviderId)
  }

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <p className="text-sm text-muted-foreground">{i18n.t('options.apiProviders.promotion.ai302.description')}</p>
      <div className="flex items-center gap-2">
        <Button
          render={<a href="https://share.302.ai/8o2r7P" target="_blank" rel="noreferrer noopener" />}
          size="sm"
          className="bg-yellow-500 hover:bg-yellow-500/90"
        >
          {i18n.t('options.apiProviders.promotion.ai302.action')}
        </Button>
        <Button size="sm" variant="outline" onClick={handleAddAI302Provider} className="text-black dark:text-white">
          {i18n.t('options.apiProviders.promotion.ai302.addProvider')}
        </Button>
      </div>
    </div>
  )
}
