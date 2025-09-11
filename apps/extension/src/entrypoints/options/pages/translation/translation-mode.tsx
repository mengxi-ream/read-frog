import type { TranslationMode as TranslationModeType } from '@/types/config/translate'
import { i18n } from '#imports'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import { TRANSLATION_MODES } from '@/types/config/translate'
import { configFields } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

export function TranslationMode() {
  return (
    <ConfigCard title={i18n.t('options.translation.translationMode.title')} description={i18n.t('options.translation.translationMode.description')}>
      <TranslationModeSelector />
    </ConfigCard>
  )
}

function TranslationModeSelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFields.translate)
  const currentMode = translateConfig.mode

  return (
    <div className="w-full flex justify-start md:justify-end">
      <Select
        value={currentMode}
        onValueChange={(mode: TranslationModeType) =>
          setTranslateConfig(
            deepmerge(translateConfig, { mode }),
          )}
      >
        <SelectTrigger className="w-40">
          <SelectValue asChild>
            <span>
              {i18n.t(`options.translation.translationMode.mode.${currentMode}`)}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {TRANSLATION_MODES.map(mode => (
              <SelectItem key={mode} value={mode}>
                {i18n.t(`options.translation.translationMode.mode.${mode}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
