# 整形を1本にまとめる（nix fmt、pre-commit、nix flake check の formatting）。
# スタックを外すと、その言語の整形も外れる。
{ has }:
{
  projectRootFile = "flake.nix";
  programs.nixfmt.enable = true;
  programs.shfmt.enable = true;
  programs.biome = {
    enable = has "ts";
    # .editorconfig に合わせる（空白2つ）
    settings.formatter = {
      indentStyle = "space";
      indentWidth = 2;
    };
  };
  programs.rustfmt.enable = has "rust";
  programs.gofmt.enable = has "go";
  programs.fantomas.enable = has "dotnet";
  settings.global.excludes = [
    "*.lock"
    "**/package-lock.json"
    "**/node_modules/**"
    ".pulumi-state/**"
    ".cache/**"
    "docs/**"
  ];
}
