import type { APIProviderConfig } from '@/types/config/provider'
import { i18n } from '#imports'
import { useStore } from '@tanstack/react-form'
import { useAtom } from 'jotai'
import { Switch } from '@/components/ui/base-ui/switch'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { withForm } from './form'

export const DefaultTranslateProviderSelector = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerId = useStore(form.store, state => state.values.id)
    const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
    const isDefaultProvider = translateConfig.providerId === providerId

    return (
      <div className="flex items-center gap-2">
        <Switch
          disabled={isDefaultProvider}
          checked={isDefaultProvider}
          onCheckedChange={(checked) => {
            void setTranslateConfig({
              providerId: checked ? providerId : translateConfig.providerId,
            })
          }}
        />
        <span className="text-sm">{i18n.t('options.apiProviders.form.defaultProvider.translate')}</span>
      </div>
    )
  },
})

export const DefaultReadProviderSelector = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerId = useStore(form.store, state => state.values.id)
    const [readConfig, setReadConfig] = useAtom(configFieldsAtomMap.read)
    const isDefaultProvider = readConfig.providerId === providerId

    return (
      <div className="flex items-center gap-2">
        <Switch
          disabled={isDefaultProvider}
          checked={isDefaultProvider}
          onCheckedChange={(checked) => {
            void setReadConfig({
              providerId: checked ? providerId : readConfig.providerId,
            })
          }}
        />
        <span className="text-sm">{i18n.t('options.apiProviders.form.defaultProvider.read')}</span>
      </div>
    )
  },
})
