import { i18n } from "@/utils/i18n"
import { ConfigNavItem } from "../../../components/config-nav-item"
import { ConfigSection } from "../../../components/config-section"

/**
 * The dials on the requests themselves — how fast they go out, how much text each carries, and
 * how far ahead of the reader they run. Six number fields nobody touches on the way to anything
 * else, so the section points at the page holding them rather than spending the room here.
 */
export function TranslationQueueSection() {
  return (
    <ConfigSection title={i18n.t("options.translation.translationQueue.title")}>
      <ConfigNavItem
        to="/page-translation/translation-queue"
        title={i18n.t("options.translation.translationQueue.manageQueue")}
        description={i18n.t("options.translation.translationQueue.description")}
      />
    </ConfigSection>
  )
}
