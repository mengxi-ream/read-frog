import { execFileSync, spawn } from "node:child_process"
import { realpathSync } from "node:fs"
import { request } from "node:https"
import { constants as osConstants } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

export function resolveMonorepoRoot(requestedPath = "../read-frog-monorepo") {
  const chosenPath = realpathSync(resolve(extensionRoot, requestedPath))
  const gitRoot = realpathSync(
    execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: chosenPath,
      encoding: "utf8",
    }).trim(),
  )
  if (chosenPath !== gitRoot) {
    throw new Error(`WXT_MONOREPO_PATH must point at the monorepo root: ${gitRoot}`)
  }
  return gitRoot
}

export function createWxtEnvironment(source, monorepoRoot, topology) {
  return {
    ...source,
    NODE_USE_SYSTEM_CA: "1",
    WXT_USE_LOCAL_PACKAGES: "true",
    WXT_MONOREPO_PATH: monorepoRoot,
    WXT_API_URL: topology.api,
    WXT_WEBSITE_URL: topology.www,
    WXT_OFFICIAL_SITE_ORIGINS: topology.www,
    WXT_AUTH_COOKIE_DOMAINS: topology.cookieDomain,
  }
}

// .localhost resolves in browsers, but Node's DNS lookup is not reliable on
// every macOS setup. Connect to loopback while preserving Host and TLS SNI.
export function probePortlessUrl(url, path, timeoutMs = 3_000) {
  const target = new URL(path, url)
  return new Promise((resolveProbe, rejectProbe) => {
    const probe = request(
      {
        hostname: "127.0.0.1",
        port: target.port || 443,
        path: target.pathname,
        servername: target.hostname,
        headers: { host: target.host },
        method: "GET",
      },
      (response) => {
        response.resume()
        resolveProbe({ status: response.statusCode, headers: response.headers })
      },
    )
    probe.setTimeout(timeoutMs, () => probe.destroy(new Error(`Timed out connecting to ${target}`)))
    probe.on("error", rejectProbe)
    probe.end()
  })
}

export function assertApiIdentity(response, identity, url) {
  if (response.status !== 200) {
    throw new Error(`The API at ${url} is not ready (HTTP ${response.status}).`)
  }
  if (
    response.headers["x-read-frog-dev-instance"] !== identity.instance ||
    response.headers["x-read-frog-dev-checkout"] !== identity.fingerprint
  ) {
    throw new Error(`The API at ${url} belongs to a different monorepo worktree.`)
  }
}

export function assertLoginPage(response, url) {
  if (!response.status || response.status < 200 || response.status >= 400) {
    throw new Error(`The login page at ${url}/log-in is not available (HTTP ${response.status}).`)
  }
  if (
    response.status >= 300 &&
    response.headers.location &&
    new URL(response.headers.location, `${url}/log-in`).origin !== new URL(url).origin
  ) {
    throw new Error(`The login page at ${url}/log-in redirects outside this worktree.`)
  }
}

async function main() {
  const monorepoRoot = resolveMonorepoRoot(process.env.WXT_MONOREPO_PATH)
  const { createTopology, resolveIdentity, serviceName } = await import(
    pathToFileURL(resolve(monorepoRoot, "scripts/dev/config.mjs")).href
  )
  const identity = resolveIdentity(monorepoRoot, process.env.READ_FROG_DEV_INSTANCE)
  const portlessCli = resolve(monorepoRoot, "node_modules/portless/dist/cli.js")
  const getUrl = (service) =>
    execFileSync(
      process.execPath,
      [portlessCli, "get", serviceName(service, identity), "--no-worktree"],
      { cwd: monorepoRoot, encoding: "utf8" },
    ).trim()
  const topology = createTopology(identity, "api", getUrl("api"))
  if (getUrl("www") !== topology.www) {
    throw new Error("Portless returned inconsistent API and website URLs.")
  }

  try {
    assertApiIdentity(await probePortlessUrl(topology.api, "/ready"), identity, topology.api)
    assertLoginPage(await probePortlessUrl(topology.www, "/log-in"), topology.www)
  } catch (error) {
    throw new Error(
      `Start this monorepo worktree with pnpm dev:www before pnpm dev:local. ${error.message}`,
      { cause: error },
    )
  }

  const childEnv = createWxtEnvironment(process.env, monorepoRoot, topology)
  console.log(`[dev:local] Worktree: ${monorepoRoot}`)
  console.log(`[dev:local] Website/login: ${topology.www}`)
  console.log(`[dev:local] API: ${topology.api}`)
  const wxtCli = resolve(extensionRoot, "node_modules/wxt/bin/wxt.mjs")
  const child = spawn(process.execPath, [wxtCli, ...process.argv.slice(2)], {
    cwd: extensionRoot,
    env: childEnv,
    stdio: "inherit",
  })
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => child.kill(signal))
  }
  await new Promise((resolveExit, rejectExit) => {
    child.once("error", rejectExit)
    child.once("exit", (code, signal) => {
      process.exitCode = code ?? (signal ? 128 + osConstants.signals[signal] : 1)
      resolveExit()
    })
  })
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[dev:local] ${error.message}`)
    process.exitCode = 1
  })
}
