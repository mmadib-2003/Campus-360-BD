<!-- docs/mobile-release.md -->
# Mobile Release & App Store / Play Store Submission Guide

- **Universal Links & App Links:** Configured for `campus360bd://` and `https://app.campus360bd.com/*` in `apps/mobile/app.json`.
- **Privacy Manifest & Data Safety:** Location is used strictly foreground-only (`NSLocationWhenInUseUsageDescription`) for campus map display and user-initiated event check-in. Biometrics (`NSFaceIDUsageDescription`) never leave the device Secure Enclave.
- **Build & Submit Commands:**
