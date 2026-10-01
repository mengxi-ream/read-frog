// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SUPPORTED_UI_LOCALES } from "@/utils/i18n/locales"
import { IntroVideoButton, introVideoFor } from "../intro-video-button"

describe("introVideoFor", () => {
  it("plays the Chinese cut for both Chinese interfaces and the English cut for the rest", () => {
    for (const locale of SUPPORTED_UI_LOCALES) {
      const cut = locale === "zh-CN" || locale === "zh-TW" ? "zh-v4" : "en-v3"
      expect(introVideoFor(locale).src).toMatch(
        new RegExp(`/videos/features/custom-actions-${cut}\\.mp4$`),
      )
    }
  })

  it("pairs each cut with its poster", () => {
    for (const locale of ["en", "zh-CN"] as const) {
      const { src, poster } = introVideoFor(locale)
      expect(poster).toBe(src.replace(/\.mp4$/, ".webp"))
    }
  })
})

describe("IntroVideoButton", () => {
  it("opens the film for the interface language in a dialog", async () => {
    render(<IntroVideoButton />)

    fireEvent.click(
      screen.getByRole("button", {
        name: "options.selectionToolbar.customActions.introVideo.trigger",
      }),
    )

    const dialog = await screen.findByRole("dialog")
    const video = dialog.querySelector("video")
    expect(video).toHaveAttribute("src", introVideoFor("en").src)
    expect(video).toHaveAttribute("poster", introVideoFor("en").poster)
    expect(video).toHaveAttribute("controls")
  })
})
