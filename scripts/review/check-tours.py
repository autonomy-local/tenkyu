#!/usr/bin/env python3
"""コードツアー（.tours/*.tour、CodeTour の形式）を確かめる。

1. risk.yml の critical の領域で、当たるファイルがリポジトリにあるのに、tour が無いものはないか
2. 各ツアーの順路（file、line、pattern）が、今のコードを指しているか
"""
import json
import pathlib
import re
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import risk  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]


def tracked():
    out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True).stdout
    return [p for p in out.decode().split("\0") if p]


def main():
    conf = risk.load(ROOT / ".github/settings/risk.yml")
    files = tracked()
    errors = []

    for a in conf.get("areas", []):
        if a["tier"] != "critical":
            continue
        tour = a.get("tour")
        hits = [f for f in files if risk.spec(a["paths"]).match_file(f)]
        if not hits:
            continue
        if not tour:
            errors.append(f"領域 {a['id']}：ファイルがあるのに tour が書かれていない（要らないなら tour: none）")
        elif tour != "none" and not (ROOT / tour).exists():
            errors.append(f"領域 {a['id']}：{tour} が無い（当たるファイルの例：{hits[0]}）")

    for t in sorted((ROOT / ".tours").glob("*.tour")):
        rel = t.relative_to(ROOT)
        try:
            data = json.loads(t.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"{rel}：JSON が読めない（{e}）")
            continue
        for i, st in enumerate(data.get("steps", []), 1):
            f = st.get("file") or st.get("directory")
            if not f:
                continue
            p = ROOT / f
            if not p.exists():
                errors.append(f"{rel} の {i} 歩目：{f} が無い")
                continue
            if p.is_dir() or "file" not in st:
                continue
            lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
            if "pattern" in st and not any(re.search(st["pattern"], l) for l in lines):
                errors.append(f"{rel} の {i} 歩目：{f} に pattern「{st['pattern']}」が見つからない")
            if "line" in st and st["line"] > len(lines):
                errors.append(f"{rel} の {i} 歩目：{f} は {len(lines)} 行しかない（line {st['line']}）")

    if errors:
        print("コードツアー：")
        for e in errors:
            print(f"  ✗ {e}")
        return 1
    print("コードツアー：✓")
    return 0


if __name__ == "__main__":
    sys.exit(main())
