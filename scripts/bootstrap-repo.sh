#!/usr/bin/env bash
# テンプレートから作ったリポジトリに、ファイルではコピーされない設定を反映する。
#   - マージの方法（squash だけ）、マージ後のブランチ削除
#   - ラベル（.github/settings/labels.yml）
#   - main のルールセット（.github/settings/ruleset-main.json）
#
# 使い方：  scripts/bootstrap-repo.sh [OWNER/REPO] [--prune-labels] [--kickoff-issues]
#   OWNER/REPO を省くと、今いるリポジトリ。何度流してもよい（同じ状態に収束する）。
#   --prune-labels を付けると、labels.yml に無いラベル（GitHub の既定のラベルなど）を消す。
#   area:* のラベルは消さない。
#   --kickoff-issues を付けると、着手の条件（.github/settings/kickoff.yml）の項目ごとに Issue を起こす。
#   同じ題の Issue があれば起こさない。
#
# 必要なもの：gh（認証済み、repo の admin 権限）、python3（PyYAML）
# 注意：private リポジトリでは、プランによってルールセットを作れても強制されない。
#       それでも同じスクリプトを流しておく（プランが変わったときにそのまま効く）。
set -euo pipefail

cd "$(dirname "$0")/.."

REPO=""
PRUNE=0
KICKOFF=0
for a in "$@"; do
  case "$a" in
  --prune-labels) PRUNE=1 ;;
  --kickoff-issues) KICKOFF=1 ;;
  *) REPO="$a" ;;
  esac
done
if [ -z "$REPO" ]; then
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
fi
echo "対象：$REPO"

# 1. マージの設定
gh api -X PATCH "repos/$REPO" \
  -F allow_squash_merge=true \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true \
  -F allow_auto_merge=true \
  -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=COMMIT_MESSAGES \
  >/dev/null
echo "マージの設定：squash だけ、マージ後にブランチを削除、自動マージを許す（light の PR）"

# 2. ラベル
python3 - .github/settings/labels.yml >/tmp/labels.tsv <<'PY'
import sys, yaml
for l in yaml.safe_load(open(sys.argv[1], encoding="utf-8")):
    print("\t".join([l["name"], str(l["color"]).lstrip("#"), l.get("description", "")]))
PY
while IFS=$'\t' read -r name color desc; do
  gh label create "$name" --repo "$REPO" --color "$color" --description "$desc" --force >/dev/null
  echo "ラベル：$name"
done </tmp/labels.tsv

if [ "$PRUNE" = 1 ]; then
  cut -f1 /tmp/labels.tsv | sort >/tmp/labels.want
  gh label list --repo "$REPO" --limit 500 --json name -q '.[].name' | sort >/tmp/labels.have
  comm -13 /tmp/labels.want /tmp/labels.have | grep -v '^area:' | while read -r name; do
    gh label delete "$name" --repo "$REPO" --yes >/dev/null
    echo "ラベルを削除：$name"
  done || true
fi

# 3. ルールセット（同じ名前があれば更新、なければ作る）
RS=.github/settings/ruleset-main.json
NAME="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["name"])' "$RS")"
ID="$(gh api "repos/$REPO/rulesets" -q ".[] | select(.name==\"$NAME\") | .id" 2>/dev/null || true)"
if [ -n "$ID" ]; then
  gh api -X PUT "repos/$REPO/rulesets/$ID" --input "$RS" >/dev/null
  echo "ルールセットを更新：$NAME（id $ID）"
else
  gh api -X POST "repos/$REPO/rulesets" --input "$RS" >/dev/null
  echo "ルールセットを作成：$NAME"
fi

# 4. 着手の条件の Issue
if [ "$KICKOFF" = 1 ]; then
  python3 - .github/settings/kickoff.yml >/tmp/kickoff.tsv <<'PY'
import sys, yaml
for r in yaml.safe_load(open(sys.argv[1], encoding="utf-8"))["required"]:
    print("\t".join([r["title"], r["path"]]))
PY
  while IFS=$'\t' read -r title path; do
    t="[着手] $title"
    if gh issue list --repo "$REPO" --state all --search "\"$t\" in:title" --json title -q '.[].title' | grep -qxF "$t"; then
      echo "Issue はある：$t"
      continue
    fi
    gh issue create --repo "$REPO" --title "$t" --label docs --label needs:decision --label p1 --body "着手の条件（[docs/kickoff.md](https://github.com/$REPO/blob/main/docs/kickoff.md)）の1つ。

## やること

- \`$path\` を書く。ファイルの冒頭のコメントに「決めること」がある
- 決まったら「状態」を書き換える（PRD は「承認」、ADR は「採用」）

## 終了条件

- [ ] \`$path\` の「状態」が書き換わっている
- [ ] \`python3 scripts/check-kickoff.py\` でこの項目に ✓ が付く

## やらないこと

- 実装（条件がそろうまで、文書以外の変更は main に入らない）" >/dev/null
    echo "Issue を起こした：$t"
  done </tmp/kickoff.tsv
fi

echo "完了。"
echo "手で設定するもの：Settings → General → Features → Pull requests を Collaborators only（外からの PR を止める。CONTRIBUTING.md）"
echo "Jules を使う場合は、Jules の GitHub アプリにこのリポジトリへのアクセスを与えてください。"
