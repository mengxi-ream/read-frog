// @vitest-environment jsdom

import type { ReactElement, ReactNode } from "react"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { cloneElement } from "react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProvidersConfig } from "@/entrypoints/options/pages/api-providers/providers-config"
import {
  LUNA_PROVIDER_ID,
  SOL_PROVIDER_ID,
  testHostedAiModels,
} from "@/utils/hosted-ai/__tests__/test-models"
import { sanitizeHostedAiModels } from "@/utils/hosted-ai/models"
import { DEFAULT_BUILT_IN_AI_PROVIDER_ID } from "@/utils/providers/provider-registry"

const {
  anchoredToastAddMock,
  configAtom,
  highlightedProviderFieldAtom,
  providerWriteAtom,
  providersAtom,
  selectedProviderIdAtom,
  setProviderConfigMock,
  testState,
  writeConfigMock,
  writeConfigAtom,
} = vi.hoisted(() => ({
  anchoredToastAddMock: vi.fn<(options: unknown) => void>(),
  configAtom: {},
  highlightedProviderFieldAtom: {},
  providerWriteAtom: {},
  providersAtom: {},
  selectedProviderIdAtom: {},
  setProviderConfigMock: vi.fn<(value: unknown) => void>(),
  testState: { selectedProviderId: "provider-1" },
  writeConfigMock: vi.fn<(value: unknown) => void>(),
  writeConfigAtom: {},
}))

const providerConfig = {
  enabled: true,
  id: "provider-1",
  name: "Long Provider Name",
  provider: "openai",
}

const config = {
  builtInAi: { models: {} as Record<string, { reasoning?: string }> },
  languageDetection: { mode: "basic", providerId: undefined as string | undefined },
  providersConfig: [providerConfig],
  selectionToolbar: { customActions: [] },
}

vi.mock("jotai", () => ({
  useAtom: (atom: object) => {
    if (atom === providersAtom) return [[providerConfig], vi.fn<(value: unknown) => void>()]
    if (atom === selectedProviderIdAtom)
      return [
        testState.selectedProviderId,
        (value: string) => {
          testState.selectedProviderId = value
        },
      ]
    return [undefined, vi.fn<(value: unknown) => void>()]
  },
  useAtomValue: (atom: object) => {
    if (atom === selectedProviderIdAtom) return testState.selectedProviderId
    if (atom === configAtom) return config
    if (atom === providersAtom) return [providerConfig]
    return undefined
  },
  useSetAtom: (atom: object) => {
    if (atom === providerWriteAtom) return setProviderConfigMock
    if (atom === writeConfigAtom) return writeConfigMock
    if (atom === selectedProviderIdAtom)
      return (value: string) => {
        testState.selectedProviderId = value
      }
    return vi.fn<(value: unknown) => void>()
  },
}))

vi.mock("@/components/provider-icon", () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
  normalizeLogoUrl: (logo: string) => logo,
}))

vi.mock("@/components/providers/theme-provider", () => ({
  useTheme: () => ({ theme: "light" }),
}))

vi.mock("@/components/sortable-list", () => ({
  SortableList: ({
    list,
    renderItem,
  }: {
    list: (typeof providerConfig)[]
    renderItem: (item: typeof providerConfig) => ReactNode
  }) => <>{list.map(renderItem)}</>,
}))

vi.mock("@/components/ui/base-ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogTrigger: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
}))

vi.mock("@/components/ui/base-ui/toast", () => ({
  anchoredToastManager: { add: anchoredToastAddMock },
}))

vi.mock("@/components/ui/base-ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  // Keep hover-only content out of the tree so editor-panel assertions do not
  // collide with the assignment names repeated inside card badges.
  TooltipContent: () => null,
  // Renders the element a trigger names, so a trigger's own role and name stay
  // queryable, as with base-ui.
  TooltipTrigger: ({
    children,
    render: element,
  }: {
    children?: ReactNode
    render?: ReactElement
  }) =>
    element
      ? children === undefined
        ? element
        : cloneElement(element, undefined, children)
      : children,
}))

vi.mock("@/utils/atoms/config", () => ({
  configAtom,
  configFieldsAtomMap: { providersConfig: providersAtom },
  writeConfigAtom,
}))

vi.mock("@/utils/atoms/entity-config", () => ({
  patchProviderConfigAtom: providerWriteAtom,
}))

