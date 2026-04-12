#!/usr/bin/env python3
"""Generate SEO assets for Solaroid (Solitaire app).

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

# Brand colors
FELT_GREEN = (11, 107, 58)       # #0b6b3a
FELT_DARK = (6, 77, 39)          # #064d27
CARD_WHITE = (255, 255, 255)
CARD_RED = (220, 38, 38)         # red-600
CARD_BLACK = (30, 30, 30)
GOLD = (255, 215, 0)
SHADOW = (0, 0, 0, 80)


def draw_spade(draw, cx, cy, size, color):
    """Draw a spade (Pik) symbol centered at (cx, cy)."""
    s = size
    # The spade shape: inverted heart on top + stem at bottom

    # Top part: two circles and a triangle pointing up
    # Triangle (pointing up)
    tri_top = cy - s * 0.5
    tri_bottom = cy + s * 0.15
    tri_left = cx - s * 0.4
    tri_right = cx + s * 0.4
    draw.polygon(
        [(cx, tri_top), (tri_left, tri_bottom), (tri_right, tri_bottom)],
        fill=color,
    )

    # Two circles at the bottom-left and bottom-right of the triangle
    r = s * 0.28
    draw.ellipse(
        [cx - s * 0.42 - r * 0.2, tri_bottom - r * 1.1,
         cx - s * 0.42 - r * 0.2 + 2 * r, tri_bottom - r * 1.1 + 2 * r],
        fill=color,
    )
    draw.ellipse(
        [cx + s * 0.42 + r * 0.2 - 2 * r, tri_bottom - r * 1.1,
         cx + s * 0.42 + r * 0.2, tri_bottom - r * 1.1 + 2 * r],
        fill=color,
    )

    # Stem
    stem_w = s * 0.1
    stem_top = cy + s * 0.05
    stem_bottom = cy + s * 0.5
    draw.rectangle(
        [cx - stem_w, stem_top, cx + stem_w, stem_bottom],
        fill=color,
    )


def draw_card_shape(draw, x, y, w, h, radius=8, fill=CARD_WHITE, outline=None):
    """Draw a rounded rectangle (card shape)."""
    draw.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=fill, outline=outline)


def draw_mini_card(draw, x, y, w, h, suit_color, radius=4):
    """Draw a small playing card with a colored corner pip."""
    draw_card_shape(draw, x, y, w, h, radius=radius, fill=CARD_WHITE)
    # Small suit indicator
    pip_size = min(w, h) * 0.3
    pip_cx = x + w * 0.3
    pip_cy = y + h * 0.3
    draw.ellipse(
        [pip_cx - pip_size / 2, pip_cy - pip_size / 2,
         pip_cx + pip_size / 2, pip_cy + pip_size / 2],
        fill=suit_color,
    )


def draw_card_back(draw, x, y, w, h, radius=4):
    """Draw a face-down card with cross-hatch pattern."""
    draw_card_shape(draw, x, y, w, h, radius=radius, fill=(30, 80, 50))
    # Diamond pattern
    draw_card_shape(draw, x + 2, y + 2, w - 4, h - 4, radius=max(1, radius - 1), fill=(20, 60, 40), outline=(40, 100, 65))


# ---------------------------------------------------------------------------
# FAVICON / ICON generation
# ---------------------------------------------------------------------------

def generate_icon(size):
    """Generate a square icon at the given size."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Green circle background
    margin = size * 0.06
    draw.ellipse(
        [margin, margin, size - margin, size - margin],
        fill=FELT_GREEN,
    )

    # Darker ring
    ring = size * 0.08
    draw.ellipse(
        [margin + ring, margin + ring, size - margin - ring, size - margin - ring],
        fill=FELT_DARK,
    )

    # Inner felt
    inner = size * 0.12
    draw.ellipse(
        [margin + inner, margin + inner, size - margin - inner, size - margin - inner],
        fill=FELT_GREEN,
    )

    # White spade in center
    draw_spade(draw, size / 2, size / 2, size * 0.45, CARD_WHITE)

    return img


def generate_favicon():
    """Generate multi-resolution favicon.ico."""
    sizes = [16, 32, 48]
    images = [generate_icon(s) for s in sizes]
    # Save as ICO
    path = os.path.join(APP, "favicon.ico")
    images[0].save(
        path,
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=images[1:],
    )
    print(f"  favicon.ico ({', '.join(f'{s}x{s}' for s in sizes)})")


def generate_png_icon(filename, size):
    """Generate a single PNG icon."""
    img = generate_icon(size)
    path = os.path.join(APP, filename)
    img.save(path, "PNG")
    print(f"  {filename} ({size}x{size})")


# ---------------------------------------------------------------------------
# OG / Twitter image generation
# ---------------------------------------------------------------------------

