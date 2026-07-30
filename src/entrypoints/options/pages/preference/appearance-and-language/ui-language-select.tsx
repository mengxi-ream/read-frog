import type { ComponentProps } from "react"
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

// Each language is shown in its own script (endonym), so these labels are the same
// regardless of the current interface language and never need translation.
const LANGUAGE_ENDONYMS: Record<Exclude<UiLanguage, "auto">, string> = {
  en: "English",
  es: "Español",
  ja: "日本語",
  ko: "한국어",
  ru: "Русский",
  tr: "Türkçe",
  vi: "Tiếng Việt",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
}

const UI_LANGUAGE_ORDER: UiLanguage[] = [
  "auto",
  "en",
  "es",
  "ja",
  "ko",
  "ru",
  "tr",
  "vi",
  "zh-CN",
  "zh-TW",
]

// Resolved at render so the "auto" label follows a runtime interface-language switch.
function labelFor(language: UiLanguage): string {
  return language === "auto"
    ? i18n.t("options.preference.appearanceAndLanguage.interfaceLanguage.auto")
    : LANGUAGE_ENDONYMS[language]
}

/**
 * Bare interface-language control. Callers own the surrounding label/layout, including
 * width: `SelectTrigger` defaults to `w-fit`, so pass `w-full` to fill the container.
 */
export function UiLanguageSelect({
  className,
  size,
}: {
  className?: string
  size?: ComponentProps<typeof SelectTrigger>["size"]
}) {
  const [uiLanguage, setUiLanguage] = useAtom(configFieldsAtomMap.uiLanguage)

  return (
    <Select value={uiLanguage} onValueChange={(value) => void setUiLanguage(value as UiLanguage)}>
      <SelectTrigger className={className} size={size}>
        <SelectValue render={<span />}>{labelFor(uiLanguage)}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          {UI_LANGUAGE_ORDER.map((language) => (
            <SelectItem key={language} value={language}>
              {labelFor(language)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
