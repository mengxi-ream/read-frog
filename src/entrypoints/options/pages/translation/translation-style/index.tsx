import { useAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigNavItem } from "../../../components/config-nav-item"
import { ConfigSection } from "../../../components/config-section"
import { PresetStyleSelect } from "./preset-style-select"
import { StylePreview } from "./style-preview"

/**
 * How translated text is set apart from the original. The two ways of answering that are
 * exclusive, so the section shows one of them: a preset with its preview, or a way into the
 * CSS editor — a page of its own, since an editor is far too tall to sit in a row.
 */
export function TranslationStyleSection() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.pageTranslation)
  const { translationNodeStyle } = translateConfig

  return (
    <ConfigSection
      id="translation-style"
      title={i18n.t("options.translation.translationStyle.title")}
    >
      <ConfigItem
        title={i18n.t("options.translation.translationStyle.useCustomStyle")}
        description={i18n.t("options.translation.translationStyle.useCustomStyleDescription")}
      >
        <Switch
          checked={translationNodeStyle.isCustom}
          onCheckedChange={(isCustom) => {
            void setTranslateConfig({ translationNodeStyle: { ...translationNodeStyle, isCustom } })
          }}
        />
      </ConfigItem>
      {translationNodeStyle.isCustom ? (
        <ConfigNavItem
          to="/page-translation/custom-css"
          title={i18n.t("options.translation.translationStyle.cssEditor")}
          description={i18n.t("options.translation.translationStyle.cssEditorDescription")}
        />
      ) : (
        <>
          <ConfigItem
            title={i18n.t("options.translation.translationStyle.presetStyle")}
            description={i18n.t("options.translation.translationStyle.description")}
          >
            <PresetStyleSelect />
          </ConfigItem>
          <StylePreview />
        </>
      )}
    </ConfigSection>
  )
}
