# WXT - Content Scripts

## defineContentScript Options

```ts
export default defineContentScript({
  // Required: URL patterns where this script runs
  matches: ['*://*.example.com/*', '<all_urls>'],

  // Optional manifest options
  excludeMatches: ['*://*.example.com/exclude/*'],
  includeGlobs: ['*://*.example.com/include/*'],
  excludeGlobs: ['*://*.example.com/exclude/*'],
  allFrames: false,
  runAt: 'document_idle', // 'document_start' | 'document_end' | 'document_idle'
  matchAboutBlank: false,
  matchOriginAsFallback: false,
  world: 'ISOLATED',      // 'ISOLATED' | 'MAIN'

  // Build filtering
  include: ['chrome'],
  exclude: ['firefox'],

  // CSS injection mode (required for Shadow Root UI)
  cssInjectionMode: 'manifest', // 'manifest' | 'manual' | 'ui'

  // Registration mode
  registration: 'manifest', // 'manifest' | 'runtime'

  main(ctx: ContentScriptContext) {
    // Can be async
  },
});
```

All runtime code must be inside `main()` — WXT imports this file in a NodeJS environment during the build.

## Content Script Context (ctx)

The first argument of `main()` is the `ContentScriptContext`. It tracks whether the context is "invalidated" (happens when the extension is updated, disabled, or uninstalled — the content script keeps running but extension APIs stop working).

### ctx Helpers

Use these instead of the global equivalents to automatically stop when the context is invalidated:

```ts
export default defineContentScript({
  matches: ['<all_urls>'],
  main(ctx) {
    ctx.addEventListener(window, 'click', handler);   // auto-removed on invalidation
    ctx.setTimeout(() => { ... }, 1000);              // auto-cancelled
    ctx.setInterval(() => { ... }, 1000);             // auto-cancelled
    ctx.requestAnimationFrame(() => { ... });         // auto-cancelled
  },
});
```

### Manual Validity Check

```ts
if (ctx.isValid) {
  // context is still active
}
if (ctx.isInvalid) {
  // context has been invalidated
}
```

### onInvalidated

```ts
ctx.onInvalidated(() => {
  // cleanup logic
});
```

## CSS Imports

Import a CSS file from the content script entrypoint — WXT automatically adds the bundled CSS to the manifest's `css` array:

```ts
// entrypoints/example.content/index.ts
import './style.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  main(ctx) { ... },
});
```

For a standalone CSS-only content script, create `entrypoints/example.content.css` then add to the manifest via a hook.

## UI Approaches

| Method | Isolated Styles | Isolated Events | HMR | Access page context |
|---|:---:|:---:|:---:|:---:|
| Integrated | No | No | No | Yes |
| Shadow Root | Yes | Yes (opt-in) | No | Yes |
| IFrame | Yes | Yes | Yes | No |

### Shadow Root UI

Styles are isolated from the page using `ShadowRoot`. Best choice for most content script UIs.

Steps:
1. Import CSS at the top of the content script
2. Set `cssInjectionMode: 'ui'` in `defineContentScript`
3. Create with `createShadowRootUi()`
4. Call `ui.mount()`

```ts
// Vanilla
import './style.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'example-ui',
      position: 'inline',
      anchor: 'body',
      onMount(container) {
        const app = document.createElement('p');
        app.textContent = 'Hello world!';
        container.append(app);
      },
    });
    ui.mount();
  },
});
```

```ts
// Vue
import './style.css';
import { createApp } from 'vue';
import App from './App.vue';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'example-ui',
      position: 'inline',
      anchor: 'body',
      onMount: (container) => {
        const app = createApp(App);
        app.mount(container);
        return app;
      },
      onRemove: (app) => {
        app?.unmount();
      },
    });
    ui.mount();
  },
});
```

```tsx
// React
import './style.css';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'example-ui',
      position: 'inline',
      anchor: 'body',
      onMount: (container) => {
        // React warns about mounting on body — create a wrapper div
        const app = document.createElement('div');
        container.append(app);
        const root = ReactDOM.createRoot(app);
        root.render(<App />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });
    ui.mount();
  },
});
```

```ts
// Svelte
import './style.css';
import App from './App.svelte';
import { mount, unmount } from 'svelte';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'example-ui',
      position: 'inline',
      anchor: 'body',
      onMount: (container) => mount(App, { target: container }),
      onRemove: (app) => unmount(app),
    });
    ui.mount();
  },
});
```

```tsx
// Solid
import './style.css';
import { render } from 'solid-js/web';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'example-ui',
      position: 'inline',
      anchor: 'body',
      onMount: (container) => {
        const unmount = render(() => <div>...</div>, container);
        return unmount;
      },
      onRemove: (unmount) => unmount?.(),
    });
    ui.mount();
  },
});
```

### Integrated UI

UI injected alongside page content — affected by page CSS. No style isolation.

