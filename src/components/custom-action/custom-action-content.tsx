import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { LayoutStatus } from "@read-frog/layout-engine/contract"
import type { ThinkingSnapshot } from "@/types/background-stream"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { IconAlertTriangle } from "@tabler/icons-react"
import { use, useMemo, useState } from "react"
import { CustomActionLayoutView } from "@/components/layout-host/custom-action-layout-view"
import { ThemeContext } from "@/components/providers/theme-provider"
import { Thinking } from "@/components/thinking"
import { SelectionSourceContent } from "@/components/ui/selection-popover/selection-source-content"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { i18n } from "@/utils/i18n"
import { resolveActionLayout } from "@/utils/layout-host/resolve"

interface CustomActionContentProps {
  action: SelectionToolbarCustomAction | null
  status: LayoutStatus
  // What the run used: its selection prompt token (ctx.selection) and target
  // language (ctx.targetLanguage, and the language of the card's own words).
  selection: string
  targetCode: LangCodeISO6393
  selectionContent: string | null | undefined
  value: Record<string, unknown> | null
  thinking: ThinkingSnapshot | null
}

export function CustomActionContent({
  action,
  status,
  selection,
  targetCode,
  selectionContent,
  value,
  thinking,
}: CustomActionContentProps) {
  // The selection content script always renders inside ThemeProvider; the
  // light fallback only covers harnesses that mount the popover without it.
  const theme = use(ThemeContext)?.theme ?? "light"
  const layoutSource = useMemo(() => (action ? resolveActionLayout(action) : null), [action])
  // A precheck error (no value and nothing streaming) shows only the alert,
  // not a layout full of empty fields.
  const showLayout =
    action !== null && layoutSource !== null && (value !== null || status === "streaming")
  // The result on screen is a fallback (the default layout or the plain field
  // list), not how the action looks. Without a note readers take it for the
  // action's design; why it fell back is shown in the options preview.
  const [layoutFellBack, setLayoutFellBack] = useState(false)

  return (
    <div className="p-4">
      <SelectionSourceContent
        text={selectionContent}
        emptyPlaceholder="—"
        separatorClassName="mb-4"
      />

      <div className="space-y-4">
        <div className="space-y-2">
          {thinking && <Thinking status={thinking.status} content={thinking.text} />}
          {showLayout && (
            <CustomActionLayoutView
              source={layoutSource}
              outputSchema={action.outputSchema}
              value={value}
              selection={selection}
              targetCode={targetCode}
              status={status}
              theme={theme}
              speakSurface={ANALYTICS_SURFACE.SELECTION_TOOLBAR}
              onRenderInfo={(info) => setLayoutFellBack(info.fellBack)}
            />
          )}
          {showLayout && layoutFellBack && (
            <p
              role="status"
              className="flex items-start gap-1.5 text-xs text-muted-foreground"
              data-slot="custom-action-layout-fallback-note"
            >
              <IconAlertTriangle className="mt-px size-3.5 shrink-0" />
              <span className="min-w-0 break-words">
                {i18n.t("action.customActionLayoutFallback")}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
