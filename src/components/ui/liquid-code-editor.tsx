/**
 * Liquid Code Editor Component
 *
 * CodeMirror editor for custom action layouts (HTML + Liquid), cloned from
 * CSSCodeEditor. Lazy-load it: @codemirror/lang-liquid pulls in the HTML, CSS
 * and JavaScript languages.
 *
 * The document is owned by CodeMirror. `value` is only read to follow
 * external rewrites (a field rename, "restore default", the expanded editor):
 * those arrive as one minimal change, so the cursor stays put and the rewrite
 * is a single step in this editor's undo history.
 */

import type { Extension } from "@codemirror/state"
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror"
import type { LiquidEditorField } from "./liquid-code-editor-extensions"
import { forceLinting, lintGutter } from "@codemirror/lint"
import { EditorView } from "@codemirror/view"
import CodeMirror, { ExternalChange } from "@uiw/react-codemirror"
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react"
import { useTheme } from "@/components/providers/theme-provider"
import { cn } from "@/utils/styles/utils"
import {
  layoutLengthLimit,
  layoutLinter,
  liquidLayoutLanguage,
} from "./liquid-code-editor-extensions"

export type { LiquidEditorField } from "./liquid-code-editor-extensions"

export interface LiquidCodeEditorHandle {
  /**
   * Replaces the selection with `text` and puts the cursor `cursor` code
   * units into it (default: after it). With `wrap`, a non-empty selection is
   * kept and wrapped instead: `wrap[0]` + selection + `wrap[1]`. `prepend` is
   * inserted at the start of the document in the same change.
   */
  insert: (
    text: string,
    options?: { cursor?: number; wrap?: [string, string]; prepend?: string },
  ) => void
  focus: () => void
}

interface LiquidCodeEditorProps {
  value: string
  onChange?: (value: string) => void
  onBlur?: () => void
  onCompositionStart?: () => void
  onCompositionEnd?: (value: string) => void
  /** Rejected edit: it would have taken the text past `maxLength`. */
  onTooLong?: () => void
  fields: readonly LiquidEditorField[]
  maxLength: number
  readOnly?: boolean
  hasError?: boolean
  minHeight?: string
  maxHeight?: string
  height?: string
  className?: string
  "aria-labelledby"?: string
  handleRef?: React.Ref<LiquidCodeEditorHandle>
}

interface EditorBridge {
  value: string
  fields: readonly LiquidEditorField[]
  onChange?: (value: string) => void
  onCompositionStart?: () => void
  onCompositionEnd?: (value: string) => void
  onTooLong?: () => void
  composing: boolean
}

function createEditorExtensions(
  bridge: React.RefObject<EditorBridge>,
  options: { maxLength: number; ariaLabelledBy?: string },
): Extension[] {
  const setComposing = (view: EditorView, composing: boolean) => {
    const latest = bridge.current
    if (latest.composing === composing) return
    latest.composing = composing
    if (composing) latest.onCompositionStart?.()
    else latest.onCompositionEnd?.(view.state.doc.toString())
  }

  return [
    liquidLayoutLanguage(() => bridge.current.fields),
    layoutLinter({
      getFieldNames: () => bridge.current.fields.map((field) => field.name),
      maxLength: options.maxLength,
    }),
    lintGutter(),
    layoutLengthLimit(options.maxLength, () => bridge.current.onTooLong?.()),
    EditorView.lineWrapping,
    // IME: autosave waits for the composition to end. The DOM events are the
    // primary signal; `view.composing` covers input paths (EditContext) that do
    // not fire them on the content element.
    EditorView.domEventHandlers({
      compositionstart: (_event, view) => setComposing(view, true),
      compositionend: (_event, view) => setComposing(view, false),
      blur: (_event, view) => setComposing(view, false),
    }),
    EditorView.updateListener.of((update) => {
      if (update.view.composing) setComposing(update.view, true)
      else if (bridge.current.composing && update.docChanged) setComposing(update.view, false)
    }),
    ...(options.ariaLabelledBy
      ? [EditorView.contentAttributes.of({ "aria-labelledby": options.ariaLabelledBy })]
      : []),
  ]
}

// Module constants: @uiw/react-codemirror reconfigures the editor whenever the
// basicSetup object changes identity.
const EDITABLE_SETUP = {
  lineNumbers: true,
  highlightActiveLineGutter: true,
  highlightActiveLine: true,
  foldGutter: true,
  bracketMatching: true,
  closeBrackets: true,
  autocompletion: true,
  syntaxHighlighting: true,
}
const READ_ONLY_SETUP = {
  ...EDITABLE_SETUP,
  highlightActiveLineGutter: false,
  highlightActiveLine: false,
}

