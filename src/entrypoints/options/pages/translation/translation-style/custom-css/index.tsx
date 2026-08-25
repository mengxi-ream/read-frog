import { useState } from "react"
import { i18n } from "@/utils/i18n"
import { ConfigDetailSection } from "../../../../components/config-detail-section"
import { PageLayout } from "../../../../components/page-layout"
import { PREVIEW_TEXT, StylePreview } from "../style-preview"
import { CSSEditor } from "./css-editor"
import { PreviewControls } from "./preview-controls"

/**
 * The CSS editor and its preview, drilled into from the Translation Display Style section. An
 * editor tall enough to write rules in cannot share a row with anything, so it gets a page.
 *
 * The preview leads: it is the result being worked towards, and putting it first keeps it in view
 * while the rules that produce it are written below. The sample it renders is described by the
 * controls further down, so the state for those lives here rather than beside them.
 */
export function CustomCssPage() {
  const [language, setLanguage] = useState("zh")
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr")
  const [text, setText] = useState(PREVIEW_TEXT)

  return (
    <PageLayout
      title={i18n.t("options.translation.title")}
      description={i18n.t("options.translation.pageDescription")}
    >
      <ConfigDetailSection
        backTo="/page-translation"
        title={
          <span id="custom-css">{i18n.t("options.translation.translationStyle.cssEditor")}</span>
        }
      >
        <StylePreview text={text} language={language} dir={dir} />
        <CSSEditor />
        <PreviewControls
          language={language}
          onLanguageChange={setLanguage}
          dir={dir}
          onDirChange={setDir}
          text={text}
          onTextChange={setText}
        />
      </ConfigDetailSection>
    </PageLayout>
  )
}
