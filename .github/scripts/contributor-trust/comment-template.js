import { createHash } from "node:crypto"

import { BUCKET_TITLES, COMMENT_MARKER_HTML, FINGERPRINT_MARKER_PREFIX, POLICY } from "./config.js"

function formatMonths(createdAt) {
  if (!createdAt)
    return "unknown"

  const timestamp = new Date(createdAt).getTime()
  if (Number.isNaN(timestamp))
    return "unknown"

  const months = Math.max(0, Math.floor((Date.now() - timestamp) / 2.628e9))
  return `${months} month${months === 1 ? "" : "s"}`
}

function formatRepositoryList(repositories) {
  if (repositories.length === 0)
    return "none"

  return repositories
    .map(repository => `${repository.nameWithOwner} (${repository.stargazerCount})`)
    .join(", ")
}

function summarizeTopRepositories(repositories) {
  const stars = repositories.map(repository => repository.stargazerCount)

  return {
    list: formatRepositoryList(repositories),
    max: stars.length > 0 ? Math.max(...stars) : 0,
    total: stars.reduce((sum, starCount) => sum + starCount, 0),
  }
}

function buildContent({ owner, repo, pullRequest, author, metrics, score, plan }) {
  const bucketTitle = BUCKET_TITLES[score.bucket]
  const trustLabel = plan.targetTrustLabel ?? "none"
  const reviewStatus = plan.needsMaintainerReview ? "required" : "not required"
  const includedRepositories = summarizeTopRepositories(metrics.topRepositories)
  const intro = `This score estimates contributor familiarity with \`${owner}/${repo}\` using public GitHub signals. It is advisory only and does not block merges automatically.`

  return [
    "## Contributor trust score",
    "",
    `**${score.total}/100** — ${bucketTitle}`,
    "",
    intro,
    "",
    "**Outcome**",
    `- PR: #${pullRequest.number} — ${pullRequest.title}`,
    `- Author: @${author.login}`,
    `- Trust label: \`${trustLabel}\``,
    `- Maintainer review: ${reviewStatus}`,
    `- Override label: add \`${POLICY.overrideLabel}\` to stop future trust automation updates`,
    "",
    "**Score breakdown**",
    "",
    "| Dimension | Score | Signals |",
    "| --- | ---: | --- |",
    `| Repo familiarity | ${score.repoFamiliarity}/35 | merged PRs, resolved PR history, reviews |`,
    `| Community standing | ${score.communityStanding}/25 | account age, followers, repo role |`,
    `| OSS influence | ${score.ossInfluence}/20 | stars on owned non-fork repositories |`,
    `| PR track record | ${score.prTrackRecord}/20 | merge rate across resolved PRs in this repo |`,
    "",
    "**Signals used**",
    `- Repo PR history: merged ${metrics.mergedPrs}, open ${metrics.openPrs}, closed-unmerged ${metrics.closedPrs}`,
    `- Repo reviews: ${metrics.reviews}`,
    `- Repo permission: ${metrics.repoPermission ?? "none"}`,
    `- Followers: ${metrics.followers}`,
    `- Account age: ${formatMonths(metrics.accountCreated)}`,
    `- Owned non-fork repos considered: max ${includedRepositories.max}, total ${includedRepositories.total} (${includedRepositories.list})`,
    "",
    "**Policy**",
    `- Low-score review threshold: < ${POLICY.lowScoreThreshold}`,
    `- Auto-close: disabled in v1`,
    `- Policy version: \`${POLICY.version}\``,
    "",
    `_${pullRequest.state === "closed" ? "Manually re-evaluated on a closed PR." : "Updated automatically when the PR changes or when a maintainer reruns the workflow."}_`,
  ].join("\n")
}

export function buildTrustComment({ owner, repo, pullRequest, author, metrics, score, plan }) {
  const content = buildContent({ owner, repo, pullRequest, author, metrics, score, plan })
  const fingerprint = createHash("sha256").update(content).digest("hex").slice(0, 12)

  return {
    fingerprint,
    body: [
      COMMENT_MARKER_HTML,
      `<!-- ${FINGERPRINT_MARKER_PREFIX}${fingerprint} -->`,
      content,
    ].join("\n"),
  }
}
