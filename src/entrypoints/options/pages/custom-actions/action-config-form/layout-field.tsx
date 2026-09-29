import type { LayoutSampleDataEditing } from "./layout-preview"
import type { LiquidCodeEditorHandle, LiquidEditorField } from "@/components/ui/liquid-code-editor"
import type {
  SelectionToolbarCustomAction,
  SelectionToolbarCustomActionOutputField,
  SelectionToolbarCustomActionSampleData,
} from "@/types/config/selection-toolbar"
import { formatFieldRef, LAYOUT_CTX_ROOT } from "@read-frog/layout-engine/contract"
import { analyzeLayout } from "@read-frog/layout-engine/editor"
import {
  DEFAULT_LAYOUT,
  LAYOUT_SPEAK_BUTTON_CSS,
  SPEAK_BUTTON_ICONS,
} from "@read-frog/layout-engine/presets"
import {
  IconBraces,
  IconChevronDown,
  IconCode,
  IconHelp,
  IconPencil,
  IconRestore,
  IconVariable,
  IconVolume,
} from "@tabler/icons-react"
import { useSelector } from "@tanstack/react-store"
import { lazy, Suspense, useDeferredValue, useMemo, useRef, useState } from "react"
import { useFieldContext } from "@/components/form/form-context"
import { useAutosaveContext } from "@/components/form/use-autosave"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/base-ui/alert-dialog"
import { Button } from "@/components/ui/base-ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/base-ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/base-ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/base-ui/field"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/base-ui/popover"
import { Skeleton } from "@/components/ui/base-ui/skeleton"
import { MAX_CUSTOM_ACTION_LAYOUT_LENGTH } from "@/types/config/selection-toolbar"
import { i18n } from "@/utils/i18n"
import { resolveActionLayout } from "@/utils/layout-host/resolve"
import {
  buildDictionaryActionLayout,
  buildImproveWritingActionLayout,
  buildSentenceAnalysisActionLayout,
  isDictionaryShaped,
  isImproveWritingShaped,
  isSentenceAnalysisShaped,
} from "@/utils/layout-host/slots"
import { CUSTOM_ACTION_LAYOUT_SECTION_ID } from "@/utils/navigation"
import { withForm } from "./form"
import { LayoutPreview } from "./layout-preview"

type Field = SelectionToolbarCustomActionOutputField

// lang-liquid brings the HTML, CSS and JavaScript languages; only load them
// when an editor actually shows.
const LiquidCodeEditor = lazy(() =>
  import("@/components/ui/liquid-code-editor").then((module) => ({
    default: module.LiquidCodeEditor,
  })),
)

type LayoutKey =
  | "title"
  | "description"
  | "reset"
  | "resetFieldList"
  | "resetDictionary"
  | "resetSentenceAnalysis"
  | "resetImproveWriting"
  | "resetConfirmTitle"
  | "resetConfirmDescription"
  | "resetConfirm"
  | "edit"
  | "insertField"
  | "insertSpeak"
  | "insertCondition"
  | "insertContext"
  | "insertLoop"
  | "syntaxHelp"
  | "builtInHint"
  | "viewSource"
  | "emptyNotice"
  | "unusedFields"
  | "help.output"
  | "help.condition"
  | "help.loop"
  | "help.speak"
  | "help.status"
  | "help.filters"
  | "help.styles"

function t(key: LayoutKey) {
  return i18n.t(`options.selectionToolbar.customActions.form.layout.${key}`)
}

// Clears the narrow-width sticky top bar (h-12) when search scrolls here.
const HEADING_SCROLL_MARGIN = "scroll-mt-14 md:scroll-mt-4"

// ---------------------------------------------------------------------------
// Snippets. They are code, so they live here rather than in the locale files.

function outputSnippet(name: string) {
  return `{{ ${formatFieldRef(name)} }}`
}

function conditionSnippet(name: string): [string, string] {
  return [`{% if ${formatFieldRef(name)} != blank %}`, "{% endif %}"]
}

