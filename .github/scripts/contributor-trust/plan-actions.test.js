import { describe, expect, it } from "vitest"

import { POLICY } from "./config.js"
import { planTrustActions } from "./plan-actions.js"

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
