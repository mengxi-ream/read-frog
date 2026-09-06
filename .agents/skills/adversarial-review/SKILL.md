---
name: adversarial-review
description: >-
  Adversarial code review using cross-model approach. Spawns reviewers on the opposing model
  (Claude uses Codex, Codex uses Claude) to challenge work from distinct critical lenses.
  Produces a synthesized verdict with findings and lead judgment. Triggers: "adversarial review".
schedule: "After cook sessions that produce large diffs (200+ lines), implement plan phases, or complete a planning session"
---

# Adversarial Review

Spawn reviewers on the **opposite model** to challenge work. Reviewers attack from distinct
lenses grounded in brain principles. The deliverable is a synthesized verdict — do NOT make
changes.

**Hard constraint:** Reviewers MUST run via the opposite model's CLI (`codex exec` or
`claude -p`). Do NOT use subagents, the Agent tool, or any internal delegation mechanism as
reviewers — those run on *your own* model, which defeats the purpose.

## Step 1 — Load Principles

Read `brain/principles.md`. Follow every `[[wikilink]]` and read each linked principle file.
These govern reviewer judgments.

## Step 2 — Determine Scope and Intent

Identify what to review from context (recent diffs, referenced plans, user message).

Determine the **intent** — what the author is trying to achieve. This is critical: reviewers
challenge whether the work *achieves the intent well*, not whether the intent is correct.
State the intent explicitly before proceeding.

Assess change size:

| Size | Threshold | Reviewers |
|------|-----------|-----------|
| Small | < 50 lines, 1-2 files | 1 (Skeptic) |
| Medium | 50-200 lines, 3-5 files | 2 (Skeptic + Architect) |
| Large | 200+ lines or 5+ files | 3 (Skeptic + Architect + Minimalist) |

Read `references/reviewer-lenses.md` for lens definitions.

## Step 3 — Detect Model and Spawn Reviewers

Create a temp directory for reviewer output:

```sh
REVIEW_DIR=$(mktemp -d /tmp/adversarial-review.XXXXXX)
```

Determine which model you are, then spawn reviewers on the opposite:

**If you are Claude** — spawn Codex reviewers via `codex exec`:

```sh
codex exec --skip-git-repo-check -o "$REVIEW_DIR/skeptic.md" "prompt" 2>/dev/null
```

Use `--profile edit` only if the reviewer needs to run tests. Default to read-only.
Run with `run_in_background: true`, monitor via `TaskOutput` with `block: true, timeout: 600000`.

**If you are Codex** — spawn Claude reviewers via `claude` CLI:

```sh
claude -p "prompt" > "$REVIEW_DIR/skeptic.md" 2>/dev/null
```

Run with `run_in_background: true`.

Name each output file after the lens: `skeptic.md`, `architect.md`, `minimalist.md`.

Build each reviewer's prompt using the template in `references/reviewer-prompt.md`.

## Step 4 — Verify and Synthesize Verdict

Before reading reviewer output, log which CLI was used and confirm the output files exist:

```sh
echo "reviewer_cli=codex|claude"
ls "$REVIEW_DIR"/*.md
```

If any output file is missing or empty, note the failure in the verdict — do not silently skip
a reviewer.

Read each reviewer's output file from `$REVIEW_DIR/`. Deduplicate overlapping findings.
Produce a single verdict using the format in `references/verdict-format.md`.

## Step 5 — Render Judgment

After synthesizing the reviewers, apply your own judgment. Using the stated intent and brain
principles as your frame, state which findings you would accept and which you would reject —
and why. Reviewers are adversarial by design; not every finding warrants action. Call out
false positives, overreach, and findings that mistake style for substance.

Append the Lead Judgment section to the verdict (see `references/verdict-format.md`).