def generate_og_image(filename, width=1200, height=630):
    """Generate a 1200x630 social sharing image."""
    img = Image.new("RGB", (width, height), FELT_DARK)
    draw = ImageDraw.Draw(img, "RGBA")

    # Felt texture: subtle radial gradient
    cx, cy = width // 2, height // 2
    for r in range(max(width, height), 0, -3):
        alpha = max(0, min(40, int(40 * (1 - r / max(width, height)))))
        color = (FELT_GREEN[0], FELT_GREEN[1], FELT_GREEN[2], alpha)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)

    # Fill base with felt green
    draw_img = Image.new("RGB", (width, height), FELT_DARK)
    draw_base = ImageDraw.Draw(draw_img, "RGBA")

    # Gradient overlay
    for y_pos in range(height):
        t = y_pos / height
        r = int(FELT_DARK[0] * (1 - t * 0.3) + FELT_GREEN[0] * (t * 0.3))
        g = int(FELT_DARK[1] * (1 - t * 0.3) + FELT_GREEN[1] * (t * 0.3))
        b = int(FELT_DARK[2] * (1 - t * 0.3) + FELT_GREEN[2] * (t * 0.3))
        draw_base.line([(0, y_pos), (width, y_pos)], fill=(r, g, b))

    img = draw_img
    draw = ImageDraw.Draw(img, "RGBA")

    # Decorative card fan on the left side
    card_w, card_h = 120, 170
    fan_cx, fan_cy = 250, height // 2

    # Draw fanned cards (foundation-style, Ace through 4)
    suits_colors = [CARD_RED, CARD_BLACK, CARD_RED, CARD_BLACK]
    suit_symbols = ["A", "A", "A", "A"]

    for i, (sc, sym) in enumerate(zip(suits_colors, suit_symbols)):
        angle = -15 + i * 10
        # Create rotated card
        card_img = Image.new("RGBA", (card_w + 20, card_h + 20), (0, 0, 0, 0))
        card_draw = ImageDraw.Draw(card_img)
        draw_card_shape(card_draw, 10, 10, card_w, card_h, radius=10, fill=CARD_WHITE)

        # Suit pip in center of card
        pip_size = 30
        pip_cx = 10 + card_w // 2
        pip_cy = 10 + card_h // 2
        draw_spade(card_draw, pip_cx, pip_cy, pip_size, sc)

        # Corner text
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 28)
        except (OSError, IOError):
            font = ImageFont.load_default()
        card_draw.text((18, 14), sym, fill=sc, font=font)

        # Rotate and paste
        rotated = card_img.rotate(angle, expand=True, resample=Image.BICUBIC)
        paste_x = fan_cx - rotated.width // 2 + i * 30
        paste_y = fan_cy - rotated.height // 2
        img.paste(rotated, (paste_x, paste_y), rotated)

    # Right side: cascading tableau cards
    tab_x = width - 380
    for col in range(4):
        for row in range(col + 1):
            x = tab_x + col * 70
            y = 120 + row * 35
            if row == col:
                # Face up
                draw_card_shape(draw, x, y, 60, 85, radius=6, fill=CARD_WHITE)
                pip_color = CARD_RED if col % 2 == 0 else CARD_BLACK
                draw_spade(draw, x + 30, y + 45, 18, pip_color)
            else:
                # Face down
                draw_card_back(draw, x, y, 60, 85, radius=6)

    # Title text: "Solitär"
    try:
        title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 88)
    except (OSError, IOError):
        title_font = ImageFont.load_default()
    try:
        sub_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 32)
    except (OSError, IOError):
        sub_font = ImageFont.load_default()

    title = "Solitär"
    subtitle = "Klondike Solitaire im Browser"

    # Center text
    title_bbox = draw.textbbox((0, 0), title, font=title_font)
    title_w = title_bbox[2] - title_bbox[0]
    title_h = title_bbox[3] - title_bbox[1]

    sub_bbox = draw.textbbox((0, 0), subtitle, font=sub_font)
    sub_w = sub_bbox[2] - sub_bbox[0]

    text_x = (width - title_w) // 2 + 40
    text_y = (height - title_h) // 2 - 30

    # Text shadow
    draw.text((text_x + 3, text_y + 3), title, fill=(0, 0, 0, 120), font=title_font)
    # Main text
    draw.text((text_x, text_y), title, fill=CARD_WHITE, font=title_font)

    # Subtitle
    sub_x = (width - sub_w) // 2 + 40
    sub_y = text_y + title_h + 20
    draw.text((sub_x + 2, sub_y + 2), subtitle, fill=(0, 0, 0, 100), font=sub_font)
    draw.text((sub_x, sub_y), subtitle, fill=(200, 230, 210), font=sub_font)

    # Decorative line under subtitle
    line_w = 300
    line_x = (width + 80) // 2 - line_w // 2
    line_y = sub_y + 50
    draw.line([(line_x, line_y), (line_x + line_w, line_y)], fill=(255, 255, 255, 60), width=2)

    # Bottom tagline
    try:
        tag_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22)
    except (OSError, IOError):
        tag_font = ImageFont.load_default()

    tagline = "Draw 1  \u2022  Draw 3  \u2022  Kostenlos  \u2022  Ohne Anmeldung"
    tag_bbox = draw.textbbox((0, 0), tagline, font=tag_font)
    tag_w = tag_bbox[2] - tag_bbox[0]
    draw.text(
        ((width - tag_w) // 2 + 40, height - 70),
        tagline,
        fill=(180, 210, 190),
        font=tag_font,
    )

    path = os.path.join(APP, filename)
    img.save(path, "PNG", optimize=True)
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
