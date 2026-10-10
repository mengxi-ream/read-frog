/**
 * CodeMirror extensions for the custom action Layout editor: the layout
 * engine's Liquid + HTML language and linter
 * (@read-frog/layout-engine/codemirror) in the extension's words, and the
 * length cap.
 *
 * Only liquid-code-editor.tsx (lazy-loaded on the options page) and its tests
 * import this: @codemirror/lang-liquid drags in lang-html, lang-css and
 * lang-javascript.
 */

import type { Extension } from "@codemirror/state"
import type { LayoutField, LayoutLintCode } from "@read-frog/layout-engine/contract"
import type { LayoutDiagnostic } from "@read-frog/layout-engine/editor"
import type { SelectionToolbarCustomActionOutputType } from "@/types/config/selection-toolbar"
import { EditorState } from "@codemirror/state"
import { layoutLanguage, layoutLinter } from "@read-frog/layout-engine/codemirror"
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

export function liquidLayoutLinter(options: {
  getFields: () => readonly LiquidEditorField[]
  maxLength: number
}): Extension {
  return layoutLinter({
    host:
      options.maxLength === CUSTOM_ACTION_LAYOUT_HOST.maxSourceLength
        ? CUSTOM_ACTION_LAYOUT_HOST
        : createCustomActionLayoutHost(options.maxLength),
    getFields: options.getFields,
    message: getLayoutDiagnosticMessage,
    ignore: OFF_TEXT_CODES,
  })
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
