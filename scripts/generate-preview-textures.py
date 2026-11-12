#!/usr/bin/env python3
"""The images behind the settings page's feature previews, in src/assets/preview.

watercolor-light and watercolor-dark are the paper the previews sit on, and
video-still is the frame the subtitle preview shows its subtitles over. All
three are drawn from noise (Perlin fbm, domain warping), so they are ours, and
changing a colour is a matter of editing TEXTURES and running this again.

    python3 scripts/generate-preview-textures.py [name ...]

Needs numpy, Pillow and cwebp (libwebp) on the PATH. Output is deterministic,
so an unchanged texture regenerates byte for byte with the same cwebp.
"""

import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageFilter

W, H = 1600, 720
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "preview")


def fade(t):
    return t * t * t * (t * (t * 6 - 15) + 10)


class Perlin:
    def __init__(self, seed):
        rng = np.random.default_rng(seed)
        p = rng.permutation(256)
        self.p = np.concatenate([p, p]).astype(np.int64)
        a = rng.random(256) * 2 * np.pi
        self.gx, self.gy = np.cos(a), np.sin(a)

    def __call__(self, x, y):
        x0, y0 = np.floor(x), np.floor(y)
        xf, yf = x - x0, y - y0
        xi = x0.astype(np.int64) & 255
        yi = y0.astype(np.int64) & 255
        xi1, yi1 = (xi + 1) & 255, (yi + 1) & 255
        p = self.p

        def g(ix, iy, dx, dy):
            h = p[p[ix] + iy]
            return self.gx[h] * dx + self.gy[h] * dy

        n00 = g(xi, yi, xf, yf)
        n10 = g(xi1, yi, xf - 1, yf)
        n01 = g(xi, yi1, xf, yf - 1)
        n11 = g(xi1, yi1, xf - 1, yf - 1)
        u, v = fade(xf), fade(yf)
        a = n00 + u * (n10 - n00)
        b = n01 + u * (n11 - n01)
        return a + v * (b - a)


def fbm(n, x, y, octaves=5, lac=2.0, gain=0.5):
    s = np.zeros_like(x)
    amp, freq, norm = 0.5, 1.0, 0.0
    for i in range(octaves):
        s = s + amp * n(x * freq + i * 17.31, y * freq + i * 9.17)
        norm += amp
        amp *= gain
        freq *= lac
    return s / norm


def grid(w, h, scale):
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float64)
    return xs / h * scale, ys / h * scale


def norm01(a, lo=1, hi=99):
    a0, a1 = np.percentile(a, lo), np.percentile(a, hi)
    return np.clip((a - a0) / (a1 - a0), 0, 1)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def hex3(h):
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.float64) / 255


def oklch(L, C, h):
    """OKLCH -> '#rrggbb', clipped to sRGB."""
    a, b = C * np.cos(np.radians(h)), C * np.sin(np.radians(h))
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_**3, m_**3, s_**3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

    def enc(x):
        x = min(max(x, 0.0), 1.0)
        return 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055

    return "#" + "".join(f"{round(enc(x) * 255):02x}" for x in (r, g, bl))


def blur(rgb, radius):
    img = Image.fromarray(np.clip(rgb * 255, 0, 255).astype(np.uint8))
    img = img.filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(img).astype(np.float64) / 255


def blur1(a, radius):
    img = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8), "L")
    img = img.filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(img).astype(np.float64) / 255


def save(rgb, name, quality=82):
    rng = np.random.default_rng(0)
    img = Image.fromarray(
        np.clip(rgb * 255 + rng.uniform(0, 1, rgb.shape), 0, 255).astype(np.uint8)
    )
    if img.size != (W, H):
        img = img.resize((W, H), Image.LANCZOS)
    png = os.path.join(OUT_DIR, name + ".png")
    webp = os.path.join(OUT_DIR, name + ".webp")
    img.save(png)
    subprocess.run(
        ["cwebp", "-quiet", "-q", str(quality), "-m", "6", "-sharp_yuv", png, "-o", webp],
        check=True,
    )
    os.remove(png)
    print(f"{name}.webp  {os.path.getsize(webp) / 1024:.0f} KB")