vi.mock("@/utils/config/helpers", () => ({
  getAPIProvidersConfig: (providers: unknown[]) => providers,
  getProviderConfigById: (providers: (typeof providerConfig)[], id: string) =>
    providers.find((provider) => provider.id === id),
}))

vi.mock("@/utils/constants/feature-providers", () => ({
  FEATURE_KEYS: [
    "pageTranslation",
    "videoSubtitles",
    "selectionTranslation",
    "inputTranslation",
    "noteSuggestion",
  ],
  FEATURE_PROVIDER_DEFS: {
    pageTranslation: { getProviderId: () => providerConfig.id },
    selectionTranslation: { getProviderId: () => "unassigned-provider" },
    // Mirrors the shipped default: note suggestion runs on the OpenAI default
    // provider, so no built-in card starts with a feature assignment.
    noteSuggestion: { getProviderId: () => "openai-default" },
    // Both default to Microsoft, so neither starts assigned to a built-in.
    videoSubtitles: { getProviderId: () => "microsoft-translate-default" },
    inputTranslation: { getProviderId: () => "microsoft-translate-default" },
  },
  buildFeatureProviderPatch: () => ({}),
  getFeatureLabelI18nKey: (key: string) => `feature.${key}`,
}))

// The built-in panel gates Ultra assignment rows on the live plan; tests set
// hostedAiState.value per case (default: settled error, i.e. status unknown).
const { hostedAiState } = vi.hoisted(() => {
  const state: { value: { status: unknown; isPending: boolean; isError: boolean } } = {
    value: { status: undefined, isPending: false, isError: true },
  }
  return { hostedAiState: state }
})

vi.mock("@/components/llm-providers/use-hosted-ai-status", () => ({
  useHostedAiStatus: () => hostedAiState.value,
}))

// The model list the cards come from: the last one the extension saw, which
// tests set per case (default: the full catalog).
const { builtInAiModelsState } = vi.hoisted(() => {
  const state: { models: unknown } = { models: null }
  return { builtInAiModelsState: state }
})

vi.mock("@/components/llm-providers/use-built-in-ai-models", () => ({
  useBuiltInAiModels: () => ({ models: builtInAiModelsState.models, isLive: true }),
}))

function makeUltraAccessStatus(accessAllowed: boolean) {
  // A denial carries its reason: the server answers the advance tier of a
  // non-Ultra account with `ultra_required`, never with a bare accessAllowed
  // flag. The panel locks on the reason, so a fixture without one models a
  // state the wire cannot produce.
  //
  // `upgradeTo` is left off deliberately. The real wire sets it on the advance
  // tier of every non-Ultra account, but it renders the plan badge inside the
  // row's <label>, which then becomes part of the switch's accessible name and
  // breaks the `getByRole("switch", { name })` queries below. These cases are
  // about locking, not badging — the badge has its own test above.
  const advance = accessAllowed
    ? { accessAllowed: true, available: true, unavailableReason: null }
    : { accessAllowed: false, available: false, unavailableReason: "ultra_required" as const }
  return {
    pools: [],
    features: {
      pageTranslation: { advance },
      selectionTranslation: { advance },
      noteSuggestion: { advance },
      customAction: { advance },
      videoSubtitles: { advance },
      inputTranslation: { advance },
      languageDetection: { advance },
    },
  }
}

/** Must mirror the built-in hosted assignment rows, except dynamic custom actions. */
const BUILT_IN_ASSIGNMENT_LABELS = [
  "feature.pageTranslation",
  "feature.videoSubtitles",
  "feature.selectionTranslation",
  "feature.inputTranslation",
  "feature.noteSuggestion",
  "options.apiProviders.languageDetection.title",
] as const

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string, values?: Array<string | number>) =>
      values ? `${key}:${values.join("|")}` : key,
  },
  formatUiAlternatives: (items: readonly string[]) => items.join(" or "),
}))

vi.mock("@/entrypoints/options/components/config-item", () => ({
  ConfigItem: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/entrypoints/options/components/entity-editor-layout", () => ({
  EntityEditorLayout: ({ list, editor }: { list: ReactNode; editor: ReactNode }) => (
    <>
      {list}
      {editor}
    </>
  ),
}))

vi.mock("@/entrypoints/options/components/entity-list-rail", () => ({
  EntityListRail: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/entrypoints/options/pages/api-providers/providers-config/add-provider-dialog", () => ({
  default: () => null,
}))

vi.mock("@/entrypoints/options/pages/api-providers/providers-config/atoms", () => ({
  highlightedProviderFieldAtom,
  PROVIDER_FIELD_HIGHLIGHT_DURATION_MS: 2700,
  selectedProviderIdAtom,
}))