function speakSnippet(name: string) {
  return `<button type="button" class="rf-speak" data-speak="{{ ${formatFieldRef(name)} }}">${SPEAK_BUTTON_ICONS}</button>`
}

// The speak button snippet relies on the default layout's `.rf-speak` rules
// to show one icon per state; bring them along when the layout lacks them.
function speakStylesToPrepend(source: string) {
  return /\.rf-speak\b/.test(source) ? "" : `<style>\n${LAYOUT_SPEAK_BUTTON_CSS}\n</style>\n`
}

const CTX_LOOP_SNIPPET = `{% for f in ${LAYOUT_CTX_ROOT}.fields %}\n  {{ f.name }}: {{ f.value }}\n{% endfor %}`

const CTX_SNIPPETS = [
  `{{ ${LAYOUT_CTX_ROOT}.selection }}`,
  `{{ ${LAYOUT_CTX_ROOT}.targetLanguage }}`,
  `{{ ${LAYOUT_CTX_ROOT}.status }}`,
]

function getHelpItems(example: string): Array<{ code: string; key: LayoutKey }> {
  const ref = formatFieldRef(example)
  return [
    { code: `{{ ${ref} }}`, key: "help.output" },
    { code: `{% if ${ref} != blank %}…{% endif %}`, key: "help.condition" },
    { code: `{% for f in ${LAYOUT_CTX_ROOT}.fields %}{{ f.name }}{% endfor %}`, key: "help.loop" },
    { code: `<span data-speak="{{ ${ref} }}">…</span>`, key: "help.speak" },
    { code: ":host([data-status=streaming]) .x { … }", key: "help.status" },
    { code: `{{ ${ref} | newline_to_br }}`, key: "help.filters" },
    { code: "<style>.x { color: var(--rf-muted-foreground) }</style>", key: "help.styles" },
  ]
}

// Fields the layout never names. A layout reading `ctx.fields` may show any of
// them, and one that does not parse cannot tell, so neither reports any.
function getUnusedFields(source: string, outputSchema: Field[]): Field[] {
  const analysis = analyzeLayout(source)
  if (analysis.parseError || analysis.usesCtxFields) return []
  const referenced = new Set(analysis.refs.map((ref) => ref.name))
  return outputSchema.filter((field) => !referenced.has(field.name))
}

function toEditorFields(outputSchema: Field[]): LiquidEditorField[] {
  return outputSchema.map(({ name, type, description }) => ({ name, type, description }))
}

// ---------------------------------------------------------------------------
// Toolbar

