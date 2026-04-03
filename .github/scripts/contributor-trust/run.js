import { appendFile, readFile } from "node:fs/promises"
import process from "node:process"

import { buildTrustComment } from "./comment-template.js"
import { LABEL_DEFINITIONS, POLICY } from "./config.js"
import {
  addLabelsToIssue,
  closePullRequestIssue,
  createContributorMetrics,
  createIssueComment,
  ensureRepositoryLabels,
  getAuthorMetrics,
  getCollaboratorPermission,
  getPullRequest,
  listIssueComments,
  listIssueLabels,
  removeLabelFromIssue,
  updateIssueComment,
} from "./github-api.js"
import { findManagedTrustComment } from "./managed-comment.js"
import { planTrustActions } from "./plan-actions.js"
import { computeContributorScore } from "./score-author.js"

function getRequiredEnv(name) {
  const value = process.env[name]
  if (!value)
    throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function getRepository() {
  const repository = getRequiredEnv("GITHUB_REPOSITORY")
  const [owner, repo] = repository.split("/")
  if (!owner || !repo)
    throw new Error(`Invalid GITHUB_REPOSITORY value: ${repository}`)
  return { owner, repo }
}

async function getEventPayload() {
  const eventPath = getRequiredEnv("GITHUB_EVENT_PATH")
  return JSON.parse(await readFile(eventPath, "utf8"))
}

function resolvePullNumber(eventName, payload) {
  const manualInput = process.env.TRUST_PR_NUMBER?.trim()
  if (manualInput)
    return Number.parseInt(manualInput, 10)

  if (eventName === "pull_request_target")
    return payload.pull_request?.number

  return null
}

async function writeJobSummary(lines) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (!summaryPath)
    return

  await appendFile(summaryPath, `${lines.join("\n")}\n`)
}

function buildScoreBreakdownSummary(score) {
  const { communityStanding, ossInfluence, prTrackRecord, repoFamiliarity } = score.breakdown

  return [
    "",
    "### Score details",
    `- Repo familiarity: ${score.repoFamiliarity}/35`,
    `  - Commits in repo: ${repoFamiliarity.commitsInRepo.count} -> ${repoFamiliarity.commitsInRepo.points}/10`,
    `  - Merged PRs: ${repoFamiliarity.mergedPrs.count} -> ${repoFamiliarity.mergedPrs.points}/12`,
    `  - Reviews in repo: ${repoFamiliarity.reviewsInRepo.count} -> ${repoFamiliarity.reviewsInRepo.points}/8`,
    `  - Contributor bonus: ${repoFamiliarity.contributorBonus.eligible ? "yes" : "no"} -> ${repoFamiliarity.contributorBonus.points}/5`,
    `- Community standing: ${score.communityStanding}/25`,
    `  - Account age: ${communityStanding.accountAge.months} months -> ${communityStanding.accountAge.points}/5`,
    `  - Followers: ${communityStanding.followers.count} -> ${communityStanding.followers.points}/10`,
    `  - Repo permission (${communityStanding.repoPermission.permission}) -> ${communityStanding.repoPermission.points}/10`,
    `- OSS influence: ${score.ossInfluence}/20`,
    `  - Max owned repo stars: ${ossInfluence.maxOwnedRepoStars.count} -> ${ossInfluence.maxOwnedRepoStars.points}/15`,
    `  - Total owned repo stars: ${ossInfluence.totalOwnedRepoStars.count} -> ${ossInfluence.totalOwnedRepoStars.points}/5`,
    `- PR track record: ${score.prTrackRecord}/20`,
    `  - Merged PRs: ${prTrackRecord.mergedPrs}`,
    `  - Resolved PRs: ${prTrackRecord.resolvedPrs}`,
    `  - Smoothed merge rate: ${prTrackRecord.smoothedRate}`,
    `  - Confidence: ${prTrackRecord.confidence}`,
  ]
}

function logScoreBreakdown(score) {
  console.log("Contributor trust score breakdown:")
  console.log(JSON.stringify({
    bucket: score.bucket,
    breakdown: score.breakdown,
    total: score.total,
  }, null, 2))
}

async function syncLabels({ currentLabels, issueNumber, labelsToAdd, labelsToRemove, owner, repo, token }) {
  for (const label of labelsToRemove) {
    if (!currentLabels.includes(label))
      continue
    await removeLabelFromIssue(token, owner, repo, issueNumber, label)
    console.log(`Removed label: ${label}`)
  }

  const missingLabels = labelsToAdd.filter(label => !currentLabels.includes(label))
  if (missingLabels.length > 0) {
    await addLabelsToIssue(token, owner, repo, issueNumber, missingLabels)
    console.log(`Added labels: ${missingLabels.join(", ")}`)
  }
}

async function upsertComment({ body, issueNumber, owner, repo, token }) {
  const comments = await listIssueComments(token, owner, repo, issueNumber)
  const existingComment = findManagedTrustComment(comments)

  if (existingComment?.body === body) {
    console.log("Trust comment is already up to date.")
    return { action: "unchanged", commentId: existingComment.id }
  }

  if (existingComment) {
    await updateIssueComment(token, owner, repo, existingComment.id, body)
    console.log(`Updated trust comment ${existingComment.id}.`)
    return { action: "updated", commentId: existingComment.id }
  }

  const createdComment = await createIssueComment(token, owner, repo, issueNumber, body)
  console.log(`Created trust comment ${createdComment.id}.`)
  return { action: "created", commentId: createdComment.id }
}

