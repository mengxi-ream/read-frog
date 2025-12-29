import type { LangCodeISO6393 } from '@read-frog/definitions'
import { i18n } from '#imports'
import {
  LANG_CODE_TO_EN_NAME,
  LANG_CODE_TO_LOCALE_NAME,
  langCodeISO6393Schema,
} from '@read-frog/definitions'
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

function langCodeLabel(langCode: LangCodeISO6393) {
  return `${LANG_CODE_TO_EN_NAME[langCode]} (${LANG_CODE_TO_LOCALE_NAME[langCode]})`
}

export function InputTranslationTargetCode() {
  const [inputTranslation, setInputTranslation] = useAtom(
    configFieldsAtomMap.inputTranslation,
  )

  const handleTargetCodeChange = (newLangCode: LangCodeISO6393) => {
    void setInputTranslation({
      ...inputTranslation,
      targetCode: newLangCode,
    })
  }

  return (
    <ConfigCard
      title={i18n.t('options.inputTranslation.targetCode.title')}
      description={i18n.t('options.inputTranslation.targetCode.description')}
    >
      <Select value={inputTranslation.targetCode} onValueChange={handleTargetCodeChange}>
        <SelectTrigger className="w-64">
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
    </ConfigCard>
  )
}
