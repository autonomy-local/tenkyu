#!/usr/bin/env python3
"""PR の変更の影響範囲と段階を出し、ラベルとコメントを付ける。light なら自動マージを入れる。

  impact.py --pr <番号> [--root <base の置き場所>]
  impact.py --files a.ts b.sql [--body-file pr.md]    手元で段階だけを見る（GitHub に触らない）
"""
from __future__ import annotations

import argparse
import os
import pathlib
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import risk  # noqa: E402

MARK = "<!-- review-impact -->"
LABELS = {t: f"review:{t}" for t in risk.TIERS}


def render(result, conf, codeowners):
    s = conf.get("settings", {})
    need = {
        "light": "レビュー不要" + ("（自動マージ）" if s.get("auto_merge_light") else ""),
        "standard": "AI のレビュー（" + s.get("ai_reviewer", "none") + "）の承認、または CODEOWNER の総括コメント",
        "critical": "AI の承認 ＋ CODEOWNER の総括コメント ＋ 下の各ファイルに CODEOWNER の行コメント",
    }[result.tier]
    out = [MARK, f"## 影響範囲：**{result.tier}**", "", f"求めるレビュー：{need}", ""]
    if result.reasons:
        out += ["### 理由", ""] + [f"- {r}" for r in dict.fromkeys(result.reasons)] + [""]
    if result.critical_files:
        out += ["### 読むファイル（critical）", "", "| ファイル | 領域 | 担当 |", "| --- | --- | --- |"]
        areas = {a["id"]: a for a in conf.get("areas", [])}
        for f in result.critical_files:
            ids = result.area_of(f)
            tours = [areas[i].get("tour") for i in ids if areas.get(i, {}).get("tour") not in (None, "none")]
            area = "、".join(ids) + (f"（ツアー：{', '.join('`'+t+'`' for t in tours)}）" if tours else "")
            own = " ".join("@" + o for o in risk.owners_of(codeowners, f)) or "（なし）"
            out.append(f"| `{f}` | {area} | {own} |")
        out.append("")
    out.append("判定の正本：`.github/settings/risk.yml`（main の側）。説明：`docs/review.md`")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pr", type=int)
    ap.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY"))
    ap.add_argument("--root", default=".")
    ap.add_argument("--files", nargs="*")
    ap.add_argument("--body-file")
    a = ap.parse_args()

    root = pathlib.Path(a.root)
    conf = risk.load(root / ".github/settings/risk.yml")
    codeowners = risk.parse_codeowners((root / ".github/CODEOWNERS").read_text(encoding="utf-8"))

    if a.files is not None:
        body = pathlib.Path(a.body_file).read_text(encoding="utf-8") if a.body_file else ""
        res = risk.classify(conf, [risk.FileChange(f) for f in a.files], body)
        print(render(res, conf, codeowners))
        return

    import github as gh

    pr = gh.get(f"/repos/{a.repo}/pulls/{a.pr}")
    files = gh.paged(f"/repos/{a.repo}/pulls/{a.pr}/files")
    changes = [risk.FileChange(f["filename"], f["status"], f["additions"], f["deletions"], f.get("patch", "")) for f in files]
    res = risk.classify(conf, changes, pr.get("body") or "")
    print(f"段階：{res.tier}")

    # ラベル（review:* は1つだけ）
    have = {l["name"] for l in pr.get("labels", [])}
    for t, name in LABELS.items():
        if t != res.tier and name in have:
            gh.delete(f"/repos/{a.repo}/issues/{a.pr}/labels/{name}")
    if LABELS[res.tier] not in have:
        gh.post(f"/repos/{a.repo}/issues/{a.pr}/labels", {"labels": [LABELS[res.tier]]})

    # コメント（1つを書き換える）
    body = render(res, conf, codeowners)
    mine = [c for c in gh.paged(f"/repos/{a.repo}/issues/{a.pr}/comments") if MARK in (c.get("body") or "")]
    if mine:
        gh.patch(f"/repos/{a.repo}/issues/comments/{mine[0]['id']}", {"body": body})
    else:
        gh.post(f"/repos/{a.repo}/issues/{a.pr}/comments", {"body": body})

    s = conf.get("settings", {})
    # AI のレビューを頼む（小さな OSS では自動で回らないことがあるため。docs/review.md）
    if (s.get("ai_reviewer") == "coderabbit" and s.get("ai_request_comment") and res.tier != "light"
            and os.environ.get("PR_ACTION") in ("opened", "ready_for_review", "reopened")):
        gh.post(f"/repos/{a.repo}/issues/{a.pr}/comments", {"body": "@coderabbitai review"})

    # 自動マージ：light なら入れ、light でなくなったら外す
    if pr.get("draft"):
        return
    env = dict(os.environ, GH_TOKEN=os.environ["GITHUB_TOKEN"])
    if res.tier == "light" and s.get("auto_merge_light") and "review:escalate" not in have:
        r = subprocess.run(["gh", "pr", "merge", str(a.pr), "--repo", a.repo, "--auto", "--squash"], env=env, capture_output=True, text=True)
        print("自動マージ：" + ("入れた" if r.returncode == 0 else f"入れられなかった（{r.stderr.strip()[:200]}）"))
    elif pr.get("auto_merge"):
        subprocess.run(["gh", "pr", "merge", str(a.pr), "--repo", a.repo, "--disable-auto"], env=env)
        print("自動マージ：light ではないので外した")


if __name__ == "__main__":
    main()