async function main() {
  const token = getRequiredEnv("GITHUB_TOKEN")
  const eventName = getRequiredEnv("GITHUB_EVENT_NAME")
  const payload = await getEventPayload()
  const pullNumber = resolvePullNumber(eventName, payload)

  if (!Number.isInteger(pullNumber) || pullNumber <= 0)
    throw new Error(`Unable to resolve a valid pull request number for event ${eventName}.`)

  const { owner, repo } = getRepository()
  const pullRequest = await getPullRequest(token, owner, repo, pullNumber)

  const summaryLines = [
    "## Contributor trust automation",
    "",
    `- Event: \`${eventName}\``,
    `- PR: #${pullRequest.number}`,
    `- Title: ${pullRequest.title}`,
    `- State: ${pullRequest.state}${pullRequest.draft ? " (draft)" : ""}`,
    `- Author: @${pullRequest.user.login}`,
  ]

  if (eventName === "pull_request_target" && pullRequest.draft) {
    summaryLines.push("- Result: skipped automatic trust checks for a draft PR")
    await writeJobSummary(summaryLines)
    return
  }

  await ensureRepositoryLabels(token, owner, repo, LABEL_DEFINITIONS)
  const currentLabels = await listIssueLabels(token, owner, repo, pullRequest.number)

  const overridePlan = planTrustActions({
    currentLabels,
    pullRequest,
    score: {
      bucket: "new",
      exemptReason: null,
      total: 0,
    },
  })

  if (overridePlan.skipAutomation) {
    await syncLabels({
      currentLabels,
      issueNumber: pullRequest.number,
      labelsToAdd: [],
      labelsToRemove: overridePlan.labelsToRemove,
      owner,
      repo,
      token,
    })

    summaryLines.push(`- Result: skipped due to \`${POLICY.overrideLabel}\``)
    if (overridePlan.labelsToRemove.length > 0)
      summaryLines.push(`- Cleanup: removed ${overridePlan.labelsToRemove.map(label => `\`${label}\``).join(", ")}`)
    await writeJobSummary(summaryLines)
    return
  }

  const permission = await getCollaboratorPermission(token, owner, repo, pullRequest.user.login)
  const authorMetrics = await getAuthorMetrics(token, owner, repo, pullRequest.user.login)
  const scoreInput = createContributorMetrics({
    author: authorMetrics.author,
    permission,
    repoHistory: authorMetrics.repoHistory,
  })

  const score = computeContributorScore(scoreInput)
  const plan = planTrustActions({ currentLabels, pullRequest, score })
  const comment = buildTrustComment({
    author: {
      login: authorMetrics.author.login,
      name: authorMetrics.author.name,
      type: pullRequest.user.type,
      url: authorMetrics.author.url,
    },
    metrics: {
      accountCreated: authorMetrics.author.createdAt,
      closedPrs: authorMetrics.repoHistory.closedPrs,
      commitsInRepo: authorMetrics.repoHistory.commitsInRepo,
      followers: authorMetrics.author.followers,
      mergedPrs: authorMetrics.repoHistory.mergedPrs,
      openPrs: authorMetrics.repoHistory.openPrs,
      repoPermission: permission ?? "none",
      reviews: authorMetrics.repoHistory.reviews,
      topRepositories: authorMetrics.repoHistory.topRepositories,
    },
    owner,
    plan,
    pullRequest,
    repo,
    score,
  })

  await syncLabels({
    currentLabels,
    issueNumber: pullRequest.number,
    labelsToAdd: plan.labelsToAdd,
    labelsToRemove: plan.labelsToRemove,
    owner,
    repo,
    token,
  })
  const commentResult = await upsertComment({
    body: comment.body,
    issueNumber: pullRequest.number,
    owner,
    repo,
    token,
  })

  if (plan.shouldClosePr) {
    await closePullRequestIssue(token, owner, repo, pullRequest.number)
    console.log(`Closed PR #${pullRequest.number}: ${plan.closeReason}`)
  }

  logScoreBreakdown(score)

  summaryLines.push(`- Trust score: **${score.total}/100**`)
  summaryLines.push(`- PR changed lines: ${plan.changedLines}`)
  summaryLines.push(`- Bucket: \`${score.bucket}\``)
  summaryLines.push(`- Target label: \`${plan.targetTrustLabel}\``)
  summaryLines.push(`- Maintainer review: ${plan.needsMaintainerReview ? "required" : "not required"}`)
  if (plan.closeReason)
    summaryLines.push(`- Auto-close: ${plan.closeReason}`)
  summaryLines.push(`- Comment: ${commentResult.action}`)
  summaryLines.push(`- Fingerprint: \`${comment.fingerprint}\``)
  summaryLines.push(...buildScoreBreakdownSummary(score))

  await writeJobSummary(summaryLines)
}

main().catch(async (error) => {
  console.error(error)
  await writeJobSummary([
    "## Contributor trust automation",
    "",
    `- Result: failed`,
    `- Error: ${error instanceof Error ? error.message : String(error)}`,
  ])
  process.exitCode = 1
})
