import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { LayoutStatus } from "@read-frog/layout-engine/contract"
import type { LayoutRenderReport, LayoutWarnCode } from "@read-frog/layout-engine/dom"
import type { SurfaceByFeature } from "@/types/analytics"
import type { SelectionToolbarCustomActionOutputField } from "@/types/config/selection-toolbar"
import { DEFAULT_LAYOUT } from "@read-frog/layout-engine/presets"
import { LayoutView } from "@read-frog/layout-engine/react"
import { useMemo, useRef } from "react"
import { buildCustomActionLayoutScope, CUSTOM_ACTION_LAYOUT_HOST } from "@/utils/layout-host/host"
import { logger } from "@/utils/logger"
import { FallbackFieldList } from "./fallback-field-list"
import { useExtensionSpeakAdapter } from "./use-extension-speak-adapter"

// A custom action's result, rendered through its HTML + Liquid layout in an
// isolated shadow root. When the layout cannot render, the default layout
// takes its place, and when that fails too, a plain field list. The frame
// around the shadow host carries the containment; `className` goes on it.

export interface CustomActionLayoutRenderInfo {
  // Why the requested layout is not the one on screen (null when it is).
  error: string | null
  // What the sanitizer stripped from the layout on screen.
  removed: string[]
  fellBack: boolean
}

interface CustomActionLayoutViewProps {
  source: string
  outputSchema: SelectionToolbarCustomActionOutputField[]
  value: Record<string, unknown> | null
  selection: string
  // The target language the answer is in; the card's own words follow it.
  targetCode: LangCodeISO6393
  status: LayoutStatus
  theme: "light" | "dark"
  speakSurface?: SurfaceByFeature["text_to_speech"]
  className?: string
  onRenderInfo?: (info: CustomActionLayoutRenderInfo) => void
}

const FALLBACK_SOURCES = [DEFAULT_LAYOUT]

// What the layout wants known without changing what is shown (a failed
// constructable stylesheet probe, an ignored host attribute).
function logLayoutWarning(code: LayoutWarnCode, detail?: unknown) {
  logger.warn(`[layout] ${code}`, detail)
}

function toRenderInfo(report: LayoutRenderReport): CustomActionLayoutRenderInfo {
  return {
    error: report.error?.message ?? null,
    removed: [...report.removed],
    fellBack: report.fellBack !== "none",
  }
}

export function CustomActionLayoutView({
  source,
  outputSchema,
  value,
  selection,
  targetCode,
  status,
  theme,
  speakSurface,
  className,
  onRenderInfo,
}: CustomActionLayoutViewProps) {
  const scope = useMemo(
    () => buildCustomActionLayoutScope({ outputSchema, value, selection, targetCode, status }),
    [outputSchema, value, selection, targetCode, status],
  )
  const speak = useExtensionSpeakAdapter(speakSurface)

  // The layout reports whenever anything about the render changes; callers
  // only hear about changes to what they are shown. LayoutView always calls
  // the latest callback, so this one may change on every render.
  const reportedRef = useRef<string | null>(null)
  const handleReport = (report: LayoutRenderReport) => {
    const info = toRenderInfo(report)
    const serialized = JSON.stringify(info)
    if (serialized === reportedRef.current) return
    reportedRef.current = serialized
    onRenderInfo?.(info)
  }

  return (
    <LayoutView
      host={CUSTOM_ACTION_LAYOUT_HOST}
      theme={theme}
      source={source}
      scope={scope}
      status={status}
      fallbackSources={FALLBACK_SOURCES}
      speak={speak}
      onReport={handleReport}
      onWarn={logLayoutWarning}
      className={className}
      fallback={<FallbackFieldList outputSchema={outputSchema} value={value} status={status} />}
    />
  )
}
