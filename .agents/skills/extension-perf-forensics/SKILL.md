---
name: extension-perf-forensics
description: Diagnose extension-caused memory leaks, freezes, and CPU storms on live third-party sites via controlled attribution experiments, CDP metrics, heap snapshots, and browser-process trace profiling that works even when the renderer is starved.
metadata:
  author: read-frog
  version: "1.0.0"
---

# Extension Performance Forensics

Use this skill when a user reports that the extension makes a page **leak memory, freeze, or burn CPU** ("卡死", OOM, fans spinning, page renders wrong AND slows down), especially on a specific third-party site. It turns "it feels broken" into a measured, attributed root cause with pass/fail numbers you can re-run after every fix.

This skill complements [extension-real-browser-testing](../extension-real-browser-testing/SKILL.md) (functional validation, screenshots). Use that one to prove behavior; use this one to find out **who is burning the resources**.

## Core principle: the attribution ladder

Never conclude from a single run. A perf report on a live site has at least four possible culprits, and the fix differs for each. Run the ladder top-down; each rung is the same scripted interaction, changing exactly one variable:

1. **No-extension control** on the reported page — measures the site's own baseline (live sites leak and churn on their own).
2. **Extension-on run** on the reported page — the reported scenario. Delta vs (1) is the extension's total contribution.
3. **Static-page control** (e.g., a simple news site) with the extension on — separates "extension reacts to site churn" from "extension misbehaves everywhere".
4. **Feature-isolation runs** — same page, extension on, but one suspect neutralized (e.g., pre-mark a DOM region as excluded before the extension walks it; force a different config). If neutralizing X makes the numbers clean, X is the trigger.

Two hard-won corollaries:

- **Verify the effective config after the run** (dump it from the extension's storage in the same profile). This session's first three runs silently tested the wrong target language because an onboarding page had overwritten it — every conclusion drawn before the dump was mis-attributed.
- **Suspect the site, not just the extension.** Sites ship their own unbounded fit-loops (`while (overflows()) moveItem()` inside a ResizeObserver). Any extension that changes element sizes can trip them. If rung (4) with a region excluded is clean while your own code is already loop-free, read the site's bundle — the hot loop may be theirs, and the right fix is an exclusion rule, not more extension code.

## Quick reference

| Topic | Reference |
|-------|-----------|
| Repro harness: launching with the extension (Chrome 137+), config patching races, instrumentation, sampling loop, freeze tolerance, control modes | [references/repro-harness.md](references/repro-harness.md) |
| Metric semantics, GC-disciplined baselines, heap snapshots, memlab, retention signatures | [references/heap-and-metrics.md](references/heap-and-metrics.md) |
| Profiling a starved renderer via the Tracing domain, mapping minified frames back to site code, the detached-DOM churn signature | [references/starved-renderer-profiling.md](references/starved-renderer-profiling.md) |

## Workflow

1. Build the exact artifact under suspicion (or the fix candidate) and script the reported interaction (load → wait for the feature to engage → N interaction cycles → idle watch → final measurements). Log every sample as JSONL.
2. Run the attribution ladder. Force-GC before baseline and final samples; snapshot heap only in runs where you are not measuring timing (snapshots pause the world).
3. Read the failure signature from the metrics (see [heap-and-metrics](references/heap-and-metrics.md) for the table). The three big ones:
   - heap grows after GC with DOM unchanged → JS-side retention → heap snapshots + memlab retainers;
   - CDP `Nodes` explodes while `getElementsByTagName("*").length` stays flat AND layout/style counters freeze → a JS loop building **detached** DOM at full speed → CPU profile, not heap;
   - everything stable but `TaskDuration` runs hot → churn without retention → count your own DOM insert/remove operations per cycle.
4. If probes hang (evaluate timeouts, `Profiler.start` never returns), the renderer main thread is starved — capture the CPU profile through the **browser-process Tracing domain** instead ([starved-renderer-profiling](references/starved-renderer-profiling.md)).
5. Attribute the hot frames. Extension frames → fix the extension. Site frames → reproduce the site's trigger without the extension (simulate the DOM change by hand), then neutralize via exclusion/site rule and re-verify.
6. After each fix: rebuild, rerun the *identical* harness, compare against the recorded broken/control baselines in a pass-criteria table (nodes order-of-magnitude, TaskDuration, freeze count, heap-after-GC delta, feature-still-works count). A fix that only moves one number may have missed a second cooperating root cause — this session's storm fix was correct yet the freeze persisted until the site's own loop was also neutralized.

## Verdict discipline

- Distinguish **harmless churn** (allocated then GC'd; oscillating `Nodes`) from **retention** (survives forced GC). Only the latter is a leak.
- Distinguish **deterministic** failures from **storm-intensity-dependent** ones; re-run the broken build if a fix seems to "work" on a single lucky run.
- Record which failure modes are absorbed by existing safety nets vs which escape them; prioritize the escaping ones.

## Gotchas that cost hours

- **Chrome ≥137 ignores `--load-extension`.** Launch with `pipe: true, enableExtensions: true` and call `browser.installExtension(path)` (Puppeteer ≥22.11). The install does not persist across sessions — re-install per run.
- **Config patch races**: the extension's own init/migrations/onboarding can clobber your patch seconds after install. Patch → wait → re-assert → **verify** before navigating, and re-verify after the run.
- **Cloudflare**: fresh automated profiles get challenged; `curl` gets 5xx. Grab site bundles via response interception inside a real page load, or use an interactive in-app browser pane which typically passes.
- **zsh nukes `PATH`** if a loop variable is named `path` (lowercase `path` is tied to `PATH`).
- Run timing-sensitive rungs **sequentially**, one browser at a time, separate profile dirs per experiment.
- WXT builds need the env files; copy `.env.development` / `.env.production` into worktrees before `pnpm build`.
