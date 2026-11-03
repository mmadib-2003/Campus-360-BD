<!-- docs/admin.md -->
# Governing Body, University Admin & Super-Admin Guide

- **Mandatory 2FA (TOTP):** All users granted `GOVERNING_BODY`, `UNIVERSITY_ADMIN`, or `SUPER_ADMIN` roles must enroll in Supabase MFA (`aal2`). RLS policies verify `public.current_user_has_admin_mfa()` before allowing administrative mutations.
- **Grievance Triage (`/admin/complaints`):**
  - View assigned cases sorted by SLA countdown (`sla_due_at`).
  - Add internal notes (`is_internal_note = true`, hidden from students via RLS) or public replies.
  - Transition statuses (`ACKNOWLEDGED` -> `IN_REVIEW` -> `ACTION_TAKEN` -> `RESOLVED`) and upload resolution proof.
