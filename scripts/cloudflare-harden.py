#!/usr/bin/env python3
"""Cliste Cloudflare hardening — idempotent re-apply.

Creates (or updates) an account IP list with Stripe's current webhook source
IPs, pushes the zone WAF custom rules, and refreshes the single rate-limit
rule the free plan allows. Running it again just picks up any Stripe IP
additions and leaves the rest untouched.

Requires these env vars (load from your local ~/.zshrc or .env.local — never
paste tokens in chat):

  CLOUDFLARE_API_TOKEN   scoped token, see README
  CLOUDFLARE_ACCOUNT_ID  cf account id
  CF_ZONE_ID             zone id for clistesystems.ie (or whichever)

Usage:
  python3 scripts/cloudflare-harden.py
"""
from __future__ import annotations

import json
import os
import sys
import ssl
import urllib.error
import urllib.request

TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]
ACCT = os.environ["CLOUDFLARE_ACCOUNT_ID"]
ZONE = os.environ["CF_ZONE_ID"]
BASE = "https://api.cloudflare.com/client/v4"


def req(method: str, path: str, body=None, base=BASE) -> dict:
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(base + path, data=data, method=method)
    r.add_header("Authorization", f"Bearer {TOKEN}")
    r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"success": False, "errors": [{"message": str(e)}]}


def must(label: str, resp: dict) -> dict:
    if resp.get("success"):
        print(f"OK   {label}")
        return resp
    print(f"FAIL {label}: {resp.get('errors') or resp}")
    return resp


# ------------------------------------------------------------------ IP list
def fetch_stripe_ips() -> list[str]:
    ctx = ssl.create_default_context()
    r = urllib.request.Request("https://stripe.com/files/ips/ips_webhooks.json")
    with urllib.request.urlopen(r, timeout=30, context=ctx) as resp:
        d = json.loads(resp.read())
    return d.get("WEBHOOKS") or d


def find_list_by_name(name: str) -> dict | None:
    r = req("GET", f"/accounts/{ACCT}/rules/lists")
    if not r.get("success"):
        return None
    for lst in r["result"]:
        if lst.get("name") == name:
            return lst
    return None


def ensure_stripe_ip_list() -> str | None:
    """Return list id or None on failure."""
    ips = fetch_stripe_ips()
    print(f"stripe webhook source IPs fetched: {len(ips)}")

    name = "cliste_stripe_webhook_ips"
    existing = find_list_by_name(name)
    if existing is None:
        r = must(
            "create IP list cliste_stripe_webhook_ips",
            req("POST", f"/accounts/{ACCT}/rules/lists", {
                "name": name,
                "description": "Stripe webhook source IPs (from stripe.com/files/ips)",
                "kind": "ip",
            }),
        )
        if not r.get("success"):
            return None
        list_id = r["result"]["id"]
    else:
        list_id = existing["id"]
        print(f"OK   IP list cliste_stripe_webhook_ips already exists id={list_id}")

    # Replace list contents with the current Stripe IPs
    items = [{"ip": ip, "comment": "stripe webhook"} for ip in ips]
    must(
        "replace Stripe IP list items",
        req("PUT", f"/accounts/{ACCT}/rules/lists/{list_id}/items", items),
    )
    return list_id


# ------------------------------------------------------------------ WAF custom
def ensure_custom_ruleset_exists() -> str:
    """Return ruleset id for the zone's http_request_firewall_custom entrypoint."""
    # Get entrypoint ruleset
    r = req("GET", f"/zones/{ZONE}/rulesets/phases/http_request_firewall_custom/entrypoint")
    if r.get("success"):
        return r["result"]["id"]
    # Create it if missing
    r = req("PUT", f"/zones/{ZONE}/rulesets/phases/http_request_firewall_custom/entrypoint", {
        "rules": [],
        "description": "Cliste hardening custom rules"
    })
    if not r.get("success"):
        # Fallback: POST create
        r = req("POST", f"/zones/{ZONE}/rulesets", {
            "name": "default",
            "kind": "zone",
            "phase": "http_request_firewall_custom",
            "rules": [],
        })
    must("ensure custom rules ruleset", r)
    return r["result"]["id"]


