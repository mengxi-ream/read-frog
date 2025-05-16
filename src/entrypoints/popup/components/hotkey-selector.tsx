import type { Hotkey } from '@/types/config/config'

import deepmerge from 'deepmerge'
import { useAtom } from 'jotai'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { configFields } from '@/utils/atoms/config'
import { HOTKEY_ITEMS, HOTKEYS } from '@/utils/constants/config'

export default function HotkeySelector() {
  const [translateConfig, setTranslateConfig] = useAtom(
    configFields.translate,
  )

  return (
    <div className="flex items-center justify-between gap-2">
      <Select
        value={translateConfig.node.hotkey}
        onValueChange={(value: Hotkey) => setTranslateConfig(deepmerge(translateConfig, { node: { hotkey: value } }))}
      >
        <SelectTrigger
          size="sm"
          className="ring-none cursor-pointer truncate border-none bg-transparent pl-0 text-[13px] font-medium shadow-none hover:bg-transparent focus-visible:border-none focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent"
        >
          <div className="truncate">
            {i18n.t('popup.hover')}
            {' '}
            +
            {' '}
            {HOTKEY_ITEMS[translateConfig.node.hotkey].icon}
            {' '}
            {HOTKEY_ITEMS[translateConfig.node.hotkey].label}
            {' '}
            {i18n.t('popup.translateParagraph')}
          </div>
        </SelectTrigger>
        <SelectContent>
          {HOTKEYS.map(item => (
            <SelectItem key={item} value={item}>
              {i18n.t('popup.hover')}
              {' '}
              +
              {HOTKEY_ITEMS[item].icon}
              {' '}
              {HOTKEY_ITEMS[item].label}
              {' '}
              {i18n.t('popup.translateParagraph')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Switch
        checked={translateConfig.node.enabled}
        onCheckedChange={checked => setTranslateConfig(deepmerge(translateConfig, { node: { enabled: checked } }))}
      />
    </div>
  )
}
