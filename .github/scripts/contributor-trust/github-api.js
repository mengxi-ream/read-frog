import { POLICY } from "./config.js"

const API_BASE_URL = "https://api.github.com"

class GitHubApiError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = "GitHubApiError"
    this.details = details
  }
}

function buildHeaders(token, extraHeaders = {}) {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "read-frog-contributor-trust",
    ...extraHeaders,
  }
}

async function parseResponse(response) {
  const text = await response.text()
  if (!text)
    return null

  try {
    return JSON.parse(text)
  }
  catch {
    return text
  }
}

function buildErrorMessage(method, path, response, payload) {
  const suffix = payload && typeof payload === "object" && "message" in payload
    ? `: ${payload.message}`
    : ""
  return `${method} ${path} failed with ${response.status} ${response.statusText}${suffix}`
}

export async function apiRequest(token, path, { body, headers, method = "GET" } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildHeaders(token, headers),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await parseResponse(response)

  if (!response.ok) {
    throw new GitHubApiError(buildErrorMessage(method, path, response, payload), {
      path,
      payload,
      response,
    })
  }

  return payload
}

export async function graphqlRequest(token, query, variables) {
  const response = await fetch(`${API_BASE_URL}/graphql`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify({ query, variables }),
  })
  const payload = await parseResponse(response)

  if (!response.ok) {
    throw new GitHubApiError(buildErrorMessage("POST", "/graphql", response, payload), {
      payload,
      response,
    })
  }

  if (payload.errors?.length) {
    throw new GitHubApiError(payload.errors.map(error => error.message).join("; "), {
      payload,
      response,
    })
  }

  return payload.data
}

export async function paginate(token, path) {
  const items = []

  for (let page = 1; page <= 10; page += 1) {
    const url = new URL(`${API_BASE_URL}${path}`)
    url.searchParams.set("per_page", "100")
    url.searchParams.set("page", String(page))

    const response = await fetch(url, {
      headers: buildHeaders(token),
    })
    const payload = await parseResponse(response)

    if (!response.ok) {
      throw new GitHubApiError(buildErrorMessage("GET", `${path}?page=${page}`, response, payload), {
        payload,
        response,
      })
    }

    if (!Array.isArray(payload)) {
      throw new GitHubApiError(`Expected array payload from ${path}`, { payload })
    }

    items.push(...payload)
    if (payload.length < 100)
      break
  }

  return items
}

export async function getPullRequest(token, owner, repo, pullNumber) {
  return apiRequest(token, `/repos/${owner}/${repo}/pulls/${pullNumber}`)
}

export async function listIssueLabels(token, owner, repo, issueNumber) {
  const labels = await apiRequest(token, `/repos/${owner}/${repo}/issues/${issueNumber}/labels?per_page=100`)
  return labels.map(label => label.name)
}

export async function listIssueComments(token, owner, repo, issueNumber) {
  return paginate(token, `/repos/${owner}/${repo}/issues/${issueNumber}/comments`)
}

export async function createIssueComment(token, owner, repo, issueNumber, body) {
  return apiRequest(token, `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    body: { body },
    method: "POST",
  })
}

export async function updateIssueComment(token, owner, repo, commentId, body) {
  return apiRequest(token, `/repos/${owner}/${repo}/issues/comments/${commentId}`, {
    body: { body },
    method: "PATCH",
  })
}

export async function addLabelsToIssue(token, owner, repo, issueNumber, labels) {
  if (labels.length === 0)
    return []

  return apiRequest(token, `/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
    body: { labels },
    method: "POST",
  })
}

export async function removeLabelFromIssue(token, owner, repo, issueNumber, labelName) {
  return apiRequest(token, `/repos/${owner}/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(labelName)}`, {
    method: "DELETE",
  })
}

export async function closePullRequestIssue(token, owner, repo, issueNumber) {
  return apiRequest(token, `/repos/${owner}/${repo}/issues/${issueNumber}`, {
    body: { state: "closed" },
    method: "PATCH",
  })
}