def push_custom_rules(list_id: str | None) -> None:
    stripe_clause = f" and not (ip.src in $cliste_stripe_webhook_ips)" if list_id else ""
    rules = []

    # Rule 1: Stripe webhook IP allowlist (only if we created the list)
    if list_id:
        rules.append({
            "description": "Block /api/stripe/webhook from non-Stripe IPs",
            "action": "block",
            "enabled": True,
            "expression": (
                '(http.request.uri.path eq "/api/stripe/webhook")'
                + stripe_clause
            ),
        })

    # Rule 2: Managed challenge for admin/dashboard from outside IE/GB
    rules.append({
        "description": "Managed Challenge on admin/dashboard from outside IE/GB",
        "action": "managed_challenge",
        "enabled": True,
        "expression": (
            '(starts_with(http.request.uri.path, "/admin") or '
            'starts_with(http.request.uri.path, "/dashboard"))'
            ' and not (ip.geoip.country in {"IE" "GB"})'
        ),
    })

    # Rule 3: Block unusual HTTP methods
    rules.append({
        "description": "Block unusual HTTP methods",
        "action": "block",
        "enabled": True,
        "expression": (
            'not (http.request.method in '
            '{"GET" "HEAD" "POST" "PUT" "PATCH" "DELETE" "OPTIONS"})'
        ),
    })

    # Rule 4: Block known AI/scraper user-agents (defence in depth vs robots.txt)
    bad_uas = [
        "GPTBot", "ClaudeBot", "anthropic-ai", "CCBot", "Google-Extended",
        "PerplexityBot", "Bytespider", "Amazonbot", "ImagesiftBot", "Omgili",
        "DataForSeoBot", "FacebookBot", "AhrefsBot", "SemrushBot",
    ]
    ua_expr = " or ".join(f'lower(http.user_agent) contains "{u.lower()}"' for u in bad_uas)
    rules.append({
        "description": "Block scraper + LLM-training bots by user-agent",
        "action": "block",
        "enabled": True,
        "expression": f"({ua_expr})",
    })

    # Rule 5: Managed challenge any request with no/empty user-agent hitting app paths
    rules.append({
        "description": "Challenge empty user-agent on admin/dashboard/auth paths",
        "action": "managed_challenge",
        "enabled": True,
        "expression": (
            '(http.user_agent eq "" or not any(http.request.headers.names[*] == "user-agent")) '
            'and (starts_with(http.request.uri.path, "/admin") or '
            'starts_with(http.request.uri.path, "/dashboard") or '
            'starts_with(http.request.uri.path, "/authenticate"))'
        ),
    })

    ruleset_id = ensure_custom_ruleset_exists()
    must(
        f"push {len(rules)} custom WAF rules",
        req("PUT", f"/zones/{ZONE}/rulesets/{ruleset_id}", {
            "rules": rules,
            "description": "Cliste hardening custom rules",
        }),
    )


# ------------------------------------------------------------------ rate limit
def push_rate_limit_rules() -> None:
    # Try to PUT into the rate-limit entrypoint ruleset directly
    # Free plan: only 1 rate-limit rule allowed. Pick the highest-value target:
    # brute-force of the password gates and the login endpoint. 10 POSTs in
    # 5 min per IP -> block 30 min. Legitimate users will never trip this.
    rules = [
        {
            "description": "Brute-force lockout for /admin-unlock, /dashboard-unlock, /authenticate",
            "action": "block",
            "action_parameters": {
                "response": {
                    "status_code": 429,
                    "content_type": "text/plain",
                    "content": "too many attempts, try again later",
                }
            },
            "enabled": True,
            "expression": (
                '(http.request.method eq "POST") and ('
                'http.request.uri.path in {"/admin-unlock" "/dashboard-unlock"} '
                'or starts_with(http.request.uri.path, "/authenticate")'
                ')'
            ),
            # Free plan limits: period = 10s, mitigation_timeout = 10s.
            # Catches rapid-fire credential-stuffing / scanning. The
            # substantive brute-force protection comes from the in-app
            # rate-limit module (auth-rate-limit.ts), which locks for
            # 15-30 minutes after a handful of failures.
            "ratelimit": {
                "characteristics": ["ip.src", "cf.colo.id"],
                "period": 10,
                "requests_per_period": 5,
                "mitigation_timeout": 10,
            },
        },
    ]

    r = req("PUT", f"/zones/{ZONE}/rulesets/phases/http_ratelimit/entrypoint", {
        "rules": rules,
        "description": "Cliste hardening rate-limit rules",
    })
    must("push rate-limit rules", r)


# ------------------------------------------------------------------ main
def main():
    print("== 1. ensure Stripe webhook IP list ==")
    list_id = ensure_stripe_ip_list()

    print("\n== 2. push WAF custom rules ==")
    push_custom_rules(list_id)

    print("\n== 3. push rate-limit rules ==")
    push_rate_limit_rules()


if __name__ == "__main__":
    main()
