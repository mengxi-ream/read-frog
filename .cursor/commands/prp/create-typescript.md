# Create TypeScript PRP

## Feature: $ARGUMENTS

## PRP Creation Mission

Create a comprehensive TypeScript PRP that enables **one-pass implementation success** through systematic research and context curation.

**Critical Understanding**: The executing AI agent only receives:

- Start by reading and understanding the prp concepts PRPs/README.md
- The PRP content you create
- Its training data knowledge
- Access to codebase files (but needs guidance on which ones)

**Therefore**: Your research and context curation directly determines implementation success. Incomplete context = implementation failure.

## Research Process

> During the research process, create clear tasks and spawn as many agents and subagents as needed using the batch tools. The deeper research we do here the better the PRP will be. we optminize for chance of success and not for speed.

1. **TypeScript/React Codebase Analysis in depth**
   - Create clear todos and spawn subagents to search the codebase for similar features/patterns Think hard and plan your approach
   - Identify all the necessary TypeScript files to reference in the PRP
   - Note all existing TypeScript/React conventions to follow
   - Check existing component patterns, hook patterns, and API route patterns
   - Analyze TypeScript interface definitions and type usage patterns
   - Check existing test patterns for React components and TypeScript code validation approach
   - Use the batch tools to spawn subagents to search the codebase for similar features/patterns

2. **TypeScript/React External Research at scale**
   - Create clear todos and spawn with instructions subagents to do deep research for similar features/patterns online and include urls to documentation and examples
   - TypeScript documentation (include specific URLs with version compatibility)
   - React/Next.js documentation (include specific URLs for App Router, Server Components, etc.)
   - For critical pieces of documentation add a .md file to PRPs/ai_docs and reference it in the PRP with clear reasoning and instructions
   - Implementation examples (GitHub/StackOverflow/blogs) specific to TypeScript/React/Next.js
   - Best practices and common pitfalls found during research (TypeScript compilation issues, React hydration, Next.js gotchas)
   - Use the batch tools to spawn subagents to search for similar features/patterns online and include urls to documentation and examples

3. **User Clarification**
   - Ask for clarification if you need it

## PRP Generation Process

### Step 1: Choose Template

Use `PRPs/templates/prp_base_typescript.md` as your template structure - it contains all necessary sections and formatting specific to TypeScript/React development.

### Step 2: Context Completeness Validation

Before writing, apply the **"No Prior Knowledge" test** from the template:
_"If someone knew nothing about this TypeScript/React codebase, would they have everything needed to implement this successfully?"_

### Step 3: Research Integration

Transform your research findings into the template sections:

**Goal Section**: Use research to define specific, measurable Feature Goal and concrete Deliverable (component, API route, integration, etc.)
**Context Section**: Populate YAML structure with your research findings - specific TypeScript/React URLs, file patterns, gotchas
**Implementation Tasks**: Create dependency-ordered tasks using information-dense keywords from TypeScript/React codebase analysis
**Validation Gates**: Use TypeScript/React-specific validation commands that you've verified work in this codebase

### Step 4: TypeScript/React Information Density Standards

Ensure every reference is **specific and actionable** for TypeScript development:

- URLs include section anchors, not just domain names (React docs, TypeScript handbook, Next.js docs)
- File references include specific TypeScript patterns to follow (interfaces, component props, hook patterns)
- Task specifications include exact TypeScript naming conventions and placement (PascalCase components, camelCase props, etc.)
- Validation commands are TypeScript/React-specific and executable (tsc, eslint with TypeScript rules, React Testing Library)

### Step 5: ULTRATHINK Before Writing

After research completion, create comprehensive PRP writing plan using TodoWrite tool:

- Plan how to structure each template section with your TypeScript/React research findings
- Identify gaps that need additional TypeScript/React research
- Create systematic approach to filling template with actionable TypeScript context
- Consider TypeScript compilation dependencies and React component hierarchies

## Output

Save as: `PRPs/{feature-name}.md`

## TypeScript PRP Quality Gates

### Context Completeness Check

- [ ] Passes "No Prior Knowledge" test from TypeScript template
- [ ] All YAML references are specific and accessible (TypeScript/React docs, component examples)
- [ ] Implementation tasks include exact TypeScript naming and placement guidance
- [ ] Validation commands are TypeScript/React-specific and verified working
- [ ] TypeScript interface definitions and component prop types are specified

### Template Structure Compliance

- [ ] All required TypeScript template sections completed
- [ ] Goal section has specific Feature Goal, Deliverable, Success Definition
- [ ] Implementation Tasks follow TypeScript dependency ordering (types → components → pages → tests)
- [ ] Final Validation Checklist includes TypeScript/React-specific validation

### TypeScript/React Information Density Standards

- [ ] No generic references - all are specific to TypeScript/React patterns
- [ ] File patterns include specific TypeScript examples to follow (interfaces, components, hooks)
- [ ] URLs include section anchors for exact TypeScript/React guidance
- [ ] Task specifications use information-dense keywords from TypeScript/React codebase
- [ ] Component patterns specify Server vs Client component usage
- [ ] Type definitions are comprehensive and follow existing patterns

## Success Metrics

**Confidence Score**: Rate 1-10 for one-pass TypeScript implementation success likelihood

**Quality Standard**: Minimum 8/10 required before PRP approval

**Validation**: The completed PRP should enable an AI agent unfamiliar with the TypeScript/React codebase to implement the feature successfully using only the PRP content and codebase access, with full type safety and React best practices.

