"""GitHub の REST API（GITHUB_TOKEN）。urllib だけで書く。"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request

API = os.environ.get("GITHUB_API_URL", "https://api.github.com")


def _req(method, path, body=None):
    """API を呼び、(本文の JSON, ヘッダー) を返す。"""
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
    """GET して本文を返す。"""
    return _req("GET", path)[0]


def paged(path):
    """GET を Link ヘッダーの続きまでたどり、全件を返す。"""
    out, url = [], f"{API}{path}{'&' if '?' in path else '?'}per_page=100"
    while url:
        data, h = _req("GET", url)
        out.extend(data)
        nxt = [p for p in h.get("Link", "").split(",") if 'rel="next"' in p]
        url = nxt[0].split(";")[0].strip()[1:-1] if nxt else None
    return out


def post(path, body):
    """POST して本文を返す。"""
    return _req("POST", path, body)[0]


def patch(path, body):
    """PATCH して本文を返す。"""
    return _req("PATCH", path, body)[0]


def delete(path):
    """DELETE して本文を返す。すでに無いとき（404）は無視する。"""
    try:
        return _req("DELETE", path)[0]
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise


# 公開リポジトリでは誰でもコメントや PR を出せるので、関係者を確かめる。
# 組織のメンバーシップが非公開の人は、GITHUB_TOKEN からは author_association で関係者に見えないことがある。
# そのときはリポジトリへの権限で確かめる（ログイン名を別の人が取得しても、権限がなければ通さない）。
TRUSTED = {"OWNER", "MEMBER", "COLLABORATOR"}
WRITE = {"admin", "maintain", "write"}


def is_trusted(repo: str, item: dict, cache: dict) -> bool:
    """PR・レビュー・コメントの作成者が、書き込み権限を持つ人間の関係者かを返す。"""
    user = item.get("user") or {}
    if user.get("type") == "Bot":
        return False
    if item.get("author_association") in TRUSTED:
        return True
    login = user.get("login")
    if not login:
        return False
    if login not in cache:
        quoted = urllib.parse.quote(login, safe="")
        try:
            perm = (get(f"/repos/{repo}/collaborators/{quoted}/permission") or {}).get("permission")
            cache[login] = perm in WRITE
        except urllib.error.HTTPError:
            cache[login] = False
    return cache[login]
