// @vitest-environment jsdom
/**
 * Regression test for #1782: the options page crashed with
 * "Unrecognized extension value in extension set ([object Object])"
 * because the dependency graph resolved two copies of @codemirror/state
 * (and friends), so extensions created by one copy failed the other
 * copy's instanceof checks when EditorState flattened the extension set.
 *
 * These tests build the same extension sets as JSONCodeEditor and
 * CSSCodeEditor (including react-codemirror's basicSetup/theme defaults)
 * and resolve them through the app's own @codemirror/state instance.
 * They fail whenever the lockfile splits the CodeMirror packages again.
 */
import { css } from "@codemirror/lang-css"
import { json, jsonParseLinter } from "@codemirror/lang-json"
import { linter, lintGutter } from "@codemirror/lint"
import { EditorState } from "@codemirror/state"
import { color } from "@uiw/codemirror-extensions-color"
import { getDefaultExtensions, EditorState as ReactCodeMirrorEditorState } from "@uiw/react-codemirror"
import { describe, expect, it } from "vitest"
import { cssLinter } from "@/utils/css/lint-css"

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

    expect(() => EditorState.create({
      extensions: [
        ...getDefaultExtensions({ theme: "dark" }),
        json(),
        allowEmptyJsonLinter,
        lintGutter(),
      ],
    })).not.toThrow()
  })

  it("resolves the CSSCodeEditor extension set", () => {
    expect(() => EditorState.create({
      extensions: [
        ...getDefaultExtensions({ theme: "light" }),
        color,
        css(),
        cssLinter(),
        lintGutter(),
      ],
    })).not.toThrow()
  })
})
