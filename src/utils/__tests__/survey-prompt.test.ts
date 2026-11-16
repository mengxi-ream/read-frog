import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"

const promptMock = vi.fn<(input: { locale: string }) => Promise<unknown>>()

vi.mock("@/utils/orpc/client", () => ({
  orpcClient: {
    survey: {
      prompt: (input: { locale: string }) => promptMock(input),
    },
  },
}))

const {
  buildSurveyPromptUrl,
  getClickedSurveyPromptKeys,
  getSurveyPrompt,
  markSurveyPromptClicked,
  SURVEY_PROMPT_TTL_MS,
} = await import("../survey-prompt")

const NOW = Date.UTC(2026, 10, 15, 12)
const CLOSES_AT = new Date(Date.UTC(2026, 10, 30, 7))

function served(overrides: Record<string, unknown> = {}) {
  return {
    key: "2026-11",
    path: "/zh/survey/2026-11",
    label: "问卷",
    badge: "有奖",
    closesAt: CLOSES_AT,
    ...overrides,
  }
}

const SHOWN = {
  key: "2026-11",
  path: "/zh/survey/2026-11",
  label: "问卷",
  badge: "有奖",
  closesAtMs: CLOSES_AT.getTime(),
}

async function storedCache() {
  const { surveyPrompt } = await fakeBrowser.storage.local.get("surveyPrompt")
  return surveyPrompt as { fetchedAt: number } | undefined
}

beforeEach(() => {
  fakeBrowser.reset()
  promptMock.mockReset()
})

describe("getSurveyPrompt", () => {
  it("asks the server in the reader's language and keeps the end as a number", async () => {
    promptMock.mockResolvedValue(served())

    await expect(getSurveyPrompt("zh", NOW)).resolves.toEqual(SHOWN)
    expect(promptMock).toHaveBeenCalledWith({ locale: "zh" })
    expect(await storedCache()).toEqual({ locale: "zh", fetchedAt: NOW, prompt: SHOWN })
  })

  it("reuses the answer for six hours", async () => {
    promptMock.mockResolvedValue(served())
    await getSurveyPrompt("zh", NOW)

    await expect(getSurveyPrompt("zh", NOW + SURVEY_PROMPT_TTL_MS - 1)).resolves.toEqual(SHOWN)
    expect(promptMock).toHaveBeenCalledTimes(1)
  })

  it("asks again once six hours have passed", async () => {
    promptMock.mockResolvedValueOnce(served()).mockResolvedValueOnce(null)
    await getSurveyPrompt("zh", NOW)

    await expect(getSurveyPrompt("zh", NOW + SURVEY_PROMPT_TTL_MS)).resolves.toBeNull()
    expect(promptMock).toHaveBeenCalledTimes(2)
  })

  it('keeps "no survey" too, so a reader without one is not asked about every visit', async () => {
    promptMock.mockResolvedValue(null)

    await expect(getSurveyPrompt("en", NOW)).resolves.toBeNull()
    await expect(getSurveyPrompt("en", NOW + 1000)).resolves.toBeNull()
    expect(promptMock).toHaveBeenCalledTimes(1)
  })

  it("asks again when the reader's language changes", async () => {
    promptMock
      .mockResolvedValueOnce(served())
      .mockResolvedValueOnce(
        served({ path: "/en/survey/2026-11", label: "Survey", badge: "Prize" }),
      )
    await getSurveyPrompt("zh", NOW)

    await expect(getSurveyPrompt("en", NOW + 1000)).resolves.toMatchObject({ label: "Survey" })
    expect(promptMock).toHaveBeenLastCalledWith({ locale: "en" })
  })

  it("asks again when the clock has gone back since the answer was stored", async () => {
    promptMock.mockResolvedValue(served())
    await getSurveyPrompt("zh", NOW)

    await getSurveyPrompt("zh", NOW - 1000)
    expect(promptMock).toHaveBeenCalledTimes(2)
  })

  it("drops a survey the moment its end passes, before the cache expires", async () => {
    const closesSoon = NOW + 60 * 60 * 1000
    promptMock.mockResolvedValue(served({ closesAt: new Date(closesSoon) }))
    await expect(getSurveyPrompt("zh", NOW)).resolves.toMatchObject({ closesAtMs: closesSoon })

    await expect(getSurveyPrompt("zh", closesSoon)).resolves.toBeNull()
    expect(promptMock).toHaveBeenCalledTimes(1)
  })

  it("shows a survey without an end for as long as the server sends it", async () => {
    promptMock.mockResolvedValue(served({ closesAt: null, badge: null }))

    await expect(getSurveyPrompt("zh", NOW)).resolves.toEqual({
      ...SHOWN,
      badge: null,
      closesAtMs: null,
    })
  })

  it("keeps the last answer when a request fails, and stores nothing", async () => {
    promptMock.mockResolvedValueOnce(served()).mockRejectedValueOnce(new Error("offline"))
    await getSurveyPrompt("zh", NOW)

    const later = NOW + SURVEY_PROMPT_TTL_MS + 1
    await expect(getSurveyPrompt("zh", later)).resolves.toEqual(SHOWN)
    expect((await storedCache())?.fetchedAt).toBe(NOW)
  })

  it("shows nothing when a request fails with no answer to fall back on", async () => {
    promptMock.mockRejectedValue(new Error("offline"))

    await expect(getSurveyPrompt("zh", NOW)).resolves.toBeNull()
    expect(await storedCache()).toBeUndefined()
  })

  it("does not fall back on an answer in another language", async () => {
    promptMock.mockResolvedValueOnce(served()).mockRejectedValueOnce(new Error("offline"))
    await getSurveyPrompt("zh", NOW)

    await expect(getSurveyPrompt("en", NOW + 1000)).resolves.toBeNull()
  })

  it("treats a stored value it cannot read as no answer", async () => {
    await fakeBrowser.storage.local.set({ surveyPrompt: { locale: "zh", fetchedAt: "soon" } })
    promptMock.mockResolvedValue(served())

    await expect(getSurveyPrompt("zh", NOW)).resolves.toEqual(SHOWN)
    expect(promptMock).toHaveBeenCalledTimes(1)
  })
})

describe("buildSurveyPromptUrl", () => {
  it("opens the survey on the website, marked as reached from the sidebar", () => {
    expect(buildSurveyPromptUrl({ path: "/zh/survey/2026-11" }, "https://www.readfrog.app")).toBe(
      "https://www.readfrog.app/zh/survey/2026-11?from=extension_sidebar",
    )
  })
})

describe("clicked survey keys", () => {
  it("starts empty", async () => {
    await expect(getClickedSurveyPromptKeys()).resolves.toEqual([])
  })

  it("remembers each survey once", async () => {
    await markSurveyPromptClicked("2026-11")
    await markSurveyPromptClicked("2026-11")

    await expect(getClickedSurveyPromptKeys()).resolves.toEqual(["2026-11"])
  })

  it("keeps only the newest twenty", async () => {
    for (let index = 1; index <= 21; index++) {
      await markSurveyPromptClicked(`survey-${index}`)
    }

    const keys = await getClickedSurveyPromptKeys()
    expect(keys).toHaveLength(20)
    expect(keys[0]).toBe("survey-2")
    expect(keys.at(-1)).toBe("survey-21")
  })

  it("treats a stored value it cannot read as none clicked", async () => {
    await fakeBrowser.storage.local.set({ surveyPromptClicked: "2026-11" })

    await expect(getClickedSurveyPromptKeys()).resolves.toEqual([])
  })
})