```ts
export default defineContentScript({
  matches: ['<all_urls>'],
  main(ctx) {
    const ui = createIntegratedUi(ctx, {
      position: 'inline',
      anchor: 'body',
      onMount: (container) => {
        const app = document.createElement('p');
        app.textContent = '...';
        container.append(app);
      },
    });
    ui.mount();
  },
});
```

### IFrame UI

UI loaded in an iframe — full style and event isolation, HMR supported.

1. Create an HTML entrypoint for the iframe: `entrypoints/example-iframe.html`
2. Add to `web_accessible_resources` in `wxt.config.ts`:
   ```ts
   export default defineConfig({
     manifest: {
       web_accessible_resources: [
         { resources: ['example-iframe.html'], matches: ['<all_urls>'] },
       ],
     },
   });
   ```
3. Create and mount:
   ```ts
   export default defineContentScript({
     matches: ['<all_urls>'],
     main(ctx) {
       const ui = createIframeUi(ctx, {
         page: '/example-iframe.html',
         position: 'inline',
         anchor: 'body',
         onMount: (wrapper, iframe) => {
           iframe.width = '400';
         },
       });
       ui.mount();
     },
   });
   ```

## UI Position Options

All UI creation functions accept a `position` option:

- `'inline'` — placed inline with page content relative to `anchor`
- `'overlay'` — overlaid on top of `anchor`
- `'modal'` — fixed position, blocking the page

And an `anchor` option (CSS selector, element, or function returning an element).

## Auto-mount

Use `ui.autoMount()` instead of `ui.mount()` to automatically mount when the anchor appears and unmount when it disappears. Useful for dynamic DOM elements:

```ts
const ui = createIntegratedUi(ctx, {
  position: 'inline',
  anchor: '#dynamic-element',
  onMount: (container) => { ... },
});

// Observes anchor — mounts/unmounts as element appears/disappears
ui.autoMount();
```

## SPA Navigation (wxt:locationchange)

Content scripts only run on full page loads. SPAs don't trigger full reloads. Use `wxt:locationchange` to detect URL changes:

```ts
const watchPattern = new MatchPattern('*://*.youtube.com/watch*');

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  main(ctx) {
    ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => {
      if (watchPattern.includes(newUrl)) {
        mountUi(ctx);
      }
    });
  },
});
```

## Isolated World vs Main World

By default, content scripts run in an **isolated world** — only the DOM is shared with the page.

Setting `world: 'MAIN'` runs in the page's JavaScript context but has drawbacks:
- Chromium MV3 only (no MV2, no Firefox)
- No access to extension APIs

### Recommended: injectScript()

Use `injectScript()` to inject a script into the main world. This supports MV2, MV3, and all browsers:

```
entrypoints/
  example.content.ts
  example-main-world.ts
```

```ts
// entrypoints/example-main-world.ts
export default defineUnlistedScript(() => {
  console.log('Hello from the main world');
});
```

```ts
// entrypoints/example.content.ts
export default defineContentScript({
  matches: ['*://*/*'],
  async main() {
    await injectScript('/example-main-world.js', {
      keepInDom: true,
    });
    // Script has been evaluated — can now communicate with it
  },
});
```

```ts
// wxt.config.ts — add to web_accessible_resources
export default defineConfig({
  manifest: {
    web_accessible_resources: [
      { resources: ['example-main-world.js'], matches: ['*://*/*'] },
    ],
  },
});
```

Note: For MV2, `injectScript` fetches the script text and creates an inline `<script>` block asynchronously — it will not run at the same time as the content script's `run_at`.

### CustomEvent Bridge Between Worlds

Pass data to the injected script via `modifyScript` and communicate bidirectionally via CustomEvents:

```ts
// entrypoints/example.content.ts
export default defineContentScript({
  matches: ['*://*/*'],
  async main() {
    const { script } = await injectScript('/example-main-world.js', {
      modifyScript(script) {
        // Add listener BEFORE the script loads
        script.addEventListener('from-injected-script', (event) => {
          if (event instanceof CustomEvent) {
            console.log('from injected:', event.detail);
          }
        });
        // Pass data to the script
        script.dataset['greeting'] = 'Hello there';
      },
    });

    // Send event AFTER the script is loaded
    script.dispatchEvent(
      new CustomEvent('from-content-script', { detail: 'General Kenobi' }),
    );
  },
});
```

```ts
// entrypoints/example-main-world.ts
export default defineUnlistedScript(() => {
  const script = document.currentScript;

  // Receive data passed via dataset
  console.log(script?.dataset['greeting']); // "Hello there"

  script?.addEventListener('from-content-script', (event) => {
    if (event instanceof CustomEvent) {
      console.log('from content:', event.detail);
    }
  });

  script?.dispatchEvent(
    new CustomEvent('from-injected-script', { detail: 'Hello there' }),
  );
});
```
