// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Thinking } from "@/components/thinking"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { SelectionSourceContent } from "../../components/selection-source-content"
import { StructuredObjectRenderer } from "../custom-action-button/structured-object-renderer"
import { TranslationContent } from "../translate-button/translation-content"

vi.mock("../../components/copy-button", () => ({
  CopyButton: () => <button type="button">Copy</button>,
}))

vi.mock("../../components/speak-button", () => ({
  SpeakButton: () => <button type="button">Speak</button>,
}))

vi.mock("../custom-action-button/field-speak-button", () => ({
  FieldSpeakButton: () => <button type="button">Field speak</button>,
}))

describe("selection toolbar text wrapping", () => {
  it("applies working wrap utilities to source and translated text", () => {
    const sourceText = "source-without-breaks.example/".repeat(4)
    const translatedText = "translated-without-breaks.example/".repeat(4)

    render(
      <TooltipProvider>
        <div>
          <SelectionSourceContent text={sourceText} />
          <TranslationContent
            selectionContent={sourceText}
            translatedText={translatedText}
            isTranslating={false}
            thinking={null}
          />
        </div>
      </TooltipProvider>,
    )

    const sourceNodes = screen.getAllByText(sourceText)
    const translatedNode = screen.getByText(translatedText)

    sourceNodes.forEach((node) => {
      expect(node).toHaveClass("break-words")
      expect(node.className).toContain("[overflow-wrap:anywhere]")
    })
    expect(translatedNode).toHaveClass("break-words")
    expect(translatedNode.className).toContain("[overflow-wrap:anywhere]")
  })

  it("applies working wrap utilities to structured object field values", () => {
    const value = "field-without-breaks.example/".repeat(5)

    render(
      <StructuredObjectRenderer
        outputSchema={[
          {
            id: "field-1",
            name: "Long Field",
            type: "string",
            description: "",
            speaking: false,
          },
        ]}
        value={{ "Long Field": value }}
        thinking={null}
      />,
    )

    const valueNode = screen.getByText(value)

    expect(valueNode).toHaveClass("break-words")
    expect(valueNode.className).toContain("[overflow-wrap:anywhere]")
  })

  it("applies working wrap utilities to thinking content", () => {
    const content = "thinking-without-breaks.example/".repeat(4)

    render(
      <Thinking
        status="thinking"
        content={content}
        defaultExpanded
      />,
    )

    const contentNode = screen.getByText(content)

    expect(contentNode).toHaveClass("break-words")
    expect(contentNode.className).toContain("[overflow-wrap:anywhere]")
  })
})
