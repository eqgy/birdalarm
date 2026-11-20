"""Fetch one song recording per bird and make the alarm and playback files.

Source: xeno-canto recordings mirrored on Wikimedia Commons (titles like
"Turdus migratorius - American Robin XC174852.mp3"). Commons needs no API key, keeps each
recordist's license, and links back to the xeno-canto page. Only CC0, CC BY and CC BY-SA are
accepted (never NC or ND), and only files with a xeno-canto number.

For each bird in app/src/data/birds.json it:
  1. searches Commons for its scientific name, keeps candidates with an XC number;
  2. prefers songs over calls, 15-120 s long, with an allowed license;
  3. downloads the original to pipeline/.cache/audio/;
  4. with ffmpeg makes
       app/assets/sounds/<id>.caf  alarm sound: 28 s, mono 22.05 kHz IMA4, loudness-normalized
                                   (AlarmKit plays custom sounds up to 30 s)
       app/assets/audio/<id>.m4a   in-app playback: up to 45 s, AAC 64 kbps mono

Then writes:
  birds.json (repo root)           the full library with audio and attribution, checked by
                                   pipeline/check_birds.py
  app/src/data/recordings.json     audio credits the app shows
  app/src/data/audio-files.ts      static require() for each playback file
  CREDITS.md                       one row per recording

Usage:
  python pipeline/fetch_audio.py [--force]
      Find and download recordings from Wikimedia Commons.
  python pipeline/fetch_audio.py --from-folder "C:/path/to/downloads"
      Use MP3s you downloaded yourself from xeno-canto. Any filenames work: each file's
      species, XC number, recordist and license are read from the tags xeno-canto puts
      inside it (falling back to the filename). Files with an NC or ND license are skipped.
Needs ffmpeg and ffprobe on PATH.
"""
from __future__ import annotations

import json
from html import unescape as html_unescape
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

import fetch_photos as fp

ROOT = fp.ROOT
LIBRARY = ROOT / "app/src/data/birds.json"
CACHE = ROOT / "pipeline/.cache/audio"
SOUNDS = ROOT / "app/assets/sounds"
AUDIO = ROOT / "app/assets/audio"
RECORDINGS = ROOT / "app/src/data/recordings.json"
INDEX = ROOT / "app/src/data/audio-files.ts"
ROOT_BIRDS = ROOT / "birds.json"
CREDITS_MD = ROOT / "CREDITS.md"

XC_RE = re.compile(r"XC\s?(\d{3,7})", re.I)
ALARM_SECONDS = 28
PLAY_SECONDS = 45


def base_license(name: str) -> str | None:
    """'CC BY-SA 4.0' -> 'CC BY-SA'; None if not allowed."""
    if not fp.allowed(name):
        return None
    n = name.upper()
    if n.startswith("CC0") or "PUBLIC DOMAIN" in n or n.startswith("PD"):
        return "CC0"
    if n.startswith("CC BY-SA"):
        return "CC BY-SA"
    if n.startswith("CC BY"):
        return "CC BY"
    return None


def candidates(scientific: str) -> list[str]:
    data = fp.get_json("https://commons.wikimedia.org/w/api.php", {
        "action": "query", "list": "search", "srnamespace": 6, "srlimit": 40,
        "srsearch": f'"{scientific}" XC filetype:audio',
    })
    titles = [r["title"] for r in data.get("query", {}).get("search", [])]
    genus = scientific.split()[0].lower()
    species = scientific.split()[1].lower()
    out, seen = [], set()
    for t in titles:
        low = t.lower()
        m = XC_RE.search(t)
        # The species must be in the title, not just mentioned (e.g. as a background bird).
        if not m or genus not in low or species not in low:
            continue
        if m.group(1) in seen:
            continue
        seen.add(m.group(1))
        out.append(t)
    return out[:20]


