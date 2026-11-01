# 開発環境

**Nix の flake の devShell が正本。** NixOS・WSL2・macOS のどこでも、`nix develop` で同じ版のツールがそろう。版は `flake.lock` で固定し、週1回 PR で上げる。

## 0. スタック

使うのは `ts` と `cloud` だけ（ADR 0017 の「ツールチェーンと IaC」）。足すときは `flake.nix` の `stacks` と `nix/stacks/<名前>.nix` を足す。

| スタック | 中身 |
| --- | --- |
| `ts` | Node（LTS）、pnpm、Bun、TypeScript、Biome、Playwright（ブラウザー込み） |
| `cloud` | wrangler、cloudflared、firebase-tools、JDK 21、Pulumi（Node） |
| 共通 | git、gh、jq、yq、curl、just、sops、age、gitleaks、osv-scanner、sqlc、sqlite、runn、nixfmt、treefmt |

## 1. 立ち上げ

### Nix を入れる（初回だけ）

| 環境 | やること |
| --- | --- |
| NixOS | `nix.settings.experimental-features = [ "nix-command" "flakes" ];` を設定に足す |
| WSL2（Ubuntu など） | WSL の設定で systemd を有効にしてから、Nix のインストーラーで入れる（マルチユーザー）。flakes を有効にする。**リポジトリは WSL 側のファイルシステム（`~/` の下）に置く**（`/mnt/c` の下は遅く、権限も崩れる） |
| macOS（Apple シリコン） | Nix のインストーラーで入れる。flakes を有効にする。Intel の Mac は nixpkgs 26.11 で外れたので対象外 |

flakes の有効化は `~/.config/nix/nix.conf` に `experimental-features = nix-command flakes`。

### 入る

```sh
nix develop            # 既定（ts と cloud）
nix develop .#ts       # スタックを1つだけ
```

初回は数 GB を取ってくる。**初回に `flake.lock` ができるので、コミットする。**

direnv を使うなら（推奨）：

```sh
# direnv と nix-direnv は、手元の環境（NixOS の設定や home-manager）に入れておく
direnv allow           # 以後、ディレクトリに入るだけで立ち上がる
```

手元だけの値は `.envrc.local`（.gitignore 済み）に書く。

```sh
export PULUMI_CONFIG_PASSPHRASE=...
```

### 確かめる

```sh
just            # コマンドの一覧
just check      # 着手の条件、整形、pre-commit のフック
```

pre-commit のフック（整形と gitleaks）は、シェルに入ったときに自動で入る。

## 2. 技術選定の理由

横断の判断は working-out-loud の ADR にある。ここは要点だけ。

| 選んだもの | 理由 | 横断の ADR |
| --- | --- | --- |
| **Nix の flake の devShell** | OS を問わず、手元・CI・エージェントの作業環境で同じ版になる。版は `flake.lock` で固定し、上げるのは PR で行う。NixOS の OS ごとの宣言（nixosConfiguration）は範囲外 | 0017（Nix の追記） |
| **nixos-unstable** | 「最新」に近い版を取るため。安定版のチャンネルは言語の版が古くなる | |
| **TypeScript（Node LTS ＋ pnpm、Bun を併用）** | Workers・Hono・Pulumi・wrangler・firebase-tools が Node を前提にしている。パッケージの管理は pnpm | 0020 |
| **wrangler（原則）と cloudflared** | Workers のデプロイは wrangler。`cf` CLI はベータなので併用まで | 0011 |
| **firebase-tools、JDK 21** | 移行の間の手段（Firebase Auth）を Emulator Suite で手元で再現する。エミュレーターは Java で動く | |
| **Pulumi（TypeScript）** | IaC を Pulumi に統一。理由は今の管理の手間ではなくポータビリティ（BCP の札）。設定の正本を特定のクラウドの形式に寄せない | 0011 |
| **Pulumi の状態は手元（いったん）** | 出口を先に書く。Pulumi Cloud に預けない。共有が要るようになったら GCS か R2 に移す（下） | 0011、principles 4 |
| **sops ＋ age** | 秘密情報の正本を暗号化したファイル1か所に置く | funadansu ADR-0003 |
| **treefmt、pre-commit、gitleaks** | 機械で守れる規律だけを規律にする。整形と秘密情報の混入はコミットの時点で止める | principles 3 |
| **Playwright を Nix から** | E2E のブラウザーを Nix で固定する。npm の `@playwright/test` は `$PLAYWRIGHT_VERSION` に合わせる | 0023 |
| **just** | よく使うコマンドを1か所に。AGENTS.md はここを指す | |

版は `flake.lock` による。

## 3. Pulumi の状態を移す（共有が要るようになったら）

いったんは手元（`.pulumi-state/`）。複数人や CI から触るようになったら、GCS か R2（S3 互換）に移す。

```sh
cd infra/<対象>
pulumi stack export --stack dev --file dev.json      # 手元から書き出す
export PULUMI_BACKEND_URL=gs://<バケット>              # R2 なら s3://<バケット>?endpoint=<アカウント>.r2.cloudflarestorage.com&region=auto
pulumi login
pulumi stack init dev
pulumi stack import --stack dev --file dev.json
rm dev.json                                          # 状態には秘密の値の暗号文が入る。残さない
```

`.envrc.local` の `PULUMI_BACKEND_URL` を書き換え、ADR 0003 に置き場所と理由を足す。秘密の値の暗号化を passphrase から GCP KMS に替えるなら `pulumi stack change-secrets-provider`。

## 4. 困ったとき

| 症状 | 対処 |
| --- | --- |
| 初回の `nix develop` が遅い | 数 GB を取ってくる。スタックを絞る（0. を先に） |
| Playwright がブラウザーを取りに行く | `@playwright/test` の版を `$PLAYWRIGHT_VERSION` に合わせる |
| Firebase のエミュレーターが起動しない | `java -version` が 21 か。シェルの外の Java を拾っていないか |
| WSL で遅い・権限がおかしい | リポジトリを `/mnt/c` の下から WSL 側の `~/` に移す |
| ツールが足りない | `nix/` に足す PR を出す。`npm i -g` や `curl \| sh` で入れない |
