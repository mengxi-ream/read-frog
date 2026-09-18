import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { assertApiIdentity, createWxtEnvironment, resolveMonorepoRoot } from "./dev-local.mjs"

describe("local extension worktree connection", () => {
  const identity = { instance: "wt-abc", fingerprint: "checkout-abc" }
  const topology = {
    api: "https://api.wt-abc.readfrog.localhost:1355",
    www: "https://www.wt-abc.readfrog.localhost:1355",
    cookieDomain: "wt-abc.readfrog.localhost",
  }

  it("uses the selected monorepo for both source aliases and runtime URLs", () => {
    const root = resolveMonorepoRoot()
    assert.equal(resolveMonorepoRoot(root), root)
    assert.throws(() => resolveMonorepoRoot(`${root}/apps/server`), /monorepo root/)
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(
          createWxtEnvironment({ WXT_API_URL: "https://localhost:4433" }, root, topology),
        ).filter(([key]) => key.startsWith("WXT_") || key === "NODE_USE_SYSTEM_CA"),
      ),
      {
        NODE_USE_SYSTEM_CA: "1",
        WXT_USE_LOCAL_PACKAGES: "true",
        WXT_MONOREPO_PATH: root,
        WXT_API_URL: topology.api,
        WXT_WEBSITE_URL: topology.www,
        WXT_OFFICIAL_SITE_ORIGINS: topology.www,
        WXT_AUTH_COOKIE_DOMAINS: topology.cookieDomain,
      },
    )
  })

  it("refuses an API route belonging to another checkout or a failed API", () => {
    const ready = {
      status: 200,
      headers: {
        "x-read-frog-dev-instance": identity.instance,
        "x-read-frog-dev-checkout": identity.fingerprint,
      },
    }
    assert.doesNotThrow(() => assertApiIdentity(ready, identity, topology.api))
    assert.throws(
      () =>
        assertApiIdentity(
          { ...ready, headers: { ...ready.headers, "x-read-frog-dev-checkout": "other" } },
          identity,
          topology.api,
        ),
      /different monorepo worktree/,
    )
    assert.throws(() => assertApiIdentity({ ...ready, status: 503 }, identity, topology.api))
  })
})