def infos(titles: list[str]) -> list[dict]:
    if not titles:
        return []
    data = fp.get_json("https://commons.wikimedia.org/w/api.php", {
        "action": "query", "titles": "|".join(titles), "prop": "imageinfo",
        "iiprop": "url|size|mediatype|extmetadata",
    })
    out = []
    for page in data.get("query", {}).get("pages", []):
        if "imageinfo" not in page:
            continue
        ii = page["imageinfo"][0]
        meta = ii.get("extmetadata", {})
        out.append({
            "title": page["title"],
            "url": ii["url"].split("?")[0],
            "page": ii.get("descriptionurl", ""),
            "duration": float(ii.get("duration") or 0),
            "license": fp.plain(meta.get("LicenseShortName", {}).get("value", "")),
            "artist": fp.plain(meta.get("Artist", {}).get("value", "")),
            "description": fp.plain(meta.get("ImageDescription", {}).get("value", "")).lower(),
            "xc": "XC" + XC_RE.search(page["title"]).group(1),
        })
    return out


def score(c: dict) -> float:
    s = 0.0
    d = c["description"] + " " + c["title"].lower()
    if re.search(r"\bsong|\bsinging|\bsings\b|dawn chorus", d):
        s += 4
    if re.search(r"\bcalls?\b|alarm call|flight call", d) and "song" not in d:
        s -= 2
    if re.search(r"background|noise|traffic|wind|rain", d):
        s -= 1
    dur = c["duration"]
    if 15 <= dur <= 120:
        s += 3
    elif 8 <= dur < 15 or 120 < dur <= 240:
        s += 1
    else:
        s -= 3
    if c["title"].lower().endswith((".ogg", ".oga", ".flac", ".wav")):
        s += 0.5  # originals are often less compressed than the mp3 copies
    return s


class RateLimited(Exception):
    pass


def download(url: str, xc: str) -> bytes:
    """The Commons copy, waiting out rate limits; xeno-canto's own download as a fallback."""
    import urllib.error
    import urllib.request
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": fp.UA})
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429:
                break
            time.sleep(min(int(e.headers.get("Retry-After") or 60), 180))
        except Exception:
            break
    try:
        req = urllib.request.Request(f"https://xeno-canto.org/{xc[2:]}/download", headers={"User-Agent": fp.UA})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
            if r.headers.get("Content-Type", "").startswith("audio"):
                return data
    except Exception:
        pass
    raise RateLimited(f"could not download {url}")


def ffmpeg(*args: str) -> None:
    # -map_metadata -1 and -fflags +bitexact: drop the source file's tags (recording notes,
    # download codes) and the encoder stamp. Credits live in CREDITS.md and recordings.json.
    *head, out = args
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *head,
                    "-map_metadata", "-1", "-fflags", "+bitexact", out], check=True)


def make_files(src: Path, bid: str) -> None:
    # Skip leading quiet, even out the loudness, and fade the ends so it doesn't click.
    head = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.2,highpass=f=300"
    norm = "loudnorm=I=-14:TP=-1.5:LRA=11"
    ffmpeg("-i", str(src), "-t", str(ALARM_SECONDS + 2),
           "-af", f"{head},{norm},afade=t=in:d=0.6,afade=t=out:st={ALARM_SECONDS - 2}:d=2,atrim=0:{ALARM_SECONDS}",
           "-ac", "1", "-ar", "22050", "-c:a", "adpcm_ima_qt", str(SOUNDS / f"{bid}.caf"))
    ffmpeg("-i", str(src), "-t", str(PLAY_SECONDS + 2),
           "-af", f"{head},{norm},afade=t=in:d=0.6,afade=t=out:st={PLAY_SECONDS - 2}:d=2,atrim=0:{PLAY_SECONDS}",
           "-ac", "1", "-ar", "44100", "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart",
           str(AUDIO / f"{bid}.m4a"))


def tags(path: Path) -> dict[str, str]:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format_tags", "-of", "json", str(path)],
                         capture_output=True, text=True, encoding="utf-8")
    try:
        return {k.lower(): v for k, v in json.loads(out.stdout).get("format", {}).get("tags", {}).items()}
    except Exception:
        return {}


def license_from_text(text: str) -> str | None:
    """'.../licenses/by-sa/4.0/' or 'CC BY-SA 4.0' -> 'CC BY-SA 4.0'; None if not found."""
    t = text.lower()
    m = re.search(r"creativecommons\.org/(licenses|publicdomain)/([a-z-]+)/(\d\.\d)", t)
    if m:
        kind, code, ver = m.groups()
        return "CC0" if code == "zero" or kind == "publicdomain" else f"CC {code.upper()} {ver}"
    m = re.search(r"\bcc[ -]?(0|by(?:-nc)?(?:-sa|-nd)?)\b[ -]?(\d\.\d)?", t)
    if m:
        return ("CC0" if m.group(1) == "0" else f"CC {m.group(1).upper()} {m.group(2) or ''}").strip()
    return None


