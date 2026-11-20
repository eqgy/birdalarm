"""Draw the Dawn Chorus app icon: a songbird singing on a branch in front of a rising sun.

Writes app/assets/images/icon.png (1024, no transparency, as Apple requires), splash-icon.png,
favicon.png and the Android adaptive icon layers. Drawn at 4x and scaled down for smooth edges.
Usage: python pipeline/make_icon.py
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "app/assets/images"
S = 4096  # working size

NIGHT = (11, 16, 38)
DUSK = (48, 40, 92)
EMBER = (201, 120, 94)
GOLD = (250, 200, 140)
CREAM = (255, 241, 214)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def sky(size: int) -> Image.Image:
    """Night at the top, warming to ember at the horizon."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        if t < 0.55:
            c = lerp(NIGHT, DUSK, t / 0.55)
        else:
            c = lerp(DUSK, EMBER, (t - 0.55) / 0.45)
        for x in range(size):
            px[x, y] = c
    return img


def bezier(p0, p1, p2, p3, n=40):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        pts.append((u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                    u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]))
    return pts


def bird(d: ImageDraw.ImageDraw, ox: float, oy: float, k: float, color) -> None:
    """A plump songbird facing left with its head raised and beak open, in units of k."""
    P = lambda x, y: (ox + x * k, oy + y * k)
    outline = []
    # Beak tip (upper) -> crown -> back -> tail tip -> under tail -> belly -> throat -> lower beak
    outline += bezier(P(-1.55, -1.30), P(-1.20, -1.45), P(-0.95, -1.55), P(-0.70, -1.62))   # upper beak
    outline += bezier(P(-0.70, -1.62), P(-0.45, -2.05), P(0.20, -2.05), P(0.40, -1.55))     # crown
    outline += bezier(P(0.40, -1.55), P(0.75, -1.05), P(1.20, -0.75), P(1.55, -0.30))       # back
    outline += bezier(P(1.55, -0.30), P(1.95, 0.05), P(2.45, 0.35), P(2.95, 0.55))          # upper tail
    outline += bezier(P(2.95, 0.55), P(2.85, 0.75), P(2.70, 0.85), P(2.55, 0.85))           # tail tip
    outline += bezier(P(2.55, 0.85), P(2.05, 0.70), P(1.60, 0.62), P(1.25, 0.65))           # under tail
    outline += bezier(P(1.25, 0.65), P(0.70, 1.15), P(-0.40, 1.10), P(-0.75, 0.30))         # belly
    outline += bezier(P(-0.75, 0.30), P(-0.95, -0.20), P(-0.95, -0.75), P(-0.80, -1.20))    # breast/throat
    outline += bezier(P(-0.80, -1.20), P(-1.05, -1.18), P(-1.30, -1.08), P(-1.50, -0.95))   # lower beak
    outline += bezier(P(-1.50, -0.95), P(-1.25, -1.15), P(-1.00, -1.30), P(-0.78, -1.40))   # gape
    d.polygon(outline, fill=color)
    # Legs down to the branch
    w = max(2, int(0.09 * k))
    d.line([P(0.05, 0.95), P(-0.05, 1.42)], fill=color, width=w)
    d.line([P(0.45, 0.95), P(0.42, 1.42)], fill=color, width=w)


def notes(d: ImageDraw.ImageDraw, ox: float, oy: float, k: float, color) -> None:
    """Three soft arcs of song coming from the beak."""
    for i, r in enumerate((0.55, 0.95, 1.35)):
        box = [ox - r * k, oy - r * k, ox + r * k, oy + r * k]
        d.arc(box, start=200, end=250, fill=color + (255 - i * 60,), width=int(0.11 * k))


def draw(size: int = S, background: bool = True) -> Image.Image:
    base = sky(size) if background else Image.new("RGB", (size, size), NIGHT)
    img = base.convert("RGBA")
    k = size / 10.0

    # Sun glow and disc, rising behind the bird.
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy, r = size * 0.56, size * 0.70, size * 0.30
    gd.ellipse([cx - r * 1.5, cy - r * 1.5, cx + r * 1.5, cy + r * 1.5], fill=GOLD + (90,))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.06))
    img = Image.alpha_composite(img, glow)
    d = ImageDraw.Draw(img)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=GOLD + (255,))
    inner = r * 0.82
    d.ellipse([cx - inner, cy - inner, cx + inner, cy + inner], fill=CREAM + (255,))

    # Branch across the lower part.
    bw = int(0.22 * k)
    d.line([(size * -0.05, size * 0.83), (size * 0.55, size * 0.775), (size * 1.05, size * 0.735)], fill=NIGHT, width=bw,
           joint="curve")
    d.line([(size * 0.72, size * 0.758), (size * 0.86, size * 0.66)], fill=NIGHT, width=int(bw * 0.6))
    # A pointed leaf at the end of the twig.
    a, b = (size * 0.855, size * 0.665), (size * 0.97, size * 0.575)
    leaf = bezier(a, (size * 0.87, size * 0.59), (size * 0.92, size * 0.565), b) + \
        bezier(b, (size * 0.955, size * 0.63), (size * 0.91, size * 0.66), a)
    d.polygon(leaf, fill=NIGHT)

    # The bird, perched on the branch, singing up and to the left.
    bird(d, size * 0.50, size * 0.62, k * 0.95, NIGHT)
    notes(d, size * 0.50 - 1.55 * k * 0.95, size * 0.62 - 1.30 * k * 0.95, k * 0.95, CREAM)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    art = draw()
    icon = art.convert("RGB").resize((1024, 1024), Image.LANCZOS)
    icon.save(OUT / "icon.png", optimize=True)
    icon.resize((48, 48), Image.LANCZOS).save(OUT / "favicon.png")

    # Splash: just the sun and bird on the splash colour, with transparency around it.
    splash = art.resize((512, 512), Image.LANCZOS)
    mask = Image.new("L", (512, 512), 0)
    ImageDraw.Draw(mask).ellipse([16, 16, 496, 496], fill=255)
    out = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    out.paste(splash, (0, 0), mask.filter(ImageFilter.GaussianBlur(6)))
    out.save(OUT / "splash-icon.png", optimize=True)

    # Android adaptive icon: art inside the 66% safe zone on a night background.
    fg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    small = art.resize((680, 680), Image.LANCZOS)
    m = Image.new("L", (680, 680), 0)
    ImageDraw.Draw(m).ellipse([0, 0, 680, 680], fill=255)
    fg.paste(small, (172, 172), m)
    fg.save(OUT / "android-icon-foreground.png", optimize=True)
    Image.new("RGB", (1024, 1024), NIGHT).save(OUT / "android-icon-background.png")
    mono = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    md = ImageDraw.Draw(mono)
    bird(md, 512, 560, 120, (255, 255, 255))
    mono.save(OUT / "android-icon-monochrome.png", optimize=True)
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
