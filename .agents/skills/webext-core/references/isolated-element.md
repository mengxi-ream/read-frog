# webext-core - Isolated Element

Package: `@webext-core/isolated-element`

Create a Shadow DOM container for content script UIs. Isolates styles from the host page and controls event bubbling. Supports Chrome, Firefox, and Safari.

## Basic Usage

```ts
import { createIsolatedElement } from '@webext-core/isolated-element';

const { parentElement, isolatedElement, shadow } = await createIsolatedElement({
  name: 'my-extension-ui', // valid custom element name (must contain a hyphen)
  css: {
    textContent: `
      p { color: red; font-family: sans-serif; }
      button { background: #0070f3; color: white; padding: 8px 16px; border: none; }
    `,
  },
});

// Mount your UI inside isolatedElement — styles are scoped here
const p = document.createElement('p');
p.textContent = 'Isolated text';
isolatedElement.appendChild(p);

// Add parentElement to the page DOM to show the UI
document.body.appendChild(parentElement);
```

## Returned Values

| Value | Type | Description |
|---|---|---|
| `parentElement` | `HTMLElement` | The custom element you append to `document.body` |
| `isolatedElement` | `HTMLElement` | A `<div>` inside the shadow root; mount your UI here |
| `shadow` | `ShadowRoot` | The shadow root; use for advanced DOM manipulation |

## `createIsolatedElement` Options

```ts
export interface CreateIsolatedElementOptions {
  name: string;                            // Tag name for the shadow host
  mode?: 'open' | 'closed';               // ShadowRoot.mode, default: 'closed'
  css?: { url: string } | { textContent: string }; // Styles loaded into shadow DOM
  isolateEvents?: boolean | string[];      // Stop events from bubbling to host page
}
```

### `name`

The tag name used for the shadow host element. Must be a valid HTML tag that supports shadow DOM attachment — either a known semantic element (`div`, `span`, `article`, `aside`, `blockquote`, `body`, `footer`, `h1`–`h6`, `header`, `main`, `nav`, `p`, `section`) or a valid **custom element name**.

Custom element naming rules:
- Must contain at least one hyphen (`-`)
- Must be all lowercase
- Cannot start with a digit
- Cannot be a reserved name (e.g., `annotation-xml`, `color-profile`, `font-face`, `font-face-src`, `font-face-uri`, `font-face-format`, `font-face-name`, `missing-glyph`)

```ts
// Valid
name: 'my-extension-ui'
name: 'github-line-diff'
name: 'div'

// Invalid — throws Error
name: 'myui'        // no hyphen
name: 'MyExtUI'     // uppercase
name: '1-ext-ui'    // starts with digit
```

### `mode`

Shadow DOM mode. Defaults to `'closed'`, which prevents external JavaScript from accessing the shadow root via `element.shadowRoot`. Use `'open'` if you need programmatic access from outside.

### `css`

Inject styles that are scoped to the shadow DOM:

```ts
// From a URL (fetched at creation time)
css: { url: browser.runtime.getURL('/content-scripts/style.css') }

// Inline text
css: { textContent: 'p { color: blue; }' }
```

### `isolateEvents`

Prevents specified events from bubbling up through the shadow boundary to the host page. Useful to stop the page from intercepting keyboard shortcuts or click events from your UI.

```ts
// Default set: ['keydown', 'keyup', 'keypress']
isolateEvents: true

// Custom list
isolateEvents: ['click', 'keydown', 'keyup', 'input', 'pointerdown']
```

## Framework Integration (Vue)

```ts
import { createIsolatedElement } from '@webext-core/isolated-element';
import { createApp } from 'vue';
import App from './App.vue';
import browser from 'webextension-polyfill';

const { parentElement, isolatedElement } = await createIsolatedElement({
  name: 'my-extension-overlay',
  css: { url: browser.runtime.getURL('/assets/content-style.css') },
  mode: 'closed',
  isolateEvents: true,
});

const app = createApp(App);
app.mount(isolatedElement);
document.body.appendChild(parentElement);
```

## Framework Integration (React)

```ts
import { createIsolatedElement } from '@webext-core/isolated-element';
import { createRoot } from 'react-dom/client';
import App from './App';

const { parentElement, isolatedElement } = await createIsolatedElement({
  name: 'my-extension-panel',
  css: { textContent: styles },
  isolateEvents: ['keydown', 'keyup'],
});

createRoot(isolatedElement).render(<App />);
document.body.appendChild(parentElement);
```

## Cleanup

To remove the UI from the page, remove `parentElement` from the DOM:

```ts
parentElement.remove();
```
