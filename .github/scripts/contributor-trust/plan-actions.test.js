import { describe, expect, it } from "vitest"
import { POLICY } from "./config.js"
import { isExcludedChangedLineFile, planTrustActions } from "./plan-actions.js"

describe("isExcludedChangedLineFile", () => {
  it("matches read-frog config migration scripts, tests, and generated fixtures", () => {
    expect(isExcludedChangedLineFile("src/utils/config/migration-scripts/v080-to-v081.ts")).toBe(
      true,
    )
    expect(
      isExcludedChangedLineFile(
        "src/utils/config/__tests__/migration-scripts/v079-to-v080.test.ts",
      ),
    ).toBe(true)
    expect(isExcludedChangedLineFile("src/utils/config/__tests__/example/v081.ts")).toBe(true)
    expect(isExcludedChangedLineFile(".agents/skills/migration-scripts/SKILL.md")).toBe(false)
    expect(isExcludedChangedLineFile("src/utils/config/migration.ts")).toBe(false)
    expect(isExcludedChangedLineFile("src/utils/config/migration-scripts/types.ts")).toBe(false)
    expect(
      isExcludedChangedLineFile(
        "src/utils/config/__tests__/migration-scripts/all-migrations.test.ts",
      ),
    ).toBe(false)
    expect(isExcludedChangedLineFile("src/utils/config/__tests__/example/types.ts")).toBe(false)
    expect(isExcludedChangedLineFile("src/entrypoints/host.content/runtime.ts")).toBe(false)
  })

  it("excludes files within src/locales without matching similarly named paths", () => {
    expect(isExcludedChangedLineFile("src/locales/az.yml")).toBe(true)
    expect(isExcludedChangedLineFile("src/locales/nested/messages.json")).toBe(true)
    expect(isExcludedChangedLineFile("src\\locales\\en.yml")).toBe(true)
    expect(isExcludedChangedLineFile("src/locales.ts")).toBe(false)
    expect(isExcludedChangedLineFile("src/locales-backup/en.yml")).toBe(false)
    expect(isExcludedChangedLineFile("src/components/locales/en.yml")).toBe(false)
  })
})

