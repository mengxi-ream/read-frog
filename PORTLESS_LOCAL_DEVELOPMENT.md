# Develop the extension against a local monorepo worktree

Start the selected `read-frog-monorepo` worktree first:

```sh
cd ../read-frog-monorepo
pnpm dev:www
```

Then, in this extension checkout:

```sh
pnpm dev:local
```

By default, `dev:local` selects the sibling `read-frog-monorepo` directory. To select another worktree, set `WXT_MONOREPO_PATH` to its root (absolute or relative to this extension checkout):

```sh
WXT_MONOREPO_PATH=/path/to/read-frog-monorepo-worktree pnpm dev:local
```

If the monorepo was started with a fixed `READ_FROG_DEV_INSTANCE` (for an OAuth test slot), set the same value on the extension command. The startup check compares both instance and checkout fingerprint with the live API. The selected worktree supplies the extension's local package aliases and Portless API and website URLs together. WXT receives `WXT_API_URL`, `WXT_WEBSITE_URL`, `WXT_OFFICIAL_SITE_ORIGINS`, and `WXT_AUTH_COOKIE_DOMAINS` from that pair. Local `.env.development` still supplies unrelated development variables. The command fails if the API or website is unavailable.

The extension login button opens the selected worktree's `/log-in` page. Use that page's email/password flow for ordinary local worktrees; the extension then calls the same worktree's API with the browser's session cookie. Test website login and the extension in **the same browser profile**, because cookies are profile-specific. For several extension/backend pairs at once, use separate browser profiles: the development extension has a fixed browser extension ID, so loading multiple copies in one profile does not isolate their extension storage.

Google OAuth is a separate local test setup. Arbitrary `*.localhost` worktree callbacks are not automatically registered with Google. A Google login test needs a pre-registered exact callback on a supported development domain and the matching `READ_FROG_DEV_INSTANCE`; `dev:local` does not create OAuth client registrations. This does not affect the normal email/password login path.

The extension's own WXT development server stays on WXT's port (starting at 3333); Portless fronts the monorepo website and API, not WXT's HMR server. Regular `pnpm dev` in this repo continues to use the normal extension environment.
