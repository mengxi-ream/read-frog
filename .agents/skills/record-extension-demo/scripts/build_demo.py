#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:  # pragma: no cover - environment-specific guidance
    raise SystemExit(
        "Pillow is required. Use the host's workspace Python runtime or install Pillow "
        "outside the user's project."
    ) from exc


DEFAULT_WIDTH = 1280
DEFAULT_HEIGHT = 800
DEFAULT_FPS = 30
DEFAULT_GIF_FPS = 20
DEFAULT_LAST_FRAME_SECONDS = 2.5
DEFAULT_BACKGROUND = "#0b0d12"
DEFAULT_ACCENT = "#8b5cf6"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build an annotated MP4 from timestamped browser screencast frames."
    )
    parser.add_argument("manifest", type=Path, help="Path to the demo manifest JSON")
    parser.add_argument(
        "--work-dir",
        type=Path,
        help="Keep intermediate files in this directory instead of a temporary directory",
    )
    return parser.parse_args()


def run(args: list[str]) -> None:
    subprocess.run(args, check=True)


def require_command(name: str) -> None:
    if shutil.which(name) is None:
        raise SystemExit(f"Required command is not available on PATH: {name}")


def resolve_path(base: Path, value: str | Path) -> Path:
    path = Path(value).expanduser()
    return path if path.is_absolute() else (base / path).resolve()


def escape_concat_path(path: Path) -> str:
    return str(path).replace("'", "'\\''")


def ffmpeg_color(value: str) -> str:
    return f"0x{value[1:]}" if value.startswith("#") else value


def find_font(explicit: str | None) -> Path | None:
    candidates = [
        explicit,
        "/Library/Fonts/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).expanduser().is_file():
            return Path(candidate).expanduser()
    return None


def load_font(font_path: Path | None, size: int) -> ImageFont.ImageFont:
    if font_path:
        return ImageFont.truetype(str(font_path), size=size)
    return ImageFont.load_default()


def make_intro(
    path: Path,
    *,
    title: str,
    subtitle: str,
    width: int,
    height: int,
    background: str,
    accent: str,
    font_path: Path | None,
) -> None:
    image = Image.new("RGB", (width, height), background)
    draw = ImageDraw.Draw(image)
    title_font = load_font(font_path, max(32, round(height * 0.064)))
    subtitle_font = load_font(font_path, max(20, round(height * 0.031)))
    accent_width = min(round(width * 0.27), 420)
    accent_y = round(height * 0.28)
    draw.rounded_rectangle(
        (
            (width - accent_width) // 2,
            accent_y,
            (width + accent_width) // 2,
            accent_y + 10,
        ),
        radius=5,
        fill=accent,
    )
    title_box = draw.textbbox((0, 0), title, font=title_font)
    title_x = (width - (title_box[2] - title_box[0])) / 2
    draw.text((title_x, round(height * 0.37)), title, font=title_font, fill="#f8fafc")
    if subtitle:
        subtitle_box = draw.textbbox((0, 0), subtitle, font=subtitle_font)
        subtitle_x = (width - (subtitle_box[2] - subtitle_box[0])) / 2
        draw.text(
            (subtitle_x, round(height * 0.49)),
            subtitle,
            font=subtitle_font,
            fill="#aeb7c6",
        )
    image.save(path)


def load_frames(frames_path: Path) -> list[dict[str, Any]]:
    metadata = json.loads(frames_path.read_text())
    frames = metadata.get("frames")
    if not isinstance(frames, list) or not frames:
        raise ValueError(f"No frames found in {frames_path}")
    expected_size: tuple[int, int] | None = None
    for index, frame in enumerate(frames):
        if not isinstance(frame, dict) or "file" not in frame or "timestamp" not in frame:
            raise ValueError(f"Invalid frame at index {index} in {frames_path}")
        frame["timestamp"] = float(frame["timestamp"])
        image_path = resolve_path(frames_path.parent, frame["file"])
        if not image_path.is_file():
            raise FileNotFoundError(image_path)
        frame["resolved_file"] = image_path
        with Image.open(image_path) as image:
            size = image.size
        if expected_size is None:
            expected_size = size
        elif size != expected_size:
            raise ValueError(
                f"Frame size mismatch in {frames_path}: expected "
                f"{expected_size[0]}x{expected_size[1]}, found "
                f"{size[0]}x{size[1]} at index {index}"
            )
    return frames


def scene_crop_filter(scene: dict[str, Any], first_frame: Path) -> str:
    crop = scene.get("crop")
    if crop is None:
        return ""
    if not isinstance(crop, dict) or not all(
        key in crop for key in ("x", "y", "width", "height")
    ):
        raise ValueError("Scene crop requires x, y, width, and height")
    x = int(crop["x"])
    y = int(crop["y"])
    width = int(crop["width"])
    height = int(crop["height"])
    if min(x, y) < 0 or min(width, height) <= 0:
        raise ValueError("Scene crop coordinates and dimensions are invalid")
    with Image.open(first_frame) as image:
        source_width, source_height = image.size
    if x + width > source_width or y + height > source_height:
        raise ValueError(
            f"Scene crop {width}x{height}+{x}+{y} exceeds source frame "
            f"{source_width}x{source_height}"
        )
    return f"crop={width}:{height}:{x}:{y},"


def build_gif(
    source: Path,
    output: Path,
    *,
    build_dir: Path,
    fps: int,
    width: int,
) -> None:
    if fps <= 0 or width <= 0:
        raise ValueError("gif_fps and gif_width must be positive")
    output.parent.mkdir(parents=True, exist_ok=True)
    palette = build_dir / "gif-palette.png"
    filters = f"fps={fps},scale={width}:-2:flags=lanczos"
    run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(source),
            "-vf",
            f"{filters},palettegen=stats_mode=diff",
            str(palette),
        ]
    )
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(source),
                "-i",
                str(palette),
                "-filter_complex",
                f"[0:v]{filters}[frames];[frames][1:v]paletteuse=dither=sierra2_4a:diff_mode=rectangle",
                "-loop",
                "0",
                str(output),
            ],
            check=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError:
        # FFmpeg 8.1 on macOS can fail internally when the generated PNG
        # palette is re-opened as a second input for a longer video. Preserve
        # the same palettegen/paletteuse algorithm in one split filter graph.
        run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(source),
                "-filter_complex",
                (
                    f"[0:v]{filters},split[palette_source][frames];"
                    "[palette_source]palettegen=stats_mode=diff[palette];"
                    "[frames][palette]paletteuse=dither=sierra2_4a"
                ),
                "-loop",
                "0",
                str(output),
            ]
        )


