# Bun and Node corresponding source

This material set covers Bun `1.4.2+744846f84` and Node `22.23.3` on native
Linux amd64 and arm64. `manifest.json` records the actual executable hashes.
Historical ARM64 observations in the source lock are not hashes for new builds.
Keep the manifest, notices and sources together. Publish the complete source
set with equivalent access alongside the matching image; upstream URLs alone
are not delivery. No written source offer is substituted.

Bun statically links LGPL-covered JavaScriptCore/WebKit and TinyCC. Recipients
may modify these libraries, reverse engineer the combined executable to debug
those changes, and rebuild and relink it. Preserve the full applicable licenses.
Source acquisition is not evidence of a successful modified-library relink.

## Acquisition

The portable preparer needs Bun 1.4.2, Node, Git, GNU tar, gzip and a native
Linux target. It measures the completed root filesystem and probes the runtime
through the target's own dynamic loader and library directories. It keeps the
host's live proc filesystem available; a full native container smoke separately
verifies execution in the final filesystem:

```sh
bun --no-env-file scripts/prepare-redistribution-runtime.mjs \
  --runtime-root /target --architecture amd64 --out /materials/runtime
```

Use `arm64` on a native ARM64 host. Output must be new and disjoint from inputs.
The optional `--cache` holds archives named as in `sources/`; every reused file
is checked. `--webkit-git` accepts a bare repository containing the exact
commit/tree, checked with `git fsck`. No private producer directory is required.
Historical notices and sources are fetched from the public URLs and exact
hashes in `history.lock.json` and `texts.lock.json`.

## Rebuild and relink

Extract `sources/bun.tar.gz`. Its root is
`bun-744846f844374847c902b5e7fd59b4342a51ef99`. It retains all source, patches,
`Cargo.lock`, `rust-toolchain.toml`, build recipes and JavaScript codegen locks.
The source set retains every registry crate from the original lock, including
build-only and other-platform inputs, without claiming all are linked.

Extract `sources/webkit.tar.gz`. The complete tree at
`2e2aa2290fac856d6f451ceacb58f7f5b44dd057` includes its build scripts and ICU
patch/data-processing recipe. `sources/icu.tar.gz` supplies the pinned ICU
78.3 input. Do not substitute a current tag or a prebuilt-only WebKit asset.

Use the prerequisites in Bun's retained `docs/project/contributing.mdx`,
`scripts/build/tools.ts` and WebKit's Dockerfile: LLVM 21.1.8,
Rust `nightly-2026-07-20`, CMake, Ninja, C/C++ development tools, Perl,
Python, Ruby and the appropriate ICU inputs. On the target architecture:

```sh
export BUN_WEBKIT_PATH=/work/WebKit-2e2aa2290fac856d6f451ceacb58f7f5b44dd057
bun scripts/build.ts --profile=release-local --package-manager=bun \
  --build-dir=build/release-local
```

This profile source-builds WebKit and relinks Bun. Its POSIX path uses system
ICU; to reproduce the distributed ICU configuration, apply the retained WebKit
ICU recipe instead. No exact upstream compiler or byte reproduction is claimed.

For an owned modified dependency, extract its retained source, apply the patches
listed in `scripts/build/deps/NAME.ts`, and use
`--local-deps=NAME=/work/patched-source`. Local overrides do not apply patches
automatically. TinyCC needs `patches/tinycc/tcc.h.patch`; its retained recipe
selects the architecture-specific source and predefines. Do not reuse ARM
objects for x86-64 or vice versa.

To verify relinking, make an identifiable library change, build the combined
executable and observe the change through that executable. Record commands,
tool versions, modified source and the resulting hash. A component-only build
does not prove full Bun/WebKit relinking.

Node's complete preferred source is `sources/node-preferred.tar.gz`, with the
independent width replacement in its npm dependency tree. The manifest records
the upstream archive hash and preferred output hash; the raw containing archive
is not delivered. Follow the retained Node `BUILDING.md` on the native target.
The replacement includes its generator, Unicode data and licenses; running
`bun generate.mjs` in that module regenerates its pinned ranges. No deletion
patch containing the old implementation is supplied. Node's full shipped
`/usr/local/LICENSE` remains unchanged.
