import { describe, expect, it } from "vitest"
import { getYoutubeConfig } from "../config"

function fakePlayer(classes: string[] = []): HTMLElement {
  const classSet = new Set(classes)
  return {
    classList: {
      contains: (name: string) => classSet.has(name),
      add: (name: string) => {
        classSet.add(name)
      },
      remove: (name: string) => {
        classSet.delete(name)
      },
    },
  } as unknown as HTMLElement
}

describe("youtube isAdPlaying", () => {
  it("detects ad-showing and ad-interrupting on the player", () => {
    const { isAdPlaying } = getYoutubeConfig({ mode: "watch" })
    expect(isAdPlaying).toBeTypeOf("function")

    const player = fakePlayer()
    expect(isAdPlaying!(player)).toBe(false)

    player.classList.add("ad-showing")
    expect(isAdPlaying!(player)).toBe(true)

    player.classList.remove("ad-showing")
    player.classList.add("ad-interrupting")
    expect(isAdPlaying!(player)).toBe(true)
  })
})
