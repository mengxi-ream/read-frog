/**
 * CodeMirror extensions for the custom action Layout editor: Liquid + HTML
 * highlighting, completions limited to what the layout engine accepts, the
 * layout linter, and the length cap.
 *
 * Only liquid-code-editor.tsx (lazy-loaded on the options page) and its tests
 * import this: @codemirror/lang-liquid drags in lang-html, lang-css and
 * lang-javascript.
 */

import type { LiquidCompletionConfig } from "@codemirror/lang-liquid"
import type { Diagnostic } from "@codemirror/lint"
import type { Extension } from "@codemirror/state"
import type { LayoutField, LayoutHostSpec, LayoutLintCode } from "@read-frog/layout-engine/contract"
import type { LayoutDiagnostic } from "@read-frog/layout-engine/editor"
import { closePercentBrace, liquid, liquidCompletionSource } from "@codemirror/lang-liquid"
import { linter } from "@codemirror/lint"
import { EditorState } from "@codemirror/state"
import {
  formatFieldRef,
  LAYOUT_ALLOWED_TAGS,
  LAYOUT_CTX_FIELD_KEYS,
  LAYOUT_CTX_ROOT,
  LAYOUT_FILTER_NAMES,
} from "@read-frog/layout-engine/contract"
import { lintLayout } from "@read-frog/layout-engine/editor"
import { ExternalChange } from "@uiw/react-codemirror"
import { i18n } from "@/utils/i18n"
import { createCustomActionLayoutHost, CUSTOM_ACTION_LAYOUT_HOST } from "@/utils/layout-host/host"

type Completion = NonNullable<LiquidCompletionConfig["variables"]>[number]
type CompletionSource = ReturnType<typeof liquidCompletionSource>

export interface LiquidEditorField {
  name: string
  type: "string" | "number"
  description?: string
}

// ---------------------------------------------------------------------------
// Completions

// Tags lang-liquid suggests that the layout engine deletes (they would only
// earn a parse error), plus keywords that exist for them alone.
const REMOVED_KEYWORDS = new Set([
  "cycle",
  "echo",
  "capture",
  "endcapture",
  "render",
  "include",
  "with",
  "as",
])

// Every filter the layout engine registers (the package pins this list to its
// registry), so a filter lang-liquid does not know still completes and one the
// engine lacks (Shopify-only filters) never does.
const ENGINE_FILTERS: readonly string[] = LAYOUT_FILTER_NAMES

const ALLOWED_FILTERS = new Set(ENGINE_FILTERS)

const FILTER_COMPLETIONS: Completion[] = ENGINE_FILTERS.map((label) => ({
  label,
  type: "function",
}))

const TAG_COMPLETIONS: Completion[] = LAYOUT_ALLOWED_TAGS.filter((tag) => tag !== "#").map(
  (label) => ({ label, type: "keyword" }),
)

const CTX_KEYS = CUSTOM_ACTION_LAYOUT_HOST.ctxKeys

const CTX_COMPLETION: Completion = {
  label: LAYOUT_CTX_ROOT,
  type: "variable",
  detail: CTX_KEYS.join(" · "),
  boost: -1,
}

const CTX_KEY_COMPLETIONS: Completion[] = CTX_KEYS.map((label) => ({
  label,
  type: "property",
}))

const CTX_FIELD_KEY_COMPLETIONS: Completion[] = LAYOUT_CTX_FIELD_KEYS.map((label) => ({
  label,
  type: "property",
}))

// `{% for f in ctx.fields %}` makes `f.` complete to the ctx.fields entry keys.
function isCtxFieldsLoopVariable(doc: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(
    `(?:^|[\\s%-])for\\s+${escaped}\\s+in\\s+${LAYOUT_CTX_ROOT}\\.fields\\b`,
    "m",
  ).test(doc)
}

function fieldCompletion(field: LiquidEditorField): Completion {
  return {
    label: field.name,
    type: "variable",
    detail: i18n.t(`dataTypes.${field.type}`),
    ...(field.description ? { info: field.description } : {}),
    // Machine-written references are always the bracket form, which spells any name.
    apply: formatFieldRef(field.name),
    boost: 1,
  }
}

function isAllowedCompletion(option: Completion): boolean {
  if (option.type === "function") return ALLOWED_FILTERS.has(option.label)
  return !REMOVED_KEYWORDS.has(option.label)
}

export function createLayoutCompletionSource(
  getFields: () => readonly LiquidEditorField[],
): CompletionSource {
  return (context) => {
    const source = liquidCompletionSource({
      tags: TAG_COMPLETIONS,
      filters: FILTER_COMPLETIONS,
      variables: [CTX_COMPLETION, ...getFields().map(fieldCompletion)],
      properties: (path, state) => {
        if (path.length !== 1) return []
        if (path[0] === LAYOUT_CTX_ROOT) return CTX_KEY_COMPLETIONS
        return isCtxFieldsLoopVariable(state.doc.toString(), path[0]!)
          ? CTX_FIELD_KEY_COMPLETIONS
          : []
      },
    })
    const result = source(context)
    if (!result) return result
    // Inside a quoted name (`["te|`), a bracket reference would nest.
    const before = context.state.sliceDoc(result.from - 1, result.from)
    if (before === '"' || before === "'") return null

    const seen = new Set<string>()
    const options = result.options.filter((option) => {
      const key = `${option.type}:${option.label}`
      if (seen.has(key) || !isAllowedCompletion(option)) return false
      seen.add(key)
      return true
    })
    return options.length > 0 ? { ...result, options } : null
  }
}

