import type { LangLevel } from '@/types/config/languages'

import { useAtom } from 'jotai'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { configFields } from '@/utils/atoms/config'

export default function LanguageLevelSelector() {
  const [language, setLanguage] = useAtom(configFields.language)

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium">{i18n.t('languageLevel')}</span>
      <Select
        value={language.level}
        onValueChange={(value: LangLevel) => setLanguage({ level: value })}
      >
        <SelectTrigger
          size="sm"
          className="bg-input/50 hover:bg-input !h-7 w-29 cursor-pointer pr-1.5 pl-2.5 outline-none"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="beginner">
            {i18n.t('languageLevels.beginner')}
          </SelectItem>
          <SelectItem value="intermediate">
            {i18n.t('languageLevels.intermediate')}
          </SelectItem>
          <SelectItem value="advanced">
            {i18n.t('languageLevels.advanced')}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
