<!-- docs/deploy.md -->
# Production & Staging Deployment Runbook

- **Database & Edge Functions (Supabase):**
  - Link project: `supabase link --project-ref <prod-ref>`
  - Push migrations: `supabase db push`
  - Deploy Edge Functions:
    - `supabase functions deploy sla-escalation-cron`
    - `supabase functions deploy virus-scan-webhook`
    - `supabase functions deploy event-reminders-cron`
    - `supabase functions deploy push-dispatcher`
- **Web App (Vercel):**
  - Connect GitHub repository, set root directory to `apps/web`, configure environment variables from `.env.example`, and enable HSTS headers.
- **Database Backups:**
  - Daily automated PITR/pg_dump via `infra/backup-restore-cron.sh` verified weekly against a staging restore target.
