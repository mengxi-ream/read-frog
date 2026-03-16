# WXT - Multi-Browser Targeting

## Build Commands

```sh
wxt                    # dev, targets chrome (default)
wxt -b firefox         # dev, targets Firefox
wxt -b safari          # dev, targets Safari
wxt -b edge            # dev, targets Edge
wxt -b custom-browser  # dev, custom browser string

wxt build              # build for chrome
wxt build -b firefox   # build for Firefox

wxt build --mv2        # build targeting Manifest V2
wxt build --mv3        # build targeting Manifest V3

wxt build -b firefox --mv3  # explicit: Firefox + MV3
```

## Default Manifest Versions Per Browser

| Browser | Default Manifest Version |
|---|---|
| Chrome | MV3 |
| Edge | MV3 |
| Opera | MV3 |
| Firefox | MV2 |
| Safari | MV2 |

Override with `--mv2` or `--mv3` flags on any command.

## Runtime Detection

### Browser Detection

```ts
if (import.meta.env.BROWSER === 'firefox') {
  console.log('Running in Firefox');
}

// Shorthand boolean constants
if (import.meta.env.CHROME) { ... }
if (import.meta.env.FIREFOX) { ... }
if (import.meta.env.SAFARI) { ... }
if (import.meta.env.EDGE) { ... }
if (import.meta.env.OPERA) { ... }
```

### Manifest Version Detection

```ts
if (import.meta.env.MANIFEST_VERSION === 2) {
  // MV2-specific code
}
if (import.meta.env.MANIFEST_VERSION === 3) {
  // MV3-specific code
}
```

### Narrowing the BROWSER Type

Set `targetBrowsers` in `wxt.config.ts` to make `import.meta.env.BROWSER` a union type for better TypeScript inference:

```ts
export default defineConfig({
  // Now BROWSER is typed as "chrome" | "firefox" instead of string
  // (not a real config option — use -b CLI flag or browser option)
});
```

## Entrypoint Filtering

Control which entrypoints are included per browser using `include` and `exclude`:

```ts
// Only included when targeting Firefox
export default defineContentScript({
  include: ['firefox'],
  matches: ['<all_urls>'],
  main(ctx) { ... },
});

// Excluded from Chrome builds
export default defineBackground({
  exclude: ['chrome'],
  main() { ... },
});
```

```html
<!-- HTML entrypoints -->
<meta name="manifest.include" content="['chrome', 'edge']" />
<meta name="manifest.exclude" content="['firefox']" />
```

## Per-Browser Environment Files

Create browser-specific `.env` files to set different values per browser:

```
.env.chrome
.env.firefox
.env.safari
```

## Manifest Per-Browser/MV Logic

Use the manifest function to conditionally set properties:

```ts
export default defineConfig({
  manifest: ({ browser, manifestVersion }) => ({
    // Different permissions per browser
    permissions: browser === 'firefox'
      ? ['storage', 'tabs']
      : ['storage', 'tabs', 'offscreen'],

    // Different host_permissions per MV (to avoid MV2 issues)
    host_permissions: manifestVersion === 2 ? [] : ['https://api.example.com/*'],

    // Browser-specific keys
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'my-extension@example.com',
          strict_min_version: '109.0',
        },
      },
    }),
  }),
});
```
