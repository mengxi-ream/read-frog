# Write Blog Post

Write a user-oriented blog post about: $ARGUMENTS.

This command creates blog content for the Read Frog website to inform users about new features, updates, or improvements.

Follow these steps:

1. **Understand the context**:
   - If PR numbers are provided (e.g., "PR 548", "#548"), fetch details using `gh pr view <number> --json title,body,number,mergedAt`
   - If feature names or descriptions are provided, search the codebase for relevant implementation details
   - If code context is provided, analyze the changes and their user impact

2. **Research the changes**:
   - Read relevant code files to understand what changed
   - Focus on user-facing features and benefits, not technical implementation
   - Identify the problem being solved and the value provided to users

3. **Create blog filename**:
   - Use kebab-case format: `feature-name.mdx` and `feature-name.zh.mdx`
   - Examples: `batch-translation.mdx`, `new-ai-provider.mdx`
   - Place in `apps/website/content/blog/` directory

4. **Write the blog post** in both English and Chinese:
   - **Frontmatter** (required):
     - title: Clear, engaging title (e.g., "Introducing Batch Translation")
     - description: Brief summary (1-2 sentences)
     - author: use `git config user.name` as author, if not found, use "Read Frog Team"
     - date: Use today's date in YYYY-MM-DD format

   - **Content structure** (user-focused):
     - **Opening**: Start with a compelling hook - a problem statement or exciting announcement
     - **Visual Hero**: Add image placeholder for feature screenshot/hero image: `{/* TODO: Add hero image for [feature name] */}`
     - **What's New**: Describe the feature using comparison tables, callouts, or cards
     - **Key Benefits**: Use Fumadocs components:
       - `<Callout type="info">` for important highlights
       - Comparison tables (Before/After) to show improvements
       - Feature cards or tabs for multiple aspects
     - **How It Works**: Step-by-step with visual aids
       - Add image placeholders: `{/* TODO: Add screenshot of step [X]: [description] */}`
       - Use numbered lists with clear instructions
       - Include tips using `<Callout type="tip">`
     - **Use Cases**: Real scenarios with concrete examples
     - **Performance/Stats**: Use tables or comparison blocks to show metrics
     - **What's Next**: Tease future improvements

   - **Tone and style**:
     - **Rhythm**: Mix short punchy sentences with longer explanatory ones
     - **Visual breaks**: Use horizontal rules `---`, callouts, and tables to break up text
     - **Emphasis**: Use **bold** for key benefits, *italic* for emphasis
     - **User-friendly**: No technical jargon, focus on benefits
     - **Engaging**: Use emojis moderately, rhetorical questions, relatable scenarios
     - **Scannable**: Headers, bullet points, tables for easy scanning

   - **Fumadocs Components to Use**:
     - `<Callout type="info">Important information</Callout>`
     - `<Callout type="warn">Warnings or caveats</Callout>`
     - `<Callout type="tip">Pro tips</Callout>`
     - Tables for comparisons (Before/After, Feature comparison)
     - `<Steps>` for sequential instructions (if available)
     - Image placeholders with descriptive TODO comments

5. **Bilingual content**:
   - Write both `.mdx` (English) and `.zh.mdx` (Chinese) versions
   - Ensure both versions convey the same information
   - Use "陪读蛙" for the Chinese name
   - Adapt cultural context if needed for Chinese audience

6. **Visual Elements**:
   - Add image placeholders with clear descriptions for:
     - Hero/banner image at the top
     - Feature screenshots for key steps
     - Before/after comparisons
     - UI examples
   - Format: `{/* TODO: Add image - [clear description of what image should show] */}`
   - **Important**: Use MDX comments `{/* */}` not HTML comments `<!-- -->`
   - Place placeholders strategically to break up long text sections

7. **Quality check**:
   - Verify all frontmatter fields are present
   - Check that content is user-oriented (not developer-oriented)
   - Ensure proper markdown formatting with visual variety
   - Confirm Fumadocs components are used correctly
   - Include at least 2-3 image placeholders in strategic locations
   - Mix content types: text, tables, callouts, lists
   - Test that links work (if any)

8. **Output**:
   - Create both language versions
   - Provide a summary of the blog post
   - List all image placeholders for the user to fill
   - Suggest social media snippets if relevant

**Examples of user-oriented vs developer-oriented**:
- ❌ Developer: "Implemented BatchQueue with configurable flush thresholds"
- ✅ User: "Translations are now faster! Multiple paragraphs are translated together in one go"

- ❌ Developer: "Added tRPC endpoint for user preferences"
- ✅ User: "Your settings now sync across devices automatically"

**Examples of good visual structure**:
```markdown
## Feature Name 🚀

Quick hook paragraph.

{/* TODO: Add hero image - Dashboard showing the new feature */}

### The Problem

Short description of pain point.

<Callout type="info">
**Key Insight**: Important statistic or fact
</Callout>

### The Solution

| Before | After |
|--------|-------|
| Manual process | Automated |
| 10 minutes | 30 seconds |

{/* TODO: Add screenshot - Before/after comparison */}

### How to Use

1. Step one with clear action
2. Step two...

<Callout type="tip">
Pro tip: Helpful advice here
</Callout>
```

**Remember**:
- The blog is for users, not developers
- Focus on the "why" and "what", not the "how"
- **Create visual rhythm**: Don't let text run more than 2-3 paragraphs without a visual break
- Use tables, callouts, and image placeholders strategically
- Make it scannable and delightful to read

