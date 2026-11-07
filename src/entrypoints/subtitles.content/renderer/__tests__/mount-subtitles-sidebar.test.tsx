// @vitest-environment jsdom
import type { SubtitlesProvidersAdapter } from "../../universal-adapter"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SUBTITLES_SIDEBAR_HOST_ID } from "@/utils/constants/subtitles"
import { mountSubtitlesSidebar, unmountSubtitlesSidebar } from "../mount-subtitles-sidebar"

vi.mock("@/utils/react-shadow-host/create-shadow-host", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/react-shadow-host/create-shadow-host")>()),
  createReactShadowHost: () => document.createElement("div"),
}))

const adapter = { supportsSidebar: true } as SubtitlesProvidersAdapter

function hosts() {
  return document.querySelectorAll(`#${SUBTITLES_SIDEBAR_HOST_ID}`)
}

describe("mountSubtitlesSidebar", () => {
  afterEach(() => {
    unmountSubtitlesSidebar()
    document.body.innerHTML = ""
  })

  it("replaces a sidebar left by a dead instance of the script", () => {
    const staleHost = document.createElement("div")
    staleHost.id = SUBTITLES_SIDEBAR_HOST_ID
    const staleCleanup = vi.fn<() => void>()
    ;(staleHost as any).__reactShadowContainerCleanup = staleCleanup
    document.body.appendChild(staleHost)

    mountSubtitlesSidebar(adapter)

    expect(staleCleanup).toHaveBeenCalledOnce()
    expect(staleHost.isConnected).toBe(false)
    expect(hosts()).toHaveLength(1)
  })

  it("keeps the sidebar it mounted", () => {
    mountSubtitlesSidebar(adapter)
    const host = hosts()[0]
    mountSubtitlesSidebar(adapter)

    expect(hosts()).toHaveLength(1)
    expect(hosts()[0]).toBe(host)
  })
})