def build_scene(
    scene: dict[str, Any],
    *,
    manifest_dir: Path,
    build_dir: Path,
    width: int,
    height: int,
    fps: int,
    background: str,
    max_frame_seconds: float,
    last_frame_seconds: float,
) -> Path:
    scene_id = str(scene["id"])
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", scene_id):
        raise ValueError(
            f"Scene id must be filesystem-safe (letters, digits, dot, underscore, hyphen): {scene_id}"
        )
    frames_path = resolve_path(manifest_dir, scene["frames"])
    frames = load_frames(frames_path)
    crop_filter = scene_crop_filter(scene, frames[0]["resolved_file"])
    min_frame_seconds = 1 / max(fps * 4, 1)
    hold_last = float(scene.get("hold_last_seconds", last_frame_seconds))

    concat_lines = ["ffconcat version 1.0"]
    total_duration = 0.0
    for index, frame in enumerate(frames):
        if index + 1 < len(frames):
            duration = frames[index + 1]["timestamp"] - frame["timestamp"]
            duration = min(max(duration, min_frame_seconds), max_frame_seconds)
        else:
            duration = max(hold_last, min_frame_seconds)
        total_duration += duration
        concat_lines.append(f"file '{escape_concat_path(frame['resolved_file'])}'")
        concat_lines.append(f"duration {duration:.6f}")
    concat_lines.append(f"file '{escape_concat_path(frames[-1]['resolved_file'])}'")

    frames_concat = build_dir / f"{scene_id}-frames.ffconcat"
    frames_concat.write_text("\n".join(concat_lines) + "\n")
    output = build_dir / f"{scene_id}.mp4"
    run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(frames_concat),
            "-filter_complex",
            (
                f"[0:v]{crop_filter}fps={fps},scale={width}:{height}:force_original_aspect_ratio=decrease,"
                f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color={ffmpeg_color(background)},"
                "format=yuv420p[v]"
            ),
            "-map",
            "[v]",
            "-t",
            f"{total_duration:.6f}",
            "-r",
            str(fps),
            "-c:v",
            "libx264",
            "-crf",
            "20",
            "-preset",
            "medium",
            "-movflags",
            "+faststart",
            str(output),
        ]
    )
    return output