describe("planTrustActions", () => {
  it("assigns the low-trust labels for new contributors", () => {
    const plan = planTrustActions({
      currentLabels: [],
      pullRequest: { additions: 15, deletions: 4 },
      score: {
        bucket: "new",
        exemptReason: null,
        total: 18,
      },
    })

    expect(plan).toMatchObject({
      changedLines: 19,
      labelsToAdd: ["contrib-trust:new", POLICY.needsMaintainerReviewLabel].sort(),
      labelsToRemove: [],
      needsMaintainerReview: true,
      shouldClosePr: false,
      skipAutomation: false,
      targetTrustLabel: "contrib-trust:new",
    })
  })

  it("cleans up stale trust labels when the score improves", () => {
    const plan = planTrustActions({
      currentLabels: ["contrib-trust:new", POLICY.needsMaintainerReviewLabel],
      pullRequest: { additions: 40, deletions: 10 },
      score: {
        bucket: "trusted",
        exemptReason: null,
        total: 74,
      },
    })

    expect(plan).toMatchObject({
      changedLines: 50,
      labelsToAdd: ["contrib-trust:trusted"],
      labelsToRemove: [POLICY.needsMaintainerReviewLabel, "contrib-trust:new"].sort(),
      needsMaintainerReview: false,
      skipAutomation: false,
      targetTrustLabel: "contrib-trust:trusted",
    })
  })

  it("cleans up the legacy admin trust label when recomputing a score", () => {
    const plan = planTrustActions({
      currentLabels: ["contrib-trust:new", POLICY.adminLabel],
      pullRequest: { additions: 25, deletions: 5 },
      score: {
        bucket: "highly-trusted",
        exemptReason: null,
        total: 82,
      },
    })

    expect(plan).toMatchObject({
      changedLines: 30,
      labelsToAdd: ["contrib-trust:highly-trusted"],
      labelsToRemove: [POLICY.adminLabel, "contrib-trust:new"].sort(),
      needsMaintainerReview: false,
      skipAutomation: false,
      targetTrustLabel: "contrib-trust:highly-trusted",
    })
  })

  it("short-circuits when the override label is present", () => {
    const plan = planTrustActions({
      currentLabels: [POLICY.overrideLabel, POLICY.needsMaintainerReviewLabel, "contrib-trust:new"],
      pullRequest: { additions: 900, deletions: 400 },
      score: {
        bucket: "new",
        exemptReason: null,
        total: 10,
      },
    })

    expect(plan).toMatchObject({
      labelsToAdd: [],
      labelsToRemove: [POLICY.needsMaintainerReviewLabel],
      needsMaintainerReview: false,
      shouldClosePr: false,
      skipAutomation: true,
      targetTrustLabel: null,
    })
  })

  it("auto-closes only when both the score and changed-line thresholds are exceeded", () => {
    const plan = planTrustActions({
      currentLabels: [],
      pullRequest: { additions: 820, deletions: 245 },
      score: {
        bucket: "new",
        exemptReason: null,
        total: 19,
      },
    })

    expect(plan).toMatchObject({
      changedLines: 1065,
      shouldClosePr: true,
      skipAutomation: false,
    })
    expect(plan.closeReason).toContain("Score 19 is below 20")
    expect(plan.closeReason).toContain("1065 lines")
    expect(plan.closeReason).toContain("exceeding 1000")
  })

  it("excludes migration-related files from the changed-line threshold", () => {
    const plan = planTrustActions({
      currentLabels: [],
      pullRequest: { additions: 1699, deletions: 2 },
      pullRequestFiles: [
        {
          additions: 1662,
          deletions: 0,
          filename: "src/utils/config/__tests__/example/v081.ts",
        },
        {
          additions: 30,
          deletions: 0,
          filename: "src/utils/config/migration-scripts/v080-to-v081.ts",
        },
        {
          additions: 4,
          deletions: 0,
          filename: "src/entrypoints/host.content/runtime.ts",
        },
        {
          additions: 3,
          deletions: 2,
          filename: "src/utils/constants/config.ts",
        },
      ],
      score: {
        bucket: "new",
        exemptReason: null,
        total: 19,
      },
    })

    expect(plan).toMatchObject({
      changedLineAdditions: 7,
      changedLineDeletions: 2,
      changedLines: 9,
      excludedChangedLineAdditions: 1692,
      excludedChangedLineDeletions: 0,
      excludedChangedLines: 1692,
      shouldClosePr: false,
    })
    expect(plan.excludedChangedLineFiles).toEqual([
      "src/utils/config/__tests__/example/v081.ts",
      "src/utils/config/migration-scripts/v080-to-v081.ts",
    ])
    expect(plan.closeReason).toBeNull()
  })

  it("keeps a large locale-only PR open for a new contributor", () => {
    const plan = planTrustActions({
      pullRequest: { additions: 2300, deletions: 200 },
      pullRequestFiles: [
        { filename: "src/locales/az.yml", additions: 2200, deletions: 0 },
        { filename: "src/locales/en.yml", additions: 100, deletions: 200 },
      ],
      score: { bucket: "new", total: 0 },
    })

    expect(plan).toMatchObject({
      changedLines: 0,
      excludedChangedLineAdditions: 2300,
      excludedChangedLineDeletions: 200,
      excludedChangedLines: 2500,
      excludedChangedLineFiles: ["src/locales/az.yml", "src/locales/en.yml"],
      needsMaintainerReview: true,
      shouldClosePr: false,
      closeReason: null,
    })
  })

  it.each([
    [1000, false, null],
    [
      1001,
      true,
      expect.stringContaining("1001 counted lines after excluding 3500 migration and locale lines"),
    ],
  ])(
    "applies the threshold to %i non-excluded lines in a mixed PR",
    (changedLines, shouldClosePr, closeReason) => {
      const plan = planTrustActions({
        pullRequestFiles: [
          { filename: "src/locales/az.yml", additions: 1800, deletions: 200 },
          {
            filename: "src/utils/config/__tests__/example/v081.ts",
            additions: 1500,
            deletions: 0,
          },
          {
            filename: "src/entrypoints/host.content/runtime.ts",
            additions: 900,
            deletions: changedLines - 900,
          },
        ],
        score: { bucket: "new", total: 19 },
      })

      expect(plan).toMatchObject({
        changedLines,
        excludedChangedLines: 3500,
        shouldClosePr,
        closeReason,
      })
    },
  )

  it("does not auto-close a low-score PR when it is still under the line threshold", () => {
    const plan = planTrustActions({
      currentLabels: [],
      pullRequest: { additions: 600, deletions: 300 },
      score: {
        bucket: "new",
        exemptReason: null,
        total: 10,
      },
    })

    expect(plan).toMatchObject({
      changedLines: 900,
      shouldClosePr: false,
    })
    expect(plan.closeReason).toBeNull()
  })
})
