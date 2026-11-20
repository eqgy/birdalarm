"""Fetch one openly licensed photo per bird from Wikimedia Commons.

For each bird in app/src/data/birds.json it takes the lead image of the species' English
Wikipedia article, checks its license on Commons, and downloads an 800px-wide JPEG to
app/assets/birds/<id>.jpg (or .png). Credits go to app/src/data/photos.json.

Only CC0, public domain, CC BY and CC BY-SA images are accepted (no NC, no ND).
Birds whose image fails the check are listed at the end and get no photo.

Usage: python pipeline/fetch_photos.py [--force]
"""
from __future__ import annotations

import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BIRDS = ROOT / "app/src/data/birds.json"
OUT_DIR = ROOT / "app/assets/birds"
CREDITS = ROOT / "app/src/data/photos.json"
# Wikimedia asks automated tools to name a contact; without one, downloads get throttled.
# Set WIKIMEDIA_CONTACT (an email or URL) in your environment; it is never written to the repo.
_contact = os.environ.get("WIKIMEDIA_CONTACT", "").strip()
UA = "DawnChorusFetcher/0.2 (open-source birdsong alarm" + (f"; {_contact}" if _contact else "") + ")"
WIDTH = 800


def fetch(url: str) -> bytes:
    """GET with retries: Wikimedia rate-limits (HTTP 429), so back off and try again."""
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 5:
                raise
            wait = int(e.headers.get("Retry-After") or 0) or 10 * (attempt + 1)
            time.sleep(min(wait, 90))
    raise RuntimeError("unreachable")


def get_json(url: str, params: dict) -> dict:
    full = url + "?" + urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    return json.loads(fetch(full))


def allowed(license_name: str) -> bool:
    l = license_name.lower()
    if "nc" in re.split(r"[\s\-]+", l) or "nd" in re.split(r"[\s\-]+", l):
        return False
    return l.startswith(("cc0", "cc by", "public domain", "pd"))


def plain(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", text or ""))).strip()


def lead_image(scientific_name: str) -> str | None:
    data = get_json("https://en.wikipedia.org/w/api.php", {
        "action": "query", "prop": "pageimages", "piprop": "name", "titles": scientific_name, "redirects": 1,
    })
    pages = data.get("query", {}).get("pages", [])
    return pages[0].get("pageimage") if pages else None


def image_info(filename: str) -> dict | None:
    data = get_json("https://commons.wikimedia.org/w/api.php", {
        "action": "query", "titles": f"File:{filename}", "prop": "imageinfo",
        "iiprop": "url|extmetadata", "iiurlwidth": WIDTH,
    })
    pages = data.get("query", {}).get("pages", [])
    if not pages or "imageinfo" not in pages[0]:
        return None
    return pages[0]["imageinfo"][0]


def main() -> int:
    force = "--force" in sys.argv
    birds = json.loads(BIRDS.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    credits = json.loads(CREDITS.read_text(encoding="utf-8")) if CREDITS.exists() and not force else {}
    missing: list[str] = []

    for b in birds:
        bid = b["id"]
        if bid in credits and any((OUT_DIR / f"{bid}{e}").exists() for e in (".jpg", ".png")):
            continue
        try:
            name = lead_image(b["scientificName"])
            info = image_info(name) if name else None
            if not info:
                missing.append(f"{bid}: no lead image")
                continue
            meta = info.get("extmetadata", {})
            lic = plain(meta.get("LicenseShortName", {}).get("value", ""))
            if not allowed(lic):
                missing.append(f"{bid}: license {lic!r} not allowed ({name})")
                continue
            url = info.get("thumburl") or info["url"]
            ext = ".png" if url.lower().split("?")[0].endswith(".png") else ".jpg"
            if ext == ".jpg" and not url.lower().split("?")[0].endswith((".jpg", ".jpeg")):
                missing.append(f"{bid}: not a JPEG or PNG ({name})")
                continue
            dest = OUT_DIR / f"{bid}{ext}"
            dest.write_bytes(fetch(url))
            credits[bid] = {
                "artist": plain(meta.get("Artist", {}).get("value", "")).replace("No machine-readable author provided. ", "").replace(" assumed (based on copyright claims).", "") or "Unknown",
                "license": lic,
                "source": info.get("descriptionurl", ""),
                "file": name,
            }
            print(f"ok   {bid}  {lic}  {credits[bid]['artist'][:40]}")
            time.sleep(2)  # be polite to Wikimedia
        except Exception as e:  # keep going; report at the end
            missing.append(f"{bid}: {e}")

    ordered = {b["id"]: credits[b["id"]] for b in birds if b["id"] in credits}
    CREDITS.write_text(json.dumps(ordered, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\n{len(ordered)}/{len(birds)} birds have photos")
    for m in missing:
        print("MISSING", m)
    return 0


if __name__ == "__main__":
    sys.exit(main())
