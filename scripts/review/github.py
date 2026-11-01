"""GitHub の REST API（GITHUB_TOKEN）。urllib だけで書く。"""
from __future__ import annotations

import json
import os
import urllib.request

API = os.environ.get("GITHUB_API_URL", "https://api.github.com")


def _req(method, path, body=None):
    url = path if path.startswith("http") else f"{API}{path}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", f"Bearer {os.environ['GITHUB_TOKEN']}")
    r.add_header("Accept", "application/vnd.github+json")
    r.add_header("X-GitHub-Api-Version", "2022-11-28")
    if data:
        r.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(r) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else None, resp.headers


def get(path):
    return _req("GET", path)[0]


def paged(path):
    out, url = [], f"{API}{path}{'&' if '?' in path else '?'}per_page=100"
    while url:
        data, h = _req("GET", url)
        out.extend(data)
        nxt = [p for p in h.get("Link", "").split(",") if 'rel="next"' in p]
        url = nxt[0].split(";")[0].strip()[1:-1] if nxt else None
    return out


def post(path, body):
    return _req("POST", path, body)[0]


def patch(path, body):
    return _req("PATCH", path, body)[0]


def delete(path):
    try:
        return _req("DELETE", path)[0]
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise
