import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { updateRules, getURL } = vi.hoisted(() => ({
  updateRules: vi.fn<(...args: any[]) => any>(),
  getURL: vi.fn<() => string>(() => "chrome-extension://test-extension/"),
}))

const fetchMock = vi.fn<typeof fetch>()
let translate: typeof import("../bilibili").bilibiliTranslate

function response(content: unknown = "你好", finishReason = "stop") {
  return Response.json({ choices: [{ message: { content }, finish_reason: finishReason }] })
}

describe("Bilibili Index Translate", () => {
  beforeEach(async () => {
    vi.resetModules()
    const { fakeBrowser } = await import("wxt/testing/fake-browser")
    vi.spyOn(fakeBrowser.declarativeNetRequest, "updateDynamicRules").mockImplementation(
      updateRules,
    )
    vi.spyOn(fakeBrowser.runtime, "getURL").mockImplementation(getURL)
    updateRules.mockReset().mockResolvedValue(undefined)
    getURL.mockReturnValue("chrome-extension://test-extension/")
    fetchMock.mockReset().mockImplementation(async () => response())
    vi.stubGlobal("fetch", fetchMock)
    translate = (await import("../bilibili")).bilibiliTranslate
  })
  afterEach(() => vi.unstubAllGlobals())

  it("uses the free model and canonical prompt without credentials", async () => {
    expect(await translate("Hello", "auto", "Chinese")).toBe("你好")
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://index-translate.bilibili.com/v1/chat/completions")
    expect(init?.credentials).toBe("omit")
    expect(init?.headers).toEqual({ "Content-Type": "application/json" })
    expect(JSON.parse(init!.body as string)).toMatchObject({
      model: "Index-Translate-35B-A3B",
      messages: [
        {
          role: "user",
          content: "请将以下文本翻译为Chinese，直接输出翻译结果，不要进行任何解释。\n\nHello",
        },
      ],
      stream: false,
      chat_template_kwargs: { enable_thinking: false },
    })
  })

  it.each(["chrome-extension://chrome-id/", "moz-extension://firefox-uuid/"])(
    "limits Origin removal to the endpoint and extension host for %s",
    async (url) => {
      getURL.mockReturnValue(url)
      await translate("hello", "English", "Chinese")
      expect(updateRules).toHaveBeenCalledWith({
        removeRuleIds: [2309],
        addRules: [
          {
            id: 2309,
            priority: 1,
            action: {
              type: "modifyHeaders",
              requestHeaders: [{ header: "Origin", operation: "remove" }],
            },
            condition: {
              urlFilter: "|https://index-translate.bilibili.com/v1/chat/completions|",
              initiatorDomains: [new URL(url).host],
              resourceTypes: ["xmlhttprequest"],
            },
          },
        ],
      })
    },
  )

  it("waits for rule installation and retries installation after failure", async () => {
    updateRules.mockRejectedValueOnce(new Error("rule failed"))
    await expect(translate("hello", "auto", "Chinese")).rejects.toThrow("rule failed")
    expect(fetchMock).not.toHaveBeenCalled()
    let ready!: () => void
    updateRules.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          ready = resolve
        }),
    )
    const pending = translate("hello", "auto", "Chinese")
    expect(fetchMock).not.toHaveBeenCalled()
    ready()
    await pending
    await translate("again", "auto", "Chinese")
    expect(updateRules).toHaveBeenCalledTimes(2)
  })

  it("splits long input within 4096 characters including the prompt without losing Unicode or whitespace", async () => {
    const source = ("Hello world.\n\n" + "😀".repeat(2200) + " end. ").repeat(2)
    fetchMock.mockImplementation(async (_url, init) => {
      const prompt = JSON.parse(init!.body as string).messages[0].content as string
      expect(prompt.length).toBeLessThanOrEqual(4096)
      const text = prompt.slice(prompt.indexOf("\n\n") + 2)
      expect(text.isWellFormed()).toBe(true)
      return response(text)
    })
    expect(await translate(source, "auto", "Chinese")).toBe(source)
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1)
  })

  it("stops between chunks when aborted", async () => {
    const controller = new AbortController()
    fetchMock.mockImplementationOnce(async () => {
      controller.abort()
      return response()
    })
    await expect(
      translate("a".repeat(5000), "auto", "Chinese", { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]![1]?.signal).toBe(controller.signal)
  })

  it("preserves abort errors and does not start an already aborted request", async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      translate("hello", "auto", "Chinese", { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("keeps HTTP status and Retry-After for queue retry policy", async () => {
    const { getRequestErrorMeta } = await import("@/utils/request/retry-policy")
    fetchMock.mockResolvedValue(
      new Response("rate limited", { status: 429, headers: { "Retry-After": "10" } }),
    )
    const error = await translate("hello", "auto", "Chinese").catch((caught: unknown) => caught)
    expect(getRequestErrorMeta(error)).toMatchObject({
      statusCode: 429,
      retryAfterMs: 10000,
      kind: "rate-limit",
    })
  })

  it.each([null, 42, "", "   "])("rejects invalid translation %j", async (content) => {
    fetchMock.mockResolvedValue(response(content))
    await expect(translate("hello", "auto", "Chinese")).rejects.toThrow("empty or invalid")
  })

  it("rejects truncated translations instead of caching incomplete output", async () => {
    fetchMock.mockResolvedValue(response("partial", "length"))
    await expect(translate("hello", "auto", "Chinese")).rejects.toThrow("truncated")
  })

  it("rejects HTML and avoids network calls for blank input", async () => {
    await expect(
      translate("<b>hello</b>", "auto", "Chinese", { textFormat: "html" }),
    ).rejects.toThrow("HTML")
    expect(await translate(" \n ", "auto", "Chinese")).toBe(" \n ")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
