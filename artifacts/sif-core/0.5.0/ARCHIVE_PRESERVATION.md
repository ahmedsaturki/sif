# SIF Core 0.5.0 Artifact Preservation

The authoritative byte-for-byte release artifacts are preserved in the persistent ChatGPT Library because the GitHub repository connector available to this session is text-oriented and cannot safely carry the binary ZIP/TGZ bytes without risking corruption.

## Source archive

- filename: `sif-core-0.5.0-source.zip`
- SHA-256: `3f728ac799be5714efdbbddb80fae98152a3767f339f29ee84750ec1c2687bd5`
- preserved Library path: `/SIF/0.5.0/sif-core-0.5.0-source.zip`
- local verified size at preservation time: 39267 bytes

## npm artifact

- filename: `sif-core-0.5.0.tgz`
- SHA-256: `c1b6d297ebef82523d4e1abc0249497fa702f3bd68bd6fa25d839402cc122abc`
- preserved Library path: `/SIF/0.5.0/sif-core-0.5.0.tgz`

## Integrity rule

The hashes above are identity records. They are not claims that these binary artifacts are currently stored byte-for-byte in the Git object database.

The Git repository itself preserves the source/test implementation tree and all documentation needed to reconstruct and verify the kernel. Binary release publication should occur through a release artifact channel after the repository CI and live verification gates are satisfied.