vi.mock("@/entrypoints/options/pages/api-providers/providers-config/provider-config-form", () => ({
  ProviderConfigForm: () => null,
}))

// `ProvidersConfig` reads the location to honour a `?provider=` deep link.
function renderProvidersConfig(initialEntry = "/api-providers") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ProvidersConfig />
    </MemoryRouter>,
  )
}

function getCard(container: HTMLElement, providerId: string): HTMLElement {
  const card = container.querySelector(`[data-provider-id="${providerId}"]`)
  if (!(card instanceof HTMLElement)) {
    throw new Error(`No card for ${providerId}`)
  }
  return card
}

function getReasoningTrigger() {
  return screen.getByRole("combobox", { name: "options.apiProviders.form.reasoning.title" })
}

/** Opens the reasoning select, picks `optionText`, and returns every option's text as listed. */
async function pickReasoning(optionText: string): Promise<(string | null)[]> {
  const trigger = getReasoningTrigger()
  await act(async () => {
    for (const type of ["pointerdown", "mousedown", "click"]) {
      trigger.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }))
    }
  })
  // The mousedown also schedules an open for the next animation frame. Let it
  // run now, or it reopens the select after the pick closes it.
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  const options = await screen.findAllByRole("option")
  const option = options.find((element) => element.textContent === optionText)
  if (!option) {
    throw new Error(`No option ${optionText}`)
  }
  const optionTexts = options.map((element) => element.textContent)
  await act(async () => {
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      option.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }))
    }
  })
  return optionTexts
}

