// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { inputTextAtom, translateRequestAtom } from "@/entrypoints/translation-hub/atoms"
import { TextInput } from "@/entrypoints/translation-hub/components/text-input"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const { playMock, stopMock, speechState } = vi.hoisted(() => ({
  playMock: vi.fn<(text: string, config: object) => Promise<void>>(),
  stopMock: vi.fn<() => void>(),
  speechState: { isFetching: false, isPlaying: false },
}))

vi.mock("@/hooks/use-text-to-speech", () => ({
  useTextToSpeech: () => ({ play: playMock, stop: stopMock, ...speechState }),
}))

vi.mock("@/utils/i18n", () => ({
  i18n: { t: (key: string) => key },
}))

describe("Translation Hub source speech", () => {
  beforeEach(() => {
    playMock.mockReset().mockResolvedValue(undefined)
    stopMock.mockReset()
    speechState.isFetching = false
    speechState.isPlaying = false
  })

  it("speaks the current source text with the configured TTS settings", () => {
    const store = createStore()
    render(
      <Provider store={store}>
        <TextInput />
      </Provider>,
    )

    const speakButton = screen.getByRole("button", { name: "translationHub.speakSourceText" })
    expect(speakButton).toBeDisabled()

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hello world" } })
    fireEvent.click(speakButton)

    expect(playMock).toHaveBeenCalledWith("Hello world", DEFAULT_CONFIG.tts)
  })

  it("stops speech while audio is loading or playing, even if the input is cleared", () => {
    const store = createStore()
    store.set(inputTextAtom, "Hello world")
    speechState.isFetching = true
    const { rerender } = render(
      <Provider store={store}>
        <TextInput />
      </Provider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "speak.fetchingAudio" }))

    speechState.isFetching = false
    speechState.isPlaying = true
    store.set(inputTextAtom, "")
    rerender(
      <Provider store={store}>
        <TextInput />
      </Provider>,
    )
    fireEvent.click(screen.getByRole("button", { name: "action.playing" }))

    expect(stopMock).toHaveBeenCalledTimes(2)
    expect(playMock).not.toHaveBeenCalled()
  })

  it("keeps the translation action available beside speech", () => {
    const store = createStore()
    store.set(inputTextAtom, "Hello world")
    render(
      <Provider store={store}>
        <TextInput />
      </Provider>,
    )

    fireEvent.click(screen.getByRole("button", { name: /translationHub.translate/ }))

    expect(store.get(translateRequestAtom)).toMatchObject({ inputText: "Hello world" })
  })
})