XC_CACHE = ROOT / "pipeline/xeno-canto-licenses.json"


def xc_page(xc: str) -> dict:
    """License and recordist from the recording's xeno-canto page. Cached in
    pipeline/xeno-canto-licenses.json (kept in git, as the record of each license), and
    fetched politely, a few seconds apart."""
    import urllib.request
    cache = json.loads(XC_CACHE.read_text(encoding="utf-8")) if XC_CACHE.exists() else {}
    if xc in cache and cache[xc].get("license") and cache[xc].get("recordist"):
        return cache[xc]
    entry = cache.get(xc, {})
    try:
        req = urllib.request.Request(f"https://xeno-canto.org/{xc[2:]}", headers={"User-Agent": fp.UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
        try:
            html = raw.decode("utf-8")
        except UnicodeDecodeError:
            html = raw.decode("cp1252", "replace")
        if "Verifying" not in html[:3000]:
            lic = license_from_text(" ".join(re.findall(r"creativecommons\.org/[a-z]+/[a-z-]+/[0-9.]+", html)))
            rec = re.search(r"class='jp-xc-recordist'>([^<]+)<", html)
            entry = {**entry, **({"license": lic} if lic else {}), **({"recordist": html_unescape(rec.group(1).strip())} if rec else {})}
            entry["checked"] = time.strftime("%Y-%m-%d")
            cache[xc] = entry
            XC_CACHE.write_text(json.dumps(dict(sorted(cache.items())), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        time.sleep(3)
    except Exception:
        pass
    return entry


def from_folder(folder: Path, library: list[dict], recs: dict) -> list[str]:
    """Match downloaded xeno-canto MP3s to library birds by scientific name in their tags/filename."""
    problems: list[str] = []
    by_sci = {b["scientificName"].lower(): b for b in library}
    for f in sorted(folder.iterdir()):
        if f.suffix.lower() not in (".mp3", ".wav", ".ogg", ".flac", ".m4a"):
            continue
        t = tags(f)
        text = " ".join([f.name, *t.values()])
        bird = next((b for sci, b in by_sci.items() if sci in text.lower()), None)
        if not bird:
            problems.append(f"{f.name}: couldn't tell which bird it is")
            continue
        m = XC_RE.search(text)
        if not m:
            problems.append(f"{f.name}: no XC number in its name or tags")
            continue
        xc = "XC" + m.group(1)
        # xeno-canto doesn't put the license inside the file, so read it from the recording's page.
        page = xc_page(xc)
        lic = page.get("license") or license_from_text(text)
        # The page is the authority; file tags can hold a recorder's default like "My Recording".
        recordist = page.get("recordist") or t.get("artist") or "Unknown"
        if not lic or not base_license(lic):
            problems.append(f"{f.name}: license {lic or 'unknown'} not allowed (need CC0, CC BY or CC BY-SA)")
            continue
        bid = bird["id"]
        make_files(f, bid)
        recs[bid] = {
            "alarmFile": f"{bid}.caf", "playbackFile": f"{bid}.m4a",
            "recordist": recordist, "license": base_license(lic), "licenseFull": lic,
            "xcNumber": xc, "sourceUrl": f"https://xeno-canto.org/{xc[2:]}", "commonsUrl": "",
        }
        print(f"ok   {bid:28} {xc:10} {lic:14} {recs[bid]['recordist'][:30]}")
    return problems


def main() -> int:
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        print("ffmpeg/ffprobe not found on PATH")
        return 1
    force = "--force" in sys.argv
    library = json.loads(LIBRARY.read_text(encoding="utf-8"))
    for d in (CACHE, SOUNDS, AUDIO):
        d.mkdir(parents=True, exist_ok=True)
    recs = json.loads(RECORDINGS.read_text(encoding="utf-8")) if RECORDINGS.exists() and not force else {}
    missing: list[str] = []
    blocked_in_a_row = 0

    if "--from-folder" in sys.argv:
        folder = Path(sys.argv[sys.argv.index("--from-folder") + 1])
        missing += from_folder(folder, library, recs)
        library_todo: list[dict] = []
    else:
        library_todo = library

    for b in library_todo:
        bid = b["id"]
        done = bid in recs and (SOUNDS / f"{bid}.caf").exists() and (AUDIO / f"{bid}.m4a").exists()
        if done:
            continue
        try:
            found = [c for c in infos(candidates(b["scientificName"])) if base_license(c["license"])]
            if not found:
                missing.append(f"{bid}: no xeno-canto recording with an allowed license on Commons")
                continue
            best = max(found, key=score)
            ext = Path(urllib.parse.urlparse(best["url"]).path).suffix.lower() or ".mp3"
            src = CACHE / f"{bid}{ext}"
            if not src.exists():
                src.write_bytes(download(best["url"], best["xc"]))
            blocked_in_a_row = 0
            make_files(src, bid)
            recs[bid] = {
                "alarmFile": f"{bid}.caf",
                "playbackFile": f"{bid}.m4a",
                "recordist": best["artist"] or "Unknown",
                "license": base_license(best["license"]),
                "licenseFull": best["license"],
                "xcNumber": best["xc"],
                "sourceUrl": f"https://xeno-canto.org/{best['xc'][2:]}",
                "commonsUrl": best["page"],
            }
            print(f"ok   {bid:28} {best['xc']:9} {best['license']:13} {best['duration']:5.0f}s  {best['artist'][:30]}")
            time.sleep(4)  # be gentle with Wikimedia's file servers
        except RateLimited as e:
            missing.append(f"{bid}: {e}")
            blocked_in_a_row += 1
            if blocked_in_a_row >= 3:
                missing.append("Stopped: downloads are being rate-limited. Run again later; it resumes.")
                break
        except Exception as e:
            missing.append(f"{bid}: {e}")

    order = [b["id"] for b in library]
    recs = {k: recs[k] for k in order if k in recs}
    RECORDINGS.write_text(json.dumps(recs, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    lines = ["// Generated by pipeline/fetch_audio.py. Do not edit by hand.",
             "export const AUDIO_FILES: Record<string, number> = {"]
    lines += [f"  '{k}': require('../../assets/audio/{k}.m4a')," for k in recs]
    lines.append("};")
    INDEX.write_text("\n".join(lines) + "\n", encoding="utf-8")

    # Root birds.json: the shared Bird type (see shared/src/types.ts), one entry per recording.
    full = []
    for b in library:
        r = recs.get(b["id"])
        if not r:
            continue
        full.append({
            "id": b["id"], "commonName": b["commonName"], "scientificName": b["scientificName"],
            "regions": b["regions"], "fact": b["fact"],
            "alarmFile": r["alarmFile"], "playbackFile": r["playbackFile"],
            "recordist": r["recordist"], "license": r["license"],
            "xcNumber": r["xcNumber"], "sourceUrl": r["sourceUrl"],
        })
    ROOT_BIRDS.write_text(json.dumps(full, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    rows = [f"| {b['commonName']} | {recs[b['id']]['recordist']} | {recs[b['id']]['licenseFull']} | "
            f"[{recs[b['id']]['xcNumber']}]({recs[b['id']]['sourceUrl']}) |" for b in library if b["id"] in recs]
    CREDITS_MD.write_text(
        "# Credits\n\n"
        "Bird recordings come from [xeno-canto](https://xeno-canto.org), via the copies on Wikimedia Commons. "
        "Each recording keeps the Creative Commons license its recordist chose; only CC0, CC BY and CC BY-SA are used. "
        "The app trims, fades and normalizes the loudness of each one. This file is generated by "
        "`pipeline/fetch_audio.py`.\n\n"
        "Bird photos come from Wikimedia Commons; their credits are in `app/src/data/photos.json` and "
        "`app/src/data/lookalike-photos.json`, and on the app's Credits screen.\n\n"
        "| Bird | Recordist | License | xeno-canto |\n|---|---|---|---|\n" + "\n".join(rows) + "\n",
        encoding="utf-8")

    print(f"\n{len(recs)}/{len(library)} birds have recordings")
    for m in missing:
        print("MISSING", m)
    return 0


if __name__ == "__main__":
    sys.exit(main())
