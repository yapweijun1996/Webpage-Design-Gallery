"""Verify the curated GJH library's bytes, source receipts and path boundaries."""

import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
LIBRARY = ROOT / "assets/companies/gjh/official"
ALLOWED_HOSTS = {"gjh.com.sg", "www.gjh.com.sg", "gjhglobal.com", "www.gjhglobal.com", "gjheshop.com", "www.gjheshop.com"}


def verify():
    manifest = json.loads((LIBRARY / "manifest.json").read_text(encoding="utf-8"))
    assets = manifest["assets"]
    assert len({asset["id"] for asset in assets}) == len(assets), "Duplicate asset IDs"
    for asset in assets:
        file = (ROOT / asset["path"]).resolve()
        assert file.is_relative_to(LIBRARY.resolve()), f"Asset path escapes library: {asset['id']}"
        data = file.read_bytes()
        assert hashlib.sha256(data).hexdigest() == asset["sha256"], f"Hash mismatch: {asset['id']}"
        assert len(data) == asset["bytes"], f"Size mismatch: {asset['id']}"
        assert asset["sourceStatus"] == "verified_official_source", asset["id"]
        assert asset["pageContextVerified"] is True, f"No page context: {asset['id']}"
        assert asset["httpStatus"] == 200, asset["id"]
        for key in ("sourceUrl", "sourcePage", "finalUrl"):
            url = urlparse(asset[key])
            assert url.scheme == "https" and url.hostname in ALLOWED_HOSTS, asset["id"]
        if file.suffix == ".svg":
            tree = ET.fromstring(data)
            assert not any(node.tag.rsplit("}", 1)[-1] == "script" or any(key.lower().startswith("on") for key in node.attrib) for node in tree.iter()), "Active SVG content"
    assert not manifest["collectionErrors"], "Unresolved collection errors"
    print(f"PASS: {len(assets)} source-verified assets; SHA-256, sizes, official hosts and page-context receipts checked.")
    print("This is an offline integrity check of the recorded capture, not a new network or brand-approval check.")


if __name__ == "__main__":
    verify()
