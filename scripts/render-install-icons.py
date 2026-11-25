"""Regenerate PWA icon sizes from the approved On_HARU master PNG.
Do not overwrite the historical sheep art or user data.
"""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
folder = ROOT / "public/legacy/icons"
source = folder / "onharu-brand-1024.png"
with Image.open(source) as art:
    base = art.convert("RGB")
assert base.size == (1024, 1024)
assert all(base.getpixel(p) == (250, 247, 239) for p in [(0,0),(1023,0),(0,1023),(1023,1023)])
for n in (48, 180, 192, 512):
    output = folder / f"onharu-brand-{n}.png"
    base.resize((n,n), Image.Resampling.LANCZOS).save(output, format="PNG", optimize=True)
    with Image.open(output) as check:
        assert check.size == (n,n) and check.mode == "RGB"
    print(f"{output}: {n}x{n}, fully opaque")
