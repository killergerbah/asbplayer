{
  description = "A Nix-flake-based development environment";

  inputs = {
    # Pin the Node.js 24.22.1 security backport for the eMudhra CA compromise.
    # Return to nixos-26.05 once that branch includes the fix.
    nixpkgs.url = "github:NixOS/nixpkgs/62ef8c83d850a195c2dfc95975ac1d4b915e6086";
  };

  outputs =
    { self, nixpkgs }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      # The pinned Nixpkgs still ships uv 0.11.21 with the affected CA bundle.
      # Backport upstream's uv 0.13.4 package until the pin can be updated.
      uvSecurityOverlay = _: prev: {
        uv = prev.uv.overrideAttrs (finalAttrs: _: {
          version = "0.13.4";
          src = prev.fetchFromGitHub {
            owner = "astral-sh";
            repo = "uv";
            tag = finalAttrs.version;
            hash = "sha256-US3SjwhWE3v4/i46YuBon2GA6PupC4Z0NRUqcV9CPLM=";
          };
          cargoHash = "sha256-9L47CTlkOVYfGuzE4e7e2FYAI192pAsipzzScF7B1j4=";
          cargoDeps = prev.rustPlatform.fetchCargoVendor {
            inherit (finalAttrs) pname version src;
            hash = finalAttrs.cargoHash;
          };
        });
      };
      forEachSupportedSystem =
        f:
        nixpkgs.lib.genAttrs supportedSystems (
          system:
          f {
            pkgs = import nixpkgs {
              inherit system;
              overlays = [ uvSecurityOverlay ];
            };
          }
        );
    in
    {
      devShells = forEachSupportedSystem (
        { pkgs }: {
          default = pkgs.mkShell {
            packages =
              (with pkgs; [
                nodejs_24
                pnpm
                python313
                basedpyright
                go_1_27
              ])
              ++ (with pkgs.python313Packages; [
                uv
                ruff
              ]);
          };
        }
      );
    };
}
