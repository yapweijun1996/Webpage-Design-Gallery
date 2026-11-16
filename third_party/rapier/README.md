# Pinned Rapier source

`rapier-original.mjs.gz` is a deterministic gzip archive of the previously
vendored Rapier JavaScript module. Its uncompressed SHA-256 is
`02dc6a4e2fffc013bab08fbb44fa68f501d8303615e9afe4c7d89ad4eedda0d0`.
The existing license remains at `demos/corporate/gjh/v11/vendor/rapier.LICENSE`.

`python3 scripts/build_rapier.py` extracts the original, byte-identical WASM
and changes only its initialization expression to load that local binary. The
gallery build runs and verifies this step automatically. The archived source is
not included in the published runtime. The split avoids the base64 expansion;
it adds one request and does not by itself establish a wire-size or speed gain.
