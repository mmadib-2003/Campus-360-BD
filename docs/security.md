<!-- docs/security.md -->
# Security, Privacy & Data Retention Policy

- **Zero Public Buckets:** `academic-archive`, `complaint-evidence`, and `id-verifications` are strictly private buckets (`public = false`).
- **ID Verification Document Purge:** Student ID card images uploaded for `ID_VERIFIED` status set `file_purge_after = now() + 7 days` and are permanently purged post-review.
- **Anonymous Grievance Cryptographic Isolation:** Anonymous complaints store `student_id = NULL` and a keyed SHA-256 HMAC of the tracking secret (`tracking_secret_hash`), preventing identity correlation even under database inspection.
- **Google Maps API Key Separation:** Web key restricted by HTTP referrer; Android key restricted by package name + SHA-1; iOS key restricted by bundle ID.
