# CLI redistribution inputs

`width-inputs/` contains eight hash-pinned inputs for the independent width
compatibility module: implementation, ranges, generator template, generation
record, development notes, complete Unicode 6.0 data, and both license texts.
The data and notices match the verified preparation inputs byte for byte.
The implementation retains the same CommonJS API and uses the supported
Node 22 built-in module interface to load its ranges.

Pass this directory to `scripts/prepare-redistribution-cli.mjs` using
`--eastasianwidth-replacement distribution/cli/width-inputs`. The preparer
checks every input hash and changes the copied generator's output directory
to the current directory. The resulting preferred-source archive includes
portable `REBUILD.md` instructions and the distinct replacement package identity.

The generator in `width-inputs/` is a preparation template, not a build entry
point. Its original development output path and README remain unchanged as
pinned inputs. Run the adapted generator from the prepared archive instead.

Use `scripts/apply-cli-replacement.mjs` to apply that archive to an owned
runtime or source tree. Preserve original warning observations separately.
Preparing or applying these inputs does not approve native linkage, the final
image, recipient source access, or publication.
