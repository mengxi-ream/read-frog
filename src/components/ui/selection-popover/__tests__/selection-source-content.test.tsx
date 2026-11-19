// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { SelectionSourceContent } from "../selection-source-content"

vi.mock("@/hooks/use-text-to-speech", () => ({
  selectTTSVoice: (_config: unknown, language: string) => `voice:${language}`,
  useTextToSpeech: () => ({
    play: vi.fn<(...args: any[]) => any>(),
    stop: vi.fn<(...args: any[]) => any>(),
    isFetching: false,
    isPlaying: false,
  }),
}))

function renderSource(text: string | null) {
  const store = createStore()
  store.set(configAtom, DEFAULT_CONFIG)
  return render(
    <Provider store={store}>
      <TooltipProvider>
        <SelectionSourceContent text={text} emptyPlaceholder="—" />
      </TooltipProvider>
    </Provider>,
  )
}

// The copy and speak tooltips are the buttons' only accessible names.
function actionButtons() {
  return screen
    .queryAllByRole("button")
    .filter((button) => button.querySelector(".tabler-icon-copy, .tabler-icon-volume"))
}

describe("SelectionSourceContent", () => {
  afterEach(cleanup)

  it("shows copy and speak for the source text without expanding it", () => {
    renderSource("Hello there")

    expect(actionButtons()).toHaveLength(2)
  })

  it("shows no copy or speak when there is no source text", () => {
    renderSource(null)

    expect(screen.getByText("—")).toBeInTheDocument()
    expect(actionButtons()).toHaveLength(0)
  })
})
