// @vitest-environment jsdom

import type { ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProvidersConfig } from "@/entrypoints/options/pages/api-providers/providers-config"

const {
  anchoredToastAddMock,
  configAtom,
  providerWriteAtom,
  providersAtom,
  selectedProviderIdAtom,
  setProviderConfigMock,
  writeConfigAtom,
} = vi.hoisted(() => ({
  anchoredToastAddMock: vi.fn<(options: unknown) => void>(),
  configAtom: {},
  providerWriteAtom: {},
  providersAtom: {},
  selectedProviderIdAtom: {},
  setProviderConfigMock: vi.fn<(value: unknown) => void>(),
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
      return [providerConfig.id, vi.fn<(value: unknown) => void>()]
    return [undefined, vi.fn<(value: unknown) => void>()]
  },
  useAtomValue: (atom: object) => {
    if (atom === selectedProviderIdAtom) return providerConfig.id
    if (atom === configAtom) return config
    return undefined
  },
  useSetAtom: (atom: object) =>
    atom === providerWriteAtom ? setProviderConfigMock : vi.fn<(value: unknown) => void>(),
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
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
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
}))

vi.mock("@/utils/constants/feature-providers", () => ({
  FEATURE_KEYS: ["translation"],
  FEATURE_PROVIDER_DEFS: {
    translation: { getProviderId: () => providerConfig.id },
  },
  getFeatureLabelI18nKey: () => "feature.translation",
}))

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string, values?: Array<string | number>) =>
      values ? `${key}:${values.join("|")}` : key,
  },
}))

vi.mock("@/entrypoints/options/components/config-card", () => ({
  ConfigCard: ({ children }: { children: ReactNode }) => <>{children}</>,
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

vi.mock("@/entrypoints/options/pages/api-providers/add-provider-dialog", () => ({
  default: () => null,
}))

vi.mock("@/entrypoints/options/pages/api-providers/atoms", () => ({
  selectedProviderIdAtom,
}))

vi.mock("@/entrypoints/options/pages/api-providers/provider-config-form", () => ({
  ProviderConfigForm: () => null,
}))

describe("ProvidersConfig", () => {
  beforeEach(() => {
    anchoredToastAddMock.mockReset()
    setProviderConfigMock.mockReset()
  })

  it("anchors an in-use disable error to the corresponding provider switch", () => {
    render(<ProvidersConfig />)

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
})
