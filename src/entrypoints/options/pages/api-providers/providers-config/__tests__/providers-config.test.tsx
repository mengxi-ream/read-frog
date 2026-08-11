// @vitest-environment jsdom

import type { ReactNode } from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProvidersConfig } from "@/entrypoints/options/pages/api-providers/providers-config"
import {
  BUILT_IN_AI_PROVIDER_ID,
  BUILT_IN_AI_ULTRA_PROVIDER_ID,
} from "@/utils/providers/provider-registry"

const {
  anchoredToastAddMock,
  configAtom,
  providerWriteAtom,
  providersAtom,
  selectedProviderIdAtom,
  setProviderConfigMock,
  testState,
  writeConfigAtom,
} = vi.hoisted(() => ({
  anchoredToastAddMock: vi.fn<(options: unknown) => void>(),
  configAtom: {},
  providerWriteAtom: {},
  providersAtom: {},
  selectedProviderIdAtom: {},
  setProviderConfigMock: vi.fn<(value: unknown) => void>(),
  testState: { selectedProviderId: "provider-1" },
  writeConfigAtom: {},
}))

const providerConfig = {
  enabled: true,
  id: "provider-1",
  name: "Long Provider Name",
  provider: "openai",
}

const config = {
  languageDetection: { mode: "local" },
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
    if (atom === selectedProviderIdAtom)
      return (value: string) => {
        testState.selectedProviderId = value
      }
    return vi.fn<(value: unknown) => void>()
  },
}))

vi.mock("@/components/provider-icon", () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
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
  DialogTrigger: () => null,
}))

vi.mock("@/components/ui/base-ui/toast", () => ({
  anchoredToastManager: { add: anchoredToastAddMock },
}))

vi.mock("@/components/ui/base-ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  // Keep hover-only content out of the tree so editor-panel assertions do not
  // collide with the assignment names repeated inside card badges.
  TooltipContent: () => null,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/utils/atoms/config", () => ({
  configAtom,
  configFieldsAtomMap: { providersConfig: providersAtom },
  writeConfigAtom,
}))

vi.mock("@/utils/atoms/provider", () => ({
  providerConfigAtom: () => providerWriteAtom,
}))

vi.mock("@/utils/config/helpers", () => ({
  getAPIProvidersConfig: (providers: unknown[]) => providers,
  getProviderConfigById: (providers: (typeof providerConfig)[], id: string) =>
    providers.find((provider) => provider.id === id),
}))

