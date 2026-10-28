# AgriBridge OS Versioning

AgriBridge OS uses product releases independent of the npm package version. The product version source is `AGRIBRIDGE_OS_VERSION` in `src/lib/app-version.ts`. The mobile app reads that same constant for its Android versionName. `npm run test:mobile` fails if the Expo version or versionCode disagree with it. versionCode is `major * 10000 + minor * 100 + patch` (`v0.6.1 Beta` is 601).

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

The current product version string is `AGRIBRIDGE_OS_VERSION` in `src/lib/app-version.ts` (`v0.6.1 Beta` on main as of 21 October 2026). The mobile app does not mint its own number. `v0.4.0` is not this release.
