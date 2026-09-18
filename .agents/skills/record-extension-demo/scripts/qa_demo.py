#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
from pathlib import Path
from typing import Any

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:  # pragma: no cover - environment-specific guidance
    raise SystemExit(
        "Pillow is required. Use the host's workspace Python runtime or install Pillow "
        "outside the user's project."
    ) from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Probe a demo video or GIF and generate evenly sampled QA frames."
    )
    parser.add_argument("video", type=Path)
    parser.add_argument("--samples", type=int, default=8)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--expected-width", type=int)
    parser.add_argument("--expected-height", type=int)
    parser.add_argument("--min-duration", type=float, default=0.5)
    return parser.parse_args()


def require_command(name: str) -> None:
    if shutil.which(name) is None:
        raise SystemExit(f"Required command is not available on PATH: {name}")


def probe(video: Path) -> dict[str, Any]:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration,size:stream=codec_type,codec_name,width,height,avg_frame_rate,pix_fmt",
            "-of",
            "json",
            str(video),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    metadata = json.loads(result.stdout)
    video_streams = [
        stream for stream in metadata.get("streams", []) if stream.get("codec_type") == "video"
    ]
    if not video_streams:
        raise ValueError("No video stream found")
    stream = video_streams[0]
    return {
        "codec": stream.get("codec_name"),
        "width": int(stream.get("width", 0)),
        "height": int(stream.get("height", 0)),
        "pixel_format": stream.get("pix_fmt"),
        "frame_rate": stream.get("avg_frame_rate"),
        "duration": float(metadata["format"]["duration"]),
        "size": int(metadata["format"].get("size", 0)),
    }


def sample_times(duration: float, count: int) -> list[float]:
    if count <= 0:
        raise ValueError("samples must be positive")
    start = 0.0
    end_margin = max(0.1, min(0.5, duration * 0.05))
    end = max(start, duration - end_margin)
    if count == 1 or end <= start:
        return [0.0]
    return [start + (end - start) * index / (count - 1) for index in range(count)]


def extract_frame(video: Path, timestamp: float, output: Path) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(video),
            "-ss",
            f"{timestamp:.3f}",
            "-frames:v",
            "1",
            str(output),
        ],
        check=True,
    )


def make_contact_sheet(frames: list[tuple[Path, float]], output: Path) -> None:
    columns = 3
    tile_width = 480
    tile_height = 320
    caption_height = 28
    rows = math.ceil(len(frames) / columns)
    sheet = Image.new("RGB", (columns * tile_width, rows * tile_height), "#0b0d12")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, (frame_path, timestamp) in enumerate(frames):
        row, column = divmod(index, columns)
        tile = Image.new("RGB", (tile_width, tile_height - caption_height), "#0b0d12")
        with Image.open(frame_path) as frame:
            frame = frame.convert("RGB")
            frame.thumbnail((tile_width, tile_height - caption_height))
            x = (tile.width - frame.width) // 2
            y = (tile.height - frame.height) // 2
            tile.paste(frame, (x, y))
        sheet.paste(tile, (column * tile_width, row * tile_height))
        draw.text(
            (column * tile_width + 10, row * tile_height + tile_height - 22),
            f"{timestamp:.2f}s",
            fill="#f8fafc",
            font=font,
        )
    sheet.save(output)


def main() -> None:
    args = parse_args()
    require_command("ffmpeg")
    require_command("ffprobe")
    video = args.video.expanduser().resolve()
    if not video.is_file():
        raise FileNotFoundError(video)
    metadata = probe(video)
    if metadata["duration"] < args.min_duration:
        raise ValueError(
            f"Video duration {metadata['duration']:.3f}s is shorter than {args.min_duration:.3f}s"
        )
    if args.expected_width and metadata["width"] != args.expected_width:
        raise ValueError(
            f"Expected width {args.expected_width}, found {metadata['width']}"
        )
    if args.expected_height and metadata["height"] != args.expected_height:
        raise ValueError(
            f"Expected height {args.expected_height}, found {metadata['height']}"
        )

    output_dir = (
        args.output_dir.expanduser().resolve()
        if args.output_dir
        else video.parent / f"{video.stem}-{video.suffix.lstrip('.')}-qa"
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    samples: list[tuple[Path, float]] = []
    for index, timestamp in enumerate(sample_times(metadata["duration"], args.samples), start=1):
        frame_path = output_dir / f"sample-{index:02d}-{timestamp:.2f}s.png"
        extract_frame(video, timestamp, frame_path)
        samples.append((frame_path, timestamp))

    contact_sheet = output_dir / "contact-sheet.png"
    make_contact_sheet(samples, contact_sheet)
    result = {
        **metadata,
        "video": str(video),
        "contact_sheet": str(contact_sheet),
        "sample_frames": [str(path) for path, _ in samples],
    }
    (output_dir / "qa.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
