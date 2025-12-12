import { i18n } from '#imports'
import { useAtom } from 'jotai'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

export function FloatingButtonClickAction() {
  const [floatingButton, setFloatingButton] = useAtom(
    configFieldsAtomMap.floatingButton,
  )

  return (
    <ConfigCard
      title={i18n.t('options.floatingButtonAndToolbar.floatingButton.clickAction.title')}
      description={i18n.t('options.floatingButtonAndToolbar.floatingButton.clickAction.description')}
    >
      <div className="w-full flex justify-end">
        <Select
          value={floatingButton.clickAction}
          onValueChange={(value: 'panel' | 'translate') => {
            void setFloatingButton({ ...floatingButton, clickAction: value })
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="panel">
              {i18n.t('options.floatingButtonAndToolbar.floatingButton.clickAction.panel')}
            </SelectItem>
            <SelectItem value="translate">
              {i18n.t('options.floatingButtonAndToolbar.floatingButton.clickAction.translate')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </ConfigCard>
  )
}
