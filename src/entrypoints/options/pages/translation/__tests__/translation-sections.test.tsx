// @vitest-environment jsdom

import type { ReactNode } from "react"
import type { Config } from "@/types/config/config"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { HoverTranslationSection } from "../hover-translation"
import { PreferenceSection } from "../preference"

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

  it("toggles hover translation without disturbing the hotkey it listens for", () => {
    const translate = testState.translate!
    translate.node.enabled = true

    renderInRouter(<HoverTranslationSection />)

    fireEvent.click(screen.getByRole("switch"))

    expect(setTranslateMock).toHaveBeenCalledWith({
      node: { ...translate.node, enabled: false },
    })
  })
})
