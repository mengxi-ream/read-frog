import type { VariantProps } from "class-variance-authority"
import { browser } from "#imports"
import { cva } from "class-variance-authority"
import { useEffect, useReducer, useRef } from "react"
import { resolveContentScriptAssetBlob, shouldProxyAssetUrl } from "@/utils/content-script/background-asset-url"
import { cn } from "@/utils/styles/utils"

const providerIconVariants = cva(
  "flex items-center min-w-0",
  {
    variants: {
      size: {
        sm: "gap-1.5",
        base: "gap-2",
        md: "gap-3",
        lg: "gap-4",
        xl: "gap-5",
      },
    },
    defaultVariants: {
      size: "base",
    },
  },
)

const iconContainerVariants = cva(
  "rounded-full bg-white dark:bg-muted border border-border flex items-center justify-center flex-shrink-0",
  {
    variants: {
      size: {
        sm: "size-5",
        base: "size-6",
        md: "size-8",
        lg: "size-10",
        xl: "size-12",
      },
    },
    defaultVariants: {
      size: "base",
    },
  },
)

const iconVariants = cva(
  "",
  {
    variants: {
      size: {
        sm: "size-[11px]",
        base: "size-3.5",
        md: "size-5",
        lg: "size-6",
        xl: "size-7",
      },
    },
    defaultVariants: {
      size: "base",
    },
  },
)

const textVariants = cva(
  "truncate",
  {
    variants: {
      size: {
        sm: "text-sm",
        base: "text-base",
        md: "text-md",
        lg: "text-lg",
        xl: "text-xl",
      },
    },
    defaultVariants: {
      size: "base",
    },
  },
)

interface ProviderIconProps extends VariantProps<typeof providerIconVariants> {
  logo: string
  name?: string
  className?: string
  textClassName?: string
}

type ResolvedLogo = { kind: "src", src: string } | { kind: "bitmap", bitmap: ImageBitmap } | null

const PROTOCOL_RELATIVE_URL_RE = /^(?:[a-z][a-z\d+\-.]*:)?\/\//i
const SCHEME_URL_RE = /^[a-z][a-z\d+\-.]*:/i

const iconPixelSizeMap = {
  sm: 11,
  base: 14,
  md: 20,
  lg: 24,
  xl: 28,
} as const

function normalizeLogoUrl(logo: string) {
  if (PROTOCOL_RELATIVE_URL_RE.test(logo) || SCHEME_URL_RE.test(logo)) {
    return logo
  }

  try {
    return new URL(logo, browser.runtime.getURL("/")).href
  }
  catch {
    return logo
  }
}

function getInitialResolvedLogo(logo: string): ResolvedLogo {
  return shouldProxyAssetUrl(logo) ? null : { kind: "src", src: logo }
}

export default function ProviderIcon({ logo, name, size, className, textClassName }: ProviderIconProps) {
  const normalizedLogo = normalizeLogoUrl(logo)
  const [resolvedLogo, setResolvedLogo] = useReducer(
    (_current: ResolvedLogo, next: ResolvedLogo) => next,
    normalizedLogo,
    getInitialResolvedLogo,
  )
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const normalizedSize = size ?? "base"
  const imgAlt = name ?? ""

  useEffect(() => {
    let isCancelled = false
    let resolvedBitmap: ImageBitmap | null = null

    if (!shouldProxyAssetUrl(normalizedLogo)) {
      setResolvedLogo({ kind: "src", src: normalizedLogo })
      return () => {
        isCancelled = true
      }
    }

    setResolvedLogo(null)

    if (typeof createImageBitmap !== "function") {
      return () => {
        isCancelled = true
      }
    }

    void resolveContentScriptAssetBlob(normalizedLogo).then(async (assetBlob) => {
      if (!assetBlob || isCancelled) {
        return
      }

      const nextBitmap = await createImageBitmap(assetBlob)
      if (isCancelled) {
        nextBitmap.close?.()
        return
      }

      resolvedBitmap = nextBitmap
      setResolvedLogo({ kind: "bitmap", bitmap: nextBitmap })
    }).catch(() => {
      if (!isCancelled) {
        setResolvedLogo(null)
      }
    })

    return () => {
      isCancelled = true
      resolvedBitmap?.close?.()
    }
  }, [normalizedLogo])

  useEffect(() => {
    if (resolvedLogo?.kind !== "bitmap") {
      return
    }

    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext("2d")
    if (!context) {
      return
    }

    const displaySize = iconPixelSizeMap[normalizedSize]
    const devicePixelRatio = window.devicePixelRatio || 1
    const renderSize = Math.max(1, Math.round(displaySize * devicePixelRatio))

    canvas.width = renderSize
    canvas.height = renderSize

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    context.clearRect(0, 0, displaySize, displaySize)

    const scale = Math.min(
      displaySize / resolvedLogo.bitmap.width,
      displaySize / resolvedLogo.bitmap.height,
    )
    const drawWidth = resolvedLogo.bitmap.width * scale
    const drawHeight = resolvedLogo.bitmap.height * scale
    const drawX = (displaySize - drawWidth) / 2
    const drawY = (displaySize - drawHeight) / 2

    context.drawImage(resolvedLogo.bitmap, drawX, drawY, drawWidth, drawHeight)
  }, [normalizedSize, resolvedLogo])

  return (
    <div className={cn(providerIconVariants({ size }), className)}>
      <div className={iconContainerVariants({ size })}>
        {resolvedLogo?.kind === "src" && (
          <img
            src={resolvedLogo.src}
            alt={imgAlt}
            className={iconVariants({ size })}
            onError={() => setResolvedLogo(null)}
          />
        )}
        {resolvedLogo?.kind === "bitmap" && (
          <canvas
            ref={canvasRef}
            className={iconVariants({ size })}
            role={imgAlt ? "img" : undefined}
            aria-label={imgAlt || undefined}
            aria-hidden={imgAlt ? undefined : true}
          />
        )}
      </div>
      {name && <span className={cn(textVariants({ size }), textClassName)}>{name}</span>}
    </div>
  )
}
