// @vitest-environment jsdom
import { act } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { toastManager } from "@/components/ui/base-ui/toast"
import { SUBTITLES_THEME } from "@/utils/constants/subtitles"
import { mountSubtitlesToast } from "../mount-subtitles-toast"

describe("mountSubtitlesToast", () => {
  let cleanup: (() => void) | undefined

  afterEach(() => {
    act(() => toastManager.close())
    act(() => cleanup?.())
    cleanup = undefined
  })

  // The theme tokens live on the container's theme class. Portalled to the
  // shadow root itself, a toast sat beside the container and stayed light.
  it("renders toasts under the subtitles theme class", async () => {
    await act(async () => {
      cleanup = mountSubtitlesToast()
    })

    act(() => {
      toastManager.add({ title: "Subtitles unavailable", type: "error" })
    })

    const shadowRoot = document.getElementById("read-frog-subtitles-toast-host")?.shadowRoot
    const toast = shadowRoot?.querySelector('[data-slot="toast"]')
    expect(toast).toBeTruthy()
    expect(toast?.closest(`.${SUBTITLES_THEME}`)).toBeTruthy()
  })

  it("replaces a toast host left by a dead instance of the script", async () => {
    const staleHost = document.createElement("div")
    staleHost.id = "read-frog-subtitles-toast-host"
    document.body.appendChild(staleHost)

    await act(async () => {
      cleanup = mountSubtitlesToast()
    })

    const host = document.getElementById("read-frog-subtitles-toast-host")
    expect(staleHost.isConnected).toBe(false)
    expect(host?.shadowRoot).toBeTruthy()
  })

  it("returns the same cleanup while its host is mounted", async () => {
    await act(async () => {
      cleanup = mountSubtitlesToast()
    })

    expect(mountSubtitlesToast()).toBe(cleanup)
  })
})
