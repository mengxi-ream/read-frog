import { i18n } from '#imports'
import { Switch } from '@repo/ui/components/switch'
import { useAtom } from 'jotai'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

export function FloatingButtonGlobalToggle() {
  const [floatingButton, setFloatingButton] = useAtom(
    configFieldsAtomMap.floatingButton,
  )

  return (
    <ConfigCard
      title={i18n.t('options.floatingButtonAndToolbar.floatingButton.globalToggle.title')}
      description={i18n.t('options.floatingButtonAndToolbar.floatingButton.globalToggle.description')}
    >
      <div className="w-full flex justify-end">
        <Switch
          checked={floatingButton.enabled}
          onCheckedChange={(checked) => {
            void setFloatingButton({ ...floatingButton, enabled: checked })
          }}
        />
      </div>
    </ConfigCard>
  )
}
