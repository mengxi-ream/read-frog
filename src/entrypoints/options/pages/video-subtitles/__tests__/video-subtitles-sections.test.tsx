// @vitest-environment jsdom

import type { ReactNode } from "react"
import type { Config } from "@/types/config/config"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CustomPromptsSection } from "../custom-prompts"
import { PreferenceSection } from "../preference"
import { SubtitlesSitesPage } from "../preference/sites-page"
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

vi.mock("../preference/word-lookup-action-item", () => ({
  WordLookupActionItem: () => null,
}))

function renderInRouter(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

// Base UI's select, driven the way notebase-connection-field.test.tsx does: the mousedown also
// schedules an open for the next frame, which has to run before an option is picked, or it
// reopens the select afterwards.
async function pick(trigger: HTMLElement, optionText: string) {
  await act(async () => {
    for (const type of ["pointerdown", "mousedown", "click"]) {
      trigger.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }))
    }
  })
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  const option = (await screen.findAllByRole("option")).find(
    (element) => element.textContent === optionText,
  )!
  await act(async () => {
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      option.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }))
    }
  })
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

  it("sends the enable row to the page that holds each platform's mode", () => {
    renderInRouter(<PreferenceSection />)

    expect(screen.getByRole("link", { name: /preference\.enable\.title/ })).toHaveAttribute(
      "href",
      "/video-subtitles/sites",
    )
  })

  it("greys out the logo of each platform that is off, and only those", () => {
    testState.videoSubtitles!.platforms.netflix = "off"
    testState.videoSubtitles!.platforms.youtube = "auto"
    renderInRouter(<PreferenceSection />)

    const logos = screen
      .getByRole("link", { name: /preference\.enable\.title/ })
      .querySelectorAll("svg")
    expect(logos).toHaveLength(6)
    expect([...logos].filter((logo) => logo.classList.contains("grayscale"))).toHaveLength(1)
  })

  it("writes each switch on its own, leaving the other alone", () => {
    renderInRouter(<PreferenceSection />)

    const [aiSegmentation, pauseOnHover] = screen.getAllByRole("switch")

    fireEvent.click(aiSegmentation!)
    expect(setVideoSubtitlesMock).toHaveBeenCalledWith({ aiSegmentation: true })

    expect(pauseOnHover).not.toBeChecked()
    fireEvent.click(pauseOnHover!)
    expect(setVideoSubtitlesMock).toHaveBeenCalledWith({ pauseOnHover: true })
  })

  it("shows each platform's mode, and changes one platform only", async () => {
    testState.videoSubtitles!.platforms.youtube = "auto"
    testState.videoSubtitles!.platforms.netflix = "off"
    renderInRouter(<SubtitlesSitesPage />)

    const mode = (key: string) => `options.videoSubtitles.preference.enable.mode.${key}`
    expect(screen.getByRole("combobox", { name: "YouTube" })).toHaveTextContent(mode("auto"))
    expect(screen.getByRole("combobox", { name: "Netflix" })).toHaveTextContent(mode("off"))
    expect(screen.getByRole("combobox", { name: "X" })).toHaveTextContent(mode("manual"))

    await pick(screen.getByRole("combobox", { name: "X" }), mode("off"))

    const update = setVideoSubtitlesMock.mock.lastCall?.[0]
    expect(typeof update).toBe("function")
    expect(typeof update === "function" && update(testState.videoSubtitles!)).toEqual({
      platforms: { ...testState.videoSubtitles!.platforms, xcom: "off" },
    })
  })
})
