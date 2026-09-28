import type { LayoutStatus } from "@read-frog/layout-engine/contract"
import type { CustomActionLayoutRenderInfo } from "@/components/layout-host/custom-action-layout-view"
import type { SelectionToolbarCustomActionOutputField } from "@/types/config/selection-toolbar"
import {
  IconAlertTriangle,
  IconForms,
  IconMoon,
  IconPlayerPlay,
  IconShieldCheck,
  IconSun,
} from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { useEffect, useMemo, useState } from "react"
import { CustomActionLayoutView } from "@/components/layout-host/custom-action-layout-view"
import { useTheme } from "@/components/providers/theme-provider"
import { Button } from "@/components/ui/base-ui/button"
import { ButtonGroup } from "@/components/ui/base-ui/button-group"
import { Label } from "@/components/ui/base-ui/label"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/base-ui/popover"
import { Textarea } from "@/components/ui/base-ui/textarea"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { contentLocaleFor } from "@/utils/layout-host/labels"
import {
  buildLayoutSampleValues,
  buildStreamingFrames,
  getLayoutSampleContext,
} from "@/utils/layout-host/sample"
import { cn } from "@/utils/styles/utils"
import { LayoutPreviewFrame } from "./layout-preview-frame"

type Field = SelectionToolbarCustomActionOutputField

type LayoutKey =
  | "preview"
  | "width"
  | "themeLight"
  | "themeDark"
  | "replay"
  | "sampleData"
  | "sampleDataHint"
  | "sampleDataReset"

function t(key: LayoutKey) {
  return i18n.t(`options.selectionToolbar.customActions.form.layout.${key}`)
}

// The popover's minimum and default widths (use-selection-popover-layout.ts).
const PREVIEW_WIDTHS = [320, 500] as const
type PreviewWidth = (typeof PREVIEW_WIDTHS)[number]

// One streamed chunk per frame while replaying.
const REPLAY_FRAME_MS = 30

export type LayoutSampleOverrides = Readonly<Record<string, string>>

interface LayoutPreviewProps {
  // The layout to render, already resolved (a blank layout means the default).
  source: string
  outputSchema: Field[]
  sampleOverrides: LayoutSampleOverrides
  // Omitted: the sample data is not editable here.
  onSampleOverridesChange?: (next: LayoutSampleOverrides) => void
  className?: string
  frameClassName?: string
}

function Segment<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: Array<{ value: T; label: React.ReactNode; title?: string }>
  onChange: (value: T) => void
  label: string
}) {
  return (
    <ButtonGroup aria-label={label}>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant="outline"
          size="xs"
          aria-pressed={option.value === value}
          aria-label={option.title}
          title={option.title}
          className="aria-pressed:bg-muted aria-pressed:text-foreground"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </ButtonGroup>
  )
}

