#!/usr/bin/env python3
"""Point hellocara.ie DNS at Vercel (apex, www, app).

Requires CLOUDFLARE_API_TOKEN with Zone DNS Edit on hellocara.ie.
Loads from .env.local when run from repo root.

The hellocara zone must be active on Cloudflare (nameservers at the
registrar must be khloe.ns.cloudflare.com + matteo.ns.cloudflare.com).
If the zone is still pending, update nameservers at webhostingireland.ie
first, or set the same A/CNAME records in the WHI DNS panel instead.
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ZONE_ID = "a59e5b8612d96e1d94c2ee2897cd9faf"
VERCEL_A = "76.76.21.21"
VERCEL_WWW_CNAME = "cname.vercel-dns.com"
BASE = "https://api.cloudflare.com/client/v4"

TARGETS = [
    ("A", "hellocara.ie", VERCEL_A, True),
    ("A", "app.hellocara.ie", VERCEL_A, True),
    ("CNAME", "www.hellocara.ie", VERCEL_WWW_CNAME, True),
]


def load_token() -> str:
    if os.environ.get("CLOUDFLARE_API_TOKEN", "").strip():
        return os.environ["CLOUDFLARE_API_TOKEN"].strip()
    env_local = Path(__file__).resolve().parents[1] / ".env.local"
    text = env_local.read_text()
    match = re.search(r"^CLOUDFLARE_API_TOKEN=(.+)$", text, re.M)
    if not match:
        raise SystemExit("CLOUDFLARE_API_TOKEN not set")
    return match.group(1).strip().strip('"').strip("'")


def api(token: str, method: str, path: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            raise SystemExit(f"HTTP {e.code} for {path}") from e


def main() -> None:
    token = load_token()
    zone = api(token, "GET", f"/zones/{ZONE_ID}")
    if not zone.get("success"):
        raise SystemExit(f"Cannot read zone: {zone.get('errors')}")

    result = zone["result"]
    print(f"Zone: {result['name']} status={result['status']}")
    if result["status"] != "active":
        print(
            "WARNING: zone is not active. Set registrar NS to:",
            ", ".join(result.get("name_servers") or []),
        )

    listed = api(token, "GET", f"/zones/{ZONE_ID}/dns_records?per_page=200")
    if not listed.get("success"):
        raise SystemExit(
            "Cannot list DNS records — token needs Zone DNS Read/Edit. "
            f"Error: {listed.get('errors')}"
        )

    by_name_type: dict[tuple[str, str], dict] = {}
    for rec in listed["result"]:
        by_name_type[(rec["name"], rec["type"])] = rec

    for rtype, name, content, proxied in TARGETS:
        key = (name, rtype)
        payload = {
            "type": rtype,
            "name": name,
            "content": content,
            "proxied": proxied,
        }
        if rtype == "CNAME":
            payload["proxied"] = proxied

        existing = by_name_type.get(key)
        if existing and existing.get("content") == content and existing.get("proxied") == proxied:
            print(f"OK   {rtype} {name} -> {content}")
            continue

        if existing:
            resp = api(
                token,
                "PUT",
                f"/zones/{ZONE_ID}/dns_records/{existing['id']}",
                payload,
            )
            action = "updated"
        else:
            resp = api(token, "POST", f"/zones/{ZONE_ID}/dns_records", payload)
            action = "created"

        if not resp.get("success"):
            raise SystemExit(f"Failed {action} {rtype} {name}: {resp.get('errors')}")
        print(f"OK   {rtype} {name} -> {content} ({action})")

    print("Done. Verify with: dig +short hellocara.ie A && dig +short app.hellocara.ie A")


if __name__ == "__main__":
    main()
