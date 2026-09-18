# Demo manifest reference

Pass a JSON manifest to `scripts/build_demo.py`. Resolve relative paths from the manifest's directory.

## Example

```json
{
  "title": "Responsive navigation behavior",
  "subtitle": "Desktop, repeated entry, and mobile states",
  "output": "./navigation-behavior-demo.mp4",
  "gif_output": "./navigation-behavior-demo.gif",
  "width": 1280,
  "height": 800,
  "fps": 30,
  "gif_fps": 20,
  "gif_width": 960,
  "intro_seconds": 1.8,
  "background": "#0b0d12",
  "accent": "#8b5cf6",
  "scenes": [
    {
      "id": "01-desktop-entry",
      "label": "Desktop: opening the workspace collapses navigation",
      "frames": "./01-desktop-entry/frames.json",
      "hold_last_seconds": 2.5,
      "crop": { "x": 120, "y": 80, "width": 1040, "height": 680 }
    },
    {
      "id": "02-mobile-entry",
      "label": "Mobile: opening the workspace preserves desktop state",
      "frames": "./02-mobile-entry/frames.json",
      "hold_last_seconds": 0.5
    }
  ]
}
```

## Top-level fields

| Field | Required | Default | Meaning |
| --- | --- | --- | --- |
| `title` | yes | — | Intro title |
| `subtitle` | no | empty | Intro subtitle |
| `output` | yes | — | Final MP4 path |
| `gif_output` | no | — | Optional palette-optimized GIF derived from the final MP4 |
| `scenes` | yes | — | Ordered non-empty scene list |
| `width` | no | `1280` | Output width |
| `height` | no | `800` | Output height |
| `fps` | no | `30` | Output frame rate |
| `gif_fps` | no | `20` | GIF frame rate; smooth enough for UI motion without the size of 30fps |
| `gif_width` | no | `min(width, 960)` | GIF width; height preserves aspect ratio |
| `intro_seconds` | no | `1.8` | Intro duration; set to `0` to omit |
| `background` | no | `#0b0d12` | Letterbox and title background |
| `accent` | no | `#8b5cf6` | Intro accent color |
| `font_path` | no | auto-detected | TrueType/OpenType font path |
| `max_frame_seconds` | no | `0.75` | Maximum hold for a timestamp gap |
| `last_frame_seconds` | no | `2.5` | Default assertion-success presentation hold |

## Scene fields

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable filesystem-safe scene identifier |
| `label` | no | Reviewer-facing scene name, for the manifest and QA notes — it is not drawn into the video |
| `frames` | yes | Path to the scene's `frames.json` |
| `hold_last_seconds` | no | Scene-specific final-frame hold |
| `crop` | no | Measured `{x, y, width, height}` rectangle applied before scaling |

Measure crop values from an extracted full-resolution frame. The crop must fit inside the first source frame for the scene; the builder rejects invalid rectangles. Omit `crop` when surrounding UI helps orient the reviewer.

## Frame metadata

Each `frames.json` must contain a non-empty `frames` array. Every frame requires:

- `file`: image filename, resolved relative to `frames.json`;
- `timestamp`: numeric monotonically increasing capture timestamp.

An optional `sequence` value is preserved for debugging but is not required by the builder.

Every frame in one scene must have identical pixel dimensions. The builder rejects mixed screencast/device-pixel screenshots instead of silently applying the same crop to incompatible coordinates.

## Assembly behavior

The builder:

- clamps extremely short or long timestamp gaps;
- applies an optional measured scene crop;
- scales each cropped or full source frame without additional cropping;
- pads desktop and mobile scenes into the configured output canvas;
- adds an intro;
- encodes each segment with the same H.264 settings;
- concatenates segments into a fast-start MP4.
- optionally derives a GIF from the final MP4 using `palettegen` and `paletteuse`; if a separate PNG palette input triggers an FFmpeg compatibility failure, it retries with an equivalent split filter graph.

The video carries exactly one caption per scene: the pill the recorder injects into the page before the action. The builder does not composite a second one, so there is nothing to keep clear of the subject except that pill.
