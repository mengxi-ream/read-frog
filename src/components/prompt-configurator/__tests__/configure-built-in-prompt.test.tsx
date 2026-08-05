// @vitest-environment jsdom

import type { ReactElement, ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ConfigurePrompt } from "../configure-prompt"

const { configAtom, setConfigMock, testState } = vi.hoisted(() => ({
  configAtom: {},
  setConfigMock: vi.fn<(value: unknown) => void>(),
  testState: {
    config: {
      promptId: "default",
      patterns: [] as Array<{
        id: string
        name: string
        systemPrompt: string
        prompt: string
      }>,
    },
  },
}))

const builtInPrompt = {
  id: "precision-rewrite",
  name: "Deep polish",
  description: "Polished translation",
  systemPrompt: "Built-in system prompt",
  prompt: "Built-in user prompt",
}

vi.mock("jotai", () => ({
  useAtom: () => [testState.config, setConfigMock],
  useAtomValue: () => false,
}))

vi.mock("@/utils/crypto-polyfill", () => ({
  getRandomUUID: () => "copied-prompt-id",
}))

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string, substitutions?: Array<string | number>) =>
      ({
        "options.translation.personalizedPrompts.copyAndCustomize": "Copy and customize",
        "options.translation.personalizedPrompts.copyName": `${substitutions?.[0]} copy`,
        "options.translation.personalizedPrompts.editPrompt.name": "Name",
        "options.translation.personalizedPrompts.editPrompt.systemPrompt": "System prompt",
        "options.translation.personalizedPrompts.editPrompt.prompt": "Prompt",
        "options.translation.personalizedPrompts.editPrompt.save": "Save changes",
        "options.translation.personalizedPrompts.editPrompt.close": "Cancel",
      })[key] ?? key,
  },
}))

vi.mock("@/components/prompt-configurator/context", () => ({
  usePromptAtoms: () => ({ config: configAtom, exportMode: {} }),
  usePromptInsertCells: () => [],
  useBuiltInPrompts: () => [builtInPrompt],
}))

vi.mock("@/components/ui/insertable-textarea", () => ({
  QuickInsertableTextarea: ({
    insertCells: _insertCells,
    ...props
  }: React.ComponentProps<"textarea"> & { insertCells?: unknown }) => <textarea {...props} />,
}))

vi.mock("@/components/ui/base-ui/sheet", async () => {
  const { cloneElement } = await import("react")
  const renderElement = (element: ReactElement, children: ReactNode) =>
    cloneElement(element, {}, children)

  return {
    Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SheetTrigger: ({
      render: renderProp,
      children,
    }: {
      render: ReactElement
      children: ReactNode
    }) => renderElement(renderProp, children),
    SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    SheetFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SheetClose: ({ render: renderProp, children }: { render: ReactElement; children: ReactNode }) =>
      renderElement(renderProp, children),
  }
})

describe("built-in prompt customization", () => {
  beforeEach(() => {
    testState.config = { promptId: "default", patterns: [] }
    setConfigMock.mockReset()
  })

  it("keeps the built-in read-only and does not write when copy is cancelled", () => {
    render(<ConfigurePrompt originPrompt={builtInPrompt} />)

    expect(screen.getByLabelText("Name")).toBeDisabled()
    expect(screen.getByDisplayValue("Built-in system prompt")).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Copy and customize" }))

    expect(screen.getByLabelText("Name")).toBeEnabled()
    expect(screen.getByLabelText("Name")).toHaveValue("Deep polish copy")
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(setConfigMock).not.toHaveBeenCalled()
  })

  it("saves a fresh custom copy and selects it", () => {
    render(<ConfigurePrompt originPrompt={builtInPrompt} />)

    fireEvent.click(screen.getByRole("button", { name: "Copy and customize" }))
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "My polished prompt" } })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(setConfigMock).toHaveBeenCalledWith({
      promptId: "copied-prompt-id",
      patterns: [
        {
          id: "copied-prompt-id",
          name: "My polished prompt",
          systemPrompt: "Built-in system prompt",
          prompt: "Built-in user prompt",
        },
      ],
    })
  })
})
