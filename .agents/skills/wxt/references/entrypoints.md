# WXT - Entrypoints

## Project Structure

Default layout (flat, no `src/` dir):

```
{rootDir}/
  .output/          # build artifacts
  .wxt/             # generated TS config
  assets/           # CSS, images processed by WXT
  components/       # auto-imported UI components
  composables/      # auto-imported Vue composables
  entrypoints/      # all extension entrypoints
  hooks/            # auto-imported React/Solid hooks
  modules/          # local WXT modules
  public/           # files copied as-is to output
  utils/            # auto-imported utilities
  app.config.ts
  package.json
  tsconfig.json
  web-ext.config.ts
  wxt.config.ts
```

With `srcDir: 'src'` in `wxt.config.ts`, `assets/`, `components/`, `composables/`, `entrypoints/`, `hooks/`, `utils/`, and `app.config.ts` move into `src/`. `modules/`, `public/`, and config files stay at root.

Customizing directories:

```ts
export default defineConfig({
  srcDir: 'src',             // default: "."
  modulesDir: 'wxt-modules', // default: "modules"
  outDir: 'dist',            // default: ".output"
  publicDir: 'static',       // default: "public"
  entrypointsDir: 'entries', // default: "entrypoints", relative to srcDir
});
```

## Entrypoints Directory Rules

An entrypoint is a **single file** or a **directory with an `index` file** directly inside `entrypoints/`:

```
entrypoints/
  background.ts             # single file entrypoint
  popup/
    index.html              # directory entrypoint — index.html is the entrypoint
    main.ts                 # sibling files are OK here
    style.css
  background/
    index.ts                # directory entrypoint
    alarms.ts               # sibling files are OK here
    messaging.ts
```

**Entrypoints must be zero or one levels deep.** Deep nesting is not supported — use dot-notation names instead:

```
# Wrong — too deeply nested:
entrypoints/youtube/content/index.ts
entrypoints/youtube/injected/index.ts

# Correct:
entrypoints/youtube.content/index.ts
entrypoints/youtube-injected/index.ts
```

**Never put helper files directly in `entrypoints/`** — WXT will try to build every file there as an entrypoint:

```
# Wrong:
entrypoints/popup.html
entrypoints/popup.ts        ← WXT tries to build this as its own entrypoint
entrypoints/popup.css       ← WXT tries to build this as its own entrypoint

# Correct:
entrypoints/popup/
  index.html                ← This is the entrypoint
  main.ts
  style.css
```

## Background Entrypoint

File patterns: `background.[jt]s` or `background/index.[jt]s`

```ts
// Minimal
export default defineBackground(() => {
  browser.action.onClicked.addListener(() => {
    // ...
  });
});
```

```ts
// With manifest options
export default defineBackground({
  persistent: true,    // MV2 only — keep background page alive
  type: 'module',      // use ES module syntax in background

  include: ['chrome'], // only include in chrome builds
  exclude: ['firefox'],

  main() {
    // CANNOT be async
    // ALL runtime code must be inside main()
  },
});
```

For MV2: added as a script on the background page. For MV3: becomes a service worker.

The `main()` function **cannot be `async`**. All browser/extension API calls must be inside `main()` — WXT imports this file in a NodeJS environment during the build to extract manifest options.

```ts
// Wrong — code outside main() runs in NodeJS during build:
browser.action.onClicked.addListener(() => { ... });

export default defineBackground(() => {
  // Correct — inside main():
  browser.action.onClicked.addListener(() => { ... });
});
```

## HTML Entrypoints

All HTML entrypoints use `<meta>` tags to define manifest options.

### Popup

File patterns: `popup.html` or `popup/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Default Popup Title</title>

    <!-- Manifest options -->
    <meta name="manifest.default_icon" content="{ 16: '/icon-16.png', 48: '/icon-48.png' }" />
    <meta name="manifest.type" content="page_action" />  <!-- or "browser_action" for MV2 -->
    <meta name="manifest.browser_style" content="true" />
    <!-- Firefox only -->
    <meta name="manifest.default_area" content="navbar" />  <!-- navbar|menupanel|tabstrip|personaltoolbar -->
    <meta name="manifest.theme_icons" content="[{ light: '/icon-light-16.png', dark: '/icon-dark-16.png', size: 16 }]" />

    <!-- Build filtering -->
    <meta name="manifest.include" content="['chrome', 'edge']" />
    <meta name="manifest.exclude" content="['firefox']" />
  </head>
  <body>...</body>
</html>
```

