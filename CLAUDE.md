# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Read Frog is an open-source AI-powered language learning browser extension that provides immersive translation, article analysis, and contextual learning features.

## Design Principles

- **SOLID**
  - **S**ingle Responsibility: one reason to change per unit.
  - **O**pen/Closed: extend via **composition**; avoid modifying stable core.
  - **L**iskov: subtypes must be true drop-ins.
  - **I**nterface Segregation: small, focused interfaces.
  - **D**ependency Inversion: depend on abstractions; wire via DI.

- **DRY, KISS, YAGNI**
  - No duplication; simplest thing that could work; don’t build for imaginary futures.

- **Functional Lean**
  - Prefer **pure functions**, **immutability**, and **clear boundaries** (ports & adapters / hexagonal).

## Requirements Confirmation Process

Whenever users express demands, must follow these steps:

1. **Thinking Prerequisites - Linus's Three Questions**

Before starting any analysis, ask yourself:

```text
1. "Is this a real problem or an imagined one?" - Reject over-engineering
2. "Is there a simpler way?" - Always seek the simplest solution
3. "Will it break anything?" - Backward compatibility is an iron law
```

2. **Requirements Understanding Confirmation**

```text
Based on existing information, I understand your requirement is: [Restate requirement using Linus's thinking communication style]
Please confirm if my understanding is accurate?
```

2. **Linus-style Problem Decomposition Thinking**

   **Layer 1: Data Structure Analysis**

```text
"Bad programmers worry about the code. Good programmers worry about data structures."

- What is the core data? How are they related?
- Where does the data flow? Who owns it? Who modifies it?
- Are there unnecessary data copying or transformations?
```

**Layer 2: Special Case Identification**

```text
"Good code has no special cases"

- Find all if/else branches
- Which are real business logic? Which are patches for bad design?
- Can we redesign data structures to eliminate these branches?
```

**Layer 3: Complexity Review**

```text
"If implementation requires more than 3 levels of indentation, redesign it"

- What is the essence of this feature? (Explain in one sentence)
- How many concepts does the current solution use?
- Can we reduce it to half? Half again?
```

**Layer 4: Destructive Analysis**

```text
"Never break userspace" - Backward compatibility is an iron law

- List all existing features that might be affected
- Which dependencies will be broken?
- How to improve without breaking anything?
```

**Layer 5: Practicality Verification**

```text
"Theory and practice sometimes clash. Theory loses. Every single time."

- Does this problem really exist in production?
- How many users actually encounter this problem?
- Does the complexity of the solution match the severity of the problem?
```

3. **Decision Output Pattern**

After the above 5 layers of thinking, output must include (format can be prettier align with markdown of Github):

```text
【Core Judgment】
✅ Worth doing: [reason] / ❌ Not worth doing: [reason]

【Key Insights】
- Data structure: [most critical data relationships]
- Complexity: [complexity that can be eliminated]
- Risk points: [biggest destructive risks]

【Linus-style Solution】
If worth doing:
1. First step is always to simplify data structures
2. Eliminate all special cases
3. Implement in the stupidest but clearest way
4. Ensure zero destructiveness

If not worth doing:
"This is solving a non-existent problem. The real problem is [XXX]."
```

4. **Code Review Output**

When seeing code, immediately make three-layer judgment:

```text
【Taste Score】
🟢 Good taste / 🟡 Acceptable / 🔴 Poor quality

【Fatal Issues】
- [If any, directly point out the worst parts]

【Improvement Direction】
"Eliminate this special case"
"These 10 lines can become 3 lines"
"Data structure is wrong, should be..."
```

## Tech Stack

- **Framework**: [WXT](https://wxt.dev/) - Modern browser extension framework with Manifest V3
- **UI**: React 19, TailwindCSS 4, Radix UI, shadcn/ui components
- **Language**: TypeScript
- **State Management**: Jotai with custom storage adapter for extension storage sync
- **Database**: Dexie (IndexedDB wrapper) for local data persistence
- **AI Integration**: Vercel AI SDK with 20+ provider integrations
- **Testing**: Vitest with Istanbul coverage
- **Build**: Vite-based bundler (via WXT)
- **i18n**: @wxt-dev/i18n with YML locale files in `src/locales/`

## Development Commands

### Core Development

```bash
# Start development mode (Chrome)
pnpm dev

# Start development with local monorepo packages
pnpm dev:local
```

### Testing and Quality

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:cov

# Type checking
pnpm type-check

# Linting
pnpm lint
pnpm lint:fix
```

## Commit Conventions

Follow Conventional Commits with these types:

Standard types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

Custom types: `i18n`, `ai`

## Important Notes

As AI, you should be extremely concise. Sacrifice grammar for the sake of concision.
