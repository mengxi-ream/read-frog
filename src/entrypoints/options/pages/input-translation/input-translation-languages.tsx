import type { LangCodeISO6393 } from '@read-frog/definitions'
import type { InputTranslationLang } from '@/types/config/config'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import {
  LANG_CODE_TO_EN_NAME,
  LANG_CODE_TO_LOCALE_NAME,
  langCodeISO6393Schema,
} from '@read-frog/definitions'
import { useAtom } from 'jotai'
import { Activity } from 'react'
import { Checkbox } from '@/components/shadcn/checkbox'
import { Label } from '@/components/shadcn/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

function langCodeLabel(langCode: LangCodeISO6393) {
  return `${LANG_CODE_TO_EN_NAME[langCode]} (${LANG_CODE_TO_LOCALE_NAME[langCode]})`
}

interface LangSelectProps {
  value: InputTranslationLang
  onValueChange: (value: InputTranslationLang) => void
  getDisplayLabel: (value: InputTranslationLang) => string
}

function LangSelect({ value, onValueChange, getDisplayLabel }: LangSelectProps) {
  return (
    <Select value={value} onValueChange={v => onValueChange(v as InputTranslationLang)}>
      <SelectTrigger className="w-full max-h-52 min-w-0">
        <SelectValue asChild>
          <span className="flex-1 min-w-0">
            <span className="block min-w-0 truncate">{getDisplayLabel(value)}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-64" align="end">
        <SelectItem value="targetCode">
          {getDisplayLabel('targetCode')}
        </SelectItem>
        <SelectItem value="sourceCode">
          {getDisplayLabel('sourceCode')}
        </SelectItem>
        {langCodeISO6393Schema.options.map(code => (
          <SelectItem key={code} value={code}>
            {langCodeLabel(code)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function InputTranslationLanguages() {
  const [inputTranslation, setInputTranslation] = useAtom(configFieldsAtomMap.inputTranslation)
  const [language] = useAtom(configFieldsAtomMap.language)

  const getDisplayLabel = (value: InputTranslationLang) => {
    if (value === 'sourceCode') {
      const label = i18n.t('options.inputTranslation.languages.sourceCode')
      if (language.sourceCode === 'auto') {
        return `${label} (auto)`
      }
      return `${label} (${langCodeLabel(language.sourceCode)})`
    }
    if (value === 'targetCode') {
      const label = i18n.t('options.inputTranslation.languages.targetCode')
      return `${label} (${langCodeLabel(language.targetCode)})`
    }
    return langCodeLabel(value)
  }

  const handleFromLangChange = (value: InputTranslationLang) => {
    void setInputTranslation({ ...inputTranslation, fromLang: value })
  }

  const handleToLangChange = (value: InputTranslationLang) => {
    void setInputTranslation({ ...inputTranslation, toLang: value })
  }

  const handleEnableCycleChange = (checked: boolean) => {
    void setInputTranslation({ ...inputTranslation, enableCycle: checked })
  }

  return (
    <ConfigCard
      title={i18n.t('options.inputTranslation.languages.title')}
      description={i18n.t('options.inputTranslation.languages.description')}
    >
      <div className="flex flex-col gap-4 min-w-0 w-full">
        <div className="flex flex-col items-end gap-1 min-w-0 w-full">
          <LangSelect
            value={inputTranslation.fromLang}
            onValueChange={handleFromLangChange}
            getDisplayLabel={getDisplayLabel}
          />

          <div className="relative size-5 shrink-0 mx-auto my-2">
            <Activity mode={inputTranslation.enableCycle ? 'visible' : 'hidden'}>
              <Icon
                icon="fluent:arrow-sort-24-filled"
                className="absolute inset-0 size-5 text-muted-foreground"
              />
            </Activity>
            <Activity mode={inputTranslation.enableCycle ? 'hidden' : 'visible'}>
              <Icon
                icon="tabler:arrow-narrow-down"
                className="absolute inset-0 size-5 text-muted-foreground"
              />
            </Activity>
          </div>

          <LangSelect
            value={inputTranslation.toLang}
            onValueChange={handleToLangChange}
            getDisplayLabel={getDisplayLabel}
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-cycle"
            checked={inputTranslation.enableCycle}
            onCheckedChange={handleEnableCycleChange}
          />
          <Label htmlFor="enable-cycle" className="text-sm font-normal cursor-pointer">
            {i18n.t('options.inputTranslation.languages.enableCycle')}
          </Label>
        </div>
      </div>
    </ConfigCard>
  )
}
