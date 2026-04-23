import { i18n } from "#imports"

export function StyleView() {
  return (
    <div className="px-4 py-4 text-sm leading-6 text-white/62">
      {i18n.t("options.videoSubtitles.style.description")}
    </div>
  )
}
