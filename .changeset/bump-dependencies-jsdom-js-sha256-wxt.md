---
"@read-frog/extension": patch
---

chore(deps): bump dependencies, including the `js-sha256` 1.0 and `jsdom` 30 majors — `js-sha256` 1.0 splits into a native-crypto path for Node and a pure-JS path for the browser bundle (hash output is unchanged, so persisted cache keys stay valid), `jsdom` 30 raises its Node floor and only affects the test environment, and `wxt` 0.21.3 swaps its zip implementation. Also pins the pnpm-managed Node runtime to `^26.5.1` and aligns the CI `node-version` with it, so the declared version matches the one that actually runs the build and tests.
