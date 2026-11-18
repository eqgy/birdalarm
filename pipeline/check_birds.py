"""Fail if any bird in birds.json is missing attribution or uses a disallowed license.

Usage: python pipeline/check_birds.py [path/to/birds.json] [--audio-dir audio]
Exit code 0 = OK, 1 = problems found (printed one per line). Run in CI.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ALLOWED_LICENSES = {"CC0", "CC BY", "CC BY-SA"}
REQUIRED = [
    "id", "commonName", "scientificName", "regions", "fact",
    "alarmFile", "playbackFile", "recordist", "license", "xcNumber", "sourceUrl",
]
XC_RE = re.compile(r"^XC\d+$")
ID_RE = re.compile(r"^[a-z0-9-]+$")


def check(birds: list[dict], audio_dir: Path | None = None) -> list[str]:
    problems: list[str] = []
    seen_ids: set[str] = set()
    seen_files: set[str] = set()

    for i, b in enumerate(birds):
        where = f"bird[{i}] {b.get('id', '?')}"
        for key in REQUIRED:
            v = b.get(key)
            if v is None or v == "" or v == []:
                problems.append(f"{where}: missing {key}")

        lic = b.get("license")
        if lic and lic not in ALLOWED_LICENSES:
            problems.append(f"{where}: license {lic!r} not allowed (use CC0, CC BY or CC BY-SA)")

        xc = b.get("xcNumber")
        if xc and not XC_RE.match(xc):
            problems.append(f"{where}: xcNumber {xc!r} should look like XC123456")
        url = b.get("sourceUrl")
        if xc and url and xc[2:] not in url:
            problems.append(f"{where}: sourceUrl does not mention {xc}")

        bid = b.get("id")
        if bid:
            if not ID_RE.match(bid):
                problems.append(f"{where}: id must be lowercase letters, digits, dashes")
            if bid in seen_ids:
                problems.append(f"{where}: duplicate id")
            seen_ids.add(bid)

        alarm = b.get("alarmFile")
        if alarm:
            # AlarmKit matches the exact string, so keep names plain and unique.
            if not alarm.endswith(".caf") or "/" in alarm or " " in alarm:
                problems.append(f"{where}: alarmFile must be a plain name ending in .caf")
            if alarm in seen_files:
                problems.append(f"{where}: duplicate alarmFile")
            seen_files.add(alarm)

        if audio_dir:
            for key in ("alarmFile", "playbackFile"):
                name = b.get(key)
                if name and not (audio_dir / name).is_file():
                    problems.append(f"{where}: {key} {name} not found in {audio_dir}")

    return problems


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("birds_json", nargs="?", default="birds.json")
    p.add_argument("--audio-dir", type=Path)
    args = p.parse_args(argv)

    data = json.loads(Path(args.birds_json).read_text(encoding="utf-8"))
    if not isinstance(data, list):
        print("birds.json must be a JSON array")
        return 1
    problems = check(data, args.audio_dir)
    for line in problems:
        print(line)
    print(f"{len(data)} birds checked, {len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
