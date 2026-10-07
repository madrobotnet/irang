# Historical derived-code permissions and source access

This material covers the known esbuild, Lightning CSS, Servo and uucode
derivations in Bun 1.4.2 at `744846f844374847c902b5e7fd59b4342a51ef99`.
It records historical grants and a conservative notice/source superset.
It does not claim exact original upstream incorporation revisions, an original
build identity, completed publication or a successful native relink.

## Source and notice access

Keep `manifest.json`, the complete `notices/` tree and all `sources/` archives
together. `sources/bun.tar.gz` is the complete preferred modified Bun source,
including `src/css/`, selectors, parser, resolver, Unicode code/table generator,
build recipes and patches. The separate historical source archives retain their
unmodified upstream files, headers and complete license texts. They are related
historical reference sources, not substitutes for Bun's preferred modified source.
The manifest records their actual revisions, source URLs and hashes.

For the Lightning CSS/Servo-derived Covered Software and its modifications in
`src/css/`, including selectors and the CSS generator, Source Code Form is
available under MPL 2.0. The full historical MPL texts and source notices are
included under `notices/`; the complete source is `sources/bun.tar.gz`.
This statement preserves the MPL rights in those derived portions; it does not
relicense unrelated Bun code or erase compatible notices. Source recipients
retain the rights in MPL sections 3.1-3.4. Any later executable distribution
must tell recipients how to obtain these same source materials by reasonable
means, in a timely manner, at no more than distribution cost. The material
phase prepares that access input; actual equivalent-access delivery belongs
to the publication graph. No written offer is substituted.

## esbuild

The first real Bun parser implementation after the incomplete stub is
`7bc04fb5de8a197e985c83f5668451481ddc309a`, with 22,027 bytes of implemented
parser structures and an esbuild issue 1158 reference. The historical esbuild
snapshot `65a010fd2ed1ea5ff88b380196f246cbc638dcfd` has the corresponding parser
structure names and MIT grant. `LICENSE.md` history identifies the 2020-01-15
grant by Evan Wallace, Copyright 2020, with no later grant change in the
queried complete path history. That grant permits copying and modification
subject to retaining its copyright and permission notice; it does not require
an original-import revision receipt.

The historical `internal/fs/filepath.go` has a separate complete BSD grant:
Copyright 2009 The Go Authors, with source/binary notice and non-endorsement
conditions. Its full comment is retained as well. Conservatively retaining
this notice covers the possible filesystem/resolver-derived portion without
claiming it is absent or definitely incorporated. The primary MIT grant is
not substituted for this secondary BSD grant.

## Lightning CSS

The actual Bun CSS import is `274e5a202223ae8b809b556565fae2979d59fcd5`.
Its `build-prefixes.js` carries the explicit MPL 2.0 source notice.
Lightning CSS's historical root license was MIT at
`6c5df3ed356f0e84a446dc23ac4bdd7f0e4f8baa`, Copyright 2021-present Devon Govett,
then changed to MPL 2.0 at `3e8f71ef3729879872e78f4cb2cc6f22cd2597ad`.
Both authentic variants are retained unchanged. The contemporaneous upstream
snapshot `eb49015cf887ae720b80a2856ccbdf61bf940ef1` declares MPL-2.0 in Cargo
and retains the full source and selector notices.

The conservative boundary satisfies both possibilities: retain the genuine
MIT copyright/permission notice and comply with MPL source, notice and access
conditions for derived Covered Software. There is no claim that later MPL
retroactively licenses preexisting third-party code or replaces the MIT notice.

## Servo

The historical Lightning CSS selector package identifies its authors as
`The Servo Project Developers`, declares MPL-2.0, and has explicit MPL headers
in the actual selector source. Its `selectors/LICENSE` blob
`d8b475b6e17e390d702c9be4d3a735c7622b9735` equals Servo's historical root
license at the 2024 CSS-import boundary. The complete selector source and
notices are in `sources/lightningcss-history.tar.gz`; Bun's modified selector
source is in `sources/bun.tar.gz`.

MPL grants cover Contributor Versions and modifications, with notice retention
and preferred-source access. The authentic Servo MPL text, named contributor
identity, original selector headers and modified source are all retained.
The broad Servo repository tree query was truncated and is not used to assert
anything about unrelated Servo code or notices.

For the additional cssparser lineage, the actual historical Lightning CSS
Cargo.lock pins cssparser 0.33.0, checksum
`9be934d936a0fbed5bcdc01042b770de1398bf79d0e192f49fa7faea0e99281e`.
That entire original crate is retained as `sources/cssparser-history.tar.gz`.
The original 2013 Simon Sapin BSD grant at
`0bad1d50ce955bebbc845b5522f5a99d203a04f3` and the subsequent MPL grant at
`5327f91776673d9052ef6ce45004f9c878105344` are retained separately.
Both notice/access conditions are carried forward; the MPL transition does
not waive the earlier BSD copyright, disclaimer or non-endorsement condition.

## uucode

The exact vendored Bun 0.1.0 grant retains Copyright 2025 Jacob Sandlund.
The historical upstream 2025 grant and authentic 2026 year variant are also
retained, separately, without combining or inventing copyright years.
The two referenced secondary files are recovered from their genuine histories:

- `LICENSE_Bjoern_Hoehrmann` at
  `731c2c0da439e71b9125cae2315e621f1e61deb4`: Copyright 2008-2009
  Bjoern Hoehrmann, full MIT-style permission/disclaimer.
- `LICENSE_unicode` at
  `90a5dfa34a1da9d59b96417d73843c3c658f4816`: Unicode License V3,
  Copyright 1991-2025 Unicode, Inc., full data/software permission, warranty
  disclaimer and restrictions on promotional use of the holder's name.

Each secondary file has a single change in its complete queried path history.
Both historical bytes equal the later retained supplemental copies, now proved
historical rather than assumed from a current-only text.
The vendored `ucd/auxiliary/GraphemeBreakProperty.txt` is Unicode 16.0.0,
Copyright 2024 Unicode, and byte-identical to the 2025 upstream snapshot
(Git blob `a863397ddabafe5657e15d5b5d9348bdadc56fab`).
An authentic Unicode 2001-2024 V3 grant is retained as an additional historical
variant, not substituted for the project-specific 1991-2025 notice.

MIT permits modified algorithms with retained notices; Unicode V3 permits
modified data/software when its full notice accompanies the software or its
documentation. All those notices and their original scope are supplied.
The historical snapshot is not asserted identical to the entire vendored tree:
only 10 of 33 compared files match the October snapshot exactly.
Missing origin precision does not remove permission to make the remaining
modifications, nor justify inventing a new grant.

## Material boundary

These four permission/notice gaps are addressed by authentic historical grants,
retained compatible secondary terms, preferred modified source and explicit
MPL source-access inputs. Original upstream revision mapping remains a
historical identity limitation, not a standalone MIT/BSD material blocker.
Native rebuild/relink checks are separate from source acquisition.
Final publication must distribute the prepared source/access materials
and preserve these conditions; this document alone does not approve a release.
