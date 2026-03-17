# WXT - Modules

WXT modules let you hook into the build process to modify config, the manifest, entrypoints, and generated files.

## Using Published Modules

Install the NPM package, then add it to `wxt.config.ts`:

```ts
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
});
```

### Available Official Modules

| Module | Description |
|---|---|
| `@wxt-dev/module-vue` | Vue 3 support + auto-imports for Vue APIs |
| `@wxt-dev/module-react` | React support via `@vitejs/plugin-react` |
| `@wxt-dev/module-svelte` | Svelte support |
| `@wxt-dev/module-solid` | Solid.js support |
| `@wxt-dev/auto-icons` | Generate extension icons at required sizes from a single source image |
| `@wxt-dev/i18n` | Type-safe i18n for web extensions |

Search `"wxt module"` on NPM to find more published modules.

## Creating Local Modules

Add a file to `<rootDir>/modules/`:

```
{rootDir}/
  modules/
    my-module.ts
```

```ts
// modules/my-module.ts
import { defineWxtModule } from 'wxt/modules';

export default defineWxtModule({
  setup(wxt) {
    // Your module code here
    wxt.hook('build:manifestGenerated', (_, manifest) => {
      manifest.name += ' (modified by module)';
    });
  },
});
```

## setup(wxt) API

The `wxt` object provided to `setup()`:

- `wxt.hook(event, handler)` — subscribe to a build lifecycle hook
- `wxt.config` — the resolved config from `wxt.config.ts`
- `wxt.logger` — log messages to the console

### Key Hooks

| Hook | Arguments | Description |
|---|---|---|
| `config:resolved` | `()` | After config is resolved — modify `wxt.config` here |
| `build:manifestGenerated` | `(wxt, manifest)` | After manifest is generated — modify it by reference |
| `entrypoints:found` | `(wxt, entrypointInfos)` | After entrypoint files are discovered — add custom entrypoints |
| `entrypoints:resolved` | `(wxt, entrypoints)` | After entrypoints are resolved and validated |
| `build:publicAssets` | `(wxt, assets)` | Add files to copy to the output directory |
| `prepare:types` | `(wxt, entries)` | Add files to `.wxt/` during `wxt prepare` |

### Common Recipes

Update resolved config:

```ts
export default defineWxtModule({
  setup(wxt) {
    wxt.hook('config:resolved', () => {
      wxt.config.outDir = 'dist';
    });
  },
});
```

Modify the manifest:

```ts
export default defineWxtModule({
  setup(wxt) {
    wxt.hook('build:manifestGenerated', (_, manifest) => {
      if (wxt.config.mode === 'development') {
        manifest.name += ' (DEV)';
      }
    });
  },
});
```

Add a custom entrypoint:

```ts
export default defineWxtModule({
  setup(wxt) {
    wxt.hook('entrypoints:found', (_, entrypointInfos) => {
      entrypointInfos.push({
        name: 'my-custom-script',
        inputPath: 'path/to/custom-script.js',
        type: 'content-script',
      });
    });
  },
});
```

Generate an output file:

```ts
export default defineWxtModule({
  setup(wxt) {
    const filePath = 'some-file.txt';

    wxt.hook('build:publicAssets', (_, assets) => {
      assets.push({
        relativeDest: filePath,
        contents: 'some generated text',
      });
    });

    wxt.hook('build:manifestGenerated', (_, manifest) => {
      manifest.web_accessible_resources ??= [];
      manifest.web_accessible_resources.push({
        matches: ['*://*'],
        resources: [filePath],
      });
    });
  },
});
```

## Module with Typed Config Options (configKey)

Use `configKey` to accept typed build-time options from `wxt.config.ts`:

```ts
// modules/my-module.ts
import { defineWxtModule } from 'wxt/modules';
import 'wxt';

export interface MyModuleOptions {
  enabled?: boolean;
  apiUrl?: string;
}

declare module 'wxt' {
  export interface InlineConfig {
    myModule?: MyModuleOptions;
  }
}

export default defineWxtModule<MyModuleOptions>({
  configKey: 'myModule',

  setup(wxt, options) {
    // options is typed as MyModuleOptions
    if (options?.enabled) {
      wxt.hook('build:manifestGenerated', (_, manifest) => {
        manifest.permissions ??= [];
        manifest.permissions.push('tabs');
      });
    }
  },
});
```

Usage in `wxt.config.ts`:

```ts
export default defineConfig({
  modules: ['./modules/my-module'],
  myModule: {
    enabled: true,
    apiUrl: 'https://api.example.com',
  },
});
```

## Runtime Config for Modules

Modules can add typed runtime options to `app.config.ts`:

```ts
import 'wxt/utils/define-app-config';

declare module 'wxt/utils/define-app-config' {
  export interface WxtAppConfig {
    myModule?: {
      theme: 'light' | 'dark';
    };
  }
}
```

Access at runtime:

```ts
const config = getAppConfig();
console.log(config.myModule?.theme);
```

## Execution Order

Modules are loaded in this order (hooks execute in the same order):

1. NPM modules — in the order listed in `modules` config
2. Local modules in `modules/` directory — loaded alphabetically
3. `hooks` in `wxt.config.ts`

Control order by prefixing local module filenames with numbers:

```
modules/
  0.my-module.ts   ← loads first
  1.other.ts       ← loads second
```

To run an NPM module after local modules, re-export it as a local module with a number prefix:

```ts
// modules/2.i18n.ts
export { default } from '@wxt-dev/i18n/module';
```

To see the execution order for your project: `wxt prepare --debug` and search for "Hook execution order".
