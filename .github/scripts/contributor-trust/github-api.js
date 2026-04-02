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

export async function ensureRepositoryLabels(token, owner, repo, labelDefinitions) {
  for (const [name, definition] of Object.entries(labelDefinitions)) {
    try {
      await apiRequest(token, `/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`)
    }
    catch (error) {
      if (!(error instanceof GitHubApiError) || error.details.response?.status !== 404)
        throw error

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
  const slug = `${owner}/${repo}`
  const query = `
    query ContributorTrust(
      $login: String!
      $openPrsQuery: String!
      $mergedPrsQuery: String!
      $closedPrsQuery: String!
      $reviewsQuery: String!
    ) {
      rateLimit {
        cost
        remaining
        resetAt
      }
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
      reviews: search(query: $reviewsQuery, type: ISSUE, first: 1) {
        issueCount
      }
    }
  `

  const variables = {
    login: authorLogin,
    openPrsQuery: `repo:${slug} author:${authorLogin} type:pr is:open`,
    mergedPrsQuery: `repo:${slug} author:${authorLogin} type:pr is:merged`,
    closedPrsQuery: `repo:${slug} author:${authorLogin} type:pr is:closed is:unmerged`,
    reviewsQuery: `repo:${slug} reviewed-by:${authorLogin} type:pr`,
  }

  const data = await graphqlRequest(token, query, variables)
  const user = data.user ?? await getUserFallback(token, authorLogin)
  const topRepositories = selectOwnedNonForkRepositories(data.user?.ownedNonForkRepositories?.nodes ?? [], authorLogin)

  return {
    author: {
      avatarUrl: user?.avatarUrl ?? user?.avatar_url ?? null,
      createdAt: user?.createdAt ?? user?.created_at ?? null,
      followers: user?.followers?.totalCount ?? user?.followers ?? 0,
      login: user?.login ?? authorLogin,
      name: user?.name ?? null,
      publicRepos: user?.repositories?.totalCount ?? user?.public_repos ?? 0,
      url: user?.url ?? user?.html_url ?? `https://github.com/${authorLogin}`,
    },
    rateLimit: data.rateLimit ?? null,
    repoHistory: {
      closedPrs: data.closedPrs?.issueCount ?? 0,
      mergedPrs: data.mergedPrs?.issueCount ?? 0,
      openPrs: data.openPrs?.issueCount ?? 0,
      reviews: data.reviews?.issueCount ?? 0,
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
