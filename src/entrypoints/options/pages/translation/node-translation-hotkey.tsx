import { i18n } from '#imports'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { HOTKEY_ICONS, HOTKEYS } from '@/utils/constants/hotkeys'
import { ConfigCard } from '../../components/config-card'

export function NodeTranslationHotkey() {
  const [translateConfig, setTranslateConfig] = useAtom(
    configFieldsAtomMap.translate,
  )

  return (
    <ConfigCard
      title={i18n.t('options.translation.nodeTranslationHotkey.title')}
      description={i18n.t('options.translation.nodeTranslationHotkey.description')}
    >
      <Select
        value={translateConfig.node.hotkey}
        onValueChange={(value: typeof HOTKEYS[number]) =>
          setTranslateConfig(
            deepmerge(translateConfig, { node: { hotkey: value } }),
          )}
      >
        <SelectTrigger className="w-full">
          <SelectValue asChild>
            <span>
              {HOTKEY_ICONS[translateConfig.node.hotkey]}
              {' '}
              {i18n.t(`hotkey.${translateConfig.node.hotkey}`)}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {HOTKEYS.map(item => (
              <SelectItem key={item} value={item}>
                {HOTKEY_ICONS[item]}
                {' '}
                {i18n.t(`hotkey.${item}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </ConfigCard>
  )
}
