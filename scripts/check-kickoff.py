#!/usr/bin/env python3
"""着手の条件（.github/settings/kickoff.yml）を確かめる。

  check-kickoff.py                 状況を表示する（終了コードは 0）
  check-kickoff.py --strict        そろっていなければ 1
  check-kickoff.py --base <ref>    PR 用。そろっていないのに、<ref> からの差分に
                                   allowed_before_ready の外の変更があれば 1
"""
import argparse, glob, pathlib, re, subprocess, sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONF = ROOT / ".github/settings/kickoff.yml"
STATE = re.compile(r"^- 状態:\s*(.+)$", re.M)


def state_of(path):
    """文書の「状態」の行を返す。"""
    m = STATE.search(path.read_text(encoding="utf-8"))
    return m.group(1).strip() if m else "（状態の行がない）"


def check(conf):
    """着手の条件を確かめ、(全部そろったか, 項目ごとの行) を返す。"""
    rows, ok_all = [], True
    for r in conf["required"]:
        files = sorted(glob.glob(str(ROOT / r["path"])))
        if len(files) != 1:
            rows.append((False, r["title"], r["path"], f"ファイルが {len(files)} 個（1個にする）"))
            ok_all = False
            continue
        f = pathlib.Path(files[0])
        st = state_of(f)
        ok = any(st.startswith(s) for s in r["states"])
        ok_all &= ok
        rows.append((ok, r["title"], str(f.relative_to(ROOT)), f"状態：{st}"))
    return ok_all, rows


def changed_since(base):
    """base からの差分のファイルの一覧を返す。"""
    out = subprocess.run(["git", "diff", "--name-only", "-z", f"{base}...HEAD"],
                         cwd=ROOT, check=True, capture_output=True).stdout
    return [p for p in out.decode("utf-8").split("\0") if p]


def main():
    """着手の条件を表示し、終了コードを返す。"""
    ap = argparse.ArgumentParser()
    ap.add_argument("--base")
    ap.add_argument("--strict", action="store_true")
    a = ap.parse_args()

    conf = yaml.safe_load(CONF.read_text(encoding="utf-8"))
    ok_all, rows = check(conf)

    print("着手の条件（docs/kickoff.md）")
    for ok, title, path, note in rows:
        print(f"  {'✓' if ok else '✗'} {title}　{path}　{note}")

    if ok_all:
        print("→ そろっている。実装に入ってよい")
        return 0

    if a.base:
        allowed = conf["allowed_before_ready"]
        def is_allowed(p):
            """そのパスが、そろう前に変えてよいものかを返す。"""
            return any(p == x or (x.endswith("/") and p.startswith(x)) for x in allowed)
        bad = [p for p in changed_since(a.base) if not is_allowed(p)]
        if bad:
            print("→ そろう前に、実装の変更が含まれている：")
            for p in bad:
                print(f"    {p}")
            print("  PRD と ADR をそろえる PR を先にマージするか、この変更を外す")
            return 1
        print("→ そろっていないが、この PR は文書だけなので通す")
        return 0

    print("→ そろっていない")
    return 1 if a.strict else 0


if __name__ == "__main__":
    sys.exit(main())
