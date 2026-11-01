{
  description = "tenkyu の開発環境（nix develop）";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    git-hooks = {
      url = "github:cachix/git-hooks.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      treefmt-nix,
      git-hooks,
    }:
    let
      # ── 使うスタック ─────────────────────────────────────────────
      # 足すときは nix/stacks/<名前>.nix も足す（docs/environment.md）。
      stacks = [
        "ts"
        "cloud"
      ];

      # Intel の Mac（x86_64-darwin）は nixpkgs 26.11 で外れた（26.05 は 2026 年末まで）
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];
      forAll = f: nixpkgs.lib.genAttrs systems (system: f (import nixpkgs { inherit system; }));

      has = s: builtins.elem s stacks;
      treefmtOf = pkgs: treefmt-nix.lib.evalModule pkgs (import ./nix/treefmt.nix { inherit has; });
    in
    {
      formatter = forAll (pkgs: (treefmtOf pkgs).config.build.wrapper);

      checks = forAll (pkgs: {
        formatting = (treefmtOf pkgs).config.build.check self;
        pre-commit = git-hooks.lib.${pkgs.stdenv.hostPlatform.system}.run {
          src = ./.;
          hooks = {
            treefmt = {
              enable = true;
              package = (treefmtOf pkgs).config.build.wrapper;
            };
            gitleaks.enable = true;
          };
        };
      });

      devShells = forAll (
        pkgs:
        let
          common = import ./nix/common.nix { inherit pkgs; };
          load = s: import (./nix/stacks + "/${s}.nix") { inherit pkgs; };
          hooks = self.checks.${pkgs.stdenv.hostPlatform.system}.pre-commit;
          mk =
            name: parts:
            pkgs.mkShell {
              inherit name;
              packages = [
                (treefmtOf pkgs).config.build.wrapper
              ]
              ++ common.packages
              ++ hooks.enabledPackages
              ++ builtins.concatMap (p: p.packages) parts;
              env = builtins.foldl' (a: p: a // (p.env or { })) (common.env or { }) parts;
              shellHook = ''
                ${common.shellHook}
                ${hooks.shellHook}
                ${builtins.concatStringsSep "\n" (map (p: p.shellHook or "") parts)}
                echo "開発シェル：${name}（docs/environment.md）"
              '';
            };
          one = s: mk s [ (load s) ];
        in
        nixpkgs.lib.genAttrs stacks one // { default = mk "default" (map load stacks); }
      );
    };
}
