import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { ConfigItem } from "../../components/config-item"
import "@/assets/styles/host-theme.css"

// The colors the marks have on pages, from the same variables
// (host-theme.css): light ones here, the dark-page ones in dark mode.
const SWATCH_CLASS = {
  hard: "bg-(--read-frog-highlight-hard) dark:bg-(--read-frog-highlight-hard-dark) dark:text-(--read-frog-highlight-hard-ink)",
  learning:
    "bg-(--read-frog-highlight-learning) dark:bg-(--read-frog-highlight-learning-dark) dark:text-(--read-frog-highlight-learning-ink)",
} as const

/** What the two colors of mark mean. */
export function ColorsItem() {
  return (
    <ConfigItem
      id="difficult-words-colors"
      title={i18n.t("options.difficultWords.colors.title")}
      description={i18n.t("options.difficultWords.colors.description")}
    >
      <ul className="flex flex-col items-end gap-2 text-sm">
        {(["hard", "learning"] as const).map((kind) => (
          <li key={kind}>
            <span className={cn("rounded-[3px] px-1 py-0.5", SWATCH_CLASS[kind])}>
              {i18n.t(`options.difficultWords.colors.${kind}`)}
            </span>
          </li>
        ))}
      </ul>
    </ConfigItem>
  )
}
