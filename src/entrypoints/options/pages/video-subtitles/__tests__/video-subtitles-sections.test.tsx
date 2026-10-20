// @vitest-environment jsdom

import type { ReactNode } from "react"
import type { Config } from "@/types/config/config"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CustomPromptsSection } from "../custom-prompts"
import { PreferenceSection } from "../preference"
import { SubtitlesAutoStartPage } from "../preference/auto-start-page"
import { SubtitlesStyleSection } from "../subtitles-style"

type VideoSubtitlesUpdate =
  | Partial<Config["videoSubtitles"]>
  | ((current: Config["videoSubtitles"]) => Partial<Config["videoSubtitles"]>)

const { videoSubtitlesAtom, setVideoSubtitlesMock, testState } = vi.hoisted(() => ({
  videoSubtitlesAtom: {},
  setVideoSubtitlesMock: vi.fn<(value: VideoSubtitlesUpdate) => Promise<void>>(),
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

  it("sends the translate-on-open row to the page that holds the platform switches", () => {
    renderInRouter(<PreferenceSection />)

    expect(screen.getByRole("link", { name: /preference\.autoStart\.title/ })).toHaveAttribute(
      "href",
      "/video-subtitles/auto-start",
    )
  })

  it("writes each switch on its own, leaving the other alone", () => {
    renderInRouter(<PreferenceSection />)

    const [enable, aiSegmentation] = screen.getAllByRole("switch")

    fireEvent.click(enable!)
    expect(setVideoSubtitlesMock).toHaveBeenCalledWith({ enabled: false })

    fireEvent.click(aiSegmentation!)
    expect(setVideoSubtitlesMock).toHaveBeenCalledWith({ aiSegmentation: true })
  })

  it("turns translate-on-open on for one platform only", () => {
    testState.videoSubtitles!.autoStart = { youtube: true, xcom: false, netflix: false }
    renderInRouter(<SubtitlesAutoStartPage />)

    expect(screen.getByRole("switch", { name: "YouTube" })).toBeChecked()
    expect(screen.getByRole("switch", { name: "Netflix" })).not.toBeChecked()

    fireEvent.click(screen.getByRole("switch", { name: "X" }))

    const update = setVideoSubtitlesMock.mock.lastCall?.[0]
    expect(typeof update).toBe("function")
    expect(typeof update === "function" && update(testState.videoSubtitles!)).toEqual({
      autoStart: { youtube: true, xcom: true, netflix: false },
    })
  })
})
