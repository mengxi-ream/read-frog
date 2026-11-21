/**
 * CodeMirror extensions for the custom action Layout editor: the layout
 * engine's Liquid + HTML language, linter and field pills
 * (@read-frog/layout-engine/codemirror) in the extension's words, and the
 * length cap.
 *
 * Only liquid-code-editor.tsx (lazy-loaded on the options page) and its tests
 * import this: @codemirror/lang-liquid drags in lang-html, lang-css and
 * lang-javascript.
 */

import type { Diagnostic } from "@codemirror/lint"
import type { Extension } from "@codemirror/state"
import type { LayoutField, LayoutLintCode } from "@read-frog/layout-engine/contract"
import type { LayoutDiagnostic } from "@read-frog/layout-engine/editor"
import type { SelectionToolbarCustomActionOutputType } from "@/types/config/selection-toolbar"
import { linter } from "@codemirror/lint"
import { EditorState } from "@codemirror/state"
import { fieldPills, layoutLanguage, layoutLinter } from "@read-frog/layout-engine/codemirror"
import { analyzeLayout } from "@read-frog/layout-engine/editor"
import { ExternalChange } from "@uiw/react-codemirror"
import { i18n } from "@/utils/i18n"
import { createCustomActionLayoutHost, CUSTOM_ACTION_LAYOUT_HOST } from "@/utils/layout-host/host"

// A custom action output field, as the editor completes and lints it.
export interface LiquidEditorField extends LayoutField {
  type: SelectionToolbarCustomActionOutputType
}

// ---------------------------------------------------------------------------
// Completions

function describeField(field: LayoutField): string {
  return i18n.t(`dataTypes.${field.type as SelectionToolbarCustomActionOutputType}`)
}

export function liquidLayoutLanguage(getFields: () => readonly LiquidEditorField[]): Extension {
  return layoutLanguage({ host: CUSTOM_ACTION_LAYOUT_HOST, getFields, describeField })
}

// ---------------------------------------------------------------------------
// Field pills

// Each reference to a known output field (`["Term"]`, or a bare `Term`) shows
// as a pill with the field's name; the text keeps the reference. A pill is
// atomic: the cursor steps over it and Backspace deletes the whole reference.
// Unknown names stay text, for the linter to flag. Their colors come from
// `--rf-field-pill-background` / `--rf-field-pill-foreground`.
export function liquidLayoutFieldPills(getFields: () => readonly LiquidEditorField[]): Extension {
  return fieldPills({ host: CUSTOM_ACTION_LAYOUT_HOST, getFields })
}

// ---------------------------------------------------------------------------
// Diagnostics

const LINT_KEY = "options.selectionToolbar.customActions.form.layout.lint"

const CTX_KEYS = CUSTOM_ACTION_LAYOUT_HOST.ctxKeys

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
  mathFilterNotLast: ([filter = ""]) => i18n.t(`${LINT_KEY}.mathFilterNotLast`, [filter]),
  mathFilterInAttribute: ([filter = ""]) => i18n.t(`${LINT_KEY}.mathFilterInAttribute`, [filter]),
  // Not shown: findMediaFilterDiagnostics already marks every media filter.
  mediaFilterNotLast: () => i18n.t(`${LINT_KEY}.mediaFilterUnsupported`),
  mediaFilterInAttribute: () => i18n.t(`${LINT_KEY}.mediaFilterUnsupported`),
  tooLong: ([maxLength = ""]) => i18n.t(`${LINT_KEY}.tooLong`, [maxLength]),
  fieldNotShown: ([name = ""]) => i18n.t(`${LINT_KEY}.fieldNotShown`, [name]),
  reservedFieldName: ([name = ""]) => i18n.t(`${LINT_KEY}.reservedFieldName`, [name]),
}

function getLayoutDiagnosticMessage(diagnostic: LayoutDiagnostic): string {
  return LINT_MESSAGES[diagnostic.code](diagnostic.params ?? [])
}

// Codes the editor does not mark in the text: unused fields show as chips
// next to the editor instead of a squiggle at offset 0.
const OFF_TEXT_CODES: readonly LayoutLintCode[] = ["fieldNotShown"]

// The engine only flags a misplaced media filter. These layouts can't use one
// anywhere, and findMediaFilterDiagnostics says so at each use.
const MEDIA_FILTER_CODES: readonly LayoutLintCode[] = [
  "mediaFilterNotLast",
  "mediaFilterInAttribute",
]

const IGNORED_CODES: readonly LayoutLintCode[] = [...OFF_TEXT_CODES, ...MEDIA_FILTER_CODES]

/**
 * Marks each use of the layout engine's `media` filter. Custom action layouts
 * mount no media renderer, so the filter prints nothing visible: an empty
 * placeholder for media JSON, an empty string for anything else. The engine
 * accepts the filter, so without this a field written through it just goes
 * blank.
 */
export function findMediaFilterDiagnostics(source: string): Diagnostic[] {
  return analyzeLayout(source).values.flatMap((value) =>
    value.filters
      .filter((filter) => filter.name === "media")
      .map((filter): Diagnostic => ({
        from: filter.from,
        to: filter.to,
        severity: "warning",
        message: i18n.t(`${LINT_KEY}.mediaFilterUnsupported`),
      })),
  )
}

export function liquidLayoutLinter(options: {
  getFields: () => readonly LiquidEditorField[]
  maxLength: number
}): Extension {
  return [
    layoutLinter({
      host:
        options.maxLength === CUSTOM_ACTION_LAYOUT_HOST.maxSourceLength
          ? CUSTOM_ACTION_LAYOUT_HOST
          : createCustomActionLayoutHost(options.maxLength),
      getFields: options.getFields,
      message: getLayoutDiagnosticMessage,
      ignore: IGNORED_CODES,
    }),
    linter((view) => findMediaFilterDiagnostics(view.state.doc.toString())),
  ]
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
