import { i18n } from '#imports'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/shadcn/select'
import { Switch } from '@/components/shadcn/switch'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { HOTKEY_ICONS, HOTKEYS } from '@/utils/constants/hotkeys'

function HotkeyDisplay({ hotkey }: { hotkey: typeof HOTKEYS[number] }) {
  const icon = HOTKEY_ICONS[hotkey]
  const label = i18n.t(`hotkey.${hotkey}`)

  if (hotkey === 'clickAndHold') {
    return (
      <>
        {icon}
        {' '}
        {label}
        {' '}
        {i18n.t('popup.translateParagraph')}
      </>
    )
  }

  return (
    <>
      {i18n.t('popup.hover')}
      {' '}
      +
      {' '}
      {icon}
      {' '}
      {label}
      {' '}
      {i18n.t('popup.translateParagraph')}
    </>
  )
}

export default function NodeTranslationHotkeySelector() {
  const [translateConfig, setTranslateConfig] = useAtom(
    configFieldsAtomMap.translate,
  )

  return (
    <div className="flex items-center justify-between gap-2">
      <Select
        value={translateConfig.node.hotkey}
        onValueChange={(value: typeof HOTKEYS[number]) => setTranslateConfig(deepmerge(translateConfig, { node: { hotkey: value } }))}
      >
        <SelectTrigger
          size="sm"
          className="pt-3.5 -mt-3.5 pb-4 -mb-4 px-2 -ml-2 h-5! ring-none cursor-pointer truncate border-none text-[13px] font-medium shadow-none focus-visible:border-none focus-visible:ring-0 bg-transparent rounded-md"
        >
          <div className="truncate">
            <HotkeyDisplay hotkey={translateConfig.node.hotkey} />
          </div>
        </SelectTrigger>
        <SelectContent>
          {HOTKEYS.map(item => (
            <SelectItem key={item} value={item}>
              <HotkeyDisplay hotkey={item} />
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
