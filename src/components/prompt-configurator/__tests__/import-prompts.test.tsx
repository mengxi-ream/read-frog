// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ImportPrompts } from "@/components/prompt-configurator/import-prompts"
import { analysisJSONFile } from "@/components/prompt-configurator/utils/prompt-file"

const { anchoredToastAddMock, setConfigMock } = vi.hoisted(() => ({
  anchoredToastAddMock: vi.fn<(options: unknown) => void>(),
  setConfigMock: vi.fn<(value: unknown) => void>(),
}))

vi.mock("jotai", () => ({
  useAtom: () => [{ patterns: [] }, setConfigMock],
}))

vi.mock("@/components/prompt-configurator/context", () => ({
  usePromptAtoms: () => ({ config: {} }),
}))

vi.mock("@/components/prompt-configurator/utils/prompt-file", () => ({
  analysisJSONFile: vi.fn<(file: File) => Promise<unknown>>(),
}))

vi.mock("@/components/ui/base-ui/toast", () => ({
  anchoredToastManager: { add: anchoredToastAddMock },
}))

vi.mock("@/utils/crypto-polyfill", () => ({
  getRandomUUID: () => "new-prompt-id",
}))

vi.mock("@/utils/i18n", () => ({
  i18n: { t: (key: string) => key },
}))

describe("ImportPrompts", () => {
  beforeEach(() => {
    anchoredToastAddMock.mockReset()
    setConfigMock.mockReset()
    vi.mocked(analysisJSONFile).mockReset()
  })

  it("anchors successful import feedback to the visible import button", async () => {
    vi.mocked(analysisJSONFile).mockResolvedValue([
      { name: "Imported", prompt: "Translate", systemPrompt: "" },
    ])
    render(<ImportPrompts />)

    const importButton = screen.getByRole("button")
    const input = document.querySelector<HTMLInputElement>("input[type='file']")
    const file = new File(["{}"], "prompts.json", { type: "application/json" })
    fireEvent.change(input!, { target: { files: [file] } })

    await waitFor(() => {
      expect(anchoredToastAddMock).toHaveBeenCalledWith({
        data: { tooltipStyle: true },
        id: "prompt-import-feedback",
        positionerProps: { anchor: importButton, sideOffset: 6 },
        title: "options.translation.personalizedPrompts.importSuccess !",
      })
    })
    expect(setConfigMock).toHaveBeenCalledOnce()
    expect(input).toHaveValue("")
  })

  it("anchors import errors to the visible import button with full error styling", async () => {
    vi.mocked(analysisJSONFile).mockRejectedValue(new Error("Invalid prompt file"))
    render(<ImportPrompts />)

    const importButton = screen.getByRole("button")
    const input = document.querySelector<HTMLInputElement>("input[type='file']")
    const file = new File(["invalid"], "prompts.json", { type: "application/json" })
    fireEvent.change(input!, { target: { files: [file] } })

    await waitFor(() => {
      expect(anchoredToastAddMock).toHaveBeenCalledWith({
        id: "prompt-import-feedback",
        positionerProps: { anchor: importButton, sideOffset: 6 },
        title: "Invalid prompt file",
        type: "error",
      })
    })
    expect(setConfigMock).not.toHaveBeenCalled()
    expect(input).toHaveValue("")
  })
})
