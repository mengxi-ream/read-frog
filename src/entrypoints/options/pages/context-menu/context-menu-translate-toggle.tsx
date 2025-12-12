import { i18n } from '#imports'
import { useAtom } from 'jotai'
import { Switch } from '@/components/shadcn/switch'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

export function ContextMenuTranslateToggle() {
  const [contextMenu, setContextMenu] = useAtom(
    configFieldsAtomMap.contextMenu,
  )

  return (
    <ConfigCard
      title={i18n.t('options.floatingButtonAndToolbar.contextMenu.translate.title')}
      description={i18n.t('options.floatingButtonAndToolbar.contextMenu.translate.description')}
    >
      <div className="w-full flex justify-end">
        <Switch
          checked={contextMenu.enabled}
          onCheckedChange={(checked) => {
            void setContextMenu({ ...contextMenu, enabled: checked })
          }}
        />
      </div>
    </ConfigCard>
  )
}
