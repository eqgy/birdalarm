"""Tests for check_birds.py. Run: python -m unittest discover pipeline/tests
The birds here are made-up test data, not real recordings."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from check_birds import check  # noqa: E402


def bird(**over):
    b = {
        "id": "test-bird",
        "commonName": "Test Bird",
        "scientificName": "Testus birdus",
        "regions": ["north-america"],
        "fact": "Not a real bird.",
        "alarmFile": "test-bird.caf",
        "playbackFile": "test-bird.m4a",
        "recordist": "Test Recordist",
        "license": "CC BY",
        "xcNumber": "XC1",
        "sourceUrl": "https://xeno-canto.org/1",
    }
    b.update(over)
    return b


class CheckBirds(unittest.TestCase):
    def test_good_entry_passes(self):
        self.assertEqual(check([bird()]), [])

    def test_allowed_licenses(self):
        for lic in ("CC0", "CC BY", "CC BY-SA"):
            self.assertEqual(check([bird(license=lic)]), [], lic)

    def test_disallowed_licenses(self):
        for lic in ("CC BY-NC", "CC BY-NC-SA", "CC BY-ND", "CC BY-NC-ND"):
            self.assertTrue(check([bird(license=lic)]), lic)

    def test_missing_attribution(self):
        for key in ("recordist", "xcNumber", "license", "sourceUrl"):
            self.assertTrue(any(f"missing {key}" in p for p in check([bird(**{key: ""})])), key)

    def test_duplicates(self):
        probs = check([bird(), bird()])
        self.assertTrue(any("duplicate id" in p for p in probs))
        self.assertTrue(any("duplicate alarmFile" in p for p in probs))

    def test_bad_alarm_filename(self):
        self.assertTrue(check([bird(alarmFile="Test Bird.caf")]))
        self.assertTrue(check([bird(alarmFile="test-bird.m4a")]))

    def test_source_url_must_match_xc(self):
        self.assertTrue(check([bird(sourceUrl="https://xeno-canto.org/999")]))


if __name__ == "__main__":
    unittest.main()
