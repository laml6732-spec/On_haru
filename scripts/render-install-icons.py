"""Regenerate On_HARU PWA PNGs from the approved full-bleed sheep-wave art.
Only app-install icons are updated; never touch the app's launch image or user data.
"""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
folder = ROOT / "public/legacy/icons"
source = folder / "onharu-face-wave-source.avif"
with Image.open(source) as art:
    base = art.convert("RGB")
if base.size != (512, 512):
    raise SystemExit(f"Expected 512x512 source, got {base.size}")
for point in [(0, 0), (511, 0), (0, 511), (511, 511)]:
    if max(base.getpixel(point)) < 30:
        raise SystemExit(f"Unexpected black corner at {point}")
for n in (192, 512):
    image = base.resize((n, n), Image.Resampling.LANCZOS)
    output = folder / f"onharu-face-wave-{n}.png"
    image.save(output, format="PNG", optimize=True)
    check = Image.open(output)
    assert check.size == (n, n) and check.mode == "RGB"
    print(f"{output}: {n}x{n}, fully opaque")
