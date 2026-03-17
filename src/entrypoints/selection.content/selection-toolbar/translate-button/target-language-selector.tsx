import { i18n } from "#imports"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { IconChevronDown } from "@tabler/icons-react"
import { useAtom } from "jotai"
import { useMemo } from "react"
import { filterLanguage, getTargetLanguageItems } from "@/components/language-combobox-options"
import { Button } from "@/components/ui/base-ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/base-ui/combobox"
import { useSelectionPopoverOverlayProps } from "@/components/ui/selection-popover"
import { configFieldsAtomMap } from "@/utils/atoms/config"

export function TargetLanguageSelector() {
  const [language, setLanguage] = useAtom(configFieldsAtomMap.language)
  const popoverOverlay = useSelectionPopoverOverlayProps()
  const languageItems = useMemo(() => getTargetLanguageItems(), [])
  const currentItem = useMemo(
    () => languageItems.find(item => item.value === language.targetCode) ?? null,
    [language.targetCode, languageItems],
  )
  const title = currentItem?.label ?? i18n.t("side.targetLang")

  return (
    <Combobox
      value={currentItem}
      onValueChange={(item) => {
        if (!item || item.value === "auto" || item.value === language.targetCode) {
          return
        }

        void setLanguage({ targetCode: item.value })
      }}
      items={languageItems}
      filter={filterLanguage}
      autoHighlight
    >
      <ComboboxPrimitive.Trigger
        render={(
          <Button
            variant="ghost-secondary"
            size="sm"
            className="max-w-40 justify-between gap-1 px-2"
            aria-label={i18n.t("side.targetLang")}
            title={title}
            data-rf-no-drag
          />
        )}
      >
        <span className="min-w-0 truncate">{currentItem?.name ?? i18n.t("side.targetLang")}</span>
        <IconChevronDown className="size-3.5 text-muted-foreground" />
      </ComboboxPrimitive.Trigger>
      <ComboboxContent
        container={popoverOverlay.container}
        positionerClassName={popoverOverlay.positionerClassName}
        align="end"
        className="w-72"
      >
        <ComboboxInput
          showTrigger={false}
          placeholder={i18n.t("translationHub.searchLanguages")}
        />
        <ComboboxList>
          {item => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
        <ComboboxEmpty>{i18n.t("translationHub.noLanguagesFound")}</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  )
}
