# よく使うコマンドの正本（AGENTS.md の「よく使うコマンド」はここを指す）。`just` で一覧。

default:
    @just --list

# 整形（treefmt。nix/treefmt.nix）
fmt:
    treefmt

# 手元でできる検査を全部（着手の条件、整形、pre-commit のフック）
check:
    python3 scripts/check-kickoff.py
    python3 -m unittest discover -s scripts/review/tests
    python3 -m unittest discover -s scripts/spec/tests
    python3 scripts/review/check-tours.py
    nix flake check

# PR の段階を手元で見る（例：just impact src/a.ts db/x.sql）
impact +files:
    python3 scripts/review/impact.py --files {{files}}

# レビューの判定のテストと、ツアーの検査
review-test:
    python3 -m unittest discover -s scripts/review/tests
    python3 scripts/review/check-tours.py

# Spec Kit の tasks.md から起こす Issue を確かめる（例：just spec-issues specs/001-login）
spec-issues dir:
    python3 scripts/spec/spec_to_issues.py {{dir}}

# 同じく、Issue を作る（同じ印の Issue があれば作らない）
spec-issues-apply dir:
    python3 scripts/spec/spec_to_issues.py {{dir}} --apply

# Pulumi：preview（例：just infra-preview cloudflare dev）
infra-preview target stack:
    cd infra/{{target}} && npm install --no-audit --no-fund && pulumi preview --stack {{stack}}

# Pulumi：up
infra-up target stack:
    cd infra/{{target}} && npm install --no-audit --no-fund && pulumi up --stack {{stack}}

# Pulumi のテンプレートの型検査
infra-typecheck:
    for d in infra/*/; do (cd "$d" && npm install --no-audit --no-fund && npx tsc --noEmit); done

# Firebase のエミュレーター
firebase-emulators:
    firebase emulators:start

# flake.lock を上げる（CI でも週1回 PR で上がる）
update:
    nix flake update
