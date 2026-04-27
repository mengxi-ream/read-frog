import { useAtom } from "jotai"
import { isPageTranslatedAtom } from "../atoms/auto-translate"
import { useTranslation } from "#imports"

export function TranslationStatusIndicator() {
  const [isTranslated] = useAtom(isPageTranslatedAtom)
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-2 w-2 rounded-full ${
          isTranslated ? "bg-green-500" : "bg-gray-400"
        }`}
        aria-label={isTranslated ? t("popup.translationActive") : t("popup.translationInactive")}
      />
      <span className="text-xs font-medium text-muted-foreground">
        {isTranslated ? t("popup.translated") : t("popup.notTranslated")}
      </span>
    </div>
  )
}
