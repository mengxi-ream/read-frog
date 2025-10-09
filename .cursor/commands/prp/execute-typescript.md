# Execute TypeScript PRP

## PRP File: $ARGUMENTS

## Mission: One-Pass TypeScript Implementation Success

PRPs enable working TypeScript/React code on the first attempt through:

- **Context Completeness**: Everything needed, nothing guessed
- **Progressive Validation**: 4-level gates catch errors early
- **Pattern Consistency**: Follow existing TypeScript/React codebase approaches
- **Type Safety**: Leverage TypeScript's compile-time error detection
- Read PRPs/README.md to understand PRP concepts

**Your Goal**: Transform the PRP into working TypeScript code that passes all validation gates and maintains type safety.

## Execution Process

1. **Load PRP**
   - Read the specified TypeScript PRP file completely
   - Absorb all context, patterns, requirements and gather codebase intelligence
   - Use the provided documentation references and file patterns, consume the right documentation before the appropriate todo/task
   - Trust the PRP's context and guidance - it's designed for one-pass success
   - If needed do additional codebase exploration and research as needed
   - Pay special attention to TypeScript interfaces, component patterns, and Next.js App Router structure

2. **ULTRATHINK & Plan**
   - Create comprehensive implementation plan following the PRP's task order
   - Break down into clear todos using TodoWrite tool
   - Use subagents for parallel work when beneficial (always create prp inspired prompts for subagents when used)
   - Follow the TypeScript/React patterns referenced in the PRP
   - Use specific file paths, interface names, component names, and type definitions from PRP context
   - Never guess - always verify the codebase patterns and examples referenced in the PRP yourself
   - Consider TypeScript compilation dependencies (types before components, components before pages)

3. **Execute Implementation**
   - Follow the PRP's Implementation Tasks sequence, add more detail as needed, especially when using subagents
   - Use the TypeScript/React patterns and examples referenced in the PRP
   - Create files in locations specified by the desired codebase tree
   - Apply TypeScript naming conventions from the task specifications and AGENTS.md
   - Ensure proper TypeScript typing throughout (interfaces, props, return types)
   - Follow Next.js App Router patterns for file-based routing

4. **Progressive Validation**

   **Execute the 4-level validation system from the TypeScript PRP:**
   - **Level 1**: Run TypeScript syntax & style validation commands from PRP (ESLint, tsc, Prettier)
   - **Level 2**: Execute component and hook unit test validation from PRP
   - **Level 3**: Run Next.js integration testing commands from PRP (dev server, API routes, production build)
   - **Level 4**: Execute TypeScript/React-specific validation from PRP (E2E, performance, accessibility)

   **Each level must pass before proceeding to the next.**

5. **Completion Verification**
   - Work through the Final Validation Checklist in the PRP
   - Verify all Success Criteria from the "What" section are met
   - Confirm all Anti-Patterns were avoided (especially TypeScript/React-specific ones)
   - Verify TypeScript compilation is successful with no errors
   - Ensure proper Server/Client component separation if using Next.js
   - Implementation is ready and working with full type safety

**Failure Protocol**: When validation fails, use the TypeScript/React patterns and gotchas from the PRP to fix issues, then re-run validation until passing. Pay special attention to:

- TypeScript compilation errors and type mismatches
- React hydration issues between server and client
- Next.js App Router specific requirements
- Component prop interface violations

