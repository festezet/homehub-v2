#!/usr/bin/env python3
"""Refresh all configured WhatsApp threads — fetch fresh messages from
Evolution API and store them in the local DB.

Designed to run as a daily cron job.
Usage: python3 refresh_threads.py [--quiet]
"""

import argparse
import json
import sys
import urllib.request
import urllib.error

HH_BASE = "http://localhost:5000"


def fetch_json(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def main():
    parser = argparse.ArgumentParser(
        description="Refresh WhatsApp thread messages via HomeHub API")
    parser.add_argument("--quiet", action="store_true",
                        help="Only print errors")
    args = parser.parse_args()

    log = (lambda *a: None) if args.quiet else print

    # 1. Get configured threads
    try:
        data = fetch_json(f"{HH_BASE}/api/threads")
    except urllib.error.URLError as e:
        print(f"ERROR: HomeHub unreachable ({e})", file=sys.stderr)
        sys.exit(1)

    threads = data.get("threads", [])
    wa_threads = [t for t in threads
                  if t.get("platform") == "whatsapp" and t.get("enabled")]

    log(f"Found {len(wa_threads)} enabled WhatsApp threads")

    # 2. Fetch messages for each thread (triggers proxy fetch + DB store)
    ok, fail = 0, 0
    for t in wa_threads:
        tid = t["id"]
        name = t.get("name", "?")
        try:
            resp = fetch_json(
                f"{HH_BASE}/api/threads/{tid}/messages?limit=200")
            stored = resp.get("total_stored", "?")
            fetched = resp.get("fetched_from_proxy", "?")
            log(f"  [{tid}] {name}: fetched={fetched}, total_stored={stored}")
            ok += 1
        except Exception as e:
            print(f"  [{tid}] {name}: FAILED ({e})", file=sys.stderr)
            fail += 1

    # 3. Refresh all-chats cache (so Historique tab is warm)
    try:
        resp = fetch_json(f"{HH_BASE}/api/threads/all-chats")
        log(f"All-chats cache refreshed: {resp.get('count', '?')} chats")
    except Exception as e:
        print(f"All-chats cache refresh failed: {e}", file=sys.stderr)

    log(f"Done: {ok} OK, {fail} failed")
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
