// @vitest-environment jsdom
import type { ProviderConfig } from "@/types/config/provider"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import {
  LUNA_PROVIDER_ID,
  SOL_PROVIDER_ID,
  testHostedAiModels,
} from "@/utils/hosted-ai/__tests__/test-models"
import { sanitizeHostedAiModels } from "@/utils/hosted-ai/models"
import { getBuiltInAiSelectorItems } from "@/utils/providers/provider-registry"
import ProviderSelector from "../provider-selector"

vi.mock("@/utils/content-script/background-asset-url", () => ({
  resolveContentScriptAssetBlob: vi.fn<(url: string) => Promise<Blob | null>>(),
  shouldProxyAssetUrl: () => false,
}))

vi.mock("@/components/providers/theme-provider", () => ({
  useTheme: () => ({ theme: "light" }),
}))

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string, values?: Array<string | number>) =>
      values ? `${key}:${values.join("|")}` : key,
  },
  formatUiAlternatives: (items: readonly string[]) => items.join(" or "),
}))

const OWN_OPENAI: ProviderConfig = {
  id: "openai-default",
  name: "OpenAI",
  enabled: true,
  provider: "openai",
  model: { model: "gpt-5-mini", isCustomModel: false, customModel: null },
}

const SOL_UNAVAILABLE_REASON =
  "hostedAi.unavailable.temporary:GPT-6.2 Sol|Claude Haiku 5.5 or GPT-6 Luna or DeepSeek V4.1 Flash"

/** The menu as a free account sees it, with GPT-6.2 Sol out of service. */
function getProviders(): ProviderSelectorOption[] {
  const models = sanitizeHostedAiModels(testHostedAiModels({ "gpt-6.2-sol": { available: false } }))
  const builtIn = getBuiltInAiSelectorItems(models).map((item) =>
    item.tier === "advance" ? { ...item, upgradeTo: "ultra" as const } : item,
  )
  return [...builtIn, OWN_OPENAI]
}

function renderSelector(
  value: string,
  onChange = vi.fn<(id: string) => void>(),
  selectContentProps?: { positionerClassName: string },
) {
  render(
    <TooltipProvider>
      <ProviderSelector
        providers={getProviders()}
        value={value}
        onChange={onChange}
        placeholder="Pick a provider"
        selectContentProps={selectContentProps}
      />
    </TooltipProvider>,
  )
  return onChange
}

async function hoverForTooltip(element: HTMLElement, text: string) {
  fireEvent.mouseEnter(element)
  fireEvent.focus(element)
  return waitFor(() => {
    const tooltip = [
      ...document.querySelectorAll<HTMLElement>("[data-slot='tooltip-content']"),
    ].find((candidate) => candidate.textContent === text)
    expect(tooltip).toBeDefined()
    return tooltip!
  })
}

async function openMenu() {
  const trigger = screen.getByRole("combobox")
  await act(async () => {
    for (const type of ["pointerdown", "mousedown", "click"]) {
      trigger.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }))
    }
  })
  // The mousedown also schedules an open for the next animation frame.
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  return screen.findAllByRole("option")
}

function findOption(options: HTMLElement[], name: string) {
  const option = options.find((element) => element.textContent?.startsWith(name))
  if (!option) {
    throw new Error(`No option ${name}`)
  }
  return option
}

describe("ProviderSelector with Built-in AI models", () => {
  it("lists the models flat, in the server's order, before the user's own providers", async () => {
    renderSelector(LUNA_PROVIDER_ID)

    const options = await openMenu()

    expect(options.map((option) => option.textContent)).toEqual([
      "Claude Haiku 5.5",
      "GPT-6 Luna",
      "DeepSeek V4.1 Flash",
      "GPT-6.2 SolUltra",
      "Claude Sonnet 5.5Ultra",
      "OpenAI",
    ])
  })

  it("marks a model that cannot run with a warning icon, named for the reason, not with text", async () => {
    renderSelector(LUNA_PROVIDER_ID)

    const sol = findOption(await openMenu(), "GPT-6.2 Sol")

    expect(within(sol).getByRole("img", { name: SOL_UNAVAILABLE_REASON })).toBeInTheDocument()
    // The row's text is the model's name alone; the Ultra badge, which a free
    // account would also see here, is not hidden behind the warning.
    expect(sol).toHaveTextContent(/^GPT-6\.2 SolUltra$/)
    expect(
      within(findOption(await screen.findAllByRole("option"), "GPT-6 Luna")).queryByRole("img", {
        name: /hostedAi\.unavailable/,
      }),
    ).not.toBeInTheDocument()
  })

  it("keeps an unavailable model selectable", async () => {
    const onChange = renderSelector(LUNA_PROVIDER_ID)

    const sol = findOption(await openMenu(), "GPT-6.2 Sol")
    expect(sol).not.toHaveAttribute("aria-disabled", "true")
    await act(async () => {
      for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
        sol.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }))
      }
    })

    expect(onChange).toHaveBeenCalledWith(SOL_PROVIDER_ID)
  })

  it("shows the warning next to a selected model that cannot run", () => {
    renderSelector(SOL_PROVIDER_ID)

    const trigger = screen.getByRole("combobox")
    expect(trigger).toHaveTextContent("GPT-6.2 Sol")
    expect(within(trigger).getByRole("img", { name: SOL_UNAVAILABLE_REASON })).toBeInTheDocument()
  })

  it("shows the selected model's icon without a warning when it can run", () => {
    renderSelector(LUNA_PROVIDER_ID)

    const trigger = screen.getByRole("combobox")
    expect(within(trigger).getByRole("img", { name: "GPT-6 Luna" }).getAttribute("src")).toMatch(
      /openai/,
    )
    expect(
      within(trigger).queryByRole("img", { name: /hostedAi\.unavailable/ }),
    ).not.toBeInTheDocument()
  })

  it("puts a row's tooltips on the menu's layer", async () => {
    // The selection popover passes its overlay layer: at the default z-50 the
    // tooltips would paint under the popover and the menu itself.
    renderSelector(LUNA_PROVIDER_ID, undefined, { positionerClassName: "overlay-layer" })

    const sol = findOption(await openMenu(), "GPT-6.2 Sol")
    const warning = await hoverForTooltip(
      within(sol).getByRole("img", { name: SOL_UNAVAILABLE_REASON }),
      SOL_UNAVAILABLE_REASON,
    )
    expect(warning.parentElement).toHaveClass("overlay-layer")

    const upgrade = await hoverForTooltip(
      within(sol).getByText("Ultra"),
      "hostedAi.planBadge.ultra",
    )
    expect(upgrade.parentElement).toHaveClass("overlay-layer")
  })

  it("shows the placeholder when the value is not one of the options", () => {
    renderSelector("read-frog-ai:not-offered")

    expect(screen.getByRole("combobox")).toHaveTextContent("Pick a provider")
  })
})
