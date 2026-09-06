# Verdict Format

```
## Intent
<what the author is trying to achieve>

## Verdict: PASS | CONTESTED | REJECT
<one-line summary>

## Findings
<numbered list, ordered by severity (high -> medium -> low)>

For each finding:
- **[severity]** Description with file:line references
- Lens: which reviewer raised it
- Principle: which brain principle it maps to
- Recommendation: concrete action, not vague advice

## What Went Well
<1-3 things the reviewers found no issue with -- acknowledge good work>

## Lead Judgment
<for each finding: accept or reject with a one-line rationale>
```

## Verdict Logic

- **PASS** — no high-severity findings
- **CONTESTED** — high-severity findings but reviewers disagree on them
- **REJECT** — high-severity findings with reviewer consensus
