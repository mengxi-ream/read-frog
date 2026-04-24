import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { LanguageItem } from "@/components/language-combobox-options"
import { i18n } from "#imports"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { Icon } from "@iconify/react"
import {
  LANG_CODE_TO_EN_NAME,
  LANG_CODE_TO_LOCALE_NAME,
  langCodeISO6393Schema,
} from "@read-frog/definitions"
import { IconChevronDown } from "@tabler/icons-react"
import { useAtom, useAtomValue } from "jotai"
import { useMemo } from "react"
import { filterLanguage } from "@/components/language-combobox-options"
import { Button } from "@/components/ui/base-ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/base-ui/combobox"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { detectedCodeAtom } from "@/utils/atoms/detected-code"

function langCodeLabel(langCode: LangCodeISO6393) {
  return `${LANG_CODE_TO_EN_NAME[langCode]} (${LANG_CODE_TO_LOCALE_NAME[langCode]})`
}

function createLanguageItem(code: LangCodeISO6393): LanguageItem<LangCodeISO6393> {
  return {
    value: code,
    label: langCodeLabel(code),
    name: LANG_CODE_TO_EN_NAME[code],
  }
}

const langSelectorTriggerClasses = "!h-14 w-30 rounded-lg shadow-xs pr-2 gap-1 justify-between bg-transparent"

const langSelectorContentClasses = "flex flex-col items-start text-base font-medium min-w-0 flex-1"

function LanguageComboboxTrigger({
  label,
  subtitle,
  ariaLabel,
}: {
  label: string
  subtitle: string
  ariaLabel: string
}) {
  return (
    <ComboboxPrimitive.Trigger
      render={(
        <Button
          type="button"
          variant="outline"
          className={langSelectorTriggerClasses}
          aria-label={ariaLabel}
          title={label}
        />
      )}
    >
      <div className={langSelectorContentClasses}>
        <span className="truncate w-full text-left">{label}</span>
        <span className="text-sm text-neutral-500">{subtitle}</span>
      </div>
      <IconChevronDown className="size-4 text-muted-foreground" />
    </ComboboxPrimitive.Trigger>
  )
}

export default function LanguageOptionsSelector() {
  const [language, setLanguage] = useAtom(configFieldsAtomMap.language)
  const detectedCode = useAtomValue(detectedCodeAtom)
  const targetLanguageItems = useMemo(
    () => langCodeISO6393Schema.options.map(createLanguageItem),
    [],
  )
  const sourceLanguageItems = useMemo<LanguageItem[]>(
    () => [
      {
        value: "auto",
        label: langCodeLabel(detectedCode),
        name: LANG_CODE_TO_EN_NAME[detectedCode],
      },
      ...targetLanguageItems,
    ],
    [detectedCode, targetLanguageItems],
  )
  const currentSourceItem = useMemo(
    () => sourceLanguageItems.find(item => item.value === language.sourceCode) ?? sourceLanguageItems[0] ?? null,
    [language.sourceCode, sourceLanguageItems],
  )
  const currentTargetItem = useMemo(
    () => targetLanguageItems.find(item => item.value === language.targetCode) ?? null,
    [language.targetCode, targetLanguageItems],
  )

  const handleSourceLangChange = (item: LanguageItem | null) => {
    if (!item || item.value === language.sourceCode)
      return
    void setLanguage({ sourceCode: item.value })
  }

  const handleTargetLangChange = (item: LanguageItem | null) => {
    if (!item || item.value === "auto" || item.value === language.targetCode)
      return
    void setLanguage({ targetCode: item.value })
  }

  const sourceLangLabel
    = language.sourceCode === "auto"
      ? `${currentSourceItem?.label ?? langCodeLabel(detectedCode)} (auto)`
      : currentSourceItem?.label ?? langCodeLabel(language.sourceCode)

  const targetLangLabel = currentTargetItem?.label ?? langCodeLabel(language.targetCode)

  return (
    <div className="flex items-center justify-between">
      <Combobox
        value={currentSourceItem}
        onValueChange={handleSourceLangChange}
        items={sourceLanguageItems}
        filter={filterLanguage}
        autoHighlight
      >
        <LanguageComboboxTrigger
          label={sourceLangLabel}
          subtitle={language.sourceCode === "auto"
            ? i18n.t("popup.autoLang")
            : i18n.t("popup.sourceLang")}
          ariaLabel={i18n.t("popup.sourceLang")}
        />
        <ComboboxContent className="rounded-lg shadow-md w-72">
          <ComboboxInput
            showTrigger={false}
            placeholder={i18n.t("translationHub.searchLanguages")}
          />
          <ComboboxList>
            {(item: LanguageItem) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
                {item.value === "auto" && <AutoLangCell />}
              </ComboboxItem>
            )}
          </ComboboxList>
          <ComboboxEmpty>{i18n.t("translationHub.noLanguagesFound")}</ComboboxEmpty>
        </ComboboxContent>
      </Combobox>
      <Icon icon="tabler:arrow-right" className="h-4 w-4 text-neutral-500" />
      <Combobox
        value={currentTargetItem}
        onValueChange={handleTargetLangChange}
        items={targetLanguageItems}
        filter={filterLanguage}
        autoHighlight
      >
        <LanguageComboboxTrigger
          label={targetLangLabel}
          subtitle={i18n.t("popup.targetLang")}
          ariaLabel={i18n.t("popup.targetLang")}
        />
        <ComboboxContent className="rounded-lg shadow-md w-72">
          <ComboboxInput
            showTrigger={false}
            placeholder={i18n.t("translationHub.searchLanguages")}
          />
          <ComboboxList>
            {(item: LanguageItem<LangCodeISO6393>) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
          <ComboboxEmpty>{i18n.t("translationHub.noLanguagesFound")}</ComboboxEmpty>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}

function AutoLangCell() {
  return <span className="rounded-full bg-neutral-200 px-1 text-xs dark:bg-neutral-800 flex items-center">auto</span>
}
