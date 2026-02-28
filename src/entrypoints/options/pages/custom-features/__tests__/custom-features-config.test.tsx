// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CustomFeaturesConfig } from "../custom-features-config"

const ADD_FEATURE_KEY = "options.floatingButtonAndToolbar.selectionToolbar.customFeatures.add"
const ADD_FIELD_KEY = "options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.addField"
const DEFAULT_FIELD_NAME_KEY = "options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.defaultFieldName"
const FIELD_NAME_PLACEHOLDER_KEY = "options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.fieldNamePlaceholder"

const mockedAtoms = vi.hoisted(() => ({
  providersConfigAtom: null as any,
  selectionToolbarAtom: null as any,
}))

vi.mock("@/components/providers/theme-provider", () => ({
  useTheme: () => ({ theme: "light" }),
}))

vi.mock("@/utils/atoms/config", async () => {
  const { atom } = await import("jotai")

  const selectionToolbarAtom = atom(DEFAULT_CONFIG.selectionToolbar)
  const providersConfigAtom = atom(DEFAULT_CONFIG.providersConfig)

  mockedAtoms.selectionToolbarAtom = selectionToolbarAtom
  mockedAtoms.providersConfigAtom = providersConfigAtom

  return {
    configFieldsAtomMap: {
      providersConfig: providersConfigAtom,
      selectionToolbar: selectionToolbarAtom,
    },
  }
})

function createStoreWithEmptyCustomFeatures() {
  const store = createStore()
  const defaultLlmProvider = DEFAULT_CONFIG.providersConfig.find(provider =>
    provider.provider === "openai" && provider.enabled,
  )
  if (!defaultLlmProvider) {
    throw new Error("Missing default enabled OpenAI provider")
  }

  store.set(mockedAtoms.selectionToolbarAtom, {
    ...DEFAULT_CONFIG.selectionToolbar,
    customFeatures: [],
  })
  store.set(mockedAtoms.providersConfigAtom, [defaultLlmProvider])
  return store
}

describe("custom features config", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", class {
      disconnect() {}
      observe() {}
      unobserve() {}
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it("does not crash when adding the first AI feature", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const store = createStoreWithEmptyCustomFeatures()

    render(
      <Provider store={store}>
        <CustomFeaturesConfig />
      </Provider>,
    )

    fireEvent.click(screen.getByRole("button", { name: ADD_FEATURE_KEY }))

    await waitFor(() => {
      expect(screen.getByDisplayValue(DEFAULT_FIELD_NAME_KEY)).toBeInTheDocument()
    })

    const errorOutput = consoleErrorSpy.mock.calls
      .flat()
      .map(arg => String(arg))
      .join("\n")
    expect(errorOutput).not.toContain("reading 'map'")
  })

  it("allows adding output fields right after first feature creation", async () => {
    const store = createStoreWithEmptyCustomFeatures()

    render(
      <Provider store={store}>
        <CustomFeaturesConfig />
      </Provider>,
    )

    fireEvent.click(screen.getByRole("button", { name: ADD_FEATURE_KEY }))

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText(FIELD_NAME_PLACEHOLDER_KEY)).toHaveLength(1)
    })

    fireEvent.click(screen.getByRole("button", { name: ADD_FIELD_KEY }))

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText(FIELD_NAME_PLACEHOLDER_KEY)).toHaveLength(2)
    })
  })
})
