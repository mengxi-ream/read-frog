// @vitest-environment jsdom
/**
 * Regression test for #1782: the options page crashed with
 * "Unrecognized extension value in extension set ([object Object])"
 * because the dependency graph resolved two copies of @codemirror/state
 * (and friends), so extensions created by one copy failed the other
 * copy's instanceof checks when EditorState flattened the extension set.
 *
 * These tests build the same extension sets as JSONCodeEditor,
 * CSSCodeEditor and LiquidCodeEditor (including react-codemirror's
 * basicSetup/theme defaults)
 * and resolve them through the app's own @codemirror/state instance.
 * They fail whenever the lockfile splits the CodeMirror packages again.
 */
import type { LayoutCompletionSource } from "@read-frog/layout-engine/codemirror"
import type { LiquidEditorField } from "../liquid-code-editor-extensions"
import { css } from "@codemirror/lang-css"
import { json, jsonParseLinter } from "@codemirror/lang-json"
import { closePercentBrace, liquid } from "@codemirror/lang-liquid"
import { linter, lintGutter } from "@codemirror/lint"
import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { DEFAULT_LAYOUT } from "@read-frog/layout-engine/presets"
import { color } from "@uiw/codemirror-extensions-color"
import {
  getDefaultExtensions,
  EditorState as ReactCodeMirrorEditorState,
} from "@uiw/react-codemirror"
import { describe, expect, it } from "vitest"
import { cssLinter } from "@/utils/css/lint-css"
import { i18n } from "@/utils/i18n"
import { CUSTOM_ACTION_LAYOUT_HOST } from "@/utils/layout-host/host"
import {
  layoutLengthLimit,
  liquidLayoutLanguage,
  liquidLayoutLinter,
} from "../liquid-code-editor-extensions"

describe("codeMirror extension sets resolve with a single @codemirror/state instance", () => {
  it("shares one EditorState between the app and @uiw/react-codemirror", () => {
    expect(ReactCodeMirrorEditorState).toBe(EditorState)
  })

  it("resolves the JSONCodeEditor extension set", () => {
    const allowEmptyJsonLinter = linter((view) => {
      const content = view.state.doc.toString().trim()
      if (!content) {
        return []
      }
      return jsonParseLinter()(view)
    })

    expect(() =>
      EditorState.create({
        extensions: [
          ...getDefaultExtensions({ theme: "dark" }),
          json(),
          allowEmptyJsonLinter,
          lintGutter(),
        ],
      }),
    ).not.toThrow()
  })

  it("resolves the CSSCodeEditor extension set", () => {
    expect(() =>
      EditorState.create({
        extensions: [
          ...getDefaultExtensions({ theme: "light" }),
          color,
          css(),
          cssLinter(),
          lintGutter(),
        ],
      }),
    ).not.toThrow()
  })

  it("resolves the LiquidCodeEditor extension set", () => {
    const fields = [{ id: "term", name: "term", type: "string" as const }]

    expect(() =>
      EditorState.create({
        doc: DEFAULT_LAYOUT,
        extensions: [
          ...getDefaultExtensions({ theme: "dark" }),
          liquidLayoutLanguage(() => fields),
          liquidLayoutLinter({ getFields: () => fields, maxLength: 32768 }),
          lintGutter(),
          layoutLengthLimit(32768, () => {}),
          EditorView.lineWrapping,
        ],
      }),
    ).not.toThrow()
  })
})

describe("liquid layout language", () => {
  // The layout engine's layoutLanguage swaps lang-liquid's stock completion
  // source by position, and lang-liquid is a peer dependency: the version
  // installed here is the one it gets. This fails first when an upgrade
  // reshapes liquid()'s support.
  it("still finds lang-liquid's support in the shape the layout engine swaps the completion into", () => {
    const parts = liquid().support
    expect(Array.isArray(parts)).toBe(true)
    expect(parts).toHaveLength(4)
    expect((parts as unknown[])[3]).toBe(closePercentBrace)
  })

  function complete(doc: string) {
    const fields: LiquidEditorField[] = [
      { id: "f1", name: "the term", type: "number", description: "" },
    ]
    const state = EditorState.create({ doc, extensions: [liquidLayoutLanguage(() => fields)] })
    const pos = doc.length
    // The subset of CompletionContext lang-liquid's source reads.
    const context = {
      state,
      pos,
      explicit: false,
      matchBefore(expr: RegExp) {
        const line = state.doc.lineAt(pos)
        const before = line.text.slice(0, pos - line.from)
        const match = new RegExp(`(?:${expr.source})$`).exec(before)
        return match ? { from: pos - match[0].length, to: pos, text: match[0] } : null
      },
    }
    // The layout engine's source replaces lang-liquid's stock one.
    const [source, ...others] = state.languageDataAt<LayoutCompletionSource>("autocomplete", pos)
    expect(others).toEqual([])
    return source!(context as unknown as Parameters<LayoutCompletionSource>[0])
  }

  it("completes output fields by name with their type, and ctx to the custom action keys", () => {
    const field = complete("{{ the")?.options.find((option) => option.label === "the term")
    expect(field).toMatchObject({ apply: '["the term"]', detail: i18n.t("dataTypes.number") })
    expect(field).not.toHaveProperty("info")

    expect(complete("{{ ctx.")?.options.map((option) => option.label)).toEqual(
      CUSTOM_ACTION_LAYOUT_HOST.ctxKeys,
    )
  })

  it("rejects typing past the length cap but lets an oversized text shrink", () => {
    let rejected = 0
    const state = EditorState.create({
      doc: "12345",
      extensions: [layoutLengthLimit(6, () => rejected++)],
    })

    expect(state.update({ changes: { from: 5, insert: "6" } }).state.doc.toString()).toBe("123456")
    expect(state.update({ changes: { from: 5, insert: "67" } }).state.doc.toString()).toBe("12345")

    const oversized = EditorState.create({
      doc: "123456789",
      extensions: [layoutLengthLimit(6, () => rejected++)],
    })
    expect(oversized.update({ changes: { from: 0, to: 1 } }).state.doc.toString()).toBe("23456789")
  })
})
