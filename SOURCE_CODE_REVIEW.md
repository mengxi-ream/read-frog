# Source Code Review - Build Instructions

## Build Environment

- **Node.js**: ^26.7.0 (installed automatically by pnpm from the `devEngines.runtime` field)
- **pnpm**: 12.3.4 (pinned by the `packageManager` field in `package.json`)

## Build Steps

```bash
# 1. Install pnpm if it is not already available
npx get-pnpm

# 2. Install dependencies using the version pinned in package.json
pnpm install --frozen-lockfile

# 3. Build the Firefox extension
pnpm zip:firefox
```

## Environment Variables

The `.env.production` file is included in this archive. It contains:

- `WXT_GOOGLE_CLIENT_ID` — A public Google OAuth Client ID used for Google Sign-In. This is **not** a secret; OAuth Client IDs are designed to be embedded in client-side applications.

## Build Output

After a successful build, the packaged extension will be at:

```
.output/read-frogextension-<version>-firefox.zip
```
