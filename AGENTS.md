# AGENTS.md

## Testing Notes

- `src/utils/host/translate/api/__tests__/free-api.test.ts` depends on live external translation services.
- When running tests locally as an AI agent, set `SKIP_FREE_API=true`.
- If `SKIP_FREE_API=true` is set, treat `free-api.test.ts` as intentionally skipped during local validation.

## Site Rules Notes

- `src/utils/site-rules/built-in/rules.json` is also published to installed extensions on every merge to `main` that changes it (`.github/workflows/publish-site-rules.yml`), and they pick it up within about six hours. Code still only ships with a release.
- If a rule depends on code in the same PR, set `"minExtensionVersion"` on it to the version that code will ship in: the current `package.json` version with the patch number bumped. Older versions keep their bundled copy of the rule, or skip a new one. A rule using a field that older versions don't know is skipped by them automatically.
- Deleting a rule removes it from every installed version within about six hours. If new code makes a rule unnecessary, keep the rule until that code is released and delete it in a follow-up PR.
- Rule CSS can't load anything (`url(`, `image-set(`, `image(`, `src(`, `@import`), and no CSS string may end in a hex escape such as `\75`, with or without a carriage return after it, or installed extensions refuse the rule.

## PR Notes

- PR titles must use conventional commit format, such as `fix(subtitles): ...`; avoid extra prefixes like `[codex]`.
- User-facing fixes and features should include a `.changeset/*.md` file for `@read-frog/extension` unless the change intentionally does not need a release. use conventional commit format for the changeset content.
