#!/usr/bin/env python3
"""Spec Kit の出力（specs/<機能>/spec.md と tasks.md）から、Issue（テンプレート「タスク」の形）を起こす。

  spec_to_issues.py specs/001-booking            確認だけ（作る Issue を表示する）
  spec_to_issues.py specs/001-booking --apply    Issue を作る（同じものがあれば作らない）

- tasks.md のフェーズ（Setup・Foundational・ユーザーストーリーごと・Polish）を1つの Issue にする（1 Issue＝1 PR）
- 終了条件は、spec.md の受け入れのシナリオ（Given/When/Then）と、tasks.md の Independent Test・Checkpoint から作る
- [NEEDS CLARIFICATION] が残る、終了条件が作れない、やらないことが無い Issue には needs:decision を付ける
- agent:ready は付けない（人が見てから付ける）
- 本文に <!-- spec: <機能>/<フェーズ> --> を埋め、同じ印の Issue があれば作らない
"""
from __future__ import annotations

import argparse
import os
import pathlib
import re
import sys
from dataclasses import dataclass, field

MARK = "<!-- spec: {feature}/{key} -->"

RE_PHASE = re.compile(r"^##\s+(?:Phase|フェーズ)\s*(\w+)\s*[:：]\s*(.+?)\s*$")
RE_STORY = re.compile(r"(?:User Story|ユーザーストーリー)\s*(\d+)\s*[-–—:：]?\s*(.*?)\s*[（(](?:Priority|優先度)\s*[:：]\s*(P\d+)[)）]")
RE_TASK = re.compile(r"^\s*- \[( |x|X)\]\s+(T\d{3})\s+(?:(\[P\])\s+)?(?:\[(US\d+)\]\s+)?(.*)$")
RE_LABEL = re.compile(r"^\*\*(Goal|Purpose|目的|ゴール|Independent Test|独立テスト|独立したテスト|Checkpoint|チェックポイント)\*\*\s*[:：]\s*(.+)$")
RE_SPEC_STORY = re.compile(r"^###\s+(?:User Story|ユーザーストーリー)\s*(\d+)\s*[-–—:：]?\s*(.*?)\s*[（(](?:Priority|優先度)\s*[:：]\s*(P\d+)[)）]")
CLARIFY = re.compile(r"NEEDS CLARIFICATION|要確認")
OUT_OF_SCOPE = re.compile(r"out of scope|範囲外|対象外|扱わない|含めない|やらない", re.I)


@dataclass
class Task:
    id: str
    done: bool
    parallel: bool
    story: str | None
    text: str


@dataclass
class Phase:
    num: str
    title: str
    key: str  # setup / foundational / US1 / polish / phase<N>
    kind: str  # setup / foundational / story / polish / other
    priority: str | None = None
    goal: str = ""
    independent_test: str = ""
    checkpoints: list = field(default_factory=list)
    tasks: list = field(default_factory=list)


@dataclass
class Story:
    num: str
    title: str
    priority: str
    body: str = ""
    scenarios: list = field(default_factory=list)
    independent_test: str = ""
    clarify: list = field(default_factory=list)


@dataclass
class Spec:
    stories: dict = field(default_factory=dict)  # "US1" -> Story
    requirements: list = field(default_factory=list)
    edge_cases: list = field(default_factory=list)
    out_of_scope: list = field(default_factory=list)
    clarify: list = field(default_factory=list)


def parse_tasks(text: str) -> list[Phase]:
    phases: list[Phase] = []
    cur = None
    for line in text.splitlines():
        m = RE_PHASE.match(line)
        if m:
            num, title = m.groups()
            s = RE_STORY.search(title)
            low = title.lower()
            if s:
                key, kind = f"US{s.group(1)}", "story"
                cur = Phase(num, title, key, kind, priority=s.group(3))
            elif "setup" in low or "セットアップ" in title or "準備" in title:
                cur = Phase(num, title, "setup", "setup")
            elif "foundation" in low or "基盤" in title:
                cur = Phase(num, title, "foundational", "foundational")
            elif "polish" in low or "仕上げ" in title or "cross-cutting" in low:
                cur = Phase(num, title, "polish", "polish")
            else:
                cur = Phase(num, title, f"phase{num}", "other")
            phases.append(cur)
            continue
        if line.startswith("## "):
            cur = None  # 依存関係などの節
            continue
        if cur is None:
            continue
        t = RE_TASK.match(line)
        if t:
            done, tid, par, story, desc = t.groups()
            cur.tasks.append(Task(tid, done.lower() == "x", bool(par), story, desc.strip()))
            continue
        lab = RE_LABEL.match(line.strip())
        if lab:
            name, val = lab.groups()
            if name in ("Goal", "Purpose", "目的", "ゴール"):
                cur.goal = val
            elif name in ("Checkpoint", "チェックポイント"):
                cur.checkpoints.append(val)
            else:
                cur.independent_test = val
    return [p for p in phases if p.tasks]


