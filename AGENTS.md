# AGENTS.md

This file provides guidance to Cursor (cursor.com) when working with code in this repository.

## Project Overview

Read Frog is a browser extension that helps you read and understand text on the web. The Chinese name is called 陪读蛙.

It supports multiple languages and multiple LLM providers.

## Coding Style

### Design principles

- SOLID:
  1. S: Single Responsibility — each unit does one thing.
  2. O: Open/Closed — extend via composition, don’t modify core.
  3. L: Liskov — subtype drop-in replacements only.
  4. I: Interface Segregation — small, focused interfaces.
  5. D: Dependency Inversion — depend on abstractions (DI).
- DRY, KISS, YAGNI. Prefer composition over inheritance.
- Use pure functions, immutability, and clear separation of concerns (ports & adapters/clean boundaries).

### Code quality

- Strong typing and explicit interfaces. Avoid magic values; centralize constants.
- Small, cohesive modules; use descriptive, self-documenting variable and function names.
- No side effects in constructors.
- Validate and sanitize inputs at boundaries; handle errors explicitly (typed/results).

### Testing

- Include unit tests (Arrange-Act-Assert) for core logic and edge cases.

### Error Handling

- Use proper exception handling, avoid silent failures.
- Provide meaningful error messages.
- Validate inputs early and explicitly.
- Handle edge cases gracefully.

### Style nits to avoid

- deep nesting, long parameter lists, hidden globals, tight coupling.

## Common Development Commands

### Development

- `pnpm dev` - Run all apps in development mode
- `pnpm dev:extension` - Run only the browser extension (`@read-frog/extension`)
- `pnpm dev:website` - Run only the website (`@read-frog/website`)

### Building & Testing

- `pnpm build` - Build all apps
- `pnpm test` - Run tests across all packages
- `pnpm lint` - Lint all code and run turbo lint
- `pnpm lint:fix` - Fix linting issues automatically
- `pnpm type-check` - Type check all TypeScript code

### Extension Specific

- `pnpm --filter=@read-frog/extension test:watch` - Run extension tests in watch mode
- `pnpm --filter=@read-frog/extension zip` - Create extension ZIP for distribution
- `pnpm --filter=@read-frog/extension dev:firefox` - Run extension in Firefox
- `pnpm --filter=@read-frog/extension dev:edge` - Run extension in Edge

### Database

- `pnpm db:generate` - Generate database schema
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open database studio

## Project Architecture

### Monorepo Structure

This is a Turborepo monorepo with two main applications and shared packages:

**Apps:**

- `apps/extension/` - Browser extension built with WXT (WebExtension Tooling)
- `apps/website/` - Next.js website with documentation and user dashboard

**Shared Packages:**

- `packages/api/` - tRPC API definitions shared between extension and website
- `packages/auth/` - Authentication logic using better-auth
- `packages/db/` - Database schema and client using Drizzle ORM
- `packages/definitions/` - Shared types and constants
- `packages/ui/` - Shared UI components
- `packages/eslint-config/` - ESLint configurations
- `packages/typescript-config/` - TypeScript configurations

### Extension Architecture

The extension uses WXT framework with the following key entrypoints:

- `background/` - Service worker for API requests and background tasks
- `popup/` - Extension popup UI
- `options/` - Extension settings page
- `host.content/` - Content script for page translation
- `side.content/` - Side panel for article reading
- `selection.content/` - Text selection translation

Key technical aspects:

- React + TypeScript for UI components
- Jotai for state management
- Dexie for IndexedDB storage
- AI SDK for multiple LLM provider support (OpenAI, DeepSeek, Google)
- tRPC for type-safe API communication with website

### Website Architecture

Next.js 15 app with:

- App Router with internationalization (i18n) support
- Fumadocs for documentation system
- Better-auth for authentication
- Drizzle ORM with database
- tRPC for API layer
- Tailwind CSS for styling

## Development Environment Setup

- Node.js 22.18.0+ required (specified in devEngines)
- pnpm as package manager
- The extension requires browser-specific setup - check `apps/extension/web-ext.config.ts`

## Key Dependencies

- **WXT**: Extension development framework
- **Better-auth**: Authentication system
- **Drizzle**: Database ORM
- **tRPC**: Type-safe API layer
- **AI SDK**: Multi-provider AI integration
- **Turborepo**: Monorepo build system

## Testing

- Extension uses Vitest with React Testing Library
- Tests located in `__tests__` directories
- Coverage available via `test:cov` command in extension package

## Commit Message Guidelines