vi.mock("@/utils/constants/feature-providers", () => ({
  FEATURE_KEYS: ["pageTranslation", "selectionTranslation", "noteSuggestion"],
  FEATURE_PROVIDER_DEFS: {
    pageTranslation: { getProviderId: () => providerConfig.id },
    selectionTranslation: { getProviderId: () => "unassigned-provider" },
    // Mirrors the shipped default: note suggestion runs on the OpenAI default
    // provider, so no built-in card starts with a feature assignment.
    noteSuggestion: { getProviderId: () => "openai-default" },
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

function makeUltraAccessStatus(accessAllowed: boolean) {
  return {
    credits: [],
    features: {
      pageTranslation: { ultra: { accessAllowed } },
      selectionTranslation: { ultra: { accessAllowed } },
      noteSuggestion: { ultra: { accessAllowed } },
      customAction: { ultra: { accessAllowed } },
    },
  }
}

const ULTRA_FEATURE_LABELS = [
  "feature.pageTranslation",
  "feature.selectionTranslation",
  "feature.noteSuggestion",
] as const

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string, values?: Array<string | number>) =>
      values ? `${key}:${values.join("|")}` : key,
  },
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

describe("ProvidersConfig", () => {
  beforeEach(() => {
    anchoredToastAddMock.mockReset()
    setProviderConfigMock.mockReset()
    testState.selectedProviderId = providerConfig.id
    hostedAiState.value = { status: undefined, isPending: false, isError: true }
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
    testState.selectedProviderId = BUILT_IN_AI_PROVIDER_ID

    renderProvidersConfig()

    expect(
      screen.getByText("options.apiProviders.providers.attribution.builtInAi"),
    ).toBeInTheDocument()
    expect(screen.queryByText("options.apiProviders.sponsorCta")).not.toBeInTheDocument()
    expect(screen.queryByText("options.apiProviders.form.duplicate")).not.toBeInTheDocument()
    expect(screen.queryByText("options.apiProviders.form.delete")).not.toBeInTheDocument()
    // Both tiers list every hosted-capable feature row; the normal tier marks
    // the Ultra-gated ones with the badge instead of hiding them.
    for (const label of ULTRA_FEATURE_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it("lists both built-in provider cards", () => {
    renderProvidersConfig()

    expect(screen.getByText("options.apiProviders.providers.name.builtInAi")).toBeInTheDocument()
    expect(
      screen.getByText("options.apiProviders.providers.name.builtInAiUltra"),
    ).toBeInTheDocument()
  })

  it("renders the Ultra editor with its own attribution and all three feature assignments", () => {
    testState.selectedProviderId = BUILT_IN_AI_ULTRA_PROVIDER_ID

    renderProvidersConfig()

    expect(
      screen.getByText("options.apiProviders.providers.attribution.builtInAiUltra"),
    ).toBeInTheDocument()
    for (const label of ULTRA_FEATURE_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.queryByText("options.apiProviders.sponsorCta")).not.toBeInTheDocument()
  })

  it("keeps Ultra assignment rows interactive while the plan status is unknown", () => {
    testState.selectedProviderId = BUILT_IN_AI_ULTRA_PROVIDER_ID
    // Default hostedAiState: settled error → status undefined → no verdict.

    renderProvidersConfig()

    for (const label of ULTRA_FEATURE_LABELS) {
      expect(screen.getByRole("switch", { name: label })).not.toHaveAttribute(
        "aria-disabled",
        "true",
      )
    }
  })

  it("locks Ultra assignment rows when the server denies ultra access", () => {
    testState.selectedProviderId = BUILT_IN_AI_ULTRA_PROVIDER_ID
    hostedAiState.value = {
      status: makeUltraAccessStatus(false),
      isPending: false,
      isError: false,
    }

    renderProvidersConfig()

    // base-ui renders a span[role=switch]; disabled surfaces as aria-disabled.
    for (const label of ULTRA_FEATURE_LABELS) {
      expect(screen.getByRole("switch", { name: label })).toHaveAttribute("aria-disabled", "true")
    }
  })

  it("unlocks Ultra assignment rows for an ultra-entitled account", () => {
    testState.selectedProviderId = BUILT_IN_AI_ULTRA_PROVIDER_ID
    hostedAiState.value = {
      status: makeUltraAccessStatus(true),
      isPending: false,
      isError: false,
    }

    renderProvidersConfig()

    for (const label of ULTRA_FEATURE_LABELS) {
      expect(screen.getByRole("switch", { name: label })).not.toBeDisabled()
    }
  })

  it("counts default assignments on the free Built-in AI card badge", () => {
    // Note suggestion defaults to the OpenAI provider, so only the built-in
    // Dictionary action counts on the free card; the Ultra card has nothing
    // assigned and shows no badge.
    const { container } = renderProvidersConfig()

    const freeCard = container.querySelector(`[data-provider-id="${BUILT_IN_AI_PROVIDER_ID}"]`)
    const ultraCard = container.querySelector(
      `[data-provider-id="${BUILT_IN_AI_ULTRA_PROVIDER_ID}"]`,
    )
    if (!(freeCard instanceof HTMLElement) || !(ultraCard instanceof HTMLElement)) {
      throw new Error("Built-in provider cards not rendered")
    }

    expect(
      within(freeCard).getByText("options.apiProviders.badges.featureCount:1"),
    ).toBeInTheDocument()
    expect(
      within(ultraCard).queryByText(/options\.apiProviders\.badges\.featureCount/),
    ).not.toBeInTheDocument()
  })

  it("opens the provider a ?provider= deep link names", () => {
    testState.selectedProviderId = BUILT_IN_AI_PROVIDER_ID

    renderProvidersConfig(`/api-providers?provider=${providerConfig.id}`)

    expect(testState.selectedProviderId).toBe(providerConfig.id)
  })

  it("keeps the current selection when the deep link names an unknown provider", () => {
    testState.selectedProviderId = BUILT_IN_AI_PROVIDER_ID

    renderProvidersConfig("/api-providers?provider=deleted-provider")

    expect(testState.selectedProviderId).toBe(BUILT_IN_AI_PROVIDER_ID)
  })
})
