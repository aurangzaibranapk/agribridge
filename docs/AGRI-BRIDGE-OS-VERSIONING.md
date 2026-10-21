# AgriBridge OS Versioning

AgriBridge OS and the mobile app share one product version. The source is the repo `VERSION` file. The portal `package.json` version and `apps/mobile/package.json` version must match it. `scripts/check-shared-version.mjs` fails the build when they differ.

## Version format

- `v0.1.x`: bug fixes and safe polish within the foundation release
- `v0.2.0`: a new operational phase or major module group
- `v1.0.0`: stable production baseline after security, data, offline and load testing

## Required release record

Each approved release must record:

1. Version and release date
2. New features and fixed issues
3. Database migrations applied
4. Build result
5. Data-preservation check
6. Git commit and tag
7. Deployment and smoke-test result

## Current baseline

The current approved release is documented in `docs/releases/AgriBridge-OS-v0.3.0.md`.

`v0.4.0` is proposed in `docs/releases/AgriBridge-OS-v0.4.0.md` (mobile phase 1). It is not approved until it is deployed. Plan enforcement, which this number used to mean, moves to a later version.
