import type { AppLocale } from "@/types/config/app-locale"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useEffect, useState } from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { appLocales } from "@/types/config/app-locale"
import { getLocalAppLocale, setLocalAppLocale } from "@/utils/app-locale"
import { ConfigCard } from "../../components/config-card"

const LOCALE_LABEL: Record<AppLocale, string> = {
  system: "System",
  en: "English",
  zh_CN: "简体中文",
  zh_TW: "繁體中文",
  ja: "日本語",
  ko: "한국어",
  ru: "Русский",
  tr: "Türkçe",
  vi: "Tiếng Việt",
}

export default function AppLanguageSettings() {
  const [appLocale, setAppLocale] = useState<AppLocale>("system")

  useEffect(() => {
    void getLocalAppLocale().then(setAppLocale)
  }, [])

  const handleValueChange = async (value: AppLocale) => {
    setAppLocale(value)
    await setLocalAppLocale(value)
    window.location.reload()
  }

  return (
    <ConfigCard
      id="app-language"
      title={i18n.t("options.general.appLanguage.title")}
      description={i18n.t("options.general.appLanguage.description")}
    >
      <div className="w-full flex justify-start md:justify-end">
        <Select
          value={appLocale}
          onValueChange={value => void handleValueChange(value as AppLocale)}
        >
          <SelectTrigger className="w-full">
            <SelectValue render={<span />}>
              <span className="flex items-center gap-2">
                <Icon icon="tabler:language" className="size-4" />
                {appLocale === "system"
                  ? i18n.t("options.general.appLanguage.system")
                  : LOCALE_LABEL[appLocale]}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {appLocales.map(locale => (
                <SelectItem key={locale} value={locale}>
                  <span className="flex items-center gap-2">
                    <Icon icon={locale === "system" ? "tabler:device-desktop" : "tabler:language"} className="size-4" />
                    {locale === "system"
                      ? i18n.t("options.general.appLanguage.system")
                      : LOCALE_LABEL[locale]}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </ConfigCard>
  )
}
