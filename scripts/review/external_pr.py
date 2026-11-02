#!/usr/bin/env python3
"""外からの PR かを判定し、対象なら案内をコメントして閉じる（CONTRIBUTING.md）。

  external_pr.py --pr <番号> [--repo <OWNER/REPO>]

フォークからの PR は常に閉じる。同じリポジトリのブランチからの PR は、
Bot（Jules や workflow など）または書き込みの権限がある人（非公開の組織メンバーを含む）なら通し、
書き込みの権限がない人の PR は閉じる。
"""
from __future__ import annotations

import argparse
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import github as gh  # noqa: E402


def should_close(repo: str, pr: dict, cache: dict | None = None) -> bool:
    """PR を外からのものとして閉じるべきかを返す。"""
    head_repo = ((pr.get("head") or {}).get("repo") or {}).get("full_name")
    if (head_repo or "").lower() != repo.lower():
        return True
    if (pr.get("user") or {}).get("type") == "Bot":
        return False
    return not gh.is_trusted(repo, pr, cache if cache is not None else {})


def comment_body(repo: str, pr: dict) -> str:
    """外からの PR に付ける案内のコメント本文を作る。"""
    head = pr.get("head") or {}
    head_repo = head.get("repo") or {}
    ref = head.get("ref") or ""
    is_fork = (head_repo.get("full_name") or "").lower() != repo.lower()
    branch_note = (
        f"（フォークのブランチ {head_repo['html_url']}/tree/{ref} はそのまま残ります）"
        if is_fork and head_repo.get("html_url") and ref
        else ""
    )
    return (
        f"ありがとうございます。このリポジトリは外からの Pull Request を受け付けていないため、"
        f"この PR は閉じます{branch_note}。\n\n"
        f"変更は、Issue のテンプレート「フォークでの変更のお知らせ」で知らせてください。"
        f"こちらで読んで、取り込む場合はこちらのブランチで実装します。"
        f"詳しくは [CONTRIBUTING.md](https://github.com/{repo}/blob/main/CONTRIBUTING.md)。\n\n"
        f"Thank you. This repository does not accept pull requests from outside contributors, "
        f"so this PR will be closed (your branch stays as is). Please let us know about your change "
        f'by opening an issue with the "フォークでの変更のお知らせ" (fork change) template. See CONTRIBUTING.md.'
    )


def run_pr(repo: str, number: int) -> bool:
    """GitHub から PR を読んで判定し、対象なら案内して閉じる。閉じたら True を返す。"""
    pr = gh.get(f"/repos/{repo}/pulls/{number}")
    if pr.get("state") != "open":
        return False
    if not should_close(repo, pr):
        return False
    gh.post(f"/repos/{repo}/issues/{number}/comments", {"body": comment_body(repo, pr)})
    gh.patch(f"/repos/{repo}/pulls/{number}", {"state": "closed"})
    return True


def main() -> None:
    """CLI の入口。"""
    ap = argparse.ArgumentParser()
    ap.add_argument("--pr", type=int, required=True)
    ap.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY"))
    a = ap.parse_args()
    if not a.repo:
        ap.error("--repo または GITHUB_REPOSITORY が必要です")
    closed = run_pr(a.repo, a.pr)
    print(f"PR #{a.pr}：{'案内して閉じた' if closed else '関係者の PR なので閉じない'}")


if __name__ == "__main__":
    main()
