import { useAtomValue } from "jotai"
import { useCallback, useState } from "react"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigDetailSection } from "../../../../components/config-detail-section"
import { ConfigItem } from "../../../../components/config-item"
import { PageLayout } from "../../../../components/page-layout"
import { SubtitlesPreview } from "../style-editor/subtitles-preview"
import { CSSEditor } from "./css-editor"
import { PresetTemplateSelect } from "./preset-template-select"

/**
 * Custom CSS for the subtitle lines, drilled into from the subtitle style page. The preview above
 * is the same one that page shows, but fed the unsaved draft — the point of writing CSS here is
 * watching it land, and a Save round trip between every keystroke and the result would hide that.
 *
 * The draft goes to the preview verbatim, including while it is half-typed. That is what the real
 * overlay would do with it, and the preview lives in a shadow root for exactly that reason: there
 * is no rewriting pass that a partial rule could confuse, and nothing it can reach on this page.
 */
export function SubtitlesCustomCssPage() {
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const [draft, setDraft] = useState(style.customCSS ?? "")
  // Debounced only to keep the shadow root's stylesheet from being rebuilt on every keystroke.
  const previewCSS = useDebouncedValue(draft, 300)

  // Presets stack rather than replace: they touch different lines, so blurring the translation
  // while dimming the original is a combination worth being able to click twice for.
  const appendPreset = useCallback((preset: string) => {
    setDraft((current) => {
      const trimmed = current.replace(/\s+$/, "")
      return trimmed ? `${trimmed}\n\n${preset}\n` : `${preset}\n`
    })
  }, [])

  return (
    <PageLayout
      title={i18n.t("options.videoSubtitles.title")}
      description={i18n.t("options.videoSubtitles.pageDescription")}
    >
      <ConfigDetailSection
        backTo="/video-subtitles/style"
        title={
          <span id="subtitles-custom-css">
            {i18n.t("options.videoSubtitles.style.customCSS.title")}
          </span>
        }
      >
        <SubtitlesPreview previewCSS={previewCSS} />
        <ConfigItem
          title={i18n.t("options.videoSubtitles.style.customCSS.presetTemplate")}
          description={i18n.t("options.videoSubtitles.style.customCSS.presetTemplateDescription")}
        >
          <PresetTemplateSelect onApply={appendPreset} />
        </ConfigItem>
        <CSSEditor value={draft} onChange={setDraft} />
      </ConfigDetailSection>
    </PageLayout>
  )
}
