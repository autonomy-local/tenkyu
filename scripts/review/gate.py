#!/usr/bin/env python3
"""段階に応じたレビューがそろったかを判定し、コミットのステータス `review-gate` を付ける。

  gate.py --pr <番号>          GitHub から集めて判定し、ステータスを付ける（CI 用）
  （判定そのものは evaluate()。tests/ から GitHub なしで確かめる）

critical：AI の承認（ai_reviewer が coderabbit のとき）＋ CODEOWNER の総括コメント
          ＋（require_line_comment_per_file）当たった各ファイルに CODEOWNER の行コメント
standard：AI の承認。ai_reviewer が none なら、または AI が止まっていれば、CODEOWNER の総括コメントで代える
light   ：なし

人のコメントは、critical のファイルを最後に変えたコミット以降のものだけを数える（後から critical を変えたら付け直し）。
"""
from __future__ import annotations

import argparse
import os
import pathlib
import sys
from dataclasses import dataclass

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import risk  # noqa: E402

AI_LOGINS = {"coderabbit": "coderabbitai[bot]"}
# 公開リポジトリでは誰でもコメントできるので、チームが担当のときは関係者だけを数える。
# 組織のメンバーシップが非公開の人は、GITHUB_TOKEN からは関係者に見えないことがある
TRUSTED = {"OWNER", "MEMBER", "COLLABORATOR"}


@dataclass
class Review:
    """PR のレビュー1件。"""
    user: str
    is_bot: bool
    state: str  # APPROVED / COMMENTED / CHANGES_REQUESTED / DISMISSED
    body: str
    commit_id: str
    trusted: bool = True  # author_association が関係者か


@dataclass
class LineComment:
    """PR の行コメント1件。"""
    user: str
    is_bot: bool
    path: str
    commit_id: str  # original_commit_id
    trusted: bool = True  # author_association が関係者か


def evaluate(conf, result, *, head, commits, commit_files, reviews, comments, codeowners, toured, author=None, escalated=False):
    """(ok: bool, 説明の行のリスト) を返す。commits は古い順の sha。"""
    s = conf.get("settings", {})
    tier = "critical" if escalated else result.tier
    lines = [f"段階：**{tier}**"]
    if tier == "light":
        return True, lines + ["レビューは不要"]

    ai = s.get("ai_reviewer", "none")
    ai_login = AI_LOGINS.get(ai)
    ai_ok = bool(ai_login) and any(
        r.user == ai_login and r.state == "APPROVED" and r.commit_id == head for r in reviews
    )

    crit = list(result.critical_files)
    if escalated and not crit:
        crit = list(result.files)  # 手で上げたときは、全部のファイルを critical として扱う

    # 人のコメントを数え始めるコミット
    pos = {sha: i for i, sha in enumerate(commits)}
    cutoff = 0
    for i, sha in enumerate(commits):
        if set(commit_files.get(sha, [])) & set(crit or result.files):
            cutoff = i

    def fresh(commit_id):
        """そのコミットが、最後に critical のファイルを変えたコミット以降かを返す。"""
        return commit_id in pos and pos[commit_id] >= cutoff

    def owners(f):
        """ファイルの担当（CODEOWNERS）を返す。"""
        return risk.owners_of(codeowners, f)

    def can_review(user, f, trusted=True):
        """その人のレビューを、そのファイルの担当のものとして数えてよいかを返す。"""
        os_ = owners(f)
        if not os_:
            return False
        if user.lower() not in os_ and not (trusted and any("/" in o for o in os_)):
            return False  # チーム（org/team）が担当なら、bot 以外の関係者を数える
        if s.get("reviewer_must_have_toured"):
            areas = result.area_of(f)
            people = {p["login"].lower() for a in areas for p in (toured.get(a) or [])}
            if areas and user.lower() not in people:
                return False
        return True

    targets = crit or list(result.files)
    summary_ok = any(
        not r.is_bot and r.body.strip() and r.state in ("COMMENTED", "APPROVED") and fresh(r.commit_id)
        and any(can_review(r.user, f, r.trusted) for f in targets)
        for r in reviews
    )

    if tier == "standard":
        if ai_login:
            if ai_ok:
                return True, lines + [f"AI のレビュー（{ai_login}）が最新のコミットを承認した"]
            if summary_ok:
                return True, lines + ["AI の承認はないが、CODEOWNER の総括コメントで代えた"]
            return False, lines + [f"AI のレビュー（{ai_login}）の承認を待っている（CODEOWNER の総括コメントでも代えられる）"]
        if summary_ok:
            return True, lines + ["CODEOWNER の総括コメントがある"]
        return False, lines + ["CODEOWNER の総括コメントを待っている"]

    # critical
    ok = True
    if ai_login:
        lines.append(("✓" if ai_ok else "✗") + f" AI のレビュー（{ai_login}）の承認")
        ok &= ai_ok
    lines.append(("✓" if summary_ok else "✗") + " CODEOWNER の総括コメント（最新の critical の変更より後）")
    ok &= summary_ok
    if s.get("require_line_comment_per_file", True):
        for f in targets:
            if not owners(f):
                lines.append(f"✗ `{f}`：CODEOWNERS に担当がいない")
                ok = False
                continue
            hit = any(not c.is_bot and c.path == f and fresh(c.commit_id) and can_review(c.user, f, c.trusted) for c in comments)
            lines.append(("✓" if hit else "✗") + f" `{f}` に CODEOWNER の行コメント")
            ok &= hit
    return ok, lines


