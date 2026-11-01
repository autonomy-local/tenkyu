# どのスタックにも入れるもの。
{ pkgs }:
{
  packages = with pkgs; [
    git
    gh
    jq
    yq-go
    curl
    just
    # 秘密情報（正本は sops で暗号化したファイルだけに置く）
    sops
    age
    # 検査
    gitleaks
    osv-scanner
    # SQL が正本（TS は sqlc-gen-ts-d1、Go は sqlc の Go 出力）
    sqlc
    sqlite
    # 仕様駆動開発（Spec Kit の CLI、specify）
    spec-kit
    # API のシナリオのテスト
    runn
    nixfmt
  ];

  shellHook = ''
    # リポジトリの根（flake.nix のある所）
    export REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
  '';
}
