import type { UiLanguage } from "@/types/config/config"
import { useAtom } from "jotai"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigCard } from "../../components/config-card"

// Each language is shown in its own script (endonym), so these labels are the same
// regardless of the current interface language and never need translation.
const LANGUAGE_ENDONYMS: Record<Exclude<UiLanguage, "auto">, string> = {
  "en": "English",
  "es": "Español",
  "ja": "日本語",
  "ko": "한국어",
  "ru": "Русский",
  "tr": "Türkçe",
  "vi": "Tiếng Việt",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
}

const UI_LANGUAGE_ORDER: UiLanguage[] = ["auto", "en", "es", "ja", "ko", "ru", "tr", "vi", "zh-CN", "zh-TW"]

// Resolved at render so the "auto" label follows a runtime interface-language switch.
function labelFor(language: UiLanguage): string {
  return language === "auto"
    ? i18n.t("options.general.interfaceLanguage.auto")
    : LANGUAGE_ENDONYMS[language]
}

export default function UiLanguageSelector() {
  const [uiLanguage, setUiLanguage] = useAtom(configFieldsAtomMap.uiLanguage)

  return (
    <ConfigCard
      id="interface-language"
      title={i18n.t("options.general.interfaceLanguage.title")}
      description={i18n.t("options.general.interfaceLanguage.description")}
    >
      <div className="w-full flex justify-start md:justify-end">
        <Select
          value={uiLanguage}
          onValueChange={value => void setUiLanguage(value as UiLanguage)}
        >
          <SelectTrigger className="w-full">
            <SelectValue render={<span />}>
              {labelFor(uiLanguage)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {UI_LANGUAGE_ORDER.map(language => (
                <SelectItem key={language} value={language}>
                  {labelFor(language)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </ConfigCard>
  )
}
