import type { LangCodeISO6393 } from '@read-frog/definitions'
import { i18n } from '#imports'
import {
  LANG_CODE_TO_EN_NAME,
  LANG_CODE_TO_LOCALE_NAME,
  langCodeISO6393Schema,
} from '@read-frog/definitions'
import { useAtom } from 'jotai'
import { Label } from '@/components/shadcn/label'
import { RadioGroup, RadioGroupItem } from '@/components/shadcn/radio-group'
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

export function InputTranslationTargetCode() {
  const [inputTranslation, setInputTranslation] = useAtom(
    configFieldsAtomMap.inputTranslation,
  )

  const handleUseCustomTargetChange = (value: string) => {
    void setInputTranslation({
      ...inputTranslation,
      useCustomTarget: value === 'custom',
    })
  }

  const handleTargetCodeChange = (newLangCode: LangCodeISO6393) => {
    void setInputTranslation({
      ...inputTranslation,
      targetCode: newLangCode,
    })
  }

  return (
    <ConfigCard
      title={i18n.t('options.inputTranslation.useCustomTarget.title')}
      description={i18n.t('options.inputTranslation.useCustomTarget.description')}
    >
      <div className="flex flex-col gap-3">
        <RadioGroup
          value={inputTranslation.useCustomTarget ? 'custom' : 'source'}
          onValueChange={handleUseCustomTargetChange}
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="source" id="target-source" />
            <Label htmlFor="target-source" className="text-sm font-normal cursor-pointer">
              {i18n.t('options.inputTranslation.useCustomTarget.sourceLanguage')}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="custom" id="target-custom" />
            <Label htmlFor="target-custom" className="text-sm font-normal cursor-pointer">
              {i18n.t('options.inputTranslation.useCustomTarget.customTarget')}
            </Label>
          </div>
        </RadioGroup>
        {inputTranslation.useCustomTarget && (
          <Select value={inputTranslation.targetCode} onValueChange={handleTargetCodeChange}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {langCodeLabel(inputTranslation.targetCode)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {langCodeISO6393Schema.options.map(key => (
                <SelectItem key={key} value={key}>
                  {langCodeLabel(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </ConfigCard>
  )
}