# ── GitHub から集める ─────────────────────────────────────────

def collect(repo, number):
    """判定に要る PR の情報を GitHub から集める。関係者以外の人のレビューは落とす。"""
    import github as gh

    pr = gh.get(f"/repos/{repo}/pulls/{number}")
    files = gh.paged(f"/repos/{repo}/pulls/{number}/files")
    changes = [risk.FileChange(f["filename"], f["status"], f["additions"], f["deletions"], f.get("patch", ""), f.get("previous_filename", "")) for f in files]
    commits = [c["sha"] for c in gh.paged(f"/repos/{repo}/pulls/{number}/commits")]
    commit_files = {sha: [f["filename"] for f in gh.get(f"/repos/{repo}/commits/{sha}").get("files", [])] for sha in commits}
    reviews = [
        Review(r["user"]["login"], r["user"]["type"] == "Bot", r["state"], r.get("body") or "", r.get("commit_id") or "",
               r.get("author_association") in TRUSTED)
        for r in gh.paged(f"/repos/{repo}/pulls/{number}/reviews")
        if r.get("user")
    ]
    comments = [
        LineComment(c["user"]["login"], c["user"]["type"] == "Bot", c["path"], c.get("original_commit_id") or "",
                    c.get("author_association") in TRUSTED)
        for c in gh.paged(f"/repos/{repo}/pulls/{number}/comments")
        if c.get("user")
    ]
    return pr, changes, commits, commit_files, reviews, comments


def main():
    """判定を実行し、コミットのステータス `review-gate` を付ける。"""
    ap = argparse.ArgumentParser()
    ap.add_argument("--pr", type=int, required=True)
    ap.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY"))
    ap.add_argument("--root", default=".", help="判定に使う設定（base の側）の置き場所")
    a = ap.parse_args()

    import github as gh

    root = pathlib.Path(a.root)
    conf = risk.load(root / ".github/settings/risk.yml")
    codeowners = risk.parse_codeowners((root / ".github/CODEOWNERS").read_text(encoding="utf-8"))
    own = root / ".github/settings/ownership.yml"
    toured = (risk.load(own) or {}).get("toured") or {} if own.exists() else {}

    pr, changes, commits, commit_files, reviews, comments = collect(a.repo, a.pr)
    head = pr["head"]["sha"]
    labels = {l["name"] for l in pr.get("labels", [])}
    result = risk.classify(conf, changes, pr.get("body") or "")
    ok, lines = evaluate(
        conf, result, head=head, commits=commits, commit_files=commit_files, reviews=reviews,
        comments=comments, codeowners=codeowners, toured=toured, author=pr["user"]["login"],
        escalated="review:escalate" in labels,
    )
    if len(changes) < pr.get("changed_files", 0):  # API の上限で一覧が切れた
        ok = False
        lines.append("✗ 変更の一覧を全部は取得できなかった")
    print("\n".join(lines))
    desc = lines[0].replace("*", "") + "：" + ("そろった" if ok else "；".join(l for l in lines[1:] if l.startswith("✗") or "待って" in l)[:100])
    gh.post(f"/repos/{a.repo}/statuses/{head}", {
        "state": "success" if ok else "pending",
        "context": "review-gate",
        "description": desc[:140],
        "target_url": pr["html_url"],
    })


if __name__ == "__main__":
    main()
