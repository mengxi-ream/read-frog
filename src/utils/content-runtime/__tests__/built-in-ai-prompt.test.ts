// @vitest-environment jsdom

import type { BuiltInAiRefusalPromptOptions } from "../built-in-ai-prompt"
import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ANALYTICS_FEATURE } from "@/types/analytics"
import { HostedAiProviderUnavailableError } from "@/utils/providers/provider-ref"
import {
  closeBuiltInAiPrompt,
  promptForBuiltInAiRefusal,
  useBuiltInAiPrompt,
} from "../built-in-ai-prompt"

const { mockGetBuiltInAiUpgradePlan, mockSendMessage, mockToastAdd, mockToastClose } = vi.hoisted(
  () => ({
    mockGetBuiltInAiUpgradePlan: vi.fn<() => Promise<"free" | "pro" | null>>(),
    mockSendMessage: vi.fn<(...args: any[]) => any>(),
    mockToastAdd: vi.fn<(...args: any[]) => any>(),
    mockToastClose: vi.fn<(...args: any[]) => any>(),
  }),
)

vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: { add: mockToastAdd, close: mockToastClose },
}))

vi.mock("@/utils/hosted-ai/upgrade-plan", () => ({
  getBuiltInAiUpgradePlan: mockGetBuiltInAiUpgradePlan,
}))

vi.mock("@/utils/message", () => ({
  sendMessage: mockSendMessage,
}))

/** The status check's refusal before a run: a guest. */
function guestRefusal() {
  return new HostedAiProviderUnavailableError(
    {} as never,
    "Log in to use Built-in AI",
    undefined,
    "authentication_required",
  )
}

/** The server's refusal during a run, relayed from the background: a spent pool. */
function spentPoolError() {
  return Object.assign(new Error("Built-in AI quota used up"), {
    code: "HOSTED_AI_QUOTA_EXHAUSTED",
  })
}

const OPTIONS: BuiltInAiRefusalPromptOptions = {
  feature: "inputTranslation",
  analyticsFeature: ANALYTICS_FEATURE.INPUT_TRANSLATION,
  trigger: "user",
}

function trackedEvents() {
  return mockSendMessage.mock.calls
    .filter(([type]) => type === "trackBuiltInAiPromptEvent")
    .map(([, event]) => event)
}

/** Renders what the selection UI's dialog reads, so this frame has a dialog host. */
function renderDialogHost() {
  return renderHook(() => useBuiltInAiPrompt())
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetBuiltInAiUpgradePlan.mockResolvedValue("free")
  mockSendMessage.mockResolvedValue(undefined)
  mockToastAdd.mockImplementation(({ id }: { id: string }) => id)
})

afterEach(() => {
  closeBuiltInAiPrompt()
})

