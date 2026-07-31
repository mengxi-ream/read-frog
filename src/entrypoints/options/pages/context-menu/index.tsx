import contextMenuDemoImage from "@/assets/demo/context-menu.png"
import { GradientBackground } from "@/components/gradient-background"
import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { EnableItem } from "./enable-item"

export function ContextMenuPage() {
  return (
    <PageLayout
      title={i18n.t("options.contextMenu.title")}
      description={i18n.t("options.contextMenu.pageDescription")}
      innerClassName="flex flex-col gap-10"
    >
      <GradientBackground>
        <img
          src={contextMenuDemoImage}
          alt={i18n.t("options.contextMenu.demoImageAlt")}
          className="h-auto w-100"
        />
      </GradientBackground>
      <EnableItem />
    </PageLayout>
  )
}
