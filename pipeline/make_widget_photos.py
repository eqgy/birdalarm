"""Make the square bird photos the widget shows (app/targets/alarm-widget/birds/<id>.jpg).

Crops each library photo to a square centred on the bird (focusX in photos.json) and scales it
to 300px, about 17 KB each. Run after fetch_photos.py when birds or photos change.
Usage: python pipeline/make_widget_photos.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
credits = json.loads((ROOT / "app/src/data/photos.json").read_text(encoding="utf-8"))
out = ROOT / "app/targets/alarm-widget/birds"
out.mkdir(exist_ok=True)
for bid, c in credits.items():
    src = next((ROOT / "app/assets/birds").glob(bid + ".*"))
    im = Image.open(src).convert("RGB")
    side = min(im.size)
    cx = int(im.width * c.get("focusX", 0.5))
    left = max(0, min(im.width - side, cx - side // 2))
    top = (im.height - side) // 2
    im.crop((left, top, left + side, top + side)).resize((300, 300), Image.LANCZOS).save(
        out / f"{bid}.jpg", quality=80, optimize=True)
print(len(credits), "widget photos written")
