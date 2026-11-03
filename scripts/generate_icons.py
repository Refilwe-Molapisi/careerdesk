#!/usr/bin/env python3
"""Generate Career Desk PWA icons: the letters CD on the accent colour.

Outputs:
  public/icons/icon-192.png        standard icon
  public/icons/icon-512.png        standard icon
  public/icons/icon-maskable-512.png  maskable (safe-zone padded, full bleed)
  app/icon.png                     used by Next for favicon/og links
  app/apple-icon.png               Apple touch icon
  app/favicon.ico                  multi-size favicon
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ACCENT = (79, 70, 229)  # #4f46e5
WHITE = (255, 255, 255)
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def draw_icon(size: int, radius_ratio: float, glyph_ratio: float) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    radius = int(size * radius_ratio)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=ACCENT)

    font = ImageFont.truetype(FONT_PATH, int(size * glyph_ratio))
    bbox = draw.textbbox((0, 0), "CD", font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) / 2 - bbox[0]
    y = (size - text_h) / 2 - bbox[1]
    draw.text((x, y), "CD", font=font, fill=WHITE)
    return img


def main() -> None:
    icons_dir = ROOT / "public" / "icons"
    icons_dir.mkdir(parents=True, exist_ok=True)
    app_dir = ROOT / "app"
    app_dir.mkdir(parents=True, exist_ok=True)

    # Standard icons: rounded square, prominent letters.
    for size in (192, 512):
        draw_icon(size, radius_ratio=0.18, glyph_ratio=0.52).save(
            icons_dir / f"icon-{size}.png"
        )

    # Maskable: full-bleed square, letters inside the 80% safe zone so the
    # circular mask never clips them.
    draw_icon(512, radius_ratio=0.0, glyph_ratio=0.38).save(
        icons_dir / "icon-maskable-512.png"
    )

    # Next.js auto-detected icons.
    draw_icon(512, radius_ratio=0.18, glyph_ratio=0.52).save(app_dir / "icon.png")
    draw_icon(180, radius_ratio=0.18, glyph_ratio=0.52).save(app_dir / "apple-icon.png")

    # Multi-size favicon from a clean 256px master.
    master = draw_icon(256, radius_ratio=0.18, glyph_ratio=0.52)
    master.save(
        app_dir / "favicon.ico",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )

    for f in (
        icons_dir / "icon-192.png",
        icons_dir / "icon-512.png",
        icons_dir / "icon-maskable-512.png",
        app_dir / "icon.png",
        app_dir / "apple-icon.png",
        app_dir / "favicon.ico",
    ):
        print(f"{f.name:>22}  {f.stat().st_size:>8} bytes")


if __name__ == "__main__":
    main()
