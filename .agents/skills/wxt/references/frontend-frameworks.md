# WXT - Frontend Frameworks

## Module Setup

Install the module package, then add to `wxt.config.ts`:

```ts
// React
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
});
```

```ts
// Vue
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
});
```

```ts
// Svelte
export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
});
```

```ts
// Solid
export default defineConfig({
  modules: ['@wxt-dev/module-solid'],
});
```

Modules set up the Vite plugin and configure auto-imports for framework-specific APIs. They're thin wrappers — you can also add a framework manually:

```ts
import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';

export default defineConfig({
  vite: () => ({
    plugins: [react()],
  }),
});
```

## Multiple App Instances

Web extensions have multiple entry points (popup, options, sidepanel, content scripts). Each needs its own framework app instance. Use directory-based entrypoints:

```
src/
  assets/
    tailwind.css
  components/
    Button.tsx
  entrypoints/
    popup/
      index.html
      App.tsx
      main.tsx      ← create and mount app here
      style.css
      router.ts
    options/
      index.html
      App.tsx
      main.tsx
      pages/
```

## Hash Routing Requirement

Extension HTML pages have static URLs like `chrome-extension://{id}/popup.html`. You cannot change the path for routing — the path is fixed by the manifest. Use **hash mode** routing instead:

URL structure with hash routing: `popup.html#/` and `popup.html#/settings`

### React Router

```ts
import { createHashRouter, RouterProvider } from 'react-router-dom';

const router = createHashRouter([
  { path: '/', element: <Home /> },
  { path: '/settings', element: <Settings /> },
]);

ReactDOM.createRoot(document.getElementById('app')!).render(
  <RouterProvider router={router} />,
);
```

### Vue Router

```ts
import { createRouter, createWebHashHistory } from 'vue-router';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/settings', component: Settings },
  ],
});
```

### Solid Router

```tsx
import { Router, Route, HashRouter } from '@solidjs/router';

// Use HashRouter instead of Router
<HashRouter>
  <Route path="/" component={Home} />
  <Route path="/settings" component={Settings} />
</HashRouter>
```

### Svelte (svelte-spa-router)

```ts
// svelte-spa-router uses hash routing by default
import Router from 'svelte-spa-router';
import { wrap } from 'svelte-spa-router/wrap';
```

## Framework-Specific Notes

**React**: When mounting inside a Shadow Root UI with `createShadowRootUi`, React warns about mounting on `body`. Create a wrapper `div` first:

```tsx
onMount: (container) => {
  const app = document.createElement('div');
  container.append(app);
  const root = ReactDOM.createRoot(app);
  root.render(<App />);
  return root;
},
```

**Svelte**: Use the `mount`/`unmount` functions from Svelte 5:

```ts
import { mount, unmount } from 'svelte';
import App from './App.svelte';

onMount: (container) => mount(App, { target: container }),
onRemove: (app) => unmount(app),
```

**All frameworks**: Use `onRemove` to properly unmount your app when the content script UI is removed (prevents memory leaks and double-mounting):

```ts
onMount: (container) => {
  const app = createApp(App);
  app.mount(container);
  return app;             // ← return the app instance
},
onRemove: (app) => {
  app?.unmount();         // ← unmount using the returned instance
},
```
