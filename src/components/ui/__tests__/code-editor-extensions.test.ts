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
import {
  createLayoutCompletionSource,
  layoutLengthLimit,
  layoutLinter,
  liquidLayoutLanguage,
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
    const fields = [{ name: "term", type: "string" as const }]

    expect(() =>
      EditorState.create({
        doc: DEFAULT_LAYOUT,
        extensions: [
          ...getDefaultExtensions({ theme: "dark" }),
          liquidLayoutLanguage(() => fields),
          layoutLinter({ getFieldNames: () => ["term"], maxLength: 32768 }),
          lintGutter(),
          layoutLengthLimit(32768, () => {}),
          EditorView.lineWrapping,
        ],
      }),
    ).not.toThrow()
  })
})

describe("liquid layout language", () => {
  // liquidLayoutLanguage swaps lang-liquid's stock completion source by
  // position; this fails first when an upgrade reshapes liquid()'s support.
  it("still finds lang-liquid's support in the shape it swaps the completion into", () => {
    const parts = liquid().support
    expect(Array.isArray(parts)).toBe(true)
    expect(parts).toHaveLength(4)
    expect((parts as unknown[])[3]).toBe(closePercentBrace)
  })

  function complete(doc: string, explicit = false) {
    const state = EditorState.create({
      doc,
      extensions: [liquidLayoutLanguage(() => [{ name: "the term", type: "string" }])],
    })
    const pos = doc.length
    // The subset of CompletionContext lang-liquid's source reads.
    const context = {
      state,
      pos,
      explicit,
      matchBefore(expr: RegExp) {
        const line = state.doc.lineAt(pos)
        const before = line.text.slice(0, pos - line.from)
        const match = new RegExp(`(?:${expr.source})$`).exec(before)
        return match ? { from: pos - match[0].length, to: pos, text: match[0] } : null
      },
    }
    const source = createLayoutCompletionSource(() => [{ name: "the term", type: "string" }])
    return source(context as unknown as Parameters<typeof source>[0])
  }

  it("offers only tags the layout engine keeps", () => {
    const labels = complete("{% ", true)?.options.map((option) => option.label) ?? []
    expect(labels).toContain("if")
    expect(labels).toContain("assign")
    expect(labels).not.toContain("include")
    expect(labels).not.toContain("cycle")
    expect(labels).not.toContain("capture")
    expect(new Set(labels).size).toBe(labels.length)
  })

  it("completes fields to bracket references and ctx to its keys", () => {
    const field = complete("{{ the")?.options.find((option) => option.label === "the term")
    expect(field?.apply).toBe('["the term"]')

    const ctxKeys = complete("{{ ctx.")?.options.map((option) => option.label)
    expect(ctxKeys).toEqual([
      "fields",
      "selection",
      "targetLanguage",
      "sentenceAnalysisLabels",
      "improveWritingLabels",
      "status",
    ])
  })

  it("offers the ctx.fields entry keys on the loop variable", () => {
    const keys = complete("{% for f in ctx.fields %}{{ f.")?.options.map((option) => option.label)
    expect(keys).toEqual(["id", "name", "type", "value", "pending"])
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
