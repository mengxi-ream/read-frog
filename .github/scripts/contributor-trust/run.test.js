import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  buildTrustComment: vi.fn(),
  computeContributorScore: vi.fn(),
  createContributorMetrics: vi.fn(),
  createIssueComment: vi.fn(),
  addLabelsToIssue: vi.fn(),
  closePullRequestIssue: vi.fn(),
  ensureRepositoryLabels: vi.fn(),
  getAuthorMetrics: vi.fn(),
  getCollaboratorPermission: vi.fn(),
  getPullRequest: vi.fn(),
  listIssueComments: vi.fn(),
  listIssueLabels: vi.fn(),
  removeLabelFromIssue: vi.fn(),
  updateIssueComment: vi.fn(),
  findManagedTrustComment: vi.fn(),
}))

vi.mock("./comment-template.js", () => ({
  buildTrustComment: mocks.buildTrustComment,
}))

vi.mock("./github-api.js", () => ({
  addLabelsToIssue: mocks.addLabelsToIssue,
  closePullRequestIssue: mocks.closePullRequestIssue,
  createContributorMetrics: mocks.createContributorMetrics,
  createIssueComment: mocks.createIssueComment,
  ensureRepositoryLabels: mocks.ensureRepositoryLabels,
  getAuthorMetrics: mocks.getAuthorMetrics,
  getCollaboratorPermission: mocks.getCollaboratorPermission,
  getPullRequest: mocks.getPullRequest,
  listIssueComments: mocks.listIssueComments,
  listIssueLabels: mocks.listIssueLabels,
  removeLabelFromIssue: mocks.removeLabelFromIssue,
  updateIssueComment: mocks.updateIssueComment,
}))

vi.mock("./managed-comment.js", () => ({
  findManagedTrustComment: mocks.findManagedTrustComment,
}))

vi.mock("./score-author.js", () => ({
  computeContributorScore: mocks.computeContributorScore,
}))

const ENV_KEYS = [
  "GITHUB_EVENT_NAME",
  "GITHUB_EVENT_PATH",
  "GITHUB_REPOSITORY",
  "GITHUB_STEP_SUMMARY",
  "GITHUB_TOKEN",
  "TRUST_PR_NUMBER",
]

const originalEnv = { ...process.env }

async function loadMain() {
  vi.resetModules()
  return (await import("./run.js")).main
}

describe("main", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    const tempDir = await mkdtemp(join(tmpdir(), "contributor-trust-run-"))
    const eventPath = join(tempDir, "event.json")
    const summaryPath = join(tempDir, "summary.md")

    await writeFile(eventPath, JSON.stringify({}), "utf8")
    await writeFile(summaryPath, "", "utf8")

    process.env.GITHUB_EVENT_NAME = "workflow_dispatch"
    process.env.GITHUB_EVENT_PATH = eventPath
    process.env.GITHUB_REPOSITORY = "read-frog/read-frog"
    process.env.GITHUB_STEP_SUMMARY = summaryPath
    process.env.GITHUB_TOKEN = "test-token"
    process.env.TRUST_PR_NUMBER = "42"
  })

  afterEach(() => {
    for (const key of ENV_KEYS)
      delete process.env[key]

    Object.assign(process.env, originalEnv)
  })

  it("skips bot-authored pull requests without mutating trust state", async () => {
    mocks.getPullRequest.mockResolvedValue({
      draft: false,
      number: 42,
      state: "open",
      title: "chore(deps): bump dependencies",
      user: {
        login: "dependabot[bot]",
        type: "Bot",
      },
    })

    const main = await loadMain()
    await main()

    expect(mocks.ensureRepositoryLabels).not.toHaveBeenCalled()
    expect(mocks.listIssueLabels).not.toHaveBeenCalled()
    expect(mocks.getCollaboratorPermission).not.toHaveBeenCalled()
    expect(mocks.getAuthorMetrics).not.toHaveBeenCalled()

    const summary = await readFile(process.env.GITHUB_STEP_SUMMARY, "utf8")
    expect(summary).toContain("- Result: skipped bot-authored PR by @dependabot[bot]")
  })

  it("continues to process human-authored pull requests", async () => {
    mocks.getPullRequest.mockResolvedValue({
      additions: 20,
      deletions: 5,
      draft: false,
      number: 42,
      state: "open",
      title: "fix: keep contributor trust scoring for humans",
      user: {
        login: "mengxi-ream",
        type: "User",
      },
    })
    mocks.ensureRepositoryLabels.mockResolvedValue(undefined)
    mocks.listIssueLabels.mockResolvedValue([])
    mocks.getCollaboratorPermission.mockResolvedValue("write")
    mocks.getAuthorMetrics.mockResolvedValue({
      author: {
        createdAt: "2020-01-01T00:00:00Z",
        followers: 12,
        login: "mengxi-ream",
        name: "Mengxi Ream",
        url: "https://github.com/mengxi-ream",
      },
      repoHistory: {
        closedPrs: 1,
        commitsInRepo: 14,
        mergedPrs: 2,
        openPrs: 0,
        reviews: 3,
        topRepositories: [],
      },
    })
    mocks.createContributorMetrics.mockReturnValue({ source: "metrics" })
    mocks.computeContributorScore.mockReturnValue({
      breakdown: {
        communityStanding: {
          accountAge: { months: 24, points: 5 },
          followers: { count: 12, points: 10 },
          repoPermission: { permission: "write", points: 10 },
        },
        ossInfluence: {
          maxOwnedRepoStars: { count: 0, points: 0 },
          totalOwnedRepoStars: { count: 0, points: 0 },
        },
        prTrackRecord: {
          confidence: "medium",
          mergedPrs: 2,
          resolvedPrs: 3,
          smoothedRate: 0.75,
        },
        repoFamiliarity: {
          commitsInRepo: { count: 14, points: 10 },
          contributorBonus: { eligible: true, points: 5 },
          mergedPrs: { count: 2, points: 12 },
          reviewsInRepo: { count: 3, points: 8 },
        },
      },
      bucket: "trusted",
      communityStanding: 25,
      ossInfluence: 0,
      prTrackRecord: 18,
      repoFamiliarity: 35,
      total: 78,
    })
    mocks.buildTrustComment.mockReturnValue({
      body: "managed trust comment",
      fingerprint: "fingerprint-123",
    })
    mocks.listIssueComments.mockResolvedValue([])
    mocks.createIssueComment.mockResolvedValue({ id: 99 })
    mocks.addLabelsToIssue.mockResolvedValue([])

    const main = await loadMain()
    await main()

    expect(mocks.ensureRepositoryLabels).toHaveBeenCalledTimes(1)
    expect(mocks.getCollaboratorPermission).toHaveBeenCalledWith(
      "test-token",
      "read-frog",
      "read-frog",
      "mengxi-ream",
    )
    expect(mocks.getAuthorMetrics).toHaveBeenCalledTimes(1)
    expect(mocks.createIssueComment).toHaveBeenCalledTimes(1)

    const summary = await readFile(process.env.GITHUB_STEP_SUMMARY, "utf8")
    expect(summary).toContain("- Trust score: **78/100**")
  })
})
