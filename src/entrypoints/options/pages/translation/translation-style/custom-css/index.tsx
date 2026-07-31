import { i18n } from "@/utils/i18n"
import { ConfigDetailSection } from "../../../../components/config-detail-section"
import { PageLayout } from "../../../../components/page-layout"
import { CSSEditor } from "./css-editor"
import { PreviewPanel } from "./preview-panel"

/**
 * The CSS editor and its preview, drilled into from the Translation Display Style section. An
 * editor tall enough to write rules in cannot share a row with anything, so it gets a page.
 */
export function CustomCssPage() {
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
        <CSSEditor />
        <PreviewPanel />
      </ConfigDetailSection>
    </PageLayout>
  )
}
