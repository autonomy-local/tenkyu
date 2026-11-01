# よく使うコマンドの正本（AGENTS.md の「よく使うコマンド」はここを指す）。`just` で一覧。

default:
    @just --list

# 整形（treefmt。nix/treefmt.nix）
fmt:
    treefmt

# 手元でできる検査を全部（着手の条件、整形、pre-commit のフック）
check:
    python3 scripts/check-kickoff.py
    nix flake check

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