// The smallest single replacement turning `from` into `to`.
function diffTexts(from: string, to: string) {
  let start = 0
  const max = Math.min(from.length, to.length)
  while (start < max && from.charCodeAt(start) === to.charCodeAt(start)) start++
  let end = 0
  while (
    end < max - start &&
    from.charCodeAt(from.length - 1 - end) === to.charCodeAt(to.length - 1 - end)
  ) {
    end++
  }
  return { from: start, to: from.length - end, insert: to.slice(start, to.length - end) }
}

export function LiquidCodeEditor({
  value,
  onChange,
  onBlur,
  onCompositionStart,
  onCompositionEnd,
  onTooLong,
  fields,
  maxLength,
  readOnly = false,
  hasError,
  minHeight,
  maxHeight,
  height,
  className,
  "aria-labelledby": ariaLabelledBy,
  handleRef,
}: LiquidCodeEditorProps) {
  const { theme } = useTheme()
  const editorRef = useRef<ReactCodeMirrorRef>(null)
  // CodeMirror takes the document once; later values sync through the effect below.
  const [initialValue] = useState(value)

  // Extensions are built once per editor and read the latest props through this
  // ref, so a re-render never reconfigures (and re-lints) the editor.
  const latest = useRef<EditorBridge>({
    value,
    fields,
    onChange,
    onCompositionStart,
    onCompositionEnd,
    onTooLong,
    composing: false,
  })
  useLayoutEffect(() => {
    Object.assign(latest.current, {
      value,
      fields,
      onChange,
      onCompositionStart,
      onCompositionEnd,
      onTooLong,
    })
  })
  // `maxLength` and `aria-labelledby` are fixed for the editor's lifetime.
  // oxlint-disable-next-line react/refs -- the factory stores callbacks; they read the ref only when CodeMirror invokes them
  const [extensions] = useState(() => createEditorExtensions(latest, { maxLength, ariaLabelledBy }))
  // Stable, so @uiw/react-codemirror does not reconfigure on every render.
  // oxlint-disable-next-line react/refs -- read when CodeMirror reports a change, never during render
  const [handleChange] = useState(() => (next: string) => latest.current.onChange?.(next))

  // Follow external rewrites. Typing never lands here: onChange updates the
  // form synchronously, so by commit `value` already equals the document.
  useLayoutEffect(() => {
    const view = editorRef.current?.view
    if (!view) return
    const current = view.state.doc.toString()
    if (value === current) return
    view.dispatch({ changes: diffTexts(current, value), annotations: ExternalChange.of(true) })
  }, [value])

  // New field names change what the linter reports without a document change.
  const fieldKey = fields.map((field) => `${field.type}:${field.name}`).join("\n")
  useEffect(() => {
    const view = editorRef.current?.view
    if (view) forceLinting(view)
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- the key is a re-lint trigger, not a value the effect reads
  }, [fieldKey])

  useImperativeHandle(
    handleRef,
    () => ({
      insert(text, options = {}) {
        const view = editorRef.current?.view
        if (!view || view.state.readOnly) return
        const range = view.state.selection.main
        const selected = view.state.sliceDoc(range.from, range.to)
        const insert =
          options.wrap && selected ? `${options.wrap[0]}${selected}${options.wrap[1]}` : text
        const cursor = options.wrap && selected ? insert.length : (options.cursor ?? text.length)
        const prepend = options.prepend ?? ""
        const changes = [
          ...(prepend ? [{ from: 0, insert: prepend }] : []),
          { from: range.from, to: range.to, insert },
        ]
        view.dispatch({
          changes,
          selection: { anchor: prepend.length + range.from + cursor },
          scrollIntoView: true,
          userEvent: "input",
        })
        view.focus()
      },
      focus() {
        editorRef.current?.view?.focus()
      },
    }),
    [],
  )

  return (
    <CodeMirror
      ref={editorRef}
      value={initialValue}
      onChange={handleChange}
      onCreateEditor={(view) => {
        // The value may have moved on between first render and editor creation.
        const current = view.state.doc.toString()
        if (latest.current.value !== current) {
          view.dispatch({
            changes: diffTexts(current, latest.current.value),
            annotations: ExternalChange.of(true),
          })
        }
      }}
      onBlur={onBlur}
      extensions={extensions}
      theme={theme}
      readOnly={readOnly}
      minHeight={minHeight}
      maxHeight={maxHeight}
      height={height}
      basicSetup={readOnly ? READ_ONLY_SETUP : EDITABLE_SETUP}
      className={cn(
        // `isolate`: CodeMirror's gutters carry z-index 200; keep them from
        // painting over the sticky preview above the editor.
        "isolate overflow-hidden rounded-md border",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        hasError &&
          "border-destructive focus-within:border-destructive focus-within:ring-destructive/50",
        className,
      )}
      style={{
        fontSize: 13,
        fontFamily:
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", "Courier New", monospace',
      }}
    />
  )
}

LiquidCodeEditor.displayName = "LiquidCodeEditor"