### Options

File patterns: `options.html` or `options/index.html`

```html
<head>
  <title>Options</title>
  <meta name="manifest.open_in_tab" content="true" />
  <meta name="manifest.chrome_style" content="true" />
  <meta name="manifest.browser_style" content="true" />
  <meta name="manifest.include" content="['chrome']" />
  <meta name="manifest.exclude" content="['firefox']" />
</head>
```

### Side Panel

File patterns: `sidepanel.html`, `sidepanel/index.html`, `{name}.sidepanel.html`, `{name}.sidepanel/index.html`

Chrome uses `side_panel` API; Firefox uses `sidebar_action` API. WXT adds the `sidepanel` permission automatically.

```html
<head>
  <title>Default Side Panel Title</title>
  <meta name="manifest.default_icon" content="{ 16: '/icon-16.png' }" />
  <meta name="manifest.open_at_install" content="true" />
  <meta name="manifest.browser_style" content="true" />
  <meta name="manifest.include" content="['chrome']" />
  <meta name="manifest.exclude" content="['firefox']" />
</head>
```

### Newtab

File patterns: `newtab.html` or `newtab/index.html`

Overrides the browser's new tab page.

```html
<head>
  <title>New Tab</title>
  <meta name="manifest.include" content="['chrome']" />
  <meta name="manifest.exclude" content="['firefox']" />
</head>
```

### Devtools

File patterns: `devtools.html` or `devtools/index.html`

```html
<head>
  <meta name="manifest.include" content="['chrome']" />
  <meta name="manifest.exclude" content="['firefox']" />
</head>
```

### Bookmarks

File patterns: `bookmarks.html` or `bookmarks/index.html`

Overrides the browser's bookmarks page.

### History

File patterns: `history.html` or `history/index.html`

Overrides the browser's history page.

### Sandbox (Chromium only)

File patterns: `sandbox.html`, `sandbox/index.html`, `{name}.sandbox.html`, `{name}.sandbox/index.html`

Firefox does not support sandboxed pages.

## Unlisted Scripts

Not referenced in the manifest. Used for scripts injected into the main world by content scripts, or scripts executed via `browser.scripting.executeScript`.

File patterns: `{name}.[jt]sx?` or `{name}/index.[jt]sx?`

```ts
// Minimal
export default defineUnlistedScript(() => {
  console.log('Hello from the main world');
});
```

```ts
// With options
export default defineUnlistedScript({
  include: ['chrome'],
  exclude: ['firefox'],
  main() {
    // All runtime code must be inside main()
    document.querySelectorAll('a').forEach((anchor) => {
      // ...
    });
  },
});
```

Access at runtime: `browser.runtime.getURL('/{name}.js')`

Remember to add to `web_accessible_resources` if the script needs to be loaded by a content script.

## Unlisted Pages

Any HTML file whose name does not match a listed entrypoint pattern becomes an unlisted page. Accessible at `/{name}.html`:

```ts
window.open(browser.runtime.getURL('/welcome.html'));
```

```html
<head>
  <title>Welcome</title>
  <meta name="manifest.include" content="['chrome']" />
  <meta name="manifest.exclude" content="['firefox']" />
</head>
```

## Browser Targeting (include/exclude)

Every entrypoint supports `include` and `exclude` arrays to filter which builds it is included in:

```ts
// JS entrypoints — value is browser string matching -b CLI flag
export default defineContentScript({
  include: ['firefox'],      // only built when targeting firefox
  main(ctx) { ... },
});

export default defineBackground({
  exclude: ['chrome'],       // built for everything except chrome
  main() { ... },
});
```

```html
<!-- HTML entrypoints -->
<meta name="manifest.include" content="['chrome', 'edge']" />
<meta name="manifest.exclude" content="['firefox']" />
```

Valid values: `'chrome'`, `'firefox'`, `'safari'`, `'edge'`, `'opera'`, or any custom browser string passed to `-b`.
