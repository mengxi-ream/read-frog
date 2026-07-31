// @vitest-environment jsdom

import type { ReactNode } from "react"
import type { Config } from "@/types/config/config"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CustomPromptsSection } from "../custom-prompts"
import { PreferenceSection } from "../preference"
import { SubtitlesStyleSection } from "../subtitles-style"

const { videoSubtitlesAtom, setVideoSubtitlesMock, testState } = vi.hoisted(() => ({
  videoSubtitlesAtom: {},
  setVideoSubtitlesMock: vi.fn<(value: Partial<Config["videoSubtitles"]>) => Promise<void>>(),
  testState: {
    videoSubtitles: null as Config["videoSubtitles"] | null,
  },
}))

vi.mock("jotai", () => ({
  useAtom: (atom: object) => {
    if (atom !== videoSubtitlesAtom || !testState.videoSubtitles) {
      throw new Error("Unexpected atom")
    }
    return [testState.videoSubtitles, setVideoSubtitlesMock]
  },
}))

vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: {
    videoSubtitles: videoSubtitlesAtom,
  },
}))

function renderInRouter(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe("video subtitles page sections", () => {
  beforeEach(() => {
    testState.videoSubtitles = structuredClone(DEFAULT_CONFIG.videoSubtitles)
    setVideoSubtitlesMock.mockReset()
    setVideoSubtitlesMock.mockResolvedValue()
  })

  it("sends the style row to the page that holds the editor", () => {
    renderInRouter(<SubtitlesStyleSection />)

    expect(screen.getByRole("link")).toHaveAttribute("href", "/video-subtitles/style")
  })

  it("sends the prompts row to the page that holds the prompt list", () => {
    renderInRouter(<CustomPromptsSection />)

    expect(screen.getByRole("link")).toHaveAttribute("href", "/video-subtitles/prompts")
  })

  it("writes each switch on its own, leaving the other two alone", () => {
    renderInRouter(<PreferenceSection />)

    const [enable, autoStart, aiSegmentation] = screen.getAllByRole("switch")

    fireEvent.click(autoStart!)
    expect(setVideoSubtitlesMock).toHaveBeenCalledWith({ autoStart: true })

    fireEvent.click(enable!)
    expect(setVideoSubtitlesMock).toHaveBeenCalledWith({ enabled: false })

    fireEvent.click(aiSegmentation!)
    expect(setVideoSubtitlesMock).toHaveBeenCalledWith({ aiSegmentation: true })
  })
})
