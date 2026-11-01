# Cloudflare・Firebase のローカル開発と、IaC（Pulumi、TypeScript）。
{ pkgs }:
{
  packages = with pkgs; [
    # Cloudflare
    wrangler
    cloudflared
    # Firebase（Emulator Suite は Java で動く）
    firebase-tools
    jdk21_headless
    # IaC
    pulumi
    pulumiPackages.pulumi-nodejs
    nodejs_24
  ];

  env = {
    PULUMI_SKIP_UPDATE_CHECK = "true";
    WRANGLER_SEND_METRICS = "false";
  };

  shellHook = ''
    # Pulumi の状態は、いったん開発者の手元（リポジトリの .pulumi-state/、.gitignore 済み）。
    # 共有の置き場所（GCS か R2）に移すときは docs/environment.md の手順で。
    export PULUMI_BACKEND_URL="''${PULUMI_BACKEND_URL:-file://$REPO_ROOT/.pulumi-state}"
    mkdir -p "$REPO_ROOT/.pulumi-state"
  '';
}
