#!/usr/bin/env bash
# infra/backup-restore-cron.sh
# Automated Daily Postgres Backup & Verification Script
set -euo pipefail

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
BACKUP_FILE="/tmp/campus360_bd_backup_${TIMESTAMP}.dump"

echo "[Backup] Creating compressed custom-format dump..."
pg_dump "${SUPABASE_DB_URL}" -Fc -f "${BACKUP_FILE}"

echo "[Verify] Checking archive table of contents..."
pg_restore --list "${BACKUP_FILE}" | head -n 25

echo "[Success] Backup verified at ${BACKUP_FILE}"