def _section(text, *names):
    pat = "|".join(re.escape(n) for n in names)
    m = re.search(rf"^#{{2,3}}\s+(?:{pat}).*?$(.*?)(?=^#{{2,3}}\s|\Z)", text, re.M | re.S | re.I)
    return m.group(1) if m else ""


def _bullets(block):
    out = []
    for l in block.splitlines():
        l = l.strip()
        if re.match(r"^([-*]|\d+\.)\s+", l):
            out.append(re.sub(r"^([-*]|\d+\.)\s+", "", l))
    return out


def parse_spec(text: str) -> Spec:
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    sp = Spec()
    lines = text.splitlines()
    cur, mode = None, None
    for line in lines:
        m = RE_SPEC_STORY.match(line)
        if m:
            cur = Story(m.group(1), m.group(2), m.group(3))
            sp.stories[f"US{cur.num}"] = cur
            mode = "body"
            continue
        if cur and (line.startswith("## ") or (line.startswith("### ") and not RE_SPEC_STORY.match(line))):
            cur, mode = None, None
        if not cur:
            continue
        s = line.strip()
        if s == "---":
            continue
        if re.match(r"^\*\*(Acceptance Scenarios|受け入れのシナリオ|受け入れシナリオ)\*\*", s):
            mode = "scenarios"
            continue
        it = re.match(r"^\*\*(Independent Test|独立テスト|独立したテスト)\*\*\s*[:：]\s*(.+)$", s)
        if it:
            cur.independent_test = it.group(2)
            continue
        if CLARIFY.search(s):
            cur.clarify.append(s)
        if mode == "scenarios" and re.match(r"^\d+\.\s+", s):
            cur.scenarios.append(re.sub(r"^\d+\.\s+", "", s).replace("**", ""))
        elif mode == "body" and s and not s.startswith("**"):
            cur.body += (" " if cur.body else "") + s
    sp.requirements = _bullets(_section(text, "Functional Requirements", "機能要件"))
    sp.edge_cases = _bullets(_section(text, "Edge Cases", "端の場合", "エッジケース"))
    assumptions = _bullets(_section(text, "Assumptions", "前提"))
    scope = _bullets(_section(text, "Out of Scope", "範囲外", "やらないこと"))
    sp.out_of_scope = scope + [a for a in assumptions if OUT_OF_SCOPE.search(a)]
    sp.clarify = [l.strip() for l in lines if CLARIFY.search(l)]
    return sp


@dataclass
class Draft:
    key: str
    title: str
    labels: list
    body: str
    depends_on: list  # 先に作る Issue の key


def build(feature: str, spec: Spec, phases: list[Phase], spec_path: str, tasks_path: str, link=None) -> list[Draft]:
    link = link or (lambda path: path)
    keys = [p.key for p in phases]
    stories = [p.key for p in phases if p.kind == "story"]
    drafts = []
    for p in phases:
        if p.kind == "setup":
            deps = []
        elif p.kind == "foundational":
            deps = [k for k in keys if k == "setup"]
        elif p.kind == "story":
            deps = [k for k in keys if k in ("setup", "foundational")][-1:]
        elif p.kind == "polish":
            deps = stories or [k for k in keys if k != "polish"][-1:]
        else:
            i = keys.index(p.key)
            deps = keys[i - 1:i]

        st: Story | None = spec.stories.get(p.key) if p.kind == "story" else None
        decision = []

        # 終了条件
        crit = []
        if st:
            crit += [f"- [ ] {s}" for s in st.scenarios]
        test = (st.independent_test if st and st.independent_test else "") or p.independent_test
        if test:
            crit.append(f"- [ ] 単独で確かめられる：{test}")
        crit += [f"- [ ] {c}" for c in p.checkpoints]
        open_tasks = [t for t in p.tasks if not t.done]
        if not crit:
            decision.append("終了条件が作れない（受け入れのシナリオ・Independent Test・Checkpoint が無い）")
        crit.append(f"- [ ] `{tasks_path}` の {open_tasks[0].id if open_tasks else ''}〜{open_tasks[-1].id if open_tasks else ''} がすべて完了している（チェックが付いている）" if open_tasks else "- [ ] （このフェーズのタスクは完了済み）")

        if st and st.clarify:
            decision.append("spec.md のこのストーリーに [NEEDS CLARIFICATION] が残っている")
        if not spec.out_of_scope:
            decision.append("spec.md に範囲外（やらないこと）の記述が無い")

        what = "\n".join(
            f"- [{'x' if t.done else ' '}] {t.id}{' [P]' if t.parallel else ''} {t.text}" for t in p.tasks
        )
        bg = [f"[{spec_path}]({link(spec_path)}) / [{tasks_path}]({link(tasks_path)}) の「{p.title}」。"]
        if st and st.body:
            bg.append(st.body)
        if p.goal:
            bg.append(f"**目的**：{p.goal}")
        if spec.edge_cases and p.kind == "story":
            what += "\n\n端の場合（spec.md）：\n" + "\n".join(f"- {e}" for e in spec.edge_cases)

        not_doing = "\n".join(f"- {o}" for o in spec.out_of_scope) or "（spec.md に記述なし。判断が要る）"
        not_doing += "\n- tasks.md のほかのフェーズのタスク（それぞれの Issue で扱う）"

        refs = [f"- [{spec_path}]({link(spec_path)})", f"- [{tasks_path}]({link(tasks_path)})"]
        plan = str(pathlib.PurePosixPath(spec_path).with_name("plan.md"))
        refs.append(f"- [{plan}]({link(plan)})（設計。決定が含まれていれば ADR に切り出す）")
        if spec.requirements and p.kind == "story":
            refs.append("- 機能要件（spec.md）：\n" + "\n".join(f"  - {r}" for r in spec.requirements))

        q = "\n".join(f"- {d}" for d in decision)
        if st and st.clarify:
            q += "\n" + "\n".join(f"  - {c}" for c in st.clarify)

        body = "\n\n".join([
            MARK.format(feature=feature, key=p.key),
            "### 背景と目的\n\n" + "\n\n".join(bg),
            "### やること\n\n" + what,
            "### 終了条件\n\n" + "\n".join(crit),
            "### やらないこと\n\n" + not_doing,
            "### 前提となる Issue\n\n{deps}",
            "### 参考\n\n" + "\n".join(refs),
            "### 判断が要る点\n\n" + (q or "なし"),
        ])

        labels = ["chore" if p.kind in ("setup", "polish") else "feat"]
        pr = (p.priority or "").upper()
        labels.append({"P1": "p1", "P2": "p2"}.get(pr, "p3") if pr else ("p1" if p.kind in ("setup", "foundational") else "p3"))
        if decision:
            labels.append("needs:decision")
        labels.append("spec")
        name = f"{p.key}：{st.title}" if st else p.title
        drafts.append(Draft(p.key, f"[タスク] {feature} {name}", labels, body, deps))
    return drafts


