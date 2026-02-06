import { i18n } from '#imports'
import { useAtom } from 'jotai'
import { useId } from 'react'
import { Switch } from '@/components/ui/base-ui/switch'
import { configFieldsAtomMap } from '@/utils/atoms/config'

export default function SelectionToolbar() {
  const labelId = useId()
  const [selectionToolbar, setSelectionToolbar] = useAtom(
    configFieldsAtomMap.selectionToolbar,
  )

  return (
    <div className="flex items-center justify-between gap-2">
      <span id={labelId} className="text-[13px] font-medium">
        {i18n.t('popup.enabledSelectionToolbar')}
      </span>
      <Switch
        checked={selectionToolbar.enabled}
        aria-labelledby={labelId}
        onCheckedChange={(checked) => {
          void setSelectionToolbar({ ...selectionToolbar, enabled: checked })
        }}
      />
    </div>
  )
}
