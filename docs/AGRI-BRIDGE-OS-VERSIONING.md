# AgriBridge OS Versioning

AgriBridge OS uses product releases independent of the npm package version.

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

The first approved baseline is documented in `docs/releases/AgriBridge-OS-v0.1.0.md`.