export async function getCollaboratorPermission(token, owner, repo, username) {
  try {
    const response = await apiRequest(token, `/repos/${owner}/${repo}/collaborators/${encodeURIComponent(username)}/permission`)
    return response.permission ?? null
  }
  catch (error) {
    if (error instanceof GitHubApiError && error.details.response?.status === 404)
      return null
    throw error
  }
}

export async function listRepositoryLabels(token, owner, repo) {
  return paginate(token, `/repos/${owner}/${repo}/labels`)
}

export async function ensureRepositoryLabels(token, owner, repo, labelDefinitions) {
  const existingLabels = new Set(
    (await listRepositoryLabels(token, owner, repo)).map(label => label.name),
  )

  for (const [name, definition] of Object.entries(labelDefinitions)) {
    if (existingLabels.has(name))
      continue

    try {
      await apiRequest(token, `/repos/${owner}/${repo}/labels`, {
        body: {
          color: definition.color,
          description: definition.description,
          name,
        },
        method: "POST",
      })
    }
    catch (createError) {
      if (!(createError instanceof GitHubApiError) || createError.details.response?.status !== 422)
        throw createError
    }
  }
}

function countReviewsOnOthersPullRequests(nodes, authorLogin) {
  const normalizedAuthorLogin = authorLogin.toLowerCase()
  let reviews = 0

  for (const node of nodes ?? []) {
    const pullRequestAuthor = node?.author?.login?.toLowerCase()
    if (!pullRequestAuthor || pullRequestAuthor === normalizedAuthorLogin)
      continue

    reviews += 1
  }

  return reviews
}

function getReviewSearchPageInfo(searchResult) {
  return {
    endCursor: searchResult?.pageInfo?.endCursor ?? null,
    hasNextPage: searchResult?.pageInfo?.hasNextPage === true,
  }
}

function normalizeReviewSearchNodes(searchResult) {
  return (searchResult?.nodes ?? []).filter(node => node?.__typename === "PullRequest")
}

export async function countReviewsOnOthersPullRequestsInRepo(token, owner, repo, authorLogin, pageSize) {
  let reviews = 0
  let cursor = null

  while (true) {
    const data = await graphqlRequest(token, `
      query ReviewsOnOthersPullRequests(
        $cursor: String
        $pageSize: Int!
        $reviewsQuery: String!
      ) {
        search(query: $reviewsQuery, type: ISSUE, first: $pageSize, after: $cursor) {
          nodes {
            __typename
            ... on PullRequest {
              author {
                login
              }
            }
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    `, {
      cursor,
      pageSize,
      reviewsQuery: `repo:${owner}/${repo} reviewed-by:${authorLogin} type:pr`,
    })

    const searchResult = data.search
    reviews += countReviewsOnOthersPullRequests(
      normalizeReviewSearchNodes(searchResult),
      authorLogin,
    )

    const pageInfo = getReviewSearchPageInfo(searchResult)
    if (!pageInfo.hasNextPage)
      break

    cursor = pageInfo.endCursor
    if (!cursor)
      break
  }

  return reviews
}

function coalesceAuthorUser(user, fallbackUser, authorLogin) {
  return {
    avatarUrl: user?.avatarUrl ?? fallbackUser?.avatar_url ?? null,
    createdAt: user?.createdAt ?? fallbackUser?.created_at ?? null,
    followers: user?.followers?.totalCount ?? fallbackUser?.followers ?? 0,
    login: user?.login ?? fallbackUser?.login ?? authorLogin,
    name: user?.name ?? fallbackUser?.name ?? null,
    publicRepos: user?.repositories?.totalCount ?? fallbackUser?.public_repos ?? 0,
    url: user?.url ?? fallbackUser?.html_url ?? `https://github.com/${authorLogin}`,
  }
}

export function createPullRequestStateList({ closedPrs, mergedPrs, openPrs }) {
  return [
    ...Array.from({ length: mergedPrs }).fill({ state: "merged" }),
    ...Array.from({ length: closedPrs }).fill({ state: "closed" }),
    ...Array.from({ length: openPrs }).fill({ state: "open" }),
  ]
}

