# libvips recipient replacement

The architecture-qualified source index associates the delivered libraries with
their matching source, patches, build scripts and notices. Keep these materials
available alongside the binary download. Recipients may modify the covered
libraries and reverse engineer the combined work to debug those modifications.
The supplied licenses retain their original scope.

For Linux glibc, sharp loads its packaged library at:

- amd64: `/app/node_modules/@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.8.18.7`
- arm64: `/app/node_modules/@img/sharp-libvips-linux-arm64/lib/libvips-cpp.so.8.18.7`

Mount an interface-compatible library over the selected file, or replace that
file in an owned derived image, and restart the application. Retain UID 1001.
Do not assume `LD_LIBRARY_PATH` overrides sharp's packaged library selection.
Use the retained sharp-libvips build recipe, sources and patches to build a
modified library for the same architecture and libc. The librsvg preferred
source includes the recipe's edits and patch; its original Cargo lock and
checksum-pinned crates are retained as a conservative source superset.

If the filesystem also delivers `linuxmusl-x64` or `linuxmusl-arm64`, its own
measured library and sources remain in the material association. A glibc
execution test does not verify the musl replacement route. Exercise each
delivered target with its matching loader and record the loaded library path,
hash and unchanged host behavior. An identical-byte mount checks the mechanism,
not compilation or execution of a modified library.

The acquisition manifest is not a native replacement receipt. No original CI,
cache or compiler identity is claimed or required by these instructions.
