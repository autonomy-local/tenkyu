# TypeScript：Node は LTS、パッケージの管理は pnpm、Bun を併用。E2E は Playwright（ブラウザーも Nix から入れる）。
{ pkgs }:
let
  inherit (pkgs) lib stdenv;
in
{
  packages =
    with pkgs;
    [
      nodejs_24 # LTS
      pnpm
      bun
      typescript
      biome
      playwright-driver.browsers
    ]
    ++ lib.optionals stdenv.hostPlatform.isLinux [
      patchelf
    ];

  env = {
    # npm の @playwright/test は、この版に合わせる（pkgs.playwright-driver.version）
    PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
    PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
  }
  // lib.optionalAttrs stdenv.hostPlatform.isLinux {
    # NixOS 上で unpatched binary（npm の workerd 等）を実行可能にする互換設定
    NIX_LD = lib.fileContents "${pkgs.stdenv.cc}/nix-support/dynamic-linker";
    NIX_LD_LIBRARY_PATH = lib.makeLibraryPath (
      with pkgs;
      [
        stdenv.cc.cc.lib
        zlib
      ]
    );
  };

  shellHook = ''
    export PLAYWRIGHT_VERSION="${pkgs.playwright-driver.version}"
    ${lib.optionalString stdenv.hostPlatform.isLinux ''
      # NixOS で互換リンカーがない場合でも npm の workerd を起動できるよう、未パッチのバイナリ（.pnpm 配下を含む）を自動パッチ
      if [ -n "$NIX_LD" ] && [ -d "$REPO_ROOT/node_modules" ]; then
        for bin in $(find "$REPO_ROOT/node_modules" -type f -name workerd 2>/dev/null); do
          if [ -x "$bin" ]; then
            patchelf --set-interpreter "$NIX_LD" "$bin" 2>/dev/null || true
          fi
        done
      fi
    ''}
  '';
}
