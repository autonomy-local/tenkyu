"""変更の重要度を決める（.github/settings/risk.yml）。impact.py と gate.py から使う。

GitHub に依存しない部分だけを置く（テストしやすいように）。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

import pathspec
import yaml

TIERS = ["light", "standard", "critical"]


def rank(tier: str) -> int:
    return TIERS.index(tier)


def bump(tier: str, n: int = 1) -> str:
    return TIERS[min(rank(tier) + n, len(TIERS) - 1)]


def spec(patterns):
    return pathspec.GitIgnoreSpec.from_lines(patterns)


@dataclass
class FileChange:
    filename: str
    status: str = "modified"  # added / removed / modified / renamed
    additions: int = 0
    deletions: int = 0
    patch: str = ""
    previous_filename: str = ""  # リネームの元のパス


@dataclass
class Result:
    tier: str
    files: dict = field(default_factory=dict)  # filename -> (tier, [area ids])
    reasons: list = field(default_factory=list)
    critical_files: list = field(default_factory=list)

    def area_of(self, filename):
        return self.files.get(filename, ("standard", []))[1]


def load(path):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def adr_impact(body: str) -> str | None:
    """PR の本文の「ADR への影響」節を取り出す。空・「なし」なら None。"""
    if not body:
        return None
    m = re.search(r"^##\s*ADR への影響\s*$(.*?)(?=^##\s|\Z)", body, re.M | re.S)
    if not m:
        return None
    text = re.sub(r"<!--.*?-->", "", m.group(1), flags=re.S).strip()
    if not text or text in ("なし", "無し", "-", "ー"):
        return None
    return text


def classify(conf: dict, changes: list[FileChange], body: str = "") -> Result:
    s = conf.get("settings", {})
    default = s.get("default", "standard")
    areas = [(a, spec(a["paths"])) for a in conf.get("areas", [])]
    res = Result(tier="light")

    for c in changes:
        # リネームは新旧の両方で見る（critical のファイルを移して段階を下げられないように）
        paths = [p for p in (c.filename, c.previous_filename) if p]
        hit = [a for a, sp in areas if any(sp.match_file(p) for p in paths)]
        tier = max((a["tier"] for a in hit), key=rank) if hit else default
        res.files[c.filename] = (tier, [a["id"] for a in hit if a["tier"] == tier])
        if tier == "critical":
            res.critical_files.append(c.filename)
            for a in hit:
                if a["tier"] == "critical":
                    res.reasons.append(f"critical：`{c.filename}` — {a['reason']}")
                    break
        if rank(tier) > rank(res.tier):
            res.tier = tier
    if not changes:
        res.tier = default

    sig = conf.get("signals", {})

    def raise_to(t, why):
        if rank(t) > rank(res.tier):
            res.tier = t
        res.reasons.append(why)

    lk = sig.get("lockfiles")
    if lk:
        sp = spec(lk["paths"])
        hits = [c.filename for c in changes if sp.match_file(c.filename)]
        if hits:
            raise_to(lk["tier"], f"依存の変更：{', '.join('`'+h+'`' for h in hits)}")

    wp = sig.get("workflow_privilege")
    if wp:
        sp = spec(wp["paths"])
        pats = [re.compile(p) for p in wp.get("patterns", [])]
        for c in changes:
            if sp.match_file(c.filename):
                added = [l for l in c.patch.splitlines() if l.startswith(("+", "-")) and not l.startswith(("+++", "---"))]
                if any(p.search(l) for p in pats for l in added):
                    raise_to(wp["tier"], f"workflow の権限・secrets に触れている：`{c.filename}`")
                    if c.filename not in res.critical_files:
                        res.critical_files.append(c.filename)

    if "test_removed" in sig:
        tests = [a for a in conf.get("areas", []) if a["id"] == "tests"]
        tsp = spec(tests[0]["paths"]) if tests else None
        if tsp:
            gone = [c.filename for c in changes if tsp.match_file(c.filename)
                    and (c.status == "removed" or c.deletions > c.additions)]
            if gone:
                res.tier = bump(res.tier, sig["test_removed"].get("bump", 1)) if res.tier != "light" else "standard"
                res.reasons.append(f"テストの削除・減少：{', '.join('`'+g+'`' for g in gone)}")

    if "large_change" in sig:
        total = sum(c.additions + c.deletions for c in changes)
        limit = s.get("large_change_lines", 800)
        if total > limit:
            res.tier = bump(res.tier, sig["large_change"].get("bump", 1))
            res.reasons.append(f"差分が大きい：{total} 行（{limit} 行を超える）")

    if "adr_impact" in sig:
        t = adr_impact(body)
        if t:
            raise_to(sig["adr_impact"]["tier"], f"PR の「ADR への影響」：{t.splitlines()[0][:80]}")

    return res


# ── CODEOWNERS ──────────────────────────────────────────────

def parse_codeowners(text: str):
    rules = []
    for line in text.splitlines():
        line = line.split("#", 1)[0].strip()
        if not line:
            continue
        pat, *owners = line.split()
        rules.append((spec([pat]), [o.lstrip("@").lower() for o in owners]))
    return rules


def owners_of(rules, filename):
    """最後に当たった行が勝つ（GitHub と同じ）。チーム（org/team）は名前のまま返す。"""
    found = []
    for sp, owners in rules:
        if sp.match_file(filename):
            found = owners
    return found
