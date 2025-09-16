import type { APIProviderConfig } from '@/types/config/provider'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { Button } from '@repo/ui/components/button'
import { Dialog, DialogTrigger } from '@repo/ui/components/dialog'
import { Switch } from '@repo/ui/components/switch'
import { cn } from '@repo/ui/lib/utils'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useState } from 'react'
import ProviderIcon from '@/components/provider-icon'
import { configFields } from '@/utils/atoms/config'
import { providerConfigAtom } from '@/utils/atoms/provider'
import { getAPIProvidersConfig } from '@/utils/config/helpers'
import { API_PROVIDER_ITEMS } from '@/utils/constants/providers'
import { isDarkMode } from '@/utils/tailwind'
import { ConfigCard } from '../../components/config-card'
import AddProviderDialog from './add-provider-dialog'
import { selectedProviderIdAtom } from './atoms'
import { ProviderConfigForm } from './provider-config-form'

export function ProvidersConfig() {
  return (
    <ConfigCard
      title={i18n.t('options.apiProviders.title')}
      description={i18n.t('options.apiProviders.description')}
      className="lg:flex-col"
    >
      <div className="flex gap-4">
        <ProviderCardList />
        <ProviderConfigForm />
      </div>
    </ConfigCard>
  )
}

function ProviderCardList() {
  const providersConfig = useAtomValue(configFields.providersConfig)
  const apiProvidersConfig = getAPIProvidersConfig(providersConfig)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  return (
    <div className="w-40 lg:w-52 flex flex-col gap-4">
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="h-auto p-3 border-dashed rounded-lg"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <div className="flex items-center justify-center gap-2 w-full">
              <Icon icon="tabler:plus" className="size-4" />
              <span className="text-sm">Add Provider</span>
            </div>
          </Button>
        </DialogTrigger>
        <AddProviderDialog onClose={() => setIsAddDialogOpen(false)} />
      </Dialog>
      {apiProvidersConfig.map(providerConfig => (
        <ProviderCard key={providerConfig.name} providerConfig={providerConfig} />
      ))}
    </div>
  )
}

function ProviderCard({ providerConfig }: { providerConfig: APIProviderConfig }) {
  const { id, name, provider, enabled } = providerConfig

  const [selectedProviderId, setSelectedProviderId] = useAtom(selectedProviderIdAtom)
  const setProviderConfig = useSetAtom(providerConfigAtom(id))

  return (
    <div
      className={cn('rounded-xl p-3 border bg-card cursor-pointer', selectedProviderId === id && 'border-primary')}
      onClick={() => setSelectedProviderId(id)}
    >
      <div className="flex items-center justify-between gap-2">
        <ProviderIcon logo={API_PROVIDER_ITEMS[provider].logo(isDarkMode())} name={name} size="base" textClassName="text-sm" />
        <Switch checked={enabled} onCheckedChange={checked => setProviderConfig({ ...providerConfig, enabled: checked })} />
      </div>
    </div>
  )
}