describe("ProvidersConfig", () => {
  beforeEach(() => {
    anchoredToastAddMock.mockReset()
    setProviderConfigMock.mockReset()
    writeConfigMock.mockReset()
    testState.selectedProviderId = providerConfig.id
    config.languageDetection = { mode: "basic", providerId: undefined }
    config.builtInAi = { models: {} }
    hostedAiState.value = { status: undefined, isPending: false, isError: true }
    builtInAiModelsState.models = sanitizeHostedAiModels(testHostedAiModels())
  })

  it("anchors an in-use disable error to the corresponding provider switch", () => {
    renderProvidersConfig()

    const providerSwitch = screen.getByRole("switch", { name: providerConfig.name })
    fireEvent.click(providerSwitch)

    expect(setProviderConfigMock).not.toHaveBeenCalled()
    expect(anchoredToastAddMock).toHaveBeenCalledWith({
      id: "provider-disable-provider-1",
      positionerProps: { anchor: providerSwitch, sideOffset: 6 },
      title: "options.apiProviders.form.providerInUseCannotDisable:Long Provider Name|1",
      type: "error",
    })
  })

  it("renders the built-in provider composition without CRUD actions or a sponsor CTA", () => {
    testState.selectedProviderId = DEFAULT_BUILT_IN_AI_PROVIDER_ID

    renderProvidersConfig()

    expect(
      screen.getByText("options.apiProviders.providers.attribution.builtInAi"),
    ).toBeInTheDocument()
    expect(screen.queryByText("options.apiProviders.sponsorCta")).not.toBeInTheDocument()
    expect(screen.queryByText("options.apiProviders.form.duplicate")).not.toBeInTheDocument()
    expect(screen.queryByText("options.apiProviders.form.delete")).not.toBeInTheDocument()
    // Both tiers list every hosted-capable feature row; the normal tier marks
    // the Ultra-gated ones with the badge instead of hiding them.
    for (const label of BUILT_IN_ASSIGNMENT_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it("puts Add provider first, then the built-in providers, then the user's providers", () => {
    const { container } = renderProvidersConfig()

    const cardIds = [...container.querySelectorAll("[data-provider-id]")].map((card) =>
      card.getAttribute("data-provider-id"),
    )
    expect(cardIds).toEqual([
      "read-frog-ai:claude-haiku-5-5",
      DEFAULT_BUILT_IN_AI_PROVIDER_ID,
      "read-frog-ai:deepseek-v4.1-flash",
      SOL_PROVIDER_ID,
      "read-frog-ai:claude-sonnet-5-5",
      providerConfig.id,
    ])

    const inDocumentOrder = [
      screen.getByRole("button", { name: "options.apiProviders.addProvider" }),
      screen.getByRole("heading", { name: "options.apiProviders.builtInProvider" }),
      container.querySelector(`[data-provider-id="${SOL_PROVIDER_ID}"]`),
      screen.getByRole("heading", { name: "options.apiProviders.thirdPartyProviders" }),
      container.querySelector(`[data-provider-id="${providerConfig.id}"]`),
    ]
    for (let i = 1; i < inDocumentOrder.length; i++) {
      const previous = inDocumentOrder[i - 1]!
      const current = inDocumentOrder[i]!
      expect(previous.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
    }
  })

  it("lists a card per Built-in AI model, named as the server names it", () => {
    renderProvidersConfig()

    for (const name of [
      "Claude Haiku 5.5",
      "GPT-6 Luna",
      "DeepSeek V4.1 Flash",
      "GPT-6.2 Sol",
      "Claude Sonnet 5.5",
    ]) {
      expect(screen.getByRole("switch", { name })).toBeInTheDocument()
    }
  })

  it("keeps a card for a model the list dropped while something still uses it", () => {
    config.languageDetection = { mode: "llm", providerId: "read-frog-ai:gpt-5-mini" }

    const { container } = renderProvidersConfig()

    expect(container.querySelector('[data-provider-id="read-frog-ai:gpt-5-mini"]')).not.toBeNull()
    expect(screen.getByRole("switch", { name: "gpt-5-mini" })).toBeInTheDocument()
  })

  it("offers only the default model before any list has been seen", () => {
    builtInAiModelsState.models = null

    const { container } = renderProvidersConfig()

    const builtInIds = [...container.querySelectorAll("[data-provider-id]")]
      .map((card) => card.getAttribute("data-provider-id"))
      .filter((id) => id?.startsWith("read-frog-ai:"))
    expect(builtInIds).toEqual([DEFAULT_BUILT_IN_AI_PROVIDER_ID])
  })

  it("renders the Ultra editor with its own attribution and all three feature assignments", () => {
    testState.selectedProviderId = SOL_PROVIDER_ID

    renderProvidersConfig()

    expect(
      screen.getByText("options.apiProviders.providers.attribution.builtInAiAdvance"),
    ).toBeInTheDocument()
    for (const label of BUILT_IN_ASSIGNMENT_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.queryByText("options.apiProviders.sponsorCta")).not.toBeInTheDocument()
  })

  it("keeps Ultra assignment rows interactive while the plan status is unknown", () => {
    testState.selectedProviderId = SOL_PROVIDER_ID
    // Default hostedAiState: settled error → status undefined → no verdict.

    renderProvidersConfig()

    for (const label of BUILT_IN_ASSIGNMENT_LABELS) {
      expect(screen.getByRole("switch", { name: label })).not.toHaveAttribute(
        "aria-disabled",
        "true",
      )
    }
  })

  it("locks Ultra assignment rows when the server denies ultra access", () => {
    testState.selectedProviderId = SOL_PROVIDER_ID
    hostedAiState.value = {
      status: makeUltraAccessStatus(false),
      isPending: false,
      isError: false,
    }

    renderProvidersConfig()

    // base-ui renders a span[role=switch]; disabled surfaces as aria-disabled.
    for (const label of BUILT_IN_ASSIGNMENT_LABELS) {
      expect(screen.getByRole("switch", { name: label })).toHaveAttribute("aria-disabled", "true")
    }
  })

  it("unlocks Ultra assignment rows for an ultra-entitled account", () => {
    testState.selectedProviderId = SOL_PROVIDER_ID
    hostedAiState.value = {
      status: makeUltraAccessStatus(true),
      isPending: false,
      isError: false,
    }

    renderProvidersConfig()

    for (const label of BUILT_IN_ASSIGNMENT_LABELS) {
      expect(screen.getByRole("switch", { name: label })).not.toBeDisabled()
    }
  })

  it("assigns language detection from a Built-in AI editor", () => {
    testState.selectedProviderId = DEFAULT_BUILT_IN_AI_PROVIDER_ID

    renderProvidersConfig()
    fireEvent.click(
      screen.getByRole("switch", {
        name: "options.apiProviders.languageDetection.title",
      }),
    )

    expect(writeConfigMock).toHaveBeenCalledWith({
      languageDetection: {
        mode: "llm",
        providerId: DEFAULT_BUILT_IN_AI_PROVIDER_ID,
      },
    })
  })

  it("counts default assignments on the free Built-in AI card badge", () => {
    // Note suggestion defaults to the OpenAI provider, so only the built-in
    // Dictionary, Sentence Analysis and Improve Writing actions count on the
    // free card (Improve Writing is turned off, but still assigned to it); the
    // Ultra card has nothing assigned and shows no badge.
    const { container } = renderProvidersConfig()

    const freeCard = container.querySelector(
      `[data-provider-id="${DEFAULT_BUILT_IN_AI_PROVIDER_ID}"]`,
    )
    const ultraCard = container.querySelector(`[data-provider-id="${SOL_PROVIDER_ID}"]`)
    if (!(freeCard instanceof HTMLElement) || !(ultraCard instanceof HTMLElement)) {
      throw new Error("Built-in provider cards not rendered")
    }

    expect(
      within(freeCard).getByText("options.apiProviders.badges.featureCount:3"),
    ).toBeInTheDocument()
    expect(
      within(ultraCard).queryByText(/options\.apiProviders\.badges\.featureCount/),
    ).not.toBeInTheDocument()
  })

  it("counts language detection on the assigned Built-in AI card badge", () => {
    config.languageDetection = {
      mode: "llm",
      providerId: DEFAULT_BUILT_IN_AI_PROVIDER_ID,
    }

    const { container } = renderProvidersConfig()
    const freeCard = container.querySelector(
      `[data-provider-id="${DEFAULT_BUILT_IN_AI_PROVIDER_ID}"]`,
    )
    if (!(freeCard instanceof HTMLElement)) {
      throw new Error("Built-in provider card not rendered")
    }

    expect(
      within(freeCard).getByText("options.apiProviders.badges.featureCount:4"),
    ).toBeInTheDocument()
  })

  it("opens the provider a ?provider= deep link names", () => {
    testState.selectedProviderId = DEFAULT_BUILT_IN_AI_PROVIDER_ID

    renderProvidersConfig(`/api-providers?provider=${providerConfig.id}`)

    expect(testState.selectedProviderId).toBe(providerConfig.id)
  })

  it("keeps the current selection when the deep link names an unknown provider", () => {
    testState.selectedProviderId = DEFAULT_BUILT_IN_AI_PROVIDER_ID

    renderProvidersConfig("/api-providers?provider=deleted-provider")

    expect(testState.selectedProviderId).toBe(DEFAULT_BUILT_IN_AI_PROVIDER_ID)
  })

  it("marks a model the server cannot run now with a warning icon that says why", () => {
    builtInAiModelsState.models = sanitizeHostedAiModels(
      testHostedAiModels({ "gpt-6.2-sol": { available: false } }),
    )

    const { container } = renderProvidersConfig()

    // No "Unavailable" text: the icon's name carries the reason and the
    // models to switch to, so a screen reader reads both with the card.
    expect(
      within(getCard(container, SOL_PROVIDER_ID)).getByRole("img", {
        name: "hostedAi.unavailable.temporary:GPT-6.2 Sol|Claude Haiku 5.5 or GPT-6 Luna or DeepSeek V4.1 Flash",
      }),
    ).toBeInTheDocument()
    expect(
      within(getCard(container, LUNA_PROVIDER_ID)).queryByRole("img", {
        name: /hostedAi\.unavailable/,
      }),
    ).not.toBeInTheDocument()
  })

  it("says a model the list dropped is no longer offered", () => {
    config.languageDetection = { mode: "llm", providerId: "read-frog-ai:gpt-5-mini" }

    const { container } = renderProvidersConfig()

    expect(
      within(getCard(container, "read-frog-ai:gpt-5-mini")).getByRole("img", {
        name: "hostedAi.unavailable.removed:gpt-5-mini|Claude Haiku 5.5 or GPT-6 Luna or DeepSeek V4.1 Flash",
      }),
    ).toBeInTheDocument()
  })

  it("suggests only models the account can use instead of an unavailable one", () => {
    builtInAiModelsState.models = sanitizeHostedAiModels(
      testHostedAiModels({ "gpt-6-luna": { available: false } }),
    )
    hostedAiState.value = { status: makeUltraAccessStatus(false), isPending: false, isError: false }

    const { container } = renderProvidersConfig()

    expect(
      within(getCard(container, LUNA_PROVIDER_ID)).getByRole("img", {
        name: "hostedAi.unavailable.temporary:GPT-6 Luna|Claude Haiku 5.5 or DeepSeek V4.1 Flash",
      }),
    ).toBeInTheDocument()
  })

  it("does not call a model unavailable before any list has been seen", () => {
    builtInAiModelsState.models = null
    config.languageDetection = { mode: "llm", providerId: "read-frog-ai:gpt-5-mini" }

    renderProvidersConfig()

    expect(screen.queryByRole("img", { name: /hostedAi\.unavailable/ })).not.toBeInTheDocument()
  })

  it("says at the top of an unavailable model's panel what to switch to", () => {
    builtInAiModelsState.models = sanitizeHostedAiModels(
      testHostedAiModels({ "gpt-6.2-sol": { available: false } }),
    )
    testState.selectedProviderId = SOL_PROVIDER_ID

    renderProvidersConfig()

    expect(
      screen.getByText("options.apiProviders.builtInModel.unavailableTitle.temporary:GPT-6.2 Sol"),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "options.apiProviders.builtInModel.unavailableDescription:Claude Haiku 5.5 or GPT-6 Luna or DeepSeek V4.1 Flash",
      ),
    ).toBeInTheDocument()
  })

  it("says a dropped model's panel is no longer offered, with no reasoning to pick", () => {
    config.languageDetection = { mode: "llm", providerId: "read-frog-ai:gpt-5-mini" }
    testState.selectedProviderId = "read-frog-ai:gpt-5-mini"

    renderProvidersConfig()

    expect(
      screen.getByText("options.apiProviders.builtInModel.unavailableTitle.removed:gpt-5-mini"),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("combobox", { name: "options.apiProviders.form.reasoning.title" }),
    ).not.toBeInTheDocument()
  })

  it("shows no unavailable alert for a model that can run", () => {
    testState.selectedProviderId = LUNA_PROVIDER_ID

    renderProvidersConfig()

    expect(
      screen.queryByText(/options\.apiProviders\.builtInModel\.unavailableTitle/),
    ).not.toBeInTheDocument()
  })

  it("shows the model's default reasoning level until the user picks one", () => {
    testState.selectedProviderId = SOL_PROVIDER_ID

    renderProvidersConfig()

    expect(getReasoningTrigger()).toHaveTextContent(
      "options.apiProviders.builtInModel.reasoningLevels.low",
    )
    expect(
      screen.getByText("options.apiProviders.builtInModel.reasoningDescription:GPT-6.2 Sol"),
    ).toBeInTheDocument()
  })

  it("puts the reasoning field below the model's feature providers", () => {
    testState.selectedProviderId = SOL_PROVIDER_ID

    renderProvidersConfig()

    const reasoning = getReasoningTrigger()
    const switches = screen.getAllByRole("switch")
    expect(switches.length).toBeGreaterThan(0)
    for (const above of [
      screen.getByRole("button", { name: "options.apiProviders.featureProviders.title" }),
      ...switches,
    ]) {
      expect(above.compareDocumentPosition(reasoning) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
    }
  })

  it("shows the level the user picked for the model", () => {
    config.builtInAi = { models: { "gpt-6.2-sol": { reasoning: "high" } } }
    testState.selectedProviderId = SOL_PROVIDER_ID

    renderProvidersConfig()

    expect(getReasoningTrigger()).toHaveTextContent(
      "options.apiProviders.builtInModel.reasoningLevels.high",
    )
  })

  it("lists the model's levels with its default marked, and keeps the pick per model", async () => {
    testState.selectedProviderId = SOL_PROVIDER_ID

    renderProvidersConfig()
    const options = await pickReasoning("options.apiProviders.builtInModel.reasoningLevels.xhigh")

    expect(options).toEqual([
      "options.apiProviders.builtInModel.reasoningLevels.low" +
        "options.apiProviders.builtInModel.reasoningDefault",
      "options.apiProviders.builtInModel.reasoningLevels.medium",
      "options.apiProviders.builtInModel.reasoningLevels.high",
      "options.apiProviders.builtInModel.reasoningLevels.xhigh",
    ])
    expect(writeConfigMock).toHaveBeenCalledWith({
      builtInAi: { models: { "gpt-6.2-sol": { reasoning: "xhigh" } } },
    })
  })

  it("hides the reasoning field for a model with a single level", () => {
    builtInAiModelsState.models = sanitizeHostedAiModels(
      testHostedAiModels({
        "gpt-6-luna": { reasoning: { levels: ["none"], default: "none" } },
      }),
    )
    testState.selectedProviderId = LUNA_PROVIDER_ID

    renderProvidersConfig()

    expect(
      screen.queryByRole("combobox", { name: "options.apiProviders.form.reasoning.title" }),
    ).not.toBeInTheDocument()
  })
})