def render_deps(d: Draft, numbers: dict) -> str:
    if not d.depends_on:
        return d.body.replace("{deps}", "なし")
    refs = ", ".join(f"#{numbers[k]}" if k in numbers else f"（{k} の Issue）" for k in d.depends_on)
    return d.body.replace("{deps}", refs)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("feature_dir", help="specs/<番号-機能>")
    ap.add_argument("--apply", action="store_true", help="Issue を作る（付けなければ確認だけ）")
    ap.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY"))
    ap.add_argument("--branch", default="main", help="Issue の本文のリンク先のブランチ")
    ap.add_argument("--allow-unclear", action="store_true", help="[NEEDS CLARIFICATION] が残っていても作る")
    a = ap.parse_args()

    d = pathlib.Path(a.feature_dir)
    feature = d.name
    spec_path, tasks_path = (d / "spec.md").as_posix(), (d / "tasks.md").as_posix()
    spec = parse_spec((d / "spec.md").read_text(encoding="utf-8"))
    phases = parse_tasks((d / "tasks.md").read_text(encoding="utf-8"))
    if a.apply and not a.repo:
        import subprocess
        a.repo = subprocess.run(["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
                                capture_output=True, text=True, check=True).stdout.strip()
    link = (lambda path: f"https://github.com/{a.repo}/blob/{a.branch}/{path}") if a.repo else None
    drafts = build(feature, spec, phases, spec_path, tasks_path, link)
    if spec.clarify:
        print(f"spec.md に未解決の点が {len(spec.clarify)} 件ある（/speckit-clarify で片づける）：", file=sys.stderr)
        for c in spec.clarify:
            print(f"  - {c}", file=sys.stderr)
        if a.apply and not a.allow_unclear:
            print("Issue は作らない。片づけてから流すか、--allow-unclear を付ける", file=sys.stderr)
            return 1
    if not drafts:
        print("tasks.md にフェーズとタスクが見つからない（Spec Kit の見出しの形を崩していないか）", file=sys.stderr)
        return 1

    numbers = {}
    if a.apply:
        sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "review"))
        import subprocess
        if "GITHUB_TOKEN" not in os.environ:
            os.environ["GITHUB_TOKEN"] = subprocess.run(["gh", "auth", "token"], capture_output=True, text=True, check=True).stdout.strip()
        import github as gh
        existing = gh.paged(f"/repos/{a.repo}/issues?state=all")
        for dr in drafts:
            mark = MARK.format(feature=feature, key=dr.key)
            for i in existing:
                if mark in (i.get("body") or ""):
                    numbers[dr.key] = i["number"]

    for dr in drafts:
        body = render_deps(dr, numbers)
        if not a.apply:
            print(f"── {dr.title}\nラベル：{', '.join(dr.labels)}\n\n{body}\n")
            continue
        if dr.key in numbers:
            print(f"ある：#{numbers[dr.key]} {dr.title}")
            continue
        made = gh.post(f"/repos/{a.repo}/issues", {"title": dr.title, "body": body, "labels": dr.labels})
        numbers[dr.key] = made["number"]
        print(f"作った：#{made['number']} {dr.title}（{', '.join(dr.labels)}）")
    if not a.apply:
        print(f"確認だけ（{len(drafts)} 件）。作るなら --apply")
    return 0


if __name__ == "__main__":
    sys.exit(main())
