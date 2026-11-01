# TypeScript：Node は LTS、パッケージの管理は pnpm、Bun を併用。E2E は Playwright（ブラウザーも Nix から入れる）。
{ pkgs }:
{
  packages = with pkgs; [
    nodejs_24 # LTS
    pnpm
    bun
    typescript
    biome
    playwright-driver.browsers
  ];

  env = {
    # npm の @playwright/test は、この版に合わせる（pkgs.playwright-driver.version）
    PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
    PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
  };

  shellHook = ''
    export PLAYWRIGHT_VERSION="${pkgs.playwright-driver.version}"
  '';
}
