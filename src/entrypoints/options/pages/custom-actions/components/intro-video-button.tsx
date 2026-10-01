import type { SupportedUiLocale } from "@/utils/i18n/locales"
import { Icon } from "@iconify/react"
import { Button } from "@/components/ui/base-ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/base-ui/dialog"
import { env } from "@/env"
import { getUiLocale, i18n } from "@/utils/i18n"

/**
 * The film that introduces custom AI actions, hosted with readfrog.app's other feature films
 * (`public/videos/features`, cached as immutable, so a new cut ships under a new name). The
 * Chinese and Traditional Chinese interfaces get the Chinese cut; every other language gets the
 * English one.
 */
export function introVideoFor(locale: SupportedUiLocale) {
  const cut =
    locale === "zh-CN" || locale === "zh-TW" ? "custom-actions-zh-v4" : "custom-actions-en-v3"
  const base = `${env.WXT_WEBSITE_URL}/videos/features/${cut}`
  return { src: `${base}.mp4`, poster: `${base}.webp` }
}

export function IntroVideoButton() {
  const { src, poster } = introVideoFor(getUiLocale())

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" size="xs" />}>
        <Icon icon="tabler:player-play" />
        {i18n.t("options.selectionToolbar.customActions.introVideo.trigger")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {i18n.t("options.selectionToolbar.customActions.introVideo.title")}
          </DialogTitle>
        </DialogHeader>
        {/* Opened by a click, so it may start with sound. */}
        <video
          className="aspect-video w-full rounded-lg bg-black"
          src={src}
          poster={poster}
          controls
          autoPlay
          playsInline
        />
      </DialogContent>
    </Dialog>
  )
}