describe("promptForBuiltInAiRefusal", () => {
  it("leaves anything but a refusal to the caller", async () => {
    renderDialogHost()

    await expect(promptForBuiltInAiRefusal(new Error("Failed"), OPTIONS)).resolves.toBe(false)
    await expect(
      promptForBuiltInAiRefusal(
        Object.assign(new Error("x"), { code: "HOSTED_AI_MODEL_UNAVAILABLE" }),
        OPTIONS,
      ),
    ).resolves.toBe(false)
    await expect(
      promptForBuiltInAiRefusal(
        new HostedAiProviderUnavailableError({} as never, "Down", undefined, "service_unavailable"),
        OPTIONS,
      ),
    ).resolves.toBe(false)

    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(trackedEvents()).toEqual([])
  })

  it("asks a guest the status check refused to log in, without reading the plan", async () => {
    const host = renderDialogHost()
    const retry = vi.fn<() => void>()

    await expect(promptForBuiltInAiRefusal(guestRefusal(), { ...OPTIONS, retry })).resolves.toBe(
      true,
    )

    await vi.waitFor(() =>
      expect(host.result.current).toEqual({
        kind: "logIn",
        feature: "inputTranslation",
        analyticsFeature: "input_translation",
        trigger: "user",
        retry,
      }),
    )
    expect(mockGetBuiltInAiUpgradePlan).not.toHaveBeenCalled()
    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(trackedEvents()).toEqual([
      {
        event: "built_in_ai_prompt_shown",
        properties: {
          feature: "input_translation",
          kind: "log_in",
          presentation: "dialog",
          trigger: "user",
        },
      },
    ])
  })

  it.each(["free", "pro"] as const)(
    "asks a %s account the server refused mid-run to upgrade",
    async (plan) => {
      mockGetBuiltInAiUpgradePlan.mockResolvedValue(plan)
      const host = renderDialogHost()

      await expect(promptForBuiltInAiRefusal(spentPoolError(), OPTIONS)).resolves.toBe(true)

      await vi.waitFor(() =>
        expect(host.result.current).toMatchObject({
          kind: "upgrade",
          plan,
          feature: "inputTranslation",
        }),
      )
      expect(trackedEvents()).toEqual([
        {
          event: "built_in_ai_prompt_shown",
          properties: {
            feature: "input_translation",
            kind: "upgrade",
            presentation: "dialog",
            trigger: "user",
          },
        },
      ])
    },
  )

  it("offers Ultra nothing: it has no plan to upgrade to", async () => {
    mockGetBuiltInAiUpgradePlan.mockResolvedValue(null)
    const host = renderDialogHost()

    await expect(promptForBuiltInAiRefusal(spentPoolError(), OPTIONS)).resolves.toBe(false)

    expect(host.result.current).toBeNull()
    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(trackedEvents()).toEqual([])
  })

  it("leaves a kind the caller doesn't ask about to the caller", async () => {
    renderDialogHost()

    await expect(
      promptForBuiltInAiRefusal(guestRefusal(), { ...OPTIONS, kinds: ["upgrade"] }),
    ).resolves.toBe(false)
    expect(trackedEvents()).toEqual([])
  })

  it("shows a toast with the upgrade button, carrying the feature, where no dialog is drawn", async () => {
    await expect(
      promptForBuiltInAiRefusal(spentPoolError(), {
        ...OPTIONS,
        feature: "videoSubtitles",
        analyticsFeature: ANALYTICS_FEATURE.VIDEO_SUBTITLES,
        trigger: "auto",
      }),
    ).resolves.toBe(true)

    expect(mockToastAdd).toHaveBeenCalledOnce()
    const toast = mockToastAdd.mock.calls[0]![0]
    expect(toast).toMatchObject({
      id: "built-in-ai-refusal-video_subtitles",
      type: "error",
      title: "Built-in AI quota used up",
    })
    expect(trackedEvents()).toEqual([
      {
        event: "built_in_ai_prompt_shown",
        properties: {
          feature: "video_subtitles",
          kind: "upgrade",
          presentation: "toast",
          trigger: "auto",
        },
      },
    ])

    toast.actionProps.onClick()

    expect(mockToastClose).toHaveBeenCalledWith("built-in-ai-refusal-video_subtitles")
    const opened = mockSendMessage.mock.calls.find(([type]) => type === "openPage")
    const url = new URL(opened![1].url)
    expect(url.pathname).toBe("/pricing")
    expect(url.searchParams.get("entry")).toBe("extension_quota_exhausted")
    expect(url.searchParams.get("feature")).toBe("video_subtitles")
    expect(trackedEvents()).toContainEqual({
      event: "built_in_ai_prompt_action",
      properties: {
        feature: "video_subtitles",
        kind: "upgrade",
        presentation: "toast",
        trigger: "auto",
        action: "upgrade",
      },
    })
  })

  it("gives a guest's toast the log-in button", async () => {
    await promptForBuiltInAiRefusal(guestRefusal(), OPTIONS)

    const toast = mockToastAdd.mock.calls[0]![0]
    toast.actionProps.onClick()

    const opened = mockSendMessage.mock.calls.find(([type]) => type === "openPage")
    expect(new URL(opened![1].url).pathname).toBe("/log-in")
    expect(trackedEvents()).toContainEqual({
      event: "built_in_ai_prompt_action",
      properties: {
        feature: "input_translation",
        kind: "log_in",
        presentation: "toast",
        trigger: "user",
        action: "log_in",
      },
    })
  })

  it("shows the toast when mayOpenDialog says no, and the dialog when it says yes", async () => {
    const host = renderDialogHost()
    const mayOpenDialog = vi.fn<() => Promise<boolean>>().mockResolvedValue(false)

    await promptForBuiltInAiRefusal(spentPoolError(), { ...OPTIONS, mayOpenDialog })

    expect(mayOpenDialog).toHaveBeenCalledWith("upgrade")
    expect(mockToastAdd).toHaveBeenCalledOnce()
    expect(host.result.current).toBeNull()

    mayOpenDialog.mockResolvedValue(true)
    await promptForBuiltInAiRefusal(spentPoolError(), { ...OPTIONS, mayOpenDialog })

    await vi.waitFor(() => expect(host.result.current).toMatchObject({ kind: "upgrade" }))
    expect(mockToastAdd).toHaveBeenCalledOnce()
  })

  it("falls back to the toast when mayOpenDialog fails", async () => {
    const host = renderDialogHost()

    await promptForBuiltInAiRefusal(spentPoolError(), {
      ...OPTIONS,
      mayOpenDialog: () => Promise.reject(new Error("Receiving end does not exist")),
    })

    expect(mockToastAdd).toHaveBeenCalledOnce()
    expect(host.result.current).toBeNull()
  })

  it("runs beforePrompt before opening the dialog", async () => {
    const host = renderDialogHost()
    const order: string[] = []
    let current: unknown = "unset"

    await promptForBuiltInAiRefusal(spentPoolError(), {
      ...OPTIONS,
      beforePrompt: () => {
        order.push("beforePrompt")
        current = host.result.current
      },
    })

    expect(order).toEqual(["beforePrompt"])
    expect(current).toBeNull()
    await vi.waitFor(() => expect(host.result.current).toMatchObject({ kind: "upgrade" }))
  })

  it("runs beforePrompt before the toast too, in a frame with no dialog", async () => {
    const order: string[] = []
    mockToastAdd.mockImplementation(({ id }: { id: string }) => {
      order.push("toast")
      return id
    })

    await promptForBuiltInAiRefusal(spentPoolError(), {
      ...OPTIONS,
      beforePrompt: () => {
        order.push("beforePrompt")
      },
    })

    expect(order).toEqual(["beforePrompt", "toast"])
  })

  it("drops the prompt when its run stopped while the plan loaded", async () => {
    const host = renderDialogHost()
    let current = true
    mockGetBuiltInAiUpgradePlan.mockImplementation(async () => {
      current = false
      return "free"
    })

    await expect(
      promptForBuiltInAiRefusal(spentPoolError(), { ...OPTIONS, isCurrent: () => current }),
    ).resolves.toBe(true)

    expect(host.result.current).toBeNull()
    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(trackedEvents()).toEqual([])
  })

  it("asks once while the same question is on screen", async () => {
    renderDialogHost()

    await promptForBuiltInAiRefusal(spentPoolError(), OPTIONS)
    await expect(promptForBuiltInAiRefusal(spentPoolError(), OPTIONS)).resolves.toBe(true)

    expect(trackedEvents()).toHaveLength(1)
  })
})
