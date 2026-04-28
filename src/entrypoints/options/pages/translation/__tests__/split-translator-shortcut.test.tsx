// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const i18nTMock = vi.hoisted(() => vi.fn((key: string) => key))
const setTranslateConfigMock = vi.fn()
const useAtomMock = vi.fn()
const translateAtomMock = Symbol("translate")
const defaultSplitTranslatorShortcutMock = "Alt+S"

let translateConfigMock: {
  page: {
    shortcut: string
  }
  splitTranslator: {
    shortcut?: string
  }
} = {
  page: {
    shortcut: "Alt+E",
  },
  splitTranslator: {
    shortcut: "Alt+S",
  },
}

vi.mock("#imports", () => ({
  i18n: {
    t: i18nTMock,
  },
}))

vi.mock("jotai", () => ({
  useAtom: (atom: unknown) => useAtomMock(atom),
}))

vi.mock("@/utils/atoms/config", () => ({
  configFieldsAtomMap: {
    translate: translateAtomMock,
  },
}))

vi.mock("@/utils/constants/translate", () => ({
  DEFAULT_SPLIT_TRANSLATOR_SHORTCUT_KEY: defaultSplitTranslatorShortcutMock,
}))

vi.mock("@/components/shortcut-key-recorder", () => ({
  ShortcutKeyRecorder: ({ shortcutKey, onChange }: { shortcutKey: string, onChange?: (shortcutKey: string) => void }) => (
    <div>
      <input aria-label="split-shortcut-recorder" readOnly value={shortcutKey} />
      <button type="button" onClick={() => onChange?.("Mod+Shift+S")}>record shortcut</button>
      <button type="button" onClick={() => onChange?.("")}>clear shortcut</button>
    </div>
  ),
}))

vi.mock("../../components/config-card", () => ({
  ConfigCard: ({ children, description, title }: { children: React.ReactNode, description: string, title: string }) => (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </section>
  ),
}))

afterEach(() => {
  vi.clearAllMocks()
  useAtomMock.mockImplementation(() => [translateConfigMock, setTranslateConfigMock])
  translateConfigMock = {
    page: {
      shortcut: "Alt+E",
    },
    splitTranslator: {
      shortcut: "Alt+S",
    },
  }
})

async function renderSplitTranslatorShortcut() {
  const { SplitTranslatorShortcut } = await import("../split-translator-shortcut")
  return render(<SplitTranslatorShortcut />)
}

describe("splitTranslatorShortcut", () => {
  beforeEach(() => {
    useAtomMock.mockImplementation(() => [translateConfigMock, setTranslateConfigMock])
  })

  it("renders the configured split translator shortcut", async () => {
    await renderSplitTranslatorShortcut()

    expect(useAtomMock).toHaveBeenCalledWith(translateAtomMock)
    expect(screen.getByText("options.translation.splitTranslatorShortcut.title")).toBeInTheDocument()
    expect(screen.getByText("options.translation.splitTranslatorShortcut.description")).toBeInTheDocument()
    expect(screen.getByLabelText("split-shortcut-recorder")).toHaveValue("Alt+S")
  })

  it("falls back to the default split translator shortcut when none is configured", async () => {
    translateConfigMock = {
      ...translateConfigMock,
      splitTranslator: {},
    }

    await renderSplitTranslatorShortcut()

    expect(screen.getByLabelText("split-shortcut-recorder")).toHaveValue(defaultSplitTranslatorShortcutMock)
  })

  it("writes recorded shortcuts to translate.splitTranslator.shortcut", async () => {
    await renderSplitTranslatorShortcut()

    fireEvent.click(screen.getByRole("button", { name: "record shortcut" }))

    expect(setTranslateConfigMock).toHaveBeenCalledWith({
      splitTranslator: {
        shortcut: "Mod+Shift+S",
      },
    })
  })

  it("writes an empty shortcut when users clear the recorder", async () => {
    await renderSplitTranslatorShortcut()

    fireEvent.click(screen.getByRole("button", { name: "clear shortcut" }))

    expect(setTranslateConfigMock).toHaveBeenCalledWith({
      splitTranslator: {
        shortcut: "",
      },
    })
  })
})
