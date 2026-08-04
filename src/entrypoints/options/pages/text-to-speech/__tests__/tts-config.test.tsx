// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { OpenAICompatibleTTSSection } from "../backend"

vi.mock("@/hooks/use-text-to-speech", () => ({
  useTextToSpeech: () => ({
    play: vi.fn<() => Promise<void>>().mockResolvedValue(),
    stop: vi.fn<() => void>(),
    isFetching: false,
    isPlaying: false,
    currentChunk: 0,
    totalChunks: 0,
    error: null,
  }),
}))

function renderExternalTTSConfig() {
  const store = createStore()
  store.set(configAtom, {
    ...DEFAULT_CONFIG,
    tts: {
      ...DEFAULT_CONFIG.tts,
      backend: "openai-compatible",
    },
  })

  return render(
    <Provider store={store}>
      <OpenAICompatibleTTSSection />
    </Provider>,
  )
}

describe("OpenAI-compatible TTS settings", () => {
  it("keeps a single API Key field after repeated unchanged blur events", () => {
    renderExternalTTSConfig()

    for (let index = 0; index < 5; index += 1) {
      const apiKeyInput = screen.getByLabelText("options.tts.external.apiKey.label")
      fireEvent.focus(apiKeyInput)
      fireEvent.blur(apiKeyInput)
    }

    expect(screen.getAllByLabelText("options.tts.external.apiKey.label")).toHaveLength(1)
  })
})