export function createContributorMetrics({ author, permission, repoHistory }) {
  const contributionCount = repoHistory.mergedPrs + repoHistory.reviews

  return {
    accountCreated: author.createdAt,
    contributionCount,
    followers: author.followers,
    isContributor: contributionCount > 0,
    prsInRepo: createPullRequestStateList(repoHistory),
    repoPermission: permission ?? null,
    reviewsInRepo: repoHistory.reviews,
    topRepoStars: repoHistory.topRepositories.map(repository => repository.stargazerCount),
  }
}

function normalizeOwnedRepository(node, ownerLogin) {
  if (!node?.nameWithOwner || !ownerLogin)
    return null

  const repositoryOwner = node.owner?.login?.toLowerCase()
  if (repositoryOwner !== ownerLogin.toLowerCase())
    return null

  if (node.isFork === true)
    return null

  return {
    nameWithOwner: node.nameWithOwner,
    stargazerCount: Number(node.stargazerCount) || 0,
  }
}

export function selectOwnedNonForkRepositories(nodes, ownerLogin) {
  const topRepositories = []

  for (const node of nodes ?? []) {
    const repository = normalizeOwnedRepository(node, ownerLogin)
    if (!repository)
      continue

    topRepositories.push(repository)
  }

  return topRepositories
}

export async function getAuthorMetrics(token, owner, repo, authorLogin) {
  const query = `
    query ContributorTrust(
      $login: String!
      $openPrsQuery: String!
      $mergedPrsQuery: String!
      $closedPrsQuery: String!
    ) {
      user(login: $login) {
        login
        name
        url
        avatarUrl
        createdAt
        followers {
          totalCount
        }
        repositories {
          totalCount
        }
        ownedNonForkRepositories: repositories(
          first: 20
          ownerAffiliations: [OWNER]
          isFork: false
          orderBy: { field: STARGAZERS, direction: DESC }
        ) {
          nodes {
            isFork
            nameWithOwner
            owner {
              login
            }
            stargazerCount
          }
        }
      }
      openPrs: search(query: $openPrsQuery, type: ISSUE, first: 1) {
        issueCount
      }
      mergedPrs: search(query: $mergedPrsQuery, type: ISSUE, first: 1) {
        issueCount
      }
      closedPrs: search(query: $closedPrsQuery, type: ISSUE, first: 1) {
        issueCount
      }
    }
  `

  const variables = {
    login: authorLogin,
    openPrsQuery: `repo:${owner}/${repo} author:${authorLogin} type:pr is:open`,
    mergedPrsQuery: `repo:${owner}/${repo} author:${authorLogin} type:pr is:merged`,
    closedPrsQuery: `repo:${owner}/${repo} author:${authorLogin} type:pr is:closed is:unmerged`,
  }

  const data = await graphqlRequest(token, query, variables)
  const fallbackUser = data.user ? null : await getUserFallback(token, authorLogin)
  const author = coalesceAuthorUser(data.user, fallbackUser, authorLogin)
  const reviews = await countReviewsOnOthersPullRequestsInRepo(
    token,
    owner,
    repo,
    authorLogin,
    POLICY.reviewQueryPageSize,
  )
  const topRepositories = selectOwnedNonForkRepositories(data.user?.ownedNonForkRepositories?.nodes ?? [], authorLogin)

  return {
    author,
    repoHistory: {
      closedPrs: data.closedPrs?.issueCount ?? 0,
      mergedPrs: data.mergedPrs?.issueCount ?? 0,
      openPrs: data.openPrs?.issueCount ?? 0,
      reviews,
      topRepositories,
    },
  }
}

async function getUserFallback(token, authorLogin) {
  try {
    return await apiRequest(token, `/users/${encodeURIComponent(authorLogin)}`)
  }
  catch (error) {
    if (error instanceof GitHubApiError && error.details.response?.status === 404)
      return null
    throw error
  }
}
