import floatingButtonDemoImage from "@/assets/demo/floating-button.png"
import { GradientBackground } from "@/components/gradient-background"
import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { ClickActionSection } from "./click-action"
import { DisplaySection } from "./display"
import { EnableItem } from "./enable-item"

export function FloatingButtonPage() {
  return (
    <PageLayout
      title={i18n.t("options.floatingButton.title")}
      description={i18n.t("options.floatingButton.pageDescription")}
      innerClassName="flex flex-col gap-10"
    >
      <GradientBackground>
        <img
          src={floatingButtonDemoImage}
          alt={i18n.t("options.floatingButton.demoImageAlt")}
          className="h-auto w-100"
        />
      </GradientBackground>
      <EnableItem />
      <DisplaySection />
      <ClickActionSection />
    </PageLayout>
  )
}
