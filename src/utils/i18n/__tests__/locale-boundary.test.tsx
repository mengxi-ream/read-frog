// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react"
import i18next, { changeLanguage, init, t } from "i18next"
import { createStore, Provider } from "jotai"
import { useEffect } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { uiLanguageAtom, setUiLanguageMock } = await vi.hoisted(async () => {
  const { atom } = await import("jotai")
  return {
    uiLanguageAtom: atom("auto"),
    setUiLanguageMock: vi.fn<(uiLanguage: string) => Promise<void>>(),
  }
})

// vitest.setup.ts stubs the boundary out for every other test
vi.unmock("@/utils/i18n/locale-boundary")

vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: { uiLanguage: uiLanguageAtom },
}))

vi.mock("@/utils/i18n", () => ({
  setUiLanguage: setUiLanguageMock,
}))

const { LocaleBoundary } = await import("../locale-boundary")

let mounts = 0
function Greeting() {
  useEffect(() => {
    mounts += 1
  }, [])
  return <p>{t("greeting")}</p>
}

function renderBoundary(store = createStore()) {
  render(
    <Provider store={store}>
      <LocaleBoundary>
        <Greeting />
      </LocaleBoundary>
    </Provider>,
  )
  return store
}

describe("LocaleBoundary", () => {
  beforeEach(async () => {
    mounts = 0
    setUiLanguageMock.mockReset()
    await init({
      lng: "zh-CN",
      resources: {
        "zh-CN": { translation: { greeting: "你好" } },
        ja: { translation: { greeting: "こんにちは" } },
        en: { translation: { greeting: "hello" } },
      },
      initAsync: false,
    })
  })

  it("leaves the language initI18n set when its store starts from the default config", () => {
    renderBoundary()

    expect(setUiLanguageMock).not.toHaveBeenCalled()
    expect(i18next.language).toBe("zh-CN")
    expect(screen.getByText("你好")).toBeTruthy()
  })

  it("applies a later change of the configured language", () => {
    const store = renderBoundary()

    act(() => store.set(uiLanguageAtom, "ja"))

    expect(setUiLanguageMock).toHaveBeenCalledWith("ja")
  })

  it("follows a language another tree switched to", async () => {
    renderBoundary()
    expect(mounts).toBe(1)

    await act(async () => {
      await changeLanguage("ja")
    })

    expect(screen.getByText("こんにちは")).toBeTruthy()
    expect(mounts).toBe(2)
  })
})
