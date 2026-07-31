// @vitest-environment jsdom

import type { ReactNode } from "react"
import type { Config } from "@/types/config/config"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { HoverTranslationSection } from "../hover-translation"
import { PersonalizedPromptsSection } from "../personalized-prompts"
import { PreferenceSection } from "../preference"
import { TranslationStyleSection } from "../translation-style"

const { translateAtom, setTranslateMock, testState } = vi.hoisted(() => ({
  translateAtom: {},
  setTranslateMock: vi.fn<(value: Partial<Config["translate"]>) => Promise<void>>(),
  testState: {
    translate: null as Config["translate"] | null,
  },
}))

vi.mock("jotai", () => ({
  useAtom: (atom: object) => {
    if (atom !== translateAtom || !testState.translate) {
      throw new Error("Unexpected atom")
    }
    return [testState.translate, setTranslateMock]
  },
  useAtomValue: (atom: object) => {
    if (atom !== translateAtom || !testState.translate) {
      throw new Error("Unexpected atom")
    }
    return testState.translate
  },
}))

vi.mock("@/utils/host/translate/ui/decorate-translation", () => ({
  decorateTranslationNode: vi.fn<() => void>(),
}))

vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: {
    translate: translateAtom,
  },
}))

vi.mock("@/components/ui/base-ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <button type="button" role="combobox">
      {children}
    </button>
  ),
  SelectValue: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div role="option">{children}</div>,
}))

function renderInRouter(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe("translation page sections", () => {
  beforeEach(() => {
    testState.translate = structuredClone(DEFAULT_CONFIG.translate)
    setTranslateMock.mockReset()
    setTranslateMock.mockResolvedValue()
  })

  it("sends the mode row to the shortcut that switches it", () => {
    renderInRouter(<PreferenceSection />)

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/shortcuts?section=translation-mode-shortcut",
    )
  })

  it("sends the hover row to the hotkey that triggers it", () => {
    renderInRouter(<HoverTranslationSection />)

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/shortcuts?section=node-translation-hotkey",
    )
  })

  it("shows the preset and its preview while the style is not custom", () => {
    testState.translate!.translationNodeStyle.isCustom = false

    const { container } = renderInRouter(<TranslationStyleSection />)

    expect(screen.getByRole("combobox")).toBeInTheDocument()
    expect(container.querySelector("#style-preview")).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("trades the preset and preview for a way into the CSS editor once the style is custom", () => {
    testState.translate!.translationNodeStyle.isCustom = true

    const { container } = renderInRouter(<TranslationStyleSection />)

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(container.querySelector("#style-preview")).not.toBeInTheDocument()
    expect(screen.getByRole("link")).toHaveAttribute("href", "/page-translation/custom-css")
  })

  it("sends the prompts row to the page that holds the prompt list", () => {
    renderInRouter(<PersonalizedPromptsSection />)

    expect(screen.getByRole("link")).toHaveAttribute("href", "/page-translation/prompts")
  })

  it("toggles hover translation without disturbing the hotkey it listens for", () => {
    const translate = testState.translate!
    translate.node.enabled = true

    renderInRouter(<HoverTranslationSection />)

    fireEvent.click(screen.getAllByRole("switch")[0]!)

    expect(setTranslateMock).toHaveBeenCalledWith({
      node: { ...translate.node, enabled: false },
    })
  })

  it("toggles fresh hover translations without disturbing the hover trigger", () => {
    const translate = testState.translate!

    renderInRouter(<HoverTranslationSection />)

    const switches = screen.getAllByRole("switch")
    expect(switches).toHaveLength(2)
    fireEvent.click(switches[1]!)

    expect(setTranslateMock).toHaveBeenCalledWith({
      node: { ...translate.node, forceRetranslation: true },
    })
  })
})
