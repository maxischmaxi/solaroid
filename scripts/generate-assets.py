#!/usr/bin/env python3
"""Generate SEO assets for Solaroid (Solitaire app).

Brand: "Abendpartie" — night-time card table under a warm lamp. Deep fir
felt, ivory cards, and the brass sun medallion on midnight blue (the app's
signature card back). Keep in sync with lib/canvas/palette.ts.

Generates:
  - app/favicon.ico          (16x16 + 32x32 + 48x48 multi-resolution)
  - app/icon.png             (192x192 PNG)
  - app/apple-icon.png       (180x180 PNG)
  - app/opengraph-image.png  (1200x630 OG image)
  - app/twitter-image.png    (1200x630 Twitter card)
"""

from PIL import Image, ImageDraw, ImageFont
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "app")

# Brand colors (see lib/canvas/palette.ts + app/globals.css)
FELT_HIGH = (16, 96, 60)         # #10603c
FELT = (11, 74, 46)              # #0b4a2e
FELT_LOW = (7, 55, 35)           # #073723
IVORY = (250, 246, 234)          # #faf6ea
IVORY_DIM = (246, 241, 227)      # #f6f1e3
CARMINE = (181, 34, 55)          # #b52237
CHARCOAL = (38, 42, 48)          # #262a30
MIDNIGHT_HIGH = (36, 72, 124)    # #24487c
MIDNIGHT_LOW = (21, 41, 77)      # #15294d
BRASS = (228, 188, 98)           # #e4bc62
BRASS_CORE = (242, 216, 148)     # #f2d894
LAMP = (255, 213, 130)           # warm lamp light

SERIF_ITALIC = "/usr/share/fonts/liberation/LiberationSerif-BoldItalic.ttf"
SERIF = "/usr/share/fonts/liberation/LiberationSerif-Bold.ttf"
SANS = "/usr/share/fonts/liberation/LiberationSans-Regular.ttf"


def load_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except (OSError, IOError):
        return ImageFont.load_default()


def draw_sun(draw, cx, cy, radius, rays=16, color=BRASS, core=BRASS_CORE):
    """The brass sun medallion: alternating long/short rays around a disc."""
    ray_base = radius * 0.52
    half = 0.115  # half angular width of a ray wedge (radians)
    for i in range(rays):
        ang = i * 2 * math.pi / rays - math.pi / 2
        length = radius if i % 2 == 0 else radius * 0.78
        p1 = (cx + math.cos(ang - half) * ray_base, cy + math.sin(ang - half) * ray_base)
        p2 = (cx + math.cos(ang) * length, cy + math.sin(ang) * length)
        p3 = (cx + math.cos(ang + half) * ray_base, cy + math.sin(ang + half) * ray_base)
        draw.polygon([p1, p2, p3], fill=color)
    disc = radius * 0.38
    draw.ellipse([cx - disc, cy - disc, cx + disc, cy + disc], fill=color)
    core_r = radius * 0.30
    draw.ellipse([cx - core_r, cy - core_r, cx + core_r, cy + core_r], fill=core)


def vertical_gradient(size_wh, top, bottom):
    """An RGB image filled with a vertical linear gradient."""
    w, h = size_wh
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line(
            [(0, y), (w, y)],
            fill=tuple(int(a * (1 - t) + b * t) for a, b in zip(top, bottom)),
        )
    return img


def rounded_mask(size_wh, radius):
    mask = Image.new("L", size_wh, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size_wh[0] - 1, size_wh[1] - 1], radius=radius, fill=255
    )
    return mask


