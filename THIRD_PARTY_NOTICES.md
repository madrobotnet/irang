# Third-party notices

Irang's application code is licensed under the root `LICENSE`. That license
does not relicense dependencies, fonts, official account-login tools, or the
operating-system image. Retain the application copyright and license.

## Installed JavaScript packages

The image build collects the full installed application tree before Next.js
standalone tracing. It collects the official CLI installation separately under
`BUN_INSTALL=/usr/local`.
Run the offline collector with Bun:

```sh
bun scripts/collect-image-licenses.mjs --root /app/node_modules --out /app/app-licenses
bun scripts/collect-image-licenses.mjs --root /usr/local --out /tmp/cli-licenses
```

Each output directory must be new and outside its input tree. Its
`inventory.json` records package names, versions, declared license metadata,
source paths relative to `sourceRoot`, and SHA-256 hashes of the exact retained
bytes. `texts/` holds LICENSE, COPYING, NOTICE and OFL files, including variants
with suffixes. `unresolved.json` records missing metadata/text, declarations
requiring review, unattributed texts and collection errors. A successful exit
means collection completed, not that redistribution was legally approved.
Read errors cause a nonzero exit and remain in the inventory.

The required runtime layout places these directories at `/app/licenses/app` and
`/app/licenses/cli`, together with this document and the application's LICENSE.
Verify those paths in the built image; this source document is not proof that
the build copied them. A license-name list or SBOM cannot replace copyright
notices, full license texts, or required source offers. Review every unresolved
entry before release; resolve applicable source, attribution and redistribution
obligations rather than assuming MIT or silently accepting missing texts.

## Runtimes, base image and official tools

The Dockerfile uses Bun 1.4.2 from `oven/bun:1.4.2-slim` and Node 22 from
`node:22-bookworm-slim`. Preserve their upstream license/notice files and Debian's
`/usr/share/doc` copyright/license records in the final image. Locate and record
the actual files and base-image digests for each architecture during image
verification; package collection alone does not inventory binary runtimes or
system libraries. Consult [Bun's distribution license](https://github.com/oven-sh/bun/blob/main/LICENSE.md),
[Node's license](https://github.com/nodejs/node/blob/main/LICENSE), and the
copyright records for the exact installed Debian packages. Where their terms
require source or an offer, provide the matching source or compliant offer.

The pinned tools are `@openai/codex@0.158.0` and
`@google/gemini-cli@0.61.0`; their installed dependency trees are collected
separately. Consult [Codex](https://github.com/openai/codex) and
[Gemini CLI](https://github.com/google-gemini/gemini-cli) for upstream licenses,
notices and source matching those versions, including bundled native binaries.
Their account-login flows and service use remain governed by provider terms.
Gemini CLI's software license does not grant an entitlement to Google's hosted
services; account eligibility, quotas and service terms still apply. Neither
this inventory nor inclusion in the image constitutes provider endorsement or
legal approval.

## Pretendard

`public/fonts/PretendardVariable.woff2` is distributed with the complete
SIL Open Font License 1.1 and copyright at
`public/fonts/LICENSE-Pretendard.txt` (runtime: `/app/public/fonts/`).
Retain that file with redistributed font copies. The copyright identifies
Kil Hyung-jin and the Reserved Font Name Pretendard. Consult the included
license for bundling, modification, reserved-name and redistribution conditions,
and [Pretendard's upstream source](https://github.com/orioncactus/pretendard)
for the corresponding font sources. Do not apply Irang's MIT license to the font.
