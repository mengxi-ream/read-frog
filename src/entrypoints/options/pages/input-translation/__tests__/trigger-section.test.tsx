// @vitest-environment jsdom

import type { Config } from "@/types/config/config"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { TriggerSection } from "../trigger"

const { inputTranslationAtom, setInputTranslationMock, addToastMock, testState } = vi.hoisted(
  () => ({
    inputTranslationAtom: {},
    setInputTranslationMock: vi.fn<(value: Config["inputTranslation"]) => Promise<void>>(),
    addToastMock: vi.fn<(toast: { type: string; title: string }) => void>(),
    testState: {
      inputTranslation: null as Config["inputTranslation"] | null,
    },
  }),
)

vi.mock("jotai", () => ({
  useAtom: (atom: object) => {
    if (atom !== inputTranslationAtom || !testState.inputTranslation) {
      throw new Error("Unexpected atom")
    }
    return [testState.inputTranslation, setInputTranslationMock]
  },
}))

vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: {
    inputTranslation: inputTranslationAtom,
  },
}))

vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: { add: addToastMock },
}))

describe("input translation trigger section", () => {
  beforeEach(() => {
    testState.inputTranslation = structuredClone(DEFAULT_CONFIG.inputTranslation)
    testState.inputTranslation.timeThreshold = 300
    setInputTranslationMock.mockReset()
    setInputTranslationMock.mockResolvedValue()
    addToastMock.mockReset()
  })

  it("turns the feature on without touching how it is triggered", () => {
    const inputTranslation = testState.inputTranslation!
    inputTranslation.enabled = false

    render(<TriggerSection />)
    fireEvent.click(screen.getByRole("switch"))

    expect(setInputTranslationMock).toHaveBeenCalledWith({ ...inputTranslation, enabled: true })
  })

  it("keeps the config on its last good value while a new one is typed out", () => {
    const inputTranslation = testState.inputTranslation!

    render(<TriggerSection />)
    const input = screen.getByRole("spinbutton")
    // "5" and "50" pass through on the way to 500, and neither is a threshold worth storing
    fireEvent.change(input, { target: { value: "5" } })
    fireEvent.change(input, { target: { value: "50" } })

    expect(setInputTranslationMock).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: "500" } })

    expect(setInputTranslationMock).toHaveBeenCalledWith({
      ...inputTranslation,
      timeThreshold: 500,
    })
  })

  it("says so and puts the stored value back when the field is left out of range", () => {
    render(<TriggerSection />)
    const input = screen.getByRole("spinbutton")
    fireEvent.change(input, { target: { value: "50" } })
    fireEvent.blur(input)

    expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }))
    expect(input).toHaveValue(300)
    expect(setInputTranslationMock).not.toHaveBeenCalled()
  })
})