def card_back(size_wh, radius):
    """The signature card back: midnight gradient, double frame, brass sun."""
    w, h = size_wh
    img = vertical_gradient((w, h), MIDNIGHT_HIGH, MIDNIGHT_LOW).convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    f1 = max(2, int(w * 0.055))
    f2 = max(4, int(w * 0.10))
    d.rounded_rectangle(
        [f1, f1, w - f1, h - f1], radius=int(radius * 0.8),
        outline=IVORY + (90,), width=max(1, w // 90),
    )
    d.rounded_rectangle(
        [f2, f2, w - f2, h - f2], radius=int(radius * 0.6),
        outline=IVORY + (45,), width=max(1, w // 90),
    )
    draw_sun(d, w / 2, h / 2, w * 0.30)
    img.putalpha(rounded_mask((w, h), radius))
    return img


def card_front(size_wh, radius, pip_color, label=None, font=None):
    """Ivory card stock with a suit-colored center pip."""
    w, h = size_wh
    img = Image.new("RGBA", (w, h), IVORY + (255,))
    d = ImageDraw.Draw(img, "RGBA")
    d.rounded_rectangle(
        [0, 0, w - 1, h - 1], radius=radius,
        outline=(52, 42, 26, 70), width=max(1, w // 60),
    )
    draw_spade(d, w / 2, h / 2 + h * 0.06, w * 0.30, pip_color)
    if label and font:
        d.text((w * 0.10, h * 0.045), label, fill=pip_color, font=font)
    img.putalpha(rounded_mask((w, h), radius))
    return img


def draw_spade(draw, cx, cy, size, color):
    """Draw a spade (Pik) symbol centered at (cx, cy)."""
    s = size
    tri_top = cy - s * 0.5
    tri_bottom = cy + s * 0.15
    draw.polygon(
        [(cx, tri_top), (cx - s * 0.4, tri_bottom), (cx + s * 0.4, tri_bottom)],
        fill=color,
    )
    r = s * 0.28
    for side in (-1, 1):
        # symmetric lobes left/right of the triangle base
        lobe_cx = cx + side * (s * 0.42 - r * 0.6)
        draw.ellipse(
            [lobe_cx - r, tri_bottom - r * 1.1, lobe_cx + r, tri_bottom - r * 1.1 + 2 * r],
            fill=color,
        )
    stem_w = s * 0.1
    draw.rectangle(
        [cx - stem_w, cy + s * 0.05, cx + stem_w, cy + s * 0.5],
        fill=color,
    )


# ---------------------------------------------------------------------------
# FAVICON / ICON generation
# ---------------------------------------------------------------------------

SUPERSAMPLE = 4


def generate_icon(size):
    """App icon: the signature midnight card back with the brass sun."""
    s = size * SUPERSAMPLE
    img = card_back((s, s), radius=int(s * 0.22))
    return img.resize((size, size), Image.LANCZOS)


def generate_favicon():
    """Generate multi-resolution favicon.ico."""
    sizes = [16, 32, 48]
    images = [generate_icon(n) for n in sizes]
    path = os.path.join(APP, "favicon.ico")
    images[0].save(
        path,
        format="ICO",
        sizes=[(n, n) for n in sizes],
        append_images=images[1:],
    )
    print(f"  favicon.ico ({', '.join(f'{n}x{n}' for n in sizes)})")


def generate_png_icon(filename, size):
    img = generate_icon(size)
    img.save(os.path.join(APP, filename), "PNG")
    print(f"  {filename} ({size}x{size})")


# ---------------------------------------------------------------------------
# OG / Twitter image generation
# ---------------------------------------------------------------------------


def generate_og_image(filename, width=1200, height=630):
    """1200x630 social card: felt table, card fan, serif wordmark."""
    ss = 2  # supersample for clean edges
    w, h = width * ss, height * ss
    img = vertical_gradient((w, h), FELT_HIGH, FELT_LOW).convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")

    # Warm lamp pool from the top center.
    lamp = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lamp)
    steps = 46
    max_r = int(w * 0.55)
    for i in range(steps, 0, -1):
        r = max_r * i / steps
        alpha = int(34 * (1 - i / steps))
        ld.ellipse(
            [w / 2 - r, -r * 0.75, w / 2 + r, r * 0.75],
            fill=LAMP + (alpha,),
        )
    img = Image.alpha_composite(img, lamp)
    d = ImageDraw.Draw(img, "RGBA")

    corner_font = load_font(SERIF, int(34 * ss))

    # Left: a fan — two ivory aces and the sun-back card on top.
    card_w, card_h = int(150 * ss), int(210 * ss)
    fan_cx, fan_cy = int(235 * ss), int(h * 0.56)
    fan = [
        (card_front((card_w, card_h), int(14 * ss), CHARCOAL, "A", corner_font), -16),
        (card_front((card_w, card_h), int(14 * ss), CARMINE, "A", corner_font), -2),
        (card_back((card_w, card_h), int(14 * ss)), 12),
    ]
    for i, (card, angle) in enumerate(fan):
        rotated = card.rotate(angle, expand=True, resample=Image.BICUBIC)
        # Soft drop shadow: flat dark color masked by the card's own alpha.
        shadow = Image.new("RGBA", rotated.size, (3, 14, 8, 255))
        shadow.putalpha(rotated.getchannel("A").point(lambda a: a * 70 // 255))
        px = fan_cx - rotated.width // 2 + i * int(46 * ss)
        py = fan_cy - rotated.height // 2 + abs(i - 1) * int(8 * ss)
        img.paste(shadow, (px + int(5 * ss), py + int(9 * ss)), shadow)
        img.paste(rotated, (px, py), rotated)
    d = ImageDraw.Draw(img, "RGBA")

    # Right: a small tableau cascade.
    tab_x = w - int(370 * ss)
    cw, ch = int(64 * ss), int(90 * ss)
    for col in range(4):
        for row in range(col + 1):
            x = tab_x + col * int(72 * ss)
            y = int(110 * ss) + row * int(38 * ss)
            if row == col:
                pip = CARMINE if col % 2 == 0 else CHARCOAL
                card = card_front((cw, ch), int(7 * ss), pip)
            else:
                card = card_back((cw, ch), int(7 * ss))
            img.paste(card, (x, y), card)
    d = ImageDraw.Draw(img, "RGBA")

    # Center: the wordmark in an engraved serif italic.
    title_font = load_font(SERIF_ITALIC, int(104 * ss))
    sub_font = load_font(SANS, int(30 * ss))
    tag_font = load_font(SANS, int(21 * ss))

    title = "Solitär"
    subtitle = "Klondike Solitaire im Browser"
    tagline = "Draw 1  •  Draw 3  •  Kostenlos  •  Ohne Anmeldung"

    tb = d.textbbox((0, 0), title, font=title_font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    tx = (w - tw) // 2 + int(30 * ss)
    ty = (h - th) // 2 - int(46 * ss)
    d.text((tx + 3 * ss, ty + 3 * ss), title, fill=(0, 8, 4, 130), font=title_font)
    d.text((tx, ty), title, fill=IVORY + (255,), font=title_font)

    sb = d.textbbox((0, 0), subtitle, font=sub_font)
    sw = sb[2] - sb[0]
    sx = (w - sw) // 2 + int(30 * ss)
    sy = ty + th + int(34 * ss)
    d.text((sx, sy), subtitle, fill=(226, 219, 199, 235), font=sub_font)

    # Brass sun divider under the subtitle.
    line_w = int(120 * ss)
    line_y = sy + int(64 * ss)
    line_cx = (w + int(60 * ss)) // 2
    d.line([(line_cx - line_w, line_y), (line_cx - int(26 * ss), line_y)], fill=BRASS + (170,), width=2 * ss)
    d.line([(line_cx + int(26 * ss), line_y), (line_cx + line_w, line_y)], fill=BRASS + (170,), width=2 * ss)
    draw_sun(d, line_cx, line_y, int(15 * ss), rays=12)

    gb = d.textbbox((0, 0), tagline, font=tag_font)
    gw = gb[2] - gb[0]
    d.text(
        ((w - gw) // 2 + int(30 * ss), h - int(64 * ss)),
        tagline,
        fill=BRASS_CORE + (215,),
        font=tag_font,
    )

    out = img.convert("RGB").resize((width, height), Image.LANCZOS)
    out.save(os.path.join(APP, filename), "PNG", optimize=True)
    print(f"  {filename} ({width}x{height})")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("Generating SEO assets for Solaroid...")

    generate_favicon()
    generate_png_icon("icon.png", 192)
    generate_png_icon("apple-icon.png", 180)
    generate_og_image("opengraph-image.png", 1200, 630)
    generate_og_image("twitter-image.png", 1200, 630)

    print("\nDone!")