function FieldMenu({
  label,
  icon,
  outputSchema,
  onPick,
}: {
  label: string
  icon: React.ReactNode
  outputSchema: Field[]
  onPick: (field: Field) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" size="xs" disabled={!outputSchema.length} />
        }
      >
        {icon}
        {label}
        <IconChevronDown className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto max-w-72 min-w-40">
        <DropdownMenuGroup>
          {outputSchema.map((field) => (
            <DropdownMenuItem key={field.id} onClick={() => onPick(field)}>
              <span className="truncate">{field.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SyntaxHelp({ example }: { example: string }) {
  return (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="ghost" size="xs" />}>
        <IconHelp />
        {t("syntaxHelp")}
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[70vh] w-96 overflow-y-auto">
        <PopoverHeader>
          <PopoverTitle>{t("syntaxHelp")}</PopoverTitle>
        </PopoverHeader>
        <dl className="flex flex-col gap-3">
          {getHelpItems(example).map((item) => (
            <div key={item.key} className="flex flex-col gap-1">
              <dt>
                <code className="block rounded bg-muted px-1.5 py-1 font-mono text-xs break-all">
                  {item.code}
                </code>
              </dt>
              <dd className="text-xs text-muted-foreground">{t(item.key)}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  )
}

function LayoutToolbar({
  source,
  outputSchema,
  editor,
}: {
  source: string
  outputSchema: Field[]
  editor: React.RefObject<LiquidCodeEditorHandle | null>
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <FieldMenu
        label={t("insertField")}
        icon={<IconBraces />}
        outputSchema={outputSchema}
        onPick={(field) => editor.current?.insert(outputSnippet(field.name))}
      />
      <FieldMenu
        label={t("insertSpeak")}
        icon={<IconVolume />}
        outputSchema={outputSchema}
        onPick={(field) =>
          editor.current?.insert(speakSnippet(field.name), {
            prepend: speakStylesToPrepend(source),
          })
        }
      />
      <FieldMenu
        label={t("insertCondition")}
        icon={<IconCode />}
        outputSchema={outputSchema}
        onPick={(field) => {
          const [open, close] = conditionSnippet(field.name)
          editor.current?.insert(`${open}${close}`, { cursor: open.length, wrap: [open, close] })
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="outline" size="xs" />}>
          <IconVariable />
          {t("insertContext")}
          <IconChevronDown className="opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-auto min-w-48">
          <DropdownMenuGroup>
            {CTX_SNIPPETS.map((snippet) => (
              <DropdownMenuItem key={snippet} onClick={() => editor.current?.insert(snippet)}>
                <code className="font-mono text-xs">{snippet}</code>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("insertLoop")}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => editor.current?.insert(CTX_LOOP_SNIPPET)}>
              <code className="font-mono text-xs">{`{% for f in ${LAYOUT_CTX_ROOT}.fields %}`}</code>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="ml-auto">
        <SyntaxHelp example={outputSchema[0]?.name ?? "name"} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Editor pane (toolbar + editor + unused-field chips), in the edit dialog

interface LayoutEditorPaneProps {
  value: string
  outputSchema: Field[]
  onChange: (value: string) => void
  onBlur: () => void
  onCompositionStart: () => void
  onCompositionEnd: (value: string) => void
  hasError: boolean
  labelledBy: string
}

function LayoutEditorPane({
  value,
  outputSchema,
  onChange,
  onBlur,
  onCompositionStart,
  onCompositionEnd,
  hasError,
  labelledBy,
}: LayoutEditorPaneProps) {
  const editor = useRef<LiquidCodeEditorHandle>(null)
  const [limitHit, setLimitHit] = useState(false)
  const editorFields = useMemo(() => toEditorFields(outputSchema), [outputSchema])
  const analyzedValue = useDeferredValue(value)
  const unusedFields = useMemo(
    () => getUnusedFields(analyzedValue, outputSchema),
    [analyzedValue, outputSchema],
  )

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <LayoutToolbar source={value} outputSchema={outputSchema} editor={editor} />
      <div className="min-h-0 min-w-0 flex-1">
        <Suspense fallback={<Skeleton className="h-full min-h-60" />}>
          <LiquidCodeEditor
            handleRef={editor}
            value={value}
            fields={editorFields}
            maxLength={MAX_CUSTOM_ACTION_LAYOUT_LENGTH}
            onChange={(next) => {
              setLimitHit(false)
              onChange(next)
            }}
            onBlur={onBlur}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            onTooLong={() => setLimitHit(true)}
            hasError={hasError || limitHit}
            aria-labelledby={labelledBy}
            height="100%"
            className="h-full"
          />
        </Suspense>
      </div>
      {limitHit && (
        <p role="alert" className="text-sm text-destructive">
          {i18n.t("options.selectionToolbar.customActions.form.layout.tooLong", [
            String(MAX_CUSTOM_ACTION_LAYOUT_LENGTH),
          ])}
        </p>
      )}
      {value.trim() === "" && <p className="text-sm text-muted-foreground">{t("emptyNotice")}</p>}
      {unusedFields.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{t("unusedFields")}</span>
          {unusedFields.map((field) => (
            <Button
              key={field.id}
              type="button"
              variant="outline"
              size="xs"
              className="max-w-48 border-dashed"
              title={outputSnippet(field.name)}
              onClick={() => editor.current?.insert(outputSnippet(field.name))}
            >
              <span className="truncate">{field.name}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Restore default

type ResetTarget = "fieldList" | "dictionary" | "sentenceAnalysis" | "improveWriting"

function ResetMenu({
  outputSchema,
  onReset,
}: {
  outputSchema: Field[]
  onReset: (target: ResetTarget) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <IconRestore />
        {t("reset")}
        <IconChevronDown className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-40">
        <DropdownMenuItem onClick={() => onReset("fieldList")}>
          {t("resetFieldList")}
        </DropdownMenuItem>
        {isDictionaryShaped(outputSchema) && (
          <DropdownMenuItem onClick={() => onReset("dictionary")}>
            {t("resetDictionary")}
          </DropdownMenuItem>
        )}
        {isSentenceAnalysisShaped(outputSchema) && (
          <DropdownMenuItem onClick={() => onReset("sentenceAnalysis")}>
            {t("resetSentenceAnalysis")}
          </DropdownMenuItem>
        )}
        {isImproveWritingShaped(outputSchema) && (
          <DropdownMenuItem onClick={() => onReset("improveWriting")}>
            {t("resetImproveWriting")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ResetConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("resetConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("resetConfirmDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {i18n.t("options.selectionToolbar.customActions.form.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t("resetConfirm")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function getResetLayout(target: ResetTarget, outputSchema: Field[]): string {
  switch (target) {
    case "dictionary":
      return buildDictionaryActionLayout(outputSchema) ?? DEFAULT_LAYOUT
    case "sentenceAnalysis":
      return buildSentenceAnalysisActionLayout(outputSchema) ?? DEFAULT_LAYOUT
    case "improveWriting":
      return buildImproveWritingActionLayout(outputSchema) ?? DEFAULT_LAYOUT
    default:
      return DEFAULT_LAYOUT
  }
}

// ---------------------------------------------------------------------------
// Editable layout (custom actions)

function LayoutHeading({ actions }: { actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex min-w-0 flex-col gap-1">
        <FieldLabel id={CUSTOM_ACTION_LAYOUT_SECTION_ID} className={HEADING_SCROLL_MARGIN}>
          {t("title")}
        </FieldLabel>
        <FieldDescription>{t("description")}</FieldDescription>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  )
}

function EditableLayoutField({
  outputSchema,
  sampleData,
  sampleDataEditing,
}: {
  outputSchema: Field[]
  sampleData: SelectionToolbarCustomActionSampleData | undefined
  sampleDataEditing: LayoutSampleDataEditing
}) {
  const autosave = useAutosaveContext()
  const field = useFieldContext<string | undefined>()
  const layout = useSelector(field.store, (state) => state.value)
  const errors = useSelector(field.store, (state) => state.meta.errors)
  const [pendingReset, setPendingReset] = useState<ResetTarget | null>(null)
  const [editing, setEditing] = useState(false)

  // A missing layout renders the default; show that text so there is something to edit.
  const value = typeof layout === "string" ? layout : DEFAULT_LAYOUT
  const previewSource = useDeferredValue(resolveActionLayout({ layout: value }))
  const hasError = errors.length > 0

  const setLayout = (next: string, immediate = false) => {
    autosave.edit(() => field.handleChange(next), { immediate })
  }

  const previewProps = {
    source: previewSource,
    outputSchema,
    sampleData,
    sampleDataEditing,
  }

  return (
    <Field data-invalid={hasError}>
      <LayoutHeading
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              <IconPencil />
              {t("edit")}
            </Button>
            <ResetMenu
              outputSchema={outputSchema}
              onReset={(target) => {
                if (getResetLayout(target, outputSchema) !== value) setPendingReset(target)
              }}
            />
          </>
        }
      />

      <LayoutPreview {...previewProps} frameClassName="max-h-[min(420px,55vh)]" />

      <FieldError>
        {errors.map((error) => (typeof error === "string" ? error : error?.message)).join(", ")}
      </FieldError>

      <ResetConfirmDialog
        open={pendingReset !== null}
        onOpenChange={(open) => {
          if (!open) setPendingReset(null)
        }}
        onConfirm={() => {
          if (pendingReset) setLayout(getResetLayout(pendingReset, outputSchema), true)
          setPendingReset(null)
        }}
      />

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="flex h-[90vh] max-h-[90vh] flex-col overflow-y-auto sm:max-w-[min(1280px,calc(100%-2rem))] lg:overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
            <div className="flex min-h-[60vh] min-w-0 flex-col lg:min-h-0">
              <LayoutEditorPane
                value={value}
                outputSchema={outputSchema}
                onChange={(next) => setLayout(next)}
                onBlur={() => {
                  field.handleBlur()
                  void autosave.flush()
                }}
                onCompositionStart={() => autosave.beginComposition(field.name)}
                onCompositionEnd={(next) =>
                  autosave.endComposition(field.name, () => field.handleChange(next))
                }
                hasError={hasError}
                labelledBy={CUSTOM_ACTION_LAYOUT_SECTION_ID}
              />
            </div>
            <LayoutPreview
              {...previewProps}
              className="min-h-0"
              frameClassName="lg:min-h-0 lg:flex-1"
            />
          </div>
        </DialogContent>
      </Dialog>
    </Field>
  )
}

export const LayoutField = withForm({
  ...{ defaultValues: {} as SelectionToolbarCustomAction },
  render: function Render({ form }) {
    const autosave = useAutosaveContext()
    const outputSchema = useSelector(form.store, (state) => state.values.outputSchema)
    return (
      <form.AppField name="sampleData">
        {(sampleDataField) => (
          <form.AppField name="layout">
            {() => (
              <EditableLayoutField
                outputSchema={outputSchema}
                sampleData={sampleDataField.state.value}
                sampleDataEditing={{
                  saved: true,
                  onChange: (next) => autosave.edit(() => sampleDataField.handleChange(next)),
                  onCompositionStart: () => autosave.beginComposition(sampleDataField.name),
                  onCompositionEnd: (next) =>
                    autosave.endComposition(sampleDataField.name, () =>
                      sampleDataField.handleChange(next),
                    ),
                }}
              />
            )}
          </form.AppField>
        )}
      </form.AppField>
    )
  },
})

// ---------------------------------------------------------------------------
// Read-only layout (the built-in actions)

export function ReadOnlyLayoutField({
  action,
  customizeButton,
}: {
  action: Pick<SelectionToolbarCustomAction, "layout" | "outputSchema" | "sampleData">
  customizeButton?: React.ReactNode
}) {
  // A built-in action saves no sample data: edits here stay in this preview.
  const [sampleData, setSampleData] = useState(action.sampleData)
  const source = resolveActionLayout(action)
  const editorFields = useMemo(() => toEditorFields(action.outputSchema), [action.outputSchema])

  return (
    <Field>
      <LayoutHeading />
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{t("builtInHint")}</span>
        {customizeButton}
      </div>
      <LayoutPreview
        source={source}
        outputSchema={action.outputSchema}
        sampleData={sampleData}
        sampleDataEditing={{ saved: false, onChange: setSampleData }}
        frameClassName="max-h-[min(420px,55vh)]"
      />
      <Collapsible>
        <CollapsibleTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="group/source -ml-2 text-muted-foreground"
            />
          }
        >
          <IconChevronDown className="-rotate-90 transition-transform group-data-[panel-open]/source:rotate-0" />
          {t("viewSource")}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Suspense fallback={<Skeleton className="h-72" />}>
            <LiquidCodeEditor
              value={source}
              fields={editorFields}
              maxLength={MAX_CUSTOM_ACTION_LAYOUT_LENGTH}
              readOnly
              maxHeight="480px"
              aria-labelledby={CUSTOM_ACTION_LAYOUT_SECTION_ID}
            />
          </Suspense>
        </CollapsibleContent>
      </Collapsible>
    </Field>
  )
}
