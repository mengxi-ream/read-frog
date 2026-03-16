# webext-core - Match Patterns

Package: `@webext-core/match-patterns`

Parse and test URLs against [WebExtension match patterns](https://developer.chrome.com/docs/extensions/mv3/match_patterns/).

## Basic Usage

```ts
import { MatchPattern } from '@webext-core/match-patterns';

const pattern = new MatchPattern('*://*.google.com/*');

pattern.includes('http://google.com/search?q=test');   // true
pattern.includes('https://accounts.google.com');        // true
pattern.includes('https://youtube.com/watch');          // false
```

`includes()` accepts a `string`, a `URL` object, or `window.location`.

## Pattern Syntax

Patterns follow the format `<scheme>://<host>/<path>`.

| Pattern | Matches |
|---|---|
| `<all_urls>` | All http, https, file, ftp, and urn URLs |
| `*://*.example.com/*` | Any subdomain of example.com over http or https |
| `https://example.com/*` | Any path on example.com over https only |
| `https://*/api/*` | Any host, path containing `/api/`, over https |
| `http://localhost/*` | Any path on localhost over http |

## Wildcard Rules

- **Scheme** (`*`): matches `http` and `https` only (not file, ftp, or urn).
- **Host** (`*.`): the `*.` prefix matches any subdomain, including the bare domain itself (e.g., `*.google.com` matches both `google.com` and `mail.google.com`). A wildcard in any other position in the host is invalid.
- **Path** (`*`): matches any sequence of characters.

## Supported Protocols

| Protocol | Supported |
|---|---|
| `http` | Yes |
| `https` | Yes |
| `<all_urls>` | Yes (expands to all protocols in pattern list) |
| `file` | No (throws "Not implemented") |
| `ftp` | No (throws "Not implemented") |
| `urn` | No (throws "Not implemented") |

## `InvalidMatchPattern` Error

The constructor throws `InvalidMatchPattern` when the pattern string is malformed:

```ts
import { MatchPattern, InvalidMatchPattern } from '@webext-core/match-patterns';

try {
  const pattern = new MatchPattern('not-a-valid-pattern');
} catch (err) {
  if (err instanceof InvalidMatchPattern) {
    console.error(err.message);
    // e.g. 'Invalid match pattern "not-a-valid-pattern": Incorrect format'
  }
}
```

Common reasons for `InvalidMatchPattern`:
- Pattern does not match the `scheme://host/path` format.
- Scheme is not one of the allowed values.
- Hostname contains a port (ports are not allowed in match patterns).
- Wildcard `*` appears somewhere in the hostname other than as a `*.` prefix.

## Filtering Sender URLs in Messaging

```ts
import { MatchPattern } from '@webext-core/match-patterns';
import { onMessage } from './messaging';

const allowed = new MatchPattern('*://*.mysite.com/*');

onMessage('doAction', ({ sender }) => {
  if (!sender.tab?.url || !allowed.includes(sender.tab.url)) {
    throw new Error('Message not allowed from this origin');
  }
  return performAction();
});
```
