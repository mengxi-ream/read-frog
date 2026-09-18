---
"@read-frog/extension": patch
---

chore(analytics): count glossary terms reaching a prompt as feature usage

Anonymous usage analytics now records a `glossary` feature the moment one of your terms
actually matches and goes into a translation prompt, alongside the events the other
features already report. Owning a glossary reports nothing; the terms have to match.

The event says which feature the terms rode in on — page translation, subtitles, the
selection toolbar, or input translation — and nothing else. The terms themselves, and
the text they matched in, never leave the browser. It is throttled by the same
once-per-day cache as every other feature-usage event, and the analytics opt-out in
Settings switches it off with the rest.