Follow conventional commits format: `type(scope): description`, keep the commit message concise and clear. and don't add `🤖 Generated with [Cursor](https://cursor.com)` in the commit message.

**Allowed commit types:**

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `build`: Build system changes
- `ci`: CI/CD changes
- `perf`: Performance improvements
- `revert`: Reverting previous commits
- `i18n`: Internationalization changes
- `ai`: AI-related features or improvements

**Examples:**

- `feat(extension): add vocabulary book feature`
- `fix(website): resolve login redirect issue`
- `docs: update contribution guide`
- `i18n(extension): add Japanese translations`
- `ai(extension): integrate new DeepSeek model`

## Language

The code comments should be in English.

## i18n

Locale files are in `apps/extension/src/locales` for extension app and `apps/website/messages` for website app.

After you updated the locale files for extension app, you need to run `pnpm dev:extension` to update the locale types to pass the ESLint check.

## Animations Guidelines
 
### Keep your animations fast
 
- Default to use `ease-out` for most animations.
- Animations should never be longer than 1s (unless it's illustrative), most of them should be around 0.2s to 0.3s.
 
### Easing rules
 
- Don't use built-in CSS easings unless it's `ease` or `linear`.
- Use the following easings for their described use case:
  - **`ease-in`**: (Starts slow, speeds up) Should generally be avoided as it makes the UI feel slow.
    - `ease-in-quad`: `cubic-bezier(.55, .085, .68, .53)`
    - `ease-in-cubic`: `cubic-bezier(.550, .055, .675, .19)`
    - `ease-in-quart`: `cubic-bezier(.895, .03, .685, .22)`
    - `ease-in-quint`: `cubic-bezier(.755, .05, .855, .06)`
    - `ease-in-expo`: `cubic-bezier(.95, .05, .795, .035)`
    - `ease-in-circ`: `cubic-bezier(.6, .04, .98, .335)`
 
  - **`ease-out`**: (Starts fast, slows down) Best for elements entering the screen or user-initiated interactions.
    - `ease-out-quad`: `cubic-bezier(.25, .46, .45, .94)`
    - `ease-out-cubic`: `cubic-bezier(.215, .61, .355, 1)`
    - `ease-out-quart`: `cubic-bezier(.165, .84, .44, 1)`
    - `ease-out-quint`: `cubic-bezier(.23, 1, .32, 1)`
    - `ease-out-expo`: `cubic-bezier(.19, 1, .22, 1)`
    - `ease-out-circ`: `cubic-bezier(.075, .82, .165, 1)`
 
  - **`ease-in-out`**: (Smooth acceleration and deceleration) Perfect for elements moving within the screen.
    - `ease-in-out-quad`: `cubic-bezier(.455, .03, .515, .955)`
    - `ease-in-out-cubic`: `cubic-bezier(.645, .045, .355, 1)`
    - `ease-in-out-quart`: `cubic-bezier(.77, 0, .175, 1)`
    - `ease-in-out-quint`: `cubic-bezier(.86, 0, .07, 1)`
    - `ease-in-out-expo`: `cubic-bezier(1, 0, 0, 1)`
    - `ease-in-out-circ`: `cubic-bezier(.785, .135, .15, .86)`
 
 
### Hover transitions
 
- Use the built-in CSS `ease` with a duration of `200ms` for simple hover transitions like `color`, `background-color`,`opacity`.
- Fall back to easing rules for more complex hover transitions.
- Disable hover transitions on touch devices with the `@media (hover: hover) and (pointer: fine)` media query.
 
### Accessibility
 
- If `transform` is used in the animation, disable it in the `prefers-reduced-motion` media query.
 
### Origin-aware animations
 
- Elements should animate from the trigger. If you open a dropdown or a popover it should animate from the button. Change `transform-origin` according to the trigger position.
 
### Performance
 
- Stick to opacity and transforms when possible. Example: Animate using `transform` instead of `top`, `left`, etc. when trying to move an element.
- Do not animate drag gestures using CSS variables.
- Do not animate blur values higher than 20px.
- Use `will-change` to optimize your animation, but use it only for: `transform`, `opacity`, `clipPath`, `filter`.
- When using Motion/Framer Motion use `transform` instead of `x` or `y` if you need animations to be hardware accelerated.
 
### Spring animations
 
- Default to spring animations when using Framer Motion.
- Avoid using bouncy spring animations unless you are working with drag gestures.


## Others

- Please disregard any console.log statements in my code that may violate ESLint rules.
- When you want to use `git add xxx` to add files before commit, please use `git add .` to add all files.