def watercolor(seed, paper, washes, fiber=0.035, dark=False, edge=0.09):
    """Washes of pigment on paper. washes: (colour, scale, cover, opacity, dx, dy) each."""
    n = Perlin(seed)
    X, Y = grid(W, H, 1.0)
    rng = np.random.default_rng(seed + 1)

    # Paper: a slow tonal drift plus fibre at two scales.
    base = np.ones((H, W, 3)) * hex3(paper)
    drift = fbm(n, X * 1.3 + 40, Y * 1.3 + 40, 3)
    f1 = fbm(n, X * 60 + 3.1, Y * 60 + 7.7, 3)
    f2 = rng.normal(0, 1, (H, W))
    f2 = blur1(np.clip(0.5 + f2 * 0.18, 0, 1), 0.6) - 0.5
    tex = 1 + drift * 0.05 + f1 * fiber + f2 * fiber * 0.7
    col = base * tex[..., None]

    for i, (wcol, scale, cover, opacity, ox, oy) in enumerate(washes):
        wx = fbm(n, X * 1.7 + ox + 11, Y * 1.7 + oy + 3, 3)
        wy = fbm(n, X * 1.7 + ox + 21, Y * 1.7 + oy + 13, 3)
        m = fbm(n, (X + wx * 0.35) * scale + ox, (Y + wy * 0.35) * scale + oy, 6)
        cov = smoothstep(cover, cover + edge, m)
        # Pigment collects at a wash's edge as it dries: the darker rim.
        inner = np.clip(cov - blur1(cov, 7), 0, 1)
        rim = np.clip(inner * 3.2, 0, 1) ** 1.2
        # Granulation: pigment settles in the paper's tooth.
        gran = 0.8 + 0.4 * norm01(fbm(n, X * 140 + i, Y * 140 - i, 2))
        dens = np.clip((cov * 0.6 + rim * 0.55) * gran * opacity, 0, 1)
        c = hex3(wcol)
        if dark:
            col = col + (c - col) * dens[..., None]
        else:
            col = col * (1 - dens[..., None] * (1 - c))
    return col


def landscape(seed, sky_top, sky_low, glow, ridges, soft=6):
    """A defocused dusk: sky with faint cloud, a glow on the horizon, then hills front to back.

    ridges: (height, amplitude, frequency, colour) each, far to near. The lower half stays dark,
    as a real frame usually is, so white subtitles read with no background behind them. No bokeh
    discs: subtitles sit on this, and dots read as noise behind text.
    """
    w, h = W // 2, H // 2
    n = Perlin(seed)
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float64)
    u, v = xs / w, ys / h
    col = hex3(sky_top) * (1 - v[..., None]) + hex3(sky_low) * v[..., None]
    cloud = norm01(fbm(n, u * 3.0 + 5.0, v * 9.0 + 2.0, 4))
    col = col * (0.94 + 0.12 * cloud)[..., None]
    glow_w = np.exp(-(((u - 0.62) / 0.55) ** 2 + ((v - 0.52) / 0.22) ** 2))
    col = col + (hex3(glow) - col) * (0.6 * glow_w)[..., None]
    x = np.linspace(0, 1, w)
    for i, (base, amp, freq, c) in enumerate(ridges):
        line = base + amp * fbm(n, x * freq + i * 7.3, np.full_like(x, i * 3.1 + 0.5), 4)
        m = blur1((v >= line[None, :]).astype(np.float64), 1.5)
        col = col + (hex3(c) - col) * m[..., None]
    return blur(col, soft)


def green(L, C):
    """The video frame's single green: only lightness and chroma move."""
    return oklch(L, C, 142)


TEXTURES = {
    "watercolor-light": lambda: watercolor(
        7,
        "#f6f7ee",
        [
            ("#dfe9c0", 0.8, -0.08, 0.8, 0.0, 0.0),
            ("#d2e2b6", 1.15, 0.0, 0.7, 3.3, 1.7),
            ("#eaedc6", 1.7, 0.03, 0.5, 7.1, 4.2),
        ],
        edge=0.12,
    ),
    # Paper and pigment both lifted well off black, or the washes vanish into a flat dark field;
    # softer edges than the light one, since dark pigment with hard rims reads as camouflage.
    "watercolor-dark": lambda: watercolor(
        7,
        "#182013",
        [
            ("#2b3c21", 0.8, -0.08, 0.85, 0.0, 0.0),
            ("#33472a", 1.15, 0.0, 0.75, 3.3, 1.7),
            ("#3d5231", 1.7, 0.03, 0.55, 7.1, 4.2),
        ],
        fiber=0.06,
        dark=True,
        edge=0.18,
    ),
    "video-still": lambda: landscape(
        4,
        green(0.36, 0.04),
        green(0.30, 0.05),
        green(0.62, 0.07),
        [
            (0.50, 0.10, 2.2, green(0.24, 0.045)),
            (0.60, 0.12, 1.6, green(0.18, 0.04)),
            (0.74, 0.10, 1.2, green(0.12, 0.03)),
        ],
    ),
}


def main():
    names = sys.argv[1:] or list(TEXTURES)
    unknown = [name for name in names if name not in TEXTURES]
    if unknown:
        sys.exit(f"unknown texture: {', '.join(unknown)} (one of {', '.join(TEXTURES)})")
    os.makedirs(OUT_DIR, exist_ok=True)
    for name in names:
        save(TEXTURES[name](), name)


if __name__ == "__main__":
    main()
