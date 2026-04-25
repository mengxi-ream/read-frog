import { i18n } from "#imports"

export function StyleView() {
  return (
    <div className="text-muted-foreground px-4 py-4 text-sm leading-6">
      {i18n.t("options.videoSubtitles.style.description")}
    </div>
  )
}