function SampleDataEditor({
  outputSchema,
  values,
  overrides,
  onChange,
}: {
  outputSchema: Field[]
  values: Record<string, string | number>
  overrides: LayoutSampleOverrides
  onChange: (next: LayoutSampleOverrides) => void
}) {
  return (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="ghost" size="xs" />}>
        <IconForms />
        {t("sampleData")}
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[60vh] w-80 overflow-y-auto">
        <PopoverHeader>
          <PopoverTitle>{t("sampleData")}</PopoverTitle>
          <PopoverDescription>{t("sampleDataHint")}</PopoverDescription>
        </PopoverHeader>
        <div className="flex flex-col gap-3">
          {outputSchema.map((field) => {
            const id = `layout-sample-${field.id}`
            const value = overrides[field.id] ?? String(values[field.name] ?? "")
            return (
              <div key={field.id} className="flex flex-col gap-1.5">
                <Label htmlFor={id} className="text-xs text-muted-foreground">
                  {field.name}
                </Label>
                <Textarea
                  id={id}
                  value={value}
                  rows={1}
                  className="min-h-8 text-sm"
                  onChange={(event) => onChange({ ...overrides, [field.id]: event.target.value })}
                />
              </div>
            )
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="self-end"
          disabled={Object.keys(overrides).length === 0}
          onClick={() => onChange({})}
        >
          {t("sampleDataReset")}
        </Button>
      </PopoverContent>
    </Popover>
  )
}

function RenderNotices({ info }: { info: CustomActionLayoutRenderInfo | null }) {
  if (!info) return null
  const notices: React.ReactNode[] = []
  if (info.fellBack) {
    notices.push(
      <p
        key="fallback"
        role="status"
        className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300"
      >
        <IconAlertTriangle className="mt-px size-3.5 shrink-0" />
        <span className="min-w-0 break-words">
          {i18n.t("options.selectionToolbar.customActions.form.layout.fallbackBanner", [
            info.error ?? "",
          ])}
        </span>
      </p>,
    )
  }
  if (info.removed.length > 0) {
    notices.push(
      <p
        key="sanitized"
        role="status"
        className="flex items-start gap-1.5 text-xs text-muted-foreground"
      >
        <IconShieldCheck className="mt-px size-3.5 shrink-0" />
        <span className="min-w-0 break-words">
          {i18n.t("options.selectionToolbar.customActions.form.layout.sanitized", [
            info.removed.join(", "),
          ])}
        </span>
      </p>,
    )
  }
  return notices.length > 0 ? <div className="flex flex-col gap-1">{notices}</div> : null
}

/**
 * The layout as the selection popup would show it, filled with sample data: the production
 * CustomActionLayoutView inside a popover-like surface, inside a replica of the overlay root.
 * Width and theme can be switched, and a replay streams the sample in.
 */
export function LayoutPreview({
  source,
  outputSchema,
  sampleOverrides,
  onSampleOverridesChange,
  className,
  frameClassName,
}: LayoutPreviewProps) {
  const { theme: appTheme } = useTheme()
  const [width, setWidth] = useState<PreviewWidth>(500)
  const [pickedTheme, setPickedTheme] = useState<"light" | "dark" | null>(null)
  const theme = pickedTheme ?? appTheme
  const [replayFrame, setReplayFrame] = useState<number | null>(null)
  const [renderInfo, setRenderInfo] = useState<CustomActionLayoutRenderInfo | null>(null)

  // The sample answer is written in the reader's language, like the answers the popup
  // shows: the target language when a sample is written in it, else the UI language.
  const { targetCode } = useAtomValue(configFieldsAtomMap.language)
  const locale = contentLocaleFor(targetCode)
  const values = useMemo(
    () =>
      buildLayoutSampleValues(outputSchema, {
        locale,
        overrides: sampleOverrides,
        placeholder: (field) =>
          i18n.t("options.selectionToolbar.customActions.form.layout.sampleValue", [field.name]),
      }),
    [outputSchema, sampleOverrides, locale],
  )
  const frames = useMemo(() => buildStreamingFrames(values, outputSchema), [values, outputSchema])
  const sample = getLayoutSampleContext(outputSchema, locale)

  useEffect(() => {
    if (replayFrame === null) return undefined
    const timer = window.setTimeout(() => {
      setReplayFrame(replayFrame + 1 >= frames.length ? null : replayFrame + 1)
    }, REPLAY_FRAME_MS)
    return () => window.clearTimeout(timer)
  }, [frames.length, replayFrame])

  // The finished answer, or while replaying, the stream's current frame.
  const status: LayoutStatus = replayFrame === null ? "done" : "streaming"
  const value: Record<string, unknown> =
    replayFrame === null ? values : (frames[Math.min(replayFrame, frames.length - 1)] ?? values)

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-auto text-xs font-medium text-muted-foreground">{t("preview")}</span>
        <Segment
          label={t("width")}
          value={width}
          onChange={setWidth}
          options={PREVIEW_WIDTHS.map((option) => ({ value: option, label: option }))}
        />
        <Segment
          label={`${t("themeLight")} / ${t("themeDark")}`}
          value={theme}
          onChange={setPickedTheme}
          options={[
            { value: "light", label: <IconSun />, title: t("themeLight") },
            { value: "dark", label: <IconMoon />, title: t("themeDark") },
          ]}
        />
        {onSampleOverridesChange && (
          <SampleDataEditor
            outputSchema={outputSchema}
            values={values}
            overrides={sampleOverrides}
            onChange={onSampleOverridesChange}
          />
        )}
        <Button type="button" variant="ghost" size="xs" onClick={() => setReplayFrame(0)}>
          <IconPlayerPlay />
          {t("replay")}
        </Button>
      </div>

      <LayoutPreviewFrame
        theme={theme}
        className={cn("rounded-md border bg-muted/40 p-4", frameClassName)}
      >
        <div
          className="mx-auto overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-(--rf-elevation-floating)"
          style={{ width }}
        >
          {/* CustomActionContent's padding around the result. */}
          <div className="p-4">
            <CustomActionLayoutView
              source={source}
              outputSchema={outputSchema}
              value={value}
              selection={sample.selection}
              targetCode={sample.targetCode}
              status={status}
              theme={theme}
              speakSurface={ANALYTICS_SURFACE.TTS_SETTINGS}
              onRenderInfo={setRenderInfo}
            />
          </div>
        </div>
      </LayoutPreviewFrame>

      <RenderNotices info={renderInfo} />
    </div>
  )
}