def build(manifest_path: Path, work_dir: Path | None) -> dict[str, Any]:
    require_command("ffmpeg")
    manifest_path = manifest_path.expanduser().resolve()
    manifest = json.loads(manifest_path.read_text())
    manifest_dir = manifest_path.parent
    title = str(manifest["title"])
    output = resolve_path(manifest_dir, manifest["output"])
    scenes = manifest.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        raise ValueError("Manifest must contain a non-empty scenes array")

    width = int(manifest.get("width", DEFAULT_WIDTH))
    height = int(manifest.get("height", DEFAULT_HEIGHT))
    fps = int(manifest.get("fps", DEFAULT_FPS))
    if width <= 0 or height <= 0 or fps <= 0:
        raise ValueError("width, height, and fps must be positive")
    background = str(manifest.get("background", DEFAULT_BACKGROUND))
    accent = str(manifest.get("accent", DEFAULT_ACCENT))
    intro_seconds = float(manifest.get("intro_seconds", 1.8))
    max_frame_seconds = float(manifest.get("max_frame_seconds", 0.75))
    last_frame_seconds = float(
        manifest.get("last_frame_seconds", DEFAULT_LAST_FRAME_SECONDS)
    )
    explicit_font = manifest.get("font_path")
    resolved_font = (
        str(resolve_path(manifest_dir, explicit_font)) if explicit_font else None
    )
    font_path = find_font(resolved_font)
    output.parent.mkdir(parents=True, exist_ok=True)

    temp_context: tempfile.TemporaryDirectory[str] | None = None
    if work_dir:
        active_build_dir = work_dir.expanduser().resolve()
        active_build_dir.mkdir(parents=True, exist_ok=True)
    else:
        temp_context = tempfile.TemporaryDirectory(prefix="web-app-demo-")
        active_build_dir = Path(temp_context.name)

    gif_output_value = manifest.get("gif_output")
    try:
        segments: list[Path] = []
        if intro_seconds > 0:
            intro_png = active_build_dir / "00-intro.png"
            intro_mp4 = active_build_dir / "00-intro.mp4"
            make_intro(
                intro_png,
                title=title,
                subtitle=str(manifest.get("subtitle", "")),
                width=width,
                height=height,
                background=background,
                accent=accent,
                font_path=font_path,
            )
            run(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-loop",
                    "1",
                    "-framerate",
                    str(fps),
                    "-i",
                    str(intro_png),
                    "-t",
                    f"{intro_seconds:.6f}",
                    "-r",
                    str(fps),
                    "-c:v",
                    "libx264",
                    "-crf",
                    "20",
                    "-preset",
                    "medium",
                    "-pix_fmt",
                    "yuv420p",
                    "-movflags",
                    "+faststart",
                    str(intro_mp4),
                ]
            )
            segments.append(intro_mp4)

        for scene in scenes:
            if not all(key in scene for key in ("id", "frames")):
                raise ValueError("Every scene requires id and frames")
            segments.append(
                build_scene(
                    scene,
                    manifest_dir=manifest_dir,
                    build_dir=active_build_dir,
                    width=width,
                    height=height,
                    fps=fps,
                    background=background,
                    max_frame_seconds=max_frame_seconds,
                    last_frame_seconds=last_frame_seconds,
                )
            )

        final_concat = active_build_dir / "final.ffconcat"
        final_concat.write_text(
            "ffconcat version 1.0\n"
            + "".join(f"file '{escape_concat_path(segment)}'\n" for segment in segments)
        )
        run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(final_concat),
                "-c",
                "copy",
                "-movflags",
                "+faststart",
                str(output),
            ]
        )
        if gif_output_value:
            gif_output = resolve_path(manifest_dir, gif_output_value)
            if gif_output.suffix.lower() != ".gif":
                raise ValueError("gif_output must use a .gif extension")
            build_gif(
                output,
                gif_output,
                build_dir=active_build_dir,
                fps=int(manifest.get("gif_fps", DEFAULT_GIF_FPS)),
                width=int(manifest.get("gif_width", min(width, 960))),
            )
    finally:
        if temp_context:
            temp_context.cleanup()

    result = {
        "output": str(output),
        "scenes": len(scenes),
        "width": width,
        "height": height,
        "fps": fps,
    }
    if gif_output_value:
        result["gif_output"] = str(resolve_path(manifest_dir, gif_output_value))
    return result


def main() -> None:
    args = parse_args()
    result = build(args.manifest, args.work_dir)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
