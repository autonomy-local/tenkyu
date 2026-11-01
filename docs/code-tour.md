# コードツアー

**理解度をそろえる仕組み。** オンボーディング、critical のレビューの前提、エージェントへの文脈を兼ねる。

## 形式

`.tours/*.tour`（[CodeTour](https://github.com/microsoft/codetour) の形式、JSON）。VS Code 系のエディターに CodeTour の拡張を入れると、順路のとおりにファイルと行を開いて説明を出す。拡張がなくても JSON をそのまま読める。

```json
{
  "$schema": "https://aka.ms/codetour-schema",
  "title": "領域：認証と認可",
  "description": "…",
  "steps": [
    { "file": "src/auth/session.ts", "pattern": "export function verify", "description": "…" }
  ]
}
```

- **位置は `line` ではなく `pattern`（正規表現）で指す。** コードが動いても順路がずれにくい
- 説明には「何をしているか」より**「なぜこうなっているか」「変えると何が壊れるか」**を書く（コードを読めば分かることは書かない）
- CI（`check`）が `scripts/review/check-tours.py` で確かめる：critical の領域にツアーがあるか、順路が今のコードを指しているか

## どのツアーを置くか

| ツアー | 中身 |
| --- | --- |
| `00-onboarding.tour` | 最初に歩く。README → ARCHITECTURE → AGENTS → 着手の条件 → 流れ → レビュー → 開発環境 |
| `<領域>.tour` | risk.yml の critical の領域ごとに1本（`tour:` に書いた名前）。**当たるファイルがリポジトリにできたら必須** |

## 書き方

1. エージェントに下書きを書かせる（「`<領域>` のツアーを `.tours/<領域>.tour` に書いて。なぜそうなっているか、変えると何が壊れるかを中心に」）
2. 人がセッションで歩きながら直す
3. 領域のコードを大きく変えたら、ツアーも同じ PR で直す（CI が順路のずれを止める）

## セッション

- **スプリントごとに1領域、30分。** 発表者は持ち回り。ツアーを画面で歩き、質問をツアーの説明に書き戻す
- **新しく入った人**は、`00-onboarding.tour` と、critical の領域のツアーを全部歩く
- 歩いたら [`.github/settings/ownership.yml`](../.github/settings/ownership.yml) に login と日付を足す（PR で）。誰がどの領域を分かっているか、一人しか分からない領域はどこかが見える
- `risk.yml` の `reviewer_must_have_toured: true` にすると、critical のレビューはツアーを済ませた人だけが数えられる（人が増えたら入れる）

## エージェント

- AGENTS.md：critical の領域を触る前に、その領域のツアーを読む
- ツアーは、エージェントに渡す文脈としても使う（Issue の「参考」にツアーのパスを書く）
