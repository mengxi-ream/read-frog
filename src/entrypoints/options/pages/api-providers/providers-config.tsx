import type { APIProviderConfig } from '@/types/config/provider'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/base-ui/button'
import ProviderIcon from '@/components/provider-icon'
import { useTheme } from '@/components/providers/theme-provider'
import { Badge } from '@/components/shadcn/badge'
import { Dialog, DialogTrigger } from '@/components/shadcn/dialog'
import { Switch } from '@/components/shadcn/switch'
import { SortableList } from '@/components/sortable-list'
import { isAPIProviderConfig } from '@/types/config/provider'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { providerConfigAtom, readProviderConfigAtom, translateProviderConfigAtom } from '@/utils/atoms/provider'
import { getAPIProvidersConfig } from '@/utils/config/helpers'
import { API_PROVIDER_ITEMS } from '@/utils/constants/providers'
import { cn } from '@/utils/styles/utils'
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
  const [providersConfig, setProvidersConfig] = useAtom(configFieldsAtomMap.providersConfig)
  const apiProvidersConfig = getAPIProvidersConfig(providersConfig)
  const [selectedProviderId, setSelectedProviderId] = useAtom(selectedProviderIdAtom)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [canScroll, setCanScroll] = useState(false)
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true)
  const [isScrolledToTop, setIsScrolledToTop] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const didLockInitialSelectionRef = useRef(false)

  const handleReorder = (newList: APIProviderConfig[]) => {
    const desiredOrderIds = newList.map(provider => provider.id)
    const desiredOrderIdSet = new Set(desiredOrderIds)

    const nonApiProviders = providersConfig.filter(provider => !isAPIProviderConfig(provider))
    const currentApiProviders = providersConfig.filter(isAPIProviderConfig)

    const apiProvidersById = new Map(currentApiProviders.map(provider => [provider.id, provider] as const))

    const reorderedApiProviders: APIProviderConfig[] = []
    for (const id of desiredOrderIds) {
      const provider = apiProvidersById.get(id)
      if (provider)
        reorderedApiProviders.push(provider)
    }

    // Preserve any API providers that appeared while dragging (e.g. config sync)
    for (const provider of currentApiProviders) {
      if (!desiredOrderIdSet.has(provider.id)) {
        reorderedApiProviders.push(provider)
      }
    }

    void setProvidersConfig([...nonApiProviders, ...reorderedApiProviders])
  }

  useEffect(() => {
    if (didLockInitialSelectionRef.current)
      return
    if (selectedProviderId) {
      setSelectedProviderId(selectedProviderId)
      didLockInitialSelectionRef.current = true
    }
  }, [selectedProviderId, setSelectedProviderId])

  // Update scroll state when apiProvidersConfig changes
  useLayoutEffect(() => {
    const timeoutId = setTimeout(() => {
      const container = scrollContainerRef.current
      if (container) {
        const canScrollDown = container.scrollHeight > container.clientHeight
        const isAtBottom = Math.abs(container.scrollHeight - container.clientHeight - container.scrollTop) < 2
        const isAtTop = container.scrollTop < 2
        setCanScroll(canScrollDown)
        setIsScrolledToBottom(isAtBottom || !canScrollDown)
        setIsScrolledToTop(isAtTop)
      }
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [apiProvidersConfig])

  // Add scroll listener and resize observer
  useEffect(() => {
    const handleScroll = () => {
      const container = scrollContainerRef.current
      if (container) {
        const canScrollDown = container.scrollHeight > container.clientHeight
        const isAtBottom = Math.abs(container.scrollHeight - container.clientHeight - container.scrollTop) < 2
        const isAtTop = container.scrollTop < 2

        setCanScroll(canScrollDown)
        setIsScrolledToBottom(isAtBottom || !canScrollDown)
        setIsScrolledToTop(isAtTop)
      }
    }

    const container = scrollContainerRef.current
    if (container) {
      // Add scroll listener
      container.addEventListener('scroll', handleScroll)

      // Add resize observer to detect content changes
      const resizeObserver = new ResizeObserver(() => {
        handleScroll()
      })
      resizeObserver.observe(container)

      // Call once to set initial state
      const timeoutId = setTimeout(handleScroll, 50)

      return () => {
        clearTimeout(timeoutId)
        container.removeEventListener('scroll', handleScroll)
        resizeObserver.disconnect()
      }
    }
  }, [])

  return (
    <div className="w-40 lg:w-52 flex flex-col gap-4">
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="h-auto p-3 border-dashed rounded-xl"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <div className="flex items-center justify-center gap-2 w-full">
              <Icon icon="tabler:plus" className="size-4" />
              <span className="text-sm">{i18n.t('options.apiProviders.addProvider')}</span>
            </div>
          </Button>
        </DialogTrigger>
        <AddProviderDialog onClose={() => setIsAddDialogOpen(false)} />
      </Dialog>
      <div className="relative">
        {canScroll && !isScrolledToTop && (
          <div className="absolute top-0 left-0 right-0 h-8 bg-linear-to-b from-background to-transparent flex items-center justify-center z-10 pointer-events-none">
            <Icon icon="tabler:chevron-up" className="size-4 text-muted-foreground animate-bounce" />
          </div>
        )}
        <div
          ref={scrollContainerRef}
          style={{ overflowAnchor: 'none' }}
          className="overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] max-h-[720px]"
        >
          <SortableList
            list={apiProvidersConfig}
            setList={handleReorder}
            className="flex flex-col gap-4 pt-2"
            renderItem={providerConfig => (
              <ProviderCard providerConfig={providerConfig} />
            )}
          />
        </div>
        {canScroll && !isScrolledToBottom && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-background to-transparent flex items-center justify-center pointer-events-none">
            <Icon icon="tabler:chevron-down" className="size-4 text-muted-foreground animate-bounce" />
          </div>
        )}
      </div>
    </div>
  )
}

function ProviderCard({ providerConfig }: { providerConfig: APIProviderConfig }) {
  const { id, name, provider, enabled } = providerConfig
  const { theme } = useTheme()
  const [selectedProviderId, setSelectedProviderId] = useAtom(selectedProviderIdAtom)
  const setProviderConfig = useSetAtom(providerConfigAtom(id))
  const translateProviderConfig = useAtomValue(translateProviderConfigAtom)
  const readProviderConfig = useAtomValue(readProviderConfigAtom)
  const isDefaultTranslateProvider = translateProviderConfig?.id === id
  const isDefaultReadProvider = readProviderConfig?.id === id

  return (
    <div
      className={cn(
        'rounded-xl p-3 border bg-card relative',
        selectedProviderId === id && 'border-primary',
      )}
      onClick={() => setSelectedProviderId(id)}
    >
      <div className="absolute -top-2 right-2 flex items-center justify-center gap-1">
        {isDefaultTranslateProvider && (
          <Badge className="bg-blue-500" size="sm">
            {i18n.t('options.apiProviders.badges.translate')}
          </Badge>
        )}
        {isDefaultReadProvider && (
          <Badge className="bg-blue-500" size="sm">
            {i18n.t('options.apiProviders.badges.read')}
          </Badge>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <ProviderIcon logo={API_PROVIDER_ITEMS[provider].logo(theme)} name={name} size="base" textClassName="text-sm" />
        <Switch
          checked={enabled}
          onCheckedChange={checked => setProviderConfig({ ...providerConfig, enabled: checked })}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        />
      </div>
    </div>
  )
}
