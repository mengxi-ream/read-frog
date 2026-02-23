import type { APIProviderConfig } from '@/types/config/provider'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { useStore } from '@tanstack/react-form'
import { useAtomValue, useSetAtom } from 'jotai'
import { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/base-ui/collapsible'
import { Switch } from '@/components/ui/base-ui/switch'
import { configAtom, writeConfigAtom } from '@/utils/atoms/config'
import { buildFeatureProviderPatch, FEATURE_KEY_I18N_MAP, FEATURE_KEYS, FEATURE_PROVIDER_DEFS } from '@/utils/constants/feature-providers'
import { cn } from '@/utils/styles/utils'
import { withForm } from './form'

export const FeatureProviderSection = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerType = useStore(form.store, state => state.values.provider)
    const providerId = useStore(form.store, state => state.values.id)
    const config = useAtomValue(configAtom)
    const setConfig = useSetAtom(writeConfigAtom)
    const [isOpen, setIsOpen] = useState(false)

    const compatibleFeatures = FEATURE_KEYS
      .filter(featureKey => FEATURE_PROVIDER_DEFS[featureKey].isProvider(providerType))

    if (compatibleFeatures.length === 0)
      return null

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer py-2">
          <Icon
            icon="tabler:chevron-right"
            className={cn(
              'size-4 transition-transform duration-200',
              isOpen && 'rotate-90',
            )}
          />
          <span>{i18n.t('options.apiProviders.form.featureProviders')}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-3">
            {compatibleFeatures.map((featureKey) => {
              const def = FEATURE_PROVIDER_DEFS[featureKey]
              const isAssigned = def.getProviderId(config) === providerId
              return (
                <div key={featureKey} className="flex items-center gap-2">
                  <Switch
                    checked={isAssigned}
                    disabled={isAssigned}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        const patch = buildFeatureProviderPatch({ [featureKey]: providerId })
                        void setConfig(patch)
                      }
                    }}
                  />
                  <span className="text-sm">
                    {i18n.t(`options.general.featureProviders.features.${FEATURE_KEY_I18N_MAP[featureKey]}`)}
                  </span>
                </div>
              )
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  },
})
