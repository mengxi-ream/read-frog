import type { ReactNode } from "react"
import type { SubtitlesPlatform } from "@/types/config/subtitles"
import { cn } from "@/utils/styles/utils"

/*
 * Brand marks from the CC0 `logos` set (gilbarbara/logos), inlined rather than loaded through
 * Iconify because two of them need changing: Netflix keeps only its red "N" (the set's version
 * sits on a black tile), and X is drawn in the text color, since its mark is black on light and
 * white on dark and the set's black one vanishes on the dark theme.
 */
function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 180" aria-hidden className={className}>
      <path
        fill="#f00"
        d="M250.346 28.075A32.18 32.18 0 0 0 227.69 5.418C207.824 0 127.87 0 127.87 0S47.912.164 28.046 5.582A32.18 32.18 0 0 0 5.39 28.24c-6.009 35.298-8.34 89.084.165 122.97a32.18 32.18 0 0 0 22.656 22.657c19.866 5.418 99.822 5.418 99.822 5.418s79.955 0 99.82-5.418a32.18 32.18 0 0 0 22.657-22.657c6.338-35.348 8.291-89.1-.164-123.134"
      />
      <path fill="#fff" d="m102.421 128.06l66.328-38.418l-66.328-38.418z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 251 256" aria-hidden className={cn("text-foreground", className)}>
      <path
        fill="currentColor"
        d="M149.079 108.399L242.33 0h-22.098l-80.97 94.12L74.59 0H0l97.796 142.328L0 256h22.1l85.507-99.395L175.905 256h74.59L149.073 108.399zM118.81 143.58l-9.909-14.172l-78.84-112.773h33.943l63.625 91.011l9.909 14.173l82.705 118.3H186.3l-67.49-96.533z"
      />
    </svg>
  )
}

function NetflixIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="78 39 102 180" aria-hidden className={className}>
      <path
        fill="#b1060f"
        d="m141.676 41.275l-.067 38.361l-.068 38.361l-3.156-8.905l-.006-.017l-4.078 85.402c4.01 11.324 6.158 17.369 6.182 17.393c.031.032 2.317.17 5.078.307c8.366.415 18.734 1.304 26.599 2.282c1.821.226 3.388.342 3.483.257c.094-.084.145-39.143.114-86.797l-.058-86.644zm-61.538-.115v86.732c0 47.703.047 86.779.104 86.836s3.011-.222 6.565-.62c3.553-.398 8.465-.893 10.914-1.1c3.756-.317 14.97-1.038 16.268-1.046c.378-.002.402-1.95.457-36.735l.058-36.734l2.713 7.677l.96 2.713l4.077-85.381l-1.401-3.96a32066 32066 0 0 0-6.283-17.754l-.225-.628z"
      />
      <path
        fill="#e50914"
        d="m80.139 41.16l34.365 97.377v-.044l2.713 7.677c15.104 42.738 23.218 65.652 23.266 65.7c.031.032 2.317.17 5.078.307c8.366.415 18.734 1.304 26.599 2.282c1.812.225 3.37.34 3.48.258l-34.1-96.737v.017l-3.156-8.905c-3.084-8.701-5.143-14.52-17.532-49.55c-3.332-9.42-6.159-17.408-6.283-17.754l-.225-.628z"
      />
    </svg>
  )
}

const PLATFORM_ICONS = {
  youtube: YoutubeIcon,
  xcom: XIcon,
  netflix: NetflixIcon,
} satisfies Record<SubtitlesPlatform, (props: { className?: string }) => ReactNode>

/** The full-color logo of a site video subtitles translate on. */
export function SubtitlesPlatformIcon({
  platform,
  className,
}: {
  platform: SubtitlesPlatform
  className?: string
}) {
  const PlatformIcon = PLATFORM_ICONS[platform]
  return <PlatformIcon className={className} />
}
