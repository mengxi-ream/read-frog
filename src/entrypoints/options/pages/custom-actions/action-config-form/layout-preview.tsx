import type { LayoutStatus } from "@read-frog/layout-engine/contract"
import type { CustomActionLayoutRenderInfo } from "@/components/layout-host/custom-action-layout-view"
import type {
  SelectionToolbarCustomActionOutputField,
  SelectionToolbarCustomActionSampleData,
} from "@/types/config/selection-toolbar"
import {
  IconAlertTriangle,
  IconForms,
  IconMoon,
  IconPlayerPlay,
  IconShieldCheck,
  IconSun,
} from "@tabler/icons-react"
import { dequal } from "dequal"
import { useAtomValue } from "jotai"
import { useEffect, useMemo, useState } from "react"
import { LanguageCombobox } from "@/components/language-combobox"
import { getTargetLanguageItems } from "@/components/language-combobox-options"
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
import { MAX_CUSTOM_ACTION_SAMPLE_TEXT_LENGTH } from "@/types/config/selection-toolbar"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import {
  buildStreamingFrames,
  createLayoutSampleData,
  layoutSampleValues,
  syncLayoutSampleData,
} from "@/utils/layout-host/sample"
import { cn } from "@/utils/styles/utils"
import { LayoutPreviewFrame } from "./layout-preview-frame"

type Field = SelectionToolbarCustomActionOutputField
type SampleData = SelectionToolbarCustomActionSampleData

type LayoutKey =
  | "preview"
  | "width"
  | "themeLight"
  | "themeDark"
  | "replay"
  | "sampleData"
  | "sampleDataHint"
  | "sampleDataSavedHint"
  | "sampleDataReset"
  | "sampleSelection"
  | "sampleTargetLanguage"

function t(key: LayoutKey) {
  return i18n.t(`options.selectionToolbar.customActions.form.layout.${key}`)
}

// The popover's minimum and default widths (use-selection-popover-layout.ts).
const PREVIEW_WIDTHS = [320, 500] as const
type PreviewWidth = (typeof PREVIEW_WIDTHS)[number]

// One streamed chunk per frame while replaying.
const REPLAY_FRAME_MS = 30

// How the preview's sample data is edited: saved with the action, through a
// custom action's form, or kept to this preview, for a built-in action.
// `next` is always the whole sample data, never a part of it.
export interface LayoutSampleDataEditing {
  saved: boolean
  onChange: (next: SampleData) => void
  onCompositionStart?: () => void
  onCompositionEnd?: (next: SampleData) => void
}

interface LayoutPreviewProps {
  // The layout to render, already resolved (a blank layout means the default).
  source: string
  outputSchema: Field[]
  // The action's sample data; kept in step with `outputSchema` here, and
  // generated when there is none (see syncLayoutSampleData).
  sampleData: SampleData | undefined
  // Omitted: the sample data is not editable here.
  sampleDataEditing?: LayoutSampleDataEditing
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

function SampleTextField({
  id,
  label,
  value,
  editing,
  withText,
}: {
  id: string
  label: string
  value: string
  editing: LayoutSampleDataEditing
  // The whole sample data with this text in it.
  withText: (text: string) => SampleData
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Textarea
        id={id}
        value={value}
        rows={1}
        maxLength={MAX_CUSTOM_ACTION_SAMPLE_TEXT_LENGTH}
        className="min-h-8 text-sm"
        onChange={(event) => editing.onChange(withText(event.target.value))}
        onCompositionStart={() => editing.onCompositionStart?.()}
        onCompositionEnd={(event) =>
          editing.onCompositionEnd?.(withText(event.currentTarget.value))
        }
      />
    </div>
  )
}

function SampleDataEditor({
  outputSchema,
  sampleData,
  fresh,
  editing,
}: {
  outputSchema: Field[]
  sampleData: SampleData
  // What "Reset samples" puts back: a new sample for the current fields.
  fresh: SampleData
  editing: LayoutSampleDataEditing
}) {
  const targetLanguageItems = useMemo(() => getTargetLanguageItems(), [])
  return (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="ghost" size="xs" />}>
        <IconForms />
        {t("sampleData")}
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[60vh] w-80 overflow-y-auto">
        <PopoverHeader>
          <PopoverTitle>{t("sampleData")}</PopoverTitle>
          <PopoverDescription>
            {t(editing.saved ? "sampleDataSavedHint" : "sampleDataHint")}
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex flex-col gap-3">
          <SampleTextField
            id="layout-sample-selection"
            label={t("sampleSelection")}
            value={sampleData.selection}
            editing={editing}
            withText={(selection) => ({ ...sampleData, selection })}
          />
          {/* The language the answer is written for: `ctx.targetLanguage`, and the
              words of the sentence analysis and Improve Writing cards. */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs leading-none font-medium text-muted-foreground">
              {t("sampleTargetLanguage")}
            </span>
            <LanguageCombobox
              items={targetLanguageItems}
              value={sampleData.targetCode}
              onValueChange={(targetCode) => editing.onChange({ ...sampleData, targetCode })}
              triggerSize="sm"
              className="w-full"
            />
          </div>
          {outputSchema.map((field) => (
            <SampleTextField
              key={field.id}
              id={`layout-sample-${field.id}`}
              label={field.name}
              value={Object.hasOwn(sampleData.values, field.id) ? sampleData.values[field.id]! : ""}
              editing={editing}
              withText={(text) => ({
                ...sampleData,
                values: { ...sampleData.values, [field.id]: text },
              })}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="self-end"
          disabled={dequal(sampleData, fresh)}
          onClick={() => editing.onChange(fresh)}
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
  sampleData: storedSampleData,
  sampleDataEditing,
  className,
  frameClassName,
}: LayoutPreviewProps) {
  const { theme: appTheme } = useTheme()
  const [width, setWidth] = useState<PreviewWidth>(500)
  const [pickedTheme, setPickedTheme] = useState<"light" | "dark" | null>(null)
  const theme = pickedTheme ?? appTheme
  const [replayFrame, setReplayFrame] = useState<number | null>(null)
  const [renderInfo, setRenderInfo] = useState<CustomActionLayoutRenderInfo | null>(null)

  // A new sample is written for the reader's target language, like the answers the
  // popup shows; saved sample data keeps the language it was written for.
  const { targetCode } = useAtomValue(configFieldsAtomMap.language)
  const sampleData = useMemo(
    () => syncLayoutSampleData(storedSampleData, outputSchema, targetCode),
    [storedSampleData, outputSchema, targetCode],
  )
  const freshSampleData = useMemo(
    () => createLayoutSampleData(outputSchema, targetCode),
    [outputSchema, targetCode],
  )
  const values = useMemo(
    () => layoutSampleValues(sampleData, outputSchema),
    [sampleData, outputSchema],
  )
  const frames = useMemo(() => buildStreamingFrames(values, outputSchema), [values, outputSchema])

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
        {sampleDataEditing && (
          <SampleDataEditor
            outputSchema={outputSchema}
            sampleData={sampleData}
            fresh={freshSampleData}
            editing={sampleDataEditing}
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
              selection={sampleData.selection}
              targetCode={sampleData.targetCode}
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
