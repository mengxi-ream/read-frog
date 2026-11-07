// @vitest-environment jsdom
import type { SubtitlesProvidersAdapter } from "../../universal-adapter"
import { afterEach, describe, expect, it, vi } from "vitest"
import { READ_FROG_SUBTITLES_UI_HOST_ID } from "@/utils/constants/subtitles"
import { mountSubtitlesUI, unmountSubtitlesUI } from "../mount-subtitles-ui"

vi.mock("../../ui/subtitles-container", () => ({ SubtitlesContainer: () => null }))
vi.mock("../../ui/subtitles-ui-context", () => ({
  SubtitlesProviders: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock("@/utils/i18n/locale-boundary", () => ({
  LocaleBoundary: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock("../mount-subtitles-toast", () => ({ mountSubtitlesToast: () => () => {} }))

const adapter = {} as SubtitlesProvidersAdapter

function addPlayer(id: string): HTMLElement {
  const player = document.createElement("div")
  player.id = id
  document.body.appendChild(player)
  return player
}

function mount(playerId: string) {
  return mountSubtitlesUI({
    adapter,
    config: { selectors: { video: "video", playerContainer: `#${playerId}` } },
  })
}

function hosts() {
  return document.querySelectorAll(`#${READ_FROG_SUBTITLES_UI_HOST_ID}`)
}

describe("mountSubtitlesUI", () => {
  afterEach(() => {
    unmountSubtitlesUI()
    document.body.innerHTML = ""
  })

  it("replaces a host left in the player by a dead instance of the script", async () => {
    const player = addPlayer("player")
    const staleHost = document.createElement("div")
    staleHost.id = READ_FROG_SUBTITLES_UI_HOST_ID
    const staleCleanup = vi.fn<() => void>()
    ;(staleHost as any).__reactShadowContainerCleanup = staleCleanup
    player.appendChild(staleHost)

    await mount("player")

    expect(staleCleanup).toHaveBeenCalledOnce()
    expect(staleHost.isConnected).toBe(false)
    expect(hosts()).toHaveLength(1)
    expect(hosts()[0]?.parentElement).toBe(player)
  })

  it("keeps the host it mounted when the player is the same", async () => {
    addPlayer("player")

    await mount("player")
    const host = hosts()[0]
    await mount("player")

    expect(hosts()).toHaveLength(1)
    expect(hosts()[0]).toBe(host)
  })

  it("moves to a new player", async () => {
    addPlayer("old-player")
    const newPlayer = addPlayer("new-player")

    await mount("old-player")
    const oldHost = hosts()[0]
    await mount("new-player")

    expect(oldHost?.isConnected).toBe(false)
    expect(hosts()).toHaveLength(1)
    expect(hosts()[0]?.parentElement).toBe(newPlayer)
  })
})
