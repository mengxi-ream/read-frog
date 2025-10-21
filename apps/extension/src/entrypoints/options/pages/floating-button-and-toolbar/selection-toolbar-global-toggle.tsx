import { i18n } from '#imports'
import { Switch } from '@repo/ui/components/switch'
import { useAtom } from 'jotai'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

export function SelectionToolbarGlobalToggle() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(
    configFieldsAtomMap.selectionToolbar,
  )

  return (
    <ConfigCard
      title={i18n.t('options.floatingButtonAndToolbar.selectionToolbar.globalToggle.title')}
      description={i18n.t('options.floatingButtonAndToolbar.selectionToolbar.globalToggle.description')}
    >
      <div className="w-full flex justify-end">
        <Switch
          checked={selectionToolbar.enabled}
          onCheckedChange={(checked) => {
            void setSelectionToolbar({ ...selectionToolbar, enabled: checked })
          }}
        />
      </div>
    </ConfigCard>
  )
}
