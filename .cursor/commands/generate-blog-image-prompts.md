# Blog Image Prompt Generator

Generate AI image prompts from blog post image placeholders automatically: $ARGUMENTS.

## Usage

When you see image placeholders in blog posts like:
```mdx
{/* TODO: Add image - [description] */}
```

Use this template to generate image prompts:

---

## Universal Prompt Template

```
Create a [IMAGE_TYPE] for Read Frog blog post showing [DESCRIPTION].

Visual Elements:
- [KEY_ELEMENT_1]
- [KEY_ELEMENT_2]
- [KEY_ELEMENT_3]

Style: Modern SaaS design, clean UI, professional color palette (blue #3B82F6, green #10B981, white background), flat design with subtle shadows, rounded corners.

Include: Read Frog frog mascot (small, subtle) in corner if appropriate.

Format: [DIMENSIONS], web-optimized PNG
```

---

## Image Type Categories

### 1. Hero/Banner Images
**When placeholder says**: "hero image", "banner", "main visual"

**Prompt Template**:
```
Create a hero banner image for Read Frog blog showing [FEATURE_NAME].

Visual Elements:
- Split comparison or main feature visualization
- Key benefit highlighted (e.g., "60-80% savings")
- Clean, eye-catching design that draws attention

Style: Modern SaaS hero section, professional gradient background, balanced composition, white space.
Dimensions: 1200x600px (2:1 ratio)
```

### 2. Screenshot/UI Mockups
**When placeholder says**: "screenshot", "settings", "UI", "interface"

**Prompt Template**:
```
Create a UI mockup screenshot showing [FEATURE/SCREEN_NAME] in Read Frog extension.

Visual Elements:
- Browser extension interface or settings panel
- Relevant toggles, buttons, or controls
- Clear labels and hierarchy
- Active/inactive states as described

Style: Clean modern UI design, light theme, rounded corners, subtle drop shadows, professional SaaS interface.
Dimensions: 1000x700px
```

### 3. Diagrams/Technical Visualizations
**When placeholder says**: "diagram", "flow", "comparison", "process", "how it works"

**Prompt Template**:
```
Create a technical diagram illustrating [CONCEPT/PROCESS].

Visual Elements:
- Clear before/after comparison OR step-by-step flow
- Icons/symbols representing key concepts
- Arrows showing relationships or flow
- Labels for clarity

Style: Clean infographic design, flat icons, clear visual hierarchy, educational and easy to understand.
Dimensions: 1000x800px
```

### 4. Dashboard/Metrics
**When placeholder says**: "dashboard", "metrics", "analytics", "stats", "data"

**Prompt Template**:
```
Create a metrics dashboard showing [METRICS_DESCRIPTION].

Visual Elements:
- Charts/graphs (line, bar, pie as appropriate)
- Statistics cards with key numbers
- Positive indicators (green) for improvements
- Clean data visualization

Style: Modern analytics dashboard, professional data viz, blue/green color scheme, white background, card-based layout.
Dimensions: 1200x700px
```

### 5. Feature Highlights
**When placeholder says**: "feature", "benefit", "capability", "example"

**Prompt Template**:
```
Create a feature highlight image showing [FEATURE_NAME] in action.

Visual Elements:
- Feature in use (real-world context)
- Clear demonstration of benefit
- Visual before/after if applicable
- User-friendly presentation

Style: Clean product shot, modern interface design, engaging and approachable, professional quality.
Dimensions: 1000x600px
```

---

## Quick Extraction Script

**Input**: Blog post MDX file with placeholders

**Process**:
1. Find all `{/* TODO: Add image - [description] */}` comments
2. Extract the description
3. Determine image type from description keywords
4. Generate appropriate prompt using template above
5. Output numbered list of prompts

**Example**:

Input placeholder:
```mdx
{/* TODO: Add hero image - Batch translation dashboard showing cost savings comparison */}
```

Output prompt:
```
1. HERO IMAGE - Batch Translation Cost Savings

Create a hero banner image for Read Frog blog showing batch translation cost savings comparison.

Visual Elements:
- Split dashboard view comparing costs before/after
- Left: High API costs ($50/month) with many request icons
- Right: Low costs ($10/month) with few batched request icons
- Center: "60-80% SAVINGS" prominent badge

Style: Modern SaaS hero section, blue and green color palette, professional gradient background, balanced composition.
Dimensions: 1200x600px (2:1 ratio)
```

---

## Style Consistency Guide

### Color Palette (Always use these)
```
Primary Blue: #3B82F6
Success Green: #10B981
Warning/Alert: #EF4444
Background: #FFFFFF
Text Dark: #1F2937
Text Light: #6B7280
```

### Typography
- Headings: Bold, 24-32px
- Body: Regular, 16-18px
- Captions: Regular, 12-14px
- Font families: Inter, SF Pro, or system fonts

### Design Elements
- Border radius: 8-12px
- Shadows: Subtle, 0-2px offset
- Spacing: Generous white space
- Icons: Outline or flat style
- Images: Flat design, no gradients unless specified

### Read Frog Branding
- Include small frog mascot icon when appropriate
- Use blue as primary brand color
- Keep design clean and professional
- Approachable but not childish

---

## AI Tool Specific Prompts

### For Midjourney (add these flags):
```
--ar [ratio] --v 6 --style raw --s 50
```

Example:
```
modern SaaS dashboard UI, API cost comparison, before after sections, blue green colors, professional --ar 2:1 --v 6 --style raw
```

### For DALL-E 3 (use natural language):
```
A clean, modern [description]. Professional SaaS design with blue and green colors, flat style, white background.
```

### For Stable Diffusion (use keywords):
```
[subject], modern UI design, SaaS dashboard, professional, flat design, blue green white colors, clean typography, rounded corners, subtle shadows, high quality, detailed
```

---

## Automation Command (Future Enhancement)

```bash
# Extract placeholders and generate prompts
grep -r "{/\* TODO: Add image" apps/website/content/blog/*.mdx | \
  sed 's/{\/\* TODO: Add image - \(.*\) \*\}/\1/' | \
  # Process each line and generate prompt
```

---

## Output Format

When generating prompts for a blog post, output in this format:

```markdown
# Image Prompts for [BLOG_POST_TITLE]

## Image 1: [Type] - [Brief Description]
**Location**: [Where in blog]
**Prompt**:
[Full prompt here]

## Image 2: [Type] - [Brief Description]
**Location**: [Where in blog]
**Prompt**:
[Full prompt here]

...
```

---

## Tips for Best Results

1. **Be Specific**: Include exact text, numbers, colors mentioned in placeholder
2. **Context Matters**: Read surrounding blog content to understand what image should convey
3. **Consistency**: Use same style/colors across all images in one blog post
4. **Web Optimization**: Always specify web-friendly dimensions and formats
5. **Brand Alignment**: Include Read Frog frog mascot subtly in corner when appropriate
6. **Accessibility**: Ensure text in images has good contrast and is readable

---

## Example Workflow

1. Read blog post and identify all `{/* TODO: Add image */}` placeholders
2. Extract descriptions and categorize by type
3. Generate prompts using appropriate template
4. Customize with specific details from blog context
5. Output organized list of prompts
6. Generate images using AI tool of choice
7. Replace placeholders with actual image paths

