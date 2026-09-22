// @vitest-environment jsdom

import type { LexicalEditor } from "lexical"
import { $createParagraphNode, $createTextNode, $getRoot, createEditor } from "lexical"
import { afterEach, describe, expect, it } from "vitest"
import { replaceLexical } from "../editors/lexical"
import { replaceText } from "../replace-text"

const editors: LexicalEditor[] = []

function createReply(text: string[], shadow = false) {
  const host = document.createElement("div")
  document.body.append(host)
  const container = shadow ? host.attachShadow({ mode: "open" }) : host
  const element = document.createElement("div")
  element.setAttribute("contenteditable", "true")
  element.tabIndex = 0
  // jsdom does not implement isContentEditable.
  Object.defineProperty(element, "isContentEditable", { value: true })
  container.append(element)
  const editor = createEditor({
    onError: (error) => {
      throw error
    },
  })
  editors.push(editor)
  editor.setRootElement(element)
  editor.update(
    () => {
      const root = $getRoot()
      for (const paragraph of text)
        root.append($createParagraphNode().append($createTextNode(paragraph)))
      root.selectEnd()
    },
    { discrete: true },
  )
  return { editor, element }
}

function editorText(editor: LexicalEditor) {
  return editor.getEditorState().read(() => $getRoot().getTextContent())
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.setRootElement(null)
  document.body.replaceChildren()
})

describe("Lexical input replacement", () => {
  it("replaces every paragraph in editor state and DOM, preserving translated newlines and tabs", () => {
    const { editor, element } = createReply(["你好", "谢谢你的分享"])
    expect(replaceLexical(element, "Hello\nThank you\tfor sharing.")).toBe(true)
    expect(editorText(editor)).toBe("Hello\nThank you\tfor sharing.")
    expect(element.textContent).toContain("Hello")
    expect(element.textContent).not.toContain("你好")

    // A later editor update must not restore the old DOM, as execCommand did.
    editor.update(() => $getRoot().getFirstChildOrThrow().markDirty(), { discrete: true })
    expect(element.textContent).toContain("Thank you")
  })

  it.each([false, true])("updates only the focused reply (shadow root: %s)", (shadow) => {
    const first = createReply(["第一条评论"])
    const second = createReply(["第二条回复"], shadow)
    second.element.focus()
    expect(replaceText("Second reply")).toBe(true)
    expect(editorText(first.editor)).toBe("第一条评论")
    expect(editorText(second.editor)).toBe("Second reply")
  })

  it("does not reuse another reply's editor instance", () => {
    const first = createReply(["第一条评论"])
    const impostor = document.createElement("div")
    Object.assign(impostor, { __lexicalEditor: first.editor })
    expect(replaceLexical(impostor, "Wrong reply")).toBe(false)
    expect(editorText(first.editor)).toBe("第一条评论")
  })
})