/**
 * `liquid()` with its stock completion source swapped for ours. lang-liquid
 * 6.x builds its support as `[html support, completion, closeBrackets,
 * closePercentBrace]`; when that shape changes, both sources run instead.
 */
export function liquidLayoutLanguage(getFields: () => readonly LiquidEditorField[]): Extension {
  const support = liquid()
  const completion = support.language.data.of({
    autocomplete: createLayoutCompletionSource(getFields),
  })
  const parts = support.support
  if (Array.isArray(parts) && parts.length === 4 && parts[3] === closePercentBrace) {
    return [support.language, parts[0]!, completion, parts[2]!, parts[3]]
  }
  return [support, completion]
}

// ---------------------------------------------------------------------------
// Diagnostics

const LINT_KEY = "options.selectionToolbar.customActions.form.layout.lint"

const LINT_MESSAGES: Record<LayoutLintCode, (params: string[]) => string> = {
  parseError: ([message = ""]) => i18n.t(`${LINT_KEY}.parseError`, [message]),
  unknownField: ([name = ""]) => i18n.t(`${LINT_KEY}.unknownField`, [name]),
  unknownContextKey: ([key = ""]) =>
    i18n.t(`${LINT_KEY}.unknownContextKey`, [key, CTX_KEYS.join(", ")]),
  fieldShadowedByLocal: ([name = ""]) => i18n.t(`${LINT_KEY}.fieldShadowedByLocal`, [name]),
  liquidInStyle: () => i18n.t(`${LINT_KEY}.liquidInStyle`),
  styleInConditional: ([tag = ""]) => i18n.t(`${LINT_KEY}.styleInConditional`, [tag]),
  cssImport: () => i18n.t(`${LINT_KEY}.cssImport`),
  cssFontFace: () => i18n.t(`${LINT_KEY}.cssFontFace`),
  unquotedAttributeOutput: () => i18n.t(`${LINT_KEY}.unquotedAttributeOutput`),
  filterIgnored: ([tag = ""]) => i18n.t(`${LINT_KEY}.filterIgnored`, [tag]),
  newlineToBrNotLast: () => i18n.t(`${LINT_KEY}.newlineToBrNotLast`),
  tooLong: ([maxLength = ""]) => i18n.t(`${LINT_KEY}.tooLong`, [maxLength]),
  fieldNotShown: ([name = ""]) => i18n.t(`${LINT_KEY}.fieldNotShown`, [name]),
  reservedFieldName: ([name = ""]) => i18n.t(`${LINT_KEY}.reservedFieldName`, [name]),
}

export function getLayoutDiagnosticMessage(diagnostic: LayoutDiagnostic): string {
  return LINT_MESSAGES[diagnostic.code](diagnostic.params ?? [])
}

// Codes the editor does not mark in the text: unused fields show as chips
// next to the editor instead of a squiggle at offset 0.
const OFF_TEXT_CODES = new Set<LayoutLintCode>(["fieldNotShown"])

export function toEditorDiagnostics(
  diagnostics: LayoutDiagnostic[],
  docLength: number,
): Diagnostic[] {
  return diagnostics
    .filter((diagnostic) => !OFF_TEXT_CODES.has(diagnostic.code))
    .map((diagnostic) => {
      const from = Math.min(Math.max(diagnostic.from, 0), docLength)
      return {
        from,
        to: Math.min(Math.max(diagnostic.to, from), docLength),
        severity: diagnostic.severity,
        message: getLayoutDiagnosticMessage(diagnostic),
        source: "Liquid",
      }
    })
}

// Layouts reference output fields by name, so a name is all the linter needs.
function fieldsNamed(names: readonly string[]): LayoutField[] {
  return names.map((name) => ({ id: name, name, type: "string" }))
}

export function layoutLinter(options: {
  getFieldNames: () => string[]
  maxLength: number
}): Extension {
  const host: LayoutHostSpec =
    options.maxLength === CUSTOM_ACTION_LAYOUT_HOST.maxSourceLength
      ? CUSTOM_ACTION_LAYOUT_HOST
      : createCustomActionLayoutHost(options.maxLength)
  return linter(
    (view) => {
      const doc = view.state.doc.toString()
      return toEditorDiagnostics(
        lintLayout(doc, host, fieldsNamed(options.getFieldNames())),
        doc.length,
      )
    },
    { delay: 300 },
  )
}

// ---------------------------------------------------------------------------
// Length cap

/**
 * Rejects a typed or pasted edit that would take the layout past `maxLength`
 * (the config schema's cap), instead of letting the draft become unsaveable.
 * Edits that shrink an oversized text still go through, and so do external
 * rewrites (their callers check the cap themselves).
 */
export function layoutLengthLimit(maxLength: number, onReject: () => void): Extension {
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged || tr.annotation(ExternalChange)) return tr
    const length = tr.newDoc.length
    if (length <= maxLength || length <= tr.startState.doc.length) return tr
    queueMicrotask(onReject)
    return []
  })
}
